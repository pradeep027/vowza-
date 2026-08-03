// ─── Admin Artist Detail Drawer ───────────────────────────────────────────────
// Side drawer: fetches full provider record from DB by UUID on open.
// Fixes: "Provider not found", heavy backdrop blur, checklist inconsistency.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  X, User, Briefcase, Image as ImageIcon, Shield, CheckCircle,
  MapPin, Phone, Mail, Globe, Instagram, Star, ExternalLink,
  FileText, Camera, AlertCircle, RefreshCw, Loader2,
} from 'lucide-react';

interface Artist {
  id: string; user_id: string; profession: string;
  verification_status: string; experience_years?: number;
  bio?: string; created_at: string; verified_at?: string;
  rejection_reason?: string; vendor_details?: any;
  gallery_urls?: string[]; service_areas?: string[];
  languages?: string[]; social_links?: any;
  full_name?: string; email?: string; phone?: string;
  city?: string; state?: string; area?: string; avatar_url?: string;
  price_min?: number;
}

interface ProviderData {
  profile: any;
  provider: any;
  portfolio: any[];
}

interface CheckItem { key: string; label: string; checked: boolean; }

interface Props {
  artist: Artist;
  onClose:   () => void;
  onApprove: () => void;
  onReject:  () => void;
  onSuspend: () => void;
  processing: boolean;
}

