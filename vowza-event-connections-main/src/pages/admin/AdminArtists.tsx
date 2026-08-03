// ─── Admin Artists — Pending / Approved / Rejected with full workflow ─────────
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { approveArtist, rejectArtist, suspendArtist } from '@/services/approvalService';
import {
  Search, RefreshCw, Download, ChevronLeft, ChevronRight,
  Eye, CheckCircle, XCircle, AlertTriangle, Trash2,
  Clock, UserCheck, Users, Filter,
} from 'lucide-react';
import AdminArtistDetail from './AdminArtistDetail';

type Tab = 'pending' | 'approved' | 'rejected';

interface Artist {
  id: string; user_id: string; profession: string;
  verification_status: string; experience_years: number;
  price_min: number; bio: string; created_at: string;
  verified_at?: string; rejection_reason?: string;
  full_name?: string; email?: string; phone?: string;
  city?: string; state?: string; area?: string;
  avatar_url?: string; languages?: string[];
  vendor_details?: any; gallery_urls?: string[];
  service_areas?: string[];
}

const PAGE_SIZE = 15;

const TAB_CONFIG: Record<Tab, { label: string; icon: React.ElementType; color: string; status: string }> = {
  pending:  { label: 'Pending',  icon: Clock,       color: 'text-amber-600',   status: 'pending'  },
  approved: { label: 'Approved', icon: UserCheck,   color: 'text-emerald-600', status: 'approved' },
  rejected: { label: 'Rejected', icon: XCircle,     color: 'text-red-600',     status: 'rejected' },
};

const REJECT_REASONS = [
  'Invalid Aadhaar Card',
  'Invalid Government ID',
  'Blurry / Unclear Selfie',
  'Selfie Does Not Match Documents',
  'Fake Portfolio',
  'Duplicate Account',
  'Incomplete Information',
  'Inappropriate Content',
  'Other',
];

