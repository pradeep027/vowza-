/**
 * Role grant / revoke helpers for public.user_roles.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Six call sites wrote user_roles directly and four discarded the result, so a
 * failed role write produced a success toast. Migration 20261201000002 makes
 * that far worse in two specific ways, and both are why this module exists.
 *
 * 1. UPDATE IS NO LONGER GRANTED, SO `upsert` FAILS.
 *
 *    20261201000002 does:
 *        REVOKE ALL ON TABLE public.user_roles FROM PUBLIC, anon, authenticated;
 *        GRANT SELECT, INSERT, DELETE ON TABLE public.user_roles TO authenticated;
 *
 *    UPDATE is withheld deliberately: UPDATE on this table is the privilege
 *    escalation primitive. With it, a user with a `customer` row can rewrite
 *    that row's `role` to `admin` -- one statement, no INSERT needed.
 *
 *    But PostgreSQL requires the UPDATE privilege for `INSERT ... ON CONFLICT
 *    DO UPDATE`, and supabase-js `.upsert(row, { onConflict })` compiles to
 *    exactly that. So all four upsert call sites -- AuthContext (seeds the
 *    customer role for every new signup), ProviderRegistration (the vendor KYC
 *    path), adminVerification and AdminDashboard -- would start returning
 *    42501 permission denied the moment that migration lands.
 *
 *    Granting UPDATE to fix it would reopen the exact hole the migration
 *    closes. The real answer is that the upsert was never needed: a user_roles
 *    row is nothing but its own key, `(user_id, role)`. There is no payload to
 *    update, so ON CONFLICT DO UPDATE is a no-op by construction. What every
 *    call site actually wants is insert-if-absent, which needs only INSERT.
 *    That is what grantRole does, treating 23505 (unique violation) as success.
 *
 * 2. A REFUSED DELETE RETURNS NO ERROR.
 *
 *    The new DELETE policy is
 *        role IN ('customer','provider')
 *        AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
 *    -- note there is no self-delete branch. When a policy's USING clause
 *    excludes a row, DELETE does not raise; it simply matches nothing and
 *    reports success. So `await supabase.from('user_roles').delete()...` is
 *    indistinguishable from a delete that was silently refused.
 *
 *    revokeRole therefore chains .select() to count what was actually removed
 *    and reports zero rows as a failure rather than as success.
 *
 * WHAT THIS MODULE IS NOT
 * -----------------------
 * Not an authorization layer. The database decides: `user_roles_insert_
 * unprivileged` permits only the `customer` and `provider` roles, and only for
 * your own user_id unless you hold admin or super_admin. Nothing here can widen
 * that, and nothing here should try to pre-empt it -- the point is to report the
 * database's answer faithfully instead of dropping it.
 *
 * The `admin` role is deliberately NOT grantable through this module. It goes
 * through the admin-user-roles Edge Function and public.admin_set_user_role,
 * which authorizes on super_admin and writes an audit row in the same
 * transaction as the mutation. See docs/ROLE_MANAGEMENT.md.
 */

import { supabase } from '@/integrations/supabase/client';

/**
 * The only roles writable from the browser, matching the
 * `role IN ('customer','provider')` term in both new policies.
 * `admin` and `super_admin` are absent on purpose -- see the note above.
 */
export type SelfServiceRole = 'customer' | 'provider';

export type RoleWriteResult =
  | { ok: true; changed: boolean }
  | { ok: false; code: string; message: string };

/** Postgres unique violation -- the role row already exists. */
const UNIQUE_VIOLATION = '23505';
/** Postgres insufficient privilege, and PostgREST's code for an RLS refusal. */
const INSUFFICIENT_PRIVILEGE = '42501';

function describe(code: string, fallback: string, role: string): string {
  if (code === INSUFFICIENT_PRIVILEGE) {
    return `Not permitted to change the "${role}" role. Sign out and back in; if it persists, an administrator needs to do this.`;
  }
  return fallback || 'The role could not be updated.';
}

/**
 * Ensure `userId` holds `role`. Idempotent.
 *
 * Uses .insert(), NOT .upsert() -- upsert needs the UPDATE privilege, which
 * authenticated does not have. See the header.
 *
 * Returns `{ ok: true, changed: false }` when the row already existed, which is
 * a success: the caller's goal is that the role be present, not that it be new.
 */
export async function grantRole(
  userId: string,
  role: SelfServiceRole,
): Promise<RoleWriteResult> {
  if (!userId) {
    return { ok: false, code: 'NO_USER', message: 'No user id supplied for the role grant.' };
  }

  const { error } = await supabase
    .from('user_roles')
    .insert({ user_id: userId, role: role as any });

  if (!error) return { ok: true, changed: true };

  // Already present. Either it was there before, or a concurrent call won the
  // race -- the unique index on (user_id, role) is what makes this safe, and
  // it is the same guarantee the old onConflict clause was reaching for.
  if (error.code === UNIQUE_VIOLATION) return { ok: true, changed: false };

  console.error('[userRoles] grant failed role=%s code=%s msg=%s', role, error.code ?? '', error.message);
  return {
    ok: false,
    code: error.code ?? 'UNKNOWN',
    message: describe(error.code ?? '', error.message, role),
  };
}

/**
 * Remove `role` from `userId`. Requires admin or super_admin -- there is no
 * self-revoke policy.
 *
 * Chains .select() because a policy-refused DELETE matches zero rows WITHOUT
 * raising, so the row count is the only signal that it was refused.
 */
