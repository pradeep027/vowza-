import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, Eye, EyeOff, X, Check,
  ChevronRight, ChevronLeft, Upload, Mic2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/errorMessage';

/* ─── Constants ─────────────────────────────────────────────────────────────── */
const PACKAGE_TYPES = [
  { value: 'Wedding Anchor', name: 'Wedding Anchor', inclusions: ['Event Hosting','Couple Introduction','Event Announcements','Games & Activities','Wedding Hosting'], deliverables: ['Full Event Hosting','Couple Introduction','Guest Engagement','Games Session'] },
  { value: 'Reception Host', name: 'Reception Host', inclusions: ['Event Hosting','Guest Engagement','Couple Introduction','Event Announcements'], deliverables: ['Reception Hosting','Guest Engagement','Announcements'] },
  { value: 'Engagement Host', name: 'Engagement Host', inclusions: ['Event Hosting','Couple Introduction','Games & Activities'], deliverables: ['Engagement Hosting','Couple Introduction','Activities'] },
  { value: 'Sangeet Host', name: 'Sangeet Host', inclusions: ['Event Hosting','Games & Activities','Audience Interaction','Stage Hosting'], deliverables: ['Sangeet Hosting','Games','Dance Coordination'] },
  { value: 'Haldi Host', name: 'Haldi Host', inclusions: ['Event Hosting','Audience Interaction','Games & Activities'], deliverables: ['Haldi Hosting','Audience Interaction','Games'] },
  { value: 'Mehendi Host', name: 'Mehendi Host', inclusions: ['Event Hosting','Audience Interaction','Music Coordination'], deliverables: ['Mehendi Hosting','Audience Engagement','Music'] },
  { value: 'Birthday Host', name: 'Birthday Host', inclusions: ['Event Hosting','Games & Activities','Audience Interaction','Event Announcements'], deliverables: ['Birthday Hosting','Games Session','Audience Interaction'] },
  { value: 'Corporate Event Host', name: 'Corporate Event Host', inclusions: ['Corporate Hosting','Event Coordination','Award Ceremony Hosting','Stage Hosting'], deliverables: ['Full Event Hosting','Corporate Script','Event Coordination'] },
  { value: 'Baraat Host', name: 'Baraat Host', inclusions: ['Baraat Hosting','Groom Welcome','Audience Engagement'], deliverables: ['Baraat Hosting','Music Coordination','Guest Engagement'] },
  { value: 'Stage Show Host', name: 'Stage Show Host', inclusions: ['Stage Hosting','Event Announcements','Audience Interaction'], deliverables: ['Full Stage Hosting','Script','Coordination'] },
  { value: 'College Fest Host', name: 'College Fest Host', inclusions: ['Event Hosting','Audience Interaction','Stage Hosting','Event Coordination'], deliverables: ['Fest Hosting','Crowd Engagement','Event Flow'] },
  { value: 'Anniversary Host', name: 'Anniversary Host', inclusions: ['Event Hosting','Couple Introduction','Music Coordination'], deliverables: ['Anniversary Hosting','Couple Engagement','Music'] },
  { value: 'Custom Package', name: 'Custom Package', inclusions: [], deliverables: [] },
];

const ALL_INCLUSIONS = ['Event Hosting','Stage Hosting','Audience Interaction','Guest Engagement','Couple Introduction','Event Announcements','Games & Activities','Wedding Hosting','Reception Hosting','Baraat Hosting','Corporate Hosting','Award Ceremony Hosting','Script Preparation','Bilingual Hosting','Event Coordination','Music Coordination','Groom Welcome','Audience Engagement'];
const ALL_DELIVERABLES = ['Full Event Hosting','Couple Introduction','Guest Engagement','Games Session','Announcements','Event Coordination','Script','Stage Management','Crowd Engagement','Dance Coordination','Music','Audience Interaction','Baraat Hosting','Groom Welcome'];
const ALL_COVERAGE = ['Full Event','Ceremony','Reception','Stage','Baraat','Multiple Sessions'];
const ADDON_TEMPLATES = ['Extra Hour','Second Anchor','Bilingual Hosting','Script Writing','Games Kit','Travel','Extended Event','Rehearsal Session'];
const STEP_LABELS = ['Package Type', 'Pricing', 'Inclusions', 'Coverage', 'Team', 'Deliverables', 'Add-ons', 'Gallery', 'Preview'];

const inputClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition placeholder:text-stone-400 focus:border-cyan-700 focus:ring-2 focus:ring-cyan-700/15';

/* ─── Types ─────────────────────────────────────────────────────────────────── */
type Addon = { name: string; price: string; description: string };

type Draft = {
  id?: string;
  name: string;
  description: string;
  package_type: string;
  status: string;
  package_price: string;
  advance_percentage: string;
  inclusions: string[];
  coverage: string[];
  lead_artist: string;
  assistant_artists: string;
  deliverables: string[];
  addons: Addon[];
  cover_file: File | null;
  cover_url: string;
  gallery_files: File[];
  gallery_urls: { id: string; url: string; is_cover: boolean }[];
  video_files: File[];
  video_urls: { id: string; url: string }[];
};

const blank = (): Draft => ({
  name: '',
  description: '',
  package_type: '',
  status: 'draft',
  package_price: '',
  advance_percentage: '20',
  inclusions: [],
  coverage: [],
  lead_artist: '1',
  assistant_artists: '0',
  deliverables: [],
  addons: [],
  cover_file: null,
  cover_url: '',
  gallery_files: [],
  gallery_urls: [],
  video_files: [],
  video_urls: [],
});

/* ─── Main Component ────────────────────────────────────────────────────────── */
export default function AnchorPackageManager({ provider }: { provider: { id: string } }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['anchor-packages', provider.id],
    queryFn: async () => {
      const r = await supabase.from('anchor_packages').select('*').eq('provider_id', provider.id).order('created_at', { ascending: false });
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['anchor-packages', provider.id] });
  useEffect(() => {
    const ch = supabase.channel(`anchor-packages-${provider.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'anchor_packages', filter: `provider_id=eq.${provider.id}` }, refresh).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [provider.id]);

  const handleTypeChange = (value: string) => {
    const sel = PACKAGE_TYPES.find(t => t.value === value);
    if (sel) setDraft({ ...draft!, package_type: value, name: sel.name, inclusions: [...sel.inclusions], deliverables: [...sel.deliverables] });
    else setDraft({ ...draft!, package_type: value });
  };

  const saveDraft = async () => {
    if (!draft) return;
    if (!draft.name.trim()) { toast.error('Package name is required'); return; }
    if (!draft.package_type) { toast.error('Package type is required'); return; }
    if (!draft.package_price || Number(draft.package_price) <= 0) { toast.error('Enter a valid price'); return; }
    if (!draft.cover_file && !draft.cover_url) { toast.error('Cover photo is required'); return; }

    setBusy(true);
    try {
      const payload: any = {
        provider_id: provider.id,
        name: draft.name.trim(),
        package_type: draft.package_type,
        description: draft.description.trim() || null,
        status: draft.status,
        package_price: Number(draft.package_price),
        advance_percentage: draft.advance_percentage ? Number(draft.advance_percentage) : 20,
        services_included: [...draft.coverage, ...draft.inclusions],
        deliverables: draft.deliverables,
        lead_anchor: Number(draft.lead_artist) || 1,
        assistant: Number(draft.assistant_artists) || 0,
      };

      let packageId = draft.id;
      if (draft.id) {
        const r = await supabase.from('anchor_packages').update(payload).eq('id', draft.id).select('id').single();
        if (r.error) throw r.error;
      } else {
        const r = await supabase.from('anchor_packages').insert(payload).select('id').single();
        if (r.error) throw r.error;
        packageId = r.data.id;
      }

      await uploadMediaForPackage(packageId, draft);

      toast.success(draft.id ? 'Package updated' : 'Package created');
      setDraft(null);
      setStep(1);
      refresh();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save package'));
    } finally {
      setBusy(false);
    }
  };

  const uploadMediaForPackage = async (packageId: string, draft: Draft) => {
    // Delete existing media
    await supabase.from('anchor_addons').delete().eq('package_id', packageId);
    await supabase.from('anchor_gallery').delete().eq('package_id', packageId);

    // Upload addons
    const validAddons = draft.addons.filter(a => a.name.trim());
    if (validAddons.length > 0) {
      await supabase.from('anchor_addons').insert(validAddons.map((a, i) => ({
        package_id: packageId,
        name: a.name.trim(),
        price: Number(a.price) || 0,
        description: a.description || null,
        sort_order: i
      })));
    }

    // Upload cover photo
    if (draft.cover_file) {
      const ext = draft.cover_file.name.split('.').pop();
      const path = `${user!.id}/${packageId}/cover-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('anchor-media').upload(path, draft.cover_file, { contentType: draft.cover_file.type });
      if (!upErr) {
        const url = supabase.storage.from('anchor-media').getPublicUrl(path).data.publicUrl;
        await supabase.from('anchor_gallery').insert({
          package_id: packageId,
          storage_path: path,
          public_url: url,
          is_cover: true,
          media_type: 'image',
          sort_order: 0
        });
      }
    }

    // Upload gallery photos
    if (draft.gallery_files.length > 0) {
      for (let i = 0; i < draft.gallery_files.length; i++) {
        const file = draft.gallery_files[i];
        const ext = file.name.split('.').pop();
        const path = `${user!.id}/${packageId}/gallery-${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('anchor-media').upload(path, file, { contentType: file.type });
        if (!upErr) {
          const url = supabase.storage.from('anchor-media').getPublicUrl(path).data.publicUrl;
          await supabase.from('anchor_gallery').insert({
            package_id: packageId,
            storage_path: path,
            public_url: url,
            is_cover: false,
            media_type: 'image',
            sort_order: draft.gallery_urls.length + i + 1
          });
        }
      }
    }

    // Upload videos
    if (draft.video_files.length > 0) {
      for (let i = 0; i < draft.video_files.length; i++) {
        const file = draft.video_files[i];
        const ext = file.name.split('.').pop();
        const path = `${user!.id}/${packageId}/video-${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('anchor-media').upload(path, file, { contentType: file.type });
        if (!upErr) {
          const url = supabase.storage.from('anchor-media').getPublicUrl(path).data.publicUrl;
          await supabase.from('anchor_gallery').insert({
            package_id: packageId,
            storage_path: path,
            public_url: url,
            is_cover: false,
            media_type: 'video',
            sort_order: 100 + i
          });
        }
      }
    }
  };

  const editPackage = async (pkg: any) => {
    let addons: Addon[] = [];
    try {
      const r = await supabase.from('anchor_addons').select('name, price, description').eq('package_id', pkg.id).order('sort_order');
      if (r.data) addons = r.data.map((a: any) => ({ name: a.name, price: String(a.price ?? ''), description: a.description || '' }));
    } catch { /* best-effort media load; keep the form usable if it fails */ }

    let galleryUrls: { id: string; url: string; is_cover: boolean }[] = [];
    let videoUrls: { id: string; url: string }[] = [];
    let coverUrl = '';
    try {
      const r = await supabase.from('anchor_gallery').select('id, public_url, is_cover, media_type').eq('package_id', pkg.id).order('sort_order');
      const g = (r.data ?? []).map((x: any) => ({ id: x.id, url: x.public_url, is_cover: x.is_cover }));
      coverUrl = g.find((x: any) => x.is_cover)?.url || '';
      galleryUrls = g.filter((x: any) => !x.is_cover && x.media_type === 'image');
      videoUrls = g.filter((x: any) => x.media_type === 'video').map((x: any) => ({ id: x.id, url: x.url }));
    } catch { /* best-effort media load; keep the form usable if it fails */ }

    const coverage = pkg.services_included?.filter((s: string) => ALL_COVERAGE.includes(s)) ?? [];
    const inclusions = pkg.services_included?.filter((s: string) => !ALL_COVERAGE.includes(s) && !ALL_DELIVERABLES.includes(s)) ?? [];

    setDraft({
      id: pkg.id,
      name: pkg.name || '',
      description: pkg.description || '',
      package_type: pkg.package_type,
      status: pkg.status || 'draft',
      package_price: String(pkg.package_price ?? ''),
      advance_percentage: String(pkg.advance_percentage ?? '20'),
      inclusions,
      coverage,
      lead_artist: String(pkg.lead_anchor ?? '1'),
      assistant_artists: String(pkg.assistant ?? '0'),
      deliverables: pkg.deliverables ?? [],
      addons,
      cover_file: null,
      cover_url: coverUrl,
      gallery_files: [],
      gallery_urls: galleryUrls,
      video_files: [],
      video_urls: videoUrls,
    });
    setStep(1);
  };

  const toggleStatus = async (pkg: any) => {
    await supabase.from('anchor_packages').update({ status: pkg.status === 'active' ? 'draft' : 'active' }).eq('id', pkg.id);
    refresh();
  };

  const removePackage = async (pkg: any) => {
    if (!confirm('Delete this package?')) return;
    await supabase.from('anchor_packages').delete().eq('id', pkg.id);
    refresh();
    toast.success('Deleted');
  };

  const ChipSelect = ({ options, selected, onChange, label }: { options: string[]; selected: string[]; onChange: (v: string[]) => void; label: string }) => (
    <div>
      <span className="text-sm font-semibold text-[#0e4d5c]">{label}</span>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {options.map(opt => (
          <button key={opt} type="button" onClick={() => onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt])}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${selected.includes(opt) ? 'border-cyan-700 bg-cyan-700/10 text-cyan-700' : 'border-[#e7d9c4] text-stone-600 hover:border-cyan-500'}`}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );

  const selectedType = draft ? PACKAGE_TYPES.find(t => t.value === draft.package_type) : null;

  const renderStep = () => {
    if (!draft) return null;
    const price = Number(draft.package_price || 0);
    const advPct = Number(draft.advance_percentage || 20);
    const advAmount = Math.round(price * advPct / 100);
    const remaining = price - advAmount;

    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
              <h3 className="mb-4 text-base font-bold text-cyan-800">Select Package Type</h3>
              <select className={`${inputClass} text-base py-3`} value={draft.package_type} onChange={e => handleTypeChange(e.target.value)}>
                <option value="">Select Anchor Package Type ▾</option>
                {PACKAGE_TYPES.map(t => <option key={t.value} value={t.value}>{t.name}</option>)}
              </select>
              {selectedType && selectedType.value !== 'Custom Package' && (
                <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50/50 p-3">
                  <p className="text-xs font-semibold text-cyan-700 flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" />
                    Auto-loaded "{selectedType.name}" — {selectedType.inclusions.length} inclusions, {selectedType.deliverables.length} deliverables
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5 space-y-4">
              <h3 className="text-base font-bold text-cyan-800">Package Info</h3>
              <label className="block">
                <span className="text-sm font-semibold text-[#0e4d5c]">Package Name <span className="text-red-500">*</span></span>
                <input className={inputClass} value={draft.name} onChange={e => setDraft({...draft, name: e.target.value})} placeholder="e.g. Professional Anchor Package" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[#0e4d5c]">Description</span>
                <textarea className={`${inputClass} min-h-[80px] resize-y`} value={draft.description} onChange={e => setDraft({...draft, description: e.target.value})} placeholder="Describe what makes this anchor package special..." />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[#0e4d5c]">Status</span>
                <select className={inputClass} value={draft.status} onChange={e => setDraft({...draft, status: e.target.value})}>
                  <option value="draft">Draft</option>
                  <option value="active">Published</option>
                </select>
              </label>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
              <h3 className="mb-4 text-base font-bold text-cyan-800">Package Pricing</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-[#0e4d5c]">Package Price <span className="text-red-500">*</span></span>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span>
                    <input className={`${inputClass} pl-7`} type="number" min="1" value={draft.package_price} onChange={e => setDraft({...draft, package_price: e.target.value})} placeholder="e.g. 50000" />
                  </div>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#0e4d5c]">Advance Percentage</span>
                  <div className="relative">
                    <span className="absolute right-3.5 top-2.5 text-sm text-stone-500">%</span>
                    <input className={`${inputClass} pr-7`} type="number" min="0" max="100" value={draft.advance_percentage} onChange={e => setDraft({...draft, advance_percentage: e.target.value})} placeholder="20" />
                  </div>
                </label>
              </div>
              {price > 0 && (
                <div className="mt-4 rounded-xl border border-[#eadfcf] bg-[#fffdf9] p-4 space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-stone-600">Package Price</span><span className="font-bold text-cyan-700">₹{price.toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-stone-600">Advance ({advPct}%)</span><span className="font-semibold text-cyan-700">₹{advAmount.toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between text-sm border-t border-[#eadfcf] pt-2"><span className="text-stone-600">Remaining</span><span className="font-semibold">₹{remaining.toLocaleString('en-IN')}</span></div>
                </div>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5 space-y-5">
              <h3 className="text-base font-bold text-cyan-800">Package Inclusions</h3>
              <ChipSelect label="Inclusions" options={ALL_INCLUSIONS} selected={draft.inclusions} onChange={(v: string[]) => setDraft({...draft, inclusions: v})} />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5 space-y-5">
              <h3 className="text-base font-bold text-cyan-800">Event Coverage</h3>
              <ChipSelect label="Coverage" options={ALL_COVERAGE} selected={draft.coverage} onChange={(v: string[]) => setDraft({...draft, coverage: v})} />
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5 space-y-4">
              <h3 className="text-base font-bold text-cyan-800">Team</h3>
              <label className="block">
                <span className="text-sm font-semibold text-[#0e4d5c]">Lead Anchor</span>
                <input className={inputClass} type="number" min="1" value={draft.lead_artist} onChange={e => setDraft({...draft, lead_artist: e.target.value})} />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[#0e4d5c]">Assistant Anchors</span>
                <input className={inputClass} type="number" min="0" value={draft.assistant_artists} onChange={e => setDraft({...draft, assistant_artists: e.target.value})} />
              </label>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5 space-y-5">
              <h3 className="text-base font-bold text-cyan-800">Deliverables</h3>
              <ChipSelect label="Deliverables" options={ALL_DELIVERABLES} selected={draft.deliverables} onChange={(v: string[]) => setDraft({...draft, deliverables: v})} />
            </div>
          </div>
        );

      case 7:
        return (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5 space-y-4">
              <h3 className="text-base font-bold text-cyan-800">Add-ons</h3>
              {draft.addons.map((addon, i) => (
                <div key={i} className="border border-[#e7d9c4] rounded-xl p-3 space-y-2 bg-white">
                  <div className="flex gap-2 items-end">
                    <input className={`${inputClass} text-xs`} value={addon.name} onChange={e => { const a = [...draft.addons]; a[i].name = e.target.value; setDraft({...draft, addons: a}); }} placeholder="Add-on name" />
                    <button type="button" onClick={() => setDraft({...draft, addons: draft.addons.filter((_, idx) => idx !== i)})} className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg">×</button>
                  </div>
                  <input className={`${inputClass} text-xs`} type="number" value={addon.price} onChange={e => { const a = [...draft.addons]; a[i].price = e.target.value; setDraft({...draft, addons: a}); }} placeholder="Price" />
                  <textarea className={`${inputClass} text-xs min-h-[50px]`} value={addon.description} onChange={e => { const a = [...draft.addons]; a[i].description = e.target.value; setDraft({...draft, addons: a}); }} placeholder="Description" />
                </div>
              ))}
              <button type="button" onClick={() => setDraft({...draft, addons: [...draft.addons, {name: '', price: '', description: ''}]})} className="w-full rounded-xl border border-cyan-300 bg-cyan-50 py-2 text-sm font-semibold text-cyan-700 hover:bg-cyan-100">+ Add Another Add-on</button>
            </div>
          </div>
        );

      case 8:
        return (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
              <h3 className="mb-4 text-base font-bold text-cyan-800">Gallery & Media</h3>

              <div className="mb-5">
                <span className="text-sm font-semibold text-[#0e4d5c]">Cover Photo <span className="text-red-500">*</span></span>
                <p className="text-xs text-stone-500 mb-2">Recommended: 1600x900px, max 5MB</p>
                {(draft.cover_file||draft.cover_url) ? (
                  <div className="relative rounded-xl overflow-hidden border border-[#eadfcf] bg-stone-50">
                    <img src={draft.cover_file?URL.createObjectURL(draft.cover_file):draft.cover_url} alt="Cover" className="w-full h-40 object-cover" />
                    <button type="button" onClick={() => setDraft({...draft, cover_file: null, cover_url: ''})} className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-cyan-400 bg-cyan-50 p-6 hover:border-cyan-600">
                    <Upload className="h-6 w-6 text-cyan-700 mb-2" />
                    <span className="text-sm font-semibold text-cyan-800">Upload cover photo</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f=e.target.files?.[0]; if(f&&f.size<=5*1024*1024) setDraft({...draft,cover_file:f}); else if(f) toast.error('Max 5MB'); }} />
                  </label>
                )}
              </div>

              <div className="mb-5">
                <span className="text-sm font-semibold text-[#0e4d5c]">Gallery Photos (max 20)</span>
                <p className="text-xs text-stone-500 mb-2">Upload your hosting/anchoring work photos</p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {draft.gallery_urls.map((img,i) => (<div key={img.id||i} className="relative rounded-xl overflow-hidden border border-[#eadfcf] aspect-square bg-stone-50"><img src={img.url} alt="" className="w-full h-full object-cover" /><button type="button" onClick={() => setDraft({...draft,gallery_urls:draft.gallery_urls.filter((_,idx)=>idx!==i)})} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white"><X className="h-3 w-3" /></button></div>))}
                  {draft.gallery_files.map((f,i) => (<div key={`new-${i}`} className="relative rounded-xl overflow-hidden border border-[#eadfcf] aspect-square bg-stone-50"><img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" /><button type="button" onClick={() => setDraft({...draft,gallery_files:draft.gallery_files.filter((_,idx)=>idx!==i)})} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white"><X className="h-3 w-3" /></button></div>))}
                  {draft.gallery_files.length + draft.gallery_urls.length < 20 && (<label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 p-2 hover:border-stone-400"><Upload className="h-4 w-4 text-stone-400 mb-1" /><span className="text-[10px] text-stone-500 text-center">Add photos</span><input type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const files = Array.from(e.target.files||[]); const valid = files.filter(f => f.size <= 5*1024*1024); if(valid.length < files.length) toast.error('Some files exceed 5MB'); setDraft({...draft, gallery_files: [...draft.gallery_files, ...valid]}); }} /></label>)}
                </div>
              </div>

              <div>
                <span className="text-sm font-semibold text-[#0e4d5c]">Videos (max 10)</span>
                <p className="text-xs text-stone-500 mb-2">Upload hosting/anchoring videos</p>
                <div className="space-y-2">
                  {draft.video_urls.map((vid,i) => (<div key={vid.id||i} className="flex items-center justify-between rounded-lg border border-[#e7d9c4] bg-white p-2"><span className="text-xs text-stone-600 truncate">{vid.url}</span><button type="button" onClick={() => setDraft({...draft,video_urls:draft.video_urls.filter((_,idx)=>idx!==i)})} className="text-red-500 hover:bg-red-50 p-1 rounded"><X className="h-3.5 w-3.5" /></button></div>))}
                  {draft.video_files.map((f,i) => (<div key={`new-vid-${i}`} className="flex items-center justify-between rounded-lg border border-[#e7d9c4] bg-white p-2"><span className="text-xs text-stone-600 truncate">{f.name}</span><button type="button" onClick={() => setDraft({...draft,video_files:draft.video_files.filter((_,idx)=>idx!==i)})} className="text-red-500 hover:bg-red-50 p-1 rounded"><X className="h-3.5 w-3.5" /></button></div>))}
                  {draft.video_files.length + draft.video_urls.length < 10 && (<label className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 p-3 hover:border-stone-400"><Upload className="h-4 w-4 text-stone-400" /><span className="text-xs text-stone-600">Add videos (MP4, WebM)</span><input type="file" multiple accept="video/mp4,video/webm" className="hidden" onChange={e => { const files = Array.from(e.target.files||[]); const valid = files.filter(f => f.size <= 50*1024*1024); if(valid.length < files.length) toast.error('Some videos exceed 50MB'); setDraft({...draft, video_files: [...draft.video_files, ...valid]}); }} /></label>)}
                </div>
              </div>
            </div>
          </div>
        );

      case 9:
        return (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5 space-y-3">
              <h3 className="text-base font-bold text-cyan-800">Package Preview</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-stone-600">Package Type</span><span className="font-semibold text-cyan-700">{draft.package_type}</span></div>
                <div className="flex justify-between"><span className="text-stone-600">Name</span><span className="font-semibold text-cyan-700">{draft.name}</span></div>
                <div className="flex justify-between"><span className="text-stone-600">Price</span><span className="font-semibold text-cyan-700">₹{Number(draft.package_price).toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between"><span className="text-stone-600">Advance</span><span className="font-semibold text-cyan-700">{draft.advance_percentage}%</span></div>
                <div className="flex justify-between"><span className="text-stone-600">Status</span><span className="font-semibold text-cyan-700">{draft.status}</span></div>
                <div className="border-t border-[#eadfcf] pt-2 mt-2 flex justify-between"><span className="text-stone-600">Lead Anchor</span><span className="font-semibold text-cyan-700">{draft.lead_artist}</span></div>
                <div className="flex justify-between"><span className="text-stone-600">Assistants</span><span className="font-semibold text-cyan-700">{draft.assistant_artists}</span></div>
              </div>
            </div>
          </div>
        );

      default: return null;
    }
  };

  return (
    <div className="max-w-[1200px] space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#0e4d5c]">Anchor Packages</h1>
          <p className="text-sm text-muted-foreground">Create and manage your hosting & anchoring packages.</p>
        </div>
        <button onClick={() => { setDraft(blank()); setStep(1); }} className="rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-cyan-800">
          <Plus className="mr-1 inline h-4 w-4" />Add Package
        </button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[1,2,3].map(i => <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : packages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#eadfcf] py-16 text-center">
          <Mic2 className="h-12 w-12 text-cyan-700/30" />
          <p className="mt-3 font-semibold text-[#0e4d5c]">No packages yet</p>
          <button onClick={() => { setDraft(blank()); setStep(1); }} className="mt-4 rounded-xl bg-cyan-700 px-5 py-2.5 text-sm font-semibold text-white">
            <Plus className="mr-1 inline h-4 w-4" />Add Package
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg: any) => (
            <div key={pkg.id} className="overflow-hidden rounded-2xl border border-[#eadfcf] bg-[#f0fdfa] shadow-sm hover:shadow-md transition">
              <div className="flex h-28 items-center justify-center bg-gradient-to-br from-cyan-50 to-teal-50">
                <Mic2 className="h-10 w-10 text-cyan-700/40" />
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-bold text-[#0e4d5c] leading-tight">{pkg.name}</h2>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${pkg.status==='active'?'bg-cyan-100 text-cyan-700':'bg-blue-50 text-blue-700'}`}>{pkg.status}</span>
                </div>
                {pkg.package_price && <p className="mt-1.5 text-lg font-bold text-cyan-700">₹{Number(pkg.package_price).toLocaleString('en-IN')}</p>}
                {pkg.package_type && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-cyan-100 border border-cyan-200 px-2 py-0.5 text-[10px] font-medium text-cyan-700">
                      <Mic2 className="h-2.5 w-2.5" />{pkg.package_type}
                    </span>
                  </div>
                )}
                <div className="mt-4 flex gap-2">
                  <button onClick={() => editPackage(pkg)} className="flex-1 rounded-lg border border-[#e7d9c4] py-2 text-xs font-medium text-[#0e4d5c] hover:bg-[#f0fdfa]">
                    <Pencil className="mr-1 inline h-3 w-3" />Edit
                  </button>
                  <button onClick={() => toggleStatus(pkg)} className="rounded-lg border border-[#e7d9c4] p-2 hover:bg-[#f0fdfa]">
                    {pkg.status==='active'?<EyeOff className="h-3.5 w-3.5 text-stone-600" />:<Eye className="h-3.5 w-3.5 text-stone-600" />}
                  </button>
                  <button onClick={() => removePackage(pkg)} className="rounded-lg border border-red-200 p-2 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5 text-red-600" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {draft && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#0e3d4e]/65 p-3 backdrop-blur-sm sm:p-6">
          <div className="mx-auto my-3 max-w-3xl overflow-hidden rounded-[24px] bg-[#fefffd] shadow-2xl">
            <header className="flex items-start justify-between gap-4 bg-cyan-800 px-5 py-5 sm:px-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">{draft.id ? 'Editing' : 'Creating'} Package</p>
                <h2 className="mt-1 text-lg font-bold text-white">{draft.package_type || 'New Package'}</h2>
              </div>
              <button onClick={() => setDraft(null)} className="rounded-full p-2 text-white/85 hover:bg-white/15">
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="border-b border-[#eadfcf] bg-[#f0fdfa] px-5 py-4 sm:px-7">
              <div className="flex items-center justify-between">
                {STEP_LABELS.map((label, i) => {
                  const sn=i+1; const done=step>sn; const cur=step===sn;
                  return (
                    <div key={i} className="flex flex-1 items-center">
                      <div className="flex flex-col items-center">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${done?'bg-cyan-500 text-white':cur?'bg-cyan-700 text-white shadow-md':'border-2 border-[#e7d9c4] text-stone-400'}`}>
                          {done?<Check className="h-4 w-4" />:sn}
                        </div>
                        <span className={`mt-1 hidden text-[10px] font-medium sm:block ${cur?'text-cyan-700':done?'text-cyan-600':'text-stone-400'}`}>{label}</span>
                      </div>
                      {i<STEP_LABELS.length-1&&<div className={`mx-1 h-0.5 flex-1 rounded ${done?'bg-cyan-400':'bg-[#e7d9c4]'}`}/>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-5 sm:p-7 max-h-[60vh] overflow-y-auto">{renderStep()}</div>

            <div className="flex items-center justify-between border-t border-[#eadfcf] bg-[#f0fdfa]/95 px-5 py-4 backdrop-blur sm:px-7">
              <button type="button" onClick={() => { if (step > 1) setStep(step - 1); else setDraft(null); }} className="flex items-center gap-1.5 rounded-xl border border-[#d7c5ae] px-4 py-2.5 text-sm font-semibold text-[#0e4d5c] hover:bg-white">
                <ChevronLeft className="h-4 w-4" />{step===1?'Cancel':'Back'}
              </button>
              {step < STEP_LABELS.length ? (
                <button type="button" onClick={() => setStep(step+1)} className="flex items-center gap-1.5 rounded-xl bg-cyan-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-cyan-800">
                  Next<ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button type="button" disabled={busy} onClick={saveDraft} className="rounded-xl bg-cyan-700 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-cyan-800 disabled:opacity-60">
                  {busy?'Saving…':'Save Package'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
