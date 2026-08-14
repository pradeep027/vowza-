// ─── Admin Announcements ──────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Plus, Trash2, RefreshCw, Megaphone, Save, X } from 'lucide-react';

export default function AdminAnnouncements() {
  const { user } = useAuth();
  const [anns, setAnns]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle]   = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('notifications' as any)
      .select('*').eq('type', 'announcement')
      .order('created_at', { ascending: false }).limit(30);
    setAnns(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const send = async () => {
    if (!title.trim() || !message.trim()) { toast.error('Title and message required'); return; }
    setSending(true);
    try {
      const { data: users } = await supabase.from('profiles').select('id');
      if (!users?.length) { toast.error('No users to notify'); return; }
      const inserts = users.map((u: any) => ({ user_id: u.id, title, message, type: 'announcement', is_read: false }));
      const { error } = await supabase.from('notifications' as any).insert(inserts);
      if (error) throw error;
      toast.success(`Announcement sent to ${users.length} users`);
      setTitle(''); setMessage(''); setShowForm(false); load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSending(false); }
  };

  const del = async (id: string) => {
    await supabase.from('notifications' as any).delete().eq('id', id);
    toast.success('Deleted'); load();
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-display font-bold text-foreground">Announcements</h1><p className="text-sm text-muted-foreground">Broadcast to all users</p></div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-border hover:bg-secondary text-muted-foreground"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-maroon text-white text-sm font-semibold hover:opacity-90">
            <Plus className="w-4 h-4" />New Announcement
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-gold/30 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground flex items-center gap-2"><Megaphone className="w-4 h-4 text-maroon" />New Announcement</h3>
            <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1.5">Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="input-premium text-sm w-full" placeholder="e.g., New Feature: AI Event Planner" />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1.5">Message *</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} className="input-premium text-sm w-full resize-none" placeholder="Write your announcement here…" />
          </div>
          <div className="flex gap-3">
            <button onClick={send} disabled={sending} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-maroon text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60">
              <Save className="w-4 h-4" />{sending ? 'Sending…' : 'Send to All Users'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-secondary">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{Array.from({length:4}).map((_,i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>
      ) : anns.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No announcements sent yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Deduplicate by title+message */}
          {Array.from(new Map(anns.map(a => [`${a.title}|${a.created_at?.slice(0,10)}`, a])).values()).map((a: any) => (
            <div key={a.id} className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-maroon/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Megaphone className="w-4 h-4 text-maroon" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">{a.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{a.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-2">{new Date(a.created_at).toLocaleDateString('en-IN', {year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</p>
                  </div>
                </div>
                <button onClick={() => del(a.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
