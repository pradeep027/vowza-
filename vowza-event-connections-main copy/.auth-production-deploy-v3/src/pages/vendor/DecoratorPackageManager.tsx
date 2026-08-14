import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, Eye, EyeOff, X, Check,
  ChevronRight, ChevronLeft, Upload, Palette, ChevronDown,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/* ─── Constants ─────────────────────────────────────────────────────────────── */
const PACKAGE_TYPES = [
  { value: 'Wedding Decoration', name: 'Wedding Decoration', inclusions: ['Stage Setup','Mandap','Flower Arrangement','Lighting','Entrance Decor'], themes: ['Royal','Rustic','Minimalist','Traditional','Garden'] },
  { value: 'Reception Decoration', name: 'Reception Decoration', inclusions: ['Stage Setup','Table Centerpieces','Flower Arrangement','Lighting','Photo Booth'], themes: ['Elegant','Modern','Classic','Romantic'] },
  { value: 'Engagement Decoration', name: 'Engagement Decoration', inclusions: ['Backdrop','Ring Ceremony Setup','Flower Arrangement','Balloons','Lighting'], themes: ['Pastel','Royal','Romantic','Modern'] },
  { value: 'Haldi Decoration', name: 'Haldi Decoration', inclusions: ['Yellow Theme Setup','Flower Decoration','Props','Seating','Photo Corner'], themes: ['Traditional Yellow','Marigold','Rustic','Contemporary'] },
  { value: 'Mehendi Decoration', name: 'Mehendi Decoration', inclusions: ['Seating Setup','Cushions','Draping','Flower Decoration','Props'], themes: ['Rajasthani','Moroccan','Bohemian','Traditional'] },
  { value: 'Birthday Decoration', name: 'Birthday Decoration', inclusions: ['Balloon Decoration','Banner','Cake Table','Theme Setup','Lights'], themes: ['Kids Theme','Adult Elegant','Neon','Vintage'] },
  { value: 'Baby Shower Decoration', name: 'Baby Shower Decoration', inclusions: ['Theme Setup','Balloon Arch','Photo Backdrop','Table Decor','Props'], themes: ['Pink','Blue','Pastel'] },
  { value: 'Naming Ceremony', name: 'Naming Ceremony', inclusions: ['Cradle Decoration','Flower Arrangement','Stage Setup','Seating','Traditional Decor'], themes: ['Traditional','Modern','Pastel','Floral'] },
  { value: 'Corporate Event Decoration', name: 'Corporate Event Decoration', inclusions: ['Stage Setup','Branding','Table Setup','Lighting','Registration Desk'], themes: ['Corporate','Minimal','Branded','Premium'] },
  { value: 'Stage Decoration', name: 'Stage Decoration', inclusions: ['Stage Setup','Backdrop','Lighting','Flower Arrangement','Props'], themes: ['Grand','Minimal','Floral','Modern'] },
  { value: 'Floral Decoration', name: 'Floral Decoration', inclusions: ['Fresh Flowers','Garlands','Centerpieces','Mandap Flowers','Entrance'], themes: ['Rose','Jasmine','Marigold','Mixed'] },
  { value: 'Mandap Decoration', name: 'Mandap Decoration', inclusions: ['Mandap Structure','Flower Decoration','Draping','Lighting','Seating'], themes: ['Traditional','Royal','Modern','Minimalist'] },
  { value: 'Balloon Decoration', name: 'Balloon Decoration', inclusions: ['Balloon Arch','Centerpieces','Backdrop','Helium Balloons','Floor Balloons'], themes: ['Colorful','Pastel','Metallic'] },
  { value: 'Housewarming Decoration', name: 'Housewarming Decoration', inclusions: ['Entrance Decor','Rangoli','Flower Arrangement','Lighting','Pooja Setup'], themes: ['Traditional','Modern','Festive','Minimal'] },
  { value: 'Temple Decoration', name: 'Temple Decoration', inclusions: ['Flower Decoration','Lighting','Mandap','Traditional Props','Entrance'], themes: ['Traditional','Grand','Festive'] },
  { value: 'College Fest Decoration', name: 'College Fest Decoration', inclusions: ['Stage Setup','Banner','LED Lights','Theme Props','Photo Booth'], themes: ['Neon','Bollywood','Retro','Carnival'] },
  { value: 'Festival Decoration', name: 'Festival Decoration', inclusions: ['Theme Setup','Lighting','Flower Decoration','Props','Entrance Decor'], themes: ['Diwali','Navratri','Christmas','Pongal'] },
  { value: 'Custom Package', name: 'Custom Package', inclusions: [], themes: [] },
];

