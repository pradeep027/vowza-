// ─── ImageUpload — reusable avatar / cover image uploader ─────────────────────
// Click or drag-and-drop → validate → preview → crop → compress → Supabase Storage.
// No external crop library: crop + compress are done natively with <canvas>.
//
// Accepts: JPG, JPEG, PNG, WEBP. Max 10 MB.
// Outputs: a public URL from the given Supabase Storage bucket.

import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Camera, Upload, X, Loader2, ImageIcon, RotateCw } from 'lucide-react';

const ACCEPTED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export interface ImageUploadProps {
  /** Current image URL, if any. */
  value?: string | null;
  /** Called with the new public URL after a successful upload. */
  onUploaded: (url: string) => void | Promise<void>;
  /** Supabase Storage bucket name. */
  bucket?: string;
  /** Folder prefix inside the bucket. */
  folder?: string;
  /** Prefix for the generated filename (usually the provider/user id). */
  filePrefix?: string;
  /** `avatar` renders a round 1:1 control, `cover` a wide 3:1 banner. */
  variant?: 'avatar' | 'cover';
  /** Output edge length (avatar) or width (cover) in px. */
  outputSize?: number;
  className?: string;
}

// ── Load a File into an HTMLImageElement ──────────────────────────────────────
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')); };
    img.src = url;
  });
}

// ── Center-crop + resize + compress to a JPEG blob ────────────────────────────
async function processImage(
  img: HTMLImageElement,
  aspect: number,       // width / height
  outWidth: number,
  rotation: number,     // degrees, multiples of 90
): Promise<Blob> {
  // Apply rotation first if needed
  let src: HTMLCanvasElement | HTMLImageElement = img;
  if (rotation % 360 !== 0) {
    const rc = document.createElement('canvas');
    const swap = (rotation / 90) % 2 !== 0;
    rc.width  = swap ? img.naturalHeight : img.naturalWidth;
    rc.height = swap ? img.naturalWidth  : img.naturalHeight;
    const rctx = rc.getContext('2d')!;
    rctx.translate(rc.width / 2, rc.height / 2);
    rctx.rotate((rotation * Math.PI) / 180);
    rctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    src = rc;
  }

  const sw = src instanceof HTMLCanvasElement ? src.width  : src.naturalWidth;
  const sh = src instanceof HTMLCanvasElement ? src.height : src.naturalHeight;

  // Center crop to the target aspect ratio
  const srcAspect = sw / sh;
  let cropW = sw, cropH = sh, cropX = 0, cropY = 0;
  if (srcAspect > aspect) {
    cropW = sh * aspect;
    cropX = (sw - cropW) / 2;
  } else {
    cropH = sw / aspect;
    cropY = (sh - cropH) / 2;
  }

  const outHeight = Math.round(outWidth / aspect);
  const canvas = document.createElement('canvas');
  canvas.width  = outWidth;
  canvas.height = outHeight;

  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, cropX, cropY, cropW, cropH, 0, 0, outWidth, outHeight);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      b => (b ? resolve(b) : reject(new Error('Compression failed'))),
      'image/jpeg',
      0.86,
    );
  });
}

