import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Plus, X, Image as ImageIcon, Video, Music, Upload, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PortfolioItem {
  id: string;
  file?: File;
  url: string;
  type: 'image' | 'video' | 'audio';
  title: string;
}

interface PortfolioStepProps {
  items: PortfolioItem[];
  onChange: (items: PortfolioItem[]) => void;
  onUpload: (files: File[]) => Promise<void>;
  isUploading: boolean;
  onGalleryFiles?: (files: File[]) => void;
}

export const PortfolioStep = ({ items, onChange, onUpload, isUploading, onGalleryFiles }: PortfolioStepProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;
    
    const newItems: PortfolioItem[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const type = file.type.startsWith('image/')
        ? 'image'
        : file.type.startsWith('video/')
        ? 'video'
        : file.type.startsWith('audio/')
        ? 'audio'
        : null;
      
      if (type) {
        const url = URL.createObjectURL(file);
        newItems.push({
          id: `temp-${Date.now()}-${i}`,
          file,
          url,
          type,
          title: file.name.split('.')[0],
        });
      }
    }
    
    if (newItems.length > 0) {
      onChange([...items, ...newItems]);
      await onUpload(newItems.map(item => item.file!));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const removeItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (item?.url.startsWith('blob:')) {
      URL.revokeObjectURL(item.url);
    }
    onChange(items.filter((i) => i.id !== id));
  };

  const updateTitle = (id: string, title: string) => {
    onChange(items.map((i) => (i.id === id ? { ...i, title } : i)));
  };

  const handleGallerySelect = (files: FileList | null) => {
    if (!files || !onGalleryFiles) return;
    const fileArr = Array.from(files).filter(f => f.type.startsWith('image/'));
    onGalleryFiles(fileArr);
    const previews = fileArr.map(f => URL.createObjectURL(f));
    setGalleryPreviews(prev => [...prev, ...previews]);
  };

  const removeGalleryPreview = (idx: number) => {
    setGalleryPreviews(prev => {
      URL.revokeObjectURL(prev[idx]);
      const next = prev.filter((_, i) => i !== idx);
      return next;
    });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <ImageIcon className="w-4 h-4" />;
      case 'video':
        return <Video className="w-4 h-4" />;
      case 'audio':
        return <Music className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div>
        <Label className="text-base font-semibold">Portfolio</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Showcase your best work to attract more customers. Add photos, videos, or audio samples.
        </p>
      </div>

      {/* Upload Area */}
      <div
        className={cn(
          'relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 cursor-pointer',
          dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
          isUploading && 'pointer-events-none opacity-70'
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*,audio/*"
          multiple
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
        <div className="flex flex-col items-center text-center">
          {isUploading ? (
            <>
              <Loader2 className="w-12 h-12 text-primary animate-spin mb-3" />
              <p className="text-sm font-medium">Uploading...</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                <Upload className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Drag & drop files here</p>
              <p className="text-xs text-muted-foreground mt-1">
                or click to browse (Images, Videos, Audio)
              </p>
            </>
          )}
        </div>
      </div>

      {/* Portfolio Grid */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="relative group rounded-xl overflow-hidden border border-border bg-secondary/30"
            >
              {/* Preview */}
              <div className="aspect-square relative">
                {item.type === 'image' ? (
                  <img
                    src={item.url}
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                ) : item.type === 'video' ? (
                  <video
                    src={item.url}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-secondary">
                    <Music className="w-12 h-12 text-muted-foreground" />
                  </div>
                )}

                {/* Type badge */}
                <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-background/80 backdrop-blur-sm text-xs flex items-center gap-1">
                  {getIcon(item.type)}
                  {item.type}
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="absolute top-2 right-2 w-8 h-8 sm:w-6 sm:h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Title input */}
              <div className="p-2">
                <Input
                  placeholder="Add title..."
                  value={item.title}
                  onChange={(e) => updateTitle(item.id, e.target.value)}
                  className="h-8 text-xs border-0 bg-transparent focus-visible:ring-0"
                />
              </div>
            </div>
          ))}

          {/* Add more button */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="w-8 h-8" />
            <span className="text-xs">Add More</span>
          </button>
        </div>
      )}

      {/* Gallery Images (optional extra photos shown on profile) */}
      {onGalleryFiles && (
        <div className="space-y-3">
          <div>
            <Label className="text-base font-semibold">Gallery Images</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Additional photos shown in your profile gallery (separate from portfolio).
            </p>
          </div>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="w-full border-2 border-dashed border-border hover:border-primary/50 rounded-xl py-6 flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ImageIcon className="w-8 h-8" />
            <span className="text-sm">Click to add gallery images</span>
          </button>
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleGallerySelect(e.target.files)}
            className="hidden"
          />
          {galleryPreviews.length > 0 && (
            <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
              {galleryPreviews.map((src, idx) => (
                <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeGalleryPreview(idx)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tips */}
      <div className="p-4 bg-accent/10 rounded-xl">
        <h4 className="text-sm font-semibold mb-2">💡 Tips for a great portfolio</h4>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• Add at least 5-10 high-quality images</li>
          <li>• Include videos of live performances if possible</li>
          <li>• Show variety in your work (different events, styles)</li>
          <li>• Use professional photos when available</li>
        </ul>
      </div>
    </div>
  );
};
