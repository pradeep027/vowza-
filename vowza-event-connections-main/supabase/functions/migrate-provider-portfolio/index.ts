// One-time §8 portfolio migration.
//
// This function is intentionally separate from identity-document migration:
// provider-portfolio is public, while verification-documents is private. It
// copies existing provider-media portfolio objects, verifies their SHA-256
// content hash, and rewrites existing URL references without deleting source
// objects. Source deletion is deliberately absent because provider-media may
// still contain legacy identity documents until the document migration is
// completed and independently verified.
//
// Deploy temporarily, run a dry pass, run the migration, verify count-only
// results, and remove the function. It must not remain deployed.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SOURCE_BUCKET = "provider-media";
const DESTINATION_BUCKET = "provider-portfolio";
const PUBLIC_MARKER = `/storage/v1/object/public/${SOURCE_BUCKET}/`;

type ProviderProfileRow = {
  id: string;
  gallery_urls: string[] | null;
  cover_image_url: string | null;
};

type PortfolioItemRow = {
  id: string;
  media_url: string;
};

type Reference = {
  sourcePath: string;
  destinationPath: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function sourcePathFromUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const markerIndex = url.pathname.indexOf(PUBLIC_MARKER);
    if (markerIndex === -1) return null;
    return decodeURIComponent(url.pathname.slice(markerIndex + PUBLIC_MARKER.length));
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
  providerId: string,
  sourcePath: string,
  cache: Map<string, Reference>,
): Promise<Reference> {
  const cached = cache.get(sourcePath);
  if (cached) return cached;

  const { data: source, error: sourceError } = await admin.storage
    .from(SOURCE_BUCKET)
    .download(sourcePath);
  if (sourceError || !source) throw new Error("source download failed");
  const sourceHash = await sha256Hex(source);

  const destinationPath = `${providerId}/legacy-portfolio/${crypto.randomUUID()}.${extensionFor(sourcePath)}`;
  const { error: uploadError } = await admin.storage
    .from(DESTINATION_BUCKET)
    .upload(destinationPath, source, {
      contentType: source.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) throw new Error("destination upload failed");

  const { data: destination, error: verifyError } = await admin.storage
    .from(DESTINATION_BUCKET)
    .download(destinationPath);
  if (verifyError || !destination || await sha256Hex(destination) !== sourceHash) {
    throw new Error("destination hash verification failed");
  }

  const reference = { sourcePath, destinationPath };
  cache.set(sourcePath, reference);
  return reference;
}

function publicUrl(admin: ReturnType<typeof createClient>, path: string): string {
  return admin.storage.from(DESTINATION_BUCKET).getPublicUrl(path).data.publicUrl;
}

async function migrateUrl(
  admin: ReturnType<typeof createClient>,
  providerId: string,
  value: string,
  cache: Map<string, Reference>,
  dryRun: boolean,
): Promise<{ value: string; found: boolean; copied: boolean }> {
  const sourcePath = sourcePathFromUrl(value);
  if (!sourcePath) return { value, found: false, copied: false };
  if (dryRun) return { value, found: true, copied: false };
  const reference = await copyAndVerify(admin, providerId, sourcePath, cache);
  return { value: publicUrl(admin, reference.destinationPath), found: true, copied: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authHeader = req.headers.get("authorization");
  if (!supabaseUrl || !serviceRoleKey || !anonKey || !authHeader) return json({ error: "Unauthorized" }, 401);

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

  let body: { dry_run?: boolean; limit?: number } = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is the safe dry-run default.
  }
  const dryRun = body.dry_run !== false;
  const limit = Math.max(1, Math.min(Number(body.limit) || 1000, 1000));
  const cache = new Map<string, Reference>();

  const counts = {
    provider_profiles_scanned: 0,
    gallery_references_scanned: 0,
    cover_references_scanned: 0,
    portfolio_items_scanned: 0,
    portfolio_references_scanned: 0,
    legacy_references_found: 0,
    objects_copied: 0,
    references_rewritten: 0,
    failures: 0,
  };

  const { data: profiles, error: profileError } = await admin
    .from("provider_profiles")
    .select("id,gallery_urls,cover_image_url")
    .limit(limit) as { data: ProviderProfileRow[] | null; error: unknown };
  if (profileError) return json({ error: "Provider profile scan failed" }, 500);

  for (const profile of profiles ?? []) {
    counts.provider_profiles_scanned += 1;
    const gallery = Array.isArray(profile.gallery_urls) ? profile.gallery_urls : [];
    counts.gallery_references_scanned += gallery.length;
    if (profile.cover_image_url) counts.cover_references_scanned += 1;

    try {
      const migratedGallery: string[] = [];
      let galleryChanged = false;
      for (const value of gallery) {
        const migrated = await migrateUrl(admin, profile.id, value, cache, dryRun);
        migratedGallery.push(migrated.value);
        galleryChanged ||= migrated.copied;
        if (migrated.found) counts.legacy_references_found += 1;
      }

      let migratedCover = profile.cover_image_url;
      let coverChanged = false;
      if (profile.cover_image_url) {
        const migrated = await migrateUrl(admin, profile.id, profile.cover_image_url, cache, dryRun);
        migratedCover = migrated.value;
        coverChanged = migrated.copied;
        if (migrated.found) counts.legacy_references_found += 1;
      }

      if (!dryRun && (galleryChanged || coverChanged)) {
        const { error: updateError } = await admin
          .from("provider_profiles")
          .update({
            ...(galleryChanged ? { gallery_urls: migratedGallery } : {}),
            ...(coverChanged ? { cover_image_url: migratedCover } : {}),
          })
          .eq("id", profile.id);
        if (updateError) throw new Error("provider profile update failed");
        counts.references_rewritten += Number(galleryChanged) + Number(coverChanged);
      }
    } catch {
      counts.failures += 1;
    }
  }

  const { data: items, error: itemError } = await admin
    .from("portfolio_items")
    .select("id,provider_id,media_url")
    .limit(limit);
  if (itemError) return json({ error: "Portfolio item scan failed" }, 500);

  for (const item of (items ?? []) as (PortfolioItemRow & { provider_id: string })[]) {
    counts.portfolio_items_scanned += 1;
    if (!item.media_url) continue;
    counts.portfolio_references_scanned += 1;
    try {
      const migrated = await migrateUrl(admin, item.provider_id, item.media_url, cache, dryRun);
      if (!migrated.found) continue;
      counts.legacy_references_found += 1;
      if (!migrated.copied) continue;
      if (!dryRun) {
        const { error: updateError } = await admin
          .from("portfolio_items")
          .update({ media_url: migrated.value })
          .eq("id", item.id);
        if (updateError) throw new Error("portfolio item update failed");
        counts.references_rewritten += 1;
      }
    } catch {
      counts.failures += 1;
    }
  }

  counts.objects_copied = cache.size;
  return json({ ok: counts.failures === 0, dry_run: dryRun, counts });
});
