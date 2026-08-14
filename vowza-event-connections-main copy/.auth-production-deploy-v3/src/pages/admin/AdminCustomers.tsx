// ─── Admin Customers ──────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, Trash2, Ban, RefreshCw, Download, ChevronLeft, ChevronRight, Eye } from 'lucide-react';

interface Customer { id: string; full_name: string; email: string; phone: string; city: string; created_at: string; is_blocked?: boolean; }
const PAGE_SIZE = 15;

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [page, setPage]           = useState(0);
  const [total, setTotal]         = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, count, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, city, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      setCustomers((data ?? []) as Customer[]);
      setTotal(count ?? 0);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const del = async (id: string) => {
    if (!confirm('Delete customer?')) return;
    await supabase.from('profiles').delete().eq('id', id);
    toast.success('Deleted'); load();
  };

  const exportCSV = () => {
    const rows = [['Name','Email','Phone','City','Joined'],...customers.map(c => [c.full_name||'',c.email||'',c.phone||'',c.city||'',c.created_at])];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'customers.csv'; a.click();
  };

  const filtered = customers.filter(c =>
    !search || [c.full_name, c.email, c.phone, c.city].some(v => v?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-display font-bold text-foreground">Customers</h1><p className="text-sm text-muted-foreground">{total} registered users</p></div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-secondary"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-secondary"><Download className="w-4 h-4" />Export</button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, city…" className="input-premium pl-9 py-2.5 text-sm w-full max-w-sm" />
      </div>

      <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-surface-2">
                {['Customer','Email','Phone','City','Joined','Actions'].map(h => (
                  <th key={h} className="text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({length:8}).map((_,i) => (
                <tr key={i} className="border-b border-border/40">{Array.from({length:6}).map((_,j) => <td key={j} className="px-4 py-3"><div className="skeleton h-4 rounded w-20" /></td>)}</tr>
              )) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No customers found</td></tr>
              ) : filtered.map(c => (
                <tr key={c.id} className="border-b border-border/40 hover:bg-surface-2 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-foreground">{(c.full_name||'U').charAt(0).toUpperCase()}</span>
                      </div>
                      <span className="font-semibold text-xs text-foreground">{c.full_name || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{c.phone || '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{c.city || '—'}</td>
                  <td className="px-4 py-3 text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground" title="View"><Eye className="w-3.5 h-3.5" /></button>
                      <button onClick={() => del(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-border/60">
          <p className="text-xs text-muted-foreground">Showing {page*PAGE_SIZE+1}–{Math.min((page+1)*PAGE_SIZE,total)} of {total}</p>
          <div className="flex gap-1">
            <button disabled={page===0} onClick={() => setPage(p=>p-1)} className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-secondary"><ChevronLeft className="w-4 h-4" /></button>
            <button disabled={(page+1)*PAGE_SIZE>=total} onClick={() => setPage(p=>p+1)} className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-secondary"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
