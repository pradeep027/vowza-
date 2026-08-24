import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UseImageUploadOptions {
  bucket: string;
  folder?: string;
  maxSizeMB?: number;
  allowedTypes?: string[];
}

interface UploadResult {
  url: string;
  path: string;
}

export const useImageUpload = (options: UseImageUploadOptions) => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const {
    bucket: initialBucket,
    folder = '',
    maxSizeMB = 5,
    allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  } = options;

  const validateFile = (file: File): string | null => {
    if (!allowedTypes.includes(file.type)) {
      return `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `File size exceeds ${maxSizeMB}MB limit`;
    }
    return null;
  };

  const uploadImage = async (file: File, userId: string): Promise<UploadResult | null> => {
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      return null;
    }

    setIsUploading(true);
    setProgress(0);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = folder ? `${userId}/${folder}/${fileName}` : `${userId}/${fileName}`;

      // Simulate progress (Supabase doesn't provide upload progress)
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 100);

      // Try primary bucket first
      let uploadError = null;
      let uploadData = null;
      let activeBucket = initialBucket;
      
      try {
        const result = await supabase.storage
          .from(activeBucket)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          });
        uploadError = result.error;
        uploadData = result.data;
      } catch (e: any) {
        uploadError = e;
      }

      // Fallback buckets for common bucket names
      if (uploadError) {
        const fallbackBuckets: Record<string, string[]> = {
          'artist-profile-images': ['profile-pictures'],
          'customer-profile-images': ['profile-pictures'],
          'portfolio-images': ['portfolio'],
          'gallery': ['portfolio'],
        };

        const fallbacks = fallbackBuckets[initialBucket] || [];
        
        for (const fallbackBucket of fallbacks) {
          try {
            const result = await supabase.storage
              .from(fallbackBucket)
              .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false,
              });
            if (!result.error) {
              uploadError = null;
              uploadData = result.data;
              activeBucket = fallbackBucket; // Update bucket for URL generation
              break;
            }
          } catch (e) {
            // Try next fallback
          }
        }
      }

      clearInterval(progressInterval);
      setProgress(100);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      const { data: urlData } = supabase.storage.from(activeBucket).getPublicUrl(filePath);

      return {
        url: urlData.publicUrl,
        path: filePath,
      };
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(err.message || 'Failed to upload image. Please try again.');
      return null;
    } finally {
      setIsUploading(false);
      setTimeout(() => setProgress(0), 500);
    }
  };

  const uploadMultiple = async (files: File[], userId: string): Promise<UploadResult[]> => {
    const results: UploadResult[] = [];
    for (const file of files) {
      const result = await uploadImage(file, userId);
      if (result) {
        results.push(result);
      }
    }
    return results;
  };

  const deleteImage = async (path: string): Promise<boolean> => {
    try {
      const { error } = await supabase.storage.from(initialBucket).remove([path]);
      if (error) throw error;
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete image');
      return false;
    }
  };

  return {
    uploadImage,
    uploadMultiple,
    deleteImage,
    isUploading,
    progress,
  };
};
