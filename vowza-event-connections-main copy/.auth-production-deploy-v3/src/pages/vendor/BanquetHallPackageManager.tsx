import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, Eye, EyeOff, X, Check,
  ChevronRight, ChevronLeft, Upload, Building2, ChevronDown,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/* ─── Constants ─────────────────────────────────────────────────────────────── */
const VENUE_TYPES = [
  { value: 'Banquet Hall', name: 'Banquet Hall', facilities: ['Air Conditioning','Dining Area','Stage','Sound System','Parking','Washrooms','Security'], eventTypes: ['Wedding','Reception','Engagement','Birthday','Corporate Event'] },
  { value: 'Function Hall', name: 'Function Hall', facilities: ['Dining Area','Stage','Parking','Washrooms'], eventTypes: ['Wedding','Reception','Birthday','Religious Event'] },
  { value: 'Convention Hall', name: 'Convention Hall', facilities: ['Air Conditioning','Projector','Sound System','WiFi','Parking','Lift','Washrooms'], eventTypes: ['Corporate Event','Seminar','Conference','Award Function'] },
  { value: 'Wedding Hall', name: 'Wedding Hall', facilities: ['Air Conditioning','Dining Area','Stage','Sound System','Changing Rooms','Decoration Area','Parking'], eventTypes: ['Wedding','Reception','Engagement','Haldi','Mehendi'] },
  { value: 'Party Hall', name: 'Party Hall', facilities: ['Air Conditioning','Sound System','DJ Space','Parking'], eventTypes: ['Birthday','Baby Shower','Private Party','Anniversary'] },
  { value: 'Community Hall', name: 'Community Hall', facilities: ['Dining Area','Parking','Washrooms'], eventTypes: ['Wedding','Birthday','Religious Event','Festival'] },
  { value: 'Outdoor Venue', name: 'Outdoor Venue', facilities: ['Parking','Security'], eventTypes: ['Wedding','Reception','Birthday','Festival','Private Party'] },
  { value: 'Resort Venue', name: 'Resort Venue', facilities: ['Air Conditioning','Dining Area','Parking','Security','WiFi'], eventTypes: ['Wedding','Reception','Birthday','Corporate Event'] },
  { value: 'Hotel Banquet', name: 'Hotel Banquet', facilities: ['Air Conditioning','Dining Area','Stage','LED Wall','Sound System','VIP Lounge','Parking','Valet Parking','Security','Lift','Washrooms'], eventTypes: ['Wedding','Reception','Corporate Event','Award Function'] },
  { value: 'Lawn/Garden Venue', name: 'Lawn/Garden Venue', facilities: ['Parking','Security'], eventTypes: ['Wedding','Reception','Birthday','Private Party'] },
  { value: 'Rooftop Venue', name: 'Rooftop Venue', facilities: ['Parking','Lift','Security'], eventTypes: ['Birthday','Private Party','Engagement','Anniversary'] },
  { value: 'Temple/Traditional Venue', name: 'Temple/Traditional Venue', facilities: ['Dining Area','Parking','Washrooms'], eventTypes: ['Religious Event','Naming Ceremony','Wedding'] },
  { value: 'Corporate Event Venue', name: 'Corporate Event Venue', facilities: ['Air Conditioning','Projector','Sound System','WiFi','Parking','Lift','CCTV'], eventTypes: ['Corporate Event','Seminar','Conference','Award Function'] },
  { value: 'Custom', name: 'Custom Venue', facilities: [], eventTypes: [] },
];

const ALL_SEATING_STYLES = ['Theatre','Round Tables','Dining','Classroom','Reception','Floating Crowd','Custom'];
const ALL_VENUE_FEATURES = ['AC','Non-AC','Indoor','Outdoor','Lawn','Terrace','Parking','Valet Parking','Wheelchair Access','Elevator/Lift','Bridal Room','Changing Rooms','VIP Lounge','Power Backup','Generator'];
const ALL_FACILITIES = ['Dining Area','Stage','LED Wall','Projector','Sound System','DJ Space','Changing Rooms','Air Conditioning','Decoration Area','Kitchen','Buffet Area','Parking','Security','CCTV','WiFi','Lift','Washrooms'];
const ALL_EVENT_TYPES = ['Wedding','Reception','Engagement','Haldi','Mehendi','Birthday','Baby Shower','Naming Ceremony','Corporate Event','Seminar','Conference','Award Function','College Fest','Festival','Religious Event','Private Party','Anniversary','Housewarming','Cultural Event','Other Event'];
const CAPACITY_OPTIONS = ['50','100','200','300','500','750','1000','1500','2000+'];
const STEP_LABELS = ['Venue Type','Pricing','Venue Details','Facilities','Event Types','Rules','Gallery & Media','Preview'];

const inputClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition placeholder:text-stone-400 focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/15';

