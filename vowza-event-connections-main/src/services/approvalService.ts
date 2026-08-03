// ─── Approval Service ─────────────────────────────────────────────────────────
// Single source of truth for all artist approval/rejection logic.
// Called by AdminArtists and AdminArtistDetail.
// Every action: updates DB → assigns role → sends notification → logs audit.

import { supabase } from '@/integrations/supabase/client';
import { invalidateRoleCache } from '@/contexts/AuthContext';

export interface ApprovalResult {
  success: boolean;
  message: string;
}

// ── Approve artist ────────────────────────────────────────────────────────────
export async function approveArtist(
  providerId: string,
  providerUserId: string,
  adminUserId: string
): Promise<ApprovalResult> {
  try {
    const now = new Date().toISOString();

    // 1. Update provider profile: approved + published + timestamps
    const { error: updateErr } = await supabase
      .from('provider_profiles')
      .update({
        verification_status: 'approved',
        is_published:        true,
        verified_at:         now,
        verified_by:         adminUserId,
        rejection_reason:    null,
      } as any)
      .eq('id', providerId);

    if (updateErr) throw updateErr;

    // 2. Assign provider role (idempotent upsert)
    const { error: roleErr } = await supabase
      .from('user_roles')
      .upsert(
        { user_id: providerUserId, role: 'provider' },
        { onConflict: 'user_id,role' }
      );
    if (roleErr) console.warn('[approvalService] role upsert warning:', roleErr.message);

    // 3. Invalidate the artist's role cache so next login picks up 'provider' role
    invalidateRoleCache(providerUserId);

    // 4. Send in-app notification to artist
    await supabase.from('notifications' as any).insert({
      user_id:      providerUserId,
      title:        'Profile Approved! 🎉',
      message:      'Congratulations! Your Vowza profile has been successfully verified. Your profile is now live on Vowza. You can now edit your profile, manage your services, and start receiving bookings.',
      type:         'approval',
      reference_id: providerId,
      is_read:      false,
    });

    // 4. Audit log
    await supabase.from('notifications' as any).insert({
      user_id:      adminUserId,
      title:        'Artist Approved',
      message:      `Admin approved artist profile ${providerId} (user: ${providerUserId})`,
      type:         'admin_action',
      reference_id: providerId,
      is_read:      true,
    });

    return { success: true, message: 'Artist approved successfully' };
  } catch (e: any) {
    return { success: false, message: e.message ?? 'Approval failed' };
  }
}

// ── Reject artist ─────────────────────────────────────────────────────────────
export async function rejectArtist(
  providerId: string,
  providerUserId: string,
  adminUserId: string,
  reason: string
): Promise<ApprovalResult> {
  if (!reason.trim()) {
    return { success: false, message: 'Rejection reason is required' };
  }

  try {
    const now = new Date().toISOString();

    // 1. Update provider profile
    const { error: updateErr } = await supabase
      .from('provider_profiles')
      .update({
        verification_status: 'rejected',
        is_published:        false,
        rejection_reason:    reason.trim(),
        verified_at:         now,
        verified_by:         adminUserId,
      } as any)
      .eq('id', providerId);

    if (updateErr) throw updateErr;

    // 2. Remove provider role if exists
    await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', providerUserId)
      .eq('role', 'provider');

    // 3. Notify artist
    await supabase.from('notifications' as any).insert({
      user_id:      providerUserId,
      title:        'Profile Review Update',
      message:      `Your Vowza profile requires attention. Reason: ${reason}. Please update your profile and resubmit for verification. You can edit your profile and upload new documents from your dashboard.`,
      type:         'rejection',
      reference_id: providerId,
      is_read:      false,
    });

    // 4. Audit log
    await supabase.from('notifications' as any).insert({
      user_id:      adminUserId,
      title:        'Artist Rejected',
      message:      `Admin rejected artist profile ${providerId}. Reason: ${reason}`,
      type:         'admin_action',
      reference_id: providerId,
      is_read:      true,
    });

    return { success: true, message: 'Artist rejected and notified' };
  } catch (e: any) {
    return { success: false, message: e.message ?? 'Rejection failed' };
  }
}

// ── Suspend artist ────────────────────────────────────────────────────────────
export async function suspendArtist(
  providerId: string,
  providerUserId: string,
  adminUserId: string,
  reason: string
): Promise<ApprovalResult> {
  try {
    await supabase.from('provider_profiles').update({
      verification_status: 'suspended',
      is_published:        false,
      rejection_reason:    reason,
    } as any).eq('id', providerId);

    await supabase.from('notifications' as any).insert({
      user_id:      providerUserId,
      title:        'Account Suspended',
      message:      `Your Vowza account has been temporarily suspended. Reason: ${reason}. Please contact support.`,
      type:         'suspension',
      reference_id: providerId,
      is_read:      false,
    });

    await supabase.from('notifications' as any).insert({
      user_id:      adminUserId,
      title:        'Artist Suspended',
      message:      `Admin suspended artist ${providerId}. Reason: ${reason}`,
      type:         'admin_action',
      reference_id: providerId,
      is_read:      true,
    });

    return { success: true, message: 'Artist suspended' };
  } catch (e: any) {
    return { success: false, message: e.message ?? 'Suspension failed' };
  }
}
