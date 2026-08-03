// ─── Approval Service ─────────────────────────────────────────────────────────
// Calls the Supabase approve_artist / reject_artist DB functions atomically.
// Falls back to direct table updates if RPC functions don't exist yet.
// After every action: invalidates React Query caches for instant UI refresh.

import { supabase } from '@/integrations/supabase/client';
import { invalidateRoleCache } from '@/contexts/AuthContext';
import type { QueryClient } from '@tanstack/react-query';

export interface ApprovalResult {
  success: boolean;
  message: string;
}

// ── Invalidate all relevant React Query caches after any approval action ───────
function invalidateAllCaches(qc?: QueryClient) {
  if (!qc) return;
  // Invalidate marketplace data
  qc.invalidateQueries({ queryKey: ['artists'] });
  qc.invalidateQueries({ queryKey: ['featured-artists'] });
  qc.invalidateQueries({ queryKey: ['categories'] });
  // Invalidate admin stats
  qc.invalidateQueries({ queryKey: ['admin-stats'] });
  qc.invalidateQueries({ queryKey: ['admin-artists'] });
}

// ── Approve artist ─────────────────────────────────────────────────────────────
export async function approveArtist(
  providerId: string,
  providerUserId: string,
  adminUserId: string,
  queryClient?: QueryClient
): Promise<ApprovalResult> {
  try {
    // Try the atomic DB function first (preferred — all-or-nothing)
    const { data: rpcResult, error: rpcErr } = await supabase
      .rpc('approve_artist' as any, {
        p_provider_profile_id: providerId,
        p_admin_user_id:       adminUserId,
      });

    if (!rpcErr && rpcResult) {
      const result = rpcResult as any;
      if (result.success === false) {
        return { success: false, message: result.message ?? 'Approval failed' };
      }
      // Bust role cache so provider role takes effect immediately
      invalidateRoleCache(providerUserId);
      invalidateAllCaches(queryClient);
      return { success: true, message: 'Artist approved successfully' };
    }

    // ── Fallback: direct table updates (if RPC not deployed yet) ─────────────
    console.warn('[approvalService] RPC unavailable, using direct updates:', rpcErr?.message);

    const now = new Date().toISOString();

    const { error: updateErr } = await supabase
      .from('provider_profiles')
      .update({
        verification_status: 'approved',
        is_published:        true,
        is_verified:         true,
        verified_at:         now,
        verified_by:         adminUserId,
        rejection_reason:    null,
      } as any)
      .eq('id', providerId);

    if (updateErr) throw updateErr;

    // Assign provider role
    const { error: roleErr } = await supabase
      .from('user_roles')
      .upsert(
        { user_id: providerUserId, role: 'provider' },
        { onConflict: 'user_id,role' }
      );
    if (roleErr) console.warn('[approvalService] role upsert:', roleErr.message);

    // Send notification
    const { error: notifErr } = await supabase
      .from('notifications' as any)
      .insert({
        user_id:      providerUserId,
        title:        'Congratulations! Your account is approved 🎉',
        message:      'Your Vowza artist profile has been successfully verified and is now live. ' +
                      'You can now edit your profile, set your packages and pricing, manage your availability, ' +
                      'and start receiving bookings from customers.',
        type:         'approval',
        reference_id: providerId,
        is_read:      false,
      });
    if (notifErr) console.warn('[approvalService] notification insert:', notifErr.message);

    // Admin audit log
    await supabase.from('notifications' as any).insert({
      user_id:      adminUserId,
      title:        'Artist Approved',
      message:      `You approved artist profile ${providerId} (user: ${providerUserId})`,
      type:         'admin_action',
      reference_id: providerId,
      is_read:      true,
    });

    invalidateRoleCache(providerUserId);
    invalidateAllCaches(queryClient);
    return { success: true, message: 'Artist approved successfully' };

  } catch (e: any) {
    console.error('[approvalService] approveArtist error:', e);
    return { success: false, message: e.message ?? 'Approval failed' };
  }
}

// ── Reject artist ──────────────────────────────────────────────────────────────
export async function rejectArtist(
  providerId: string,
  providerUserId: string,
  adminUserId: string,
  reason: string,
  queryClient?: QueryClient
): Promise<ApprovalResult> {
  if (!reason.trim()) {
    return { success: false, message: 'Rejection reason is required' };
  }

  try {
    // Try RPC first
    const { data: rpcResult, error: rpcErr } = await supabase
      .rpc('reject_artist' as any, {
        p_provider_profile_id: providerId,
        p_admin_user_id:       adminUserId,
        p_reason:              reason.trim(),
      });

    if (!rpcErr && rpcResult) {
      const result = rpcResult as any;
      if (result.success === false) {
        return { success: false, message: result.message ?? 'Rejection failed' };
      }
      invalidateAllCaches(queryClient);
      return { success: true, message: 'Artist rejected and notified' };
    }

    // Fallback: direct updates
    const now = new Date().toISOString();

    const { error: updateErr } = await supabase
      .from('provider_profiles')
      .update({
        verification_status: 'rejected',
        is_published:        false,
        is_verified:         false,
        rejection_reason:    reason.trim(),
        verified_at:         now,
        verified_by:         adminUserId,
      } as any)
      .eq('id', providerId);

    if (updateErr) throw updateErr;

    await supabase.from('user_roles').delete()
      .eq('user_id', providerUserId).eq('role', 'provider');

    await supabase.from('notifications' as any).insert({
      user_id:      providerUserId,
      title:        'Profile Review Update',
      message:      `Your Vowza profile requires attention. Reason: ${reason}. ` +
                    'Please update your profile and resubmit for verification from your dashboard.',
      type:         'rejection',
      reference_id: providerId,
      is_read:      false,
    });

    await supabase.from('notifications' as any).insert({
      user_id:      adminUserId,
      title:        'Artist Rejected',
      message:      `You rejected artist profile ${providerId}. Reason: ${reason}`,
      type:         'admin_action',
      reference_id: providerId,
      is_read:      true,
    });

    invalidateAllCaches(queryClient);
    return { success: true, message: 'Artist rejected and notified' };

  } catch (e: any) {
    console.error('[approvalService] rejectArtist error:', e);
    return { success: false, message: e.message ?? 'Rejection failed' };
  }
}

// ── Suspend artist ─────────────────────────────────────────────────────────────
export async function suspendArtist(
  providerId: string,
  providerUserId: string,
  adminUserId: string,
  reason: string,
  queryClient?: QueryClient
): Promise<ApprovalResult> {
  try {
    const { error } = await supabase
      .from('provider_profiles')
      .update({
        verification_status: 'suspended',
        is_published:        false,
        rejection_reason:    reason,
      } as any)
      .eq('id', providerId);

    if (error) throw error;

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
      message:      `You suspended artist profile ${providerId}. Reason: ${reason}`,
      type:         'admin_action',
      reference_id: providerId,
      is_read:      true,
    });

    invalidateAllCaches(queryClient);
    return { success: true, message: 'Artist suspended' };
  } catch (e: any) {
    return { success: false, message: e.message ?? 'Suspension failed' };
  }
}