export default function ImageUpload({
  value,
  onUploaded,
  bucket = 'provider-media',
  folder = 'avatars',
  filePrefix = 'img',
  variant = 'avatar',
  outputSize,
  className,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview]     = useState<string | null>(null);
  const [pendingImg, setPendingImg] = useState<HTMLImageElement | null>(null);
  const [rotation, setRotation]   = useState(0);

  const isAvatar = variant === 'avatar';
  const aspect   = isAvatar ? 1 : 3;
  const outW     = outputSize ?? (isAvatar ? 512 : 1600);

  // ── Validate + stage for preview ──────────────────────────────────────────
  const stageFile = useCallback(async (file: File) => {
    if (!ACCEPTED.includes(file.type.toLowerCase())) {
      toast.error('Only JPG, PNG or WEBP images are allowed');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(`Image is ${(file.size / 1024 / 1024).toFixed(1)} MB. Maximum is 10 MB.`);
      return;
    }
    try {
      const img = await loadImage(file);
      setPendingImg(img);
      setRotation(0);
      setPreview(img.src);
    } catch (e: any) {
      toast.error(e.message ?? 'Could not read that image');
    }
  }, []);

  const onPick = (files: FileList | null) => {
    const f = files?.[0];
    if (f) stageFile(f);
    if (inputRef.current) inputRef.current.value = '';
  };

  // ── Confirm → process → upload ────────────────────────────────────────────
  const confirmUpload = async () => {
    if (!pendingImg) return;
    setUploading(true);
    try {
      const blob = await processImage(pendingImg, aspect, outW, rotation);
      const path = `${folder}/${filePrefix}_${Date.now()}.jpg`;

      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false });

      if (upErr) throw new Error(upErr.message);

      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
      await onUploaded(pub.publicUrl);

      toast.success('Image updated');
      setPreview(null);
      setPendingImg(null);
      setRotation(0);
    } catch (e: any) {
      toast.error(e.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const cancel = () => {
    setPreview(null);
    setPendingImg(null);
    setRotation(0);
  };

  // ── Drop handlers ─────────────────────────────────────────────────────────
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) stageFile(f);
  };

  return (
    <>
      {/* ── Control ── */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn('relative inline-block', className)}
      >
        {isAvatar ? (
          <div className={cn(
            'relative w-20 h-20 rounded-2xl overflow-hidden transition-all duration-200',
            'bg-gradient-to-br from-[#8B1538] to-[#D4AF37]',
            dragging && 'ring-2 ring-[#8B1538] ring-offset-2 scale-[1.02]',
          )}>
            {value ? (
              <img src={value} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="w-7 h-7 text-white/80" />
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
          </div>
        ) : (
          <div className={cn(
            'relative w-full h-32 rounded-2xl overflow-hidden border border-border/60 transition-all duration-200',
            'bg-gradient-to-r from-[#8B1538]/10 to-[#D4AF37]/10',
            dragging && 'ring-2 ring-[#8B1538] ring-offset-2',
          )}>
            {value ? (
              <img src={value} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
                <Upload className="w-6 h-6" />
                <span className="text-xs font-medium">
                  {dragging ? 'Drop image here' : 'Click or drag a cover image'}
                </span>
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
          </div>
        )}

        {/* Camera / change button */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          aria-label={isAvatar ? 'Change profile photo' : 'Change cover photo'}
          className={cn(
            'absolute flex items-center justify-center rounded-full bg-white border border-border shadow-sm',
            'hover:bg-secondary hover:scale-105 transition-all duration-200 disabled:opacity-50',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B1538]/40',
            isAvatar ? '-bottom-1 -right-1 w-8 h-8' : 'bottom-3 right-3 w-9 h-9',
          )}
        >
          <Camera className={cn('text-muted-foreground', isAvatar ? 'w-4 h-4' : 'w-4 h-4')} />
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          className="hidden"
          onChange={e => onPick(e.target.files)}
        />
      </div>

      {/* ── Preview / crop dialog ── */}
      {preview && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
              <h3 className="text-sm font-semibold text-foreground">
                {isAvatar ? 'Preview Profile Photo' : 'Preview Cover Photo'}
              </h3>
              <button onClick={cancel} disabled={uploading}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground disabled:opacity-50">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex flex-col items-center gap-4">
              <div className={cn(
                'overflow-hidden bg-secondary border border-border/60',
                isAvatar ? 'w-40 h-40 rounded-2xl' : 'w-full h-32 rounded-xl',
              )}>
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  style={{ transform: `rotate(${rotation}deg)` }}
                />
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Image will be center-cropped to {isAvatar ? 'a square' : '3:1'} and compressed automatically.
              </p>

              <button
                onClick={() => setRotation(r => (r + 90) % 360)}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-secondary transition-colors disabled:opacity-50"
              >
                <RotateCw className="w-3.5 h-3.5" /> Rotate
              </button>
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-border/60">
              <button onClick={cancel} disabled={uploading}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={confirmUpload} disabled={uploading}
                className="flex-1 py-2.5 rounded-xl bg-[#8B1538] text-white text-sm font-semibold hover:bg-[#8B1538]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</> : 'Save Photo'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
