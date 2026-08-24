// ─── Admin Audit Logs ─────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ClipboardList, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 20;

export default function AdminAuditLogs() {
  const [logs, setLogs]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage]     = useState(0);
  const [total, setTotal]   = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      // Use notifications table as audit log source (type=admin_action)
      // If you have a dedicated audit_logs table, swap this query
      const { data, count, error } = await supabase
        .from('notifications' as any)
        .select('*', { count: 'exact' })
        .in('type', ['admin_action', 'approval', 'rejection', 'announcement', 'report'])
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      setLogs(data ?? []);
      setTotal(count ?? 0);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page]);

  const typeIcon = (type: string) => ({
    admin_action: '🔧', approval: '✅', rejection: '❌',
    announcement: '📣', report: '🚩',
  }[type] ?? '📋');

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-display font-bold text-foreground">Audit Logs</h1><p className="text-sm text-muted-foreground">{total} logged actions</p></div>
        <button onClick={load} className="p-2 rounded-lg border border-border hover:bg-secondary text-muted-foreground"><RefreshCw className="w-4 h-4"/></button>
      </div>

      <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{Array.from({length:8}).map((_,i)=><div key={i} className="skeleton h-12 rounded"/>)}</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30"/>
            <p className="text-sm">No audit logs yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {logs.map((log: any) => (
              <div key={log.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-surface-2 transition-colors">
                <span className="text-lg flex-shrink-0 mt-0.5">{typeIcon(log.type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{log.title || log.type}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.message}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-[10px] font-semibold bg-secondary text-muted-foreground px-2 py-0.5 rounded-full capitalize">{log.type}</span>
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(log.created_at).toLocaleString('en-IN')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border/60">
          <p className="text-xs text-muted-foreground">Page {page+1}</p>
          <div className="flex gap-1">
            <button disabled={page===0} onClick={() => setPage(p=>p-1)} className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-secondary"><ChevronLeft className="w-4 h-4"/></button>
            <button disabled={(page+1)*PAGE_SIZE>=total} onClick={() => setPage(p=>p+1)} className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-secondary"><ChevronRight className="w-4 h-4"/></button>
          </div>
        </div>
      </div>
    </div>
  );
}
