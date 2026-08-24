/**
 * DocumentUploadCard — Multi-state document upload with verification
 *
 * States (in order):
 *   idle → processing → verified | invalid | wrong_type | not_document | error
 *
 * SECURITY:
 *   - Never marks 'verified' from file presence alone
 *   - Replacing a verified document immediately resets to 'processing' then re-runs verification
 *   - Stale verified state cannot persist across a document change
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, CheckCircle, XCircle, Loader2, RefreshCw, FileText, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  verifyDocument,
  validateFile,
  type DocumentType,
  type VerificationStatus,
  type VerificationResult,
} from '@/utils/documentVerification';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  label: string;
  documentType: DocumentType;
  required?: boolean;
  onVerified: (file: File, result: VerificationResult) => void;
  onCleared: () => void;
  /** Controlled props — driven by parent state */
  currentStatus: VerificationStatus;
  currentMessage: string;
  currentPreview: string;
}

export default function DocumentUploadCard({
  label,
  documentType,
  required = false,
  onVerified,
  onCleared,
  currentStatus,
  currentMessage,
  currentPreview,
}: Props) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  // Local display state — mirrors parent but can lead while async op is in flight
  const [localStatus, setLocalStatus] = useState<VerificationStatus>(currentStatus);
  const [localMessage, setLocalMessage] = useState(currentMessage);
  const [localPreview, setLocalPreview] = useState(currentPreview);
  const [maskedNumber, setMaskedNumber] = useState<string | null>(null);

  // Sync from parent when parent resets (e.g. clear)
  useEffect(() => {
    setLocalStatus(currentStatus);
    setLocalMessage(currentMessage);
    setLocalPreview(currentPreview);
    if (currentStatus === 'idle') setMaskedNumber(null);
  }, [currentStatus, currentMessage, currentPreview]);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reset input so the same file can be re-selected after a replace
      if (inputRef.current) inputRef.current.value = '';

      // ── Quick file validation (client-side, synchronous) ──
      const fileError = validateFile(file);
      if (fileError) {
        setLocalStatus(fileError.status);
        setLocalMessage(fileError.message);
        setLocalPreview('');
        setMaskedNumber(null);
        onVerified(file, fileError);
        return;
      }

      // ── Show preview immediately + enter processing state ──
      // Critically: ANY previous verified state is wiped the moment a new file is chosen.
      const previewUrl = URL.createObjectURL(file);
      setLocalPreview(previewUrl);
      setLocalStatus('processing');
      setLocalMessage(`Checking ${label}...`);
      setMaskedNumber(null);

      // Notify parent of the in-progress state right away
      onVerified(file, { status: 'processing', message: `Checking ${label}...` });

      // ── Run verification with live progress messages ──
      const result = await verifyDocument(
        file,
        documentType,
        user?.id || 'anonymous',
        (msg) => setLocalMessage(msg)  // update status text during OCR
      );

      setLocalStatus(result.status);
      setLocalMessage(result.message);
      setMaskedNumber(result.maskedNumber ?? null);

      // Notify parent of final result
      onVerified(file, result);
    },
    [documentType, label, user?.id, onVerified]
  );

  const handleReplace = () => {
    // Reset immediately — old verified state is gone
    setLocalStatus('idle');
    setLocalMessage('');
    setLocalPreview('');
    setMaskedNumber(null);
    onCleared();
    setTimeout(() => inputRef.current?.click(), 80);
  };

  const handleClear = () => {
    setLocalStatus('idle');
    setLocalMessage('');
    setLocalPreview('');
    setMaskedNumber(null);
    onCleared();
  };

  // ─── Status-based border/bg ───────────────────────────────────────────────
  const wrapperClass = cn(
    'rounded-2xl border-2 p-4 transition-all duration-300',
    {
      'border-dashed border-border/80': localStatus === 'idle',
      'border-blue-300 bg-blue-50/30': localStatus === 'processing',
      'border-emerald-400 bg-emerald-50/20': localStatus === 'verified',
      'border-red-300 bg-red-50/20':
        localStatus === 'invalid' || localStatus === 'not_document' || localStatus === 'error',
      'border-orange-300 bg-orange-50/20': localStatus === 'wrong_type',
    }
  );

  return (
    <div className={wrapperClass}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-foreground">
          {label}{' '}
          {required ? (
            <span className="text-red-500">*</span>
          ) : (
            <span className="text-muted-foreground text-xs ml-1">(Optional)</span>
          )}
        </span>
        {localStatus === 'verified' && (
          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
            <CheckCircle className="w-3 h-3" /> Verified
          </span>
        )}
      </div>

      {/* ── IDLE ── */}
      {localStatus === 'idle' && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full h-28 rounded-xl border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-2 hover:border-maroon/40 hover:bg-maroon/5 transition-all cursor-pointer group"
        >
          <Upload className="w-6 h-6 text-muted-foreground group-hover:text-maroon transition-colors" />
          <span className="text-xs text-muted-foreground group-hover:text-maroon transition-colors">
            Upload {label}
          </span>
          <span className="text-[10px] text-muted-foreground/60">JPG or PNG</span>
        </button>
      )}

      {/* ── PROCESSING ── */}
      {localStatus === 'processing' && (
        <div className="relative w-full h-28 rounded-xl border border-blue-200 overflow-hidden bg-blue-50/50 flex flex-col items-center justify-center gap-2">
          {localPreview && (
            <img
              src={localPreview}
              alt="Document preview"
              className="absolute inset-0 w-full h-full object-cover opacity-20"
            />
          )}
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin relative z-10" />
          <span className="text-xs font-medium text-blue-700 relative z-10">
            {localMessage || `Checking ${label}...`}
          </span>
        </div>
      )}

      {/* ── VERIFIED ── */}
      {localStatus === 'verified' && (
        <div>
          {localPreview ? (
            <img
              src={localPreview}
              alt={label}
              className="w-full h-28 rounded-xl object-cover border border-emerald-300 shadow-sm"
            />
          ) : (
            <div className="w-full h-28 rounded-xl border border-emerald-300 flex items-center justify-center bg-emerald-50">
              <FileText className="w-8 h-8 text-emerald-500" />
            </div>
          )}
          <div className="mt-2 flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-emerald-700">{localMessage}</p>
              {maskedNumber && (
                <p className="text-[10px] text-muted-foreground mt-0.5">{maskedNumber}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleReplace}
            className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-maroon transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Replace Document
          </button>
        </div>
      )}

      {/* ── FAILED STATES (invalid, wrong_type, not_document, error) ── */}
      {(localStatus === 'invalid' ||
        localStatus === 'wrong_type' ||
        localStatus === 'not_document' ||
        localStatus === 'error') && (
        <div>
          {localPreview && (
            <div className="relative mb-3 w-full h-28 rounded-xl overflow-hidden">
              <img
                src={localPreview}
                alt="Rejected"
                className="w-full h-full object-cover opacity-50"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-red-900/15 rounded-xl">
                <XCircle className="w-10 h-10 text-red-500 drop-shadow" />
              </div>
            </div>
          )}

          <div className="flex items-start gap-2">
            {localStatus === 'wrong_type' ? (
              <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
            ) : localStatus === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p
                className={cn('text-xs font-semibold', {
                  'text-orange-700': localStatus === 'wrong_type',
                  'text-yellow-700': localStatus === 'error',
                  'text-red-700': localStatus === 'invalid' || localStatus === 'not_document',
                })}
              >
                {localStatus === 'wrong_type'
                  ? `Wrong document — ${label} required`
                  : localStatus === 'error'
                  ? 'Verification unavailable'
                  : `Invalid ${label}`}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                {localMessage}
              </p>
            </div>
          </div>

          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={handleReplace}
              className="flex items-center gap-1 text-xs font-medium text-white bg-maroon hover:bg-maroon/85 px-3 py-1.5 rounded-lg transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Upload Again
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/jpg"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}
