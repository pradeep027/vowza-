import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, Eye, EyeOff, X, Check,
  ChevronRight, ChevronLeft, Upload, Flame, ChevronDown,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/* ─── Constants ─────────────────────────────────────────────────────────────── */
const PACKAGE_TYPES = [
  { value: 'Marriage', name: 'Marriage', included: ['Pooja','Homam','Mantras','Sankalpam','Blessings'], materials: ['Flowers','Coconuts','Kalash','Pooja Samagri','Havan Materials'], details: { bride_side_rituals: true, groom_side_rituals: true, muhurtham: true, reception: false } },
  { value: 'Gruhapravesam', name: 'Gruhapravesam', included: ['Pooja','Homam','Mantras','Sankalpam','Blessings'], materials: ['Flowers','Coconuts','Kalash','Pooja Samagri','Deepam'], details: { house_entry: true, vastu_ritual: true, milk_boiling: true } },
  { value: 'Satyanarayana Vratham', name: 'Satyanarayana Vratham', included: ['Pooja','Mantras','Sankalpam','Prasadam','Blessings'], materials: ['Flowers','Coconuts','Fruits','Pooja Samagri','Prasadam'], details: { pooja: true, katha: true, prasadam: true } },
  { value: 'Ganapathi Homam', name: 'Ganapathi Homam', included: ['Pooja','Homam','Mantras','Sankalpam','Blessings'], materials: ['Flowers','Coconuts','Havan Materials','Pooja Samagri'], details: { homam: true, purnahuti: true } },
  { value: 'Rudrabhishekam', name: 'Rudrabhishekam', included: ['Pooja','Mantras','Sankalpam','Blessings'], materials: ['Flowers','Coconuts','Kalash','Pooja Samagri','Deepam'], details: { abhishekam: true, archana: true } },
  { value: 'Upanayanam', name: 'Upanayanam', included: ['Pooja','Homam','Mantras','Sankalpam','Blessings'], materials: ['Flowers','Coconuts','Havan Materials','Pooja Samagri'], details: { sacred_thread: true, gayatri_upadesam: true, homam: true } },
  { value: 'Naming Ceremony', name: 'Naming Ceremony', included: ['Pooja','Mantras','Sankalpam','Blessings'], materials: ['Flowers','Coconuts','Pooja Samagri','Deepam'], details: { naming_ritual: true, blessings: true } },
  { value: 'Annaprasana', name: 'Annaprasana', included: ['Pooja','Mantras','Blessings'], materials: ['Flowers','Fruits','Pooja Samagri'], details: { first_feeding: true, blessings: true } },
  { value: 'Navagraha Pooja', name: 'Navagraha Pooja', included: ['Pooja','Homam','Mantras','Sankalpam'], materials: ['Flowers','Coconuts','Havan Materials','Pooja Samagri'], details: { navagraha_homam: true, archana: true } },
  { value: 'Vastu Pooja', name: 'Vastu Pooja', included: ['Pooja','Mantras','Sankalpam','Blessings'], materials: ['Flowers','Coconuts','Pooja Samagri','Deepam'], details: { vastu_shanti: true, bhoomi_pooja: true } },
  { value: 'Seemantham', name: 'Seemantham', included: ['Pooja','Mantras','Blessings'], materials: ['Flowers','Fruits','Pooja Samagri'], details: { seemantham_ritual: true, blessings: true } },
  { value: 'Nikah', name: 'Nikah', included: ['Pooja','Mantras','Blessings'], materials: ['Other Materials'], details: { nikah_ceremony: true, marriage_sermon: true } },
  { value: 'Christian Wedding', name: 'Christian Wedding', included: ['Blessings'], materials: ['Other Materials'], details: { wedding_blessing: true, holy_communion: true } },
  { value: 'Funeral Rituals', name: 'Funeral Rituals', included: ['Pooja','Mantras','Blessings'], materials: ['Flowers','Pooja Samagri','Deepam'], details: { antyeshti: true, shraddha: true } },
  { value: 'Shraddha Karma', name: 'Shraddha Karma', included: ['Pooja','Mantras','Sankalpam','Prasadam'], materials: ['Flowers','Coconuts','Pooja Samagri','Prasadam'], details: { shraddha: true, tarpan: true } },
  { value: 'Custom Service', name: 'Custom Service', included: [], materials: [], details: {} },
];

const ALL_LANGUAGES = ['Telugu','Hindi','English','Tamil','Kannada','Malayalam','Sanskrit','Marathi','Punjabi','Gujarati','Bengali','Urdu','Others'];
const ALL_MATERIALS = ['Flowers','Coconuts','Fruits','Kalash','Pooja Samagri','Havan Materials','Deepam','Prasadam','Other Materials'];
const ALL_INCLUDED = ['Pooja','Homam','Mantras','Sankalpam','Prasadam','Blessings','Temple Coordination','Material Guidance','Phone Consultation','Video Consultation','Festival Guidance'];
const DURATION_OPTIONS = ['30 Minutes','1 Hour','2 Hours','3 Hours','Half Day','Full Day'];
const ADDON_TEMPLATES = ['Additional Homam','Additional Ritual','Extra Priest','Assistant Priest','Pooja Materials','Temple Decoration','Music','Prasadam','Travel'];
const STEP_LABELS = ['Package Type','Pricing','Service Details','Ritual Info','Availability','Included Services','Add-ons','Preview'];

const inputClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition placeholder:text-stone-400 focus:border-[#b45309] focus:ring-2 focus:ring-[#b45309]/15';

/* ─── Types ─────────────────────────────────────────────────────────────────── */
type Addon = { name: string; price: string; description: string };
type Draft = {
  id?: string; name: string; description: string; package_type: string; status: string;
  service_price: string; advance_percentage: string; dakshina_included: boolean;
  travel_charges: string; outside_city_charges: string; extra_ritual_charges: string;
  extra_hours_charges: string; materials_included: boolean;
  service_details: Record<string, any>;
  duration: string; required_materials: string[]; temple_required: boolean;
  languages: string[]; years_of_experience: string;
  included_services: string[];
  available_cities: string[]; travel_distance: string;
  daily_capacity: string; max_bookings_per_day: string;
  addons: Addon[];
  cover_file: File | null; cover_url: string;
  gallery_files: File[]; gallery_urls: { id: string; url: string; is_cover: boolean }[];
  video_files: File[]; video_urls: { id: string; url: string }[];
};

const blank = (): Draft => ({
  name: '', description: '', package_type: '', status: 'draft',
  service_price: '', advance_percentage: '20', dakshina_included: false,
  travel_charges: '', outside_city_charges: '', extra_ritual_charges: '', extra_hours_charges: '',
  materials_included: false, service_details: {},
  duration: '', required_materials: [], temple_required: false,
  languages: [], years_of_experience: '',
  included_services: [],
  available_cities: [], travel_distance: '', daily_capacity: '2', max_bookings_per_day: '2',
  addons: [],
  cover_file: null, cover_url: '', gallery_files: [], gallery_urls: [],
  video_files: [], video_urls: [],
});

/* ─── Main Component ────────────────────────────────────────────────────────── */
export default function PriestPackageManager({ provider }: { provider: any }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['priest-packages', provider.id],
    queryFn: async () => {
      const r = await (supabase.from('priest_packages' as any).select('*').eq('provider_id', provider.id).order('created_at', { ascending: false }));
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['priest-packages', provider.id] });
  useEffect(() => {
    const channel = supabase.channel(`priest-packages-${provider.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'priest_packages', filter: `provider_id=eq.${provider.id}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [provider.id]);

  const edit = async (pkg: any) => {
    let addons: Addon[] = []; let galleryUrls: { id: string; url: string; is_cover: boolean }[] = []; let videoUrls: { id: string; url: string }[] = []; let coverUrl = '';
    try { const r = await (supabase.from('priest_addons' as any).select('name, price, description').eq('package_id', pkg.id).order('sort_order')); if (r.data) addons = r.data.map((a: any) => ({ name: a.name, price: String(a.price ?? ''), description: a.description || '' })); } catch (_) {}
    try { const r = await (supabase.from('priest_gallery' as any).select('id, public_url, is_cover, sort_order, media_type').eq('package_id', pkg.id).order('sort_order')); const g = (r.data ?? []).map((x: any) => ({ id: x.id, url: x.public_url, is_cover: x.is_cover, media_type: x.media_type||'image' })); coverUrl = g.find((x: any) => x.is_cover)?.url || ''; galleryUrls = g.filter((x: any) => !x.is_cover && x.media_type==='image'); videoUrls = g.filter((x: any) => x.media_type==='video').map((x: any) => ({ id: x.id, url: x.url })); } catch (_) {}
    setDraft({ id: pkg.id, name: pkg.name||'', description: pkg.description||'', package_type: pkg.package_type||'', status: pkg.status||'draft',
      service_price: String(pkg.service_price??''), advance_percentage: String(pkg.advance_percentage??'20'),
      dakshina_included: pkg.dakshina_included??false, travel_charges: String(pkg.travel_charges??''),
      outside_city_charges: String(pkg.outside_city_charges??''), extra_ritual_charges: String(pkg.extra_ritual_charges??''),
      extra_hours_charges: String(pkg.extra_hours_charges??''), materials_included: pkg.materials_included??false,
      service_details: pkg.service_details??{}, duration: pkg.duration||'',
      required_materials: pkg.required_materials??[], temple_required: pkg.temple_required??false,
      languages: pkg.languages??[], years_of_experience: String(pkg.years_of_experience??''),
      included_services: pkg.included_services??[],
      available_cities: pkg.available_cities??[], travel_distance: pkg.travel_distance||'',
      daily_capacity: String(pkg.daily_capacity??'2'), max_bookings_per_day: String(pkg.max_bookings_per_day??'2'),
      addons, cover_file: null, cover_url: coverUrl, gallery_files: [], gallery_urls: galleryUrls,
      video_files: [], video_urls: videoUrls });
    setStep(1);
  };

  const save = async () => {
    if (!draft || !draft.name.trim()) { toast.error('Package name is required.'); setStep(1); return; }
    if (!draft.service_price) { toast.error('Service price is required.'); setStep(2); return; }
    if (!draft.cover_file && !draft.cover_url) { toast.error('Cover photo is required.'); setStep(1); return; }
    setBusy(true);
    try {
      const payload: any = {
        provider_id: provider.id, name: draft.name.trim(), package_type: draft.package_type||null,
        description: draft.description.trim()||null, status: draft.status,
        service_price: Number(draft.service_price),
        advance_percentage: draft.advance_percentage ? Number(draft.advance_percentage) : 20,
        dakshina_included: draft.dakshina_included, travel_charges: draft.travel_charges ? Number(draft.travel_charges) : 0,
        outside_city_charges: draft.outside_city_charges ? Number(draft.outside_city_charges) : 0,
        extra_ritual_charges: draft.extra_ritual_charges ? Number(draft.extra_ritual_charges) : 0,
        extra_hours_charges: draft.extra_hours_charges ? Number(draft.extra_hours_charges) : 0,
        materials_included: draft.materials_included, service_details: draft.service_details,
        duration: draft.duration||null, required_materials: draft.required_materials,
        temple_required: draft.temple_required, languages: draft.languages,
        years_of_experience: draft.years_of_experience ? Number(draft.years_of_experience) : null,
        included_services: draft.included_services, available_cities: draft.available_cities,
        travel_distance: draft.travel_distance||null,
        daily_capacity: Number(draft.daily_capacity)||2, max_bookings_per_day: Number(draft.max_bookings_per_day)||2,
      };
      let packageId = draft.id;
      if (draft.id) { const r = await (supabase.from('priest_packages' as any).update(payload).eq('id', draft.id).select('id').single()); if (r.error) throw r.error; }
      else { const r = await (supabase.from('priest_packages' as any).insert(payload).select('id').single()); if (r.error) throw r.error; packageId = r.data.id; }

      if (packageId) {
        await (supabase.from('priest_addons' as any).delete().eq('package_id', packageId));
        const valid = draft.addons.filter(a => a.name.trim());
        if (valid.length > 0) await (supabase.from('priest_addons' as any).insert(valid.map((a, i) => ({ package_id: packageId, name: a.name.trim(), price: Number(a.price)||0, description: a.description||null, sort_order: i }))));
        if (draft.cover_file) {
          const ext = draft.cover_file.name.split('.').pop();
          const path = `${user!.id}/${packageId}/cover-${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage.from('priest-media').upload(path, draft.cover_file, { contentType: draft.cover_file.type });
          if (!upErr) { const url = supabase.storage.from('priest-media').getPublicUrl(path).data.publicUrl; await (supabase.from('priest_gallery' as any).delete().eq('package_id', packageId).eq('is_cover', true)); await (supabase.from('priest_gallery' as any).insert({ package_id: packageId, storage_path: path, public_url: url, is_cover: true, sort_order: 0 })); }
        }
        if (draft.gallery_files.length > 0) { for (let i = 0; i < draft.gallery_files.length; i++) { const file = draft.gallery_files[i]; const ext = file.name.split('.').pop(); const path = `${user!.id}/${packageId}/gallery-${crypto.randomUUID()}.${ext}`; const { error: upErr } = await supabase.storage.from('priest-media').upload(path, file, { contentType: file.type }); if (!upErr) { const url = supabase.storage.from('priest-media').getPublicUrl(path).data.publicUrl; await (supabase.from('priest_gallery' as any).insert({ package_id: packageId, storage_path: path, public_url: url, is_cover: false, media_type: 'image', sort_order: draft.gallery_urls.length + i + 1 })); } } }
        // Upload videos
        if (draft.video_files.length > 0) { for (let i = 0; i < draft.video_files.length; i++) { const file = draft.video_files[i]; const ext = file.name.split('.').pop(); const path = `${user!.id}/${packageId}/video-${crypto.randomUUID()}.${ext}`; const { error: upErr } = await supabase.storage.from('priest-media').upload(path, file, { contentType: file.type }); if (!upErr) { const url = supabase.storage.from('priest-media').getPublicUrl(path).data.publicUrl; await (supabase.from('priest_gallery' as any).insert({ package_id: packageId, storage_path: path, public_url: url, is_cover: false, media_type: 'video', sort_order: 100 + i })); } } }
        if (draft.id) { const cur = [...draft.gallery_urls.map(g => g.id), ...draft.video_urls.map(v => v.id)].filter(Boolean); const { data: ex } = await (supabase.from('priest_gallery' as any).select('id').eq('package_id', packageId).eq('is_cover', false)); const del = (ex??[]).map((e: any) => e.id).filter((id: string) => !cur.includes(id)); if (del.length > 0) await (supabase.from('priest_gallery' as any).delete().in('id', del)); }
      }
      toast.success('Service package saved!'); setDraft(null); setStep(1); refresh();
    } catch (err: any) { toast.error(err.message || 'Could not save'); } finally { setBusy(false); }
  };

  const toggleStatus = async (pkg: any) => { await (supabase.from('priest_packages' as any).update({ status: pkg.status === 'active' ? 'draft' : 'active' }).eq('id', pkg.id)); refresh(); };
  const remove = async (pkg: any) => { if (!confirm('Delete this package?')) return; await (supabase.from('priest_packages' as any).delete().eq('id', pkg.id)); refresh(); toast.success('Deleted'); };
  const openNew = () => { setDraft(blank()); setStep(1); };

  const ChipSelect = ({ options, selected, onChange, label }: { options: string[]; selected: string[]; onChange: (v: string[]) => void; label: string }) => (
    <div><span className="text-sm font-semibold text-[#78350f]">{label}</span>
      <div className="mt-1.5 flex flex-wrap gap-2">{options.map(opt => (
        <button key={opt} type="button" onClick={() => onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt])}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${selected.includes(opt) ? 'border-amber-600 bg-amber-600/10 text-amber-700' : 'border-[#e7d9c4] text-stone-600 hover:border-amber-500'}`}>{opt}</button>
      ))}</div></div>
  );

  const renderStep = () => { if (!draft) return null; switch(step) {
    case 1: return <StepPackageType draft={draft} setDraft={setDraft} ChipSelect={ChipSelect} />;
    case 2: return <StepPricing draft={draft} setDraft={setDraft} />;
    case 3: return <StepServiceDetails draft={draft} setDraft={setDraft} />;
    case 4: return <StepRitualInfo draft={draft} setDraft={setDraft} ChipSelect={ChipSelect} />;
    case 5: return <StepAvailability draft={draft} setDraft={setDraft} />;
    case 6: return <StepIncluded draft={draft} setDraft={setDraft} ChipSelect={ChipSelect} />;
    case 7: return <StepAddons draft={draft} setDraft={setDraft} />;
    case 8: return <StepPreview draft={draft} />;
    default: return null;
  }};

  return (
    <div className="max-w-[1200px] space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div><h1 className="text-xl font-bold text-[#78350f]">Service Packages</h1><p className="text-sm text-muted-foreground">Create and manage your pooja & ritual services.</p></div>
        <button onClick={openNew} className="rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-800"><Plus className="mr-1 inline h-4 w-4" />Add Service</button>
      </div>
      {isLoading ? (<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[1,2,3].map(i => <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : packages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#eadfcf] py-16 text-center">
          <Flame className="h-12 w-12 text-amber-700/30" /><p className="mt-3 font-semibold text-[#78350f]">No services yet</p><p className="mt-1 text-sm text-muted-foreground">Create your first service package.</p>
          <button onClick={openNew} className="mt-4 rounded-xl bg-amber-700 px-5 py-2.5 text-sm font-semibold text-white"><Plus className="mr-1 inline h-4 w-4" />Add Service</button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{packages.map((pkg: any) => (
          <div key={pkg.id} className="overflow-hidden rounded-2xl border border-[#eadfcf] bg-[#fffdf9] shadow-sm transition hover:shadow-md">
            <div className="flex h-28 items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50"><Flame className="h-10 w-10 text-amber-700/40" /></div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2"><h2 className="font-bold text-[#78350f] leading-tight">{pkg.name}</h2>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${pkg.status === 'active' ? 'bg-amber-100 text-amber-700' : pkg.status === 'paused' ? 'bg-stone-100 text-stone-700' : 'bg-blue-50 text-blue-700'}`}>{pkg.status}</span></div>
              {pkg.service_price && <p className="mt-1.5 text-lg font-bold text-amber-700">₹{Number(pkg.service_price).toLocaleString('en-IN')}</p>}
              {pkg.package_type && <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><Flame className="h-3.5 w-3.5" />{pkg.package_type}</div>}
              {pkg.duration && <div className="mt-0.5 text-xs text-muted-foreground">Duration: {pkg.duration}</div>}
              <div className="mt-4 flex gap-2">
                <button onClick={() => edit(pkg)} className="flex-1 rounded-lg border border-[#e7d9c4] py-2 text-xs font-medium text-[#78350f] transition hover:bg-[#fffdf9]"><Pencil className="mr-1 inline h-3 w-3" />Edit</button>
                <button onClick={() => toggleStatus(pkg)} className="rounded-lg border border-[#e7d9c4] p-2 transition hover:bg-[#fffdf9]">{pkg.status === 'active' ? <EyeOff className="h-3.5 w-3.5 text-stone-600" /> : <Eye className="h-3.5 w-3.5 text-stone-600" />}</button>
                <button onClick={() => remove(pkg)} className="rounded-lg border border-red-200 p-2 transition hover:bg-red-50"><Trash2 className="h-3.5 w-3.5 text-red-600" /></button>
              </div>
            </div>
          </div>
        ))}</div>
      )}
      {/* Wizard Modal */}
      {draft && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#3b2006]/65 p-3 backdrop-blur-sm sm:p-6">
          <div className="mx-auto my-3 max-w-3xl overflow-hidden rounded-[24px] bg-[#fffef9] shadow-2xl">
            <header className="flex items-start justify-between gap-4 bg-amber-800 px-5 py-5 sm:px-7"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">Vowza Pandits</p><h2 className="mt-1 text-lg font-bold text-white">{draft.id ? 'Edit Service' : 'Add New Service'}</h2></div>
              <button onClick={() => { setDraft(null); setStep(1); }} className="rounded-full p-2 text-white/85 hover:bg-white/15"><X className="h-5 w-5" /></button></header>
            <div className="border-b border-[#eadfcf] bg-[#fffdf9] px-5 py-4 sm:px-7"><div className="flex items-center justify-between">{STEP_LABELS.map((label, i) => { const sn=i+1; const done=step>sn; const cur=step===sn; return (<div key={i} className="flex flex-1 items-center"><div className="flex flex-col items-center"><div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${done?'bg-amber-500 text-white':cur?'bg-amber-700 text-white shadow-md shadow-amber-700/30':'border-2 border-[#e7d9c4] text-stone-400'}`}>{done?<Check className="h-4 w-4" />:sn}</div><span className={`mt-1 hidden text-[10px] font-medium sm:block ${cur?'text-amber-700':done?'text-amber-600':'text-stone-400'}`}>{label}</span></div>{i<7&&<div className={`mx-1 h-0.5 flex-1 rounded ${done?'bg-amber-400':'bg-[#e7d9c4]'}`}/>}</div>);})}</div></div>
            <div className="p-5 sm:p-7 max-h-[60vh] overflow-y-auto">{renderStep()}</div>
            <div className="flex items-center justify-between border-t border-[#eadfcf] bg-[#fffdf9]/95 px-5 py-4 backdrop-blur sm:px-7">
              <button type="button" onClick={() => step > 1 ? setStep(step-1) : setDraft(null)} className="flex items-center gap-1.5 rounded-xl border border-[#d7c5ae] px-4 py-2.5 text-sm font-semibold text-[#78350f] transition hover:bg-white"><ChevronLeft className="h-4 w-4" />{step===1?'Cancel':'Back'}</button>
              {step < 8 ? (<button type="button" onClick={() => setStep(step+1)} className="flex items-center gap-1.5 rounded-xl bg-amber-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-amber-800">Next<ChevronRight className="h-4 w-4" /></button>
              ) : (<button type="button" disabled={busy} onClick={save} className="rounded-xl bg-amber-700 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-amber-800 disabled:opacity-60">{busy?'Saving…':'Save Service'}</button>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ─── Step 1: Package Type ───────────────────────────────────────────────────── */
function StepPackageType({ draft, setDraft, ChipSelect }: { draft: Draft; setDraft: (d: Draft) => void; ChipSelect: any }) {
  const handleTypeChange = (value: string) => {
    const sel = PACKAGE_TYPES.find(t => t.value === value);
    if (sel) setDraft({ ...draft, package_type: value, name: sel.name, included_services: [...sel.included], required_materials: [...sel.materials], service_details: { ...sel.details } });
    else setDraft({ ...draft, package_type: value });
  };
  const selectedType = PACKAGE_TYPES.find(t => t.value === draft.package_type);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdf9] p-5">
        <h3 className="mb-4 text-base font-bold text-amber-800">Select Service Type</h3>
        <select className={`${inputClass} text-base py-3`} value={draft.package_type} onChange={e => handleTypeChange(e.target.value)}>
          <option value="">Select Service Type</option>
          {PACKAGE_TYPES.map(t => <option key={t.value} value={t.value}>{t.name}</option>)}
        </select>
        {selectedType && selectedType.value !== 'Custom Service' && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/50 p-3"><p className="text-xs font-semibold text-amber-700 flex items-center gap-1"><Check className="h-3.5 w-3.5" />Auto-loaded "{selectedType.name}"</p></div>
        )}
      </div>
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdf9] p-5 space-y-4">
        <h3 className="text-base font-bold text-amber-800">Service Info</h3>
        <label className="block"><span className="text-sm font-semibold text-[#78350f]">Service Name <span className="text-red-500">*</span></span>
          <input className={inputClass} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Marriage Pooja" /></label>
        <label className="block"><span className="text-sm font-semibold text-[#78350f]">Description</span>
          <textarea className={`${inputClass} min-h-[80px] resize-y`} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="Describe your service..." /></label>
        <ChipSelect label="Languages Spoken" options={ALL_LANGUAGES} selected={draft.languages} onChange={(v: string[]) => setDraft({ ...draft, languages: v })} />
        <label className="block"><span className="text-sm font-semibold text-[#78350f]">Years of Experience</span>
          <input className={inputClass} type="number" min="0" value={draft.years_of_experience} onChange={e => setDraft({ ...draft, years_of_experience: e.target.value })} placeholder="e.g. 15" /></label>
        <label className="block"><span className="text-sm font-semibold text-[#78350f]">Status</span>
          <select className={inputClass} value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}><option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option></select></label>
      </div>
      {/* Cover & Gallery */}
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdf9] p-5">
        <span className="text-sm font-semibold text-[#78350f]">Cover Photo <span className="text-red-500">*</span></span>
        {(draft.cover_file || draft.cover_url) ? (
          <div className="relative rounded-xl overflow-hidden border border-[#eadfcf] bg-stone-50 mt-2"><img src={draft.cover_file ? URL.createObjectURL(draft.cover_file) : draft.cover_url} alt="Cover" className="w-full h-40 object-cover" /><button type="button" onClick={() => setDraft({ ...draft, cover_file: null, cover_url: '' })} className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"><X className="h-3.5 w-3.5" /></button></div>
        ) : (
          <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-6 transition hover:border-amber-600"><Upload className="h-6 w-6 text-amber-700 mb-2" /><span className="text-sm font-semibold text-[#78350f]">Upload cover photo</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f && f.size <= 5*1024*1024) setDraft({ ...draft, cover_file: f }); else if (f) toast.error('Max 5MB'); }} /></label>
        )}
      </div>
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdf9] p-5">
        <span className="text-sm font-semibold text-[#78350f]">Gallery (max 30)</span>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2">
          {draft.gallery_urls.map((img, i) => (<div key={img.id||i} className="relative rounded-xl overflow-hidden border border-[#eadfcf] aspect-square bg-stone-50"><img src={img.url} alt="" className="w-full h-full object-cover" /><button type="button" onClick={() => setDraft({ ...draft, gallery_urls: draft.gallery_urls.filter((_,idx) => idx!==i) })} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"><X className="h-3 w-3" /></button></div>))}
          {draft.gallery_files.map((f, i) => (<div key={`new-${i}`} className="relative rounded-xl overflow-hidden border border-[#eadfcf] aspect-square bg-stone-50"><img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" /><button type="button" onClick={() => setDraft({ ...draft, gallery_files: draft.gallery_files.filter((_,idx) => idx!==i) })} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"><X className="h-3 w-3" /></button></div>))}
          {(draft.gallery_urls.length + draft.gallery_files.length) < 30 && (<label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 aspect-square transition hover:border-amber-600"><Plus className="h-5 w-5 text-amber-700" /><input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={e => { const files = Array.from(e.target.files??[]).filter(f => f.size<=5*1024*1024).slice(0, 30-draft.gallery_urls.length-draft.gallery_files.length); if (files.length) setDraft({ ...draft, gallery_files: [...draft.gallery_files, ...files] }); }} /></label>)}
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
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdf9] p-5">
        <h3 className="mb-4 text-base font-bold text-amber-800">Service Pricing</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="text-sm font-semibold text-[#78350f]">Service Price <span className="text-red-500">*</span></span>
            <div className="relative"><span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span><input className={`${inputClass} pl-7`} type="number" min="0" value={draft.service_price} onChange={e => setDraft({ ...draft, service_price: e.target.value })} placeholder="Service price" /></div></label>
          <label className="block"><span className="text-sm font-semibold text-[#78350f]">Advance Percentage</span>
            <div className="relative"><span className="absolute right-3.5 top-2.5 text-sm text-stone-500">%</span><input className={`${inputClass} pr-7`} type="number" min="0" max="100" value={draft.advance_percentage} onChange={e => setDraft({ ...draft, advance_percentage: e.target.value })} placeholder="20" /></div></label>
          <label className="flex items-center gap-3 rounded-xl border border-[#eadfcf] p-3 cursor-pointer"><input type="checkbox" checked={draft.dakshina_included} onChange={e => setDraft({ ...draft, dakshina_included: e.target.checked })} className="h-4 w-4 rounded border-[#e7d9c4] text-amber-700" /><span className="text-sm font-semibold text-[#78350f]">Dakshina Included</span></label>
          <label className="flex items-center gap-3 rounded-xl border border-[#eadfcf] p-3 cursor-pointer"><input type="checkbox" checked={draft.materials_included} onChange={e => setDraft({ ...draft, materials_included: e.target.checked })} className="h-4 w-4 rounded border-[#e7d9c4] text-amber-700" /><span className="text-sm font-semibold text-[#78350f]">Materials Included</span></label>
        </div>
      </div>
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdf9] p-5">
        <button type="button" onClick={() => setShowAdditional(!showAdditional)} className="flex w-full items-center justify-between text-left"><div><h3 className="text-base font-bold text-amber-800">Additional Charges</h3></div><ChevronDown className={`h-5 w-5 text-stone-400 transition ${showAdditional?'rotate-180':''}`} /></button>
        {showAdditional && (<div className="mt-4 grid gap-4 sm:grid-cols-2 border-t border-[#eadfcf] pt-4">
          {[{key:'travel_charges',label:'Travel Charges'},{key:'outside_city_charges',label:'Outside City Charges'},{key:'extra_ritual_charges',label:'Extra Ritual Charges'},{key:'extra_hours_charges',label:'Extra Hours Charges'}].map(({key,label}) => (
            <label key={key} className="block"><span className="text-sm font-semibold text-[#78350f]">{label}</span><div className="relative"><span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span><input className={`${inputClass} pl-7`} type="number" min="0" value={(draft as any)[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} placeholder="0" /></div></label>
          ))}
        </div>)}
      </div>
    </div>
  );
}

/* ─── Step 3: Service Details (Dynamic) ──────────────────────────────────────── */
function StepServiceDetails({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const updateDetail = (key: string, value: any) => setDraft({ ...draft, service_details: { ...draft.service_details, [key]: value } });
  const d = draft.service_details;
  const keys = Object.keys(d);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdf9] p-5 space-y-4">
        <h3 className="text-base font-bold text-amber-800">Service Details — {draft.package_type || 'Custom'}</h3>
        {keys.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {keys.map(k => (
              <label key={k} className="flex items-center gap-3 rounded-xl border border-[#eadfcf] p-3 cursor-pointer">
                <input type="checkbox" checked={!!d[k]} onChange={e => updateDetail(k, e.target.checked)} className="h-4 w-4 rounded border-[#e7d9c4] text-amber-700" />
                <span className="text-sm font-semibold text-[#78350f] capitalize">{k.replace(/_/g, ' ')}</span>
              </label>
            ))}
          </div>
        ) : (<p className="text-sm text-stone-500">Select a service type in Step 1 to see specific rituals.</p>)}
      </div>
    </div>
  );
}

/* ─── Step 4: Ritual Info ────────────────────────────────────────────────────── */
function StepRitualInfo({ draft, setDraft, ChipSelect }: { draft: Draft; setDraft: (d: Draft) => void; ChipSelect: any }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdf9] p-5 space-y-5">
        <h3 className="text-base font-bold text-amber-800">Ritual Information</h3>
        <label className="block"><span className="text-sm font-semibold text-[#78350f]">Duration</span>
          <select className={inputClass} value={draft.duration} onChange={e => setDraft({ ...draft, duration: e.target.value })}><option value="">Select duration</option>{DURATION_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}</select></label>
        <ChipSelect label="Required Materials" options={ALL_MATERIALS} selected={draft.required_materials} onChange={(v: string[]) => setDraft({ ...draft, required_materials: v })} />
        <label className="flex items-center gap-3 rounded-xl border border-[#eadfcf] p-3 cursor-pointer"><input type="checkbox" checked={draft.temple_required} onChange={e => setDraft({ ...draft, temple_required: e.target.checked })} className="h-4 w-4 rounded border-[#e7d9c4] text-amber-700" /><span className="text-sm font-semibold text-[#78350f]">Temple Required</span></label>
      </div>
    </div>
  );
}


/* ─── Step 5: Availability ───────────────────────────────────────────────────── */
function StepAvailability({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const [cityInput, setCityInput] = useState('');
  const addCity = () => { if (cityInput.trim() && !draft.available_cities.includes(cityInput.trim())) { setDraft({ ...draft, available_cities: [...draft.available_cities, cityInput.trim()] }); setCityInput(''); } };
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdf9] p-5 space-y-4">
        <h3 className="text-base font-bold text-amber-800">Availability</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="text-sm font-semibold text-[#78350f]">Travel Distance</span><input className={inputClass} value={draft.travel_distance} onChange={e => setDraft({ ...draft, travel_distance: e.target.value })} placeholder="e.g. 50 km" /></label>
          <label className="block"><span className="text-sm font-semibold text-[#78350f]">Daily Capacity</span><input className={inputClass} type="number" min="1" value={draft.daily_capacity} onChange={e => setDraft({ ...draft, daily_capacity: e.target.value })} placeholder="2" /></label>
          <label className="block"><span className="text-sm font-semibold text-[#78350f]">Max Bookings Per Day</span><input className={inputClass} type="number" min="1" value={draft.max_bookings_per_day} onChange={e => setDraft({ ...draft, max_bookings_per_day: e.target.value })} placeholder="2" /></label>
        </div>
        <div><span className="text-sm font-semibold text-[#78350f]">Available Cities</span>
          <div className="mt-1 flex gap-2"><input className={inputClass} value={cityInput} onChange={e => setCityInput(e.target.value)} placeholder="Add city" onKeyDown={e => e.key==='Enter'&&(e.preventDefault(),addCity())} /><button type="button" onClick={addCity} className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white">Add</button></div>
          {draft.available_cities.length > 0 && (<div className="mt-2 flex flex-wrap gap-1.5">{draft.available_cities.map((c, i) => (<span key={i} className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs text-amber-700">{c}<button type="button" onClick={() => setDraft({ ...draft, available_cities: draft.available_cities.filter((_,idx)=>idx!==i) })} className="text-amber-500 hover:text-red-500"><X className="h-3 w-3" /></button></span>))}</div>)}
        </div>
      </div>
    </div>
  );
}

/* ─── Step 6: Included Services ──────────────────────────────────────────────── */
function StepIncluded({ draft, setDraft, ChipSelect }: { draft: Draft; setDraft: (d: Draft) => void; ChipSelect: any }) {
  return (<div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#fffdf9] p-5 space-y-5"><h3 className="text-base font-bold text-amber-800">Included Services</h3><ChipSelect label="Services" options={ALL_INCLUDED} selected={draft.included_services} onChange={(v: string[]) => setDraft({ ...draft, included_services: v })} /></div></div>);
}

/* ─── Step 7: Add-ons ────────────────────────────────────────────────────────── */
function StepAddons({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const addAddon = (name?: string) => { setDraft({ ...draft, addons: [...draft.addons, { name: name||'', price: '', description: '' }] }); };
  const removeAddon = (i: number) => { setDraft({ ...draft, addons: draft.addons.filter((_,idx) => idx!==i) }); };
  const updateAddon = (i: number, field: keyof Addon, value: string) => { const a=[...draft.addons]; a[i]={...a[i],[field]:value}; setDraft({ ...draft, addons: a }); };
  const addFromTemplate = (t: string) => { if (!draft.addons.some(a => a.name.toLowerCase()===t.toLowerCase())) addAddon(t); else toast.info(`"${t}" already added`); };
  return (
    <div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#fffdf9] p-5">
      <div className="flex items-center justify-between mb-4"><div><h3 className="text-base font-bold text-amber-800">Add-ons</h3></div><button type="button" onClick={() => addAddon()} className="rounded-lg bg-amber-700/10 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-700/20"><Plus className="mr-1 inline h-3 w-3" />Custom</button></div>
      <div className="mb-4"><span className="text-xs font-semibold text-[#78350f] mb-2 block">Quick Add:</span><div className="flex flex-wrap gap-1.5">{ADDON_TEMPLATES.map(t => (<button key={t} type="button" onClick={() => addFromTemplate(t)} className="rounded-full border border-[#e7d9c4] bg-white px-2.5 py-1 text-[11px] font-medium text-stone-600 transition hover:border-amber-600 hover:bg-amber-50 hover:text-amber-700">+ {t}</button>))}</div></div>
      {draft.addons.length===0 ? (<p className="text-center text-sm text-stone-400 py-4">No add-ons yet.</p>) : (<div className="space-y-2">{draft.addons.map((addon, i) => (<div key={i} className="grid grid-cols-[1fr_90px_1fr_32px] gap-2 items-center"><input className={inputClass} value={addon.name} onChange={e => updateAddon(i,'name',e.target.value)} placeholder="Name" /><div className="relative"><span className="absolute left-2.5 top-2.5 text-xs text-stone-400">₹</span><input className={`${inputClass} pl-6`} type="number" value={addon.price} onChange={e => updateAddon(i,'price',e.target.value)} placeholder="0" /></div><input className={inputClass} value={addon.description} onChange={e => updateAddon(i,'description',e.target.value)} placeholder="Description" /><button type="button" onClick={() => removeAddon(i)} className="flex h-9 w-9 items-center justify-center rounded-lg text-red-400 hover:bg-red-50"><X className="h-4 w-4" /></button></div>))}</div>)}
    </div></div>
  );
}

/* ─── Step 8: Preview ────────────────────────────────────────────────────────── */
function StepPreview({ draft }: { draft: Draft }) {
  return (
    <div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#fffdf9] p-5">
      <h3 className="mb-4 text-base font-bold text-amber-800">Preview</h3>
      <div className="overflow-hidden rounded-2xl border border-[#eadfcf] bg-white shadow-sm">
        {draft.cover_file||draft.cover_url ? (<div className="h-36 overflow-hidden"><img src={draft.cover_file?URL.createObjectURL(draft.cover_file):draft.cover_url} alt="Cover" className="w-full h-full object-cover" /></div>) : (<div className="flex h-36 items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50"><Flame className="h-8 w-8 text-amber-700/40" /></div>)}
        <div className="p-5">
          <div className="flex items-start justify-between"><h4 className="text-lg font-bold text-[#78350f]">{draft.name||'Service Name'}</h4><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${draft.status==='active'?'bg-amber-100 text-amber-700':'bg-blue-50 text-blue-700'}`}>{draft.status}</span></div>
          {draft.package_type && <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium text-amber-800"><Flame className="h-3 w-3" />{draft.package_type}</span>}
          {draft.description && <p className="mt-2 text-sm text-stone-500 line-clamp-2">{draft.description}</p>}
          {draft.service_price && <p className="mt-2 text-2xl font-bold text-amber-700">₹{Number(draft.service_price||0).toLocaleString('en-IN')}</p>}
          {draft.duration && <p className="mt-1 text-xs text-stone-500">Duration: {draft.duration}</p>}
          {draft.languages.length>0 && (<div className="mt-3 border-t border-stone-100 pt-3"><p className="text-xs font-semibold text-stone-600 mb-1.5">Languages:</p><div className="flex flex-wrap gap-1">{draft.languages.map(l => <span key={l} className="rounded-full bg-amber-700/8 px-2 py-0.5 text-[11px] text-amber-700">{l}</span>)}</div></div>)}
          {draft.included_services.length>0 && (<div className="mt-3 border-t border-stone-100 pt-3"><p className="text-xs font-semibold text-stone-600 mb-1.5">Included:</p><div className="flex flex-wrap gap-1">{draft.included_services.map(s => <span key={s} className="rounded-full border border-amber-200 px-2 py-0.5 text-[11px] text-amber-800">{s}</span>)}</div></div>)}
          {draft.required_materials.length>0 && (<div className="mt-3 border-t border-stone-100 pt-3"><p className="text-xs font-semibold text-stone-600 mb-1.5">Materials:</p><div className="flex flex-wrap gap-1">{draft.required_materials.map(m => <span key={m} className="rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-[11px] text-orange-800">{m}</span>)}</div></div>)}
          {draft.addons.filter(a=>a.name.trim()).length>0 && (<div className="mt-3 border-t border-stone-100 pt-3"><p className="text-xs font-semibold text-stone-600 mb-1.5">Add-ons:</p>{draft.addons.filter(a=>a.name.trim()).map((a,i) => (<div key={i} className="flex justify-between text-xs mt-1"><span className="text-stone-700">{a.name}</span>{a.price&&<span className="font-semibold text-amber-800">+₹{Number(a.price).toLocaleString('en-IN')}</span>}</div>))}</div>)}
        </div>
      </div>
    </div></div>
  );
}
