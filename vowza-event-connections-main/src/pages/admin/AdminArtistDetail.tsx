// AdminArtistDetail — Side drawer with full DB fetch by UUID (with user_id fallback)
// Fixes: .single() crash, "Provider not found", checklist inconsistency, backdrop blur
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  X, User, Image as ImageIcon, Shield, CheckCircle,
  Globe, Instagram, ExternalLink, FileText, Camera,
  AlertCircle, RefreshCw,
} from 'lucide-react';

interface Artist {
  id: string; user_id: string; profession: string;
  verification_status: string; experience_years?: number;
  bio?: string; created_at: string; verified_at?: string;
  rejection_reason?: string; vendor_details?: any;
  gallery_urls?: string[]; service_areas?: string[];
  languages?: string[]; social_links?: any;
  full_name?: string; email?: string; phone?: string;
  city?: string; state?: string; area?: string;
  avatar_url?: string; price_min?: number;
}
interface ProviderData { profile: any; provider: any; portfolio: any[]; }
interface CheckItem { key: string; label: string; checked: boolean; }
interface Props {
  artist: Artist;
  onClose: () => void; onApprove: () => void;
  onReject: () => void; onSuspend: () => void;
  processing: boolean;
}

export default function AdminArtistDetail({ artist, onClose, onApprove, onReject, onSuspend, processing }: Props) {
  const [activeTab, setActiveTab] = useState<'info'|'portfolio'|'docs'|'checklist'>('info');
  const [providerData, setProviderData] = useState<ProviderData | null>(null);
  const [providerLoading, setProviderLoading] = useState(true);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<CheckItem[]>([]);

  // ── Fetch: array queries only — NEVER .single() or .maybeSingle() ──────────
  const fetchProvider = useCallback(async (retryCount = 0) => {
    setProviderLoading(true);
    setProviderError(null);
    try {
      console.log('[Drawer] ── fetch START ──────────────────────');
      console.log('[Drawer] artist.id     :', artist.id);
      console.log('[Drawer] artist.user_id:', artist.user_id);

      // ── 1. provider_profiles: try by id first ──────────────────────────────
      console.log('[Drawer] Q1 table=provider_profiles filter=id eq', artist.id);
      const { data: byId, error: e1 } = await supabase
        .from('provider_profiles')
        .select('*')
        .eq('id', artist.id)
        .limit(1);                    // array — never throws on 0 rows

      console.log('[Drawer] Q1 rows:', byId?.length ?? 0, 'error:', e1?.message ?? 'none');

      let provider: any = byId && byId.length > 0 ? byId[0] : null;

      // ── 2. Fallback: try by user_id ─────────────────────────────────────────
      if (!provider && artist.user_id) {
        console.log('[Drawer] Q2 table=provider_profiles filter=user_id eq', artist.user_id);
        const { data: byUid, error: e2 } = await supabase
          .from('provider_profiles')
          .select('*')
          .eq('user_id', artist.user_id)
          .limit(1);
        console.log('[Drawer] Q2 rows:', byUid?.length ?? 0, 'error:', e2?.message ?? 'none');
        provider = byUid && byUid.length > 0 ? byUid[0] : null;
      }

      if (!provider) {
        throw new Error(
          `No provider_profiles row found.\n` +
          `  Tried id = ${artist.id}\n` +
          `  Tried user_id = ${artist.user_id}`
        );
      }

      console.log('[Drawer] provider found — id:', provider.id, 'status:', provider.verification_status);

      // ── 3. profiles table: array query ─────────────────────────────────────
      const uid = provider.user_id || artist.user_id;
      console.log('[Drawer] Q3 table=profiles filter=id eq', uid);
      const { data: profileRows, error: e3 } = await supabase
        .from('profiles')
        .select('id,full_name,email,phone,avatar_url,city,state,area')
        .eq('id', uid)
        .limit(1);
      console.log('[Drawer] Q3 rows:', profileRows?.length ?? 0, 'error:', e3?.message ?? 'none');
      const profile = profileRows && profileRows.length > 0 ? profileRows[0] : {};

      // ── 4. portfolio_items: already returns array ───────────────────────────
      console.log('[Drawer] Q4 table=portfolio_items filter=provider_id eq', provider.id);
      const { data: portfolio, error: e4 } = await supabase
        .from('portfolio_items')
        .select('id,media_url,media_type,title,created_at')
        .eq('provider_id', provider.id)
        .order('created_at', { ascending: false })
        .limit(20);
      console.log('[Drawer] Q4 rows:', portfolio?.length ?? 0, 'error:', e4?.message ?? 'none');

      setProviderData({ provider, profile, portfolio: portfolio ?? [] });
      console.log('[Drawer] ── fetch DONE ──────────────────────');

    } catch (err: any) {
      console.error('[Drawer] fetchProvider error:', err.message);
      if (retryCount === 0) {
        console.log('[Drawer] auto-retry in 1.5s...');
        setTimeout(() => fetchProvider(1), 1500);
        return;
      }
      setProviderError(err.message ?? 'Failed to load artist data');
    } finally {
      setProviderLoading(false);
    }
  }, [artist.id, artist.user_id]);

  // Reset + fetch on every new artist
  useEffect(() => {
    setProviderData(null); setProviderError(null);
    setChecklist([]); setActiveTab('info');
    fetchProvider(0);
  }, [artist.id, fetchProvider]);

  // Build checklist ONLY from fresh DB data — never from stale prop
  useEffect(() => {
    if (!providerData) return;
    const { provider, profile, portfolio } = providerData;
    const vd = provider.vendor_details ?? {};
    setChecklist([
      { key: 'phone',     label: 'Mobile Verified',         checked: !!profile?.phone },
      { key: 'email',     label: 'Email Verified',          checked: !!profile?.email },
      { key: 'selfie',    label: 'Selfie Uploaded',         checked: !!vd.selfie_url },
      { key: 'aadhaar',   label: 'Aadhaar Uploaded',        checked: !!vd.aadhaar_url },
      { key: 'govtid',    label: 'Govt ID Uploaded',        checked: !!vd.govt_id_url },
      { key: 'portfolio', label: 'Portfolio ≥ 2 items',     checked: (provider.gallery_urls?.length ?? 0) >= 2 || portfolio.length >= 2 },
      { key: 'bio',       label: 'Bio Complete (>20 chars)', checked: (provider.bio?.trim()?.length ?? 0) > 20 },
    ]);
  }, [providerData]);

  const toggleCheck = (key: string) =>
    setChecklist(p => p.map(c => c.key === key ? { ...c, checked: !c.checked } : c));

  const allChecked = checklist.length > 0 && checklist.every(c => c.checked);
  const doneCount  = checklist.filter(c => c.checked).length;

  // Use fresh DB status once loaded — prop may be stale after approve/reject
  const liveStatus = providerData
    ? (providerData.provider.verification_status as string)
    : artist.verification_status;

  const isPending  = liveStatus === 'pending';
  const isApproved = liveStatus === 'approved';
  const isRejected = liveStatus === 'rejected';

  const prov    = providerData?.provider ?? {};
  const prof    = providerData?.profile  ?? {};
  const portf   = providerData?.portfolio ?? [];
  const vd      = prov.vendor_details ?? {};
  const social  = prov.social_links   ?? {};

  // Header values: prefer fresh DB, fall back to prop
  const displayName   = prof.full_name  || artist.full_name  || 'Unknown Artist';
  const displayAvatar = prof.avatar_url || artist.avatar_url || null;
  const displayProf   = prov.profession || artist.profession || '';

  const TABS = [
    { id: 'info',      label: 'Profile',   icon: User        },
    { id: 'portfolio', label: 'Portfolio', icon: ImageIcon   },
    { id: 'docs',      label: 'Documents', icon: Shield      },
    { id: 'checklist', label: 'Checklist', icon: CheckCircle },
  ] as const;

  const Row = ({ label, value }: { label: string; value?: string | number }) =>
    value !== undefined && value !== null && value !== '' ? (
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm text-foreground">{String(value)}</p>
      </div>
    ) : null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop — NO blur, list stays readable */}
      <div className="flex-1 bg-black/25" onClick={onClose} />

      {/* Drawer panel */}
      <div className="w-full max-w-xl bg-background border-l border-border/60 flex flex-col shadow-2xl overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            {displayAvatar
              ? <img src={displayAvatar} alt="" className="w-10 h-10 rounded-xl object-cover" />
              : <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-red-700 flex items-center justify-center">
                  <span className="text-sm font-bold text-white">{displayName.charAt(0).toUpperCase()}</span>
                </div>
            }
            <div>
              <h2 className="font-bold text-foreground text-base">{displayName}</h2>
              <p className="text-xs text-muted-foreground capitalize">{displayProf.replace(/_/g,' ') || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('text-[10px] font-bold border px-2.5 py-1 rounded-full', {
              'bg-amber-50 text-amber-700 border-amber-200':     isPending,
              'bg-emerald-50 text-emerald-700 border-emerald-200': isApproved,
              'bg-red-50 text-red-700 border-red-200':           isRejected,
              'bg-gray-100 text-gray-600 border-gray-200':       !isPending && !isApproved && !isRejected,
            })}>
              {liveStatus}
            </span>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div className="flex border-b border-border/60 flex-shrink-0 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id as any)}
              className={cn('flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap',
                activeTab === t.id ? 'border-red-600 text-red-600' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              {t.id === 'checklist' && checklist.length > 0 && (
                <span className={cn('text-[9px] font-bold px-1 py-0.5 rounded-full ml-0.5',
                  allChecked ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                  {doneCount}/{checklist.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Loading skeleton */}
          {providerLoading && (
            <div className="space-y-4 animate-pulse">
              {[1,2,3,4,5].map(i => <div key={i} className="h-4 bg-muted rounded" style={{width:`${60+i*8}%`}} />)}
              <div className="h-28 bg-muted rounded-2xl w-full" />
            </div>
          )}

          {/* Error */}
          {!providerLoading && providerError && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-sm">Unable to load artist information</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">{providerError}</p>
              </div>
              <button onClick={() => fetchProvider(0)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-secondary">
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
            </div>
          )}

          {/* Tabs — only when loaded */}
          {!providerLoading && !providerError && providerData && (
            <>
              {/* PROFILE */}
              {activeTab === 'info' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Basic Information</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <Row label="Full Name"  value={prof.full_name} />
                      <Row label="Mobile"     value={prof.phone} />
                      <Row label="Email"      value={prof.email} />
                      <Row label="City"       value={prof.city} />
                      <Row label="State"      value={prof.state} />
                      <Row label="Area"       value={prof.area} />
                    </div>
                  </div>
                  <div className="border-t border-border/40 pt-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Professional</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <Row label="Profession"    value={prov.profession?.replace(/_/g,' ')} />
                      <Row label="Experience"    value={prov.experience_years ? `${prov.experience_years} yrs` : undefined} />
                      <Row label="Price From"    value={prov.price_min ? `₹${Number(prov.price_min).toLocaleString('en-IN')}` : undefined} />
                      <Row label="Languages"     value={Array.isArray(prov.languages) ? prov.languages.join(', ') : undefined} />
                      <Row label="Service Areas" value={Array.isArray(prov.service_areas) ? prov.service_areas.join(', ') : undefined} />
                    </div>
                    {prov.bio && (
                      <div className="mt-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Bio</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{prov.bio}</p>
                      </div>
                    )}
                  </div>
                  {vd.selfie_url && (
                    <div className="border-t border-border/40 pt-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Selfie</p>
                      <img src={vd.selfie_url} alt="Selfie" className="w-28 h-28 rounded-2xl object-cover border border-border" />
                    </div>
                  )}
                  {(social.instagram || social.website || social.youtube) && (
                    <div className="border-t border-border/40 pt-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Social Links</p>
                      <div className="flex flex-wrap gap-2">
                        {social.instagram && <a href={social.instagram} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs font-medium">
                          <Instagram className="w-3.5 h-3.5" /> Instagram</a>}
                        {social.website && <a href={social.website} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs font-medium">
                          <Globe className="w-3.5 h-3.5" /> Website</a>}
                      </div>
                    </div>
                  )}
                  {prov.rejection_reason && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                      <p className="text-xs font-bold text-red-700 mb-1">Previous Rejection Reason</p>
                      <p className="text-sm text-red-600">{prov.rejection_reason}</p>
                    </div>
                  )}
                </div>
              )}

              {/* PORTFOLIO */}
              {activeTab === 'portfolio' && (
                <div className="space-y-4">
                  {(prov.gallery_urls?.length ?? 0) > 0 && (
                    <div>
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
                        Registration Gallery ({prov.gallery_urls.length})
                      </h3>
                      <div className="grid grid-cols-3 gap-2">
                        {prov.gallery_urls.map((url: string, i: number) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                            className="relative aspect-square rounded-xl overflow-hidden bg-muted border border-border group">
                            <img src={url} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                              <ExternalLink className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {portf.length > 0 && (
                    <div className="border-t border-border/40 pt-4">
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Portfolio Items ({portf.length})</h3>
                      <div className="grid grid-cols-3 gap-2">
                        {portf.map((p: any) => (
                          <a key={p.id} href={p.media_url} target="_blank" rel="noopener noreferrer"
                            className="relative aspect-square rounded-xl overflow-hidden bg-muted border border-border group">
                            {p.media_type === 'video'
                              ? <div className="w-full h-full flex items-center justify-center bg-secondary text-[9px] text-muted-foreground">VIDEO</div>
                              : <img src={p.media_url} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {(prov.gallery_urls?.length ?? 0) === 0 && portf.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No portfolio uploaded yet</p>
                    </div>
                  )}
                </div>
              )}

              {/* DOCUMENTS */}
              {activeTab === 'docs' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3">
                    <Shield className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700 leading-relaxed">Verify all documents are genuine and match the selfie before approving.</p>
                  </div>
                  {([
                    { label: 'Aadhaar Card',  url: vd.aadhaar_url, req: true  },
                    { label: 'Government ID', url: vd.govt_id_url, req: true  },
                    { label: 'PAN Card',      url: vd.pan_url,     req: false },
                  ] as {label:string;url?:string;req:boolean}[]).map(doc => (
                    <div key={doc.label} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                          {doc.label}
                          {doc.req && <span className="text-red-500 text-[10px]">*</span>}
                        </p>
                        {doc.url
                          ? <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Uploaded</span>
                          : <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">Not uploaded</span>}
                      </div>
                      {doc.url
                        ? <div className="relative">
                            {doc.url.match(/\.(jpg|jpeg|png|webp|gif)$/i)
                              ? <img src={doc.url} alt={doc.label} className="w-full max-h-48 rounded-xl object-contain bg-secondary border border-border" />
                              : <div className="w-full h-24 rounded-xl bg-secondary border border-border flex items-center justify-center"><FileText className="w-8 h-8 text-muted-foreground" /></div>}
                            <a href={doc.url} target="_blank" rel="noopener noreferrer"
                              className="absolute top-2 right-2 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/90 border border-border text-xs font-medium shadow">
                              <ExternalLink className="w-3 h-3" /> Open
                            </a>
                          </div>
                        : <div className="w-full h-20 rounded-xl bg-secondary border-2 border-dashed border-border flex items-center justify-center">
                            <p className="text-xs text-muted-foreground">Not submitted</p>
                          </div>}
                    </div>
                  ))}
                  {vd.selfie_url && (
                    <div className="border-t border-border/40 pt-4">
                      <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-muted-foreground" /> Live Selfie
                      </p>
                      <img src={vd.selfie_url} alt="Selfie" className="w-32 h-32 rounded-xl object-cover border border-border" />
                    </div>
                  )}
                </div>
              )}

              {/* CHECKLIST */}
              {activeTab === 'checklist' && (
                <div className="space-y-4">
                  <div className={cn('rounded-2xl border p-4', allChecked
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-amber-50 border-amber-200')}>
                    <div className="flex items-center gap-2">
                      {allChecked ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <AlertCircle className="w-5 h-5 text-amber-500" />}
                      <p className={cn('text-sm font-semibold', allChecked ? 'text-emerald-700' : 'text-amber-700')}>
                        {allChecked ? 'All checks passed — ready to approve' : `${doneCount} of ${checklist.length} checks completed`}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Tick off each item after manual verification. You can still approve even if not all are ticked.</p>
                  <div className="space-y-2">
                    {checklist.map(c => (
                      <div key={c.key} onClick={() => toggleCheck(c.key)}
                        className="flex items-center gap-3 p-3 rounded-xl border border-border/60 cursor-pointer hover:bg-secondary transition-colors">
                        <div className={cn('w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0',
                          c.checked ? 'bg-emerald-500 border-emerald-500' : 'border-border')}>
                          {c.checked && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <span className="text-sm text-foreground">{c.label}</span>
                        {c.checked && <span className="ml-auto text-[10px] font-bold text-emerald-600">✓</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer actions ── */}
        {isPending && (
          <div className="border-t border-border/60 p-4 flex gap-3 flex-shrink-0 bg-background">
            <button onClick={onReject} disabled={processing || providerLoading || !!providerError}
              className="flex-1 py-3 rounded-xl border-2 border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors disabled:opacity-50">
              {processing ? 'Processing…' : '✕ Reject'}
            </button>
            <button onClick={onApprove} disabled={processing || providerLoading || !!providerError}
              className="flex-1 py-3 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors disabled:opacity-50 shadow-lg">
              {processing ? 'Processing…' : '✓ Approve Artist'}
            </button>
          </div>
        )}
        {isApproved && !providerLoading && !providerError && (
          <div className="border-t border-border/60 p-4 flex gap-3 flex-shrink-0 bg-background">
            <div className="flex-1 py-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-semibold text-emerald-700">Profile Live on Vowza</span>
            </div>
            <button onClick={onSuspend} disabled={processing}
              className="px-4 py-3 rounded-xl border border-amber-200 text-amber-600 text-sm font-semibold hover:bg-amber-50 disabled:opacity-50">
              Suspend
            </button>
          </div>
        )}
        {isRejected && !providerLoading && !providerError && (
          <div className="border-t border-border/60 p-4 flex gap-3 flex-shrink-0 bg-background">
            <div className="flex-1 py-3 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm font-semibold text-red-700">Artist Rejected</span>
            </div>
            <button onClick={onApprove} disabled={processing}
              className="px-4 py-3 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 disabled:opacity-50 transition-colors">
              Re-approve
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
