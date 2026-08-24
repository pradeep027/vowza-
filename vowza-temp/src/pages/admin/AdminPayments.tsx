// ─── Admin Payments ───────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { IndianRupee, TrendingUp, RefreshCw, Download, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 15;

export default function AdminPayments() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(0);
  const [total, setTotal]       = useState(0);
  const [stats, setStats]       = useState({ total: 0, today: 0, commission: 0, refunds: 0 });

  const load = async () => {
    setLoading(true);
    try {
      const { data, count, error } = await supabase
        .from('payments' as any)
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      setPayments(data ?? []);
      setTotal(count ?? 0);
      const all = data ?? [];
      const today = new Date().toISOString().split('T')[0];
      setStats({
        total: all.filter((p:any)=>p.status==='completed').reduce((s:number,p:any)=>s+(p.amount||0),0),
        today: all.filter((p:any)=>p.created_at?.startsWith(today)&&p.status==='completed').reduce((s:number,p:any)=>s+(p.amount||0),0),
        commission: all.filter((p:any)=>p.status==='completed').reduce((s:number,p:any)=>s+(p.platform_fee||0),0),
        refunds: all.filter((p:any)=>p.status==='refunded').reduce((s:number,p:any)=>s+(p.amount||0),0),
      });
    } catch (e: any) { toast.error(e.message || 'No payments table found'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page]);

  const fmt = (n: number) => n >= 100000 ? `₹${(n/100000).toFixed(1)}L` : `₹${n.toLocaleString()}`;

  const statusColor = (s: string) => ({
    completed: 'bg-emerald-50 text-emerald-700',
    pending:   'bg-amber-50 text-amber-700',
    failed:    'bg-red-50 text-red-700',
    refunded:  'bg-blue-50 text-blue-700',
  }[s] ?? 'bg-muted text-muted-foreground');

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-display font-bold text-foreground">Payments</h1><p className="text-sm text-muted-foreground">Revenue & transaction management</p></div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-border hover:bg-secondary text-muted-foreground"><RefreshCw className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue',     value: fmt(stats.total),      icon: IndianRupee, color: 'bg-emerald-500' },
          { label: "Today's Revenue",   value: fmt(stats.today),      icon: TrendingUp,  color: 'bg-blue-500'    },
          { label: 'Platform Commission',value: fmt(stats.commission), icon: IndianRupee, color: 'bg-violet-500'  },
          { label: 'Total Refunds',     value: fmt(stats.refunds),    icon: IndianRupee, color: 'bg-red-500'     },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-5">
            <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center mb-3`}><s.icon className="w-5 h-5 text-white" /></div>
            <p className="text-xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-surface-2">
                {['Transaction ID','Amount','Platform Fee','Status','Method','Created'].map(h => (
                  <th key={h} className="text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({length:8}).map((_,i) => (
                <tr key={i} className="border-b border-border/40">{Array.from({length:6}).map((_,j) => <td key={j} className="px-4 py-3"><div className="skeleton h-4 rounded w-20" /></td>)}</tr>
              )) : payments.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No payments found. Ensure the payments table exists.</td></tr>
              ) : payments.map((p: any) => (
                <tr key={p.id} className="border-b border-border/40 hover:bg-surface-2 transition-colors">
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">#{p.id?.slice(0,8)}</td>
                  <td className="px-4 py-3 text-xs font-bold text-foreground">₹{(p.amount||0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">₹{(p.platform_fee||0).toLocaleString()}</td>
                  <td className="px-4 py-3"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor(p.status)}`}>{p.status}</span></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{p.payment_method||'—'}</td>
                  <td className="px-4 py-3 text-[10px] text-muted-foreground">{new Date(p.created_at).toLocaleDateString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-border/60">
          <p className="text-xs text-muted-foreground">Page {page+1} of {Math.ceil(total/PAGE_SIZE)||1}</p>
          <div className="flex gap-1">
            <button disabled={page===0} onClick={() => setPage(p=>p-1)} className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-secondary"><ChevronLeft className="w-4 h-4" /></button>
            <button disabled={(page+1)*PAGE_SIZE>=total} onClick={() => setPage(p=>p+1)} className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-secondary"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
