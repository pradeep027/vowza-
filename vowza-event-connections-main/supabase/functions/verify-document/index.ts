// ─── Supabase Edge Function: verify-document ─────────────────────────────────
//
// Without server-side OCR, classification is based on:
//   1. Image quality/size
//   2. Client-side visual signals (color, aspect ratio, texture)
//   3. "Obviously a photo" rejection (high-saturation, no paper background)
//
// Decision model (two-gate):
//   Gate A — REJECT if image is obviously not a document (photo, screenshot, etc.)
//   Gate B — ACCEPT if image could reasonably be the expected document type
//             (document-like shape + not obviously the wrong type)
//
// The system errs toward acceptance for genuine documents and errs toward
// rejection for obviously non-document images.
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

interface ColorAnalysis {
  dominantColors: string[];
  hasBlueHeader: boolean;
  hasOrangeAccent: boolean;
  hasGovtEmblem: boolean;
  whitePaperRatio: number;       // 0–1 fraction of image that is near-white
  highSaturationRatio: number;   // 0–1 fraction of image with high color saturation
}

interface ClassificationSignals {
  detectedType: string;          // 'aadhaar' | 'pan' | 'document' | 'non_document' | 'unknown'
  confidence: number;            // 0–100
  looksLikePhoto: boolean;       // true when image is clearly a photograph
  looksLikeDocument: boolean;    // true when image has document characteristics
}

interface Input {
  expectedType: 'aadhaar' | 'pan' | 'govt_id';
  detectedType: string;
  confidence: number;
  extractedText: string;
  fileMetadata: { mimeType: string; fileSize: number; width: number; height: number };
  colorAnalysis: ColorAnalysis;
  signals?: ClassificationSignals;
  userId: string;
}

const PAN_RE = /\b([A-Z]{5}\d{4}[A-Z])\b/;
const AADHAAR_RE = /\b(\d{4}[\s-]?\d{4}[\s-]?\d{4})\b/;

function isValidPanFormat(pan: string): boolean {
  if (!PAN_RE.test(pan)) return false;
  return 'ABCFGHJLPT'.includes(pan[3]);
}

function isValidAadhaarFormat(raw: string): boolean {
  const digits = raw.replace(/[\s-]/g, '');
  if (digits.length !== 12 || !/^\d{12}$/.test(digits)) return false;
  if (digits[0] === '0' || digits[0] === '1') return false;
  if (/^(\d)\1{11}$/.test(digits)) return false;
  return true;
}

function extractNumbers(text: string) {
  return {
    aadhaar: text.match(AADHAAR_RE)?.[1] ?? null,
    pan: text.match(PAN_RE)?.[1] ?? null,
  };
}

