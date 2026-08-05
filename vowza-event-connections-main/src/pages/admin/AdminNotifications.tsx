// ─── Admin Notifications ─────────────────────────────────────────────────────
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Bell, Send, Users, UserCheck, User } from 'lucide-react';

type Target = 'all' | 'artists' | 'customers';

export default function AdminNotifications() {
  const [title, setTitle]     = useState('');
  const [message, setMessage] = useState('');
  const [target, setTarget]   = useState<Target>('all');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!title.trim() || !message.trim()) { toast.error('Title and message required'); return; }
    setSending(true);
    try {
      let userIds: string[] = [];

      if (target === 'all') {
        const { data } = await supabase.from('profiles').select('id');
        userIds = (data ?? []).map((u: any) => u.id);
      } else if (target === 'artists') {
        const { data } = await supabase.from('provider_profiles').select('user_id');
        userIds = (data ?? []).map((a: any) => a.user_id).filter(Boolean);
      } else {
        const { data: all } = await supabase.from('profiles').select('id');
        const { data: artists } = await supabase.from('provider_profiles').select('user_id');
        const artistIds = new Set((artists ?? []).map((a: any) => a.user_id));
        userIds = (all ?? []).map((u: any) => u.id).filter(id => !artistIds.has(id));
      }

      if (!userIds.length) { toast.error('No matching users found'); setSending(false); return; }

      const inserts = userIds.map(uid => ({ user_id: uid, title, message, type: 'admin_notification', is_read: false }));
      const { error } = await supabase.from('notifications' as any).insert(inserts);
      if (error) throw error;

      toast.success(`Notification sent to ${userIds.length} users`);
      setTitle(''); setMessage('');
    } catch (e: any) { toast.error(e.message); }
    finally { setSending(false); }
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Notifications</h1>
        <p className="text-sm text-muted-foreground">Send push notifications to users</p>
      </div>

      <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-6 space-y-5">
        {/* Target */}
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-3">Send To</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([['all', Users, 'All Users'], ['artists', UserCheck, 'Artists Only'], ['customers', User, 'Customers Only']] as const).map(([val, Icon, label]) => (
              <button key={val} onClick={() => setTarget(val as Target)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${target === val ? 'border-maroon bg-maroon/5' : 'border-border hover:border-maroon/30'}`}>
                <Icon className={`w-5 h-5 ${target === val ? 'text-maroon' : 'text-muted-foreground'}`}/>
                <span className={`text-xs font-semibold ${target === val ? 'text-maroon' : 'text-muted-foreground'}`}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="text-xs font-bold text-muted-foreground block mb-1.5">Notification Title *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="input-premium text-sm w-full" placeholder="e.g., Your booking is confirmed!" />
        </div>

        {/* Message */}
        <div>
          <label className="text-xs font-bold text-muted-foreground block mb-1.5">Message *</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} className="input-premium text-sm w-full resize-none" placeholder="Write notification message…" />
        </div>

        <button onClick={send} disabled={sending} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-maroon text-white text-sm font-bold shadow-maroon hover:opacity-90 disabled:opacity-50">
          <Send className="w-4 h-4"/>
          {sending ? 'Sending…' : `Send Notification`}
        </button>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 rounded-2xl p-5 flex gap-3">
        <Bell className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5"/>
        <div>
          <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">In-App Notifications</p>
          <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">Notifications are delivered as in-app alerts. SMS and email delivery require third-party integration.</p>
        </div>
      </div>
    </div>
  );
}
