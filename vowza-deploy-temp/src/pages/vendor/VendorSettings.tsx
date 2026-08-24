// VendorSettings — full profile management with working photo + cover upload.
// Avatar writes to profiles.avatar_url, cover writes to provider_profiles.cover_image_url.
// Both update everywhere instantly (navbar, sidebar, dashboard, public profile) because
// AuthContext.refreshProfile + React Query invalidation are triggered on success.
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ImageUpload from '@/components/ImageUpload';
import { useVendorId, useVendorRealtime } from '@/hooks/useVendorData';
import {
  User, Phone, MapPin, Save, Globe, Instagram, Youtube,
  Briefcase, Languages as LangIcon, IndianRupee, Loader2, Facebook,
} from 'lucide-react';

const LANGUAGE_OPTIONS = [
  'English', 'Hindi', 'Telugu', 'Tamil', 'Kannada', 'Malayalam',
  'Marathi', 'Bengali', 'Gujarati', 'Punjabi', 'Urdu', 'Odia',
];

export default function VendorSettings() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();

  const { data: provider } = useVendorId();
  const vendorId = provider?.id ?? null;
  useVendorRealtime(vendorId);

  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl]   = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name: '', stage_name: '', phone: '', whatsapp: '',
    city: '', state: '', area: '',
    bio: '', experience_years: '', price_min: '',
    languages: [] as string[],
    instagram: '', youtube: '', facebook: '', website: '',
  });

  // ── Hydrate from DB ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).limit(1);
      const p = (prof?.[0] as any) ?? {};

      const { data: prov } = await supabase.from('provider_profiles').select('*').eq('user_id', user.id).limit(1);
      const v = (prov?.[0] as any) ?? {};
      const social = v.social_links ?? {};

      setAvatarUrl(p.avatar_url ?? null);
      setCoverUrl(v.cover_image_url ?? null);

      setForm({
        full_name:        p.full_name ?? '',
        stage_name:       v.stage_name ?? '',
        phone:            p.phone ?? '',
        whatsapp:         v.whatsapp ?? '',
        city:             p.city ?? '',
        state:            p.state ?? '',
        area:             p.area ?? '',
        bio:              v.bio ?? '',
        experience_years: v.experience_years != null ? String(v.experience_years) : '',
        price_min:        v.price_min != null ? String(v.price_min) : '',
        languages:        Array.isArray(v.languages) ? v.languages : [],
        instagram:        social.instagram ?? v.instagram ?? '',
        youtube:          social.youtube   ?? v.youtube   ?? '',
        facebook:         social.facebook  ?? v.facebook  ?? '',
        website:          social.website   ?? v.website   ?? '',
      });
    })();
  }, [user]);

  // ── Avatar uploaded → persist to profiles + refresh everywhere ────────────
  const onAvatarUploaded = async (url: string) => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update({ avatar_url: url } as any).eq('id', user.id);
    if (error) { toast.error(error.message); return; }
    setAvatarUrl(url);
    // Refresh every consumer: navbar, sidebar, dashboard, public profile
    qc.invalidateQueries({ queryKey: ['vendor-id'] });
    qc.invalidateQueries({ queryKey: ['artists'] });
    qc.invalidateQueries({ queryKey: ['artist'] });
  };

  // ── Cover uploaded → persist to provider_profiles ─────────────────────────
  const onCoverUploaded = async (url: string) => {
    if (!vendorId) { toast.error('Provider profile not found'); return; }
    const { error } = await supabase
      .from('provider_profiles')
      .update({ cover_image_url: url } as any)
      .eq('id', vendorId);
    if (error) { toast.error(error.message); return; }
    setCoverUrl(url);
    qc.invalidateQueries({ queryKey: ['vendor-id'] });
    qc.invalidateQueries({ queryKey: ['artists'] });
  };

  const toggleLanguage = (lang: string) =>
    setForm(f => ({
      ...f,
      languages: f.languages.includes(lang)
        ? f.languages.filter(l => l !== lang)
        : [...f.languages, lang],
    }));

  // ── Save all text fields ──────────────────────────────────────────────────
  const handleSave = async () => {
    if (!user) return;
    if (!form.full_name.trim()) { toast.error('Full name is required'); return; }

    setSaving(true);
    try {
      const { error: pErr } = await supabase.from('profiles').update({
        full_name: form.full_name.trim(),
        phone:     form.phone.trim() || null,
        city:      form.city.trim() || null,
        state:     form.state.trim() || null,
        area:      form.area.trim() || null,
      } as any).eq('id', user.id);
      if (pErr) throw new Error(pErr.message);

      if (vendorId) {
        const { error: vErr } = await supabase.from('provider_profiles').update({
          stage_name:       form.stage_name.trim() || null,
          bio:              form.bio.trim() || null,
          whatsapp:         form.whatsapp.trim() || null,
          experience_years: form.experience_years ? Number(form.experience_years) : null,
          price_min:        form.price_min ? Number(form.price_min) : null,
          languages:        form.languages,
          social_links: {
            instagram: form.instagram.trim(),
            youtube:   form.youtube.trim(),
            facebook:  form.facebook.trim(),
            website:   form.website.trim(),
          },
        } as any).eq('id', vendorId);
        if (vErr) throw new Error(vErr.message);
      }

      toast.success('Profile updated successfully');
      qc.invalidateQueries({ queryKey: ['vendor-id'] });
      qc.invalidateQueries({ queryKey: ['artists'] });
      qc.invalidateQueries({ queryKey: ['artist'] });
    } catch (e: any) {
      toast.error(e.message ?? 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  // ── Field primitives (defined outside render tree to keep focus) ──────────
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-6 max-w-[820px]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Profile Settings</h1>
          <p className="text-sm text-muted-foreground">Manage how customers see you on Vowza</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#8B1538] text-white text-sm font-semibold hover:bg-[#8B1538]/90 transition-colors disabled:opacity-50">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Changes</>}
        </button>
      </div>

      {/* Cover photo */}
      <div className="bg-white rounded-2xl border border-border/60 p-6">
        <h3 className="text-sm font-semibold text-foreground mb-1">Cover Photo</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Shown as the banner on your public profile. Wide images work best (3:1).
        </p>
        <ImageUpload
          value={coverUrl}
          onUploaded={onCoverUploaded}
          variant="cover"
          folder="covers"
          filePrefix={vendorId ?? user?.id ?? 'cover'}
          className="w-full"
        />
      </div>

      {/* Profile photo */}
      <div className="bg-white rounded-2xl border border-border/60 p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Profile Photo</h3>
        <div className="flex items-center gap-5 flex-wrap">
          <ImageUpload
            value={avatarUrl}
            onUploaded={onAvatarUploaded}
            variant="avatar"
            folder="avatars"
            filePrefix={user?.id ?? 'avatar'}
          />
          <div>
            <p className="text-sm font-medium text-foreground">Upload a clear photo of yourself</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Click the camera icon or drag an image onto the photo.<br />
              JPG, PNG or WEBP · up to 10 MB · cropped to a square automatically.
            </p>
          </div>
        </div>
      </div>

      {/* Basic information */}
      <div className="bg-white rounded-2xl border border-border/60 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Basic Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1.5">Full Name *</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={form.full_name} onChange={set('full_name')} placeholder="Your legal name"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border/60 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1.5">Business / Stage Name</label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={form.stage_name} onChange={set('stage_name')} placeholder="e.g. Lens & Light Studio"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border/60 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1.5">Phone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={form.phone} onChange={set('phone')} placeholder="10-digit mobile number"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border/60 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1.5">WhatsApp</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={form.whatsapp} onChange={set('whatsapp')} placeholder="If different from phone"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border/60 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20" />
            </div>
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="bg-white rounded-2xl border border-border/60 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Location</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {([
            { key: 'city'  as const, label: 'City',  placeholder: 'Hyderabad' },
            { key: 'state' as const, label: 'State', placeholder: 'Telangana' },
            { key: 'area'  as const, label: 'Area',  placeholder: 'Hitech City' },
          ]).map(f => (
            <div key={f.key}>
              <label className="text-xs font-semibold text-foreground block mb-1.5">{f.label}</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input value={form[f.key]} onChange={set(f.key)} placeholder={f.placeholder}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border/60 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Professional details */}
      <div className="bg-white rounded-2xl border border-border/60 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Professional Details</h3>

        <div>
          <label className="text-xs font-semibold text-foreground block mb-1.5">About You</label>
          <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
            rows={5} placeholder="Describe your style, experience and what makes your work distinctive. Customers read this before booking."
            className="w-full px-4 py-3 rounded-xl border border-border/60 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20 resize-none leading-relaxed" />
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {form.bio.trim().length} characters · aim for at least 150
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1.5">Experience (years)</label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="number" min="0" value={form.experience_years} onChange={set('experience_years')} placeholder="3"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border/60 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1.5">Starting Price (₹)</label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="number" min="0" value={form.price_min} onChange={set('price_min')} placeholder="15000"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border/60 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20" />
            </div>
          </div>
        </div>

        {/* Languages */}
        <div>
          <label className="text-xs font-semibold text-foreground block mb-2 flex items-center gap-1.5">
            <LangIcon className="w-3.5 h-3.5 text-muted-foreground" /> Languages Spoken
          </label>
          <div className="flex flex-wrap gap-2">
            {LANGUAGE_OPTIONS.map(lang => {
              const on = form.languages.includes(lang);
              return (
                <button key={lang} type="button" onClick={() => toggleLanguage(lang)}
                  className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                    on
                      ? 'bg-[#8B1538] text-white border-[#8B1538]'
                      : 'bg-white text-muted-foreground border-border hover:border-[#8B1538]/40 hover:text-foreground')}>
                  {lang}
                </button>
              );
            })}
          </div>
          {form.languages.length === 0 && (
            <p className="text-[11px] text-muted-foreground mt-2">Select at least one language.</p>
          )}
        </div>
      </div>

      {/* Social links */}
      <div className="bg-white rounded-2xl border border-border/60 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Social Links</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {([
            { key: 'instagram' as const, label: 'Instagram', icon: Instagram, placeholder: 'https://instagram.com/yourhandle' },
            { key: 'youtube'   as const, label: 'YouTube',   icon: Youtube,   placeholder: 'https://youtube.com/@yourchannel' },
            { key: 'facebook'  as const, label: 'Facebook',  icon: Facebook,  placeholder: 'https://facebook.com/yourpage' },
            { key: 'website'   as const, label: 'Website',   icon: Globe,     placeholder: 'https://yourwebsite.com' },
          ]).map(f => (
            <div key={f.key}>
              <label className="text-xs font-semibold text-foreground block mb-1.5">{f.label}</label>
              <div className="relative">
                <f.icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input value={form[f.key]} onChange={set(f.key)} placeholder={f.placeholder}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border/60 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1538]/20" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky save on mobile */}
      <div className="md:hidden sticky bottom-4">
        <button onClick={handleSave} disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#8B1538] text-white text-sm font-semibold shadow-lg hover:bg-[#8B1538]/90 transition-colors disabled:opacity-50">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Changes</>}
        </button>
      </div>
    </div>
  );
}