function makeDecision(input: Input): Record<string, unknown> {
  const { expectedType, detectedType, confidence, extractedText, fileMetadata, colorAnalysis, signals } = input;
  const ar = fileMetadata.width / fileMetadata.height;

  // ── Gate 0: File type / size ──────────────────────────────────────────────
  if (!['image/jpeg', 'image/png', 'image/jpg'].includes(fileMetadata.mimeType)) {
    return { status: 'invalid', message: 'Invalid file type. Please upload a JPG or PNG image.', detectedAs: null };
  }
  if (fileMetadata.fileSize > 10 * 1024 * 1024) {
    return { status: 'invalid', message: 'File too large. Maximum 10 MB.', detectedAs: null };
  }
  if (fileMetadata.width < 250 || fileMetadata.height < 150) {
    return { status: 'invalid', message: 'Image is too small. Please upload a clear, full-size document photo.', detectedAs: null };
  }

  // ── Gate 1: Obvious photograph / non-document ─────────────────────────────
  //
  // Reject ONLY when multiple strong indicators all say "this is a photo":
  //   • looksLikePhoto flag AND confidence ≥ 65 (client is sure it's a photo)
  //   • OR very high saturation ratio with very low white-paper ratio
  //   • AND NOT looksLikeDocument
  //
  // We require multiple corroborating signals to avoid false rejections.
  const clientSaysPhoto = signals?.looksLikePhoto === true && (signals?.confidence ?? 0) >= 65;
  const colorSaysPhoto  = colorAnalysis.highSaturationRatio > 0.55 && colorAnalysis.whitePaperRatio < 0.10;
  const clientSaysDoc   = signals?.looksLikeDocument === true;

  if ((clientSaysPhoto || colorSaysPhoto) && !clientSaysDoc) {
    const fieldLabel: Record<string, string> = {
      aadhaar: 'an Aadhaar Card',
      pan: 'a PAN Card',
      govt_id: 'a Government ID',
    };
    return {
      status: 'not_document',
      message: `The uploaded image does not appear to be ${fieldLabel[expectedType]}. Please upload a clear identity document photo or scan.`,
      detectedAs: 'non_document',
    };
  }

  // ── Gate 2: Wrong document type (strong cross-type signal) ───────────────
  //
  // Only flag mismatch when:
  //   • Client confidently classified a DIFFERENT type (confidence ≥ 55)
  //   • AND the image clearly looks like that other type
  const OTHER_TYPE_CONFIDENCE = 55;

  if (expectedType === 'aadhaar' && detectedType === 'pan' && confidence >= OTHER_TYPE_CONFIDENCE) {
    return { status: 'wrong_type', message: 'This appears to be a PAN Card. Please upload your Aadhaar Card.', detectedAs: 'pan' };
  }
  if (expectedType === 'pan' && detectedType === 'aadhaar' && confidence >= OTHER_TYPE_CONFIDENCE) {
    return { status: 'wrong_type', message: 'This appears to be an Aadhaar Card. Please upload your PAN Card.', detectedAs: 'aadhaar' };
  }

  // ── Extract numbers from any text the client may have sent ────────────────
  const nums = extractNumbers(extractedText);

  // ── Gate 3: Validate extracted numbers if present ─────────────────────────
  if (expectedType === 'aadhaar' && nums.aadhaar && !isValidAadhaarFormat(nums.aadhaar)) {
    return { status: 'invalid', message: 'The Aadhaar number on the document appears invalid. Please upload a valid Aadhaar Card.', detectedAs: 'aadhaar' };
  }
  if (expectedType === 'pan' && nums.pan && !isValidPanFormat(nums.pan)) {
    return { status: 'invalid', message: 'The PAN number on the document appears invalid. Please upload a valid PAN Card.', detectedAs: 'pan' };
  }

  // ── Gate 4: Document acceptability ───────────────────────────────────────
  //
  // An image is acceptable as a document when it passes Gates 0–3 above
  // AND at least one of the following is true:
  //   a) Client classified it as the expected document type (any confidence)
  //   b) Client classified it as generic 'document'
  //   c) Image has document-like aspect ratio
  //   d) Image has significant white/paper background
  //   e) Client's looksLikeDocument is true
  //
  // We use an OR gate — any single positive indicator is enough,
  // because real document photos from phones vary widely.

  const isExpectedType  = detectedType === expectedType;
  const isGenericDoc    = detectedType === 'document';
  const isDocAR         = (ar > 1.25 && ar < 1.90) || (ar > 0.50 && ar < 0.85);
  const hasPaperBg      = colorAnalysis.whitePaperRatio > 0.20;
  const clientSaysDocOk = signals?.looksLikeDocument === true;

  const isAcceptable = isExpectedType || isGenericDoc || isDocAR || hasPaperBg || clientSaysDocOk;

  if (!isAcceptable) {
    const labels: Record<string, string> = { aadhaar: 'Aadhaar Card', pan: 'PAN Card', govt_id: 'Government ID' };
    return {
      status: 'not_document',
      message: `The uploaded image was not recognized as a ${labels[expectedType]}. Please upload a clear photo or scan of your document.`,
      detectedAs: null,
    };
  }

  // ── Accept ────────────────────────────────────────────────────────────────
  const labels: Record<string, string> = { aadhaar: 'Aadhaar Card', pan: 'PAN Card', govt_id: 'Government ID' };

  let maskedNumber: string | null = null;
  if (expectedType === 'aadhaar' && nums.aadhaar) {
    const d = nums.aadhaar.replace(/[\s-]/g, '');
    maskedNumber = `XXXX XXXX ${d.slice(-4)}`;
  }
  if (expectedType === 'pan' && nums.pan) {
    maskedNumber = `${nums.pan.slice(0, 2)}XXXXX${nums.pan.slice(-2)}`;
  }

  return {
    status: 'verified',
    message: `${labels[expectedType]} detected`,
    detectedAs: expectedType,
    confidence,
    maskedNumber,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  try {
    const input: Input = await req.json();
    const result = makeDecision(input);

    // Log only non-sensitive outcome info
    console.log('[verify-document]', {
      expected: input.expectedType,
      detected: input.detectedType,
      looksLikePhoto: input.signals?.looksLikePhoto,
      looksLikeDocument: input.signals?.looksLikeDocument,
      whitePaperRatio: input.colorAnalysis?.whitePaperRatio?.toFixed(2),
      highSatRatio: input.colorAnalysis?.highSaturationRatio?.toFixed(2),
      status: result['status'],
    });

    return json(result, 200);
  } catch (err) {
    console.error('[verify-document] Error:', (err as Error)?.message);
    return json({ status: 'error', message: 'Document verification failed. Please try again.' }, 500);
  }
});