export async function revokeRole(
  userId: string,
  role: SelfServiceRole,
): Promise<RoleWriteResult> {
  if (!userId) {
    return { ok: false, code: 'NO_USER', message: 'No user id supplied for the role revoke.' };
  }

  const { data, error } = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', userId)
    .eq('role', role as any)
    .select('user_id');

  if (error) {
    console.error('[userRoles] revoke failed role=%s code=%s msg=%s', role, error.code ?? '', error.message);
    return {
      ok: false,
      code: error.code ?? 'UNKNOWN',
      message: describe(error.code ?? '', error.message, role),
    };
  }

  // Nothing removed. Either the role was not held (fine, the desired end state
  // already holds) or the policy refused us (not fine). Ask, to tell them apart.
  //
  // Limit of this check, stated precisely: it distinguishes the two cases for an
  // admin or super_admin caller, because user_roles_select_admin makes the row
  // visible to them, so a surviving row proves refusal. For a caller who is
  // NEITHER admin nor the row's owner, the DELETE and this count are blind for
  // the same reason, and a refusal is indistinguishable from "not held" -- such
  // a caller gets ok/changed:false. That is not a privilege leak (nothing was
  // granted or removed), and the only caller of revokeRole is the admin-gated
  // rejection flow, but do not read a `changed:false` here as proof the role is
  // absent unless the caller is an admin.
  if (!data || data.length === 0) {
    const { count } = await supabase
      .from('user_roles')
      .select('user_id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('role', role as any);

    if ((count ?? 0) > 0) {
      return {
        ok: false,
        code: 'REFUSED',
        message: `The "${role}" role could not be removed. This account may not have permission to change roles.`,
      };
    }
    return { ok: true, changed: false };
  }

  return { ok: true, changed: true };
}

/**
 * Acquire the `provider` role for the CURRENT user, via the
 * public.claim_provider_role() RPC added in migration 20261201000007.
 *
 * WHY THIS EXISTS RATHER THAN grantRole(id, 'provider')
 * ----------------------------------------------------
 * grantRole works today only because `user_roles_insert_unprivileged` allows
 * `user_id = auth.uid()` for both 'customer' AND 'provider'. That means any
 * authenticated account can self-grant `provider` with no provider_profiles
 * row, no KYC documents, no admin involvement and no audit trail -- one POST to
 * /rest/v1/user_roles is enough.
 *
 * The RPC closes that. It is SECURITY DEFINER, takes NO arguments (the subject
 * is always auth.uid(), so it cannot be aimed at another account), refuses
 * unless a provider_profiles row already exists for the caller, and writes a
 * vowza_audit.privileged_actions row on every outcome including the denials.
 *
 * Migration Phase C then narrows the policy so the direct insert stops working.
 *
 * ON THE FALLBACK
 * ---------------
 * If the RPC is not in PostgREST's schema cache -- i.e. this bundle reached
 * users before migration 000007 was applied -- this falls back to the direct
 * insert. That is deliberate, and it is safe at every point in the sequence:
 *
 *   before Phase A: the RPC is absent, the policy still permits the insert, so
 *                   the fallback is the only thing that works.
 *   after  Phase A: the RPC answers, so the fallback is never reached.
 *   after  Phase C: if the RPC were somehow missing, the policy now refuses the
 *                   insert, so the fallback fails and reports 42501 honestly.
 *
 * So the fallback removes a deploy-ordering hazard without ever widening what
 * the database permits. It cannot mask a genuine denial: a NO_PROVIDER_PROFILE
 * or NO_SESSION answer from the RPC is the gate working, and is returned as a
 * failure rather than retried.
 *
 * @param userId Used ONLY for the fallback insert and for log lines. It is NOT
 *   sent to the RPC -- the server derives the subject from the JWT, which is
 *   the whole point. Passing someone else's id here cannot grant them anything.
 */
export async function claimProviderRole(userId: string): Promise<RoleWriteResult> {
  // Cast: types.ts has not been regenerated since 000007 added this function,
  // so the generated Database['public']['Functions'] union does not list it yet.
  const { data, error } = await supabase.rpc('claim_provider_role' as any);

  if (error) {
    const missing =
      error.code === 'PGRST202' ||
      /could not find the function|does not exist/i.test(error.message ?? '');

    if (missing) {
      console.warn(
        '[userRoles] claim_provider_role() is not available yet (%s); falling back to a direct insert. ' +
          'This is expected only in the window before migration 20261201000007 is applied.',
        error.code ?? 'no code',
      );
      return grantRole(userId, 'provider');
    }

    console.error('[userRoles] claim_provider_role failed code=%s msg=%s', error.code ?? '', error.message);
    return {
      ok: false,
      code: error.code ?? 'UNKNOWN',
      message: describe(error.code ?? '', error.message, 'provider'),
    };
  }

  // The function returns jsonb: {ok:true, changed:bool} or {ok:false, code:...}.
  const payload = data as { ok?: unknown; code?: unknown; changed?: unknown } | null;

  if (!payload || typeof payload.ok !== 'boolean') {
    console.error('[userRoles] claim_provider_role returned an unexpected shape:', payload);
    return {
      ok: false,
      code: 'BAD_RESPONSE',
      message: 'The server gave an unexpected answer while enabling your dashboard access.',
    };
  }

  if (payload.ok) return { ok: true, changed: payload.changed === true };

  const code = typeof payload.code === 'string' ? payload.code : 'DENIED';
  console.error('[userRoles] claim_provider_role denied code=%s', code);
  return { ok: false, code, message: describeClaimDenial(code) };
}

/** Messages for the RPC's own refusal codes, which are not Postgres SQLSTATEs. */
function describeClaimDenial(code: string): string {
  switch (code) {
    case 'NO_SESSION':
      return 'Your session has expired. Please sign in again to finish setting up your dashboard.';
    case 'NO_PROVIDER_PROFILE':
      return 'We could not find your vendor profile, so dashboard access was not enabled. Our team will complete this during review.';
    default:
      return 'Dashboard access could not be enabled. Our team will complete this during review.';
  }
}
