// ─── Admin Support ────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { HeadphonesIcon, RefreshCw, MessageCircle, CheckCircle, Trash2 } from 'lucide-react';

export default function AdminSupport() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('notifications' as any)
        .select('*')
        .in('type', ['support', 'complaint', 'contact'])
        .order('created_at', { ascending: false })
        .limit(50);
      setTickets(data ?? []);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const resolve = async (id: string) => {
    await supabase.from('notifications' as any).update({ is_read: true } as any).eq('id', id);
    toast.success('Ticket resolved'); load();
  };

  const del = async (id: string) => {
    await supabase.from('notifications' as any).delete().eq('id', id);
    toast.success('Deleted'); load();
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-display font-bold text-foreground">Support</h1>
          <p className="text-sm text-muted-foreground">{tickets.filter(t=>!t.is_read).length} open tickets</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg border border-border hover:bg-secondary text-muted-foreground"><RefreshCw className="w-4 h-4"/></button>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({length:5}).map((_,i)=><div key={i} className="skeleton h-20 rounded-2xl"/>)}</div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <HeadphonesIcon className="w-10 h-10 mx-auto mb-3 opacity-30"/>
          <p className="text-sm">No support tickets</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t: any) => (
            <div key={t.id} className={`bg-white dark:bg-[#1a1a24] rounded-2xl border p-5 flex items-start gap-4 ${t.is_read ? 'border-border/40 opacity-70' : 'border-blue-200'}`}>
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-5 h-5 text-blue-500"/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-sm text-foreground">{t.title || 'Support Request'}</p>
                  {!t.is_read && <span className="text-[10px] font-bold bg-blue-500 text-white px-2 py-0.5 rounded-full">Open</span>}
                  {t.is_read  && <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">Resolved</span>}
                </div>
                <p className="text-xs text-muted-foreground">{t.message}</p>
                <p className="text-[10px] text-muted-foreground mt-2">{new Date(t.created_at).toLocaleString('en-IN')}</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {!t.is_read && (
                  <button onClick={() => resolve(t.id)} className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-600" title="Resolve">
                    <CheckCircle className="w-4 h-4"/>
                  </button>
                )}
                <button onClick={() => del(t.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500">
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
