// ─── Admin Management ─────────────────────────────────────────────────────────
// Role changes happen through the admin-user-roles Edge Function, never through
// the browser's Supabase client. Migration 20261201000002 revoked INSERT/UPDATE/
// DELETE on public.user_roles from anon and authenticated, so the previous
// implementation here — supabase.from('user_roles').insert(...) — cannot work
// and should not: it resolved its target through profiles.email, a column the
// target user writes themselves.
//
// The listing likewise goes through admin_list_admins(), a super_admin-gated
// SECURITY DEFINER function, rather than three client queries against
// user_roles and profiles. That returns auth.users.email instead of the
// self-declared profiles.email, and removes this page from the set of call
// sites that read user_roles from the browser.
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Shield, Plus, Trash2, RefreshCw } from 'lucide-react';

type AdminRow = {
  user_id: string;
  role: string;
  full_name: string | null;
  email: string | null;
};

type RoleActionResult = {
  success: boolean;
  code?: string;
  message?: string;
};

// src/integrations/supabase/types.ts was generated before these functions
// existed, so supabase.rpc() does not know their names. Regenerating types is a
// separate change (it rewrites thousands of lines and should not ride along with
// a security fix), so the two new RPCs go through this narrow cast rather than
// widening the whole client to `any`.
const rpc = supabase.rpc.bind(supabase) as unknown as (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

// supabase-js reports any non-2xx from an Edge Function as a generic
// "non-2xx status code" error and puts the real body on error.context, which is
// a Response and can only be read once — hence clone(). Without this the
// function's specific messages ("That account is a super admin…") are all
// flattened into one useless string.
//
// The same helper exists privately in src/services/bookingExecutionService.ts.
// Worth extracting to a shared module, but not in this change.
async function resultFromInvokeError(error: unknown): Promise<RoleActionResult | null> {
  const context = typeof error === 'object' && error !== null
    ? (error as { context?: unknown }).context
    : undefined;

  if (!context || typeof (context as { clone?: unknown }).clone !== 'function') return null;

  try {
    const payload = await (context as Response).clone().json();
    if (typeof payload !== 'object' || payload === null) return null;
    const body = payload as Record<string, unknown>;
    return {
      success: body.success === true,
      code: typeof body.code === 'string' ? body.code : undefined,
      message: typeof body.message === 'string' ? body.message : undefined,
    };
  } catch {
    return null;
  }
}

async function setRole(body: {
  action: 'grant' | 'revoke';
  role: 'admin';
  email?: string;
  userId?: string;
}): Promise<RoleActionResult> {
  const { data, error } = await supabase.functions.invoke('admin-user-roles', { body });

  if (error) {
    return (await resultFromInvokeError(error)) ?? {
      success: false,
      code: 'NETWORK_OR_SERVER_FAILURE',
      message: 'Could not reach the server. Please try again.',
    };
  }

  return (data ?? { success: false, message: 'Unexpected empty response.' }) as RoleActionResult;
}

export default function AdminAdmins() {
  const { user, isSuperAdmin, rolesLoaded } = useAuth();
  const [admins, setAdmins]   = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [email, setEmail]     = useState('');
  const [adding, setAdding]   = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      // One round trip. Returns zero rows for anyone who is not a super_admin,
      // so the server's answer and the guard below cannot disagree.
      const { data, error } = await rpc('admin_list_admins');
      if (error) throw new Error(error.message);
      setAdmins((data ?? []) as AdminRow[]);
      setLoadFailed(false);
    } catch (e: unknown) {
      // Clearing the list matters. Leaving the previous one rendered means the
      // count in the header and every delete button beside it are assertions
      // about server state this page just failed to read — and after a
      // successful revoke followed by a failed reload, the removed admin would
      // still be listed under a "Admin removed" toast.
      console.error('[AdminAdmins] load failed:', e);
      setAdmins([]);
      setLoadFailed(true);
      toast.error('Could not load the admin list.');
    } finally {
      setLoading(false);
    }
  };

  // Waits for the session to be established. Calling the RPC before then sends
  // an anonymous request, which returns zero rows and looks like "no admins".
  useEffect(() => {
    if (rolesLoaded && isSuperAdmin) load();
    else if (rolesLoaded) setLoading(false);
  }, [rolesLoaded, isSuperAdmin]);

  const addAdmin = async () => {
    const target = email.trim().toLowerCase();
    if (!target) { toast.error('Enter an email address'); return; }
    setAdding(true);
    try {
      const result = await setRole({ action: 'grant', role: 'admin', email: target });
      if (!result.success) {
        toast.error(result.message ?? 'Could not add that admin.');
        return;
      }
      if (result.code === 'NO_CHANGE') {
        toast.info(result.message ?? 'That user is already an admin.');
      } else {
        toast.success('Admin added');
      }
      setEmail('');
      await load();
    } finally {
      setAdding(false);
    }
  };

  // Keyed on user_id, not email. The list shows an email for the operator's
  // benefit; the action must not depend on it.
  const remove = async (userId: string, role: string) => {
    if (role === 'super_admin') { toast.error('Super Admin cannot be removed'); return; }
    if (userId === user?.id) { toast.error('Cannot remove yourself'); return; }
    if (!confirm('Remove admin access?')) return;

    setRemoving(userId);
    try {
      const result = await setRole({ action: 'revoke', role: 'admin', userId });
      // The previous version reported success unconditionally, without even
      // checking for an error — so a silently failing revoke looked like it
      // had worked.
      if (!result.success) {
        toast.error(result.message ?? 'Could not remove that admin.');
        return;
      }
      // NO_CHANGE means the row was already gone — a no-op, not a success.
      if (result.code === 'NO_CHANGE') toast.info('That user was not an admin.');
      else toast.success('Admin removed');
      await load();
    } finally {
      setRemoving(null);
    }
  };

  // Access control. This sits below every hook on purpose: isSuperAdmin starts
  // false and flips to true once roles resolve, so returning early above the
  // useEffect above changed the hook count between renders and tripped React's
  // "rendered more hooks than during the previous render".
  //
  // This is a UI guard only. The real gate is admin_set_user_role, which
  // requires super_admin server-side and audits every refusal.
  if (!rolesLoaded) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-14 rounded" />)}
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <h2 className="text-lg font-bold text-foreground">Access Denied</h2>
          <p className="text-sm text-muted-foreground max-w-sm">You do not have permission to manage administrators. Only the Super Admin can access this section.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-display font-bold text-foreground">Admin Management</h1><p className="text-sm text-muted-foreground">{loadFailed ? 'List unavailable' : `${admins.length} admin accounts`}</p></div>
        <button onClick={load} className="p-2 rounded-lg border border-border hover:bg-secondary text-muted-foreground"><RefreshCw className="w-4 h-4"/></button>
      </div>

      {/* Add admin */}
      <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-5 space-y-3">
        <h3 className="font-semibold text-foreground flex items-center gap-2"><Plus className="w-4 h-4"/>Invite Admin</h3>
        <p className="text-xs text-muted-foreground">The user must already have a Vowza account, and the email must match the one they signed up with.</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key==='Enter'&&!adding&&addAdmin()} placeholder="admin@example.com" className="input-premium text-sm flex-1" />
          <button onClick={addAdmin} disabled={adding} className="px-5 py-2.5 rounded-xl bg-maroon text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex-shrink-0">
            {adding ? 'Adding…' : 'Add Admin'}
          </button>
        </div>
      </div>

      {/* Admin list */}
      <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">{Array.from({length:3}).map((_,i)=><div key={i} className="skeleton h-14 rounded"/>)}</div>
        ) : loadFailed ? (
          <div className="text-center py-12 space-y-3">
            <Shield className="w-10 h-10 mx-auto text-muted-foreground/30"/>
            <p className="text-sm text-muted-foreground">The admin list could not be loaded, so it is not being shown.</p>
            <button onClick={load} className="px-4 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-secondary">Try again</button>
          </div>
        ) : admins.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground"><Shield className="w-10 h-10 mx-auto mb-3 opacity-30"/><p className="text-sm">No admins found</p></div>
        ) : (
          <div className="divide-y divide-border/40">
            {admins.map((a) => (
              <div key={a.user_id} className="flex flex-col items-start gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-maroon flex items-center justify-center">
                    <span className="text-sm font-bold text-white">{(a.full_name||a.email||'A').charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{a.full_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{a.email || a.user_id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${a.role === 'super_admin' ? 'bg-purple-100 text-purple-700' : 'bg-maroon/10 text-maroon'}`}>{a.role === 'super_admin' ? 'Super Admin' : 'Admin'}</span>
                  {a.role === 'super_admin' ? (
                    <span className="text-[10px] font-medium text-muted-foreground">Protected</span>
                  ) : a.user_id !== user?.id ? (
                    <button onClick={() => remove(a.user_id, a.role)} disabled={removing === a.user_id} className="p-2 rounded-lg hover:bg-red-50 text-red-500 disabled:opacity-40"><Trash2 className="w-4 h-4"/></button>
                  ) : (
                    <span className="text-[10px] text-muted-foreground px-2">You</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
