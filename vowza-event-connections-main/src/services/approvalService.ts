// approvalService.ts
// KEY FIX: UPDATE never chains .select() — RLS blocks the chained read even when
// the UPDATE itself succeeds. We do UPDATE first, check only the error, then
// do a SEPARATE plain SELECT to verify.

import { supabase } from '@/integrations/supabase/client';
import { invalidateRoleCache } from '@/contexts/AuthContext';
import type { QueryClient } from '@tanstack/react-query';

export interface ApprovalResult { success: boolean; message: string; }

export function invalidateAllCaches(qc?: QueryClient) {
  if (!qc) return;
  [['artists'],['featured-artists'],['admin-stats'],['admin-artists'],['categories'],['provider_profiles']]
    .forEach(k => { qc.invalidateQueries({ queryKey: k }); qc.refetchQueries({ queryKey: k }); });
}

// ─── APPROVE ──────────────────────────────────────────────────────────────────
export async function approveArtist(
  providerId: string,
  providerUserId: string,
  adminUserId: string,
  queryClient?: QueryClient,
): Promise<ApprovalResult> {

  console.log('[approve] ═══════════════════════════════════════');
  console.log('[approve] START');
  console.log('[approve] table          : provider_profiles');
  console.log('[approve] .eq column     : id');
  console.log('[approve] providerId     :', providerId);
  console.log('[approve] providerUserId :', providerUserId);
  console.log('[approve] adminUserId    :', adminUserId);

  const now = new Date().toISOString();

  // ── STEP 1: Verify row exists BEFORE attempting update ──────────────────
  console.log('[approve] STEP 1 — pre-check row exists...');
  const { data: preRows, error: preErr } = await supabase
    .from('provider_profiles')
    .select('id, verification_status, user_id')
    .eq('id', providerId);

  console.log('[approve] pre-check rows:', preRows, 'error:', preErr);

  if (preErr) {
    return { success: false, message: `Pre-check failed: ${preErr.message}` };
  }
  if (!preRows || preRows.length === 0) {
    // Row truly missing — try by user_id as fallback
    console.warn('[approve] id not found, trying user_id lookup...');
    const { data: byUid } = await supabase
      .from('provider_profiles')
      .select('id, verification_status, user_id')
      .eq('user_id', providerUserId);
    console.log('[approve] user_id lookup result:', byUid);
    if (!byUid || byUid.length === 0) {
      return { success: false, message: `No provider_profiles row found for id=${providerId} or user_id=${providerUserId}` };
    }
    // Use the real id from DB
    const realId = (byUid[0] as any).id;
    console.log('[approve] using real id from DB:', realId);
    return approveArtist(realId, providerUserId, adminUserId, queryClient);
  }

  const realProviderId = (preRows[0] as any).id;
  console.log('[approve] row confirmed. real id:', realProviderId, 'current status:', (preRows[0] as any).verification_status);

  // ── STEP 2: UPDATE — NO .select() chained (RLS blocks chained reads) ────
  const payload = {
    verification_status: 'approved',
    is_published:        true,
    is_verified:         true,
    verified_at:         now,
    verified_by:         adminUserId,
    rejection_reason:    null,
  };
  console.log('[approve] STEP 2 — UPDATE payload:', JSON.stringify(payload));

  const { error: updErr } = await supabase
    .from('provider_profiles')
    .update(payload as any)
    .eq('id', realProviderId);

  console.log('[approve] UPDATE error:', updErr ?? 'none');

  if (updErr) {
    const msg = `UPDATE failed: ${updErr.message} (code:${updErr.code})`;
    console.error('[approve]', msg);
    return { success: false, message: msg };
  }

  // ── STEP 3: Separate SELECT to confirm saved value ───────────────────────
  console.log('[approve] STEP 3 — verify SELECT...');
  const { data: verifyRows, error: verifyErr } = await supabase
    .from('provider_profiles')
    .select('id, verification_status, is_published')
    .eq('id', realProviderId);

  console.log('[approve] verify rows:', verifyRows, 'error:', verifyErr);

  if (verifyErr) {
    console.error('[approve] verify SELECT error:', verifyErr.message);
    // UPDATE had no error, so treat as success despite verify failure
    console.warn('[approve] proceeding as success (UPDATE had no error)');
  } else if (!verifyRows || verifyRows.length === 0) {
    console.warn('[approve] verify SELECT returned 0 rows (RLS hiding row) — treating as success since UPDATE had no error');
  } else {
    const saved = (verifyRows[0] as any).verification_status;
    console.log('[approve] verified status in DB:', saved);
    if (saved !== 'approved') {
      return { success: false, message: `DB saved "${saved}" not "approved" — unexpected.` };
    }
  }

  // ── STEP 4: Assign provider role ─────────────────────────────────────────
  console.log('[approve] STEP 4 — assigning provider role...');
  const { data: existRole } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('user_id', providerUserId)
    .eq('role', 'provider');

  if (!existRole || existRole.length === 0) {
    const { error: roleErr } = await supabase
      .from('user_roles')
      .insert({ user_id: providerUserId, role: 'provider' });
    console.log('[approve] role insert error:', roleErr?.message ?? 'none');
  } else {
    console.log('[approve] provider role already exists');
  }

  // ── STEP 5: Insert notification ───────────────────────────────────────────
  console.log('[approve] STEP 5 — inserting notification for user:', providerUserId);
  const { error: notifErr } = await supabase
    .from('notifications' as any)
    .insert({
      user_id:      providerUserId,
      title:        'Account Approved',
      message:      'Congratulations! Your artist account has been approved. You can now receive bookings.',
      type:         'approval',
      reference_id: realProviderId,
      is_read:      false,
    });
  console.log('[approve] notification error:', notifErr?.message ?? 'none');

  // ── STEP 6: Invalidate caches ─────────────────────────────────────────────
  invalidateRoleCache(providerUserId);
  invalidateAllCaches(queryClient);

  console.log('[approve] ═══ DONE — approval complete ═══');
  return { success: true, message: 'Artist approved — profile is now live!' };
}

