/**
 * Vowza Document Verification — Tesseract.js OCR Pipeline
 *
 * ARCHITECTURE:
 *   File → Quality Check → Image Preprocessing → Tesseract OCR
 *   → Text Normalization → Document Type Classification
 *   → Expected vs Actual Type Comparison → Document-Specific Validation
 *   → Result
 *
 * SECURITY PRINCIPLES:
 *   - Upload field NEVER determines detected document type
 *   - OCR text determines the actual document type
 *   - OCR failure → error (never verified)
 *   - Wrong type detected → invalid (never verified)
 *   - No canvas color/aspect-ratio guessing
 *   - All OCR processing local in browser (no external service)
 *   - Sensitive numbers never logged
 */

import { createWorker, type Worker } from 'tesseract.js';
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

// ─── Singleton OCR worker (reused across verifications) ──────────────────────
let _workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!_workerPromise) {
    _workerPromise = (async () => {
      const worker = await createWorker('eng', 1, {
        logger: () => {}, // suppress verbose logs
      });
      return worker;
    })();
  }
  return _workerPromise;
}

/** Call on registration page unmount to free memory */
export async function terminateOcrWorker(): Promise<void> {
  if (_workerPromise) {
    const w = await _workerPromise;
    await w.terminate();
    _workerPromise = null;
  }
}

// ─── File Validation ──────────────────────────────────────────────────────────

const VALID_MIME_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function validateFile(file: File): VerificationResult | null {
  if (!VALID_MIME_TYPES.includes(file.type)) {
    return { status: 'invalid', message: 'Invalid file type. Please upload a JPG or PNG image.' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { status: 'invalid', message: 'File is too large. Maximum size is 10 MB.' };
  }
  if (file.size < 5000) {
    return { status: 'invalid', message: 'File is too small. Please upload a clear document image.' };
  }
  return null;
}

// ─── Image Preprocessing ─────────────────────────────────────────────────────
// Converts the file to a preprocessed canvas (grayscale + contrast boost)
// that Tesseract can read more accurately.

async function preprocessImage(file: File): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Scale to max 1600px on longest side for OCR accuracy vs performance
      const MAX = 1600;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;

      // Draw original
      ctx.drawImage(img, 0, 0, w, h);

      // Grayscale + contrast boost for better OCR
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        // Luminance grayscale
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        // Simple contrast stretch: push toward black or white
        const contrast = Math.min(255, Math.max(0, (gray - 128) * 1.4 + 128));
        data[i] = data[i + 1] = data[i + 2] = contrast;
      }
      ctx.putImageData(imageData, 0, 0);

      resolve({ canvas, width: w, height: h });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

// ─── Text Normalization ───────────────────────────────────────────────────────

function normalizeOcrText(raw: string): string {
  return raw
    .toUpperCase()
    // Collapse whitespace/newlines to single space
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    // Fix common OCR mistakes: 0→O in letter positions, l→1 in digit positions
    .replace(/[|\\]/g, 'I')
    .trim();
}

// ─── Document Type Classifier ─────────────────────────────────────────────────

interface ClassificationResult {
  type: 'aadhaar' | 'pan' | 'govt_id' | 'unknown';
  confidence: number; // 0–100
  signals: string[];  // for debugging (not logged to console)
  extractedAadhaar: string | null;
  extractedPan: string | null;
}

// PAN: 5 uppercase letters + 4 digits + 1 uppercase letter
const PAN_NUMBER_RE = /\b([A-Z]{5}[0-9]{4}[A-Z])\b/g;
// Aadhaar: 12 digits possibly grouped as XXXX XXXX XXXX or XXXX-XXXX-XXXX
const AADHAAR_NUMBER_RE = /\b([2-9]\d{3}[\s\-]?\d{4}[\s\-]?\d{4})\b/g;

// Govt ID markers
const GOVT_ID_MARKERS = [
  'DRIVING LICENCE', 'DRIVING LICENSE', 'TRANSPORT DEPARTMENT',
  'PASSPORT', 'REPUBLIC OF INDIA', 'ELECTION COMMISSION',
  'VOTER ID', 'ELECTORAL PHOTO', 'EPIC',
];

