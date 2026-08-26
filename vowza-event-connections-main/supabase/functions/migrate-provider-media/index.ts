// One-time §8 step 4 migration for legacy provider identity documents.
//
// The function is intentionally JWT-gated and admin-gated. It reads legacy
// provider-media objects with the service role, copies each object into the
// private verification-documents bucket, verifies the destination download,
// updates vendor_details to path-only metadata, and only then optionally
// deletes the source object when delete_sources=true is explicitly requested.
// Dry-run is the default and performs no Storage or database writes. It returns
// counts only; it never returns provider rows, URLs, or object paths.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SOURCE_BUCKET = "provider-media";
const DESTINATION_BUCKET = "verification-documents";
const DOCUMENT_FIELDS = [
  { valueKey: "aadhaar_url", pathKey: "aadhaar_path", prefix: "aadhaar" },
  { valueKey: "govt_id_url", pathKey: "govt_id_path", prefix: "govtid" },
  { valueKey: "pan_url", pathKey: "pan_path", prefix: "pan" },
  { valueKey: "selfie_url", pathKey: "selfie_path", prefix: "selfie" },
] as const;

type DocumentField = typeof DOCUMENT_FIELDS[number];

type CopyResult = {
  sourcePath: string;
  destinationPath: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function sourcePathFromStoredValue(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  if (!/^https?:\/\//i.test(value)) return value;

  try {
    const url = new URL(value);
    const marker = `/storage/v1/object/public/${SOURCE_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
  } catch {
    return null;
  }
}

function extensionFor(path: string): string {
  const finalSegment = path.split("/").pop() || "";
  const dot = finalSegment.lastIndexOf(".");
  if (dot <= 0 || dot === finalSegment.length - 1) return "bin";
  const ext = finalSegment.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "");
  return ext || "bin";
}

async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function copyAndVerify(
  admin: ReturnType<typeof createClient>,
  providerUserId: string,
  field: DocumentField,
  storedValue: unknown,
): Promise<CopyResult | null> {
  const sourcePath = sourcePathFromStoredValue(storedValue);
  if (!sourcePath) return null;

  const { data: source, error: downloadError } = await admin.storage
    .from(SOURCE_BUCKET)
    .download(sourcePath);
  if (downloadError || !source) throw new Error("source download failed");
  const sourceHash = await sha256Hex(source);

  const destinationPath = `${providerUserId}/legacy-migration/${field.prefix}-${crypto.randomUUID()}.${extensionFor(sourcePath)}`;
  const { error: uploadError } = await admin.storage
    .from(DESTINATION_BUCKET)
    .upload(destinationPath, source, {
      contentType: source.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) throw new Error("destination upload failed");

  const { data: verified, error: verifyError } = await admin.storage
    .from(DESTINATION_BUCKET)
    .download(destinationPath);
  if (verifyError || !verified || verified.size !== source.size || await sha256Hex(verified) !== sourceHash) {
    throw new Error("destination hash verification failed");
  }

  return { sourcePath, destinationPath };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authHeader = req.headers.get("authorization");
  if (!supabaseUrl || !serviceRoleKey || !anonKey || !authHeader) {
    return json({ error: "Unauthorized" }, 401);
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: adminRole, error: roleError } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .limit(1);
  if (roleError || !adminRole?.length) return json({ error: "Forbidden" }, 403);

  let body: { dry_run?: boolean; delete_sources?: boolean; limit?: number } = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is the safe dry-run/default mode.
  }
  const dryRun = body.dry_run !== false;
  const deleteSources = body.delete_sources === true;
  if (dryRun && deleteSources) return json({ error: "delete_sources requires dry_run=false" }, 400);
  const limit = Math.max(1, Math.min(Number(body.limit) || 1000, 1000));

  const { data: providers, error: providerError } = await admin
    .from("provider_profiles")
    .select("id,user_id,vendor_details")
    .not("vendor_details", "is", null)
    .limit(limit);
  if (providerError) return json({ error: "Provider scan failed" }, 500);

  const counts = {
    providers_scanned: providers?.length ?? 0,
    providers_with_documents: 0,
    objects_copied: 0,
    providers_updated: 0,
    source_objects_deleted: 0,
    failures: 0,
  };

  for (const provider of providers ?? []) {
    const details = provider.vendor_details && typeof provider.vendor_details === "object"
      ? provider.vendor_details as Record<string, unknown>
      : {};
    const copies: CopyResult[] = [];
    let failed = false;

    try {
      // Only legacy *_url values are source references. New *_path values point
      // at verification-documents and must never be re-read from provider-media.
      const legacyValues = DOCUMENT_FIELDS
        .map(field => ({ field, value: details[field.valueKey] }))
        .filter(item => item.value != null && item.value !== "");
      if (legacyValues.length === 0) continue;
      if (dryRun) {
        counts.providers_with_documents += 1;
        continue;
      }
      for (const { field, value } of legacyValues) {
        const copy = await copyAndVerify(admin, provider.user_id, field, value);
        if (copy) copies.push(copy);
      }

      if (copies.length === 0) continue;
      counts.providers_with_documents += 1;
      counts.objects_copied += copies.length;

      const nextDetails = { ...details };
      for (const field of DOCUMENT_FIELDS) {
        const storedValue = details[field.valueKey];
        const copied = copies.find(copy => copy.sourcePath === sourcePathFromStoredValue(storedValue));
        if (!copied) continue;
        delete nextDetails[field.valueKey];
        nextDetails[field.pathKey] = copied.destinationPath;
      }

      const { error: updateError } = await admin
        .from("provider_profiles")
        .update({ vendor_details: nextDetails })
        .eq("id", provider.id);
      if (updateError) throw new Error("provider metadata update failed");
      counts.providers_updated += 1;

      // Every destination was downloaded and size-verified before this point.
      if (deleteSources) {
        for (const copy of copies) {
          const { error: deleteError } = await admin.storage
            .from(SOURCE_BUCKET)
            .remove([copy.sourcePath]);
          if (deleteError) throw new Error("source deletion failed");
          counts.source_objects_deleted += 1;
        }
      }
    } catch {
      failed = true;
      counts.failures += 1;
    }

    // A failed provider is never reported with object-level details. A failed
    // copy is left in place for a later retry; source deletion is opt-in only.
    if (failed) continue;
  }

  return json({ ok: counts.failures === 0, dry_run: dryRun, counts });
});
