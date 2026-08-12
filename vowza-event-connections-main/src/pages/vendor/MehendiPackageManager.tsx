import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, Eye, EyeOff, X, Check,
  ChevronRight, ChevronLeft, Upload, Flower2, ChevronDown,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/* ─── Constants ─────────────────────────────────────────────────────────────── */
const PACKAGE_TYPES = [
  { value: 'Bridal Mehendi', name: 'Bridal Mehendi', inclusions: ['Bridal Mehendi','Custom Design','Touch-up','Aftercare Instructions'], deliverables: ['Bridal Design','Feet Design','Touch-up','Premium Cone'] },
  { value: 'Arabic Mehendi', name: 'Arabic Mehendi', inclusions: ['Arabic Mehendi','Custom Design'], deliverables: ['Arabic Design','Aftercare Instructions'] },
  { value: 'Rajasthani Mehendi', name: 'Rajasthani Mehendi', inclusions: ['Traditional Mehendi','Rajasthani Design','Custom Design'], deliverables: ['Rajasthani Design','Aftercare Instructions'] },
  { value: 'Indo Arabic Mehendi', name: 'Indo Arabic Mehendi', inclusions: ['Arabic Mehendi','Custom Design'], deliverables: ['Indo Arabic Design'] },
  { value: 'Portrait Mehendi', name: 'Portrait Mehendi', inclusions: ['Portrait Design','Custom Design','Mehendi Consultation'], deliverables: ['Portrait Design','Touch-up'] },
  { value: 'Engagement Mehendi', name: 'Engagement Mehendi', inclusions: ['Arabic Mehendi','Custom Design','Design Customization'], deliverables: ['Custom Design','Aftercare Instructions'] },
  { value: 'Group Booking', name: 'Group Booking', inclusions: ['Guest Mehendi','Arabic Mehendi'], deliverables: ['Guest Designs'] },
  { value: 'Kids Mehendi', name: 'Kids Mehendi', inclusions: ['Guest Mehendi','Glitter Mehendi'], deliverables: ['Guest Designs'] },
  { value: 'Custom Package', name: 'Custom Package', inclusions: [], deliverables: [] },
];

const ALL_STYLES = ['Bridal Mehendi','Arabic','Indo-Arabic','Rajasthani','Marwari','Pakistani','Traditional','Minimal','Modern','Floral','Mandala','Portrait','Custom'];
const ALL_COVERAGE = ['Front Hands','Back Hands','Full Hands','Half Hands','Feet','Full Bridal','Guest Mehendi','Kids Mehendi'];
const ALL_INCLUSIONS = ['Bridal Mehendi','Guest Mehendi','Arabic Mehendi','Traditional Mehendi','Intricate Bridal Design','Custom Design','Glitter Mehendi','White Mehendi','Rajasthani Design','Mandala Design','Portrait Design','Mehendi Consultation','Design Customization','Touch-up','Aftercare Instructions','Mehendi Cone Included'];
const ALL_DELIVERABLES = ['Bridal Mehendi','Feet Mehendi','Guest Designs','Aftercare Instructions','Touch-up','Premium Cone','Custom Design','Design Consultation'];
const STEP_LABELS = ['Package Type','Pricing','Styles & Coverage','Services','Team','Gallery & Media','Deliverables','Preview'];

const inputClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition placeholder:text-stone-400 focus:border-[#065f46] focus:ring-2 focus:ring-[#065f46]/15';

/* ─── Types ─────────────────────────────────────────────────────────────────── */
type Draft = {
  id?: string; name: string; description: string; package_type: string; status: string;
  package_price: string; advance_percentage: string;
  design_styles: string[]; coverage: string[];
  inclusions: string[];
  lead_artist: string; assistant_artists: string; bridal_specialist: boolean;
  deliverables: string[];
  cover_file: File | null; cover_url: string;
  gallery_files: File[]; gallery_urls: { id: string; url: string; is_cover: boolean }[];
  video_files: File[]; video_urls: { id: string; url: string }[];
};

const blank = (): Draft => ({
  name: '', description: '', package_type: '', status: 'draft',
  package_price: '', advance_percentage: '20',
  design_styles: [], coverage: [],
  inclusions: [],
  lead_artist: '1', assistant_artists: '0', bridal_specialist: false,
  deliverables: [],
  cover_file: null, cover_url: '', gallery_files: [], gallery_urls: [],
  video_files: [], video_urls: [],
});

/* ─── Main Component ────────────────────────────────────────────────────────── */
export default function MehendiPackageManager({ provider }: { provider: any }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['mehendi-packages', provider.id],
    queryFn: async () => { const r = await (supabase.from('mehendi_packages' as any).select('*').eq('provider_id', provider.id).order('created_at', { ascending: false })); if (r.error) throw r.error; return r.data ?? []; },
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['mehendi-packages', provider.id] });
  useEffect(() => { const ch = supabase.channel(`mehendi-packages-${provider.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'mehendi_packages', filter: `provider_id=eq.${provider.id}` }, refresh).subscribe(); return () => { supabase.removeChannel(ch); }; }, [provider.id]);

  const edit = async (pkg: any) => {
    let galleryUrls: { id: string; url: string; is_cover: boolean }[] = []; let videoUrls: { id: string; url: string }[] = []; let coverUrl = '';
    try { const r = await (supabase.from('mehendi_gallery' as any).select('id, public_url, is_cover, sort_order, media_type').eq('package_id', pkg.id).order('sort_order')); const g = (r.data??[]).map((x: any) => ({ id: x.id, url: x.public_url, is_cover: x.is_cover, media_type: x.media_type||'image' })); coverUrl = g.find((x: any) => x.is_cover)?.url||''; galleryUrls = g.filter((x: any) => !x.is_cover && x.media_type==='image'); videoUrls = g.filter((x: any) => x.media_type==='video').map((x: any) => ({ id: x.id, url: x.url })); } catch (_) {}
    setDraft({ id: pkg.id, name: pkg.name||'', description: pkg.description||'', package_type: pkg.package_type||'', status: pkg.status||'draft',
      package_price: String(pkg.package_price??''), advance_percentage: String(pkg.advance_percentage??'20'),
      design_styles: pkg.design_styles??[], coverage: pkg.coverage??[],
      inclusions: pkg.inclusions??[],
      lead_artist: String(pkg.lead_artist??'1'), assistant_artists: String(pkg.assistant_artists??'0'), bridal_specialist: pkg.bridal_specialist??false,
      deliverables: pkg.deliverables??[],
      cover_file: null, cover_url: coverUrl, gallery_files: [], gallery_urls: galleryUrls,
      video_files: [], video_urls: videoUrls });
    setStep(1);
  };

  const save = async () => {
    if (!draft || !draft.name.trim()) { toast.error('Package name is required.'); setStep(1); return; }
    if (!draft.package_price) { toast.error('Package price is required.'); setStep(2); return; }
    if (!draft.cover_file && !draft.cover_url) { toast.error('Cover photo is required.'); setStep(6); return; }
    setBusy(true);
    try {
      const payload: any = { provider_id: provider.id, name: draft.name.trim(), package_type: draft.package_type||null, description: draft.description.trim()||null, status: draft.status, package_price: Number(draft.package_price), advance_percentage: draft.advance_percentage ? Number(draft.advance_percentage) : 20, design_styles: draft.design_styles, coverage: draft.coverage, inclusions: draft.inclusions, lead_artist: Number(draft.lead_artist)||1, assistant_artists: Number(draft.assistant_artists)||0, bridal_specialist: draft.bridal_specialist, deliverables: draft.deliverables };
      let packageId = draft.id;
      if (draft.id) { const r = await (supabase.from('mehendi_packages' as any).update(payload).eq('id', draft.id).select('id').single()); if (r.error) throw r.error; }
      else { const r = await (supabase.from('mehendi_packages' as any).insert(payload).select('id').single()); if (r.error) throw r.error; packageId = r.data.id; }
      if (packageId) {
        if (draft.cover_file) { const ext = draft.cover_file.name.split('.').pop(); const path = `${user!.id}/${packageId}/cover-${crypto.randomUUID()}.${ext}`; const { error: upErr } = await supabase.storage.from('mehendi-media').upload(path, draft.cover_file, { contentType: draft.cover_file.type }); if (!upErr) { const url = supabase.storage.from('mehendi-media').getPublicUrl(path).data.publicUrl; await (supabase.from('mehendi_gallery' as any).delete().eq('package_id', packageId).eq('is_cover', true)); await (supabase.from('mehendi_gallery' as any).insert({ package_id: packageId, storage_path: path, public_url: url, is_cover: true, media_type: 'image', sort_order: 0 })); } }
        if (draft.gallery_files.length > 0) { for (let i = 0; i < draft.gallery_files.length; i++) { const file = draft.gallery_files[i]; const ext = file.name.split('.').pop(); const path = `${user!.id}/${packageId}/gallery-${crypto.randomUUID()}.${ext}`; const { error: upErr } = await supabase.storage.from('mehendi-media').upload(path, file, { contentType: file.type }); if (!upErr) { const url = supabase.storage.from('mehendi-media').getPublicUrl(path).data.publicUrl; await (supabase.from('mehendi_gallery' as any).insert({ package_id: packageId, storage_path: path, public_url: url, is_cover: false, media_type: 'image', sort_order: draft.gallery_urls.length + i + 1 })); } } }
        if (draft.video_files.length > 0) { for (let i = 0; i < draft.video_files.length; i++) { const file = draft.video_files[i]; const ext = file.name.split('.').pop(); const path = `${user!.id}/${packageId}/video-${crypto.randomUUID()}.${ext}`; const { error: upErr } = await supabase.storage.from('mehendi-media').upload(path, file, { contentType: file.type }); if (!upErr) { const url = supabase.storage.from('mehendi-media').getPublicUrl(path).data.publicUrl; await (supabase.from('mehendi_gallery' as any).insert({ package_id: packageId, storage_path: path, public_url: url, is_cover: false, media_type: 'video', sort_order: 100 + i })); } } }
        if (draft.id) { const cur = [...draft.gallery_urls.map(g => g.id), ...draft.video_urls.map(v => v.id)].filter(Boolean); const { data: ex } = await (supabase.from('mehendi_gallery' as any).select('id').eq('package_id', packageId).eq('is_cover', false)); const del = (ex??[]).map((e: any) => e.id).filter((id: string) => !cur.includes(id)); if (del.length > 0) await (supabase.from('mehendi_gallery' as any).delete().in('id', del)); }
      }
      toast.success('Mehendi package saved!'); setDraft(null); setStep(1); refresh();
    } catch (err: any) { toast.error(err.message || 'Could not save'); } finally { setBusy(false); }
  };

  const toggleStatus = async (pkg: any) => { await (supabase.from('mehendi_packages' as any).update({ status: pkg.status === 'active' ? 'draft' : 'active' }).eq('id', pkg.id)); refresh(); };
  const remove = async (pkg: any) => { if (!confirm('Delete this package?')) return; await (supabase.from('mehendi_packages' as any).delete().eq('id', pkg.id)); refresh(); toast.success('Deleted'); };
  const openNew = () => { setDraft(blank()); setStep(1); };

  const ChipSelect = ({ options, selected, onChange, label }: { options: string[]; selected: string[]; onChange: (v: string[]) => void; label: string }) => (
    <div><span className="text-sm font-semibold text-[#1b4332]">{label}</span><div className="mt-1.5 flex flex-wrap gap-2">{options.map(opt => (
      <button key={opt} type="button" onClick={() => onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt])}
        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${selected.includes(opt) ? 'border-emerald-600 bg-emerald-600/10 text-emerald-700' : 'border-[#e7d9c4] text-stone-600 hover:border-emerald-500'}`}>{opt}</button>
    ))}</div></div>
  );

  const renderStep = () => { if (!draft) return null; switch(step) {
    case 1: return <StepPackageType draft={draft} setDraft={setDraft} />;
    case 2: return <StepPricing draft={draft} setDraft={setDraft} />;
    case 3: return <StepStyles draft={draft} setDraft={setDraft} ChipSelect={ChipSelect} />;
    case 4: return <StepServices draft={draft} setDraft={setDraft} ChipSelect={ChipSelect} />;
    case 5: return <StepTeam draft={draft} setDraft={setDraft} />;
    case 6: return <StepGallery draft={draft} setDraft={setDraft} />;
    case 7: return <StepDeliverables draft={draft} setDraft={setDraft} ChipSelect={ChipSelect} />;
    case 8: return <StepPreview draft={draft} />;
    default: return null;
  }};

  return (
    <div className="max-w-[1200px] space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div><h1 className="text-xl font-bold text-[#1b4332]">Mehendi Packages</h1><p className="text-sm text-muted-foreground">Create and manage your mehendi packages.</p></div>
        <button onClick={openNew} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"><Plus className="mr-1 inline h-4 w-4" />Create Package</button>
      </div>
      {isLoading ? (<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[1,2,3].map(i => <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : packages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#eadfcf] py-16 text-center">
          <Flower2 className="h-12 w-12 text-emerald-700/30" /><p className="mt-3 font-semibold text-[#1b4332]">No packages yet</p>
          <button onClick={openNew} className="mt-4 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white"><Plus className="mr-1 inline h-4 w-4" />Create Package</button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{packages.map((pkg: any) => (
          <div key={pkg.id} className="overflow-hidden rounded-2xl border border-[#eadfcf] bg-[#f9fdf9] shadow-sm hover:shadow-md transition">
            <div className="flex h-28 items-center justify-center bg-gradient-to-br from-emerald-50 to-amber-50"><Flower2 className="h-10 w-10 text-emerald-700/40" /></div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2"><h2 className="font-bold text-[#1b4332] leading-tight">{pkg.name}</h2>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${pkg.status==='active'?'bg-emerald-100 text-emerald-700':pkg.status==='paused'?'bg-amber-100 text-amber-700':'bg-blue-50 text-blue-700'}`}>{pkg.status}</span></div>
              {pkg.package_price && <p className="mt-1.5 text-lg font-bold text-emerald-700">₹{Number(pkg.package_price).toLocaleString('en-IN')}</p>}
              {pkg.package_type && <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1"><Flower2 className="h-3.5 w-3.5" />{pkg.package_type}</div>}
              <div className="mt-4 flex gap-2">
                <button onClick={() => edit(pkg)} className="flex-1 rounded-lg border border-[#e7d9c4] py-2 text-xs font-medium text-[#1b4332] hover:bg-[#f9fdf9]"><Pencil className="mr-1 inline h-3 w-3" />Edit</button>
                <button onClick={() => toggleStatus(pkg)} className="rounded-lg border border-[#e7d9c4] p-2 hover:bg-[#f9fdf9]">{pkg.status==='active'?<EyeOff className="h-3.5 w-3.5 text-stone-600" />:<Eye className="h-3.5 w-3.5 text-stone-600" />}</button>
                <button onClick={() => remove(pkg)} className="rounded-lg border border-red-200 p-2 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5 text-red-600" /></button>
              </div>
            </div>
          </div>
        ))}</div>
      )}
      {draft && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#0a2e1b]/65 p-3 backdrop-blur-sm sm:p-6">
          <div className="mx-auto my-3 max-w-3xl overflow-hidden rounded-[24px] bg-[#fafff9] shadow-2xl">
            <header className="flex items-start justify-between gap-4 bg-emerald-800 px-5 py-5 sm:px-7"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a7f3d0]">Vowza Mehendi</p><h2 className="mt-1 text-lg font-bold text-white">{draft.id?'Edit Package':'Create New Package'}</h2></div><button onClick={() => {setDraft(null);setStep(1);}} className="rounded-full p-2 text-white/85 hover:bg-white/15"><X className="h-5 w-5" /></button></header>
            <div className="border-b border-[#eadfcf] bg-[#fcfffc] px-5 py-4 sm:px-7"><div className="flex items-center justify-between">{STEP_LABELS.map((label, i) => { const sn=i+1; const done=step>sn; const cur=step===sn; return (<div key={i} className="flex flex-1 items-center"><div className="flex flex-col items-center"><div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${done?'bg-emerald-500 text-white':cur?'bg-emerald-700 text-white shadow-md shadow-emerald-700/30':'border-2 border-[#e7d9c4] text-stone-400'}`}>{done?<Check className="h-4 w-4" />:sn}</div><span className={`mt-1 hidden text-[10px] font-medium sm:block ${cur?'text-emerald-700':done?'text-emerald-600':'text-stone-400'}`}>{label}</span></div>{i<7&&<div className={`mx-1 h-0.5 flex-1 rounded ${done?'bg-emerald-400':'bg-[#e7d9c4]'}`}/>}</div>);})}</div></div>
            <div className="p-5 sm:p-7 max-h-[60vh] overflow-y-auto">{renderStep()}</div>
            <div className="flex items-center justify-between border-t border-[#eadfcf] bg-[#fcfffc]/95 px-5 py-4 backdrop-blur sm:px-7">
              <button type="button" onClick={() => step>1?setStep(step-1):setDraft(null)} className="flex items-center gap-1.5 rounded-xl border border-[#d7c5ae] px-4 py-2.5 text-sm font-semibold text-[#1b4332] hover:bg-white"><ChevronLeft className="h-4 w-4" />{step===1?'Cancel':'Back'}</button>
              {step<8?(<button type="button" onClick={() => setStep(step+1)} className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-800">Next<ChevronRight className="h-4 w-4" /></button>
              ):(<button type="button" disabled={busy} onClick={save} className="rounded-xl bg-emerald-700 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-60">{busy?'Saving…':'Save Package'}</button>)}
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
    if (sel) setDraft({ ...draft, package_type: value, name: sel.name, inclusions: [...sel.inclusions], deliverables: [...sel.deliverables] });
    else setDraft({ ...draft, package_type: value });
  };
  const selectedType = PACKAGE_TYPES.find(t => t.value === draft.package_type);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fcfffc] p-5">
        <h3 className="mb-4 text-base font-bold text-emerald-800">Select Package Type</h3>
        <select className={`${inputClass} text-base py-3`} value={draft.package_type} onChange={e => handleTypeChange(e.target.value)}>
          <option value="">Select Mehendi Package Type</option>
          {PACKAGE_TYPES.map(t => <option key={t.value} value={t.value}>{t.name}</option>)}
        </select>
        {selectedType && selectedType.value !== 'Custom Package' && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3"><p className="text-xs font-semibold text-emerald-700 flex items-center gap-1"><Check className="h-3.5 w-3.5" />Auto-loaded "{selectedType.name}"</p></div>
        )}
      </div>
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fcfffc] p-5 space-y-4">
        <h3 className="text-base font-bold text-emerald-800">Package Info</h3>
        <label className="block"><span className="text-sm font-semibold text-[#1b4332]">Package Name <span className="text-red-500">*</span></span>
          <input className={inputClass} value={draft.name} onChange={e => setDraft({...draft, name: e.target.value})} placeholder="e.g. Premium Bridal Mehendi" /></label>
        <label className="block"><span className="text-sm font-semibold text-[#1b4332]">Description</span>
          <textarea className={`${inputClass} min-h-[80px] resize-y`} value={draft.description} onChange={e => setDraft({...draft, description: e.target.value})} placeholder="Describe your mehendi package..." /></label>
        <label className="block"><span className="text-sm font-semibold text-[#1b4332]">Status</span>
          <select className={inputClass} value={draft.status} onChange={e => setDraft({...draft, status: e.target.value})}><option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option></select></label>
      </div>
    </div>
  );
}

/* ─── Step 2: Pricing ────────────────────────────────────────────────────────── */
function StepPricing({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const price = Number(draft.package_price||0); const advPct = Number(draft.advance_percentage||20);
  const advAmount = Math.round(price * advPct / 100); const remaining = price - advAmount;
  return (
    <div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#fcfffc] p-5">
      <h3 className="mb-4 text-base font-bold text-emerald-800">Pricing</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="text-sm font-semibold text-[#1b4332]">Package Price <span className="text-red-500">*</span></span><div className="relative"><span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span><input className={`${inputClass} pl-7`} type="number" min="0" value={draft.package_price} onChange={e => setDraft({...draft,package_price:e.target.value})} placeholder="Package price" /></div></label>
        <label className="block"><span className="text-sm font-semibold text-[#1b4332]">Advance %</span><div className="relative"><span className="absolute right-3.5 top-2.5 text-sm text-stone-500">%</span><input className={`${inputClass} pr-7`} type="number" min="0" max="100" value={draft.advance_percentage} onChange={e => setDraft({...draft,advance_percentage:e.target.value})} placeholder="20" /></div></label>
      </div>
      {price > 0 && (<div className="mt-4 rounded-xl border border-[#eadfcf] bg-emerald-50/30 p-4 space-y-2">
        <div className="flex justify-between text-sm"><span className="text-stone-600">Package Price</span><span className="font-bold text-emerald-700">₹{price.toLocaleString('en-IN')}</span></div>
        <div className="flex justify-between text-sm"><span className="text-stone-600">Advance ({advPct}%)</span><span className="font-semibold text-emerald-600">₹{advAmount.toLocaleString('en-IN')}</span></div>
        <div className="flex justify-between text-sm border-t border-[#eadfcf] pt-2"><span className="text-stone-600">Remaining</span><span className="font-semibold">₹{remaining.toLocaleString('en-IN')}</span></div>
      </div>)}
    </div></div>
  );
}

/* ─── Step 3: Styles & Coverage ──────────────────────────────────────────────── */
function StepStyles({ draft, setDraft, ChipSelect }: { draft: Draft; setDraft: (d: Draft) => void; ChipSelect: any }) {
  return (<div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#fcfffc] p-5 space-y-5">
    <h3 className="text-base font-bold text-emerald-800">Mehendi Styles & Coverage</h3>
    <ChipSelect label="Mehendi Styles" options={ALL_STYLES} selected={draft.design_styles} onChange={(v: string[]) => setDraft({...draft,design_styles:v})} />
    <ChipSelect label="Coverage" options={ALL_COVERAGE} selected={draft.coverage} onChange={(v: string[]) => setDraft({...draft,coverage:v})} />
  </div></div>);
}

/* ─── Step 4: Services & Inclusions ──────────────────────────────────────────── */
function StepServices({ draft, setDraft, ChipSelect }: { draft: Draft; setDraft: (d: Draft) => void; ChipSelect: any }) {
  return (<div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#fcfffc] p-5 space-y-5"><h3 className="text-base font-bold text-emerald-800">Services & Inclusions</h3><ChipSelect label="Select Services Included" options={ALL_INCLUSIONS} selected={draft.inclusions} onChange={(v: string[]) => setDraft({...draft,inclusions:v})} /></div></div>);
}

/* ─── Step 5: Team ───────────────────────────────────────────────────────────── */
function StepTeam({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  return (<div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#fcfffc] p-5 space-y-4">
    <h3 className="text-base font-bold text-emerald-800">Team</h3>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block"><span className="text-sm font-semibold text-[#1b4332]">Lead Artist</span><input className={inputClass} type="number" min="1" value={draft.lead_artist} onChange={e => setDraft({...draft,lead_artist:e.target.value})} placeholder="1" /></label>
      <label className="block"><span className="text-sm font-semibold text-[#1b4332]">Assistant Artists</span><input className={inputClass} type="number" min="0" value={draft.assistant_artists} onChange={e => setDraft({...draft,assistant_artists:e.target.value})} placeholder="0" /></label>
    </div>
    <label className="flex items-center gap-3 rounded-xl border border-[#eadfcf] p-3 cursor-pointer"><input type="checkbox" checked={draft.bridal_specialist} onChange={e => setDraft({...draft,bridal_specialist:e.target.checked})} className="h-4 w-4 rounded border-[#e7d9c4] text-emerald-700" /><span className="text-sm font-semibold text-[#1b4332]">Bridal Specialist</span></label>
  </div></div>);
}

/* ─── Step 6: Gallery & Media ────────────────────────────────────────────────── */
function StepGallery({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  return (
    <div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#fcfffc] p-5">
      <h3 className="mb-4 text-base font-bold text-emerald-800">Gallery & Media</h3>
      {/* Cover */}
      <div className="mb-5">
        <span className="text-sm font-semibold text-[#1b4332]">Cover Photo <span className="text-red-500">*</span></span>
        {(draft.cover_file||draft.cover_url) ? (
          <div className="relative rounded-xl overflow-hidden border border-[#eadfcf] bg-stone-50 mt-2"><img src={draft.cover_file?URL.createObjectURL(draft.cover_file):draft.cover_url} alt="Cover" className="w-full h-40 object-cover" /><button type="button" onClick={() => setDraft({...draft, cover_file: null, cover_url: ''})} className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"><X className="h-3.5 w-3.5" /></button></div>
        ) : (
          <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-emerald-300 bg-[#f0fdf4] p-6 hover:border-emerald-600"><Upload className="h-6 w-6 text-emerald-700 mb-2" /><span className="text-sm font-semibold text-[#1b4332]">Upload cover photo</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f=e.target.files?.[0]; if(f&&f.size<=5*1024*1024) setDraft({...draft,cover_file:f}); else if(f) toast.error('Max 5MB'); }} /></label>
        )}
      </div>
      {/* Gallery Images */}
      <div className="mb-5">
        <span className="text-sm font-semibold text-[#1b4332]">Gallery Photos (max 10)</span>
        <p className="text-xs text-stone-500 mb-2">Upload mehendi design photos</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {draft.gallery_urls.map((img,i) => (<div key={img.id||i} className="relative rounded-xl overflow-hidden border border-[#eadfcf] aspect-square bg-stone-50"><img src={img.url} alt="" className="w-full h-full object-cover" /><button type="button" onClick={() => setDraft({...draft,gallery_urls:draft.gallery_urls.filter((_,idx)=>idx!==i)})} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white"><X className="h-3 w-3" /></button></div>))}
          {draft.gallery_files.map((f,i) => (<div key={`new-${i}`} className="relative rounded-xl overflow-hidden border border-[#eadfcf] aspect-square bg-stone-50"><img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" /><button type="button" onClick={() => setDraft({...draft,gallery_files:draft.gallery_files.filter((_,idx)=>idx!==i)})} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white"><X className="h-3 w-3" /></button></div>))}
          {(draft.gallery_urls.length+draft.gallery_files.length)<10 && (<label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-emerald-300 bg-[#f0fdf4] aspect-square hover:border-emerald-600"><Plus className="h-5 w-5 text-emerald-700" /><span className="text-[9px] text-stone-500 mt-1">+ Photo</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={e => { const files=Array.from(e.target.files??[]).filter(f=>f.size<=5*1024*1024).slice(0,10-draft.gallery_urls.length-draft.gallery_files.length); if(files.length) setDraft({...draft,gallery_files:[...draft.gallery_files,...files]}); }} /></label>)}
        </div>
      </div>
      {/* Videos */}
      <div>
        <span className="text-sm font-semibold text-[#1b4332]">Mehendi Work Videos (max 3)</span>
        <p className="text-xs text-stone-500 mb-2">Upload MP4/MOV/WEBM, max 100MB each</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {draft.video_urls.map((vid,i) => (<div key={vid.id||i} className="relative rounded-xl overflow-hidden border border-emerald-200 bg-emerald-50 aspect-video"><video src={vid.url} className="w-full h-full object-cover rounded-xl" muted preload="metadata" /><span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white font-bold">VIDEO</span><button type="button" onClick={() => setDraft({...draft,video_urls:draft.video_urls.filter((_,idx)=>idx!==i)})} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"><X className="h-3 w-3" /></button></div>))}
          {draft.video_files.map((f,i) => (<div key={`newv-${i}`} className="relative rounded-xl overflow-hidden border border-emerald-200 bg-emerald-50 aspect-video"><video src={URL.createObjectURL(f)} className="w-full h-full object-cover rounded-xl" muted preload="metadata" /><span className="absolute bottom-1 left-1 rounded bg-emerald-700 px-1.5 py-0.5 text-[9px] text-white font-bold">NEW</span><button type="button" onClick={() => setDraft({...draft,video_files:draft.video_files.filter((_,idx)=>idx!==i)})} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"><X className="h-3 w-3" /></button></div>))}
          {(draft.video_urls.length+draft.video_files.length)<3 && (<label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-emerald-300 bg-[#f0fdf4] aspect-video hover:border-emerald-600"><Upload className="h-5 w-5 text-emerald-700" /><span className="text-[10px] text-stone-500 mt-1">+ Add Video</span><input type="file" accept="video/mp4,video/mov,video/webm,video/quicktime" multiple className="hidden" onChange={e => { const files=Array.from(e.target.files??[]).filter(f=>f.size<=100*1024*1024).slice(0,3-draft.video_urls.length-draft.video_files.length); if(files.length) setDraft({...draft,video_files:[...draft.video_files,...files]}); else if(e.target.files?.length) toast.error('Max 100MB per video'); }} /></label>)}
        </div>
      </div>
    </div></div>
  );
}

/* ─── Step 7: Deliverables ───────────────────────────────────────────────────── */
function StepDeliverables({ draft, setDraft, ChipSelect }: { draft: Draft; setDraft: (d: Draft) => void; ChipSelect: any }) {
  return (<div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#fcfffc] p-5 space-y-5"><h3 className="text-base font-bold text-emerald-800">Deliverables</h3><ChipSelect label="What's Included" options={ALL_DELIVERABLES} selected={draft.deliverables} onChange={(v: string[]) => setDraft({...draft,deliverables:v})} /></div></div>);
}

/* ─── Step 8: Preview ────────────────────────────────────────────────────────── */
function StepPreview({ draft }: { draft: Draft }) {
  const price = Number(draft.package_price||0); const advPct = Number(draft.advance_percentage||20);
  const advAmount = Math.round(price * advPct / 100); const remaining = price - advAmount;
  return (
    <div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#fcfffc] p-5">
      <h3 className="mb-4 text-base font-bold text-emerald-800">Preview</h3>
      <div className="overflow-hidden rounded-2xl border border-[#eadfcf] bg-white shadow-sm">
        {draft.cover_file||draft.cover_url?(<div className="h-36 overflow-hidden"><img src={draft.cover_file?URL.createObjectURL(draft.cover_file):draft.cover_url} alt="Cover" className="w-full h-full object-cover" /></div>):(<div className="flex h-36 items-center justify-center bg-gradient-to-br from-emerald-50 to-amber-50"><Flower2 className="h-8 w-8 text-emerald-700/40" /></div>)}
        <div className="p-5">
          <div className="flex items-start justify-between"><h4 className="text-lg font-bold text-[#1b4332]">{draft.name||'Package Name'}</h4><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${draft.status==='active'?'bg-emerald-100 text-emerald-700':'bg-blue-50 text-blue-700'}`}>{draft.status}</span></div>
          {draft.package_type && <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800"><Flower2 className="h-3 w-3" />{draft.package_type}</span>}
          {draft.description && <p className="mt-2 text-sm text-stone-500 line-clamp-2">{draft.description}</p>}
          {price > 0 && (<div className="mt-3"><p className="text-2xl font-bold text-emerald-700">₹{price.toLocaleString('en-IN')}</p><p className="text-xs text-stone-500">Advance: {advPct}% (₹{advAmount.toLocaleString('en-IN')}) · Remaining: ₹{remaining.toLocaleString('en-IN')}</p></div>)}
          {draft.design_styles.length>0 && (<div className="mt-3 border-t border-stone-100 pt-3"><p className="text-xs font-semibold text-stone-600 mb-1.5">Styles:</p><div className="flex flex-wrap gap-1">{draft.design_styles.map(s => <span key={s} className="rounded-full bg-emerald-700/8 px-2 py-0.5 text-[11px] text-emerald-700">{s}</span>)}</div></div>)}
          {draft.coverage.length>0 && (<div className="mt-3 border-t border-stone-100 pt-3"><p className="text-xs font-semibold text-stone-600 mb-1.5">Coverage:</p><div className="flex flex-wrap gap-1">{draft.coverage.map(c => <span key={c} className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">{c}</span>)}</div></div>)}
          {draft.inclusions.length>0 && (<div className="mt-3 border-t border-stone-100 pt-3"><p className="text-xs font-semibold text-stone-600 mb-1.5">Services:</p><div className="flex flex-wrap gap-1">{draft.inclusions.map(i => <span key={i} className="rounded-full border border-emerald-200 px-2 py-0.5 text-[11px] text-emerald-800">{i}</span>)}</div></div>)}
          {draft.deliverables.length>0 && (<div className="mt-3 border-t border-stone-100 pt-3"><p className="text-xs font-semibold text-stone-600 mb-1.5">Deliverables:</p><div className="flex flex-wrap gap-1">{draft.deliverables.map(d => <span key={d} className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] text-emerald-800">{d}</span>)}</div></div>)}
          <div className="mt-3 border-t border-stone-100 pt-3 flex gap-4 text-[11px] text-stone-500">
            {Number(draft.lead_artist)>0 && <span>Lead: {draft.lead_artist}</span>}
            {Number(draft.assistant_artists)>0 && <span>Assistants: {draft.assistant_artists}</span>}
            {draft.bridal_specialist && <span className="text-emerald-700 font-medium">Bridal Specialist ✓</span>}
          </div>
        </div>
      </div>
    </div></div>
  );
}