export default function AdminArtists() {
  const { user } = useAuth();
  const [tab, setTab]         = useState<Tab>('pending');
  const [artists, setArtists] = useState<Artist[]>([]);
  const [counts,  setCounts]  = useState({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(0);
  const [total,   setTotal]   = useState(0);
  const [selected, setSelected] = useState<Artist | null>(null);
  const [processing, setProcessing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectOther, setRejectOther]   = useState('');
  const [rejectModalFor, setRejectModalFor] = useState<Artist | null>(null);

  // Load artists for current tab
  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('provider_profiles')
        .select('*', { count: 'exact' })
        .eq('verification_status', TAB_CONFIG[tab].status)
        .order('created_at', { ascending: tab === 'pending' }) // newest first for approved/rejected
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data, count, error } = await q;
      if (error) {
        if (error.message?.includes('permission') || error.message?.includes('policy') || error.code === 'PGRST301') {
          toast.error('RLS is blocking admin access. Run migration 20260803000000_approval_workflow.sql in Supabase.');
        } else {
          toast.error(error.message);
        }
        setLoading(false);
        return;
      }

      // Enrich with profile data
      const ids = (data ?? []).map((a: any) => a.user_id).filter(Boolean);
      const profileMap = new Map<string, any>();
      if (ids.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone, avatar_url, city, state, area')
          .in('id', ids);
        (profiles ?? []).forEach((p: any) => profileMap.set(p.id, p));
      }

      setArtists((data ?? []).map((a: any) => ({
        ...a,
        ...(profileMap.get(a.user_id) ?? {}),
      })));
      setTotal(count ?? 0);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [tab, page]);

  // Load counts for all tabs
  const loadCounts = useCallback(async () => {
    const { data } = await supabase
      .from('provider_profiles')
      .select('verification_status');
    if (data) {
      setCounts({
        pending:  data.filter((a: any) => a.verification_status === 'pending').length,
        approved: data.filter((a: any) => a.verification_status === 'approved').length,
        rejected: data.filter((a: any) => a.verification_status === 'rejected').length,
      });
    }
  }, []);

  useEffect(() => { load(); loadCounts(); }, [load, loadCounts]);

  // Real-time: re-fetch when provider_profiles changes
  useEffect(() => {
    const ch = supabase.channel('admin-artists-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'provider_profiles' }, () => {
        load(); loadCounts();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, loadCounts]);

  const filtered = artists.filter(a =>
    !search || [a.full_name, a.email, a.phone, a.profession, a.city].some(
      v => v?.toLowerCase().includes(search.toLowerCase())
    )
  );

  // ── Approve ─────────────────────────────────────────────────────────────
  const handleApprove = async (artist: Artist) => {
    if (!user) return;
    setProcessing(true);
    const result = await approveArtist(artist.id, artist.user_id, user.id);
    if (result.success) {
      toast.success('Artist approved — profile is now live on Vowza!');
      setSelected(null);
      load(); loadCounts();
    } else {
      toast.error(result.message);
    }
    setProcessing(false);
  };

  // ── Reject ──────────────────────────────────────────────────────────────
  const handleReject = async () => {
    if (!user || !rejectModalFor) return;
    const reason = rejectReason === 'Other' ? rejectOther.trim() : rejectReason;
    if (!reason) { toast.error('Select or enter a rejection reason'); return; }
    setProcessing(true);
    const result = await rejectArtist(rejectModalFor.id, rejectModalFor.user_id, user.id, reason);
    if (result.success) {
      toast.success('Artist rejected and notified');
      setRejectModalFor(null); setRejectReason(''); setRejectOther('');
      setSelected(null);
      load(); loadCounts();
    } else {
      toast.error(result.message);
    }
    setProcessing(false);
  };

  // ── Suspend ─────────────────────────────────────────────────────────────
  const handleSuspend = async (artist: Artist) => {
    if (!user) return;
    const reason = prompt('Enter suspension reason:');
    if (!reason) return;
    setProcessing(true);
    const result = await suspendArtist(artist.id, artist.user_id, user.id, reason);
    if (result.success) { toast.success('Artist suspended'); load(); loadCounts(); }
    else toast.error(result.message);
    setProcessing(false);
  };

  // ── Delete ──────────────────────────────────────────────────────────────
  const handleDelete = async (artist: Artist) => {
    if (!confirm(`Permanently delete ${artist.full_name ?? 'this artist'}? This cannot be undone.`)) return;
    await supabase.from('provider_profiles').delete().eq('id', artist.id);
    toast.success('Artist deleted');
    load(); loadCounts();
  };

  const exportCSV = () => {
    const rows = [
      ['Name','Email','Phone','Profession','City','Status','Joined'],
      ...filtered.map(a => [a.full_name||'',a.email||'',a.phone||'',a.profession||'',a.city||'',a.verification_status,a.created_at]),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const el = document.createElement('a');
    el.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    el.download = `artists_${tab}.csv`;
    el.click();
  };

  const statusBadge = (s: string) => {
    const m: Record<string, string> = {
      approved:  'bg-emerald-50 text-emerald-700 border-emerald-200',
      rejected:  'bg-red-50 text-red-700 border-red-200',
      pending:   'bg-amber-50 text-amber-700 border-amber-200',
      suspended: 'bg-gray-100 text-gray-600 border-gray-200',
    };
    return `text-[10px] font-semibold border px-2 py-0.5 rounded-full ${m[s] ?? 'bg-muted text-muted-foreground'}`;
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Artist Management</h1>
          <p className="text-sm text-muted-foreground">
            {counts.pending > 0 && <span className="text-amber-600 font-semibold">{counts.pending} pending</span>}
            {counts.pending > 0 && ' · '}
            {counts.approved} approved · {counts.rejected} rejected
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { load(); loadCounts(); }} className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-secondary">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-secondary">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-secondary rounded-xl w-fit border border-border/50">
        {(Object.entries(TAB_CONFIG) as [Tab, typeof TAB_CONFIG[Tab]][]).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => { setTab(key); setPage(0); }}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
              tab === key
                ? 'bg-white dark:bg-gray-900 shadow-xs text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <cfg.icon className={`w-4 h-4 ${tab === key ? cfg.color : ''}`} />
            {cfg.label}
            <span className={cn(
              'text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-0.5',
              tab === key
                ? key === 'pending' ? 'bg-amber-100 text-amber-700'
                  : key === 'approved' ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-red-100 text-red-700'
                : 'bg-muted text-muted-foreground'
            )}>
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* Pending alert */}
      {tab === 'pending' && counts.pending > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            {counts.pending} artist{counts.pending > 1 ? 's' : ''} waiting for verification.
            Review each profile carefully before approving.
          </p>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name, email, profession…"
          className="input-premium pl-9 py-2.5 text-sm w-full"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1a1a24] rounded-2xl border border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-surface-2">
                {['Artist', 'Profession', 'City', 'Mobile', 'Applied', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/40">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="skeleton h-4 rounded w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-muted-foreground">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No {tab} artists found</p>
                  </td>
                </tr>
              ) : filtered.map(a => (
                <tr key={a.id} className="border-b border-border/40 hover:bg-surface-2 transition-colors">
                  {/* Artist */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {a.avatar_url ? (
                        <img src={a.avatar_url} alt="" loading="lazy" className="w-9 h-9 rounded-xl object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-gradient-maroon flex items-center justify-center flex-shrink-0">
                          <span className="text-[11px] font-bold text-white">{(a.full_name || a.profession || '?').charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-xs text-foreground">{a.full_name || 'Unknown'}</p>
                        <p className="text-[10px] text-muted-foreground">{a.email || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground capitalize">{a.profession?.replace(/_/g, ' ') || '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{a.city || '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{a.phone || '—'}</td>
                  <td className="px-4 py-3 text-[10px] text-muted-foreground">
                    {new Date(a.created_at).toLocaleDateString('en-IN')}
                    {a.verified_at && (
                      <p className="text-[9px] text-emerald-600 mt-0.5">
                        ✓ {new Date(a.verified_at).toLocaleDateString('en-IN')}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={statusBadge(a.verification_status)}>{a.verification_status}</span>
                    {a.rejection_reason && (
                      <p className="text-[9px] text-red-500 mt-1 max-w-[120px] truncate" title={a.rejection_reason}>
                        {a.rejection_reason}
                      </p>
                    )}
                  </td>
                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      {/* View details */}
                      <button
                        onClick={() => setSelected(a)}
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                        title="View Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {/* Approve */}
                      {a.verification_status !== 'approved' && (
                        <button
                          onClick={() => handleApprove(a)}
                          disabled={processing}
                          className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 disabled:opacity-40"
                          title="Approve"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Reject */}
                      {a.verification_status !== 'rejected' && (
                        <button
                          onClick={() => { setRejectModalFor(a); setRejectReason(''); setRejectOther(''); }}
                          disabled={processing}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 disabled:opacity-40"
                          title="Reject"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Suspend (approved only) */}
                      {a.verification_status === 'approved' && (
                        <button
                          onClick={() => handleSuspend(a)}
                          disabled={processing}
                          className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-500 disabled:opacity-40"
                          title="Suspend"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(a)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border/60">
          <p className="text-xs text-muted-foreground">
            Showing {Math.min(page * PAGE_SIZE + 1, total)}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-1">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-secondary">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-secondary">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Artist Detail Drawer */}
      {selected && (
        <AdminArtistDetail
          artist={selected}
          onClose={() => setSelected(null)}
          onApprove={() => handleApprove(selected)}
          onReject={() => { setRejectModalFor(selected); setSelected(null); }}
          onSuspend={() => { handleSuspend(selected); setSelected(null); }}
          processing={processing}
        />
      )}

      {/* Reject Modal */}
      {rejectModalFor && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl border border-border p-6 w-full max-w-md shadow-2xl space-y-4 animate-scale-in">
            <h2 className="font-display font-bold text-foreground">Reject Artist</h2>
            <p className="text-sm text-muted-foreground">
              Rejecting <strong>{rejectModalFor.full_name || 'this artist'}</strong>.
              Select a reason — the artist will be notified.
            </p>

            <div className="space-y-2">
              {REJECT_REASONS.map(r => (
                <label key={r} className="flex items-center gap-2.5 cursor-pointer group">
                  <div
                    onClick={() => setRejectReason(r)}
                    className={cn(
                      'w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors',
                      rejectReason === r ? 'border-red-500 bg-red-500' : 'border-border group-hover:border-red-300'
                    )}
                  >
                    {rejectReason === r && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span className="text-sm text-foreground">{r}</span>
                </label>
              ))}
            </div>

            {rejectReason === 'Other' && (
              <textarea
                value={rejectOther}
                onChange={e => setRejectOther(e.target.value)}
                placeholder="Describe the reason…"
                rows={3}
                className="input-premium text-sm w-full resize-none"
              />
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setRejectModalFor(null); setRejectReason(''); setRejectOther(''); }}
                className="btn-outline flex-1 justify-center py-2.5 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={processing || !rejectReason || (rejectReason === 'Other' && !rejectOther.trim())}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {processing ? 'Rejecting…' : 'Reject & Notify Artist'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
