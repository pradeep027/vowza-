/**
 * AdminAuthPromotionalManager — Admin control for authentication page promo images
 * 
 * Features:
 * - Upload/replace promotional image
 * - Preview image
 * - Adjust overlay opacity
 * - Delete image (revert to default)
 * - Admin-only access (RLS enforced)
 * - Image validation
 */

import React, { useState, useEffect } from 'react';
import { Upload, Trash2, Eye, Loader2, Check, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface AuthPromoConfig {
  id: string;
  current_image_url: string | null;
  overlay_opacity: number;
  is_active: boolean;
}

export const AdminAuthPromotionalManager: React.FC = () => {
  const { isAdmin } = useAdmin();
  const [config, setConfig] = useState<AuthPromoConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [overlayOpacity, setOverlayOpacity] = useState(0.3);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isActive, setIsActive] = useState(true);

  // Fetch current config
  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('auth_promotional_config')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig(data as AuthPromoConfig);
        setOverlayOpacity(data.overlay_opacity || 0.3);
        setIsActive(data.is_active);
      }
    } catch (err) {
      console.error('[AdminAuthPromo] Failed to fetch config:', err);
      toast.error('Failed to load current configuration');
    } finally {
      setLoading(false);
    }
  };

  const validateImage = (file: File): boolean => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a JPG, PNG or WebP image');
      return false;
    }

    if (file.size > maxSize) {
      toast.error('Image must be less than 10MB');
      return false;
    }

    return true;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!validateImage(file)) {
      setSelectedFile(null);
      setPreviewUrl('');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreviewUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadImage = async () => {
    if (!selectedFile) {
      toast.error('Please select an image');
      return;
    }

    try {
      setUploading(true);

      // Upload to Supabase Storage
      const timestamp = Date.now();
      const filename = `promo-${timestamp}.${selectedFile.name.split('.').pop()}`;
      const storagePath = `promotional-images/${filename}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('auth-promotional')
        .upload(storagePath, selectedFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from('auth-promotional').getPublicUrl(storagePath);

      // Update or create config record
      if (config) {
        const { error: updateError } = await supabase
          .from('auth_promotional_config')
          .update({
            current_image_url: publicUrl,
            image_storage_path: storagePath,
            overlay_opacity: overlayOpacity,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', config.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('auth_promotional_config')
          .insert({
            current_image_url: publicUrl,
            image_storage_path: storagePath,
            overlay_opacity: overlayOpacity,
            is_active: true,
          });

        if (insertError) throw insertError;
      }

      toast.success('Promotional image updated! Changes will appear immediately.');
      await fetchConfig();
      setSelectedFile(null);
      setPreviewUrl('');
    } catch (err) {
      console.error('[AdminAuthPromo] Upload failed:', err);
      toast.error('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const deleteImage = async () => {
    if (!config) return;

    try {
      setUploading(true);

      // Delete from storage if path exists
      if (config.image_storage_path) {
        await supabase.storage
          .from('auth-promotional')
          .remove([config.image_storage_path]);
      }

      // Update config to null
      const { error } = await supabase
        .from('auth_promotional_config')
        .update({
          current_image_url: null,
          image_storage_path: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', config.id);

      if (error) throw error;

      toast.success('Promotional image deleted. Default image will be shown.');
      await fetchConfig();
    } catch (err) {
      console.error('[AdminAuthPromo] Delete failed:', err);
      toast.error('Failed to delete image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const toggleActive = async () => {
    if (!config) return;

    try {
      setUploading(true);

      const { error } = await supabase
        .from('auth_promotional_config')
        .update({
          is_active: !isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', config.id);

      if (error) throw error;

      setIsActive(!isActive);
      toast.success(isActive ? 'Promotional image hidden' : 'Promotional image shown');
    } catch (err) {
      console.error('[AdminAuthPromo] Toggle failed:', err);
      toast.error('Failed to update status. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 rounded-lg border border-red-200 bg-red-50 text-red-600">
        <AlertCircle className="w-5 h-5 mb-2" />
        <p>Admin access required</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold mb-2">Authentication Promotional Banner</h1>
        <p className="text-muted-foreground">
          Manage the promotional image shown on the authentication modal when users log in or sign up.
        </p>
      </div>

      {/* Current Image Preview */}
      <div className="rounded-lg border border-border bg-secondary p-6 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Eye className="w-5 h-5" />
          Current Image Preview
        </h2>

        {config?.current_image_url ? (
          <div className="relative aspect-[1.5/1] rounded-lg overflow-hidden bg-slate-200">
            <img
              src={config.current_image_url}
              alt="Current promotional"
              className="w-full h-full object-cover"
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})` }}
            />
          </div>
        ) : (
          <div className="aspect-[1.5/1] rounded-lg bg-gradient-to-br from-purple-600 via-maroon-600 to-orange-600 flex items-center justify-center text-white">
            <div className="text-center">
              <p className="text-sm text-white/80 mb-2">Default promotional image</p>
              <p className="font-semibold">Vowza</p>
              <p className="text-sm text-white/80">Where Talent Meets Celebration</p>
            </div>
          </div>
        )}

        {/* Status */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="font-semibold flex items-center gap-2">
              {isActive ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  Active
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                  Hidden
                </>
              )}
            </p>
          </div>
          <button
            onClick={toggleActive}
            disabled={uploading}
            className="btn-secondary text-sm"
          >
            {isActive ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      {/* Overlay Opacity Control */}
      <div className="rounded-lg border border-border bg-secondary p-6 space-y-4">
        <h2 className="text-lg font-semibold">Overlay Settings</h2>

        <div>
          <label className="text-sm font-semibold text-foreground block mb-3">
            Overlay Opacity: {Math.round(overlayOpacity * 100)}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={overlayOpacity * 100}
            onChange={(e) => setOverlayOpacity(parseInt(e.target.value) / 100)}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Adjust darkness of overlay on top of the image for better text readability
          </p>
        </div>

        {/* Preview with opacity */}
        <div className="relative aspect-[1.5/1] rounded-lg overflow-hidden bg-slate-200">
          {config?.current_image_url && (
            <img
              src={config.current_image_url}
              alt="Preview"
              className="w-full h-full object-cover"
            />
          )}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})` }}
          />
        </div>
      </div>

      {/* Upload New Image */}
      <div className="rounded-lg border border-border bg-secondary p-6 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Upload New Image
        </h2>

        <div className="space-y-4">
          {previewUrl ? (
            <div className="relative aspect-[1.5/1] rounded-lg overflow-hidden border-2 border-maroon/50 bg-slate-100">
              <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})` }}
              />
            </div>
          ) : (
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-maroon/50 transition-colors cursor-pointer">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                className="hidden"
                id="image-upload"
              />
              <label htmlFor="image-upload" className="cursor-pointer block">
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="font-semibold text-foreground mb-1">Click to upload image</p>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG or WebP • Max 10MB • Recommended: 1920×1080px or wider
                </p>
              </label>
            </div>
          )}

          {selectedFile && (
            <div className="p-3 rounded-lg bg-blue-50 text-blue-600 text-sm flex items-center gap-2">
              <Check className="w-4 h-4" />
              {selectedFile.name} selected
            </div>
          )}

          <div className="flex gap-3">
            {previewUrl && (
              <>
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl('');
                  }}
                  disabled={uploading}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={uploadImage}
                  disabled={uploading || !selectedFile}
                  className="btn-primary flex-1 justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload Image
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground pt-2">
          Images should be landscape oriented. The left side will be visible in desktop view, showing alongside the authentication form.
        </p>
      </div>

      {/* Delete Current Image */}
      {config?.current_image_url && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-red-600 flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            Delete Current Image
          </h2>

          <p className="text-sm text-red-600">
            Remove the promotional image and revert to the default Vowza promotional background.
          </p>

          <button
            onClick={deleteImage}
            disabled={uploading}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 inline mr-2" />
                Delete Image
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminAuthPromotionalManager;
