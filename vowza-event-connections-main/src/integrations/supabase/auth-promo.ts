import { supabase } from './client';

export const AUTH_PROMO_BUCKET = 'auth-promotional';
export const AUTH_PROMO_UPDATED_EVENT = 'vowza:auth-promo-updated';
export const AUTH_PROMO_MAX_FILE_SIZE = 10 * 1024 * 1024;

const AUTH_PROMO_FILE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export interface AuthPromoConfig {
  id: string;
  admin_id: string;
  current_image_url: string | null;
  image_storage_path: string | null;
  overlay_opacity: number;
  overlay_color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthPromoDisplayConfig {
  current_image_url: string | null;
  overlay_opacity: number;
  overlay_color: string;
}

type AuthPromoUpdates = Partial<
  Pick<
    AuthPromoConfig,
    'current_image_url' | 'image_storage_path' | 'overlay_opacity' | 'overlay_color' | 'is_active'
  >
>;

const getUniqueId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Math.random().toString(36).slice(2)}-${Date.now()}`;
};

const decodeImage = (file: File): Promise<void> =>
  new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(imageUrl);
      resolve();
    };
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error('The selected file is not a readable image.'));
    };
    image.src = imageUrl;
  });

export const validateAuthPromoImage = async (file: File): Promise<void> => {
  if (!AUTH_PROMO_FILE_TYPES[file.type]) {
    throw new Error('Please upload a JPG, PNG, or WebP image.');
  }

  if (file.size <= 0 || file.size > AUTH_PROMO_MAX_FILE_SIZE) {
    throw new Error('Image must be greater than 0 bytes and no larger than 10MB.');
  }

  await decodeImage(file);
};

const fetchPromoConfig = async (): Promise<AuthPromoConfig | null> => {
  const { data, error } = await supabase
    .from('auth_promotional_config')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return (data as AuthPromoConfig | null) ?? null;
};

/** Public reader used by both authentication experiences. */
export const fetchAuthPromoConfig = async (): Promise<AuthPromoDisplayConfig | null> => {
  const { data, error } = await supabase
    .from('auth_promotional_config')
    .select('current_image_url, overlay_opacity, overlay_color')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as AuthPromoDisplayConfig | null) ?? null;
};

/** Admin reader: includes a hidden configuration so it can be managed again. */
export const fetchLatestAuthPromoConfig = (): Promise<AuthPromoConfig | null> => fetchPromoConfig();

export const uploadAuthPromoImage = async (file: File): Promise<{ url: string; path: string }> => {
  await validateAuthPromoImage(file);

  const extension = AUTH_PROMO_FILE_TYPES[file.type];
  const storagePath = `promotional-images/promo-${Date.now()}-${getUniqueId()}.${extension}`;
  const { error } = await supabase.storage.from(AUTH_PROMO_BUCKET).upload(storagePath, file, {
    cacheControl: '31536000',
    contentType: file.type,
    upsert: false,
  });

  if (error) throw error;

  const { data } = supabase.storage.from(AUTH_PROMO_BUCKET).getPublicUrl(storagePath);
  return { url: data.publicUrl, path: storagePath };
};

export const updateAuthPromoConfig = async (
  configId: string,
  updates: AuthPromoUpdates,
): Promise<AuthPromoConfig> => {
  const { data, error } = await supabase
    .from('auth_promotional_config')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', configId)
    .select('*')
    .single();

  if (error) throw error;
  return data as AuthPromoConfig;
};

export const createAuthPromoConfig = async (
  imageUrl: string,
  imagePath: string,
  overlayOpacity = 0.3,
  overlayColor = 'rgba(0, 0, 0, 1)',
): Promise<AuthPromoConfig> => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('Your administrator session has expired. Please sign in again.');

  const { data, error } = await supabase
    .from('auth_promotional_config')
    .insert({
      admin_id: user.id,
      current_image_url: imageUrl,
      image_storage_path: imagePath,
      overlay_opacity: Math.max(0, Math.min(1, overlayOpacity)),
      overlay_color: overlayColor,
      is_active: true,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as AuthPromoConfig;
};

/** Returns false rather than throwing so callers can safely perform best-effort cleanup. */
export const deleteAuthPromoImage = async (storagePath: string | null): Promise<boolean> => {
  if (!storagePath) return true;

  const { error } = await supabase.storage.from(AUTH_PROMO_BUCKET).remove([storagePath]);
  if (error) {
    console.error('[authPromo] Unable to remove storage object:', error);
    return false;
  }

  return true;
};

/** Notify mounted auth surfaces after a successful admin persistence operation. */
export const notifyAuthPromoUpdated = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_PROMO_UPDATED_EVENT));
  }
};


export const AUTH_PROMO_MEDIA_MAX_FILE_SIZE = 100 * 1024 * 1024;

const AUTH_PROMO_MEDIA_FILE_TYPES: Record<string, { extension: string; mediaType: AuthPromoMediaType }> = {
  'image/jpeg': { extension: 'jpg', mediaType: 'image' },
  'image/png': { extension: 'png', mediaType: 'image' },
  'image/webp': { extension: 'webp', mediaType: 'image' },
  'video/mp4': { extension: 'mp4', mediaType: 'video' },
  'video/webm': { extension: 'webm', mediaType: 'video' },
};

export type AuthPromoMediaType = 'image' | 'video';

export interface AuthPromotionMedia {
  id: string;
  admin_id: string;
  media_type: AuthPromoMediaType;
  media_url: string;
  storage_path: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type AuthPromotionMediaUpdates = Partial<
  Pick<AuthPromotionMedia, 'display_order' | 'is_active'>
>;

const decodeVideo = (file: File): Promise<void> =>
  new Promise((resolve, reject) => {
    const videoUrl = URL.createObjectURL(file);
    const video = document.createElement('video');

    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(videoUrl);
      resolve();
    };
    video.onerror = () => {
      URL.revokeObjectURL(videoUrl);
      reject(new Error('The selected file is not a readable video.'));
    };
    video.src = videoUrl;
  });

export const getAuthPromoMediaType = (file: File): AuthPromoMediaType | null =>
  AUTH_PROMO_MEDIA_FILE_TYPES[file.type]?.mediaType ?? null;

/** Validates a homepage promotion image or browser-playable video before upload. */
export const validateAuthPromoMedia = async (file: File): Promise<AuthPromoMediaType> => {
  const fileDefinition = AUTH_PROMO_MEDIA_FILE_TYPES[file.type];
  if (!fileDefinition) {
    throw new Error('Please upload a JPG, PNG, WebP, MP4, or WebM file.');
  }

  if (file.size <= 0 || file.size > AUTH_PROMO_MEDIA_MAX_FILE_SIZE) {
    throw new Error('Media must be greater than 0 bytes and no larger than 100MB.');
  }

  if (fileDefinition.mediaType === 'image') {
    await decodeImage(file);
  } else {
    await decodeVideo(file);
  }

  return fileDefinition.mediaType;
};

/** Public reader for the homepage. Inactive media is excluded at the database query. */
export const fetchActiveAuthPromotionMedia = async (): Promise<AuthPromotionMedia[]> => {
  const { data, error } = await supabase
    .from('auth_promotion_media')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data as AuthPromotionMedia[] | null) ?? [];
};

/** Admin reader that includes inactive media so it can be published or reordered. */
export const fetchAuthPromotionMediaForManagement = async (): Promise<AuthPromotionMedia[]> => {
  const { data, error } = await supabase
    .from('auth_promotion_media')
    .select('*')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data as AuthPromotionMedia[] | null) ?? [];
};

export const uploadAuthPromoMedia = async (
  file: File,
): Promise<{ url: string; path: string; mediaType: AuthPromoMediaType }> => {
  const mediaType = await validateAuthPromoMedia(file);
  const extension = AUTH_PROMO_MEDIA_FILE_TYPES[file.type].extension;
  const storagePath = `promotion-media/${mediaType}/promo-${Date.now()}-${getUniqueId()}.${extension}`;
  const { error } = await supabase.storage.from(AUTH_PROMO_BUCKET).upload(storagePath, file, {
    cacheControl: '31536000',
    contentType: file.type,
    upsert: false,
  });

  if (error) throw error;

  const { data } = supabase.storage.from(AUTH_PROMO_BUCKET).getPublicUrl(storagePath);
  return { url: data.publicUrl, path: storagePath, mediaType };
};

export const createAuthPromotionMedia = async (
  media: Pick<AuthPromotionMedia, 'media_type' | 'media_url' | 'storage_path' | 'display_order'>,
): Promise<AuthPromotionMedia> => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('Your administrator session has expired. Please sign in again.');

  const { data, error } = await supabase
    .from('auth_promotion_media')
    .insert({ ...media, admin_id: user.id, is_active: true })
    .select('*')
    .single();

  if (error) throw error;
  return data as AuthPromotionMedia;
};

export const updateAuthPromotionMedia = async (
  mediaId: string,
  updates: AuthPromotionMediaUpdates,
): Promise<AuthPromotionMedia> => {
  const { data, error } = await supabase
    .from('auth_promotion_media')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', mediaId)
    .select('*')
    .single();

  if (error) throw error;
  return data as AuthPromotionMedia;
};

/** Removes the database record. Call deleteAuthPromoImage with its storage_path afterwards. */
export const deleteAuthPromotionMedia = async (mediaId: string): Promise<void> => {
  const { error } = await supabase
    .from('auth_promotion_media')
    .delete()
    .eq('id', mediaId);

  if (error) throw error;
};