/* ─── Types ─────────────────────────────────────────────────────────────────── */
type Draft = {
  id?: string; name: string; description: string; venue_type: string; status: string;
  hall_rental_price: string; advance_percentage: string;
  hall_capacity: string; seating_styles: string[]; venue_features: string[];
  facilities_included: string[]; event_types_supported: string[];
  allowed_time: string; noise_restrictions: string; smoking_policy: string;
  outside_decoration_allowed: boolean; outside_catering_allowed: boolean;
  alcohol_allowed: boolean; fireworks_allowed: boolean;
  cancellation_policy: string; advance_refund_policy: string;
  virtual_tour_url: string; google_maps_url: string; address: string; city: string;
  cover_file: File | null; cover_url: string;
  gallery_files: File[]; gallery_urls: { id: string; url: string; is_cover: boolean }[];
  video_files: File[]; video_urls: { id: string; url: string }[];
};

const blank = (): Draft => ({
  name: '', description: '', venue_type: '', status: 'draft',
  hall_rental_price: '', advance_percentage: '20',
  hall_capacity: '', seating_styles: [], venue_features: [],
  facilities_included: [], event_types_supported: [],
  allowed_time: '', noise_restrictions: '', smoking_policy: '',
  outside_decoration_allowed: true, outside_catering_allowed: true,
  alcohol_allowed: false, fireworks_allowed: false,
  cancellation_policy: '', advance_refund_policy: '',
  virtual_tour_url: '', google_maps_url: '', address: '', city: '',
  cover_file: null, cover_url: '', gallery_files: [], gallery_urls: [],
  video_files: [], video_urls: [],
});

