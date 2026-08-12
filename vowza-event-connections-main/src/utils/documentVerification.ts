/**
 * Vowza Document Verification — Client-side Analysis
 *
 * SECURITY PRINCIPLE:
 *   "Uploaded" ≠ "Verified"
 *   "Image exists" ≠ "Valid document"
 *   "Document-shaped" ≠ "Aadhaar/PAN"
 *   "12 digits" ≠ "Genuine Aadhaar"
 *
 * When verification cannot be completed the result is ALWAYS an error/invalid,
 * never a false "verified". Fail closed.
 *
 * Flow: File → Image Load → Canvas Analysis → Edge Function → Result
 * Fallback (edge function unavailable) → ERROR (not verified)
 */

import { supabase } from '@/integrations/supabase/client';

export type DocumentType = 'aadhaar' | 'pan' | 'govt_id';
export type VerificationStatus =
  | 'idle'
  | 'processing'
  | 'verified'
  | 'invalid'
  | 'wrong_type'
  | 'not_document'
  | 'error';

export interface VerificationResult {
  status: VerificationStatus;
  message: string;
  detectedAs?: string | null;
  maskedNumber?: string | null;
  confidence?: number;
}

interface ColorAnalysis {
  dominantColors: string[];
  hasBlueHeader: boolean;
  hasOrangeAccent: boolean;
  hasGovtEmblem: boolean;
  /** Fraction 0–1: how much of the image is near-white (paper/card background) */
  whitePaperRatio: number;
  /** Fraction 0–1: how much of the image is saturated / photo-like */
  highSaturationRatio: number;
}

// ─── File Validation ──────────────────────────────────────────────────────────

const VALID_MIME_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MIN_WIDTH = 300;
const MIN_HEIGHT = 200;

