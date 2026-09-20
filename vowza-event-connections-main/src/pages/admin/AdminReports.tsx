// ─── Admin Reports ────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Shield, RefreshCw, CheckCircle, Trash2 } from 'lucide-react';
import { NotificationService } from '@/features/notifications/api/notificationService';

export default function AdminReports() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await NotificationService.getNotificationsByType('report', { limit: 50 });
      setReports(data);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const del = async (id: string) => {
    await NotificationService.deleteNotification(id);
    toast.success('Report dismissed'); load();
  };

  const resolve = async (id: string) => {
    await NotificationService.markAsRead(id);
    toast.success('Marked as resolved'); load();
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-display font-bold text-foreground">Reports</h1><p className="text-sm text-muted-foreground">Fraud reports, spam, and complaints</p></div>
        <button onClick={load} className="p-2 rounded-lg border border-border hover:bg-secondary text-muted-foreground"><RefreshCw className="w-4 h-4" /></button>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({length:4}).map((_,i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No reports filed.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r: any) => (
            <div key={r.id} className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm text-foreground">{r.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{r.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-2">{new Date(r.created_at).toLocaleString('en-IN')}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => resolve(r.id)} className="p-1.5 rounded-lg hover:bg-green-50 text-green-600" title="Resolve"><CheckCircle className="w-3.5 h-3.5" /></button>
                  <button onClick={() => del(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Dismiss"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
