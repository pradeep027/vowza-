// ─── Admin Reviews ────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Star, Trash2, Eye, EyeOff, RefreshCw, ChevronLeft, ChevronRight, Search } from 'lucide-react';

const PAGE_SIZE = 15;

export default function AdminReviews() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(0);
  const [total, setTotal]     = useState(0);
  const [search, setSearch]   = useState('');
  const [dist, setDist]       = useState<Record<number,number>>({1:0,2:0,3:0,4:0,5:0});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, count, error } = await supabase.from('reviews').select('*', { count: 'exact' })
        .order('created_at', { ascending: false }).range(page*PAGE_SIZE,(page+1)*PAGE_SIZE-1);
      if (error) throw error;
      setReviews(data ?? []);
      setTotal(count ?? 0);
      const d: Record<number,number> = {1:0,2:0,3:0,4:0,5:0};
      (data ?? []).forEach((r: any) => { if(r.rating>=1&&r.rating<=5) d[r.rating]++; });
      setDist(d);
    } catch(e:any){ toast.error(e.message); }
    finally{ setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const del = async (id: string) => {
    if (!confirm('Delete review?')) return;
    await supabase.from('reviews').delete().eq('id', id);
    toast.success('Deleted'); load();
  };

  const filtered = reviews.filter(r => !search || r.review_text?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-display font-bold">Reviews</h1><p className="text-sm text-muted-foreground">{total} total</p></div>
        <button onClick={load} className="p-2 rounded-lg border border-border hover:bg-secondary text-muted-foreground"><RefreshCw className="w-4 h-4" /></button>
      </div>

      {/* Rating distribution */}
      <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 p-5">
        <h3 className="text-sm font-semibold mb-4">Rating Distribution</h3>
        <div className="space-y-2">
          {[5,4,3,2,1].map(n => (
            <div key={n} className="flex items-center gap-3">
              <div className="flex items-center gap-1 w-12 text-xs font-medium text-muted-foreground">{n} <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" /></div>
              <div className="flex-1 h-2.5 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-yellow-400 rounded-full transition-all" style={{ width: total ? `${(dist[n]/total)*100}%` : '0%' }} />
              </div>
              <span className="text-xs text-muted-foreground w-8 text-right">{dist[n]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search review text…" className="input-premium pl-9 py-2.5 text-sm w-full" />
      </div>

      <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-surface-2">
                {['Rating','Review','Created','Actions'].map(h => (
                  <th key={h} className="text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({length:6}).map((_,i) => (
                <tr key={i} className="border-b border-border/40">{Array.from({length:4}).map((_,j) => <td key={j} className="px-4 py-3"><div className="skeleton h-4 rounded w-24" /></td>)}</tr>
              )) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-12 text-muted-foreground">No reviews found</td></tr>
              ) : filtered.map((r: any) => (
                <tr key={r.id} className="border-b border-border/40 hover:bg-surface-2 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-0.5">{Array.from({length:5}).map((_,i) => <Star key={i} className={`w-3.5 h-3.5 ${i<r.rating?'fill-yellow-400 text-yellow-400':'text-gray-200'}`} />)}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">{r.review_text || '—'}</td>
                  <td className="px-4 py-3 text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => del(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-border/60">
          <p className="text-xs text-muted-foreground">Page {page+1}</p>
          <div className="flex gap-1">
            <button disabled={page===0} onClick={() => setPage(p=>p-1)} className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-secondary"><ChevronLeft className="w-4 h-4" /></button>
            <button disabled={(page+1)*PAGE_SIZE>=total} onClick={() => setPage(p=>p+1)} className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-secondary"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
