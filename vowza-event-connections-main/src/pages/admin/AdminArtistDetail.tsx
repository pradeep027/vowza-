// ─── Admin Artist Detail Drawer ───────────────────────────────────────────────
// Side drawer showing full artist profile, documents, portfolio, selfie,
// verification checklist, and approve/reject actions.

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import {
  X, User, Briefcase, Image as ImageIcon, Shield, CheckCircle,
  MapPin, Phone, Mail, Globe, Instagram, Star, ExternalLink,
  FileText, Camera, AlertCircle, ChevronRight,
} from 'lucide-react';

interface Artist {
  id: string; user_id: string; profession: string;
  verification_status: string; experience_years: number;
  bio: string; created_at: string; verified_at?: string;
  rejection_reason?: string; vendor_details?: any;
  gallery_urls?: string[]; service_areas?: string[];
  languages?: string[]; social_links?: any;
  full_name?: string; email?: string; phone?: string;
  city?: string; state?: string; area?: string; avatar_url?: string;
}

interface Props {
  artist: Artist;
  onClose:   () => void;
  onApprove: () => void;
  onReject:  () => void;
  onSuspend: () => void;
  processing: boolean;
}

interface CheckItem { key: string; label: string; checked: boolean; }

export default function AdminArtistDetail({ artist, onClose, onApprove, onReject, onSuspend, processing }: Props) {
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'info' | 'portfolio' | 'docs' | 'checklist'>('info');
  const [checklist, setChecklist] = useState<CheckItem[]>([
    { key: 'phone',     label: 'Mobile Verified',              checked: false },
    { key: 'email',     label: 'Email Verified',               checked: false },
    { key: 'selfie',    label: 'Selfie Uploaded',              checked: false },
    { key: 'aadhaar',   label: 'Aadhaar Card Uploaded',        checked: false },
    { key: 'govtid',    label: 'Government ID Uploaded',        checked: false },
    { key: 'portfolio', label: 'Portfolio Uploaded (≥2 items)', checked: false },
    { key: 'bio',       label: 'Profile Complete (Bio)',        checked: false },
  ]);

  useEffect(() => {
    loadPortfolio();
    updateChecklist();
  }, [artist]);

  const loadPortfolio = async () => {
    const { data } = await supabase
      .from('portfolio_items')
      .select('*')
      .eq('provider_id', artist.id)
      .order('created_at', { ascending: false })
      .limit(12);
    setPortfolio(data ?? []);
  };

  const updateChecklist = () => {
    const d = artist.vendor_details ?? {};
    setChecklist([
      { key: 'phone',     label: 'Mobile Verified',              checked: !!artist.phone                },
      { key: 'email',     label: 'Email Verified',               checked: !!artist.email                },
      { key: 'selfie',    label: 'Selfie Uploaded',              checked: !!d.selfie_url                },
      { key: 'aadhaar',   label: 'Aadhaar Card Uploaded',        checked: !!d.aadhaar_url               },
      { key: 'govtid',    label: 'Government ID Uploaded',        checked: !!d.govt_id_url               },
      { key: 'portfolio', label: 'Portfolio Uploaded (≥2 items)', checked: (artist.gallery_urls?.length ?? 0) >= 2 },
      { key: 'bio',       label: 'Profile Complete (Bio)',        checked: (artist.bio?.trim()?.length ?? 0) > 20 },
    ]);
  };

  const toggleCheck = (key: string) => {
    setChecklist(prev => prev.map(c => c.key === key ? { ...c, checked: !c.checked } : c));
  };

  const allChecked  = checklist.every(c => c.checked);
  const doneCount   = checklist.filter(c => c.checked).length;
  const d           = artist.vendor_details ?? {};
  const social      = artist.social_links ?? {};
  const isPending   = artist.verification_status === 'pending';
  const isApproved  = artist.verification_status === 'approved';

  const TABS = [
    { id: 'info',      label: 'Profile',     icon: User      },
    { id: 'portfolio', label: 'Portfolio',   icon: ImageIcon },
    { id: 'docs',      label: 'Documents',   icon: Shield    },
    { id: 'checklist', label: 'Checklist',   icon: CheckCircle },
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
      {/* Backdrop */}
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="w-full max-w-xl bg-background border-l border-border/60 flex flex-col shadow-2xl overflow-hidden animate-slide-right">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            {artist.avatar_url ? (
              <img src={artist.avatar_url} alt="" className="w-10 h-10 rounded-xl object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-maroon flex items-center justify-center">
                <span className="text-sm font-bold text-white">{(artist.full_name || 'A').charAt(0).toUpperCase()}</span>
              </div>
            )}
            <div>
              <h2 className="font-display font-bold text-foreground text-base">{artist.full_name || 'Unknown Artist'}</h2>
              <p className="text-xs text-muted-foreground capitalize">{artist.profession?.replace(/_/g, ' ') || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('text-[10px] font-bold border px-2.5 py-1 rounded-full', {
              'bg-amber-50 text-amber-700 border-amber-200':   isPending,
              'bg-emerald-50 text-emerald-700 border-emerald-200': isApproved,
              'bg-red-50 text-red-700 border-red-200': artist.verification_status === 'rejected',
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
                activeTab === t.id
                  ? 'border-maroon text-maroon'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              {t.id === 'checklist' && (
                <span className={cn(
                  'text-[9px] font-bold px-1 py-0.5 rounded-full ml-0.5',
                  allChecked ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                )}>
                  {doneCount}/{checklist.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* ── Profile Info ── */}
          {activeTab === 'info' && (
            <>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Basic Information</h3>
                <div className="grid grid-cols-2 gap-3">
                  <InfoRow label="Full Name"  value={artist.full_name} />
                  <InfoRow label="Mobile"     value={artist.phone} />
                  <InfoRow label="Email"      value={artist.email} />
                  <InfoRow label="City"       value={artist.city} />
                  <InfoRow label="State"      value={artist.state} />
                  <InfoRow label="Area"       value={artist.area} />
                </div>
              </div>

              <div className="border-t border-border/40 pt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Professional Information</h3>
                <div className="grid grid-cols-2 gap-3">
                  <InfoRow label="Profession"  value={artist.profession?.replace(/_/g, ' ')} />
                  <InfoRow label="Experience"  value={artist.experience_years ? `${artist.experience_years} years` : undefined} />
                  <InfoRow label="Languages"   value={Array.isArray(artist.languages) ? artist.languages.join(', ') : undefined} />
                  <InfoRow label="Service Areas" value={Array.isArray(artist.service_areas) ? artist.service_areas.join(', ') : undefined} />
                </div>
                {artist.bio && (
                  <div className="mt-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">About</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{artist.bio}</p>
                  </div>
                )}
              </div>

              {/* Selfie */}
              {d.selfie_url && (
                <div className="border-t border-border/40 pt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Identity Selfie</h3>
                  <img src={d.selfie_url} alt="Selfie" className="w-32 h-32 rounded-2xl object-cover border-2 border-border shadow" />
                </div>
              )}

              {/* Social links */}
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

              {/* Rejection reason */}
              {artist.rejection_reason && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 rounded-2xl p-4">
                  <p className="text-xs font-bold text-red-700 mb-1">Previous Rejection Reason</p>
                  <p className="text-sm text-red-600">{artist.rejection_reason}</p>
                </div>
              )}
            </>
          )}

          {/* ── Portfolio ── */}
          {activeTab === 'portfolio' && (
            <>
              {/* Gallery URLs from registration */}
              {(artist.gallery_urls?.length ?? 0) > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                    Registration Gallery ({artist.gallery_urls!.length} files)
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {artist.gallery_urls!.map((url, i) => (
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

              {/* Portfolio items */}
              {portfolio.length > 0 && (
                <div className="border-t border-border/40 pt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                    Portfolio Items ({portfolio.length})
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {portfolio.map(p => (
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

              {(artist.gallery_urls?.length ?? 0) === 0 && portfolio.length === 0 && (
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
                { label: 'Aadhaar Card',   url: d.aadhaar_url,  required: true  },
                { label: 'Government ID',  url: d.govt_id_url,  required: true  },
                { label: 'PAN Card',       url: d.pan_url,      required: false },
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
                      <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                        Not uploaded
                      </span>
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

              {/* Selfie for comparison */}
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
              <div className={cn(
                'rounded-2xl border p-4',
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
                Manually verify each item and tick off before approving. You can still approve even if all are not ticked.
              </p>

              <div className="space-y-2">
                {checklist.map(c => (
                  <label
                    key={c.key}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border/60 cursor-pointer hover:bg-surface-2 transition-colors"
                  >
                    <div
                      onClick={() => toggleCheck(c.key)}
                      className={cn(
                        'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                        c.checked ? 'bg-emerald-500 border-emerald-500' : 'border-border'
                      )}
                    >
                      {c.checked && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <span className="text-sm text-foreground">{c.label}</span>
                    {c.checked && (
                      <span className="ml-auto text-[10px] font-bold text-emerald-600">✓ Verified</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action footer — only for pending artists */}
        {isPending && (
          <div className="border-t border-border/60 p-4 flex gap-3 flex-shrink-0 bg-background">
            <button
              onClick={onReject}
              disabled={processing}
              className="flex-1 py-3 rounded-xl border-2 border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {processing ? 'Processing…' : '✕ Reject'}
            </button>
            <button
              onClick={onApprove}
              disabled={processing}
              className="flex-1 py-3 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors disabled:opacity-50 shadow-lg"
            >
              {processing ? 'Processing…' : '✓ Approve Artist'}
            </button>
          </div>
        )}

        {/* Approved: show suspend option */}
        {isApproved && (
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
      </div>
    </div>
  );
}