const ALL_INCLUSIONS = ['Stage Setup','Mandap','Flower Arrangement','Lighting','Entrance Decor','Table Centerpieces','Photo Booth','Backdrop','Ring Ceremony Setup','Balloons','Yellow Theme Setup','Flower Decoration','Props','Seating','Photo Corner','Seating Setup','Cushions','Draping','Balloon Decoration','Banner','Cake Table','Theme Setup','Lights','Balloon Arch','Photo Backdrop','Table Decor','Cradle Decoration','Traditional Decor','Branding','Registration Desk','Fresh Flowers','Garlands','Centerpieces','Mandap Flowers','Mandap Structure','Helium Balloons','Floor Balloons','Rangoli','Pooja Setup','Traditional Props','LED Lights','Theme Props'];
const ALL_THEMES = ['Royal','Rustic','Minimalist','Traditional','Garden','Elegant','Modern','Classic','Romantic','Pastel','Traditional Yellow','Marigold','Contemporary','Rajasthani','Moroccan','Bohemian','Kids Theme','Adult Elegant','Neon','Vintage','Pink','Blue'];
const SETUP_DURATIONS = ['1 Hour','2 Hours','3 Hours','4 Hours','5 Hours','6 Hours','Full Day'];
const TEARDOWN_DURATIONS = ['Included','30 Minutes','1 Hour','2 Hours','3 Hours','4 Hours'];
const STEP_LABELS = ['Package Type', 'Pricing', 'Details', 'Gallery & Media', 'Preview'];

const inputClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition placeholder:text-stone-400 focus:border-[#8b1538] focus:ring-2 focus:ring-[#8b1538]/15';

/* ─── Types ─────────────────────────────────────────────────────────────────── */
type Draft = {
  id?: string;
  name: string;
  description: string;
  package_type: string;
  status: string;
  package_price: string;
  advance_percentage: string;
  inclusions: string[];
  themes_available: string[];
  setup_time: string;
  teardown_time: string;
  cover_file: File | null;
  cover_url: string;
  gallery_files: File[];
  gallery_urls: { id: string; url: string; is_cover: boolean }[];
  video_files: File[];
  video_urls: { id: string; url: string }[];
};

const blank = (): Draft => ({
  name: '', description: '', package_type: '', status: 'draft',
  package_price: '', advance_percentage: '20',
  inclusions: [], themes_available: [],
  setup_time: '2 Hours', teardown_time: 'Included',
  cover_file: null, cover_url: '', gallery_files: [], gallery_urls: [],
  video_files: [], video_urls: [],
});

/* ─── Main Component ────────────────────────────────────────────────────────── */
export default function DecoratorPackageManager({ provider }: { provider: any }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['decorator-packages', provider.id],
    queryFn: async () => {
      const r = await (supabase.from('decorator_packages' as any).select('*').eq('provider_id', provider.id).order('created_at', { ascending: false }));
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['decorator-packages', provider.id] });
  useEffect(() => {
    const ch = supabase.channel(`decorator-packages-${provider.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'decorator_packages', filter: `provider_id=eq.${provider.id}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [provider.id]);

  const edit = async (pkg: any) => {
    let galleryUrls: { id: string; url: string; is_cover: boolean }[] = [];
    let videoUrls: { id: string; url: string }[] = [];
    let coverUrl = '';
    try {
      const r = await (supabase.from('decorator_gallery' as any).select('id, public_url, is_cover, sort_order, media_type').eq('package_id', pkg.id).order('sort_order'));
      const g = (r.data ?? []).map((x: any) => ({ id: x.id, url: x.public_url, is_cover: x.is_cover, media_type: x.media_type || 'image' }));
      coverUrl = g.find((x: any) => x.is_cover)?.url || '';
      galleryUrls = g.filter((x: any) => !x.is_cover && x.media_type === 'image');
      videoUrls = g.filter((x: any) => x.media_type === 'video').map((x: any) => ({ id: x.id, url: x.url }));
    } catch (_) {}
    setDraft({
      id: pkg.id, name: pkg.name||'', description: pkg.description||'',
      package_type: pkg.package_type||'', status: pkg.status||'draft',
      package_price: String(pkg.package_price??''), advance_percentage: String(pkg.advance_percentage??'20'),
      inclusions: pkg.inclusions??[], themes_available: pkg.themes_available??[],
      setup_time: pkg.setup_time||'2 Hours', teardown_time: pkg.teardown_time || (pkg.teardown_included ? 'Included' : '1 Hour'),
      cover_file: null, cover_url: coverUrl, gallery_files: [], gallery_urls: galleryUrls,
      video_files: [], video_urls: videoUrls,
    });
    setStep(1);
  };

  const save = async () => {
    if (!draft || !draft.name.trim()) { toast.error('Package name is required.'); setStep(1); return; }
    if (!draft.package_price || Number(draft.package_price) <= 0) { toast.error('Package price must be greater than 0.'); setStep(2); return; }
    if (!draft.cover_file && !draft.cover_url) { toast.error('Cover photo is required.'); setStep(4); return; }
    const advPct = Number(draft.advance_percentage || 20);
    if (advPct < 0 || advPct > 100) { toast.error('Advance percentage must be 0-100.'); setStep(2); return; }
    setBusy(true);
    try {
      const payload: any = {
        provider_id: provider.id, name: draft.name.trim(), package_type: draft.package_type||null,
        description: draft.description.trim()||null, status: draft.status,
        package_price: Number(draft.package_price), advance_percentage: advPct,
        inclusions: draft.inclusions, themes_available: draft.themes_available,
        setup_time: draft.setup_time||null, teardown_time: draft.teardown_time||null,
        teardown_included: draft.teardown_time === 'Included',
      };
      let packageId = draft.id;
      if (draft.id) { const r = await (supabase.from('decorator_packages' as any).update(payload).eq('id', draft.id).select('id').single()); if (r.error) throw r.error; }
      else { const r = await (supabase.from('decorator_packages' as any).insert(payload).select('id').single()); if (r.error) throw r.error; packageId = r.data.id; }

      if (packageId) {
        // Cover
        if (draft.cover_file) {
          const ext = draft.cover_file.name.split('.').pop();
          const path = `${user!.id}/${packageId}/cover-${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage.from('decorator-media').upload(path, draft.cover_file, { contentType: draft.cover_file.type });
          if (!upErr) { const url = supabase.storage.from('decorator-media').getPublicUrl(path).data.publicUrl; await (supabase.from('decorator_gallery' as any).delete().eq('package_id', packageId).eq('is_cover', true)); await (supabase.from('decorator_gallery' as any).insert({ package_id: packageId, storage_path: path, public_url: url, is_cover: true, media_type: 'image', sort_order: 0 })); }
        }
        // Gallery photos
        if (draft.gallery_files.length > 0) { for (let i = 0; i < draft.gallery_files.length; i++) { const file = draft.gallery_files[i]; const ext = file.name.split('.').pop(); const path = `${user!.id}/${packageId}/gallery-${crypto.randomUUID()}.${ext}`; const { error: upErr } = await supabase.storage.from('decorator-media').upload(path, file, { contentType: file.type }); if (!upErr) { const url = supabase.storage.from('decorator-media').getPublicUrl(path).data.publicUrl; await (supabase.from('decorator_gallery' as any).insert({ package_id: packageId, storage_path: path, public_url: url, is_cover: false, media_type: 'image', sort_order: draft.gallery_urls.length + i + 1 })); } } }
        // Videos
        if (draft.video_files.length > 0) { for (let i = 0; i < draft.video_files.length; i++) { const file = draft.video_files[i]; const ext = file.name.split('.').pop(); const path = `${user!.id}/${packageId}/video-${crypto.randomUUID()}.${ext}`; const { error: upErr } = await supabase.storage.from('decorator-media').upload(path, file, { contentType: file.type }); if (!upErr) { const url = supabase.storage.from('decorator-media').getPublicUrl(path).data.publicUrl; await (supabase.from('decorator_gallery' as any).insert({ package_id: packageId, storage_path: path, public_url: url, is_cover: false, media_type: 'video', sort_order: 100 + i })); } } }
        // Delete removed
        if (draft.id) { const cur = [...draft.gallery_urls.map(g => g.id), ...draft.video_urls.map(v => v.id)].filter(Boolean); const { data: ex } = await (supabase.from('decorator_gallery' as any).select('id').eq('package_id', packageId).eq('is_cover', false)); const del = (ex??[]).map((e: any) => e.id).filter((id: string) => !cur.includes(id)); if (del.length > 0) await (supabase.from('decorator_gallery' as any).delete().in('id', del)); }
      }
      toast.success('Decorator package saved!'); setDraft(null); setStep(1); refresh();
    } catch (err: any) { toast.error(err.message || 'Could not save package'); } finally { setBusy(false); }
  };

  const toggleStatus = async (pkg: any) => { await (supabase.from('decorator_packages' as any).update({ status: pkg.status === 'active' ? 'draft' : 'active' }).eq('id', pkg.id)); refresh(); };
  const remove = async (pkg: any) => { if (!confirm('Delete this package?')) return; await (supabase.from('decorator_packages' as any).delete().eq('id', pkg.id)); refresh(); toast.success('Deleted'); };
  const openNew = () => { setDraft(blank()); setStep(1); };

  const ChipSelect = ({ options, selected, onChange, label }: { options: string[]; selected: string[]; onChange: (v: string[]) => void; label: string }) => (
    <div><span className="text-sm font-semibold text-[#4b1d2b]">{label}</span><div className="mt-1.5 flex flex-wrap gap-2">{options.map(opt => (
      <button key={opt} type="button" onClick={() => onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt])}
        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${selected.includes(opt) ? 'border-[#8b1538] bg-[#8b1538]/10 text-[#8b1538]' : 'border-[#e7d9c4] text-stone-600 hover:border-[#c99b43]'}`}>{opt}</button>
    ))}</div></div>
  );

  const renderStep = () => { if (!draft) return null; switch (step) {
    case 1: return <StepPackageType draft={draft} setDraft={setDraft} />;
    case 2: return <StepPricing draft={draft} setDraft={setDraft} />;
    case 3: return <StepDetails draft={draft} setDraft={setDraft} ChipSelect={ChipSelect} />;
    case 4: return <StepGallery draft={draft} setDraft={setDraft} />;
    case 5: return <StepPreview draft={draft} />;
    default: return null;
  }};

  return (
    <div className="max-w-[1200px] space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div><h1 className="text-xl font-bold text-[#3d1924]">Decorator Packages</h1><p className="text-sm text-muted-foreground">Create and manage your decoration packages.</p></div>
        <button onClick={openNew} className="rounded-xl bg-[#8B1538] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#70102d]"><Plus className="mr-1 inline h-4 w-4" />Create Package</button>
      </div>
      {isLoading ? (<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[1,2,3].map(i => <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : packages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#eadfcf] py-16 text-center">
          <Palette className="h-12 w-12 text-[#8b1538]/30" /><p className="mt-3 font-semibold text-[#3d1924]">No packages yet</p>
          <button onClick={openNew} className="mt-4 rounded-xl bg-[#8B1538] px-5 py-2.5 text-sm font-semibold text-white"><Plus className="mr-1 inline h-4 w-4" />Create Package</button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{packages.map((pkg: any) => (
          <div key={pkg.id} className="overflow-hidden rounded-2xl border border-[#eadfcf] bg-[#fffaf3] shadow-sm hover:shadow-md transition">
            <div className="flex h-28 items-center justify-center bg-gradient-to-br from-rose-50 to-amber-50"><Palette className="h-10 w-10 text-[#8b1538]/40" /></div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2"><h2 className="font-bold text-[#3d1924] leading-tight">{pkg.name}</h2>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${pkg.status==='active'?'bg-emerald-100 text-emerald-700':pkg.status==='paused'?'bg-amber-100 text-amber-700':'bg-blue-50 text-blue-700'}`}>{pkg.status}</span></div>
              {pkg.package_price && <p className="mt-1.5 text-lg font-bold text-[#8b1538]">₹{Number(pkg.package_price).toLocaleString('en-IN')}</p>}
              {pkg.package_type && <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1"><Palette className="h-3.5 w-3.5" />{pkg.package_type}</div>}
              <div className="mt-4 flex gap-2">
                <button onClick={() => edit(pkg)} className="flex-1 rounded-lg border border-[#e7d9c4] py-2 text-xs font-medium text-[#3d1924] hover:bg-[#fffaf3]"><Pencil className="mr-1 inline h-3 w-3" />Edit</button>
                <button onClick={() => toggleStatus(pkg)} className="rounded-lg border border-[#e7d9c4] p-2 hover:bg-[#fffaf3]">{pkg.status==='active'?<EyeOff className="h-3.5 w-3.5 text-stone-600" />:<Eye className="h-3.5 w-3.5 text-stone-600" />}</button>
                <button onClick={() => remove(pkg)} className="rounded-lg border border-red-200 p-2 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5 text-red-600" /></button>
              </div>
            </div>
          </div>
        ))}</div>
      )}
      {draft && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#250914]/65 p-3 backdrop-blur-sm sm:p-6">
          <div className="mx-auto my-3 max-w-3xl overflow-hidden rounded-[24px] bg-[#fffaf3] shadow-2xl">
            <header className="flex items-start justify-between gap-4 bg-[#70102d] px-5 py-5 sm:px-7"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f4d58d]">Vowza Decorator</p><h2 className="mt-1 text-lg font-bold text-white">{draft.id?'Edit Package':'Create New Package'}</h2></div><button onClick={() => {setDraft(null);setStep(1);}} className="rounded-full p-2 text-white/85 hover:bg-white/15"><X className="h-5 w-5" /></button></header>
            <div className="border-b border-[#eadfcf] bg-[#fffdfa] px-5 py-4 sm:px-7"><div className="flex items-center justify-between">{STEP_LABELS.map((label, i) => { const sn=i+1; const done=step>sn; const cur=step===sn; return (<div key={i} className="flex flex-1 items-center"><div className="flex flex-col items-center"><div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${done?'bg-emerald-500 text-white':cur?'bg-[#8b1538] text-white shadow-md shadow-[#8b1538]/30':'border-2 border-[#e7d9c4] text-stone-400'}`}>{done?<Check className="h-4 w-4" />:sn}</div><span className={`mt-1 hidden text-[10px] font-medium sm:block ${cur?'text-[#8b1538]':done?'text-emerald-600':'text-stone-400'}`}>{label}</span></div>{i<4&&<div className={`mx-1 h-0.5 flex-1 rounded ${done?'bg-emerald-400':'bg-[#e7d9c4]'}`}/>}</div>);})}</div></div>
            <div className="p-5 sm:p-7 max-h-[60vh] overflow-y-auto">{renderStep()}</div>
            <div className="flex items-center justify-between border-t border-[#eadfcf] bg-[#fffdfa]/95 px-5 py-4 backdrop-blur sm:px-7">
              <button type="button" onClick={() => step>1?setStep(step-1):setDraft(null)} className="flex items-center gap-1.5 rounded-xl border border-[#d7c5ae] px-4 py-2.5 text-sm font-semibold text-[#5a3440] hover:bg-white"><ChevronLeft className="h-4 w-4" />{step===1?'Cancel':'Back'}</button>
              {step<5?(<button type="button" onClick={() => setStep(step+1)} className="flex items-center gap-1.5 rounded-xl bg-[#8b1538] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#70102d]">Next<ChevronRight className="h-4 w-4" /></button>
              ):(<button type="button" disabled={busy} onClick={save} className="rounded-xl bg-[#8b1538] px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#70102d] disabled:opacity-60">{busy?'Saving…':'Save Package'}</button>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ─── Step 1: Package Type ───────────────────────────────────────────────────── */
function StepPackageType({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const handleTypeChange = (value: string) => {
    const sel = PACKAGE_TYPES.find(t => t.value === value);
    if (sel) setDraft({ ...draft, package_type: value, inclusions: [...sel.inclusions], themes_available: [...sel.themes] });
    else setDraft({ ...draft, package_type: value });
  };
  const selectedType = PACKAGE_TYPES.find(t => t.value === draft.package_type);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
        <h3 className="mb-4 text-base font-bold text-[#62132d]">Select Package Type</h3>
        <select className={`${inputClass} text-base py-3`} value={draft.package_type} onChange={e => handleTypeChange(e.target.value)}>
          <option value="">Select Decoration Package Type ▾</option>
          {PACKAGE_TYPES.map(t => <option key={t.value} value={t.value}>{t.name}</option>)}
        </select>
        {selectedType && selectedType.value !== 'Custom Package' && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3"><p className="text-xs font-semibold text-emerald-700 flex items-center gap-1"><Check className="h-3.5 w-3.5" />Auto-loaded "{selectedType.name}" — {selectedType.inclusions.length} inclusions, {selectedType.themes.length} themes</p></div>
        )}
      </div>
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5 space-y-4">
        <h3 className="text-base font-bold text-[#62132d]">Package Info</h3>
        <label className="block"><span className="text-sm font-semibold text-[#4b1d2b]">Package Name <span className="text-red-500">*</span></span>
          <input className={inputClass} value={draft.name} onChange={e => setDraft({...draft, name: e.target.value})} placeholder="e.g. Royal Wedding Decoration" /></label>
        <label className="block"><span className="text-sm font-semibold text-[#4b1d2b]">Description</span>
          <textarea className={`${inputClass} min-h-[80px] resize-y`} value={draft.description} onChange={e => setDraft({...draft, description: e.target.value})} placeholder="Describe what makes this decoration package special..." /></label>
        <label className="block"><span className="text-sm font-semibold text-[#4b1d2b]">Status</span>
          <select className={inputClass} value={draft.status} onChange={e => setDraft({...draft, status: e.target.value})}><option value="draft">Draft</option><option value="active">Published</option></select></label>
      </div>
    </div>
  );
}

/* ─── Step 2: Pricing (Simple — only price + advance) ────────────────────────── */
function StepPricing({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const price = Number(draft.package_price || 0);
  const advPct = Number(draft.advance_percentage || 20);
  const advAmount = Math.round(price * advPct / 100);
  const remaining = price - advAmount;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
        <h3 className="mb-4 text-base font-bold text-[#62132d]">Package Pricing</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="text-sm font-semibold text-[#4b1d2b]">Package Price <span className="text-red-500">*</span></span>
            <div className="relative"><span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span><input className={`${inputClass} pl-7`} type="number" min="1" value={draft.package_price} onChange={e => setDraft({...draft, package_price: e.target.value})} placeholder="e.g. 50000" /></div></label>
          <label className="block"><span className="text-sm font-semibold text-[#4b1d2b]">Advance Percentage</span>
            <div className="relative"><span className="absolute right-3.5 top-2.5 text-sm text-stone-500">%</span><input className={`${inputClass} pr-7`} type="number" min="0" max="100" value={draft.advance_percentage} onChange={e => setDraft({...draft, advance_percentage: e.target.value})} placeholder="20" /></div></label>
        </div>
        {price > 0 && (
          <div className="mt-4 rounded-xl border border-[#eadfcf] bg-[#fffdf9] p-4 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-stone-600">Package Price</span><span className="font-bold text-[#8b1538]">₹{price.toLocaleString('en-IN')}</span></div>
            <div className="flex justify-between text-sm"><span className="text-stone-600">Advance ({advPct}%)</span><span className="font-semibold text-emerald-700">₹{advAmount.toLocaleString('en-IN')}</span></div>
            <div className="flex justify-between text-sm border-t border-[#eadfcf] pt-2"><span className="text-stone-600">Remaining</span><span className="font-semibold">₹{remaining.toLocaleString('en-IN')}</span></div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Step 3: Details (Inclusions, Themes, Setup/Teardown) ───────────────────── */
function StepDetails({ draft, setDraft, ChipSelect }: { draft: Draft; setDraft: (d: Draft) => void; ChipSelect: any }) {
  return (
    <div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5 space-y-5">
      <h3 className="text-base font-bold text-[#62132d]">Package Details</h3>
      <ChipSelect label="Inclusions" options={ALL_INCLUSIONS} selected={draft.inclusions} onChange={(v: string[]) => setDraft({...draft, inclusions: v})} />
      <ChipSelect label="Themes Available" options={ALL_THEMES} selected={draft.themes_available} onChange={(v: string[]) => setDraft({...draft, themes_available: v})} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="text-sm font-semibold text-[#4b1d2b]">Setup Duration</span>
          <select className={inputClass} value={draft.setup_time} onChange={e => setDraft({...draft, setup_time: e.target.value})}>{SETUP_DURATIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
        <label className="block"><span className="text-sm font-semibold text-[#4b1d2b]">Teardown Duration</span>
          <select className={inputClass} value={draft.teardown_time} onChange={e => setDraft({...draft, teardown_time: e.target.value})}>{TEARDOWN_DURATIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
      </div>
    </div></div>
  );
}

/* ─── Step 4: Gallery & Media (Photos + Videos) ──────────────────────────────── */
function StepGallery({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
        <h3 className="mb-4 text-base font-bold text-[#62132d]">Gallery & Media</h3>
        {/* Cover Photo */}
        <div className="mb-5">
          <span className="text-sm font-semibold text-[#4b1d2b]">Cover Photo <span className="text-red-500">*</span></span>
          <p className="text-xs text-stone-500 mb-2">Recommended: 1600x900px, max 5MB</p>
          {(draft.cover_file||draft.cover_url) ? (
            <div className="relative rounded-xl overflow-hidden border border-[#eadfcf] bg-stone-50"><img src={draft.cover_file?URL.createObjectURL(draft.cover_file):draft.cover_url} alt="Cover" className="w-full h-40 object-cover" /><button type="button" onClick={() => setDraft({...draft, cover_file: null, cover_url: ''})} className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"><X className="h-3.5 w-3.5" /></button></div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#d8b77b] bg-[#fffdf9] p-6 hover:border-[#8b1538]"><Upload className="h-6 w-6 text-[#8b1538] mb-2" /><span className="text-sm font-semibold text-[#4b1d2b]">Upload cover photo</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f=e.target.files?.[0]; if(f&&f.size<=5*1024*1024) setDraft({...draft,cover_file:f}); else if(f) toast.error('Max 5MB'); }} /></label>
          )}
        </div>
        {/* Gallery Photos */}
        <div className="mb-5">
          <span className="text-sm font-semibold text-[#4b1d2b]">Gallery Photos (max 20)</span>
          <p className="text-xs text-stone-500 mb-2">Upload decoration work photos</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {draft.gallery_urls.map((img,i) => (<div key={img.id||i} className="relative rounded-xl overflow-hidden border border-[#eadfcf] aspect-square bg-stone-50"><img src={img.url} alt="" className="w-full h-full object-cover" /><button type="button" onClick={() => setDraft({...draft,gallery_urls:draft.gallery_urls.filter((_,idx)=>idx!==i)})} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white"><X className="h-3 w-3" /></button></div>))}
            {draft.gallery_files.map((f,i) => (<div key={`new-${i}`} className="relative rounded-xl overflow-hidden border border-[#eadfcf] aspect-square bg-stone-50"><img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" /><button type="button" onClick={() => setDraft({...draft,gallery_files:draft.gallery_files.filter((_,idx)=>idx!==i)})} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white"><X className="h-3 w-3" /></button></div>))}
            {(draft.gallery_urls.length+draft.gallery_files.length)<20 && (<label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#d8b77b] bg-[#fffdf9] aspect-square hover:border-[#8b1538]"><Plus className="h-5 w-5 text-[#8b1538]" /><span className="text-[9px] text-stone-500 mt-1">+ Photo</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={e => { const files=Array.from(e.target.files??[]).filter(f=>f.size<=5*1024*1024).slice(0,20-draft.gallery_urls.length-draft.gallery_files.length); if(files.length) setDraft({...draft,gallery_files:[...draft.gallery_files,...files]}); }} /></label>)}
          </div>
        </div>
        {/* Gallery Videos */}
        <div>
          <span className="text-sm font-semibold text-[#4b1d2b]">Gallery Videos (max 5)</span>
          <p className="text-xs text-stone-500 mb-2">Upload decoration work videos (MP4/MOV/WEBM, max 100MB each)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {draft.video_urls.map((vid,i) => (<div key={vid.id||i} className="relative rounded-xl overflow-hidden border border-[#d8b77b] bg-[#fffdf9] aspect-video flex items-center justify-center">
              <video src={vid.url} className="w-full h-full object-cover rounded-xl" muted preload="metadata" />
              <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white font-bold">VIDEO</span>
              <button type="button" onClick={() => setDraft({...draft,video_urls:draft.video_urls.filter((_,idx)=>idx!==i)})} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"><X className="h-3 w-3" /></button>
            </div>))}
            {draft.video_files.map((f,i) => (<div key={`newv-${i}`} className="relative rounded-xl overflow-hidden border border-[#d8b77b] bg-[#fffdf9] aspect-video flex items-center justify-center">
              <video src={URL.createObjectURL(f)} className="w-full h-full object-cover rounded-xl" muted preload="metadata" />
              <span className="absolute bottom-1 left-1 rounded bg-[#8b1538] px-1.5 py-0.5 text-[9px] text-white font-bold">NEW</span>
              <button type="button" onClick={() => setDraft({...draft,video_files:draft.video_files.filter((_,idx)=>idx!==i)})} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"><X className="h-3 w-3" /></button>
            </div>))}
            {(draft.video_urls.length+draft.video_files.length)<5 && (<label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#d8b77b] bg-[#fffdf9] aspect-video hover:border-[#8b1538]">
              <Upload className="h-5 w-5 text-[#8b1538]" /><span className="text-[10px] text-stone-500 mt-1">+ Add Video</span>
              <input type="file" accept="video/mp4,video/mov,video/webm,video/quicktime" multiple className="hidden" onChange={e => { const files=Array.from(e.target.files??[]).filter(f=>f.size<=100*1024*1024).slice(0,5-draft.video_urls.length-draft.video_files.length); if(files.length) setDraft({...draft,video_files:[...draft.video_files,...files]}); else if(e.target.files?.length) toast.error('Max 100MB per video'); }} />
            </label>)}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Step 5: Preview ────────────────────────────────────────────────────────── */
function StepPreview({ draft }: { draft: Draft }) {
  const price = Number(draft.package_price || 0);
  const advPct = Number(draft.advance_percentage || 20);
  const advAmount = Math.round(price * advPct / 100);
  const remaining = price - advAmount;
  return (
    <div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
      <h3 className="mb-4 text-base font-bold text-[#62132d]">Preview</h3>
      <div className="overflow-hidden rounded-2xl border border-[#eadfcf] bg-white shadow-sm">
        {draft.cover_file||draft.cover_url?(<div className="h-36 overflow-hidden"><img src={draft.cover_file?URL.createObjectURL(draft.cover_file):draft.cover_url} alt="Cover" className="w-full h-full object-cover" /></div>):(<div className="flex h-36 items-center justify-center bg-gradient-to-br from-rose-50 to-amber-50"><Palette className="h-8 w-8 text-[#8b1538]/40" /></div>)}
        <div className="p-5">
          <div className="flex items-start justify-between"><h4 className="text-lg font-bold text-[#3d1924]">{draft.name||'Package Name'}</h4><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${draft.status==='active'?'bg-emerald-100 text-emerald-700':'bg-blue-50 text-blue-700'}`}>{draft.status==='active'?'Published':'Draft'}</span></div>
          {draft.package_type && <span className="mt-1 inline-block rounded-full bg-[#f4d58d]/30 px-2.5 py-0.5 text-[11px] font-medium text-[#62132d]">{draft.package_type}</span>}
          {draft.description && <p className="mt-2 text-sm text-stone-500 line-clamp-2">{draft.description}</p>}
          {price > 0 && (<div className="mt-3"><p className="text-2xl font-bold text-[#8b1538]">₹{price.toLocaleString('en-IN')}</p><p className="text-xs text-stone-500">Advance: {advPct}% (₹{advAmount.toLocaleString('en-IN')}) · Remaining: ₹{remaining.toLocaleString('en-IN')}</p></div>)}
          {draft.inclusions.length>0 && (<div className="mt-3 border-t border-stone-100 pt-3"><p className="text-xs font-semibold text-stone-600 mb-1.5">Inclusions:</p><div className="flex flex-wrap gap-1">{draft.inclusions.map(inc => <span key={inc} className="rounded-full bg-[#8b1538]/8 px-2 py-0.5 text-[11px] text-[#8b1538]">{inc}</span>)}</div></div>)}
          {draft.themes_available.length>0 && (<div className="mt-3 border-t border-stone-100 pt-3"><p className="text-xs font-semibold text-stone-600 mb-1.5">Themes:</p><div className="flex flex-wrap gap-1">{draft.themes_available.map(t => <span key={t} className="rounded-full bg-[#f4d58d]/30 px-2 py-0.5 text-[11px] text-[#62132d]">{t}</span>)}</div></div>)}
          <div className="mt-3 border-t border-stone-100 pt-3 flex flex-wrap gap-4 text-[11px] text-stone-500">
            {draft.setup_time && <span>Setup: {draft.setup_time}</span>}
            {draft.teardown_time && <span>Teardown: {draft.teardown_time}</span>}
          </div>
        </div>
      </div>
    </div></div>
  );
}
