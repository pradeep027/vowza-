// ─── Notifications feature API — settings, realtime, admin broadcast ─────────
// Single Supabase boundary for the notifications feature's direct data access.
// Behavior is preserved verbatim from NotificationBell.tsx and
// AdminNotifications.tsx (pre-migration implementations).
//
// NOTE: the live NotificationService (src/services/notificationService.ts)
// remains the implementation authority for notification CRUD during 2C-1 and
// is intentionally NOT moved or wrapped here.

import { supabase } from "@/integrations/supabase/client";

// ─── Notification preferences (NotificationBell) ─────────────────────────────

export interface NotificationPrefs {
  sms_enabled: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
  booking_notifications: boolean;
  payment_notifications: boolean;
  marketing_notifications: boolean;
  [key: string]: unknown;
}

/** Reads the user's notification settings row (null when absent). */
export async function getNotificationSettings(userId: string): Promise<NotificationPrefs | null> {
  const { data } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return (data as NotificationPrefs) ?? null;
}

/** Upserts the user's notification settings row. */
export async function saveNotificationSettings(userId: string, prefs: NotificationPrefs): Promise<void> {
  await supabase
    .from('notification_settings')
    .upsert({ user_id: userId, ...prefs, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
}

// ─── Realtime subscription (NotificationBell) ────────────────────────────────

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  reference_id: string | null;
  [key: string]: unknown;
}

interface RealtimeHandlers {
  onInsert: (row: NotificationRow) => void;
  onUpdate: (row: NotificationRow) => void;
  onDelete: (row: { id: string; is_read: boolean }) => void;
}

/**
 * Subscribes to the user's notifications realtime channel — same channel name,
 * events, schema, table, and filters as the original NotificationBell
 * implementation. Returns a cleanup function that removes the channel.
 */
export function subscribeToNotificationRealtime(
  userId: string,
  handlers: RealtimeHandlers,
): () => void {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`,
    }, (payload) => {
      handlers.onInsert(payload.new as NotificationRow);
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`,
    }, (payload) => {
      handlers.onUpdate(payload.new as NotificationRow);
    })
    .on('postgres_changes', {
      event: 'DELETE',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`,
    }, (payload) => {
      handlers.onDelete(payload.old as { id: string; is_read: boolean });
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

// ─── Admin broadcast (AdminNotifications) ────────────────────────────────────

export type BroadcastTarget = 'all' | 'artists' | 'customers';

/**
 * Resolves recipient user ids for an admin broadcast. Query-error semantics
 * preserved from the original page: query failures yield empty/partial id
 * lists (leading to the page's "No matching users found" path) rather than
 * thrown errors.
 */
export async function getBroadcastUserIds(target: BroadcastTarget): Promise<string[]> {
  if (target === 'all') {
    const { data } = await supabase.from('profiles').select('id');
    return (data ?? []).map((u: any) => u.id);
  }

  if (target === 'artists') {
    const { data } = await supabase.from('provider_profiles').select('user_id');
    return (data ?? []).map((a: any) => a.user_id).filter(Boolean);
  }

  const { data: all } = await supabase.from('profiles').select('id');
  const { data: artists } = await supabase.from('provider_profiles').select('user_id');
  const artistIds = new Set((artists ?? []).map((a: any) => a.user_id));
  return (all ?? []).map((u: any) => u.id).filter(id => !artistIds.has(id));
}

/**
 * Inserts the broadcast notification rows. Throws on error (the page's
 * try/catch surfaces the message as a toast — identical to the original).
 */
export async function insertBroadcastNotifications(
  userIds: string[],
  title: string,
  message: string,
): Promise<void> {
  const inserts = userIds.map(uid => ({ user_id: uid, title, message, type: 'admin_notification', is_read: false }));
  const { error } = await supabase.from('notifications' as any).insert(inserts);
  if (error) throw error;
}