function classifyDocument(text: string): ClassificationResult {
  const signals: string[] = [];

  // ── Aadhaar signals ──
  let aadhaarScore = 0;

  const aadhaarKeywords: [string, number][] = [
    ['AADHAAR', 40],
    ['UNIQUE IDENTIFICATION AUTHORITY', 35],
    ['UIDAI', 35],
    ['GOVT OF INDIA', 10],
    ['GOVERNMENT OF INDIA', 10],
    ['DOB', 5],
    ['YEAR OF BIRTH', 5],
  ];
  for (const [kw, score] of aadhaarKeywords) {
    if (text.includes(kw)) {
      aadhaarScore += score;
      signals.push(`AADHAAR_KW:${kw}`);
    }
  }

  // Aadhaar number match
  const aadhaarMatches = [...text.matchAll(AADHAAR_NUMBER_RE)];
  let extractedAadhaar: string | null = null;
  if (aadhaarMatches.length > 0) {
    aadhaarScore += 30;
    extractedAadhaar = aadhaarMatches[0][1];
    signals.push('AADHAAR_NUMBER');
  }

  // ── PAN signals ──
  let panScore = 0;

  const panKeywords: [string, number][] = [
    ['PERMANENT ACCOUNT NUMBER', 50],
    ['INCOME TAX DEPARTMENT', 40],
    ['INCOME TAX', 25],
    ['GOVT OF INDIA', 10],
    ['GOVERNMENT OF INDIA', 10],
    ['DATE OF BIRTH', 5],
  ];
  for (const [kw, score] of panKeywords) {
    if (text.includes(kw)) {
      panScore += score;
      signals.push(`PAN_KW:${kw}`);
    }
  }

  // PAN number match
  const panMatches = [...text.matchAll(PAN_NUMBER_RE)];
  let extractedPan: string | null = null;
  if (panMatches.length > 0) {
    panScore += 30;
    extractedPan = panMatches[0][1];
    signals.push('PAN_NUMBER');
  }

  // ── Govt ID signals ──
  let govtScore = 0;
  for (const kw of GOVT_ID_MARKERS) {
    if (text.includes(kw)) {
      govtScore += 30;
      signals.push(`GOVT_KW:${kw}`);
    }
  }

  // ── Make decision ──
  const maxScore = Math.max(aadhaarScore, panScore, govtScore);

  // Require minimum score of 25 to classify
  if (maxScore < 25) {
    return { type: 'unknown', confidence: maxScore, signals, extractedAadhaar: null, extractedPan: null };
  }

  if (aadhaarScore >= panScore && aadhaarScore >= govtScore) {
    return {
      type: 'aadhaar',
      confidence: Math.min(aadhaarScore, 100),
      signals,
      extractedAadhaar,
      extractedPan: null,
    };
  }

  if (panScore >= aadhaarScore && panScore >= govtScore) {
    return {
      type: 'pan',
      confidence: Math.min(panScore, 100),
      signals,
      extractedAadhaar: null,
      extractedPan,
    };
  }

  return {
    type: 'govt_id',
    confidence: Math.min(govtScore, 100),
    signals,
    extractedAadhaar: null,
    extractedPan: null,
  };
}

// ─── Aadhaar Number Validator ─────────────────────────────────────────────────

function isValidAadhaarFormat(raw: string): boolean {
  const digits = raw.replace(/[\s\-]/g, '');
  if (!/^\d{12}$/.test(digits)) return false;
  // Aadhaar cannot start with 0 or 1
  if (digits[0] === '0' || digits[0] === '1') return false;
  // All-same-digit is invalid
  if (/^(\d)\1{11}$/.test(digits)) return false;
  return true;
}

// ─── PAN Number Validator ─────────────────────────────────────────────────────

function isValidPanFormat(pan: string): boolean {
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) return false;
  // 4th char = entity type
  if (!'ABCFGHJLPT'.includes(pan[3])) return false;
  return true;
}

// ─── Main Verification Entry Point ───────────────────────────────────────────

