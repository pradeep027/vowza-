// ─── Admin Artists Management ─────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, Filter, Eye, CheckCircle, XCircle, Ban, Trash2, RefreshCw, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type Status = 'all' | 'pending' | 'approved' | 'rejected' | 'suspended';

interface Artist {
  id: string; user_id: string; profession: string; verification_status: string;
  experience_years: number; price_min: number; price_max: number;
  bio: string; created_at: string; is_available: boolean;
  full_name?: string; email?: string; phone?: string; city?: string; avatar_url?: string;
}

const PAGE_SIZE = 15;

export default function AdminArtists() {
  const [artists, setArtists]     = useState<Artist[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [status, setStatus]       = useState<Status>('all');
  const [page, setPage]           = useState(0);
  const [total, setTotal]         = useState(0);
  const [selected, setSelected]   = useState<Artist | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase.from('provider_profiles').select('*', { count: 'exact' });
      if (status !== 'all') q = q.eq('verification_status', status);
      q = q.order('created_at', { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data, count, error } = await q;
      if (error) throw error;

      if (data && data.length) {
        const ids = data.map((a: any) => a.user_id).filter(Boolean);
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, phone, email, avatar_url, city').in('id', ids);
        const pm = new Map((profiles ?? []).map((p: any) => [p.id, p]));
        setArtists(data.map((a: any) => ({ ...a, ...pm.get(a.user_id) })));
      } else setArtists([]);
      setTotal(count ?? 0);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [status, page]);

  useEffect(() => { load(); }, [load]);

  const filteredArtists = artists.filter(a =>
    !search || [a.full_name, a.email, a.profession, a.city].some(v => v?.toLowerCase().includes(search.toLowerCase()))
  );

  const act = async (artistId: string, userId: string, action: 'approved' | 'rejected' | 'suspended') => {
    if (action === 'rejected' && !rejectReason.trim()) { toast.error('Provide rejection reason'); return; }
    setProcessing(true);
    try {
      await supabase.from('provider_profiles').update({
        verification_status: action,
        ...(action === 'rejected' ? { rejection_reason: rejectReason } : {}),
      } as any).eq('id', artistId);

      if (action === 'approved') {
        await supabase.from('user_roles').upsert({ user_id: userId, role: 'provider' }, { onConflict: 'user_id,role' });
      }
      toast.success(`Artist ${action}`);
      setSelected(null); setRejectReason(''); load();
    } catch (e: any) { toast.error(e.message); }
    finally { setProcessing(false); }
  };

  const del = async (artistId: string) => {
    if (!confirm('Delete this artist? This cannot be undone.')) return;
    await supabase.from('provider_profiles').delete().eq('id', artistId);
    toast.success('Deleted'); load();
  };

  const exportCSV = () => {
    const rows = [['Name','Email','Profession','City','Status','Created'],...filteredArtists.map(a => [a.full_name||'',a.email||'',a.profession||'',a.city||'',a.verification_status,a.created_at])];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'artists.csv'; a.click();
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      rejected: 'bg-red-50 text-red-700 border-red-200',
      pending:  'bg-amber-50 text-amber-700 border-amber-200',
      suspended:'bg-gray-100 text-gray-600 border-gray-300',
    };
    return `text-[10px] font-semibold border px-2 py-0.5 rounded-full ${map[s] || 'bg-muted text-muted-foreground'}`;
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Artists</h1>
          <p className="text-sm text-muted-foreground">{total.toLocaleString()} total artists</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-secondary"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-secondary"><Download className="w-4 h-4" />Export</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, profession…" className="input-premium pl-9 py-2.5 text-sm w-full" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(['all','pending','approved','rejected','suspended'] as Status[]).map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(0); }}
              className={cn('px-3 py-2 rounded-lg text-xs font-semibold capitalize border transition-colors',
                status === s ? 'bg-maroon text-white border-maroon' : 'border-border text-muted-foreground hover:bg-secondary')}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-surface-2">
                {['Artist','Profession','City','Exp.','Price','Status','Joined','Actions'].map(h => (
                  <th key={h} className="text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({length:8}).map((_,i) => (
                  <tr key={i} className="border-b border-border/40">
                    {Array.from({length:8}).map((_,j) => <td key={j} className="px-4 py-3"><div className="skeleton h-4 rounded w-20" /></td>)}
                  </tr>
                ))
              ) : filteredArtists.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No artists found</td></tr>
              ) : filteredArtists.map(a => (
                <tr key={a.id} className="border-b border-border/40 hover:bg-surface-2 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-gradient-maroon flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-white">{(a.full_name||a.profession||'?').charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-xs">{a.full_name || 'Unknown'}</p>
                        <p className="text-[10px] text-muted-foreground">{a.email || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground capitalize">{a.profession?.replace(/_/g,' ') || '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{a.city || '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{a.experience_years ?? '—'}yr</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {a.price_min ? `₹${(a.price_min/1000).toFixed(0)}K` : '—'}
                  </td>
                  <td className="px-4 py-3"><span className={statusBadge(a.verification_status)}>{a.verification_status}</span></td>
                  <td className="px-4 py-3 text-[10px] text-muted-foreground">{new Date(a.created_at).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setSelected(a)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground" title="View"><Eye className="w-3.5 h-3.5" /></button>
                      {a.verification_status !== 'approved' && (
                        <button onClick={() => act(a.id, a.user_id, 'approved')} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600" title="Approve"><CheckCircle className="w-3.5 h-3.5" /></button>
                      )}
                      {a.verification_status !== 'rejected' && (
                        <button onClick={() => { setSelected(a); }} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Reject"><XCircle className="w-3.5 h-3.5" /></button>
                      )}
                      <button onClick={() => del(a.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border/60">
          <p className="text-xs text-muted-foreground">Showing {page*PAGE_SIZE+1}–{Math.min((page+1)*PAGE_SIZE,total)} of {total}</p>
          <div className="flex gap-1">
            <button disabled={page===0} onClick={() => setPage(p=>p-1)} className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-secondary"><ChevronLeft className="w-4 h-4" /></button>
            <button disabled={(page+1)*PAGE_SIZE >= total} onClick={() => setPage(p=>p+1)} className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-secondary"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl border border-border p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <h2 className="font-display font-bold text-foreground text-lg">Artist Detail</h2>
              <button onClick={() => { setSelected(null); setRejectReason(''); }} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[['Name',selected.full_name||'—'],['Email',selected.email||'—'],['Phone',selected.phone||'—'],['City',selected.city||'—'],['Profession',selected.profession?.replace(/_/g,' ')||'—'],['Experience',`${selected.experience_years||0} yrs`],['Status',selected.verification_status],['Joined',new Date(selected.created_at).toLocaleDateString('en-IN')]].map(([l,v]) => (
                <div key={l}><p className="text-[10px] text-muted-foreground uppercase font-bold mb-0.5">{l}</p><p className="font-medium text-foreground capitalize">{v}</p></div>
              ))}
            </div>
            {selected.bio && <div><p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Bio</p><p className="text-sm text-foreground">{selected.bio}</p></div>}
            {(selected.verification_status === 'pending' || selected.verification_status === 'approved') && (
              <div className="space-y-3 pt-3 border-t border-border">
                <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Rejection reason (required for reject)…" rows={2} className="input-premium resize-none text-sm w-full" />
                <div className="flex gap-2">
                  {selected.verification_status !== 'approved' && (
                    <button onClick={() => act(selected.id, selected.user_id, 'approved')} disabled={processing} className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600">
                      {processing ? 'Processing…' : 'Approve'}
                    </button>
                  )}
                  <button onClick={() => act(selected.id, selected.user_id, 'rejected')} disabled={processing} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-xs font-semibold hover:bg-red-600">
                    {processing ? 'Processing…' : 'Reject'}
                  </button>
                  <button onClick={() => act(selected.id, selected.user_id, 'suspended')} disabled={processing} className="flex-1 py-2.5 rounded-xl bg-gray-500 text-white text-xs font-semibold hover:bg-gray-600">
                    Suspend
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