/* ─── Main Component ────────────────────────────────────────────────────────── */
export default function BanquetHallPackageManager({ provider }: { provider: any }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['banquet-halls', provider.id],
    queryFn: async () => { const r = await (supabase.from('banquet_halls' as any).select('*').eq('provider_id', provider.id).order('created_at', { ascending: false })); if (r.error) throw r.error; return r.data ?? []; },
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['banquet-halls', provider.id] });
  useEffect(() => { const ch = supabase.channel(`banquet-halls-${provider.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'banquet_halls', filter: `provider_id=eq.${provider.id}` }, refresh).subscribe(); return () => { supabase.removeChannel(ch); }; }, [provider.id]);

  const edit = async (pkg: any) => {
    let galleryUrls: { id: string; url: string; is_cover: boolean }[] = []; let videoUrls: { id: string; url: string }[] = []; let coverUrl = '';
    try { const r = await (supabase.from('hall_gallery' as any).select('id, public_url, is_cover, sort_order, media_type').eq('package_id', pkg.id).order('sort_order')); const g = (r.data??[]).map((x: any) => ({ id: x.id, url: x.public_url, is_cover: x.is_cover, media_type: x.media_type||'image' })); coverUrl = g.find((x: any) => x.is_cover)?.url||''; galleryUrls = g.filter((x: any) => !x.is_cover && x.media_type==='image'); videoUrls = g.filter((x: any) => x.media_type==='video').map((x: any) => ({ id: x.id, url: x.url })); } catch (_) {}
    setDraft({ id: pkg.id, name: pkg.name||'', description: pkg.description||'', venue_type: pkg.venue_type||'', status: pkg.status||'draft',
      hall_rental_price: String(pkg.hall_rental_price??''), advance_percentage: String(pkg.advance_percentage || 20),
      hall_capacity: pkg.hall_capacity||'', seating_styles: pkg.seating_styles??[], venue_features: pkg.venue_features??[],
      facilities_included: pkg.facilities_included??[], event_types_supported: pkg.event_types_supported??[],
      allowed_time: pkg.allowed_time||'', noise_restrictions: pkg.noise_restrictions||'', smoking_policy: pkg.smoking_policy||'',
      outside_decoration_allowed: pkg.outside_decoration_allowed??true, outside_catering_allowed: pkg.outside_catering_allowed??true,
      alcohol_allowed: pkg.alcohol_allowed??false, fireworks_allowed: pkg.fireworks_allowed??false,
      cancellation_policy: pkg.cancellation_policy||'', advance_refund_policy: pkg.advance_refund_policy||'',
      virtual_tour_url: pkg.virtual_tour_url||'', google_maps_url: pkg.google_maps_url||'', address: pkg.address||'', city: pkg.city||'',
      cover_file: null, cover_url: coverUrl, gallery_files: [], gallery_urls: galleryUrls,
      video_files: [], video_urls: videoUrls });
    setStep(1);
  };

  const save = async () => {
    if (!draft || !draft.name.trim()) { toast.error('Venue name is required.'); setStep(1); return; }
    if (!draft.hall_rental_price) { toast.error('Venue price is required.'); setStep(2); return; }
    if (!draft.cover_file && !draft.cover_url) { toast.error('Cover photo is required.'); setStep(7); return; }
    setBusy(true);
    try {
      const payload: any = { provider_id: provider.id, name: draft.name.trim(), venue_type: draft.venue_type||null, description: draft.description.trim()||null, status: draft.status, hall_rental_price: Number(draft.hall_rental_price), advance_percentage: draft.advance_percentage ? Number(draft.advance_percentage) : 20, hall_capacity: draft.hall_capacity||null, seating_styles: draft.seating_styles, venue_features: draft.venue_features, facilities_included: draft.facilities_included, event_types_supported: draft.event_types_supported, allowed_time: draft.allowed_time||null, noise_restrictions: draft.noise_restrictions||null, smoking_policy: draft.smoking_policy||null, outside_decoration_allowed: draft.outside_decoration_allowed, outside_catering_allowed: draft.outside_catering_allowed, alcohol_allowed: draft.alcohol_allowed, fireworks_allowed: draft.fireworks_allowed, cancellation_policy: draft.cancellation_policy||null, advance_refund_policy: draft.advance_refund_policy||null, virtual_tour_url: draft.virtual_tour_url||null, google_maps_url: draft.google_maps_url||null, address: draft.address||null, city: draft.city||null };
      let packageId = draft.id;
      if (draft.id) { const r = await (supabase.from('banquet_halls' as any).update(payload).eq('id', draft.id).select('id').single()); if (r.error) throw r.error; }
      else { const r = await (supabase.from('banquet_halls' as any).insert(payload).select('id').single()); if (r.error) throw r.error; packageId = r.data.id; }
      if (packageId) {
        if (draft.cover_file) { const ext = draft.cover_file.name.split('.').pop(); const path = `${user!.id}/${packageId}/cover-${crypto.randomUUID()}.${ext}`; const { error: upErr } = await supabase.storage.from('banquet-media').upload(path, draft.cover_file, { contentType: draft.cover_file.type }); if (!upErr) { const url = supabase.storage.from('banquet-media').getPublicUrl(path).data.publicUrl; await (supabase.from('hall_gallery' as any).delete().eq('package_id', packageId).eq('is_cover', true)); await (supabase.from('hall_gallery' as any).insert({ package_id: packageId, storage_path: path, public_url: url, is_cover: true, media_type: 'image', sort_order: 0 })); } }
        if (draft.gallery_files.length > 0) { for (let i = 0; i < draft.gallery_files.length; i++) { const file = draft.gallery_files[i]; const ext = file.name.split('.').pop(); const path = `${user!.id}/${packageId}/gallery-${crypto.randomUUID()}.${ext}`; const { error: upErr } = await supabase.storage.from('banquet-media').upload(path, file, { contentType: file.type }); if (!upErr) { const url = supabase.storage.from('banquet-media').getPublicUrl(path).data.publicUrl; await (supabase.from('hall_gallery' as any).insert({ package_id: packageId, storage_path: path, public_url: url, is_cover: false, media_type: 'image', sort_order: draft.gallery_urls.length + i + 1 })); } } }
        if (draft.video_files.length > 0) { for (let i = 0; i < draft.video_files.length; i++) { const file = draft.video_files[i]; const ext = file.name.split('.').pop(); const path = `${user!.id}/${packageId}/video-${crypto.randomUUID()}.${ext}`; const { error: upErr } = await supabase.storage.from('banquet-media').upload(path, file, { contentType: file.type }); if (!upErr) { const url = supabase.storage.from('banquet-media').getPublicUrl(path).data.publicUrl; await (supabase.from('hall_gallery' as any).insert({ package_id: packageId, storage_path: path, public_url: url, is_cover: false, media_type: 'video', sort_order: 100 + i })); } } }
        if (draft.id) { const cur = [...draft.gallery_urls.map(g => g.id), ...draft.video_urls.map(v => v.id)].filter(Boolean); const { data: ex } = await (supabase.from('hall_gallery' as any).select('id').eq('package_id', packageId).eq('is_cover', false)); const del = (ex??[]).map((e: any) => e.id).filter((id: string) => !cur.includes(id)); if (del.length > 0) await (supabase.from('hall_gallery' as any).delete().in('id', del)); }
      }
      toast.success('Venue saved!'); setDraft(null); setStep(1); refresh();
    } catch (err: any) { toast.error(err.message || 'Could not save'); } finally { setBusy(false); }
  };

  const toggleStatus = async (pkg: any) => { await (supabase.from('banquet_halls' as any).update({ status: pkg.status === 'active' ? 'draft' : 'active' }).eq('id', pkg.id)); refresh(); };
  const remove = async (pkg: any) => { if (!confirm('Delete this venue?')) return; await (supabase.from('banquet_halls' as any).delete().eq('id', pkg.id)); refresh(); toast.success('Deleted'); };
  const openNew = () => { setDraft(blank()); setStep(1); };

  const ChipSelect = ({ options, selected, onChange, label }: { options: string[]; selected: string[]; onChange: (v: string[]) => void; label: string }) => (
    <div><span className="text-sm font-semibold text-[#1b1b4e]">{label}</span><div className="mt-1.5 flex flex-wrap gap-2">{options.map(opt => (
      <button key={opt} type="button" onClick={() => onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt])}
        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${selected.includes(opt) ? 'border-violet-600 bg-violet-600/10 text-violet-700' : 'border-[#e7d9c4] text-stone-600 hover:border-violet-500'}`}>{opt}</button>
    ))}</div></div>
  );

  const renderStep = () => { if (!draft) return null; switch(step) {
    case 1: return <StepVenueType draft={draft} setDraft={setDraft} />;
    case 2: return <StepPricing draft={draft} setDraft={setDraft} />;
    case 3: return <StepVenueDetails draft={draft} setDraft={setDraft} ChipSelect={ChipSelect} />;
    case 4: return <StepFacilities draft={draft} setDraft={setDraft} ChipSelect={ChipSelect} />;
    case 5: return <StepEventTypes draft={draft} setDraft={setDraft} ChipSelect={ChipSelect} />;
    case 6: return <StepRules draft={draft} setDraft={setDraft} />;
    case 7: return <StepGallery draft={draft} setDraft={setDraft} />;
    case 8: return <StepPreview draft={draft} />;
    default: return null;
  }};

  return (
    <div className="max-w-[1200px] space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div><h1 className="text-xl font-bold text-[#1b1b4e]">Banquet Hall Venues</h1><p className="text-sm text-muted-foreground">Create and manage your venue listings.</p></div>
        <button onClick={openNew} className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-800"><Plus className="mr-1 inline h-4 w-4" />Add Venue</button>
      </div>
      {isLoading ? (<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[1,2,3].map(i => <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : packages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#eadfcf] py-16 text-center">
          <Building2 className="h-12 w-12 text-violet-700/30" /><p className="mt-3 font-semibold text-[#1b1b4e]">No venues yet</p>
          <button onClick={openNew} className="mt-4 rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white"><Plus className="mr-1 inline h-4 w-4" />Add Venue</button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{packages.map((pkg: any) => (
          <div key={pkg.id} className="overflow-hidden rounded-2xl border border-[#eadfcf] bg-[#faf8ff] shadow-sm hover:shadow-md transition">
            <div className="flex h-28 items-center justify-center bg-gradient-to-br from-violet-50 to-amber-50"><Building2 className="h-10 w-10 text-violet-700/40" /></div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2"><h2 className="font-bold text-[#1b1b4e] leading-tight">{pkg.name}</h2>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${pkg.status==='active'?'bg-violet-100 text-violet-700':pkg.status==='paused'?'bg-amber-100 text-amber-700':'bg-blue-50 text-blue-700'}`}>{pkg.status}</span></div>
              {pkg.hall_rental_price && <p className="mt-1.5 text-lg font-bold text-violet-700">₹{Number(pkg.hall_rental_price).toLocaleString('en-IN')}</p>}
              {pkg.venue_type && <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{pkg.venue_type}</div>}
              {pkg.hall_capacity && <div className="mt-0.5 text-xs text-muted-foreground">Capacity: {pkg.hall_capacity}</div>}
              <div className="mt-4 flex gap-2">
                <button onClick={() => edit(pkg)} className="flex-1 rounded-lg border border-[#e7d9c4] py-2 text-xs font-medium text-[#1b1b4e] hover:bg-[#faf8ff]"><Pencil className="mr-1 inline h-3 w-3" />Edit</button>
                <button onClick={() => toggleStatus(pkg)} className="rounded-lg border border-[#e7d9c4] p-2 hover:bg-[#faf8ff]">{pkg.status==='active'?<EyeOff className="h-3.5 w-3.5 text-stone-600" />:<Eye className="h-3.5 w-3.5 text-stone-600" />}</button>
                <button onClick={() => remove(pkg)} className="rounded-lg border border-red-200 p-2 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5 text-red-600" /></button>
              </div>
            </div>
          </div>
        ))}</div>
      )}
      {draft && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#1b1b4e]/65 p-3 backdrop-blur-sm sm:p-6">
          <div className="mx-auto my-3 max-w-3xl overflow-hidden rounded-[24px] bg-[#fefeff] shadow-2xl">
            <header className="flex items-start justify-between gap-4 bg-violet-800 px-5 py-5 sm:px-7"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-200">Vowza Banquet Hall</p><h2 className="mt-1 text-lg font-bold text-white">{draft.id?'Edit Venue':'Add New Venue'}</h2></div><button onClick={() => {setDraft(null);setStep(1);}} className="rounded-full p-2 text-white/85 hover:bg-white/15"><X className="h-5 w-5" /></button></header>
            <div className="border-b border-[#eadfcf] bg-[#faf8ff] px-5 py-4 sm:px-7"><div className="flex items-center justify-between">{STEP_LABELS.map((label, i) => { const sn=i+1; const done=step>sn; const cur=step===sn; return (<div key={i} className="flex flex-1 items-center"><div className="flex flex-col items-center"><div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${done?'bg-violet-500 text-white':cur?'bg-violet-700 text-white shadow-md':'border-2 border-[#e7d9c4] text-stone-400'}`}>{done?<Check className="h-4 w-4" />:sn}</div><span className={`mt-1 hidden text-[10px] font-medium sm:block ${cur?'text-violet-700':done?'text-violet-600':'text-stone-400'}`}>{label}</span></div>{i<7&&<div className={`mx-1 h-0.5 flex-1 rounded ${done?'bg-violet-400':'bg-[#e7d9c4]'}`}/>}</div>);})}</div></div>
            <div className="p-5 sm:p-7 max-h-[60vh] overflow-y-auto">{renderStep()}</div>
            <div className="flex items-center justify-between border-t border-[#eadfcf] bg-[#faf8ff]/95 px-5 py-4 backdrop-blur sm:px-7">
              <button type="button" onClick={() => step>1?setStep(step-1):setDraft(null)} className="flex items-center gap-1.5 rounded-xl border border-[#d7c5ae] px-4 py-2.5 text-sm font-semibold text-[#1b1b4e] hover:bg-white"><ChevronLeft className="h-4 w-4" />{step===1?'Cancel':'Back'}</button>
              {step<8?(<button type="button" onClick={() => setStep(step+1)} className="flex items-center gap-1.5 rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-800">Next<ChevronRight className="h-4 w-4" /></button>
              ):(<button type="button" disabled={busy} onClick={save} className="rounded-xl bg-violet-700 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-800 disabled:opacity-60">{busy?'Saving…':'Save Venue'}</button>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ─── Step 1: Venue Type ─────────────────────────────────────────────────────── */
function StepVenueType({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const handleTypeChange = (value: string) => {
    const sel = VENUE_TYPES.find(t => t.value === value);
    if (sel) setDraft({ ...draft, venue_type: value, facilities_included: [...sel.facilities], event_types_supported: [...sel.eventTypes] });
    else setDraft({ ...draft, venue_type: value });
  };
  const selectedType = VENUE_TYPES.find(t => t.value === draft.venue_type);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#faf8ff] p-5">
        <h3 className="mb-4 text-base font-bold text-violet-800">Select Venue Type</h3>
        <select className={`${inputClass} text-base py-3`} value={draft.venue_type} onChange={e => handleTypeChange(e.target.value)}>
          <option value="">Select Venue Type</option>
          {VENUE_TYPES.map(t => <option key={t.value} value={t.value}>{t.name}</option>)}
        </select>
        {selectedType && selectedType.value !== 'Custom' && (<div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/50 p-3"><p className="text-xs font-semibold text-violet-700 flex items-center gap-1"><Check className="h-3.5 w-3.5" />Auto-loaded facilities & event types</p></div>)}
      </div>
      <div className="rounded-2xl border border-[#eadfcf] bg-[#faf8ff] p-5 space-y-4">
        <h3 className="text-base font-bold text-violet-800">Venue Info</h3>
        <label className="block"><span className="text-sm font-semibold text-[#1b1b4e]">Venue Name <span className="text-red-500">*</span></span><input className={inputClass} value={draft.name} onChange={e => setDraft({...draft, name: e.target.value})} placeholder="e.g. Grand Palace Banquet Hall" /></label>
        <label className="block"><span className="text-sm font-semibold text-[#1b1b4e]">Description</span><textarea className={`${inputClass} min-h-[80px] resize-y`} value={draft.description} onChange={e => setDraft({...draft, description: e.target.value})} placeholder="Describe your venue..." /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="text-sm font-semibold text-[#1b1b4e]">Address</span><input className={inputClass} value={draft.address} onChange={e => setDraft({...draft, address: e.target.value})} placeholder="Full address" /></label>
          <label className="block"><span className="text-sm font-semibold text-[#1b1b4e]">City</span><input className={inputClass} value={draft.city} onChange={e => setDraft({...draft, city: e.target.value})} placeholder="City" /></label>
          <label className="block"><span className="text-sm font-semibold text-[#1b1b4e]">Google Maps URL</span><input className={inputClass} value={draft.google_maps_url} onChange={e => setDraft({...draft, google_maps_url: e.target.value})} placeholder="https://maps.google.com/..." /></label>
          <label className="block"><span className="text-sm font-semibold text-[#1b1b4e]">Virtual Tour URL</span><input className={inputClass} value={draft.virtual_tour_url} onChange={e => setDraft({...draft, virtual_tour_url: e.target.value})} placeholder="https://..." /></label>
        </div>
        <label className="block"><span className="text-sm font-semibold text-[#1b1b4e]">Status</span><select className={inputClass} value={draft.status} onChange={e => setDraft({...draft, status: e.target.value})}><option value="draft">Draft</option><option value="active">Active</option></select></label>
      </div>
    </div>
  );
}

/* ─── Step 2: Pricing ────────────────────────────────────────────────────────── */
function StepPricing({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const price = Number(draft.hall_rental_price||0); const advPct = Number(draft.advance_percentage||20);
  const advAmount = Math.round(price * advPct / 100); const remaining = price - advAmount;
  return (<div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#faf8ff] p-5">
    <h3 className="mb-4 text-base font-bold text-violet-800">Venue Pricing</h3>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block"><span className="text-sm font-semibold text-[#1b1b4e]">Venue Price <span className="text-red-500">*</span></span><div className="relative"><span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span><input className={`${inputClass} pl-7`} type="number" min="0" value={draft.hall_rental_price} onChange={e => setDraft({...draft,hall_rental_price:e.target.value})} placeholder="Total venue price" /></div></label>
      <label className="block"><span className="text-sm font-semibold text-[#1b1b4e]">Advance %</span><div className="relative"><span className="absolute right-3.5 top-2.5 text-sm text-stone-500">%</span><input className={`${inputClass} pr-7`} type="number" min="0" max="100" value={draft.advance_percentage} onChange={e => setDraft({...draft,advance_percentage:e.target.value})} placeholder="20" /></div></label>
    </div>
    {price > 0 && (<div className="mt-4 rounded-xl border border-[#eadfcf] bg-violet-50/30 p-4 space-y-2">
      <div className="flex justify-between text-sm"><span className="text-stone-600">Venue Price</span><span className="font-bold text-violet-700">₹{price.toLocaleString('en-IN')}</span></div>
      <div className="flex justify-between text-sm"><span className="text-stone-600">Advance ({advPct}%)</span><span className="font-semibold text-emerald-700">₹{advAmount.toLocaleString('en-IN')}</span></div>
      <div className="flex justify-between text-sm border-t border-[#eadfcf] pt-2"><span className="text-stone-600">Remaining</span><span className="font-semibold">₹{remaining.toLocaleString('en-IN')}</span></div>
    </div>)}
  </div></div>);
}

/* ─── Step 3: Venue Details ──────────────────────────────────────────────────── */
function StepVenueDetails({ draft, setDraft, ChipSelect }: { draft: Draft; setDraft: (d: Draft) => void; ChipSelect: any }) {
  return (<div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#faf8ff] p-5 space-y-5">
    <h3 className="text-base font-bold text-violet-800">Venue Details</h3>
    <label className="block"><span className="text-sm font-semibold text-[#1b1b4e]">Hall Capacity</span><select className={inputClass} value={draft.hall_capacity} onChange={e => setDraft({...draft,hall_capacity:e.target.value})}><option value="">Select capacity</option>{CAPACITY_OPTIONS.map(c => <option key={c} value={c}>{c} guests</option>)}</select></label>
    <ChipSelect label="Seating Styles" options={ALL_SEATING_STYLES} selected={draft.seating_styles} onChange={(v: string[]) => setDraft({...draft,seating_styles:v})} />
    <ChipSelect label="Venue Features" options={ALL_VENUE_FEATURES} selected={draft.venue_features} onChange={(v: string[]) => setDraft({...draft,venue_features:v})} />
  </div></div>);
}

/* ─── Step 4: Facilities ─────────────────────────────────────────────────────── */
function StepFacilities({ draft, setDraft, ChipSelect }: { draft: Draft; setDraft: (d: Draft) => void; ChipSelect: any }) {
  return (<div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#faf8ff] p-5 space-y-5"><h3 className="text-base font-bold text-violet-800">Facilities</h3><ChipSelect label="Available Facilities" options={ALL_FACILITIES} selected={draft.facilities_included} onChange={(v: string[]) => setDraft({...draft,facilities_included:v})} /></div></div>);
}

/* ─── Step 5: Event Types ────────────────────────────────────────────────────── */
function StepEventTypes({ draft, setDraft, ChipSelect }: { draft: Draft; setDraft: (d: Draft) => void; ChipSelect: any }) {
  return (<div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#faf8ff] p-5 space-y-5"><h3 className="text-base font-bold text-violet-800">Supported Event Types</h3><ChipSelect label="Events This Venue Supports" options={ALL_EVENT_TYPES} selected={draft.event_types_supported} onChange={(v: string[]) => setDraft({...draft,event_types_supported:v})} /></div></div>);
}

/* ─── Step 6: Rules ──────────────────────────────────────────────────────────── */
function StepRules({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  return (<div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#faf8ff] p-5 space-y-4">
    <h3 className="text-base font-bold text-violet-800">Venue Rules & Policies</h3>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block"><span className="text-sm font-semibold text-[#1b1b4e]">Allowed Time</span><input className={inputClass} value={draft.allowed_time} onChange={e => setDraft({...draft,allowed_time:e.target.value})} placeholder="e.g. 8 AM - 11 PM" /></label>
      <label className="block"><span className="text-sm font-semibold text-[#1b1b4e]">Noise Restrictions</span><input className={inputClass} value={draft.noise_restrictions} onChange={e => setDraft({...draft,noise_restrictions:e.target.value})} placeholder="e.g. No loud music after 10 PM" /></label>
      <label className="block"><span className="text-sm font-semibold text-[#1b1b4e]">Smoking Policy</span><input className={inputClass} value={draft.smoking_policy} onChange={e => setDraft({...draft,smoking_policy:e.target.value})} placeholder="e.g. Designated areas only" /></label>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 pt-2">
      <label className="flex items-center gap-3 rounded-xl border border-[#eadfcf] p-3 cursor-pointer"><input type="checkbox" checked={draft.outside_decoration_allowed} onChange={e => setDraft({...draft,outside_decoration_allowed:e.target.checked})} className="h-4 w-4 rounded border-[#e7d9c4] text-violet-700" /><span className="text-sm font-semibold text-[#1b1b4e]">Outside Decoration Allowed</span></label>
      <label className="flex items-center gap-3 rounded-xl border border-[#eadfcf] p-3 cursor-pointer"><input type="checkbox" checked={draft.outside_catering_allowed} onChange={e => setDraft({...draft,outside_catering_allowed:e.target.checked})} className="h-4 w-4 rounded border-[#e7d9c4] text-violet-700" /><span className="text-sm font-semibold text-[#1b1b4e]">Outside Catering Allowed</span></label>
      <label className="flex items-center gap-3 rounded-xl border border-[#eadfcf] p-3 cursor-pointer"><input type="checkbox" checked={draft.alcohol_allowed} onChange={e => setDraft({...draft,alcohol_allowed:e.target.checked})} className="h-4 w-4 rounded border-[#e7d9c4] text-violet-700" /><span className="text-sm font-semibold text-[#1b1b4e]">Alcohol Allowed</span></label>
      <label className="flex items-center gap-3 rounded-xl border border-[#eadfcf] p-3 cursor-pointer"><input type="checkbox" checked={draft.fireworks_allowed} onChange={e => setDraft({...draft,fireworks_allowed:e.target.checked})} className="h-4 w-4 rounded border-[#e7d9c4] text-violet-700" /><span className="text-sm font-semibold text-[#1b1b4e]">Fireworks Allowed</span></label>
    </div>
    <label className="block"><span className="text-sm font-semibold text-[#1b1b4e]">Cancellation Policy</span><textarea className={`${inputClass} min-h-[60px] resize-y`} value={draft.cancellation_policy} onChange={e => setDraft({...draft,cancellation_policy:e.target.value})} placeholder="Cancellation terms..." /></label>
    <label className="block"><span className="text-sm font-semibold text-[#1b1b4e]">Advance Refund Policy</span><textarea className={`${inputClass} min-h-[60px] resize-y`} value={draft.advance_refund_policy} onChange={e => setDraft({...draft,advance_refund_policy:e.target.value})} placeholder="Refund terms..." /></label>
  </div></div>);
}

/* ─── Step 7: Gallery & Media ────────────────────────────────────────────────── */
function StepGallery({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  return (
    <div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#faf8ff] p-5">
      <h3 className="mb-4 text-base font-bold text-violet-800">Gallery & Media</h3>
      {/* Cover */}
      <div className="mb-5">
        <span className="text-sm font-semibold text-[#1b1b4e]">Cover Photo <span className="text-red-500">*</span></span>
        {(draft.cover_file||draft.cover_url) ? (
          <div className="relative rounded-xl overflow-hidden border border-[#eadfcf] bg-stone-50 mt-2"><img src={draft.cover_file?URL.createObjectURL(draft.cover_file):draft.cover_url} alt="Cover" className="w-full h-40 object-cover" /><button type="button" onClick={() => setDraft({...draft, cover_file: null, cover_url: ''})} className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"><X className="h-3.5 w-3.5" /></button></div>
        ) : (
          <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-violet-300 bg-violet-50 p-6 hover:border-violet-600"><Upload className="h-6 w-6 text-violet-700 mb-2" /><span className="text-sm font-semibold text-[#1b1b4e]">Upload cover photo</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f=e.target.files?.[0]; if(f&&f.size<=5*1024*1024) setDraft({...draft,cover_file:f}); else if(f) toast.error('Max 5MB'); }} /></label>
        )}
      </div>
      {/* Gallery */}
      <div className="mb-5">
        <span className="text-sm font-semibold text-[#1b1b4e]">Venue Photos (max 20)</span>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2">
          {draft.gallery_urls.map((img,i) => (<div key={img.id||i} className="relative rounded-xl overflow-hidden border border-[#eadfcf] aspect-square bg-stone-50"><img src={img.url} alt="" className="w-full h-full object-cover" /><button type="button" onClick={() => setDraft({...draft,gallery_urls:draft.gallery_urls.filter((_,idx)=>idx!==i)})} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white"><X className="h-3 w-3" /></button></div>))}
          {draft.gallery_files.map((f,i) => (<div key={`new-${i}`} className="relative rounded-xl overflow-hidden border border-[#eadfcf] aspect-square bg-stone-50"><img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" /><button type="button" onClick={() => setDraft({...draft,gallery_files:draft.gallery_files.filter((_,idx)=>idx!==i)})} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white"><X className="h-3 w-3" /></button></div>))}
          {(draft.gallery_urls.length+draft.gallery_files.length)<20 && (<label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-violet-300 bg-violet-50 aspect-square hover:border-violet-600"><Plus className="h-5 w-5 text-violet-700" /><span className="text-[9px] text-stone-500 mt-1">+ Photo</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={e => { const files=Array.from(e.target.files??[]).filter(f=>f.size<=5*1024*1024).slice(0,20-draft.gallery_urls.length-draft.gallery_files.length); if(files.length) setDraft({...draft,gallery_files:[...draft.gallery_files,...files]}); }} /></label>)}
        </div>
      </div>
      {/* Videos */}
      <div>
        <span className="text-sm font-semibold text-[#1b1b4e]">Venue Videos (max 3)</span>
        <p className="text-xs text-stone-500 mb-2">Upload venue walkthrough/event videos (MP4/MOV/WEBM, max 100MB)</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {draft.video_urls.map((vid,i) => (<div key={vid.id||i} className="relative rounded-xl overflow-hidden border border-violet-200 bg-violet-50 aspect-video"><video src={vid.url} className="w-full h-full object-cover rounded-xl" muted preload="metadata" /><span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white font-bold">VIDEO</span><button type="button" onClick={() => setDraft({...draft,video_urls:draft.video_urls.filter((_,idx)=>idx!==i)})} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"><X className="h-3 w-3" /></button></div>))}
          {draft.video_files.map((f,i) => (<div key={`newv-${i}`} className="relative rounded-xl overflow-hidden border border-violet-200 bg-violet-50 aspect-video"><video src={URL.createObjectURL(f)} className="w-full h-full object-cover rounded-xl" muted preload="metadata" /><span className="absolute bottom-1 left-1 rounded bg-violet-700 px-1.5 py-0.5 text-[9px] text-white font-bold">NEW</span><button type="button" onClick={() => setDraft({...draft,video_files:draft.video_files.filter((_,idx)=>idx!==i)})} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"><X className="h-3 w-3" /></button></div>))}
          {(draft.video_urls.length+draft.video_files.length)<3 && (<label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-violet-300 bg-violet-50 aspect-video hover:border-violet-600"><Upload className="h-5 w-5 text-violet-700" /><span className="text-[10px] text-stone-500 mt-1">+ Add Video</span><input type="file" accept="video/mp4,video/mov,video/webm,video/quicktime" multiple className="hidden" onChange={e => { const files=Array.from(e.target.files??[]).filter(f=>f.size<=100*1024*1024).slice(0,3-draft.video_urls.length-draft.video_files.length); if(files.length) setDraft({...draft,video_files:[...draft.video_files,...files]}); else if(e.target.files?.length) toast.error('Max 100MB per video'); }} /></label>)}
        </div>
      </div>
    </div></div>
  );
}

/* ─── Step 8: Preview ────────────────────────────────────────────────────────── */
function StepPreview({ draft }: { draft: Draft }) {
  const price = Number(draft.hall_rental_price||0); const advPct = Number(draft.advance_percentage||20);
  const advAmount = Math.round(price * advPct / 100); const remaining = price - advAmount;
  return (
    <div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#faf8ff] p-5">
      <h3 className="mb-4 text-base font-bold text-violet-800">Preview</h3>
      <div className="overflow-hidden rounded-2xl border border-[#eadfcf] bg-white shadow-sm">
        {draft.cover_file||draft.cover_url?(<div className="h-36 overflow-hidden"><img src={draft.cover_file?URL.createObjectURL(draft.cover_file):draft.cover_url} alt="Cover" className="w-full h-full object-cover" /></div>):(<div className="flex h-36 items-center justify-center bg-gradient-to-br from-violet-50 to-amber-50"><Building2 className="h-8 w-8 text-violet-700/40" /></div>)}
        <div className="p-5">
          <div className="flex items-start justify-between"><h4 className="text-lg font-bold text-[#1b1b4e]">{draft.name||'Venue Name'}</h4><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${draft.status==='active'?'bg-violet-100 text-violet-700':'bg-blue-50 text-blue-700'}`}>{draft.status==='active'?'Published':'Draft'}</span></div>
          {draft.venue_type && <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-medium text-violet-800"><Building2 className="h-3 w-3" />{draft.venue_type}</span>}
          {draft.description && <p className="mt-2 text-sm text-stone-500 line-clamp-2">{draft.description}</p>}
          {draft.address && <p className="mt-1 text-xs text-stone-500">📍 {draft.address}{draft.city?`, ${draft.city}`:''}</p>}
          {price > 0 && (<div className="mt-3"><p className="text-2xl font-bold text-violet-700">₹{price.toLocaleString('en-IN')}</p><p className="text-xs text-stone-500">Advance: {advPct}% (₹{advAmount.toLocaleString('en-IN')}) · Remaining: ₹{remaining.toLocaleString('en-IN')}</p></div>)}
          {draft.hall_capacity && <p className="mt-2 text-xs text-stone-500">Capacity: {draft.hall_capacity} guests</p>}
          {draft.seating_styles.length>0 && (<div className="mt-3 border-t border-stone-100 pt-3"><p className="text-xs font-semibold text-stone-600 mb-1.5">Seating:</p><div className="flex flex-wrap gap-1">{draft.seating_styles.map(s => <span key={s} className="rounded-full bg-violet-700/8 px-2 py-0.5 text-[11px] text-violet-700">{s}</span>)}</div></div>)}
          {draft.facilities_included.length>0 && (<div className="mt-3 border-t border-stone-100 pt-3"><p className="text-xs font-semibold text-stone-600 mb-1.5">Facilities:</p><div className="flex flex-wrap gap-1">{draft.facilities_included.map(f => <span key={f} className="rounded-full border border-violet-200 px-2 py-0.5 text-[11px] text-violet-800">{f}</span>)}</div></div>)}
          {draft.event_types_supported.length>0 && (<div className="mt-3 border-t border-stone-100 pt-3"><p className="text-xs font-semibold text-stone-600 mb-1.5">Events:</p><div className="flex flex-wrap gap-1">{draft.event_types_supported.map(e => <span key={e} className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] text-amber-800">{e}</span>)}</div></div>)}
          <div className="mt-3 border-t border-stone-100 pt-3 space-y-1 text-[11px] text-stone-500">
            {draft.allowed_time && <p>⏰ {draft.allowed_time}</p>}
            <p>🎨 Outside Decoration: {draft.outside_decoration_allowed?'✅':'❌'}</p>
            <p>🍽️ Outside Catering: {draft.outside_catering_allowed?'✅':'❌'}</p>
            <p>🍷 Alcohol: {draft.alcohol_allowed?'✅':'❌'}</p>
            <p>🎆 Fireworks: {draft.fireworks_allowed?'✅':'❌'}</p>
          </div>
        </div>
      </div>
    </div></div>
  );
}
