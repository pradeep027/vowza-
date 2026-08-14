import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, Check, Eye, Image as ImageIcon, Loader2, Trash2, Upload, Video } from 'lucide-react';
import { useAdmin } from '@/contexts/AuthContext';
import {
  createAuthPromoConfig,
  createAuthPromotionMedia,
  deleteAuthPromoImage,
  deleteAuthPromotionMedia,
  fetchAuthPromotionMediaForManagement,
  fetchLatestAuthPromoConfig,
  notifyAuthPromoUpdated,
  updateAuthPromoConfig,
  updateAuthPromotionMedia,
  uploadAuthPromoImage,
  uploadAuthPromoMedia,
  validateAuthPromoImage,
  validateAuthPromoMedia,
  type AuthPromoConfig,
  type AuthPromotionMedia,
  type AuthPromoMediaType,
  type HomepagePromotionSlotNumber,
} from '@/integrations/supabase/auth-promo';
import { toast } from 'sonner';

const DEFAULT_OVERLAY_COLOR = 'rgba(0, 0, 0, 1)';

interface SelectedPromotionMedia {
  file: File;
  previewUrl: string;
  mediaType: AuthPromoMediaType;
}

const mediaTypeLabel = (mediaType: AuthPromoMediaType) => mediaType === 'video' ? 'Video' : 'Photo';

interface HomepageMediaSlotCardProps {
  slotNumber: 1 | 2 | 3 | 4;
  slotTitle: string;
  slotDescription: string;
  acceptedTypes: string;
  mediaType: AuthPromoMediaType;
  media: AuthPromotionMedia[];
  onUpload: (file: File) => Promise<void>;
  onDelete: (item: AuthPromotionMedia) => Promise<void>;
  onToggleActive: (item: AuthPromotionMedia) => Promise<void>;
  isUploading: boolean;
}

