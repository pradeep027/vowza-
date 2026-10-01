// approvalService.ts
// KEY FIX: UPDATE never chains .select() — RLS blocks the chained read even when
// the UPDATE itself succeeds. We do UPDATE first, check only the error, then
// do a SEPARATE plain SELECT to verify.

import { supabase } from '@/integrations/supabase/client';
import { invalidateRoleCache } from '@/contexts/AuthContext';
import { grantRole, revokeRole } from '@/lib/userRoles';
import type { QueryClient } from '@tanstack/react-query';

export interface ApprovalResult { success: boolean; message: string; }

export function invalidateAllCaches(qc?: QueryClient) {
  if (!qc) return;
  [['artists'],['admin-stats'],['admin-artists'],['categories'],['provider_profiles']]
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

  // ── STEP 2: Route the protected-column write through the hardened RPC ────
  //
  // Direct UPDATE of the verification/approval columns is being revoked from
  // `authenticated` (see supabase/migrations-pending/PHASE_provider_column_lockdown.sql).
  // admin_set_provider_verification is SECURITY DEFINER, derives the acting
  // admin from auth.uid() (never a client-supplied id), enforces
  // has_role(admin|super_admin) server-side, sets verified_by to the caller,
  // and audits the action. adminUserId is therefore no longer sent from the
  // client.
  console.log('[approve] STEP 2 — calling admin_set_provider_verification RPC...');

  const { data: rpcData, error: rpcErr } = await supabase.rpc(
    'admin_set_provider_verification' as any,
    { p_provider_id: realProviderId, p_action: 'approve' },
  );
  const rpcRes = rpcData as { success?: boolean; code?: string; message?: string } | null;
  console.log('[approve] RPC error:', rpcErr ?? 'none', 'result:', rpcRes);

  if (rpcErr) {
    const msg = `Approval RPC failed: ${rpcErr.message} (code:${rpcErr.code})`;
    console.error('[approve]', msg);
    return { success: false, message: msg };
  }
  if (!rpcRes?.success) {
    return { success: false, message: rpcRes?.message ?? 'The server refused the approval.' };
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
  //
  // This step is load-bearing, not cosmetic. The UPDATE above has already set
  // verification_status='approved' and is_published=true, so the vendor's
  // listing is LIVE. If the role write fails and we report success anyway, the
  // result is a published vendor who cannot reach their own dashboard, and an
  // admin who was told everything worked. That is the worst of the three
  // possible outcomes, so it gets reported.
  //
  // grantRole() is idempotent (23505 => ok), which replaces the previous
  // select-then-insert. That pattern was also a race: two admins approving the
  // same vendor could both read zero rows and both insert.
  console.log('[approve] STEP 4 — assigning provider role...');
  const roleResult = await grantRole(providerUserId, 'provider');
  if (!roleResult.ok) {
    console.error('[approve] role grant FAILED:', roleResult.code, roleResult.message);
    invalidateRoleCache(providerUserId);
    invalidateAllCaches(queryClient);
    return {
      success: false,
      message:
        `The profile was approved and is now live, but assigning the provider role failed ` +
        `(${roleResult.code}). The vendor cannot access their dashboard until this is fixed. ` +
        `Re-run the approval, or grant the role from user management.`,
    };
  }
  console.log('[approve] role grant ok, newly created:', roleResult.changed);

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

    // Route the protected-column write through the hardened RPC (see
    // approveArtist STEP 2 and PHASE_provider_column_lockdown.sql). The RPC
    // derives the admin from auth.uid(), enforces has_role server-side, records
    // verified_by / verified_at itself, and audits the action.
    const { data: rpcData, error: rpcErr } = await supabase.rpc(
      'admin_set_provider_verification' as any,
      { p_provider_id: realId, p_action: 'reject', p_reason: reason.trim() },
    );
    const rpcRes = rpcData as { success?: boolean; code?: string; message?: string } | null;
    console.log('[reject] RPC error:', rpcErr ?? 'none', 'result:', rpcRes);
    if (rpcErr) return { success: false, message: `Rejection RPC failed: ${rpcErr.message}` };
    if (!rpcRes?.success) return { success: false, message: rpcRes?.message ?? 'The server refused the rejection.' };

    // Remove provider role.
    //
    // revokeRole() checks the affected row count, because a DELETE refused by
    // the RLS policy matches zero rows WITHOUT raising -- the bare
    // .delete().eq().eq() this replaces could not tell "removed" from "refused".
    // A role that was never held returns ok/changed:false, so this cannot
    // false-alarm on a vendor who had no provider row.
    const roleResult = await revokeRole(providerUserId, 'provider');
    if (!roleResult.ok) {
      console.error('[reject] role revoke FAILED:', roleResult.code, roleResult.message);
      invalidateRoleCache(providerUserId);
      invalidateAllCaches(queryClient);
      return {
        success: false,
        message:
          `The profile was rejected and unpublished, but removing the provider role failed ` +
          `(${roleResult.code}). The vendor retains dashboard access. Re-run the rejection, ` +
          `or remove the role from user management.`,
      };
    }

    // Notification
    await supabase.from('notifications' as any).insert({
      user_id:      providerUserId,
      title:        'Profile Review Update',
      message:      `Your Vowza profile requires attention. Reason: ${reason.trim()}. Please update and resubmit.`,
      type:         'rejection',
      reference_id: realId,
      is_read:      false,
    });

    // The provider role was just removed, so the cached role set for this user
    // is stale. approveArtist() already did this; reject was missing it, which
    // left the revoked role live in cache.
    invalidateRoleCache(providerUserId);
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
    // Suspension flips verification_status='suspended' and unpublishes; route
    // it through the same hardened, audited RPC as approve/reject.
    const { data: rpcData, error } = await supabase.rpc(
      'admin_set_provider_verification' as any,
      { p_provider_id: providerId, p_action: 'suspend', p_reason: reason },
    );
    if (error) throw error;
    const rpcRes = rpcData as { success?: boolean; message?: string } | null;
    if (!rpcRes?.success) return { success: false, message: rpcRes?.message ?? 'The server refused the suspension.' };
    invalidateAllCaches(queryClient);
    return { success: true, message: 'Artist suspended' };
  } catch (e: any) {
    return { success: false, message: e.message ?? 'Suspension failed' };
  }
}
