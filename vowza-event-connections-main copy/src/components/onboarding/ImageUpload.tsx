import { useRef, useState } from 'react';
import { Camera, Upload, X, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  onFileSelect: (file: File) => void;
  isUploading?: boolean;
  variant?: 'avatar' | 'cover';
  className?: string;
}

export const ImageUpload = ({
  value,
  onChange,
  onFileSelect,
  isUploading,
  variant = 'avatar',
  className,
}: ImageUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
      // Create preview
      const reader = new FileReader();
      reader.onload = (event) => {
        onChange(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onFileSelect(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        onChange(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  if (variant === 'cover') {
    return (
      <div
        className={cn(
          'relative w-full h-48 rounded-xl border-2 border-dashed transition-all duration-200 overflow-hidden cursor-pointer group',
          dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
          className
        )}
        onClick={handleClick}
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
          accept="image/*"
          onChange={handleChange}
          className="hidden"
        />
        {value ? (
          <>
            <img
              src={value}
              alt="Cover"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-2"
              >
                <Camera className="w-4 h-4" />
                Change
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleRemove}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
            {isUploading ? (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            ) : (
              <>
                <Upload className="w-10 h-10 mb-2" />
                <p className="text-sm font-medium">Upload Cover Image</p>
                <p className="text-xs">Drag & drop or click to browse</p>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // Avatar variant
  return (
    <div
      className={cn(
        'relative w-32 h-32 rounded-full border-4 border-background shadow-elevated overflow-hidden cursor-pointer group',
        className
      )}
      onClick={handleClick}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />
      {value ? (
        <>
          <img
            src={value}
            alt="Avatar"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Camera className="w-8 h-8 text-background" />
          </div>
        </>
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-secondary to-muted flex items-center justify-center">
          {isUploading ? (
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          ) : (
            <User className="w-12 h-12 text-muted-foreground" />
          )}
        </div>
      )}
      <div className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center">
        <Camera className="w-4 h-4 text-primary-foreground" />
      </div>
    </div>
  );
};
