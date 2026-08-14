// ─── Admin Bookings ───────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, RefreshCw, Download, ChevronLeft, ChevronRight, Eye, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import ChatBox from '@/components/ChatBox';

const PAGE_SIZE = 15;
type StatusFilter = 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled';

export default function AdminBookings() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [status, setStatus]     = useState<StatusFilter>('all');
  const [page, setPage]         = useState(0);
  const [total, setTotal]       = useState(0);
  const [selected, setSelected] = useState<any>(null);
  const [reschedules, setReschedules] = useState<any[]>([]);
  const [loadingReschedules, setLoadingReschedules] = useState(true);
  const [chatBookingId, setChatBookingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase.from('bookings').select('*', { count: 'exact' });
      if (status !== 'all') q = q.eq('status', status);
      q = q.order('created_at', { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      const { data, count, error } = await q;
      if (error) throw error;
      setBookings(data ?? []);
      setTotal(count ?? 0);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [status, page]);

  useEffect(() => { load(); }, [load]);

  // Load reschedule requests
  useEffect(() => {
    (async () => {
      setLoadingReschedules(true);
      const { data } = await supabase
        .from('reschedule_requests' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) setReschedules(data);
      setLoadingReschedules(false);
    })();
  }, [bookings]);

  const updateStatus = async (id: string, newStatus: string) => {
    await supabase.from('bookings').update({ status: newStatus } as any).eq('id', id);
    toast.success(`Status → ${newStatus}`);
    setSelected(null); load();
  };

  const statusColor = (s: string) => ({
    confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    pending:   'bg-amber-50 text-amber-700 border-amber-200',
    completed: 'bg-blue-50 text-blue-700 border-blue-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
  }[s] ?? 'bg-muted text-muted-foreground');

  const filtered = bookings.filter(b => !search || b.id?.includes(search) || b.status?.includes(search));

  const exportCSV = () => {
    const rows = [['ID','Status','Amount','Created'],...bookings.map(b => [b.id,b.status,b.total_amount||'',b.created_at])];
    const csv = rows.map(r => r.map((v: any) => `"${v}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,'+encodeURIComponent(csv); a.download='bookings.csv'; a.click();
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-display font-bold text-foreground">Bookings</h1><p className="text-sm text-muted-foreground">{total} total</p></div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-secondary"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-secondary"><Download className="w-4 h-4" />Export</button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search booking ID…" className="input-premium pl-9 py-2.5 text-sm w-full" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(['all','pending','confirmed','completed','cancelled'] as StatusFilter[]).map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(0); }}
              className={cn('px-3 py-2 rounded-lg text-xs font-semibold capitalize border transition-colors', status===s ? 'bg-maroon text-white border-maroon' : 'border-border text-muted-foreground hover:bg-secondary')}>{s}</button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-surface-2">
                {['Booking ID','Status','Payment','Amount','Event Date','Created','Actions'].map(h => (
                  <th key={h} className="text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({length:8}).map((_,i) => (
                <tr key={i} className="border-b border-border/40">{Array.from({length:7}).map((_,j) => <td key={j} className="px-4 py-3"><div className="skeleton h-4 rounded w-20" /></td>)}</tr>
              )) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No bookings found</td></tr>
              ) : filtered.map(b => (
                <tr key={b.id} className="border-b border-border/40 hover:bg-surface-2 transition-colors">
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">#{b.id.slice(0,8)}</td>
                  <td className="px-4 py-3"><span className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full ${statusColor(b.status)}`}>{b.status}</span></td>
                  <td className="px-4 py-3"><span className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full ${statusColor(b.payment_status||'pending')}`}>{b.payment_status||'pending'}</span></td>
                  <td className="px-4 py-3 text-xs font-semibold text-foreground">{b.total_amount ? `₹${Number(b.total_amount).toLocaleString()}` : '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{b.event_date ? new Date(b.event_date).toLocaleDateString('en-IN') : '—'}</td>
                  <td className="px-4 py-3 text-[10px] text-muted-foreground">{new Date(b.created_at).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setSelected(b)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"><Eye className="w-3.5 h-3.5" /></button>
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

      {/* ── Reschedule Requests ─────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Reschedule Requests</h2>
          <span className="text-xs text-muted-foreground">{reschedules.length} total</span>
        </div>
        <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-surface-2">
                  {['Booking','Status','Original Date','Requested Date','Refund','Decision','Created'].map(h => (
                    <th key={h} className="text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingReschedules ? (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</td></tr>
                ) : reschedules.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No reschedule requests yet</td></tr>
                ) : reschedules.map((r: any) => (
                  <tr key={r.id} className="border-b border-border/40 hover:bg-surface-2 transition-colors">
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">#{r.booking_id?.slice(0,8)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[10px] font-semibold border px-2 py-0.5 rounded-full',
                        r.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        r.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        r.status === 'declined' ? 'bg-red-50 text-red-700 border-red-200' :
                        'bg-gray-50 text-gray-700 border-gray-200'
                      )}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">{r.original_date ? new Date(r.original_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</td>
                    <td className="px-4 py-3 text-xs font-semibold">{r.requested_date ? new Date(r.requested_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</td>
                    <td className="px-4 py-3 text-xs">{Number(r.refund_amount) > 0 ? <span className="text-orange-600 font-semibold">₹{Number(r.refund_amount).toLocaleString()} ({r.refund_status})</span> : '—'}</td>
                    <td className="px-4 py-3 text-[10px] text-muted-foreground">{r.decided_at ? new Date(r.decided_at).toLocaleDateString('en-IN') : 'Pending'}</td>
                    <td className="px-4 py-3 text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl border border-border p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-foreground">Booking #{selected.id.slice(0,8)}</h2>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[['Status',selected.status],['Amount',selected.total_amount?`₹${selected.total_amount}`:'—'],['Event Date',selected.event_date||'—'],['Package',selected.package_name||'—'],['Notes',selected.notes||'—']].map(([l,v]) => (
                <div key={l}><p className="text-[10px] text-muted-foreground uppercase font-bold mb-0.5">{l}</p><p className="font-medium text-foreground">{v}</p></div>
              ))}
            </div>
            <div className="pt-3 border-t border-border space-y-2">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Update Status</p>
              <div className="flex flex-wrap gap-2">
                {['confirmed','completed','cancelled'].map(s => (
                  <button key={s} onClick={() => updateStatus(selected.id, s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${s==='cancelled'?'bg-red-500 text-white':s==='completed'?'bg-blue-500 text-white':'bg-emerald-500 text-white'}`}>
                    → {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="pt-3 border-t border-border">
              <button onClick={() => { setChatBookingId(selected.id); setSelected(null); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:bg-secondary w-full justify-center">
                <MessageSquare className="w-3.5 h-3.5" /> View Chat (Read Only)
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Admin Chat Read-Only Modal ──────────────────────────────────── */}
      {chatBookingId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl border border-border w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h2 className="font-bold text-foreground text-sm">Chat — Booking #{chatBookingId.slice(0,8)}</h2>
              <button onClick={() => setChatBookingId(null)} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
            </div>
            <div className="p-4">
              <ChatBox bookingId={chatBookingId} otherUserName="Conversation" readOnly />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
