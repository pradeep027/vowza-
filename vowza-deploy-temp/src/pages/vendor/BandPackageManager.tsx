import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, Eye, EyeOff, X, Check,
  ChevronRight, ChevronLeft, Upload, Music, ChevronDown,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/* ─── Constants ─────────────────────────────────────────────────────────────── */
const BAND_CATEGORIES = [
  'Wedding Band','Brass Band','Pad Band','Baraat Band','Punjabi Dhol Band',
  'Nashik Dhol Band','Tamil Melam','Chenda Melam','Marfa Band',
  'Shivaji Maharashtrian Band','Traditional Folk Band','Devotional Band',
  'Shehnai & Nadaswaram Band','Live Music Band',
];

const PERFORMANCE_DURATIONS = ['1 Hour','2 Hours','3 Hours','4 Hours','5 Hours','Full Event','Custom Duration'];
const PERFORMER_COUNTS = ['5 Members','8 Members','10 Members','15 Members','20 Members','Custom'];

const INSTRUMENTS = [
  'Dhol','Tasha','Brass Instruments','Nadaswaram','Thavil','Chenda','Shehnai',
  'Drums','Trumpets','Percussion','Keyboard','Guitar','Vocals','Traditional Instruments',
];

const EVENT_TYPES = [
  'Wedding','Baraat','Reception','Engagement','Sangeet','Haldi','Mehendi',
  'Birthday','Anniversary','Baby Shower','Naming Ceremony','Housewarming',
  'Gruhapravesam','Temple Event','Devotional Event','Ganesh Chaturthi',
  'Bonalu','Bathukamma','Festival','Corporate Event','College Fest',
  'Cultural Event','Private Party','Public Event','Custom Event',
];

const EQUIPMENT_OPTIONS = [
  'Brass Instruments','Dhol','Tasha','Nadaswaram','Thavil','Chenda','Shehnai',
  'Drums','Trumpets','Percussion','Keyboard','Guitar','Microphones','Speakers',
  'Sound System','Amplifiers','Stage Setup','Lighting','Costumes',
  'Traditional Instruments','Transportation','Backup Equipment',
];

const DELIVERABLES = [
  'Live Performance','Procession Performance','Baraat Performance','Stage Performance',
  'Background Music','Traditional Performance','DJ Integration','Sound Setup',
  'Instrument Setup','Custom Playlist','Event Coordination','Multiple Sets',
  'Breaks Included','Travel Included',
];

const ADDON_TEMPLATES = [
  'Extra Performance Hour','Additional Band Members','Additional Dhol Players',
  'Additional Musicians','Extended Procession','Extra Sound System','Lighting',
  'DJ Integration','Outstation Travel','Special Instruments','Custom Performance',
];

const MUSIC_GENRES = ['Bollywood','Folk','Classical','Devotional','Sufi','Rajasthani','Punjabi','Marathi','Telugu','Tamil','Fusion','Western','Regional'];
const LANGUAGES = ['Telugu','Hindi','English','Tamil','Kannada','Malayalam','Marathi','Punjabi','Gujarati','Bengali'];
const STEP_LABELS = ['Basic Info','Pricing','Performance','Events & Equipment','Team','Deliverables','Add-ons','Preview'];

const inputClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition placeholder:text-stone-400 focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/15';

/* ─── Types ─────────────────────────────────────────────────────────────────── */
type Addon = { name: string; price: string; description: string };
type Draft = {
  id?: string; name: string; description: string; band_category: string; status: string;
  package_price: string; advance_percentage: string;
  travel_charges: string; outside_city_charges: string; extra_hour_charges: string;
  additional_performer_charges: string; additional_equipment_charges: string;
  performance_duration: string; number_of_performers: string;
  instruments: string[]; music_genres: string[]; languages: string[];
  event_types_supported: string[]; equipment_included: string[];
  band_members: string; lead_performer: string; drummers: string;
  instrumentalists: string; singers: string; support_staff: string; sound_engineer: string;
  deliverables: string[]; addons: Addon[];
  cover_file: File | null; cover_url: string;
  gallery_files: File[]; gallery_urls: { id: string; url: string; is_cover: boolean }[];
  video_files: File[]; video_urls: { id: string; url: string }[];
};

const blank = (bandCat?: string): Draft => ({
  name: '', description: '', band_category: bandCat || '', status: 'draft',
  package_price: '', advance_percentage: '20',
  travel_charges: '', outside_city_charges: '', extra_hour_charges: '',
  additional_performer_charges: '', additional_equipment_charges: '',
  performance_duration: '', number_of_performers: '',
  instruments: [], music_genres: [], languages: [],
  event_types_supported: [], equipment_included: [],
  band_members: '', lead_performer: '', drummers: '', instrumentalists: '',
  singers: '', support_staff: '', sound_engineer: '',
  deliverables: [], addons: [],
  cover_file: null, cover_url: '', gallery_files: [], gallery_urls: [],
  video_files: [], video_urls: [],
});

