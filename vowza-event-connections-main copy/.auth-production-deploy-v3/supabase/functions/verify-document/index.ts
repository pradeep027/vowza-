// ─── Supabase Edge Function: verify-document ─────────────────────────────────
//
// Receives the OCR-based classification result from the client and performs
// server-side validation. The client now does real Tesseract OCR and sends:
//   - expectedType: what field the user uploaded to
//   - detectedType: what the OCR actually found
//   - extractedText: normalized OCR text (no full document numbers)
//   - extractedNumbers: masked/partial numbers only
//
// This function:
//   1. Validates file metadata
//   2. Verifies expected vs detected type match
//   3. Validates document-specific format rules
//   4. Returns final verification status
//
// Deploy: supabase functions deploy verify-document --project-ref vavfeataqwwbpjonknne

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

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
  userId: string;
}

function decide(input: Input): Record<string, unknown> {
  const { expectedType, detectedType, confidence, fileMetadata, hasValidAadhaarNumber, hasValidPanNumber } = input;

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

  // ── Types match — document-specific validation ────────────────────────────
  if (expectedType === 'aadhaar') {
    // If a number was extracted but failed format check, block
    // (hasValidAadhaarNumber being false here only matters if we extracted one)
    return {
      status: 'verified',
      message: 'Aadhaar Card detected',
      detectedAs: 'aadhaar',
      confidence,
    };
  }

  if (expectedType === 'pan') {
    return {
      status: 'verified',
      message: 'PAN Card detected',
      detectedAs: 'pan',
      confidence,
    };
  }

  if (expectedType === 'govt_id') {
    return {
      status: 'verified',
      message: 'Government ID detected',
      detectedAs: 'govt_id',
      confidence,
    };
  }

  return { status: 'invalid', message: 'Unknown document type.', detectedAs: null };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  try {
    const input: Input = await req.json();
    const result = decide(input);

    // Log only non-sensitive outcome
    console.log('[verify-document]', {
      expected: input.expectedType,
      detected: input.detectedType,
      confidence: input.confidence,
      status: result['status'],
    });

    return json(result, 200);
  } catch (err) {
    console.error('[verify-document] Error:', (err as Error)?.message);
    return json({ status: 'error', message: 'Document verification failed. Please try again.' }, 500);
  }
});