export default function AdminArtistDetail({ artist, onClose, onApprove, onReject, onSuspend, processing }: Props) {
  const [activeTab, setActiveTab] = useState<'info' | 'portfolio' | 'docs' | 'checklist'>('info');

  // Full provider data fetched fresh from DB on every open
  const [providerData, setProviderData] = useState<ProviderData | null>(null);
  const [providerLoading, setProviderLoading] = useState(true);
  const [providerError, setProviderError] = useState<string | null>(null);

  // Checklist — only populated after successful DB fetch
  const [checklist, setChecklist] = useState<CheckItem[]>([]);

  // ── Fetch full provider record by UUID ──────────────────────────────────────
  const fetchProvider = useCallback(async (retryCount = 0) => {
    setProviderLoading(true);
    setProviderError(null);
    try {
      // 1. Fetch provider_profiles row by its own UUID (artist.id IS provider_profiles.id)
      const { data: provider, error: pErr } = await supabase
        .from('provider_profiles')
        .select('*')
        .eq('id', artist.id)
        .single();

      if (pErr || !provider) {
        throw new Error(pErr?.message ?? 'Provider record not found in database');
      }

      // 2. Fetch profile (name, email, phone, avatar) by user_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, avatar_url, city, state, area')
        .eq('id', provider.user_id)
        .maybeSingle();

      // 3. Fetch portfolio items by provider_id
      const { data: portfolio } = await supabase
        .from('portfolio_items')
        .select('*')
        .eq('provider_id', artist.id)
        .order('created_at', { ascending: false })
        .limit(12);

      setProviderData({ provider, profile: profile ?? {}, portfolio: portfolio ?? [] });
    } catch (err: any) {
      console.error('[AdminArtistDetail] fetchProvider error:', err);
      // Auto-retry once
      if (retryCount === 0) {
        setTimeout(() => fetchProvider(1), 1500);
      } else {
        setProviderError(err.message ?? 'Failed to load artist data');
        setProviderLoading(false);
      }
      return;
    }
    setProviderLoading(false);
  }, [artist.id]);

  // Fetch on every new artist selection; reset state first
  useEffect(() => {
    setProviderData(null);
    setProviderError(null);
    setChecklist([]);
    setActiveTab('info');
    fetchProvider(0);
  }, [artist.id, fetchProvider]);

  // Populate checklist ONLY after providerData is loaded (fixes contradictory state)
  useEffect(() => {
    if (!providerData) return;
    const { provider, profile, portfolio } = providerData;
    const d = provider.vendor_details ?? {};
    setChecklist([
      { key: 'phone',     label: 'Mobile Verified',               checked: !!profile?.phone                             },
      { key: 'email',     label: 'Email Verified',                checked: !!profile?.email                             },
      { key: 'selfie',    label: 'Selfie Uploaded',               checked: !!d.selfie_url                               },
      { key: 'aadhaar',   label: 'Aadhaar Card Uploaded',         checked: !!d.aadhaar_url                              },
      { key: 'govtid',    label: 'Government ID Uploaded',        checked: !!d.govt_id_url                              },
      { key: 'portfolio', label: 'Portfolio Uploaded (≥2 items)', checked: (provider.gallery_urls?.length ?? 0) >= 2 || portfolio.length >= 2 },
      { key: 'bio',       label: 'Profile Complete (Bio)',        checked: (provider.bio?.trim()?.length ?? 0) > 20     },
    ]);
  }, [providerData]);

  const toggleCheck = (key: string) => {
    setChecklist(prev => prev.map(c => c.key === key ? { ...c, checked: !c.checked } : c));
  };

  // Derived values — only meaningful when providerData is loaded
  const allChecked = checklist.length > 0 && checklist.every(c => c.checked);
  const doneCount  = checklist.filter(c => c.checked).length;

  const isPending  = artist.verification_status === 'pending';
  const isApproved = artist.verification_status === 'approved';

  // Shorthand refs into loaded data
  const prov    = providerData?.provider ?? {};
  const prof    = providerData?.profile  ?? {};
  const portf   = providerData?.portfolio ?? [];
  const d       = prov.vendor_details ?? {};
  const social  = prov.social_links   ?? {};

  // Display name / avatar: prefer fresh DB data, fall back to prop
  const displayName   = prof.full_name  || artist.full_name  || 'Unknown Artist';
  const displayAvatar = prof.avatar_url || artist.avatar_url || null;
  const displayProf   = prov.profession || artist.profession || '';

  const TABS = [
    { id: 'info',      label: 'Profile',   icon: User        },
    { id: 'portfolio', label: 'Portfolio', icon: ImageIcon   },
    { id: 'docs',      label: 'Documents', icon: Shield      },
    { id: 'checklist', label: 'Checklist', icon: CheckCircle },
  ] as const;

  const InfoRow = ({ label, value }: { label: string; value?: string }) =>
    value ? (
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm text-foreground">{value}</p>
      </div>
    ) : null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop — bg-black/25 only, NO backdrop-blur so admin list stays readable */}
      <div className="flex-1 bg-black/25" onClick={onClose} />

      {/* Drawer */}
      <div className="w-full max-w-xl bg-background border-l border-border/60 flex flex-col shadow-2xl overflow-hidden animate-slide-right">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            {displayAvatar ? (
              <img src={displayAvatar} alt="" className="w-10 h-10 rounded-xl object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-maroon flex items-center justify-center">
                <span className="text-sm font-bold text-white">{displayName.charAt(0).toUpperCase()}</span>
              </div>
            )}
            <div>
              <h2 className="font-display font-bold text-foreground text-base">{displayName}</h2>
              <p className="text-xs text-muted-foreground capitalize">{displayProf.replace(/_/g, ' ') || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('text-[10px] font-bold border px-2.5 py-1 rounded-full', {
              'bg-amber-50 text-amber-700 border-amber-200':     isPending,
              'bg-emerald-50 text-emerald-700 border-emerald-200': isApproved,
              'bg-red-50 text-red-700 border-red-200':           !isPending && !isApproved,
            })}>
              {artist.verification_status}
            </span>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-border/60 flex-shrink-0 overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap flex-shrink-0',
                activeTab === t.id ? 'border-maroon text-maroon' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
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

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* ── Loading skeleton ── */}
          {providerLoading && (
            <div className="space-y-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-4 bg-muted rounded w-2/3" />
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-24 bg-muted rounded-2xl w-full" />
            </div>
          )}

          {/* ── Error state ── */}
          {!providerLoading && providerError && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">Unable to load artist information</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">{providerError}</p>
              </div>
              <button
                onClick={() => fetchProvider(0)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-secondary"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
            </div>
          )}

          {/* ── Tabs content — only render when data loaded ── */}
          {!providerLoading && !providerError && providerData && (
            <>
              {/* ── Profile Info ── */}
              {activeTab === 'info' && (
                <>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Basic Information</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <InfoRow label="Full Name" value={prof.full_name} />
                      <InfoRow label="Mobile"    value={prof.phone} />
                      <InfoRow label="Email"     value={prof.email} />
                      <InfoRow label="City"      value={prof.city} />
                      <InfoRow label="State"     value={prof.state} />
                      <InfoRow label="Area"      value={prof.area} />
                    </div>
                  </div>

                  <div className="border-t border-border/40 pt-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Professional Information</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <InfoRow label="Profession"    value={prov.profession?.replace(/_/g, ' ')} />
                      <InfoRow label="Experience"    value={prov.experience_years ? `${prov.experience_years} years` : undefined} />
                      <InfoRow label="Languages"     value={Array.isArray(prov.languages) ? prov.languages.join(', ') : undefined} />
                      <InfoRow label="Service Areas" value={Array.isArray(prov.service_areas) ? prov.service_areas.join(', ') : undefined} />
                      <InfoRow label="Price From"    value={prov.price_min ? `₹${prov.price_min.toLocaleString('en-IN')}` : undefined} />
                    </div>
                    {prov.bio && (
                      <div className="mt-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">About</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{prov.bio}</p>
                      </div>
                    )}
                  </div>

                  {d.selfie_url && (
                    <div className="border-t border-border/40 pt-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Identity Selfie</h3>
                      <img src={d.selfie_url} alt="Selfie" className="w-32 h-32 rounded-2xl object-cover border-2 border-border shadow" />
                    </div>
                  )}

                  {(social.instagram || social.youtube || social.website) && (
                    <div className="border-t border-border/40 pt-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Social Links</h3>
                      <div className="flex flex-wrap gap-2">
                        {social.instagram && (
                          <a href={social.instagram} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs font-medium">
                            <Instagram className="w-3.5 h-3.5" /> Instagram
                          </a>
                        )}
                        {social.website && (
                          <a href={social.website} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs font-medium">
                            <Globe className="w-3.5 h-3.5" /> Website
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {prov.rejection_reason && (
                    <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 rounded-2xl p-4">
                      <p className="text-xs font-bold text-red-700 mb-1">Previous Rejection Reason</p>
                      <p className="text-sm text-red-600">{prov.rejection_reason}</p>
                    </div>
                  )}
                </>
              )}

              {/* ── Portfolio ── */}
              {activeTab === 'portfolio' && (
                <>
                  {(prov.gallery_urls?.length ?? 0) > 0 && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                        Registration Gallery ({prov.gallery_urls.length} files)
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
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                        Portfolio Items ({portf.length})
                      </h3>
                      <div className="grid grid-cols-3 gap-2">
                        {portf.map((p: any) => (
                          <a key={p.id} href={p.media_url} target="_blank" rel="noopener noreferrer"
                            className="relative aspect-square rounded-xl overflow-hidden bg-muted border border-border group">
                            {p.media_type === 'video' ? (
                              <div className="w-full h-full flex items-center justify-center bg-secondary">
                                <ImageIcon className="w-6 h-6 text-muted-foreground" />
                                <span className="absolute bottom-1 left-1 text-[9px] bg-black/50 text-white px-1 rounded">VIDEO</span>
                              </div>
                            ) : (
                              <img src={p.media_url} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            )}
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
                </>
              )}

              {/* ── Documents ── */}
              {activeTab === 'docs' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 rounded-2xl p-4 flex gap-3">
                    <Shield className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700 leading-relaxed">
                      Verify that documents are genuine, readable, and match the selfie before approving.
                    </p>
                  </div>

                  {[
                    { label: 'Aadhaar Card',  url: d.aadhaar_url, required: true  },
                    { label: 'Government ID', url: d.govt_id_url, required: true  },
                    { label: 'PAN Card',      url: d.pan_url,     required: false },
                  ].map(doc => (
                    <div key={doc.label} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                          {doc.label}
                          {doc.required && <span className="text-red-500 text-[10px]">*Required</span>}
                        </p>
                        {doc.url ? (
                          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Uploaded
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">Not uploaded</span>
                        )}
                      </div>
                      {doc.url ? (
                        <div className="relative">
                          {doc.url.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
                            <img src={doc.url} alt={doc.label} className="w-full max-h-48 rounded-xl object-contain bg-surface-2 border border-border" />
                          ) : (
                            <div className="w-full h-24 rounded-xl bg-surface-2 border border-border flex items-center justify-center">
                              <FileText className="w-8 h-8 text-muted-foreground" />
                            </div>
                          )}
                          <a href={doc.url} target="_blank" rel="noopener noreferrer"
                            className="absolute top-2 right-2 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/90 dark:bg-gray-900/90 border border-border text-xs font-medium shadow">
                            <ExternalLink className="w-3 h-3" /> Open
                          </a>
                        </div>
                      ) : (
                        <div className="w-full h-20 rounded-xl bg-surface-2 border-2 border-dashed border-border flex items-center justify-center">
                          <p className="text-xs text-muted-foreground">Not submitted</p>
                        </div>
                      )}
                    </div>
                  ))}

                  {d.selfie_url && (
                    <div className="border-t border-border/40 pt-4">
                      <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-muted-foreground" /> Live Selfie (for document matching)
                      </p>
                      <img src={d.selfie_url} alt="Selfie" className="w-32 h-32 rounded-xl object-cover border border-border" />
                    </div>
                  )}
                </div>
              )}

              {/* ── Verification Checklist ── */}
              {activeTab === 'checklist' && (
                <div className="space-y-4">
                  <div className={cn('rounded-2xl border p-4',
                    allChecked
                      ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200'
                      : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200'
                  )}>
                    <div className="flex items-center gap-2">
                      {allChecked
                        ? <CheckCircle className="w-5 h-5 text-emerald-500" />
                        : <AlertCircle className="w-5 h-5 text-amber-500" />
                      }
                      <p className={cn('text-sm font-semibold', allChecked ? 'text-emerald-700' : 'text-amber-700')}>
                        {allChecked ? 'All checks passed — ready to approve' : `${doneCount} of ${checklist.length} checks completed`}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Manually verify each item and tick off before approving. You can still approve even if not all are ticked.
                  </p>

                  <div className="space-y-2">
                    {checklist.map(c => (
                      <label key={c.key}
                        className="flex items-center gap-3 p-3 rounded-xl border border-border/60 cursor-pointer hover:bg-surface-2 transition-colors"
                        onClick={() => toggleCheck(c.key)}
                      >
                        <div className={cn('w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                          c.checked ? 'bg-emerald-500 border-emerald-500' : 'border-border')}>
                          {c.checked && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <span className="text-sm text-foreground">{c.label}</span>
                        {c.checked && <span className="ml-auto text-[10px] font-bold text-emerald-600">✓ Verified</span>}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>{/* end content area */}

        {/* ── Action footer — pending artists only, disabled if error ── */}
        {isPending && (
          <div className="border-t border-border/60 p-4 flex gap-3 flex-shrink-0 bg-background">
            <button onClick={onReject} disabled={processing || providerLoading || !!providerError}
              className="flex-1 py-3 rounded-xl border-2 border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors disabled:opacity-50">
              {processing ? 'Processing…' : '✕ Reject'}
            </button>
            <button onClick={onApprove} disabled={processing || providerLoading || !!providerError}
              className="flex-1 py-3 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors disabled:opacity-50 shadow-lg">
              {processing ? 'Processing…' : providerLoading ? 'Loading…' : '✓ Approve Artist'}
            </button>
          </div>
        )}

        {/* ── Approved: show live badge + suspend ── */}
        {isApproved && !providerLoading && !providerError && (
          <div className="border-t border-border/60 p-4 flex gap-3 flex-shrink-0 bg-background">
            <div className="flex-1 py-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-semibold text-emerald-700">Profile Live on Vowza</span>
            </div>
            <button onClick={onSuspend} disabled={processing}
              className="px-4 py-3 rounded-xl border border-amber-200 text-amber-600 text-sm font-semibold hover:bg-amber-50 transition-colors disabled:opacity-50">
              Suspend
            </button>
          </div>
        )}

      </div>{/* end drawer */}
    </div>
  );
}
