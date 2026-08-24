// ─── Admin Reports & Support ──────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Flag, Trash2, CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react';

export default function AdminReports() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications' as any)
        .select('*')
        .eq('type', 'report')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setReports(data ?? []);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const del = async (id: string) => {
    await supabase.from('notifications' as any).delete().eq('id', id);
    toast.success('Report dismissed'); load();
  };

  const resolve = async (id: string) => {
    await supabase.from('notifications' as any).update({ is_read: true } as any).eq('id', id);
    toast.success('Marked as resolved'); load();
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-display font-bold text-foreground">Reports</h1><p className="text-sm text-muted-foreground">Fraud reports, spam, and complaints</p></div>
        <button onClick={load} className="p-2 rounded-lg border border-border hover:bg-secondary text-muted-foreground"><RefreshCw className="w-4 h-4"/></button>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({length:5}).map((_,i)=><div key={i} className="skeleton h-20 rounded-2xl"/>)}</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Flag className="w-10 h-10 mx-auto mb-3 opacity-30"/>
          <p className="text-sm">No reports found</p>
          <p className="text-xs mt-1">Reports from users will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r: any) => (
            <div key={r.id} className={`bg-white dark:bg-[#1a1a24] rounded-2xl border p-5 flex items-start gap-4 ${r.is_read ? 'border-border/40 opacity-60' : 'border-orange-200 bg-orange-50/30'}`}>
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-orange-500"/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground">{r.title || 'Report'}</p>
                <p className="text-xs text-muted-foreground mt-1">{r.message}</p>
                <p className="text-[10px] text-muted-foreground mt-2">{new Date(r.created_at).toLocaleString('en-IN')}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {!r.is_read && (
                  <button onClick={() => resolve(r.id)} className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-600" title="Resolve">
                    <CheckCircle className="w-4 h-4"/>
                  </button>
                )}
                <button onClick={() => del(r.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500" title="Delete">
                  <Trash2 className="w-4 h-4"/>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
