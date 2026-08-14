import { supabase } from './client';

export const AUTH_PROMO_BUCKET = 'auth-promotional';
export const AUTH_PROMO_MAX_VIDEO_FILE_SIZE = 100 * 1024 * 1024; // 100MB

const AUTH_PROMO_VIDEO_FILE_TYPES: Record<string, { extension: string; mimeType: string }> = {
  'video/mp4': { extension: 'mp4', mimeType: 'video/mp4' },
  'video/webm': { extension: 'webm', mimeType: 'video/webm' },
};

// ============================================================================
// TYPES
// ============================================================================

export interface PromotionVideo {
  id: string;
  admin_id: string;
  video_url: string;
  storage_path: string;
  priority_order: number;
  display_position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  user_limit: number;
  unique_users_reached: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PromotionVideoWithViewStatus extends PromotionVideo {
  has_user_viewed: boolean;
}

type PromotionVideoUpdates = Partial<
  Pick<
    PromotionVideo,
    'priority_order' | 'display_position' | 'user_limit' | 'is_active'
  >
>;

// ============================================================================
// UTILITIES
// ============================================================================

const getUniqueId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Math.random().toString(36).slice(2)}-${Date.now()}`;
};

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

// ============================================================================
// VALIDATION
// ============================================================================

export const validatePromotionVideo = async (file: File): Promise<void> => {
  const fileDefinition = AUTH_PROMO_VIDEO_FILE_TYPES[file.type];
  if (!fileDefinition) {
    throw new Error('Please upload an MP4 or WebM video file.');
  }

  if (file.size <= 0 || file.size > AUTH_PROMO_MAX_VIDEO_FILE_SIZE) {
    throw new Error('Video must be greater than 0 bytes and no larger than 100MB.');
  }

  await decodeVideo(file);
};

// ============================================================================
// UPLOAD
// ============================================================================

export const uploadPromotionVideo = async (
  file: File,
): Promise<{ url: string; path: string }> => {
  await validatePromotionVideo(file);

  const extension = AUTH_PROMO_VIDEO_FILE_TYPES[file.type].extension;
  const storagePath = `promotion-videos/promo-${Date.now()}-${getUniqueId()}.${extension}`;

  const { error } = await supabase.storage
    .from(AUTH_PROMO_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '31536000',
      contentType: file.type,
      upsert: false,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from(AUTH_PROMO_BUCKET)
    .getPublicUrl(storagePath);

  return { url: data.publicUrl, path: storagePath };
};

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

export const createPromotionVideo = async (
  videoUrl: string,
  storagePath: string,
  priorityOrder: number,
  displayPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' = 'bottom-right',
  userLimit: number = 15,
): Promise<PromotionVideo> => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('Your administrator session has expired. Please sign in again.');

  const { data, error } = await supabase
    .from('auth_promotion_videos')
    .insert({
      admin_id: user.id,
      video_url: videoUrl,
      storage_path: storagePath,
      priority_order: priorityOrder,
      display_position: displayPosition,
      user_limit: Math.max(1, userLimit),
      is_active: false, // Admin must explicitly activate
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as PromotionVideo;
};

export const fetchPromotionVideos = async (): Promise<PromotionVideo[]> => {
  const { data, error } = await supabase
    .from('auth_promotion_videos')
    .select('*')
    .order('priority_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data as PromotionVideo[] | null) ?? [];
};

export const updatePromotionVideo = async (
  videoId: string,
  updates: PromotionVideoUpdates,
): Promise<PromotionVideo> => {
  const { data, error } = await supabase
    .from('auth_promotion_videos')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', videoId)
    .select('*')
    .single();

  if (error) throw error;
  return data as PromotionVideo;
};

export const deletePromotionVideo = async (videoId: string): Promise<void> => {
  const { error } = await supabase
    .from('auth_promotion_videos')
    .delete()
    .eq('id', videoId);

  if (error) throw error;
};

// ============================================================================
// RPC CALLS
// ============================================================================

/**
 * Get the currently active promotion video for a user.
 * Returns video details + whether user has already viewed it.
 * If user has viewed all active videos, returns null/empty.
 */
export const getActivePromotionVideo = async (
  userId: string,
): Promise<PromotionVideoWithViewStatus | null> => {
  console.log('[promotionVideos] Calling RPC with userId:', userId);
  const { data, error } = await supabase.rpc(
    'get_active_promotion_video',
    { p_user_id: userId },
  );

  console.log('[promotionVideos] RPC raw response - data:', data, 'error:', error);

  if (error) {
    console.error('[promotionVideos] getActivePromotionVideo RPC ERROR:', error.message, error.code, error);
    return null;
  }

  if (!data || data.length === 0) {
    console.warn('[promotionVideos] RPC returned empty or null - data:', data);
    console.warn('[promotionVideos] This means NO active videos found for this user');
    console.warn('[promotionVideos] Possible reasons:');
    console.warn('  1. No videos in auth_promotion_videos table');
    console.warn('  2. Video is_active = FALSE');
    console.warn('  3. Video unique_users_reached >= user_limit');
    return null;
  }
  
  const video = data[0] as PromotionVideoWithViewStatus;
  console.log('[promotionVideos] ✅ RPC success - video object:', {
    id: video.id,
    video_url: video.video_url,
    has_user_viewed: video.has_user_viewed,
    unique_users_reached: video.unique_users_reached,
    user_limit: video.user_limit,
    is_active: video.is_active,
    display_position: video.display_position,
  });
  
  // Validate URL is not empty
  if (!video.video_url) {
    console.error('[promotionVideos] ❌ ERROR: video_url is empty/null!');
    return null;
  }
  
  // Check if URL looks valid
  if (!video.video_url.includes('supabase.co') && !video.video_url.startsWith('http')) {
    console.error('[promotionVideos] ❌ ERROR: video_url looks invalid:', video.video_url);
  }
  
  return video;
};

/**
 * Atomically record that a user viewed a promotion video.
 * Enforces the 15-user limit and advances to next video when limit reached.
 * Returns true if successfully recorded, false if already viewed or limit reached.
 */
export const recordPromotionView = async (
  videoId: string,
  userId: string,
): Promise<boolean> => {
  const { data, error } = await supabase.rpc(
    'record_promotion_view',
    { p_video_id: videoId, p_user_id: userId },
  );

  if (error) {
    console.error('[promotionVideos] recordPromotionView RPC error:', error);
    return false;
  }

  return data === true;
};

// ============================================================================
// STORAGE CLEANUP
// ============================================================================

/**
 * Remove a video file from storage.
 * Returns false if cleanup fails (best-effort).
 */
export const deletePromotionVideoFile = async (storagePath: string | null): Promise<boolean> => {
  if (!storagePath) return true;

  const { error } = await supabase.storage
    .from(AUTH_PROMO_BUCKET)
    .remove([storagePath]);

  if (error) {
    console.error('[promotionVideos] Unable to remove storage object:', error);
    return false;
  }

  return true;
};

// ============================================================================
// ADMIN NOTIFICATIONS
// ============================================================================

export const PROMOTION_VIDEO_UPDATED_EVENT = 'vowza:promotion-video-updated';

export const notifyPromotionVideoUpdated = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PROMOTION_VIDEO_UPDATED_EVENT));
  }
};