export function validateFile(file: File): VerificationResult | null {
  if (!VALID_MIME_TYPES.includes(file.type)) {
    return { status: 'invalid', message: 'Invalid file type. Please upload a JPG or PNG image.' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { status: 'invalid', message: 'File is too large. Maximum size is 10 MB.' };
  }
  if (file.size < 8000) {
    return { status: 'invalid', message: 'File is too small. Please upload a clear document image.' };
  }
  return null;
}

// ─── Image Loading ────────────────────────────────────────────────────────────

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

// ─── Canvas Color & Texture Analysis ─────────────────────────────────────────
//
// IMPORTANT: This analysis informs the edge function but is NOT used to
// directly pass documents. The edge function makes the final accept/reject
// decision. The fallback NEVER returns 'verified'.

function analyzeColors(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
): ColorAnalysis {
  const w = canvas.width;
  const h = canvas.height;

  // Top 25% strip — document headers tend to have blue here
  const topData = ctx.getImageData(0, 0, w, Math.floor(h * 0.25)).data;
  // Full image — for overall color stats
  const fullData = ctx.getImageData(0, 0, w, h).data;

  // ── Top-strip counters ──
  let blueHeaderCount = 0;
  let topTotal = 0;

  for (let i = 0; i < topData.length; i += 16) {
    const r = topData[i], g = topData[i + 1], b = topData[i + 2];
    topTotal++;
    // Strong blue: b dominates clearly, not grey/white
    if (b > 120 && b > r + 40 && b > g + 20) blueHeaderCount++;
  }

  // ── Full-image counters ──
  let orangeCount = 0;
  let whitePaperCount = 0;
  let highSatCount = 0;
  let fullTotal = 0;

  for (let i = 0; i < fullData.length; i += 16) {
    const r = fullData[i], g = fullData[i + 1], b = fullData[i + 2];
    fullTotal++;

    // Orange/saffron: clear orange hue, not just warm-toned
    // Strict: red dominant, green mid, blue low
    if (r > 200 && g > 100 && g < 165 && b < 70 && r - b > 140) orangeCount++;

    // White/light grey paper (document background) — all channels high and similar
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    if (maxC > 210 && maxC - minC < 35) whitePaperCount++;

    // High saturation (photos, decorations, flowers, wedding) — wide spread between channels
    if (maxC - minC > 80 && maxC > 100) highSatCount++;
  }

  const blueRatio = topTotal > 0 ? blueHeaderCount / topTotal : 0;
  const orangeRatio = fullTotal > 0 ? orangeCount / fullTotal : 0;
  const whitePaperRatio = fullTotal > 0 ? whitePaperCount / fullTotal : 0;
  const highSaturationRatio = fullTotal > 0 ? highSatCount / fullTotal : 0;

  return {
    dominantColors: [],
    // Require a meaningful portion of the header to be strongly blue
    hasBlueHeader: blueRatio > 0.25,
    // Require a meaningful orange stripe — real Aadhaar has a clear saffron band
    // Threshold raised from 0.02 (too low) to 0.08
    hasOrangeAccent: orangeRatio > 0.08,
    hasGovtEmblem: false,
    whitePaperRatio,
    highSaturationRatio,
  };
}

// ─── Client-side Classification Signals ──────────────────────────────────────
//
// These signals are ADVISORY. They help the edge function but are NOT used to
// independently approve a document. The client never decides "verified".

interface ClassificationSignals {
  detectedType: string;
  confidence: number;
  /** True if the image looks like a photograph (high saturation, not a card) */
  looksLikePhoto: boolean;
  /** True if the image has a substantial white/paper background (typical of documents) */
  looksLikeDocument: boolean;
}

function buildClassificationSignals(
  img: HTMLImageElement,
  colorAnalysis: ColorAnalysis
): ClassificationSignals {
  const ar = img.width / img.height;

  // Document-like aspect ratios:
  //   Credit-card: ~1.586
  //   A4 portrait: ~0.707
  //   A4 landscape: ~1.414
  const isCardAR = ar > 1.35 && ar < 1.75;
  const isPortraitDocAR = ar > 0.55 && ar < 0.85;
  const isDocumentAR = isCardAR || isPortraitDocAR;

  // A photo typically has high saturation AND low white-paper ratio
  const looksLikePhoto =
    colorAnalysis.highSaturationRatio > 0.35 && colorAnalysis.whitePaperRatio < 0.20;

  // A document typically has a substantial white/off-white area
  const looksLikeDocument =
    colorAnalysis.whitePaperRatio > 0.30 && colorAnalysis.highSaturationRatio < 0.50;

  // If it looks like a photo, return non_document with high confidence
  if (looksLikePhoto) {
    return { detectedType: 'non_document', confidence: 70, looksLikePhoto, looksLikeDocument };
  }

  // Only attempt type-specific detection if it actually looks like a document
  if (isDocumentAR && looksLikeDocument) {
    if (colorAnalysis.hasOrangeAccent) {
      return { detectedType: 'aadhaar', confidence: 50, looksLikePhoto, looksLikeDocument };
    }
    if (colorAnalysis.hasBlueHeader) {
      return { detectedType: 'pan', confidence: 45, looksLikePhoto, looksLikeDocument };
    }
    // Document-shaped but unclassified — needs OCR/server to decide
    return { detectedType: 'document', confidence: 25, looksLikePhoto, looksLikeDocument };
  }

  // No strong signals → unknown
  return { detectedType: 'unknown', confidence: 5, looksLikePhoto, looksLikeDocument };
}

// ─── Main Verification Entry Point ───────────────────────────────────────────

export async function verifyDocument(
  file: File,
  expectedType: DocumentType,
  userId: string
): Promise<VerificationResult> {
  // 1. File-level validation
  const fileError = validateFile(file);
  if (fileError) return fileError;

  try {
    // 2. Load image
    const img = await loadImage(file);

    if (img.width < MIN_WIDTH || img.height < MIN_HEIGHT) {
      URL.revokeObjectURL(img.src);
      return {
        status: 'invalid',
        message: 'Image is too small. Please upload a clear, full-size document image.',
      };
    }

    // 3. Canvas analysis (downscaled for performance)
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 800 / Math.max(img.width, img.height));
    canvas.width = Math.floor(img.width * scale);
    canvas.height = Math.floor(img.height * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(img.src);

    const colorAnalysis = analyzeColors(canvas, ctx);
    const signals = buildClassificationSignals(img, colorAnalysis);

    // 4. Early client-side rejection for obvious non-documents (photos, etc.)
    //    This is a definite-no path only — it never issues a definite-yes.
    if (signals.looksLikePhoto && signals.confidence >= 60) {
      const labels: Record<DocumentType, string> = {
        aadhaar: 'an Aadhaar Card',
        pan: 'a PAN Card',
        govt_id: 'a Government ID',
      };
      return {
        status: 'not_document',
        message: `The uploaded image does not appear to be ${labels[expectedType]}. Please upload a valid identity document.`,
        detectedAs: 'non_document',
      };
    }

    // 5. Call edge function — this makes the FINAL decision
    const { data, error } = await supabase.functions.invoke('verify-document', {
      body: {
        expectedType,
        detectedType: signals.detectedType,
        confidence: signals.confidence,
        extractedText: '', // client-side OCR not available; server uses pattern matching
        fileMetadata: {
          mimeType: file.type,
          fileSize: file.size,
          width: img.width,
          height: img.height,
        },
        colorAnalysis,
        signals,
        userId,
      },
    });

    if (error) {
      // FAIL CLOSED: edge function unavailable → error, NOT verified
      console.warn('[verifyDocument] Edge function unavailable:', error.message);
      return {
        status: 'error',
        message: 'Document verification is temporarily unavailable. Please try again in a moment.',
      };
    }

    // Map edge function response
    const result: VerificationResult = {
      status: data.status as VerificationStatus,
      message: data.message,
      detectedAs: data.detectedAs ?? null,
      maskedNumber: data.maskedNumber ?? null,
      confidence: data.confidence,
    };

    return result;

  } catch (err) {
    // FAIL CLOSED: unexpected error → error status
    console.error('[verifyDocument] Unexpected error:', (err as Error)?.message);
    return {
      status: 'error',
      message: 'Document verification failed. Please try again.',
    };
  }
}
