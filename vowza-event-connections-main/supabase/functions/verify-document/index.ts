// ─── Supabase Edge Function: verify-document ─────────────────────────────────
//
// Receives the OCR-based classification result from the client and performs
// server-side SANITY validation of that report.
//
// ⚠️  TRUST MODEL / KYC LIMITATION (read before relying on this result) ⚠️
// ----------------------------------------------------------------------------
// This function NEVER receives the uploaded document bytes. The browser runs
// Tesseract OCR locally and posts only a CLASSIFICATION SUMMARY (expectedType,
// detectedType, confidence, masked numbers, file metadata). The server there-
// fore CANNOT independently confirm a genuine document was uploaded — a
// determined client could fabricate the summary it posts here.
//
// Consequently the returned `status` is ADVISORY ONLY (a UX classification that
// guides the registration wizard) and is explicitly NOT an authorization or
// trust boundary. Real provider trust is enforced DOWNSTREAM and server-side:
//   * admin review/approval of the provider, and
//   * the Phase F BEFORE UPDATE trigger that blocks a provider from
//     self-verifying / self-approving their own profile.
// A fabricated "verified" here only advances the client wizard; it grants no
// elevated capability. Strong KYC (server-side document authenticity) is NOT
// achievable with the current client-OCR architecture and would require the
// raw document to be processed by a trusted server / KYC provider.
//
// WHAT THIS FUNCTION DOES ENFORCE server-side:
//   1. The caller is an AUTHENTICATED user (JWT verified via GoTrue getUser();
//      the anon key alone is rejected). An unauthenticated result is impossible.
//   2. The body userId (if supplied) must match the authenticated user — a
//      caller cannot attribute a verification to someone else.
//   3. File-metadata sanity + expected-vs-detected type matching (advisory).
//
// Deploy: supabase functions deploy verify-document --project-ref vavfeataqwwbpjonknne

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  Deno.env.get("SUPABASE_URL") || "",
  "https://vavfeataqwwbpjonknne.supabase.co",
  "http://localhost:5173",
  "http://localhost:8080",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

interface Input {
  expectedType: 'aadhaar' | 'pan' | 'govt_id';
  /** Actual document type determined by client-side Tesseract OCR */
  detectedType: 'aadhaar' | 'pan' | 'govt_id' | 'unknown';
  /** OCR confidence score 0–100 */
  confidence: number;
  /** Normalized OCR text — no full sensitive numbers */
  ocrSummary: string;
  /** Whether a valid-format Aadhaar number was found */
  hasValidAadhaarNumber: boolean;
  /** Whether a valid-format PAN number was found */
  hasValidPanNumber: boolean;
  fileMetadata: {
    mimeType: string;
    fileSize: number;
    width: number;
    height: number;
  };
  /** Optional: cross-checked against the authenticated user; never trusted as identity. */
  userId?: string;
}

function decide(input: Input): Record<string, unknown> {
  const { expectedType, detectedType, confidence, fileMetadata } = input;

  const labels: Record<string, string> = {
    aadhaar: 'Aadhaar Card',
    pan: 'PAN Card',
    govt_id: 'Government ID',
  };

  // ── File sanity ──────────────────────────────────────────────────────────
  if (!['image/jpeg', 'image/png', 'image/jpg'].includes(fileMetadata.mimeType)) {
    return { status: 'invalid', message: 'Invalid file type. Please upload a JPG or PNG image.', detectedAs: null };
  }
  if (fileMetadata.fileSize > 10 * 1024 * 1024) {
    return { status: 'invalid', message: 'File too large. Maximum 10 MB.', detectedAs: null };
  }

  // ── OCR couldn't classify ─────────────────────────────────────────────────
  if (detectedType === 'unknown') {
    return {
      status: 'not_document',
      message: `We couldn't identify this as ${expectedType === 'aadhaar' ? 'an' : 'a'} ${labels[expectedType]}. Please upload a clear image of your ${labels[expectedType]}.`,
      detectedAs: null,
    };
  }

  // ── TYPE MISMATCH — core security gate ───────────────────────────────────
  if (detectedType !== expectedType) {
    return {
      status: 'wrong_type',
      message: `${labels[detectedType]} detected. Please upload your ${labels[expectedType]}.`,
      detectedAs: detectedType,
      expectedType,
    };
  }

  // ── Types match — document-specific validation (advisory) ─────────────────
  if (expectedType === 'aadhaar') {
    return { status: 'verified', message: 'Aadhaar Card detected', detectedAs: 'aadhaar', confidence };
  }
  if (expectedType === 'pan') {
    return { status: 'verified', message: 'PAN Card detected', detectedAs: 'pan', confidence };
  }
  if (expectedType === 'govt_id') {
    return { status: 'verified', message: 'Government ID detected', detectedAs: 'govt_id', confidence };
  }

  return { status: 'invalid', message: 'Unknown document type.', detectedAs: null };
}
serve(async (req) => {
  const cors = getCorsHeaders(req);
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ status: 'error', message: 'Method not allowed.' }, 405);

  // ── AUTH GATE ──────────────────────────────────────────────────────────────
  // The caller must be an authenticated USER, not merely a holder of the anon
  // key. (config.toml verify_jwt only proves a valid project JWT — the anon key
  // satisfies that — so we must prove a real end-user session via GoTrue here.)
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ status: 'error', message: 'Authentication required.' }, 401);
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !anonKey) {
    return json({ status: 'error', message: 'Server not configured.' }, 500);
  }
  // Anon-scoped client with the caller's own JWT forwarded — identity cannot be
  // spoofed: getUser() validates the token against GoTrue.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await callerClient.auth.getUser();
  if (authErr || !user) {
    return json({ status: 'error', message: 'Authentication required.' }, 401);
  }

  try {
    const input: Input = await req.json();

    // Identity cannot be spoofed via the body: a supplied userId must be the
    // authenticated caller. (The result is attributed to user.id regardless.)
    if (input.userId && input.userId !== user.id) {
      return json({ status: 'error', message: 'User mismatch.' }, 403);
    }

    const result = decide(input);

    // Log only non-sensitive outcome, attributed to the verified user.
    console.log('[verify-document]', {
      user: user.id,
      expected: input.expectedType,
      detected: input.detectedType,
      confidence: input.confidence,
      status: result['status'],
    });

    // Stamp every response `advisory: true`: this status is a UX classification,
    // never an authorization/trust decision (see the trust-model note above).
    return json({ ...result, advisory: true }, 200);
  } catch (err) {
    console.error('[verify-document] Error:', (err as Error)?.message);
    return json({ status: 'error', message: 'Document verification failed. Please try again.' }, 500);
  }
});