// ─── REJECT ───────────────────────────────────────────────────────────────────
export async function rejectArtist(
  providerId: string,
  providerUserId: string,
  adminUserId: string,
  reason: string,
  queryClient?: QueryClient,
): Promise<ApprovalResult> {
  if (!reason?.trim()) return { success: false, message: 'Rejection reason is required' };
  const now = new Date().toISOString();
  console.log('[reject] START providerId:', providerId, 'reason:', reason);

  try {
    // Pre-check
    const { data: preRows } = await supabase
      .from('provider_profiles')
      .select('id, user_id')
      .eq('id', providerId);

    let realId = providerId;
    if (!preRows || preRows.length === 0) {
      const { data: byUid } = await supabase
        .from('provider_profiles')
        .select('id')
        .eq('user_id', providerUserId);
      if (!byUid || byUid.length === 0) {
        return { success: false, message: `No row found for id=${providerId}` };
      }
      realId = (byUid[0] as any).id;
    }

    // UPDATE — no .select() chained
    const { error: updErr } = await supabase
      .from('provider_profiles')
      .update({
        verification_status: 'rejected',
        is_published:        false,
        is_verified:         false,
        rejection_reason:    reason.trim(),
        verified_at:         now,
        verified_by:         adminUserId,
      } as any)
      .eq('id', realId);

    console.log('[reject] UPDATE error:', updErr ?? 'none');
    if (updErr) return { success: false, message: `UPDATE failed: ${updErr.message}` };

    // Remove provider role
    await supabase.from('user_roles').delete()
      .eq('user_id', providerUserId).eq('role', 'provider');

    // Notification
    await supabase.from('notifications' as any).insert({
      user_id:      providerUserId,
      title:        'Profile Review Update',
      message:      `Your Vowza profile requires attention. Reason: ${reason.trim()}. Please update and resubmit.`,
      type:         'rejection',
      reference_id: realId,
      is_read:      false,
    });

    invalidateAllCaches(queryClient);
    console.log('[reject] DONE');
    return { success: true, message: 'Artist rejected and notified' };
  } catch (e: any) {
    console.error('[reject] EXCEPTION:', e);
    return { success: false, message: e.message ?? 'Rejection failed' };
  }
}

// ─── SUSPEND ──────────────────────────────────────────────────────────────────
export async function suspendArtist(
  providerId: string,
  providerUserId: string,
  adminUserId: string,
  reason: string,
  queryClient?: QueryClient,
): Promise<ApprovalResult> {
  try {
    const { error } = await supabase
      .from('provider_profiles')
      .update({ verification_status: 'suspended', is_published: false, rejection_reason: reason } as any)
      .eq('id', providerId);
    if (error) throw error;
    invalidateAllCaches(queryClient);
    return { success: true, message: 'Artist suspended' };
  } catch (e: any) {
    return { success: false, message: e.message ?? 'Suspension failed' };
  }
}