/* ─── Main Component ────────────────────────────────────────────────────────── */
export default function BandPackageManager({ provider }: { provider: any }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const providerBandCategory = provider?.band_category || '';

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['band-packages', provider.id],
    queryFn: async () => {
      const r = await (supabase.from('band_packages' as any).select('*').eq('provider_id', provider.id).order('created_at', { ascending: false }));
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['band-packages', provider.id] });
  useEffect(() => {
    const ch = supabase.channel(`band-packages-${provider.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'band_packages', filter: `provider_id=eq.${provider.id}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [provider.id]);

  const edit = async (pkg: any) => {
    let addons: Addon[] = []; let galleryUrls: { id: string; url: string; is_cover: boolean }[] = []; let coverUrl = ''; let videoUrls: { id: string; url: string }[] = [];
    try { const r = await (supabase.from('band_addons' as any).select('name, price, description').eq('package_id', pkg.id).order('sort_order')); if (r.data) addons = r.data.map((a: any) => ({ name: a.name, price: String(a.price ?? ''), description: a.description || '' })); } catch (_) {}
    try { const r = await (supabase.from('band_gallery' as any).select('id, public_url, is_cover, sort_order, media_type').eq('package_id', pkg.id).order('sort_order')); const g = (r.data ?? []).map((x: any) => ({ id: x.id, url: x.public_url, is_cover: x.is_cover, media_type: x.media_type || 'image' })); coverUrl = g.find((x: any) => x.is_cover)?.url || ''; galleryUrls = g.filter((x: any) => !x.is_cover && x.media_type === 'image'); videoUrls = g.filter((x: any) => x.media_type === 'video').map((x: any) => ({ id: x.id, url: x.url })); } catch (_) {}
    setDraft({ id: pkg.id, name: pkg.name||'', description: pkg.description||'', band_category: pkg.band_category||providerBandCategory, status: pkg.status||'draft',
      package_price: String(pkg.package_price??''), advance_percentage: String(pkg.advance_percentage??'20'),
      travel_charges: String(pkg.travel_charges??''), outside_city_charges: String(pkg.outside_city_charges??''),
      extra_hour_charges: String(pkg.extra_hour_charges??''), additional_performer_charges: String(pkg.additional_performer_charges??''),
      additional_equipment_charges: String(pkg.additional_equipment_charges??''),
      performance_duration: pkg.performance_duration||'', number_of_performers: pkg.number_of_performers||'',
      instruments: pkg.instruments??[], music_genres: pkg.music_genres??[], languages: pkg.languages??[],
      event_types_supported: pkg.event_types_supported??[], equipment_included: pkg.equipment_included??[],
      band_members: pkg.band_members||'', lead_performer: pkg.lead_performer||'', drummers: pkg.drummers||'',
      instrumentalists: pkg.instrumentalists||'', singers: pkg.singers||'', support_staff: pkg.support_staff||'', sound_engineer: pkg.sound_engineer||'',
      deliverables: pkg.deliverables??[], addons,
      cover_file: null, cover_url: coverUrl, gallery_files: [], gallery_urls: galleryUrls,
      video_files: [], video_urls: videoUrls });
    setStep(1);
  };


  const save = async () => {
    if (!draft || !draft.name.trim()) { toast.error('Package name is required.'); setStep(1); return; }
    if (!draft.package_price) { toast.error('Package price is required.'); setStep(2); return; }
    if (!draft.cover_file && !draft.cover_url) { toast.error('Cover photo is required.'); setStep(1); return; }
    setBusy(true);
    try {
      const payload: any = {
        provider_id: provider.id, name: draft.name.trim(), band_category: draft.band_category || providerBandCategory || null,
        description: draft.description.trim()||null, status: draft.status,
        package_price: Number(draft.package_price), advance_percentage: draft.advance_percentage ? Number(draft.advance_percentage) : 20,
        travel_charges: draft.travel_charges ? Number(draft.travel_charges) : 0,
        outside_city_charges: draft.outside_city_charges ? Number(draft.outside_city_charges) : 0,
        extra_hour_charges: draft.extra_hour_charges ? Number(draft.extra_hour_charges) : 0,
        additional_performer_charges: draft.additional_performer_charges ? Number(draft.additional_performer_charges) : 0,
        additional_equipment_charges: draft.additional_equipment_charges ? Number(draft.additional_equipment_charges) : 0,
        performance_duration: draft.performance_duration||null, number_of_performers: draft.number_of_performers||null,
        instruments: draft.instruments, music_genres: draft.music_genres, languages: draft.languages,
        event_types_supported: draft.event_types_supported, equipment_included: draft.equipment_included,
        band_members: draft.band_members||null, lead_performer: draft.lead_performer||null, drummers: draft.drummers||null,
        instrumentalists: draft.instrumentalists||null, singers: draft.singers||null,
        support_staff: draft.support_staff||null, sound_engineer: draft.sound_engineer||null,
        deliverables: draft.deliverables,
      };
      let packageId = draft.id;
      if (draft.id) { const r = await (supabase.from('band_packages' as any).update(payload).eq('id', draft.id).select('id').single()); if (r.error) throw r.error; }
      else { const r = await (supabase.from('band_packages' as any).insert(payload).select('id').single()); if (r.error) throw r.error; packageId = r.data.id; }

      if (packageId) {
        await (supabase.from('band_addons' as any).delete().eq('package_id', packageId));
        const valid = draft.addons.filter(a => a.name.trim());
        if (valid.length > 0) await (supabase.from('band_addons' as any).insert(valid.map((a, i) => ({ package_id: packageId, name: a.name.trim(), price: Number(a.price)||0, description: a.description||null, sort_order: i }))));
        if (draft.cover_file) { const ext = draft.cover_file.name.split('.').pop(); const path = `${user!.id}/${packageId}/cover-${crypto.randomUUID()}.${ext}`; const { error: upErr } = await supabase.storage.from('band-media').upload(path, draft.cover_file, { contentType: draft.cover_file.type }); if (!upErr) { const url = supabase.storage.from('band-media').getPublicUrl(path).data.publicUrl; await (supabase.from('band_gallery' as any).delete().eq('package_id', packageId).eq('is_cover', true)); await (supabase.from('band_gallery' as any).insert({ package_id: packageId, storage_path: path, public_url: url, is_cover: true, sort_order: 0 })); } }
        if (draft.gallery_files.length > 0) { for (let i = 0; i < draft.gallery_files.length; i++) { const file = draft.gallery_files[i]; const ext = file.name.split('.').pop(); const path = `${user!.id}/${packageId}/gallery-${crypto.randomUUID()}.${ext}`; const { error: upErr } = await supabase.storage.from('band-media').upload(path, file, { contentType: file.type }); if (!upErr) { const url = supabase.storage.from('band-media').getPublicUrl(path).data.publicUrl; await (supabase.from('band_gallery' as any).insert({ package_id: packageId, storage_path: path, public_url: url, is_cover: false, media_type: 'image', sort_order: draft.gallery_urls.length + i + 1 })); } } }
        // Upload videos
        if (draft.video_files.length > 0) { for (let i = 0; i < draft.video_files.length; i++) { const file = draft.video_files[i]; const ext = file.name.split('.').pop(); const path = `${user!.id}/${packageId}/video-${crypto.randomUUID()}.${ext}`; const { error: upErr } = await supabase.storage.from('band-media').upload(path, file, { contentType: file.type }); if (!upErr) { const url = supabase.storage.from('band-media').getPublicUrl(path).data.publicUrl; await (supabase.from('band_gallery' as any).insert({ package_id: packageId, storage_path: path, public_url: url, is_cover: false, media_type: 'video', sort_order: 100 + i })); } } }
        if (draft.id) { const cur = [...draft.gallery_urls.map(g => g.id), ...draft.video_urls.map(v => v.id)].filter(Boolean); const { data: ex } = await (supabase.from('band_gallery' as any).select('id').eq('package_id', packageId).eq('is_cover', false)); const del = (ex??[]).map((e: any) => e.id).filter((id: string) => !cur.includes(id)); if (del.length > 0) await (supabase.from('band_gallery' as any).delete().in('id', del)); }
      }
      toast.success('Band package saved!'); setDraft(null); setStep(1); refresh();
    } catch (err: any) { toast.error(err.message || 'Could not save'); } finally { setBusy(false); }
  };

  const toggleStatus = async (pkg: any) => { await (supabase.from('band_packages' as any).update({ status: pkg.status === 'active' ? 'draft' : 'active' }).eq('id', pkg.id)); refresh(); };
  const remove = async (pkg: any) => { if (!confirm('Delete this package?')) return; await (supabase.from('band_packages' as any).delete().eq('id', pkg.id)); refresh(); toast.success('Deleted'); };
  const openNew = () => { setDraft(blank(providerBandCategory)); setStep(1); };

  const ChipSelect = ({ options, selected, onChange, label }: { options: string[]; selected: string[]; onChange: (v: string[]) => void; label: string }) => (
    <div><span className="text-sm font-semibold text-[#4b1d6b]">{label}</span><div className="mt-1.5 flex flex-wrap gap-2">{options.map(opt => (
      <button key={opt} type="button" onClick={() => onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt])}
        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${selected.includes(opt) ? 'border-purple-600 bg-purple-600/10 text-purple-700' : 'border-[#e7d9c4] text-stone-600 hover:border-purple-500'}`}>{opt}</button>
    ))}</div></div>
  );

  const renderStep = () => { if (!draft) return null; switch(step) {
    case 1: return <StepBasicInfo draft={draft} setDraft={setDraft} providerBandCategory={providerBandCategory} />;
    case 2: return <StepPricing draft={draft} setDraft={setDraft} />;
    case 3: return <StepPerformance draft={draft} setDraft={setDraft} ChipSelect={ChipSelect} />;
    case 4: return <StepEvents draft={draft} setDraft={setDraft} ChipSelect={ChipSelect} />;
    case 5: return <StepTeam draft={draft} setDraft={setDraft} />;
    case 6: return <StepDeliverables draft={draft} setDraft={setDraft} ChipSelect={ChipSelect} />;
    case 7: return <StepAddons draft={draft} setDraft={setDraft} />;
    case 8: return <StepPreview draft={draft} />;
    default: return null;
  }};


  return (
    <div className="max-w-[1200px] space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div><h1 className="text-xl font-bold text-[#4b1d6b]">Band Packages</h1><p className="text-sm text-muted-foreground">Create and manage your band performance packages.</p></div>
        <button onClick={openNew} className="rounded-xl bg-purple-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-purple-800"><Plus className="mr-1 inline h-4 w-4" />Add Package</button>
      </div>
      {isLoading ? (<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[1,2,3].map(i => <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : packages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#eadfcf] py-16 text-center">
          <Music className="h-12 w-12 text-purple-700/30" /><p className="mt-3 font-semibold text-[#4b1d6b]">No packages yet</p>
          <button onClick={openNew} className="mt-4 rounded-xl bg-purple-700 px-5 py-2.5 text-sm font-semibold text-white"><Plus className="mr-1 inline h-4 w-4" />Add Package</button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{packages.map((pkg: any) => (
          <div key={pkg.id} className="overflow-hidden rounded-2xl border border-[#eadfcf] bg-[#faf8ff] shadow-sm hover:shadow-md transition">
            <div className="flex h-28 items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-50"><Music className="h-10 w-10 text-purple-700/40" /></div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2"><h2 className="font-bold text-[#4b1d6b] leading-tight">{pkg.name}</h2>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${pkg.status==='active'?'bg-purple-100 text-purple-700':pkg.status==='paused'?'bg-amber-100 text-amber-700':'bg-blue-50 text-blue-700'}`}>{pkg.status}</span></div>
              {pkg.package_price && <p className="mt-1.5 text-lg font-bold text-purple-700">₹{Number(pkg.package_price).toLocaleString('en-IN')}</p>}
              {pkg.band_category && <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1"><Music className="h-3.5 w-3.5" />{pkg.band_category}</div>}
              {pkg.performance_duration && <div className="mt-0.5 text-xs text-muted-foreground">Duration: {pkg.performance_duration}</div>}
              <div className="mt-4 flex gap-2">
                <button onClick={() => edit(pkg)} className="flex-1 rounded-lg border border-[#e7d9c4] py-2 text-xs font-medium text-[#4b1d6b] hover:bg-[#faf8ff]"><Pencil className="mr-1 inline h-3 w-3" />Edit</button>
                <button onClick={() => toggleStatus(pkg)} className="rounded-lg border border-[#e7d9c4] p-2 hover:bg-[#faf8ff]">{pkg.status==='active'?<EyeOff className="h-3.5 w-3.5 text-stone-600" />:<Eye className="h-3.5 w-3.5 text-stone-600" />}</button>
                <button onClick={() => remove(pkg)} className="rounded-lg border border-red-200 p-2 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5 text-red-600" /></button>
              </div>
            </div>
          </div>
        ))}</div>
      )}
      {draft && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#2d1b69]/65 p-3 backdrop-blur-sm sm:p-6">
          <div className="mx-auto my-3 max-w-3xl overflow-hidden rounded-[24px] bg-[#fefeff] shadow-2xl">
            <header className="flex items-start justify-between gap-4 bg-purple-800 px-5 py-5 sm:px-7"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-purple-200">Vowza Bands</p><h2 className="mt-1 text-lg font-bold text-white">{draft.id?'Edit Package':'Add New Package'}</h2></div><button onClick={() => {setDraft(null);setStep(1);}} className="rounded-full p-2 text-white/85 hover:bg-white/15"><X className="h-5 w-5" /></button></header>
            <div className="border-b border-[#eadfcf] bg-[#faf8ff] px-5 py-4 sm:px-7"><div className="flex items-center justify-between">{STEP_LABELS.map((label, i) => { const sn=i+1; const done=step>sn; const cur=step===sn; return (<div key={i} className="flex flex-1 items-center"><div className="flex flex-col items-center"><div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${done?'bg-purple-500 text-white':cur?'bg-purple-700 text-white shadow-md':'border-2 border-[#e7d9c4] text-stone-400'}`}>{done?<Check className="h-4 w-4" />:sn}</div><span className={`mt-1 hidden text-[10px] font-medium sm:block ${cur?'text-purple-700':done?'text-purple-600':'text-stone-400'}`}>{label}</span></div>{i<7&&<div className={`mx-1 h-0.5 flex-1 rounded ${done?'bg-purple-400':'bg-[#e7d9c4]'}`}/>}</div>);})}</div></div>
            <div className="p-5 sm:p-7 max-h-[60vh] overflow-y-auto">{renderStep()}</div>
            <div className="flex items-center justify-between border-t border-[#eadfcf] bg-[#faf8ff]/95 px-5 py-4 backdrop-blur sm:px-7">
              <button type="button" onClick={() => step>1?setStep(step-1):setDraft(null)} className="flex items-center gap-1.5 rounded-xl border border-[#d7c5ae] px-4 py-2.5 text-sm font-semibold text-[#4b1d6b] hover:bg-white"><ChevronLeft className="h-4 w-4" />{step===1?'Cancel':'Back'}</button>
              {step<8?(<button type="button" onClick={() => setStep(step+1)} className="flex items-center gap-1.5 rounded-xl bg-purple-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-purple-800">Next<ChevronRight className="h-4 w-4" /></button>
              ):(<button type="button" disabled={busy} onClick={save} className="rounded-xl bg-purple-700 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-purple-800 disabled:opacity-60">{busy?'Saving…':'Save Package'}</button>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ─── Step 1: Basic Info ─────────────────────────────────────────────────────── */
function StepBasicInfo({ draft, setDraft, providerBandCategory }: { draft: Draft; setDraft: (d: Draft) => void; providerBandCategory: string }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#faf8ff] p-5 space-y-4">
        <h3 className="text-base font-bold text-purple-800">Basic Information</h3>
        <label className="block"><span className="text-sm font-semibold text-[#4b1d6b]">Package Name <span className="text-red-500">*</span></span>
          <input className={inputClass} value={draft.name} onChange={e => setDraft({...draft, name: e.target.value})} placeholder="e.g. Premium Wedding Band Performance" /></label>
        <label className="block"><span className="text-sm font-semibold text-[#4b1d6b]">Band Category</span>
          <select className={inputClass} value={draft.band_category} onChange={e => setDraft({...draft, band_category: e.target.value})}>
            <option value="">Select Band Category</option>
            {BAND_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {providerBandCategory && !draft.band_category && <p className="mt-1 text-xs text-purple-600">Default: {providerBandCategory}</p>}
        </label>
        <label className="block"><span className="text-sm font-semibold text-[#4b1d6b]">Description</span>
          <textarea className={`${inputClass} min-h-[80px] resize-y`} value={draft.description} onChange={e => setDraft({...draft, description: e.target.value})} placeholder="Describe your band performance..." /></label>
        <label className="block"><span className="text-sm font-semibold text-[#4b1d6b]">Status</span>
          <select className={inputClass} value={draft.status} onChange={e => setDraft({...draft, status: e.target.value})}><option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option></select></label>
      </div>
      <div className="rounded-2xl border border-[#eadfcf] bg-[#faf8ff] p-5">
        <span className="text-sm font-semibold text-[#4b1d6b]">Cover Photo <span className="text-red-500">*</span></span>
        {(draft.cover_file||draft.cover_url) ? (
          <div className="relative rounded-xl overflow-hidden border border-[#eadfcf] bg-stone-50 mt-2"><img src={draft.cover_file?URL.createObjectURL(draft.cover_file):draft.cover_url} alt="Cover" className="w-full h-40 object-cover" /><button type="button" onClick={() => setDraft({...draft, cover_file: null, cover_url: ''})} className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"><X className="h-3.5 w-3.5" /></button></div>
        ) : (
          <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-purple-300 bg-purple-50 p-6 hover:border-purple-600"><Upload className="h-6 w-6 text-purple-700 mb-2" /><span className="text-sm font-semibold text-[#4b1d6b]">Upload cover photo</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f=e.target.files?.[0]; if (f&&f.size<=5*1024*1024) setDraft({...draft,cover_file:f}); else if(f) toast.error('Max 5MB'); }} /></label>
        )}
      </div>
      <div className="rounded-2xl border border-[#eadfcf] bg-[#faf8ff] p-5">
        <span className="text-sm font-semibold text-[#4b1d6b]">Gallery Photos (max 30)</span>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2">
          {draft.gallery_urls.map((img,i) => (<div key={img.id||i} className="relative rounded-xl overflow-hidden border border-[#eadfcf] aspect-square bg-stone-50"><img src={img.url} alt="" className="w-full h-full object-cover" /><button type="button" onClick={() => setDraft({...draft,gallery_urls:draft.gallery_urls.filter((_,idx)=>idx!==i)})} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white"><X className="h-3 w-3" /></button></div>))}
          {draft.gallery_files.map((f,i) => (<div key={`new-${i}`} className="relative rounded-xl overflow-hidden border border-[#eadfcf] aspect-square bg-stone-50"><img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" /><button type="button" onClick={() => setDraft({...draft,gallery_files:draft.gallery_files.filter((_,idx)=>idx!==i)})} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white"><X className="h-3 w-3" /></button></div>))}
          {(draft.gallery_urls.length+draft.gallery_files.length)<30 && (<label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-purple-300 bg-purple-50 aspect-square hover:border-purple-600"><Plus className="h-5 w-5 text-purple-700" /><span className="text-[9px] text-stone-500 mt-1">Photo</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={e => { const files=Array.from(e.target.files??[]).filter(f=>f.size<=5*1024*1024).slice(0,30-draft.gallery_urls.length-draft.gallery_files.length); if(files.length) setDraft({...draft,gallery_files:[...draft.gallery_files,...files]}); }} /></label>)}
        </div>
      </div>
      {/* Performance Videos */}
      <div className="rounded-2xl border border-[#eadfcf] bg-[#faf8ff] p-5">
        <span className="text-sm font-semibold text-[#4b1d6b]">Performance Videos (max 10)</span>
        <p className="text-xs text-stone-500 mb-2">Upload MP4/MOV/WEBM videos (max 100MB each)</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {draft.video_urls.map((vid,i) => (<div key={vid.id||i} className="relative rounded-xl overflow-hidden border border-purple-200 bg-purple-50 aspect-video flex items-center justify-center">
            <video src={vid.url} className="w-full h-full object-cover rounded-xl" muted preload="metadata" />
            <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white font-bold">VIDEO</span>
            <button type="button" onClick={() => setDraft({...draft,video_urls:draft.video_urls.filter((_,idx)=>idx!==i)})} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"><X className="h-3 w-3" /></button>
          </div>))}
          {draft.video_files.map((f,i) => (<div key={`newv-${i}`} className="relative rounded-xl overflow-hidden border border-purple-200 bg-purple-50 aspect-video flex items-center justify-center">
            <video src={URL.createObjectURL(f)} className="w-full h-full object-cover rounded-xl" muted preload="metadata" />
            <span className="absolute bottom-1 left-1 rounded bg-purple-600 px-1.5 py-0.5 text-[9px] text-white font-bold">NEW</span>
            <button type="button" onClick={() => setDraft({...draft,video_files:draft.video_files.filter((_,idx)=>idx!==i)})} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"><X className="h-3 w-3" /></button>
          </div>))}
          {(draft.video_urls.length+draft.video_files.length)<10 && (<label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-purple-300 bg-purple-50 aspect-video hover:border-purple-600">
            <Upload className="h-5 w-5 text-purple-700" /><span className="text-[10px] text-stone-500 mt-1">+ Add Video</span>
            <input type="file" accept="video/mp4,video/mov,video/webm,video/quicktime" multiple className="hidden" onChange={e => { const files=Array.from(e.target.files??[]).filter(f=>f.size<=100*1024*1024).slice(0,10-draft.video_urls.length-draft.video_files.length); if(files.length) setDraft({...draft,video_files:[...draft.video_files,...files]}); else if(e.target.files?.length) toast.error('Max 100MB per video'); }} />
          </label>)}
        </div>
      </div>
    </div>
  );
}

/* ─── Step 2: Pricing ────────────────────────────────────────────────────────── */
function StepPricing({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const [showAdditional, setShowAdditional] = useState(false);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#faf8ff] p-5">
        <h3 className="mb-4 text-base font-bold text-purple-800">Package Pricing</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="text-sm font-semibold text-[#4b1d6b]">Package Price <span className="text-red-500">*</span></span>
            <div className="relative"><span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span><input className={`${inputClass} pl-7`} type="number" min="0" value={draft.package_price} onChange={e => setDraft({...draft,package_price:e.target.value})} placeholder="Total package price" /></div></label>
          <label className="block"><span className="text-sm font-semibold text-[#4b1d6b]">Advance %</span>
            <div className="relative"><span className="absolute right-3.5 top-2.5 text-sm text-stone-500">%</span><input className={`${inputClass} pr-7`} type="number" min="0" max="100" value={draft.advance_percentage} onChange={e => setDraft({...draft,advance_percentage:e.target.value})} placeholder="20" /></div></label>
        </div>
      </div>
      <div className="rounded-2xl border border-[#eadfcf] bg-[#faf8ff] p-5">
        <button type="button" onClick={() => setShowAdditional(!showAdditional)} className="flex w-full items-center justify-between text-left"><div><h3 className="text-base font-bold text-purple-800">Additional Charges</h3></div><ChevronDown className={`h-5 w-5 text-stone-400 transition ${showAdditional?'rotate-180':''}`} /></button>
        {showAdditional && (<div className="mt-4 grid gap-4 sm:grid-cols-2 border-t border-[#eadfcf] pt-4">
          {[{key:'travel_charges',label:'Travel Charges'},{key:'outside_city_charges',label:'Outside City'},{key:'extra_hour_charges',label:'Extra Hour'},{key:'additional_performer_charges',label:'Additional Performer'},{key:'additional_equipment_charges',label:'Additional Equipment'}].map(({key,label}) => (
            <label key={key} className="block"><span className="text-sm font-semibold text-[#4b1d6b]">{label}</span><div className="relative"><span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span><input className={`${inputClass} pl-7`} type="number" min="0" value={(draft as any)[key]} onChange={e => setDraft({...draft,[key]:e.target.value})} placeholder="0" /></div></label>
          ))}
        </div>)}
      </div>
    </div>
  );
}

/* ─── Step 3: Performance ────────────────────────────────────────────────────── */
function StepPerformance({ draft, setDraft, ChipSelect }: { draft: Draft; setDraft: (d: Draft) => void; ChipSelect: any }) {
  return (
    <div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#faf8ff] p-5 space-y-5">
      <h3 className="text-base font-bold text-purple-800">Performance Details</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="text-sm font-semibold text-[#4b1d6b]">Performance Duration</span>
          <select className={inputClass} value={draft.performance_duration} onChange={e => setDraft({...draft,performance_duration:e.target.value})}><option value="">Select</option>{PERFORMANCE_DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}</select></label>
        <label className="block"><span className="text-sm font-semibold text-[#4b1d6b]">Number of Performers</span>
          <select className={inputClass} value={draft.number_of_performers} onChange={e => setDraft({...draft,number_of_performers:e.target.value})}><option value="">Select</option>{PERFORMER_COUNTS.map(p => <option key={p} value={p}>{p}</option>)}</select></label>
      </div>
      <ChipSelect label="Instruments" options={INSTRUMENTS} selected={draft.instruments} onChange={(v: string[]) => setDraft({...draft,instruments:v})} />
      <ChipSelect label="Music Genres" options={MUSIC_GENRES} selected={draft.music_genres} onChange={(v: string[]) => setDraft({...draft,music_genres:v})} />
      <ChipSelect label="Languages" options={LANGUAGES} selected={draft.languages} onChange={(v: string[]) => setDraft({...draft,languages:v})} />
    </div></div>
  );
}

/* ─── Step 4: Events & Equipment ─────────────────────────────────────────────── */
function StepEvents({ draft, setDraft, ChipSelect }: { draft: Draft; setDraft: (d: Draft) => void; ChipSelect: any }) {
  return (
    <div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#faf8ff] p-5 space-y-5">
      <h3 className="text-base font-bold text-purple-800">Event Types & Equipment</h3>
      <ChipSelect label="Event Types Supported" options={EVENT_TYPES} selected={draft.event_types_supported} onChange={(v: string[]) => setDraft({...draft,event_types_supported:v})} />
      <ChipSelect label="Equipment Included" options={EQUIPMENT_OPTIONS} selected={draft.equipment_included} onChange={(v: string[]) => setDraft({...draft,equipment_included:v})} />
    </div></div>
  );
}

/* ─── Step 5: Team ───────────────────────────────────────────────────────────── */
function StepTeam({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  return (
    <div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#faf8ff] p-5 space-y-4">
      <h3 className="text-base font-bold text-purple-800">Team Details</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {[{key:'band_members',label:'Band Members',ph:'e.g. 10'},{key:'lead_performer',label:'Lead Performer',ph:'e.g. 1'},{key:'drummers',label:'Drummers',ph:'e.g. 4'},{key:'instrumentalists',label:'Instrumentalists',ph:'e.g. 5'},{key:'singers',label:'Singers',ph:'e.g. 2'},{key:'support_staff',label:'Support Staff',ph:'e.g. 3'},{key:'sound_engineer',label:'Sound Engineers',ph:'e.g. 1'}].map(({key,label,ph}) => (
          <label key={key} className="block"><span className="text-sm font-semibold text-[#4b1d6b]">{label}</span><input className={inputClass} value={(draft as any)[key]} onChange={e => setDraft({...draft,[key]:e.target.value})} placeholder={ph} /></label>
        ))}
      </div>
    </div></div>
  );
}

/* ─── Step 6: Deliverables ───────────────────────────────────────────────────── */
function StepDeliverables({ draft, setDraft, ChipSelect }: { draft: Draft; setDraft: (d: Draft) => void; ChipSelect: any }) {
  return (<div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#faf8ff] p-5 space-y-5"><h3 className="text-base font-bold text-purple-800">Deliverables</h3><ChipSelect label="What's Included" options={DELIVERABLES} selected={draft.deliverables} onChange={(v: string[]) => setDraft({...draft,deliverables:v})} /></div></div>);
}

/* ─── Step 7: Add-ons ────────────────────────────────────────────────────────── */
function StepAddons({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const addAddon = (name?: string) => { setDraft({...draft,addons:[...draft.addons,{name:name||'',price:'',description:''}]}); };
  const removeAddon = (i: number) => { setDraft({...draft,addons:draft.addons.filter((_,idx)=>idx!==i)}); };
  const updateAddon = (i: number, field: keyof Addon, value: string) => { const a=[...draft.addons]; a[i]={...a[i],[field]:value}; setDraft({...draft,addons:a}); };
  const addFromTemplate = (t: string) => { if (!draft.addons.some(a => a.name.toLowerCase()===t.toLowerCase())) addAddon(t); else toast.info(`"${t}" already added`); };
  return (
    <div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#faf8ff] p-5">
      <div className="flex items-center justify-between mb-4"><div><h3 className="text-base font-bold text-purple-800">Add-ons</h3></div><button type="button" onClick={() => addAddon()} className="rounded-lg bg-purple-700/10 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-700/20"><Plus className="mr-1 inline h-3 w-3" />Custom</button></div>
      <div className="mb-4"><span className="text-xs font-semibold text-[#4b1d6b] mb-2 block">Quick Add:</span><div className="flex flex-wrap gap-1.5">{ADDON_TEMPLATES.map(t => (<button key={t} type="button" onClick={() => addFromTemplate(t)} className="rounded-full border border-[#e7d9c4] bg-white px-2.5 py-1 text-[11px] font-medium text-stone-600 hover:border-purple-600 hover:bg-purple-50 hover:text-purple-700">+ {t}</button>))}</div></div>
      {draft.addons.length===0?(<p className="text-center text-sm text-stone-400 py-4">No add-ons yet.</p>):(<div className="space-y-2">{draft.addons.map((addon,i) => (<div key={i} className="grid grid-cols-[1fr_90px_1fr_32px] gap-2 items-center"><input className={inputClass} value={addon.name} onChange={e => updateAddon(i,'name',e.target.value)} placeholder="Name" /><div className="relative"><span className="absolute left-2.5 top-2.5 text-xs text-stone-400">₹</span><input className={`${inputClass} pl-6`} type="number" value={addon.price} onChange={e => updateAddon(i,'price',e.target.value)} placeholder="0" /></div><input className={inputClass} value={addon.description} onChange={e => updateAddon(i,'description',e.target.value)} placeholder="Description" /><button type="button" onClick={() => removeAddon(i)} className="flex h-9 w-9 items-center justify-center rounded-lg text-red-400 hover:bg-red-50"><X className="h-4 w-4" /></button></div>))}</div>)}
    </div></div>
  );
}

/* ─── Step 8: Preview ────────────────────────────────────────────────────────── */
function StepPreview({ draft }: { draft: Draft }) {
  return (
    <div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#faf8ff] p-5">
      <h3 className="mb-4 text-base font-bold text-purple-800">Preview</h3>
      <div className="overflow-hidden rounded-2xl border border-[#eadfcf] bg-white shadow-sm">
        {draft.cover_file||draft.cover_url?(<div className="h-36 overflow-hidden"><img src={draft.cover_file?URL.createObjectURL(draft.cover_file):draft.cover_url} alt="Cover" className="w-full h-full object-cover" /></div>):(<div className="flex h-36 items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-50"><Music className="h-8 w-8 text-purple-700/40" /></div>)}
        <div className="p-5">
          <div className="flex items-start justify-between"><h4 className="text-lg font-bold text-[#4b1d6b]">{draft.name||'Package Name'}</h4><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${draft.status==='active'?'bg-purple-100 text-purple-700':'bg-blue-50 text-blue-700'}`}>{draft.status}</span></div>
          {draft.band_category && <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-medium text-purple-800"><Music className="h-3 w-3" />{draft.band_category}</span>}
          {draft.description && <p className="mt-2 text-sm text-stone-500 line-clamp-2">{draft.description}</p>}
          {draft.package_price && <p className="mt-2 text-2xl font-bold text-purple-700">₹{Number(draft.package_price||0).toLocaleString('en-IN')}</p>}
          {draft.advance_percentage && <p className="text-xs text-stone-500">Advance: {draft.advance_percentage}%</p>}
          {draft.performance_duration && <p className="mt-1 text-xs text-stone-500">Duration: {draft.performance_duration}</p>}
          {draft.number_of_performers && <p className="text-xs text-stone-500">Performers: {draft.number_of_performers}</p>}
          {draft.instruments.length>0 && (<div className="mt-3 border-t border-stone-100 pt-3"><p className="text-xs font-semibold text-stone-600 mb-1.5">Instruments:</p><div className="flex flex-wrap gap-1">{draft.instruments.map(s => <span key={s} className="rounded-full bg-purple-700/8 px-2 py-0.5 text-[11px] text-purple-700">{s}</span>)}</div></div>)}
          {draft.event_types_supported.length>0 && (<div className="mt-3 border-t border-stone-100 pt-3"><p className="text-xs font-semibold text-stone-600 mb-1.5">Events:</p><div className="flex flex-wrap gap-1">{draft.event_types_supported.map(e => <span key={e} className="rounded-full border border-purple-200 px-2 py-0.5 text-[11px] text-purple-800">{e}</span>)}</div></div>)}
          {draft.deliverables.length>0 && (<div className="mt-3 border-t border-stone-100 pt-3"><p className="text-xs font-semibold text-stone-600 mb-1.5">Deliverables:</p><div className="flex flex-wrap gap-1">{draft.deliverables.map(d => <span key={d} className="rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] text-indigo-800">{d}</span>)}</div></div>)}
          {draft.addons.filter(a=>a.name.trim()).length>0 && (<div className="mt-3 border-t border-stone-100 pt-3"><p className="text-xs font-semibold text-stone-600 mb-1.5">Add-ons:</p>{draft.addons.filter(a=>a.name.trim()).map((a,i) => (<div key={i} className="flex justify-between text-xs mt-1"><span className="text-stone-700">{a.name}</span>{a.price&&<span className="font-semibold text-purple-800">+₹{Number(a.price).toLocaleString('en-IN')}</span>}</div>))}</div>)}
        </div>
      </div>
    </div></div>
  );
}
