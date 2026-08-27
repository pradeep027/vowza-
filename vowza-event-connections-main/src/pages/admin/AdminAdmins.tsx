import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Shield, Plus, Trash2, RefreshCw } from 'lucide-react';

type AdminRecord = {
  user_id: string;
  role: 'admin' | 'super_admin';
  full_name: string | null;
  email: string | null;
};

type RoleOperationResult = { success?: boolean; code?: string; message?: string };

export default function AdminAdmins() {
  const { user, isSuperAdmin } = useAuth();
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-user-roles', {
        body: { operation: 'list' },
      });
      if (error) throw error;
      setAdmins((data?.admins ?? []) as AdminRecord[]);
    } catch (error) {
      console.error('[AdminAdmins] Failed to load administrators:', error);
      toast.error('Unable to load administrators');
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const addAdmin = async () => {
    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes('@')) {
      toast.error('Enter a valid email address');
      return;
    }
    setAdding(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-user-roles', {
        body: { operation: 'grant', targetEmail },
      });
      if (error) throw error;
      const result = data as RoleOperationResult | null;
      if (!result?.success) {
        toast.error(result?.message || 'Unable to add admin');
        return;
      }
      toast.success('Admin added');
      setEmail('');
      await load();
    } catch (error) {
      console.error('[AdminAdmins] Failed to add administrator:', error);
      toast.error('Unable to add admin');
    } finally {
      setAdding(false);
    }
  };

  const remove = async (userId: string, role: AdminRecord['role']) => {
    if (role === 'super_admin') {
      toast.error('Super Admin cannot be removed');
      return;
    }
    if (userId === user?.id) {
      toast.error('Cannot remove yourself');
      return;
    }
    if (!window.confirm('Remove admin access?')) return;

    try {
      const { data, error } = await supabase.functions.invoke('admin-user-roles', {
        body: { operation: 'revoke', targetId: userId },
      });
      if (error) throw error;
      const result = data as RoleOperationResult | null;
      if (!result?.success) {
        toast.error(result?.message || 'Unable to remove admin');
        return;
      }
      toast.success('Admin removed');
      await load();
    } catch (error) {
      console.error('[AdminAdmins] Failed to remove administrator:', error);
      toast.error('Unable to remove admin');
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto" aria-hidden="true" />
          <h2 className="text-lg font-bold text-foreground">Access Denied</h2>
          <p className="text-sm text-muted-foreground max-w-sm">You do not have permission to manage administrators. Only the Super Admin can access this section.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Admin Management</h1>
          <p className="text-sm text-muted-foreground">{admins.length} admin accounts</p>
        </div>
        <button type="button" onClick={() => void load()} aria-label="Refresh administrator list" className="p-2 rounded-lg border border-border hover:bg-secondary text-muted-foreground">
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-5 space-y-3">
        <h3 className="font-semibold text-foreground flex items-center gap-2"><Plus className="w-4 h-4" aria-hidden="true" />Invite Admin</h3>
        <p className="text-xs text-muted-foreground">The user must already have a Vowza account.</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label htmlFor="admin-email" className="sr-only">Administrator email address</label>
          <input id="admin-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void addAdmin(); }} placeholder="admin@example.com" className="input-premium text-sm flex-1" />
          <button type="button" onClick={() => void addAdmin()} disabled={adding} className="px-5 py-2.5 rounded-xl bg-maroon text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex-shrink-0">
            {adding ? 'Adding…' : 'Add Admin'}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="skeleton h-14 rounded" />)}</div>
        ) : admins.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground"><Shield className="w-10 h-10 mx-auto mb-3 opacity-30" aria-hidden="true" /><p className="text-sm">No admins found</p></div>
        ) : (
          <div className="divide-y divide-border/40">
            {admins.map((admin) => (
              <div key={admin.user_id} className="flex flex-col items-start gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-maroon flex items-center justify-center" aria-hidden="true">
                    <span className="text-sm font-bold text-white">{(admin.full_name || admin.email || 'A').charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{admin.full_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{admin.email || admin.user_id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${admin.role === 'super_admin' ? 'bg-purple-100 text-purple-700' : 'bg-maroon/10 text-maroon'}`}>{admin.role === 'super_admin' ? 'Super Admin' : 'Admin'}</span>
                  {admin.role === 'super_admin' ? (
                    <span className="text-[10px] font-medium text-muted-foreground">Protected</span>
                  ) : admin.user_id !== user?.id ? (
                    <button type="button" onClick={() => void remove(admin.user_id, admin.role)} aria-label={`Remove admin access for ${admin.email || admin.full_name || admin.user_id}`} className="p-2 rounded-lg hover:bg-red-50 text-red-500">
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
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
