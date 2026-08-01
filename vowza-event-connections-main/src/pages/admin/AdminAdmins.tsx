// ─── Admin Management ─────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Shield, Plus, Trash2, RefreshCw, User } from 'lucide-react';

export default function AdminAdmins() {
  const { user } = useAuth();
  const [admins, setAdmins]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail]     = useState('');
  const [adding, setAdding]   = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: roles } = await supabase.from('user_roles').select('user_id, role, created_at').eq('role', 'admin');
      if (!roles?.length) { setAdmins([]); setLoading(false); return; }
      const ids = roles.map((r: any) => r.user_id);
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').in('id', ids);
      const pm = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      setAdmins(roles.map((r: any) => ({ ...r, ...(pm.get(r.user_id) ?? {}) })));
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const addAdmin = async () => {
    if (!email.trim()) { toast.error('Enter email'); return; }
    setAdding(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('id').eq('email', email.trim().toLowerCase()).maybeSingle();
      if (!profile) { toast.error('User not found. They must sign up first.'); setAdding(false); return; }
      const { error } = await supabase.from('user_roles').insert({ user_id: profile.id, role: 'admin' });
      if (error?.code === '23505') { toast.error('User is already an admin'); }
      else if (error) throw error;
      else { toast.success('Admin added'); setEmail(''); load(); }
    } catch (e: any) { toast.error(e.message); }
    finally { setAdding(false); }
  };

  const remove = async (userId: string) => {
    if (userId === user?.id) { toast.error('Cannot remove yourself'); return; }
    if (!confirm('Remove admin access?')) return;
    await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'admin');
    toast.success('Admin removed'); load();
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-display font-bold text-foreground">Admin Management</h1><p className="text-sm text-muted-foreground">{admins.length} admin accounts</p></div>
        <button onClick={load} className="p-2 rounded-lg border border-border hover:bg-secondary text-muted-foreground"><RefreshCw className="w-4 h-4"/></button>
      </div>

      {/* Add admin */}
      <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-5 space-y-3">
        <h3 className="font-semibold text-foreground flex items-center gap-2"><Plus className="w-4 h-4"/>Invite Admin</h3>
        <p className="text-xs text-muted-foreground">The user must already have a Vowza account.</p>
        <div className="flex gap-3">
          <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key==='Enter'&&addAdmin()} placeholder="admin@example.com" className="input-premium text-sm flex-1" />
          <button onClick={addAdmin} disabled={adding} className="px-5 py-2.5 rounded-xl bg-maroon text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex-shrink-0">
            {adding ? 'Adding…' : 'Add Admin'}
          </button>
        </div>
      </div>

      {/* Admin list */}
      <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">{Array.from({length:3}).map((_,i)=><div key={i} className="skeleton h-14 rounded"/>)}</div>
        ) : admins.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground"><Shield className="w-10 h-10 mx-auto mb-3 opacity-30"/><p className="text-sm">No admins found</p></div>
        ) : (
          <div className="divide-y divide-border/40">
            {admins.map((a: any) => (
              <div key={a.user_id} className="flex items-center justify-between px-5 py-4">
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
                  <span className="text-[10px] font-bold bg-maroon/10 text-maroon px-2.5 py-1 rounded-full">Super Admin</span>
                  {a.user_id !== user?.id ? (
                    <button onClick={() => remove(a.user_id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4"/></button>
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
