// ─── Admin Support ────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Headphones, RefreshCw, CheckCircle, Trash2 } from 'lucide-react';
import { NotificationService } from '@/features/notifications/api/notificationService';

export default function AdminSupport() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await NotificationService.getNotificationsByType(
        ['support', 'complaint', 'contact'],
        { limit: 50 },
      );
      setTickets(data);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const resolve = async (id: string) => {
    await NotificationService.markAsRead(id);
    toast.success('Ticket resolved'); load();
  };

  const del = async (id: string) => {
    await NotificationService.deleteNotification(id);
    toast.success('Deleted'); load();
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-display font-bold text-foreground">Support</h1>
          <p className="text-sm text-muted-foreground">{tickets.filter(t => !t.is_read).length} open tickets</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg border border-border hover:bg-secondary text-muted-foreground"><RefreshCw className="w-4 h-4" /></button>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({length:4}).map((_,i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Headphones className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No support tickets.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t: any) => (
            <div key={t.id} className={`bg-white dark:bg-[#1a1a24] rounded-2xl border p-5 ${t.is_read ? 'border-border/60' : 'border-gold/40'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm text-foreground">{t.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-2">{new Date(t.created_at).toLocaleString('en-IN')}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {!t.is_read && <button onClick={() => resolve(t.id)} className="p-1.5 rounded-lg hover:bg-green-50 text-green-600" title="Resolve"><CheckCircle className="w-3.5 h-3.5" /></button>}
                  <button onClick={() => del(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
