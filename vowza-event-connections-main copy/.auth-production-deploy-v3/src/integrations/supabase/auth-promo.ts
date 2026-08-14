/**
 * API functions for auth promotional image management
 */

import { supabase } from './client';

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

/**
 * Fetch the current active promotional config
 */
export const fetchAuthPromoConfig = async (): Promise<AuthPromoConfig | null> => {
  try {
    const { data, error } = await supabase
      .from('auth_promotional_config')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[authPromo] fetchConfig error:', error);
      return null;
    }

    return (data as AuthPromoConfig) || null;
  } catch (err) {
    console.error('[authPromo] fetchConfig exception:', err);
    return null;
  }
};

/**
 * Upload promotional image to Supabase Storage
 */
export const uploadAuthPromoImage = async (file: File): Promise<{ url: string; path: string } | null> => {
  try {
    // Validate file
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      throw new Error('Invalid file type. Only JPG, PNG and WebP are supported.');
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error('File too large. Maximum size is 10MB.');
    }

    // Upload
    const timestamp = Date.now();
    const filename = `promo-${timestamp}.${file.name.split('.').pop()}`;
    const storagePath = `promotional-images/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from('auth-promotional')
      .upload(storagePath, file);

    if (uploadError) throw uploadError;

    // Get public URL
    const { data } = supabase.storage.from('auth-promotional').getPublicUrl(storagePath);

    return {
      url: data.publicUrl,
      path: storagePath,
    };
  } catch (err) {
    console.error('[authPromo] uploadImage error:', err);
    throw err;
  }
};

/**
 * Update promotional config
 */
export const updateAuthPromoConfig = async (
  configId: string,
  updates: Partial<Omit<AuthPromoConfig, 'id' | 'admin_id' | 'created_at'>>
): Promise<AuthPromoConfig | null> => {
  try {
    const { data, error } = await supabase
      .from('auth_promotional_config')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', configId)
      .select('*')
      .single();

    if (error) throw error;

    return data as AuthPromoConfig;
  } catch (err) {
    console.error('[authPromo] updateConfig error:', err);
    throw err;
  }
};

/**
 * Create new promotional config
 */
export const createAuthPromoConfig = async (
  imageUrl: string,
  imagePath: string,
  overlayOpacity: number = 0.3
): Promise<AuthPromoConfig | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('You must be signed in to create a promotional configuration.');

    const { data, error } = await supabase
      .from('auth_promotional_config')
      .insert({
        admin_id: user.id,
        current_image_url: imageUrl,
        image_storage_path: imagePath,
        overlay_opacity: overlayOpacity,
        is_active: true,
      })
      .select('*')
      .single();

    if (error) throw error;

    return data as AuthPromoConfig;
  } catch (err) {
    console.error('[authPromo] createConfig error:', err);
    throw err;
  }
};

/**
 * Delete promotional image from storage
 */
export const deleteAuthPromoImage = async (storagePath: string): Promise<boolean> => {
  try {
    if (!storagePath) return true;

    const { error } = await supabase.storage
      .from('auth-promotional')
      .remove([storagePath]);

    if (error) throw error;

    return true;
  } catch (err) {
    console.error('[authPromo] deleteImage error:', err);
    return false;
  }
};

/**
 * Toggle promotional config active state
 */
export const toggleAuthPromoActive = async (configId: string, isActive: boolean): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('auth_promotional_config')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', configId);

    if (error) throw error;

    return true;
  } catch (err) {
    console.error('[authPromo] toggleActive error:', err);
    return false;
  }
};

/**
 * Update overlay settings
 */
export const updateAuthPromoOverlay = async (
  configId: string,
  overlayOpacity: number,
  overlayColor?: string
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('auth_promotional_config')
      .update({
        overlay_opacity: Math.max(0, Math.min(1, overlayOpacity)),
        ...(overlayColor && { overlay_color: overlayColor }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', configId);

    if (error) throw error;

    return true;
  } catch (err) {
    console.error('[authPromo] updateOverlay error:', err);
    return false;
  }
};