const HomepageMediaSlotCard: React.FC<HomepageMediaSlotCardProps> = ({
  slotNumber,
  slotTitle,
  slotDescription,
  acceptedTypes,
  mediaType,
  media,
  onUpload,
  onDelete,
  onToggleActive,
  isUploading,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await validateAuthPromoMedia(file);
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    } catch (error) {
      event.target.value = '';
      toast.error(error instanceof Error ? error.message : `Please choose a valid ${mediaType} file.`);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      await onUpload(selectedFile);
      setSelectedFile(null);
      setPreviewUrl('');
    } catch (error) {
      console.error(`[AdminAuthPromo] Slot ${slotNumber} upload failed:`, error);
      toast.error(error instanceof Error ? error.message : `Failed to upload ${mediaType}.`);
    } finally {
      setUploading(false);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreviewUrl('');
  };

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  return (
    <div className="rounded-lg border border-border bg-background p-6">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-base font-semibold">{slotTitle}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{slotDescription}</p>
      </div>

      {/* Current Media Items */}
      {media.length > 0 && (
        <div className="mb-6 space-y-2 border-b border-border pb-4">
          <p className="text-xs font-semibold text-muted-foreground">CURRENT ITEMS ({media.length})</p>
          {media.map((item, index) => (
            <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border/50 bg-slate-50 p-3">
              {/* Thumbnail */}
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-slate-100">
                {item.media_type === 'image' ? (
                  <img src={item.media_url} alt={`${mediaType} ${index + 1}`} className="h-full w-full object-cover" />
                ) : (
                  <video src={item.media_url} muted preload="metadata" className="h-full w-full object-cover" />
                )}
              </div>

              {/* Details */}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  {item.media_type === 'image' ? <ImageIcon className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                  Slot {item.slot_number}, Item {index + 1}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                    {item.is_active ? 'Published' : 'Hidden'}
                  </span>
                </p>
              </div>

              {/* Actions */}
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={() => onToggleActive(item)}
                  disabled={isUploading || uploading}
                  className="btn-secondary text-xs px-2.5 py-1.5"
                >
                  {item.is_active ? 'Hide' : 'Publish'}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(item)}
                  disabled={isUploading || uploading}
                  className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  <Trash2 className="inline h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Section */}
      {!previewUrl ? (
        <div className="rounded-lg border-2 border-dashed border-border p-6 text-center transition-colors hover:border-maroon/50">
          <input
            type="file"
            accept={acceptedTypes}
            onChange={handleFileSelect}
            className="hidden"
            id={`slot-${slotNumber}-upload`}
          />
          <label htmlFor={`slot-${slotNumber}-upload`} className="block cursor-pointer">
            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="font-semibold text-foreground">Upload {mediaType}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {mediaType === 'video' ? 'MP4 or WebM' : 'JPG, PNG or WebP'} • Max 100MB
            </p>
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="aspect-video overflow-hidden rounded-lg border-2 border-maroon/50 bg-slate-100">
            {mediaType === 'image' ? (
              <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
            ) : (
              <video src={previewUrl} muted controls className="h-full w-full object-cover" />
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={clearSelection}
              disabled={uploading}
              className="btn-secondary flex-1 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading || !selectedFile}
              className="btn-primary flex-1 justify-center gap-2 text-sm"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload {mediaType === 'video' ? 'Video' : 'Photo'}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const AdminAuthPromotionalManager: React.FC = () => {
  const { isAdmin } = useAdmin();
  const [config, setConfig] = useState<AuthPromoConfig | null>(null);
  const [homepageMedia, setHomepageMedia] = useState<AuthPromotionMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [overlayOpacity, setOverlayOpacity] = useState(0.3);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [selectedHomepageMedia, setSelectedHomepageMedia] = useState<SelectedPromotionMedia[]>([]);

  const loadConfiguration = async () => {
    try {
      setLoading(true);
      const [nextConfig, nextMedia] = await Promise.all([
        fetchLatestAuthPromoConfig(),
        fetchAuthPromotionMediaForManagement(),
      ]);
      setConfig(nextConfig);
      setOverlayOpacity(nextConfig?.overlay_opacity ?? 0.3);
      setHomepageMedia(nextMedia);
    } catch (error) {
      console.error('[AdminAuthPromo] Unable to load configuration:', error);
      toast.error('Failed to load the current promotion configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadConfiguration();
  }, []);

  useEffect(() => () => {
    selectedHomepageMedia.forEach((selection) => URL.revokeObjectURL(selection.previewUrl));
  }, [selectedHomepageMedia]);

  const overlayStyle = {
    backgroundColor: config?.overlay_color ?? DEFAULT_OVERLAY_COLOR,
    opacity: overlayOpacity,
  };

  const nextDisplayOrder = useMemo(
    () => homepageMedia.reduce((largest, item) => Math.max(largest, item.display_order), -1) + 1,
    [homepageMedia],
  );

  const clearSelectedImage = () => {
    setSelectedFile(null);
    setPreviewUrl('');
  };

  const clearSelectedHomepageMedia = () => setSelectedHomepageMedia([]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await validateAuthPromoImage(file);
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    } catch (error) {
      clearSelectedImage();
      event.target.value = '';
      toast.error(error instanceof Error ? error.message : 'Please choose a valid image.');
    }
  };

  const handleHomepageMediaSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    try {
      const selections = await Promise.all(files.map(async (file) => ({
        file,
        mediaType: await validateAuthPromoMedia(file),
      })));
      setSelectedHomepageMedia(selections.map((selection) => ({
        ...selection,
        previewUrl: URL.createObjectURL(selection.file),
      })));
    } catch (error) {
      event.target.value = '';
      toast.error(error instanceof Error ? error.message : 'Please choose valid media files.');
    }
  };

  const uploadImage = async () => {
    if (!selectedFile) {
      toast.error('Please select an image.');
      return;
    }

    setUploading(true);
    try {
      const previousPath = config?.image_storage_path ?? null;
      const uploadedImage = await uploadAuthPromoImage(selectedFile);
      let persistedConfig: AuthPromoConfig;
      try {
        persistedConfig = config
          ? await updateAuthPromoConfig(config.id, {
              current_image_url: uploadedImage.url,
              image_storage_path: uploadedImage.path,
              overlay_opacity: overlayOpacity,
              is_active: true,
            })
          : await createAuthPromoConfig(uploadedImage.url, uploadedImage.path, overlayOpacity);
      } catch (persistError) {
        await deleteAuthPromoImage(uploadedImage.path);
        throw persistError;
      }

      setConfig(persistedConfig);
      setOverlayOpacity(persistedConfig.overlay_opacity ?? 0.3);
      notifyAuthPromoUpdated();
      clearSelectedImage();

      if (previousPath && previousPath !== uploadedImage.path && !await deleteAuthPromoImage(previousPath)) {
        toast.warning('Promotion updated, but the old image could not be removed automatically.');
        return;
      }

      toast.success('Authentication promotional image updated.');
    } catch (error) {
      console.error('[AdminAuthPromo] Upload failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload the promotional image.');
    } finally {
      setUploading(false);
    }
  };

  const uploadHomepageMedia = async () => {
    if (!selectedHomepageMedia.length) {
      toast.error('Select one or more photos or videos first.');
      return;
    }

    setMediaUploading(true);
    const createdMedia: AuthPromotionMedia[] = [];
    try {
      for (const [index, selection] of selectedHomepageMedia.entries()) {
        const uploaded = await uploadAuthPromoMedia(selection.file);
        try {
          const created = await createAuthPromotionMedia({
            media_type: uploaded.mediaType,
            media_url: uploaded.url,
            storage_path: uploaded.path,
            display_order: nextDisplayOrder + index,
          });
          createdMedia.push(created);
        } catch (persistError) {
          await deleteAuthPromoImage(uploaded.path);
          throw persistError;
        }
      }

      setHomepageMedia((current) => [...current, ...createdMedia].sort((a, b) => a.display_order - b.display_order));
      clearSelectedHomepageMedia();
      notifyAuthPromoUpdated();
      toast.success(`${createdMedia.length} homepage promotion ${createdMedia.length === 1 ? 'item' : 'items'} uploaded.`);
    } catch (error) {
      await Promise.allSettled(createdMedia.map(async (item) => {
        await deleteAuthPromotionMedia(item.id);
        await deleteAuthPromoImage(item.storage_path);
      }));
      console.error('[AdminAuthPromo] Homepage media upload failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload homepage promotion media.');
      await loadConfiguration();
    } finally {
      setMediaUploading(false);
    }
  };

  const deleteImage = async () => {
    if (!config) return;

    setUploading(true);
    try {
      const previousPath = config.image_storage_path;
      const persistedConfig = await updateAuthPromoConfig(config.id, {
        current_image_url: null,
        image_storage_path: null,
      });

      setConfig(persistedConfig);
      notifyAuthPromoUpdated();
      if (!await deleteAuthPromoImage(previousPath)) {
        toast.warning('The promotion was removed, but the old storage object could not be cleaned up automatically.');
        return;
      }

      toast.success('Authentication promotional image removed.');
    } catch (error) {
      console.error('[AdminAuthPromo] Delete failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete the promotional image.');
    } finally {
      setUploading(false);
    }
  };

  const deleteHomepageMedia = async (item: AuthPromotionMedia) => {
    setMediaUploading(true);
    try {
      await deleteAuthPromotionMedia(item.id);
      setHomepageMedia((current) => current.filter((media) => media.id !== item.id));
      notifyAuthPromoUpdated();
      if (!await deleteAuthPromoImage(item.storage_path)) {
        toast.warning('Media was removed from the homepage, but its stored file could not be cleaned up automatically.');
        return;
      }
      toast.success('Homepage promotion media removed.');
    } catch (error) {
      console.error('[AdminAuthPromo] Homepage media delete failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to remove homepage promotion media.');
    } finally {
      setMediaUploading(false);
    }
  };

  const toggleActive = async () => {
    if (!config) return;

    setUploading(true);
    try {
      const persistedConfig = await updateAuthPromoConfig(config.id, { is_active: !config.is_active });
      setConfig(persistedConfig);
      notifyAuthPromoUpdated();
      toast.success(persistedConfig.is_active ? 'Authentication promotional image shown.' : 'Authentication promotional image hidden.');
    } catch (error) {
      console.error('[AdminAuthPromo] Status update failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update promotional image status.');
    } finally {
      setUploading(false);
    }
  };

  const toggleHomepageMediaActive = async (item: AuthPromotionMedia) => {
    setMediaUploading(true);
    try {
      const updated = await updateAuthPromotionMedia(item.id, { is_active: !item.is_active });
      setHomepageMedia((current) => current.map((media) => media.id === updated.id ? updated : media));
      notifyAuthPromoUpdated();
      toast.success(updated.is_active ? 'Homepage media published.' : 'Homepage media hidden.');
    } catch (error) {
      console.error('[AdminAuthPromo] Homepage media status update failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update homepage media status.');
    } finally {
      setMediaUploading(false);
    }
  };

  const moveHomepageMedia = async (item: AuthPromotionMedia, direction: -1 | 1) => {
    const itemIndex = homepageMedia.findIndex((media) => media.id === item.id);
    const adjacent = homepageMedia[itemIndex + direction];
    if (itemIndex < 0 || !adjacent) return;

    setMediaUploading(true);
    try {
      await Promise.all([
        updateAuthPromotionMedia(item.id, { display_order: adjacent.display_order }),
        updateAuthPromotionMedia(adjacent.id, { display_order: item.display_order }),
      ]);
      await loadConfiguration();
      notifyAuthPromoUpdated();
      toast.success('Homepage media order updated.');
    } catch (error) {
      console.error('[AdminAuthPromo] Homepage media reorder failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to reorder homepage media.');
    } finally {
      setMediaUploading(false);
    }
  };

  const saveOverlay = async () => {
    if (!config) {
      toast.error('Upload an image before saving overlay settings.');
      return;
    }

    setUploading(true);
    try {
      const persistedConfig = await updateAuthPromoConfig(config.id, { overlay_opacity: overlayOpacity });
      setConfig(persistedConfig);
      notifyAuthPromoUpdated();
      toast.success('Overlay settings saved.');
    } catch (error) {
      console.error('[AdminAuthPromo] Overlay update failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save overlay settings.');
    } finally {
      setUploading(false);
    }
  };

  if (!isAdmin) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-red-600"><AlertCircle className="mb-2 h-5 w-5" /><p>Admin access required.</p></div>;
  }

  if (loading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-2 text-3xl font-display font-bold">Authentication Promotional Banner</h1>
        <p className="text-muted-foreground">Manage the sign-in image and the ordered image/video media used by the homepage promotion cards.</p>
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-secondary p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Eye className="h-5 w-5" />Current Authentication Image</h2>
        {config?.current_image_url ? <div className="relative aspect-[1.5/1] overflow-hidden rounded-lg bg-slate-200"><img src={config.current_image_url} alt="Current promotional" className="h-full w-full object-cover" /><div className="pointer-events-none absolute inset-0" style={overlayStyle} /></div> : <div className="flex aspect-[1.5/1] items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 via-maroon-600 to-orange-600 text-white"><div className="text-center"><p className="mb-2 text-sm text-white/80">Default promotional image</p><p className="font-semibold">Vowza</p><p className="text-sm text-white/80">Where Talent Meets Celebration</p></div></div>}
        <div className="flex items-center justify-between pt-2"><div><p className="text-xs text-muted-foreground">Status</p><p className="flex items-center gap-2 font-semibold"><span className={`h-2 w-2 rounded-full ${config?.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />{config ? (config.is_active ? 'Active' : 'Hidden') : 'Default background'}</p></div><button onClick={toggleActive} disabled={uploading || !config} className="btn-secondary text-sm">{config?.is_active ? 'Hide' : 'Show'}</button></div>
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-secondary p-6">
        <h2 className="text-lg font-semibold">Authentication Image Overlay</h2>
        <div><label className="mb-3 block text-sm font-semibold text-foreground">Overlay Opacity: {Math.round(overlayOpacity * 100)}%</label><input type="range" min="0" max="100" value={overlayOpacity * 100} onChange={(event) => setOverlayOpacity(Number(event.target.value) / 100)} className="w-full" /><p className="mt-2 text-xs text-muted-foreground">Adjust darkness over the image for better text readability.</p></div>
        <div className="relative aspect-[1.5/1] overflow-hidden rounded-lg bg-slate-200">{config?.current_image_url && <img src={config.current_image_url} alt="Overlay preview" className="h-full w-full object-cover" />}<div className="pointer-events-none absolute inset-0" style={overlayStyle} /></div>
        <button type="button" onClick={saveOverlay} disabled={uploading || !config} className="btn-primary text-sm">{uploading ? 'Saving…' : 'Save Overlay Settings'}</button>
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-secondary p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Upload className="h-5 w-5" />Upload Authentication Image</h2>
        {previewUrl ? <div className="relative aspect-[1.5/1] overflow-hidden rounded-lg border-2 border-maroon/50 bg-slate-100"><img src={previewUrl} alt="Selected promotion preview" className="h-full w-full object-cover" /><div className="pointer-events-none absolute inset-0" style={overlayStyle} /></div> : <div className="cursor-pointer rounded-lg border-2 border-dashed border-border p-8 text-center transition-colors hover:border-maroon/50"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileSelect} className="hidden" id="image-upload" /><label htmlFor="image-upload" className="block cursor-pointer"><Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="mb-1 font-semibold text-foreground">Click to upload image</p><p className="text-xs text-muted-foreground">JPG, PNG or WebP • Max 10MB • Recommended: 1920×1080px or wider</p></label></div>}
        {selectedFile && <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-600"><Check className="h-4 w-4" />{selectedFile.name} selected</div>}
        {previewUrl && <div className="flex gap-3"><button onClick={clearSelectedImage} disabled={uploading} className="btn-secondary flex-1">Cancel</button><button onClick={uploadImage} disabled={uploading || !selectedFile} className="btn-primary flex-1 justify-center gap-2">{uploading ? <><Loader2 className="h-4 w-4 animate-spin" />Uploading…</> : <><Upload className="h-4 w-4" />Upload Image</>}</button></div>}
      </div>

      {config?.current_image_url && <div className="space-y-4 rounded-lg border border-red-200 bg-red-50 p-6"><h2 className="flex items-center gap-2 text-lg font-semibold text-red-600"><Trash2 className="h-5 w-5" />Delete Authentication Image</h2><p className="text-sm text-red-600">Remove the authentication image and revert to the default Vowza promotional background.</p><button onClick={deleteImage} disabled={uploading} className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50">{uploading ? <><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Deleting…</> : <><Trash2 className="mr-2 inline h-4 w-4" />Delete Image</>}</button></div>}

      <section className="space-y-6 rounded-lg border border-border bg-secondary p-6">
        <div><h2 className="flex items-center gap-2 text-lg font-semibold"><ImageIcon className="h-5 w-5" />Homepage Promotion Media</h2><p className="mt-1 text-sm text-muted-foreground">Manage four fixed image cards on the homepage in a 2×2 grid. Upload images for each position. Each slot can have multiple images that rotate automatically every 10 seconds; unpublished items never appear publicly.</p></div>

        {/* IMAGE CARDS - Slots 1-4 */}
        {[1, 2, 3, 4].map((slotNum) => (
          <HomepageMediaSlotCard
            key={slotNum}
            slotNumber={slotNum as HomepagePromotionSlotNumber}
            slotTitle={`Image Card ${slotNum}`}
            slotDescription={`Homepage ${['top-left', 'top-right', 'bottom-left', 'bottom-right'][slotNum - 1]} image position`}
            acceptedTypes="image/jpeg,image/png,image/webp"
            mediaType="image"
            media={homepageMedia.filter((m) => m.slot_number === slotNum)}
            onUpload={async (file) => {
              const uploaded = await uploadAuthPromoMedia(file);
              try {
                const created = await createAuthPromotionMedia({
                  media_type: 'image',
                  media_url: uploaded.url,
                  storage_path: uploaded.path,
                  display_order: Math.max(...homepageMedia.filter((m) => m.slot_number === slotNum).map((m) => m.display_order), -1) + 1,
                  slot_number: slotNum as HomepagePromotionSlotNumber,
                });
                setHomepageMedia((current) => [...current, created].sort((a, b) => a.display_order - b.display_order));
                notifyAuthPromoUpdated();
                toast.success('Image uploaded successfully.');
              } catch (persistError) {
                await deleteAuthPromoImage(uploaded.path);
                throw persistError;
              }
            }}
            onDelete={(item) => deleteHomepageMedia(item)}
            onToggleActive={(item) => toggleHomepageMediaActive(item)}
            isUploading={mediaUploading}
          />
        ))}
      </section>
    </div>
  );
};

export default AdminAuthPromotionalManager;