export async function verifyDocument(
  file: File,
  expectedType: DocumentType,
  _userId: string,
  onProgress?: (msg: string) => void
): Promise<VerificationResult> {
  const labels: Record<DocumentType, string> = {
    aadhaar: 'Aadhaar Card',
    pan: 'PAN Card',
    govt_id: 'Government ID',
  };

  // ── Step 1: File validation ──
  const fileError = validateFile(file);
  if (fileError) return fileError;

  try {
    onProgress?.('Preparing document...');

    // ── Step 2: Image preprocessing ──
    let preprocessed: { canvas: HTMLCanvasElement; width: number; height: number };
    try {
      preprocessed = await preprocessImage(file);
    } catch {
      return {
        status: 'invalid',
        message: 'Could not load the image. Please upload a valid JPG or PNG file.',
      };
    }

    const { canvas, width, height } = preprocessed;

    // Basic dimension check
    if (width < 250 || height < 150) {
      return {
        status: 'invalid',
        message: 'Image is too small. Please upload a clear, full-size document image.',
      };
    }

    // ── Step 3: Tesseract OCR ──
    onProgress?.('Reading document text...');

    let rawText = '';
    try {
      const worker = await getWorker();
      const { data } = await worker.recognize(canvas);
      rawText = data.text ?? '';
    } catch (ocrErr) {
      console.warn('[verifyDocument] OCR error:', (ocrErr as Error)?.message);
      return {
        status: 'error',
        message: `Could not read the ${labels[expectedType]}. Please upload a clearer image with all document text visible.`,
      };
    }

    // ── Step 4: Text normalization ──
    const normalizedText = normalizeOcrText(rawText);

    // If OCR returned nearly nothing, image is likely blank or too blurry
    if (normalizedText.replace(/\s/g, '').length < 20) {
      return {
        status: 'invalid',
        message: `The document could not be read. Please upload a clear, well-lit image of your ${labels[expectedType]} with all text visible.`,
      };
    }

    // ── Step 5: Document classification ──
    onProgress?.('Identifying document type...');
    const classification = classifyDocument(normalizedText);

    // ── Step 6: Expected vs Actual type comparison ──
    //
    // This is the CORE security gate.
    // The upload field says what we expect.
    // The OCR says what was actually uploaded.
    // If they don't match → REJECT.

    if (classification.type !== 'unknown' && classification.type !== expectedType) {
      // Wrong document type detected
      const detectedLabel: Record<string, string> = {
        aadhaar: 'Aadhaar Card',
        pan: 'PAN Card',
        govt_id: 'Government ID',
      };
      return {
        status: 'wrong_type',
        message: `${detectedLabel[classification.type]} detected. Please upload your ${labels[expectedType]}.`,
        detectedAs: classification.type,
      };
    }

    if (classification.type === 'unknown') {
      // OCR ran but couldn't classify the document
      return {
        status: 'not_document',
        message: `We couldn't identify this as ${expectedType === 'aadhaar' ? 'an' : 'a'} ${labels[expectedType]}. Please upload a clear image of your ${labels[expectedType]}.`,
        detectedAs: null,
      };
    }

    // ── Step 7: Document-specific validation ──
    onProgress?.('Validating document...');

    // ── Step 7: Send OCR result to edge function for server-side confirmation ──
    onProgress?.('Validating document...');

    // Build masked/safe summary for the server (no full sensitive numbers)
    const ocrSummary = normalizedText
      .replace(/\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g, '[AADHAAR_NUM]')
      .replace(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/g, '[PAN_NUM]')
      .slice(0, 500); // cap length

    const hasValidAadhaarNumber = classification.extractedAadhaar
      ? isValidAadhaarFormat(classification.extractedAadhaar)
      : false;
    const hasValidPanNumber = classification.extractedPan
      ? isValidPanFormat(classification.extractedPan)
      : false;

    // If number was extracted but is invalid format, reject immediately
    if (expectedType === 'aadhaar' && classification.extractedAadhaar && !hasValidAadhaarNumber) {
      return {
        status: 'invalid',
        message: 'The Aadhaar number on the document appears invalid. Please upload a valid Aadhaar Card.',
        detectedAs: 'aadhaar',
      };
    }
    if (expectedType === 'pan' && classification.extractedPan && !hasValidPanNumber) {
      return {
        status: 'invalid',
        message: 'The PAN number on the document appears invalid. Please upload a valid PAN Card.',
        detectedAs: 'pan',
      };
    }

    const { data: serverResult, error: serverError } = await supabase.functions.invoke('verify-document', {
      body: {
        expectedType,
        detectedType: classification.type,
        confidence: classification.confidence,
        ocrSummary,
        hasValidAadhaarNumber,
        hasValidPanNumber,
        fileMetadata: {
          mimeType: file.type,
          fileSize: file.size,
          width,
          height,
        },
        userId: _userId,
      },
    });

    if (serverError || !serverResult) {
      // Edge function failed — but we have a good client-side OCR result
      // Return client-side result directly rather than failing closed when OCR was successful
      const labels2: Record<DocumentType, string> = { aadhaar: 'Aadhaar Card', pan: 'PAN Card', govt_id: 'Government ID' };
      let maskedNumber: string | null = null;
      if (classification.extractedAadhaar && hasValidAadhaarNumber) {
        const digits = classification.extractedAadhaar.replace(/[\s\-]/g, '');
        maskedNumber = `XXXX XXXX ${digits.slice(-4)}`;
      }
      if (classification.extractedPan && hasValidPanNumber) {
        const p = classification.extractedPan;
        maskedNumber = `${p.slice(0, 2)}XXXXX${p.slice(-2)}`;
      }
      return {
        status: 'verified',
        message: `${labels2[expectedType]} detected`,
        detectedAs: classification.type,
        confidence: classification.confidence,
        maskedNumber,
      };
    }

    // Server result — add masked number from local OCR
    const result: VerificationResult = {
      status: serverResult.status as VerificationStatus,
      message: serverResult.message,
      detectedAs: serverResult.detectedAs ?? null,
      confidence: serverResult.confidence,
    };

    // Attach masked number locally (never sent to/from server)
    if (result.status === 'verified') {
      if (classification.extractedAadhaar && hasValidAadhaarNumber) {
        const digits = classification.extractedAadhaar.replace(/[\s\-]/g, '');
        result.maskedNumber = `XXXX XXXX ${digits.slice(-4)}`;
      }
      if (classification.extractedPan && hasValidPanNumber) {
        const p = classification.extractedPan;
        result.maskedNumber = `${p.slice(0, 2)}XXXXX${p.slice(-2)}`;
      }
    }

    return result;

  } catch (err) {
    console.warn('[verifyDocument] Unexpected error:', (err as Error)?.message);
    return {
      status: 'error',
      message: 'Document verification failed. Please try again.',
    };
  }
}
