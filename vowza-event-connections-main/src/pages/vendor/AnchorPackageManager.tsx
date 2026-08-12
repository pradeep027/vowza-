import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, Eye, EyeOff, X, Check,
  ChevronRight, ChevronLeft, Upload, Mic2, ChevronDown,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/* ─── Constants ─────────────────────────────────────────────────────────────── */
const PACKAGE_TYPES = [
  { value: 'Wedding Anchor', name: 'Wedding Anchor', services: ['Event Hosting','Couple Introduction','Event Announcements','Games & Activities','Wedding Hosting'], deliverables: ['Full Event Hosting','Couple Introduction','Guest Engagement','Games Session'] },
  { value: 'Reception Host', name: 'Reception Host', services: ['Event Hosting','Guest Engagement','Couple Introduction','Event Announcements'], deliverables: ['Reception Hosting','Guest Engagement','Announcements'] },
  { value: 'Corporate Event Host', name: 'Corporate Event Host', services: ['Corporate Hosting','Event Coordination','Award Ceremony Hosting','Stage Hosting'], deliverables: ['Full Event Hosting','Corporate Script','Event Coordination'] },
  { value: 'Birthday Host', name: 'Birthday Host', services: ['Event Hosting','Games & Activities','Audience Interaction','Event Announcements'], deliverables: ['Birthday Hosting','Games Session','Audience Interaction'] },
  { value: 'Sangeet Host', name: 'Sangeet Host', services: ['Event Hosting','Games & Activities','Audience Interaction','Stage Hosting'], deliverables: ['Sangeet Hosting','Games','Dance Coordination'] },
  { value: 'Stage Show Host', name: 'Stage Show Host', services: ['Stage Hosting','Event Announcements','Audience Interaction'], deliverables: ['Full Stage Hosting','Script','Coordination'] },
  { value: 'College Fest Host', name: 'College Fest Host', services: ['Event Hosting','Audience Interaction','Stage Hosting','Event Coordination'], deliverables: ['Fest Hosting','Crowd Engagement','Event Flow'] },
  { value: 'Private Party Host', name: 'Private Party Host', services: ['Event Hosting','Games & Activities','Guest Engagement'], deliverables: ['Party Hosting','Games','Guest Interaction'] },
  { value: 'Custom Package', name: 'Custom Package', services: [], deliverables: [] },
];

const ALL_EVENT_TYPES = ['Wedding','Reception','Baraat','Engagement','Sangeet','Haldi','Mehendi','Birthday','Anniversary','Corporate Event','College Fest','Cultural Event','Private Party','Public Event','Religious Event','Award Function','Custom Event'];
const ALL_COVERAGE = ['Full Event','Ceremony','Reception','Stage','Baraat','Multiple Sessions'];
const ALL_INCLUSIONS = ['Event Hosting','Stage Hosting','Audience Interaction','Guest Engagement','Couple Introduction','Event Announcements','Games & Activities','Wedding Hosting','Reception Hosting','Baraat Hosting','Corporate Hosting','Award Ceremony Hosting','Script Preparation','Bilingual Hosting','Event Coordination'];
const ALL_DELIVERABLES = ['Full Event Hosting','Couple Introduction','Guest Engagement','Games Session','Announcements','Event Coordination','Script','Stage Management','Crowd Engagement','Dance Coordination'];
const ADDON_TEMPLATES = ['Extra Hour','Second Anchor','Bilingual Hosting','Script Writing','Games Kit','Travel','Extended Event','Rehearsal Session'];
const STEP_LABELS = ['Package Type','Pricing','Performance Style','Inclusions','Team','Deliverables','Add-ons','Preview'];

const inputClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition placeholder:text-stone-400 focus:border-[#0891b2] focus:ring-2 focus:ring-[#0891b2]/15';

/* ─── Types ─────────────────────────────────────────────────────────────────── */
type Addon = { name: string; price: string; description: string };
type Draft = {
  id?: string; name: string; description: string; package_type: string; status: string;
  package_price: string; advance_percentage: string;
  design_styles: string[]; coverage: string[];
  inclusions: string[];
  lead_artist: string; assistant_artists: string;
  deliverables: string[]; addons: Addon[];
  cover_file: File | null; cover_url: string;
  gallery_files: File[]; gallery_urls: { id: string; url: string; is_cover: boolean }[];
  video_files: File[]; video_urls: { id: string; url: string }[];
};

const blank = (): Draft => ({
  name: '', description: '', package_type: '', status: 'draft',
  package_price: '', advance_percentage: '20',
  design_styles: [], coverage: [],
  inclusions: [],
  lead_artist: '1', assistant_artists: '0',
  deliverables: [], addons: [],
  cover_file: null, cover_url: '', gallery_files: [], gallery_urls: [],
  video_files: [], video_urls: [],
});

/* ─── Main Component ────────────────────────────────────────────────────────── */
export default function AnchorPackageManager({ provider }: { provider: any }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['anchor-packages', provider.id],
    queryFn: async () => { const r = await (supabase.from('anchor_packages' as any).select('*').eq('provider_id', provider.id).order('created_at', { ascending: false })); if (r.error) throw r.error; return r.data ?? []; },
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['anchor-packages', provider.id] });
  useEffect(() => { const ch = supabase.channel(`anchor-packages-${provider.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'anchor_packages', filter: `provider_id=eq.${provider.id}` }, refresh).subscribe(); return () => { supabase.removeChannel(ch); }; }, [provider.id]);

  const edit = async (pkg: any) => {
    let addons: Addon[] = []; let galleryUrls: { id: string; url: string; is_cover: boolean }[] = []; let videoUrls: { id: string; url: string }[] = []; let coverUrl = '';
    try { const r = await (supabase.from('anchor_addons' as any).select('name, price, description').eq('package_id', pkg.id).order('sort_order')); if (r.data) addons = r.data.map((a: any) => ({ name: a.name, price: String(a.price??''), description: a.description||'' })); } catch (_) {}
    try { const r = await (supabase.from('anchor_gallery' as any).select('id, public_url, is_cover, sort_order, media_type').eq('package_id', pkg.id).order('sort_order')); const g = (r.data??[]).map((x: any) => ({ id: x.id, url: x.public_url, is_cover: x.is_cover, media_type: x.media_type||'image' })); coverUrl = g.find((x: any) => x.is_cover)?.url||''; galleryUrls = g.filter((x: any) => !x.is_cover && x.media_type==='image'); videoUrls = g.filter((x: any) => x.media_type==='video').map((x: any) => ({ id: x.id, url: x.url })); } catch (_) {}
    setDraft({ id: pkg.id, name: pkg.name||'', description: pkg.description||'', package_type: pkg.package_type||'', status: pkg.status||'draft',
      package_price: String(pkg.package_price??''), advance_percentage: String(pkg.advance_percentage??'20'),
      design_styles: pkg.hosting_style??[], coverage: pkg.services_included?.filter((s: string) => ALL_COVERAGE.includes(s))??[],
      inclusions: pkg.services_included?.filter((s: string) => !ALL_COVERAGE.includes(s))??[],
      lead_artist: String(pkg.lead_anchor??'1'), assistant_artists: String(pkg.assistant??'0'),
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
      const payload: any = { provider_id: provider.id, name: draft.name.trim(), package_type: draft.package_type||null, description: draft.description.trim()||null, status: draft.status, package_price: Number(draft.package_price), advance_percentage: draft.advance_percentage ? Number(draft.advance_percentage) : 20, hosting_style: draft.design_styles, services_included: [...draft.coverage, ...draft.inclusions], deliverables: draft.deliverables, lead_anchor: Number(draft.lead_artist)||1, assistant: Number(draft.assistant_artists)||0 };
      let packageId = draft.id;
      if (draft.id) { const r = await (supabase.from('anchor_packages' as any).update(payload).eq('id', draft.id).select('id').single()); if (r.error) throw r.error; }
      else { const r = await (supabase.from('anchor_packages' as any).insert(payload).select('id').single()); if (r.error) throw r.error; packageId = r.data.id; }
      if (packageId) {
        // Addons
        await (supabase.from('anchor_addons' as any).delete().eq('package_id', packageId));
        const valid = draft.addons.filter(a => a.name.trim());
        if (valid.length > 0) await (supabase.from('anchor_addons' as any).insert(valid.map((a, i) => ({ package_id: packageId, name: a.name.trim(), price: Number(a.price)||0, description: a.description||null, sort_order: i }))));
        // Cover
        if (draft.cover_file) { const ext = draft.cover_file.name.split('.').pop(); const path = `${user!.id}/${packageId}/cover-${crypto.randomUUID()}.${ext}`; const { error: upErr } = await supabase.storage.from('anchor-media').upload(path, draft.cover_file, { contentType: draft.cover_file.type }); if (!upErr) { const url = supabase.storage.from('anchor-media').getPublicUrl(path).data.publicUrl; await (supabase.from('anchor_gallery' as any).delete().eq('package_id', packageId).eq('is_cover', true)); await (supabase.from('anchor_gallery' as any).insert({ package_id: packageId, storage_path: path, public_url: url, is_cover: true, media_type: 'image', sort_order: 0 })); } }
        // Gallery photos
        if (draft.gallery_files.length > 0) { for (let i = 0; i < draft.gallery_files.length; i++) { const file = draft.gallery_files[i]; const ext = file.name.split('.').pop(); const path = `${user!.id}/${packageId}/gallery-${crypto.randomUUID()}.${ext}`; const { error: upErr } = await supabase.storage.from('anchor-media').upload(path, file, { contentType: file.type }); if (!upErr) { const url = supabase.storage.from('anchor-media').getPublicUrl(path).data.publicUrl; await (supabase.from('anchor_gallery' as any).insert({ package_id: packageId, storage_path: path, public_url: url, is_cover: false, media_type: 'image', sort_order: draft.gallery_urls.length + i + 1 })); } } }
        // Videos
        if (draft.video_files.length > 0) { for (let i = 0; i < draft.video_files.length; i++) { const file = draft.video_files[i]; const ext = file.name.split('.').pop(); const path = `${user!.id}/${packageId}/video-${crypto.randomUUID()}.${ext}`; const { error: upErr } = await supabase.storage.from('anchor-media').upload(path, file, { contentType: file.type }); if (!upErr) { const url = supabase.storage.from('anchor-media').getPublicUrl(path).data.publicUrl; await (supabase.from('anchor_gallery' as any).insert({ package_id: packageId, storage_path: path, public_url: url, is_cover: false, media_type: 'video', sort_order: 100 + i })); } } }
        // Delete removed
        if (draft.id) { const cur = [...draft.gallery_urls.map(g => g.id), ...draft.video_urls.map(v => v.id)].filter(Boolean); const { data: ex } = await (supabase.from('anchor_gallery' as any).select('id').eq('package_id', packageId).eq('is_cover', false)); const del = (ex??[]).map((e: any) => e.id).filter((id: string) => !cur.includes(id)); if (del.length > 0) await (supabase.from('anchor_gallery' as any).delete().in('id', del)); }
      }
      toast.success('Anchor package saved!'); setDraft(null); setStep(1); refresh();
    } catch (err: any) { toast.error(err.message || 'Could not save'); } finally { setBusy(false); }
  };

  const toggleStatus = async (pkg: any) => { await (supabase.from('anchor_packages' as any).update({ status: pkg.status === 'active' ? 'draft' : 'active' }).eq('id', pkg.id)); refresh(); };
  const remove = async (pkg: any) => { if (!confirm('Delete this package?')) return; await (supabase.from('anchor_packages' as any).delete().eq('id', pkg.id)); refresh(); toast.success('Deleted'); };
  const openNew = () => { setDraft(blank()); setStep(1); };

  const ChipSelect = ({ options, selected, onChange, label }: { options: string[]; selected: string[]; onChange: (v: string[]) => void; label: string }) => (
    <div><span className="text-sm font-semibold text-[#0e4d5c]">{label}</span><div className="mt-1.5 flex flex-wrap gap-2">{options.map(opt => (
      <button key={opt} type="button" onClick={() => onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt])}
        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${selected.includes(opt) ? 'border-cyan-700 bg-cyan-700/10 text-cyan-700' : 'border-[#e7d9c4] text-stone-600 hover:border-cyan-500'}`}>{opt}</button>
    ))}</div></div>
  );

  const renderStep = () => { if (!draft) return null; switch(step) {
    case 1: return <StepPackageType draft={draft} setDraft={setDraft} />;
    case 2: return <StepPricing draft={draft} setDraft={setDraft} />;
    case 3: return <StepPerformanceStyle draft={draft} setDraft={setDraft} ChipSelect={ChipSelect} />;
    case 4: return <StepInclusions draft={draft} setDraft={setDraft} ChipSelect={ChipSelect} />;
    case 5: return <StepTeam draft={draft} setDraft={setDraft} />;
    case 6: return <StepDeliverables draft={draft} setDraft={setDraft} ChipSelect={ChipSelect} />;
    case 7: return <StepAddons draft={draft} setDraft={setDraft} />;
    case 8: return <StepPreview draft={draft} />;
    default: return null;
  }};


  return (
    <div className="max-w-[1200px] space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div><h1 className="text-xl font-bold text-[#0e4d5c]">Anchor Packages</h1><p className="text-sm text-muted-foreground">Create and manage your hosting & anchoring packages.</p></div>
        <button onClick={openNew} className="rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-cyan-800"><Plus className="mr-1 inline h-4 w-4" />Add Package</button>
      </div>
      {isLoading ? (<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[1,2,3].map(i => <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : packages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#eadfcf] py-16 text-center">
          <Mic2 className="h-12 w-12 text-cyan-700/30" /><p className="mt-3 font-semibold text-[#0e4d5c]">No packages yet</p>
          <button onClick={openNew} className="mt-4 rounded-xl bg-cyan-700 px-5 py-2.5 text-sm font-semibold text-white"><Plus className="mr-1 inline h-4 w-4" />Add Package</button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{packages.map((pkg: any) => (
          <div key={pkg.id} className="overflow-hidden rounded-2xl border border-[#eadfcf] bg-[#f0fdfa] shadow-sm hover:shadow-md transition">
            <div className="flex h-28 items-center justify-center bg-gradient-to-br from-cyan-50 to-teal-50"><Mic2 className="h-10 w-10 text-cyan-700/40" /></div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2"><h2 className="font-bold text-[#0e4d5c] leading-tight">{pkg.name}</h2>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${pkg.status==='active'?'bg-cyan-100 text-cyan-700':pkg.status==='paused'?'bg-amber-100 text-amber-700':'bg-blue-50 text-blue-700'}`}>{pkg.status}</span></div>
              {pkg.package_price && <p className="mt-1.5 text-lg font-bold text-cyan-700">₹{Number(pkg.package_price).toLocaleString('en-IN')}</p>}
              {pkg.package_type && <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1"><Mic2 className="h-3.5 w-3.5" />{pkg.package_type}</div>}
              <div className="mt-4 flex gap-2">
                <button onClick={() => edit(pkg)} className="flex-1 rounded-lg border border-[#e7d9c4] py-2 text-xs font-medium text-[#0e4d5c] hover:bg-[#f0fdfa]"><Pencil className="mr-1 inline h-3 w-3" />Edit</button>
                <button onClick={() => toggleStatus(pkg)} className="rounded-lg border border-[#e7d9c4] p-2 hover:bg-[#f0fdfa]">{pkg.status==='active'?<EyeOff className="h-3.5 w-3.5 text-stone-600" />:<Eye className="h-3.5 w-3.5 text-stone-600" />}</button>
                <button onClick={() => remove(pkg)} className="rounded-lg border border-red-200 p-2 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5 text-red-600" /></button>
              </div>
            </div>
          </div>
        ))}</div>
      )}
      {draft && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#0e3d4e]/65 p-3 backdrop-blur-sm sm:p-6">
          <div className="mx-auto my-3 max-w-3xl overflow-hidden rounded-[24px] bg-[#fefffd] shadow-2xl">
            <header className="flex items-start justify-between gap-4 bg-cyan-800 px-5 py-5 sm:px-7"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Vowza Anchors</p><h2 className="mt-1 text-lg font-bold text-white">{draft.id?'Edit Package':'Add New Package'}</h2></div><button onClick={() => {setDraft(null);setStep(1);}} className="rounded-full p-2 text-white/85 hover:bg-white/15"><X className="h-5 w-5" /></button></header>
            <div className="border-b border-[#eadfcf] bg-[#f0fdfa] px-5 py-4 sm:px-7"><div className="flex items-center justify-between">{STEP_LABELS.map((label, i) => { const sn=i+1; const done=step>sn; const cur=step===sn; return (<div key={i} className="flex flex-1 items-center"><div className="flex flex-col items-center"><div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${done?'bg-cyan-500 text-white':cur?'bg-cyan-700 text-white shadow-md':'border-2 border-[#e7d9c4] text-stone-400'}`}>{done?<Check className="h-4 w-4" />:sn}</div><span className={`mt-1 hidden text-[10px] font-medium sm:block ${cur?'text-cyan-700':done?'text-cyan-600':'text-stone-400'}`}>{label}</span></div>{i<7&&<div className={`mx-1 h-0.5 flex-1 rounded ${done?'bg-cyan-400':'bg-[#e7d9c4]'}`}/>}</div>);})}</div></div>
            <div className="p-5 sm:p-7 max-h-[60vh] overflow-y-auto">{renderStep()}</div>
            <div className="flex items-center justify-between border-t border-[#eadfcf] bg-[#f0fdfa]/95 px-5 py-4 backdrop-blur sm:px-7">
              <button type="button" onClick={() => step>1?setStep(step-1):setDraft(null)} className="flex items-center gap-1.5 rounded-xl border border-[#d7c5ae] px-4 py-2.5 text-sm font-semibold text-[#0e4d5c] hover:bg-white"><ChevronLeft className="h-4 w-4" />{step===1?'Cancel':'Back'}</button>
              {step<8?(<button type="button" onClick={() => setStep(step+1)} className="flex items-center gap-1.5 rounded-xl bg-cyan-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-cyan-800">Next<ChevronRight className="h-4 w-4" /></button>
              ):(<button type="button" disabled={busy} onClick={save} className="rounded-xl bg-cyan-700 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-cyan-800 disabled:opacity-60">{busy?'Saving…':'Save Package'}</button>)}
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
    if (sel) setDraft({ ...draft, package_type: value, name: sel.name, inclusions: [...sel.services], deliverables: [...sel.deliverables] });
    else setDraft({ ...draft, package_type: value });
  };
  const selectedType = PACKAGE_TYPES.find(t => t.value === draft.package_type);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#f0fdfa] p-5">
        <h3 className="mb-4 text-base font-bold text-cyan-800">Select Package Type</h3>
        <select className={`${inputClass} text-base py-3`} value={draft.package_type} onChange={e => handleTypeChange(e.target.value)}>
          <option value="">Select Anchor Package Type</option>
          {PACKAGE_TYPES.map(t => <option key={t.value} value={t.value}>{t.name}</option>)}
        </select>
        {selectedType && selectedType.value !== 'Custom Package' && (
          <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50/50 p-3"><p className="text-xs font-semibold text-cyan-700 flex items-center gap-1"><Check className="h-3.5 w-3.5" />Auto-loaded "{selectedType.name}"</p></div>
        )}
      </div>
      <div className="rounded-2xl border border-[#eadfcf] bg-[#f0fdfa] p-5 space-y-4">
        <h3 className="text-base font-bold text-cyan-800">Package Info</h3>
        <label className="block"><span className="text-sm font-semibold text-[#0e4d5c]">Package Name <span className="text-red-500">*</span></span>
          <input className={inputClass} value={draft.name} onChange={e => setDraft({...draft, name: e.target.value})} placeholder="e.g. Premium Wedding Anchor" /></label>
        <label className="block"><span className="text-sm font-semibold text-[#0e4d5c]">Description</span>
          <textarea className={`${inputClass} min-h-[80px] resize-y`} value={draft.description} onChange={e => setDraft({...draft, description: e.target.value})} placeholder="Describe your anchoring package..." /></label>
        <label className="block"><span className="text-sm font-semibold text-[#0e4d5c]">Status</span>
          <select className={inputClass} value={draft.status} onChange={e => setDraft({...draft, status: e.target.value})}><option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option></select></label>
      </div>
      {/* Cover Photo */}
      <div className="rounded-2xl border border-[#eadfcf] bg-[#f0fdfa] p-5">
        <span className="text-sm font-semibold text-[#0e4d5c]">Cover Photo <span className="text-red-500">*</span></span>
        {(draft.cover_file||draft.cover_url) ? (
          <div className="relative rounded-xl overflow-hidden border border-[#eadfcf] bg-stone-50 mt-2"><img src={draft.cover_file?URL.createObjectURL(draft.cover_file):draft.cover_url} alt="Cover" className="w-full h-40 object-cover" /><button type="button" onClick={() => setDraft({...draft, cover_file: null, cover_url: ''})} className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"><X className="h-3.5 w-3.5" /></button></div>
        ) : (
          <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-cyan-300 bg-cyan-50 p-6 hover:border-cyan-600"><Upload className="h-6 w-6 text-cyan-700 mb-2" /><span className="text-sm font-semibold text-[#0e4d5c]">Upload cover photo</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f=e.target.files?.[0]; if(f&&f.size<=5*1024*1024) setDraft({...draft,cover_file:f}); else if(f) toast.error('Max 5MB'); }} /></label>
        )}
      </div>
      {/* Gallery */}
      <div className="rounded-2xl border border-[#eadfcf] bg-[#f0fdfa] p-5">
        <span className="text-sm font-semibold text-[#0e4d5c]">Gallery Photos (max 10)</span>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2">
          {draft.gallery_urls.map((img,i) => (<div key={img.id||i} className="relative rounded-xl overflow-hidden border border-[#eadfcf] aspect-square bg-stone-50"><img src={img.url} alt="" className="w-full h-full object-cover" /><button type="button" onClick={() => setDraft({...draft,gallery_urls:draft.gallery_urls.filter((_,idx)=>idx!==i)})} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white"><X className="h-3 w-3" /></button></div>))}
          {draft.gallery_files.map((f,i) => (<div key={`new-${i}`} className="relative rounded-xl overflow-hidden border border-[#eadfcf] aspect-square bg-stone-50"><img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" /><button type="button" onClick={() => setDraft({...draft,gallery_files:draft.gallery_files.filter((_,idx)=>idx!==i)})} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white"><X className="h-3 w-3" /></button></div>))}
          {(draft.gallery_urls.length+draft.gallery_files.length)<10 && (<label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-cyan-300 bg-cyan-50 aspect-square hover:border-cyan-600"><Plus className="h-5 w-5 text-cyan-700" /><input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={e => { const files=Array.from(e.target.files??[]).filter(f=>f.size<=5*1024*1024).slice(0,10-draft.gallery_urls.length-draft.gallery_files.length); if(files.length) setDraft({...draft,gallery_files:[...draft.gallery_files,...files]}); }} /></label>)}
        </div>
      </div>
      {/* Performance Videos */}
      <div className="rounded-2xl border border-[#eadfcf] bg-[#f0fdfa] p-5">
        <span className="text-sm font-semibold text-[#0e4d5c]">Performance Videos (max 5)</span>
        <p className="text-xs text-stone-500 mb-2">Upload hosting/anchoring videos (MP4/MOV/WEBM, max 100MB)</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {draft.video_urls.map((vid,i) => (<div key={vid.id||i} className="relative rounded-xl overflow-hidden border border-cyan-200 bg-cyan-50 aspect-video"><video src={vid.url} className="w-full h-full object-cover rounded-xl" muted preload="metadata" /><span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white font-bold">VIDEO</span><button type="button" onClick={() => setDraft({...draft,video_urls:draft.video_urls.filter((_,idx)=>idx!==i)})} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"><X className="h-3 w-3" /></button></div>))}
          {draft.video_files.map((f,i) => (<div key={`newv-${i}`} className="relative rounded-xl overflow-hidden border border-cyan-200 bg-cyan-50 aspect-video"><video src={URL.createObjectURL(f)} className="w-full h-full object-cover rounded-xl" muted preload="metadata" /><span className="absolute bottom-1 left-1 rounded bg-cyan-700 px-1.5 py-0.5 text-[9px] text-white font-bold">NEW</span><button type="button" onClick={() => setDraft({...draft,video_files:draft.video_files.filter((_,idx)=>idx!==i)})} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"><X className="h-3 w-3" /></button></div>))}
          {(draft.video_urls.length+draft.video_files.length)<5 && (<label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-cyan-300 bg-cyan-50 aspect-video hover:border-cyan-600"><Upload className="h-5 w-5 text-cyan-700" /><span className="text-[10px] text-stone-500 mt-1">+ Add Video</span><input type="file" accept="video/mp4,video/mov,video/webm,video/quicktime" multiple className="hidden" onChange={e => { const files=Array.from(e.target.files??[]).filter(f=>f.size<=100*1024*1024).slice(0,5-draft.video_urls.length-draft.video_files.length); if(files.length) setDraft({...draft,video_files:[...draft.video_files,...files]}); else if(e.target.files?.length) toast.error('Max 100MB per video'); }} /></label>)}
        </div>
      </div>
    </div>
  );
}

/* ─── Step 2: Pricing ────────────────────────────────────────────────────────── */
function StepPricing({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const price = Number(draft.package_price||0); const advPct = Number(draft.advance_percentage||20);
  const advAmount = Math.round(price * advPct / 100); const remaining = price - advAmount;
  return (
    <div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#f0fdfa] p-5">
      <h3 className="mb-4 text-base font-bold text-cyan-800">Pricing</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="text-sm font-semibold text-[#0e4d5c]">Package Price <span className="text-red-500">*</span></span><div className="relative"><span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span><input className={`${inputClass} pl-7`} type="number" min="0" value={draft.package_price} onChange={e => setDraft({...draft,package_price:e.target.value})} placeholder="Package price" /></div></label>
        <label className="block"><span className="text-sm font-semibold text-[#0e4d5c]">Advance %</span><div className="relative"><span className="absolute right-3.5 top-2.5 text-sm text-stone-500">%</span><input className={`${inputClass} pr-7`} type="number" min="0" max="100" value={draft.advance_percentage} onChange={e => setDraft({...draft,advance_percentage:e.target.value})} placeholder="20" /></div></label>
      </div>
      {price > 0 && (<div className="mt-4 rounded-xl border border-[#eadfcf] bg-[#f7fffe] p-4 space-y-2">
        <div className="flex justify-between text-sm"><span className="text-stone-600">Package Price</span><span className="font-bold text-cyan-700">₹{price.toLocaleString('en-IN')}</span></div>
        <div className="flex justify-between text-sm"><span className="text-stone-600">Advance ({advPct}%)</span><span className="font-semibold text-emerald-700">₹{advAmount.toLocaleString('en-IN')}</span></div>
        <div className="flex justify-between text-sm border-t border-[#eadfcf] pt-2"><span className="text-stone-600">Remaining</span><span className="font-semibold">₹{remaining.toLocaleString('en-IN')}</span></div>
      </div>)}
    </div></div>
  );
}

/* ─── Step 3: Performance Style & Coverage ───────────────────────────────────── */
function StepPerformanceStyle({ draft, setDraft, ChipSelect }: { draft: Draft; setDraft: (d: Draft) => void; ChipSelect: any }) {
  return (<div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#f0fdfa] p-5 space-y-5">
    <h3 className="text-base font-bold text-cyan-800">Performance Style & Coverage</h3>
    <ChipSelect label="Performance / Event Types" options={ALL_EVENT_TYPES} selected={draft.design_styles} onChange={(v: string[]) => setDraft({...draft,design_styles:v})} />
    <ChipSelect label="Coverage" options={ALL_COVERAGE} selected={draft.coverage} onChange={(v: string[]) => setDraft({...draft,coverage:v})} />
  </div></div>);
}

/* ─── Step 4: Inclusions ─────────────────────────────────────────────────────── */
function StepInclusions({ draft, setDraft, ChipSelect }: { draft: Draft; setDraft: (d: Draft) => void; ChipSelect: any }) {
  return (<div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#f0fdfa] p-5 space-y-5"><h3 className="text-base font-bold text-cyan-800">Services Included</h3><ChipSelect label="Inclusions" options={ALL_INCLUSIONS} selected={draft.inclusions} onChange={(v: string[]) => setDraft({...draft,inclusions:v})} /></div></div>);
}

/* ─── Step 5: Team ───────────────────────────────────────────────────────────── */
function StepTeam({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  return (<div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#f0fdfa] p-5 space-y-4">
    <h3 className="text-base font-bold text-cyan-800">Team</h3>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block"><span className="text-sm font-semibold text-[#0e4d5c]">Lead Anchor</span><input className={inputClass} type="number" min="1" value={draft.lead_artist} onChange={e => setDraft({...draft,lead_artist:e.target.value})} placeholder="1" /></label>
      <label className="block"><span className="text-sm font-semibold text-[#0e4d5c]">Assistant Anchors</span><input className={inputClass} type="number" min="0" value={draft.assistant_artists} onChange={e => setDraft({...draft,assistant_artists:e.target.value})} placeholder="0" /></label>
    </div>
  </div></div>);
}

/* ─── Step 6: Deliverables ───────────────────────────────────────────────────── */
function StepDeliverables({ draft, setDraft, ChipSelect }: { draft: Draft; setDraft: (d: Draft) => void; ChipSelect: any }) {
  return (<div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#f0fdfa] p-5 space-y-5"><h3 className="text-base font-bold text-cyan-800">Deliverables</h3><ChipSelect label="What's Included" options={ALL_DELIVERABLES} selected={draft.deliverables} onChange={(v: string[]) => setDraft({...draft,deliverables:v})} /></div></div>);
}

/* ─── Step 7: Add-ons ────────────────────────────────────────────────────────── */
function StepAddons({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const addAddon = (name?: string) => { setDraft({...draft,addons:[...draft.addons,{name:name||'',price:'',description:''}]}); };
  const removeAddon = (i: number) => { setDraft({...draft,addons:draft.addons.filter((_,idx)=>idx!==i)}); };
  const updateAddon = (i: number, field: keyof Addon, value: string) => { const a=[...draft.addons]; a[i]={...a[i],[field]:value}; setDraft({...draft,addons:a}); };
  const addFromTemplate = (t: string) => { if (!draft.addons.some(a => a.name.toLowerCase()===t.toLowerCase())) addAddon(t); else toast.info(`Already added`); };
  return (
    <div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#f0fdfa] p-5">
      <div className="flex items-center justify-between mb-4"><div><h3 className="text-base font-bold text-cyan-800">Add-ons</h3></div><button type="button" onClick={() => addAddon()} className="rounded-lg bg-cyan-700/10 px-3 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-700/20"><Plus className="mr-1 inline h-3 w-3" />Custom</button></div>
      <div className="mb-4"><span className="text-xs font-semibold text-[#0e4d5c] mb-2 block">Quick Add:</span><div className="flex flex-wrap gap-1.5">{ADDON_TEMPLATES.map(t => (<button key={t} type="button" onClick={() => addFromTemplate(t)} className="rounded-full border border-[#e7d9c4] bg-white px-2.5 py-1 text-[11px] font-medium text-stone-600 hover:border-cyan-600 hover:bg-cyan-50 hover:text-cyan-700">+ {t}</button>))}</div></div>
      {draft.addons.length===0?(<p className="text-center text-sm text-stone-400 py-4">No add-ons yet.</p>):(<div className="space-y-2">{draft.addons.map((addon,i) => (<div key={i} className="grid grid-cols-[1fr_90px_1fr_32px] gap-2 items-center"><input className={inputClass} value={addon.name} onChange={e => updateAddon(i,'name',e.target.value)} placeholder="Name" /><div className="relative"><span className="absolute left-2.5 top-2.5 text-xs text-stone-400">₹</span><input className={`${inputClass} pl-6`} type="number" value={addon.price} onChange={e => updateAddon(i,'price',e.target.value)} placeholder="0" /></div><input className={inputClass} value={addon.description} onChange={e => updateAddon(i,'description',e.target.value)} placeholder="Description" /><button type="button" onClick={() => removeAddon(i)} className="flex h-9 w-9 items-center justify-center rounded-lg text-red-400 hover:bg-red-50"><X className="h-4 w-4" /></button></div>))}</div>)}
    </div></div>
  );
}

/* ─── Step 8: Preview ────────────────────────────────────────────────────────── */
function StepPreview({ draft }: { draft: Draft }) {
  const price = Number(draft.package_price||0); const advPct = Number(draft.advance_percentage||20);
  const advAmount = Math.round(price * advPct / 100); const remaining = price - advAmount;
  return (
    <div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#f0fdfa] p-5">
      <h3 className="mb-4 text-base font-bold text-cyan-800">Preview</h3>
      <div className="overflow-hidden rounded-2xl border border-[#eadfcf] bg-white shadow-sm">
        {draft.cover_file||draft.cover_url?(<div className="h-36 overflow-hidden"><img src={draft.cover_file?URL.createObjectURL(draft.cover_file):draft.cover_url} alt="Cover" className="w-full h-full object-cover" /></div>):(<div className="flex h-36 items-center justify-center bg-gradient-to-br from-cyan-50 to-teal-50"><Mic2 className="h-8 w-8 text-cyan-700/40" /></div>)}
        <div className="p-5">
          <div className="flex items-start justify-between"><h4 className="text-lg font-bold text-[#0e4d5c]">{draft.name||'Package Name'}</h4><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${draft.status==='active'?'bg-cyan-100 text-cyan-700':'bg-blue-50 text-blue-700'}`}>{draft.status}</span></div>
          {draft.package_type && <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-cyan-100 px-2.5 py-0.5 text-[11px] font-medium text-cyan-800"><Mic2 className="h-3 w-3" />{draft.package_type}</span>}
          {draft.description && <p className="mt-2 text-sm text-stone-500 line-clamp-2">{draft.description}</p>}
          {price > 0 && (<div className="mt-3"><p className="text-2xl font-bold text-cyan-700">₹{price.toLocaleString('en-IN')}</p><p className="text-xs text-stone-500">Advance: {advPct}% (₹{advAmount.toLocaleString('en-IN')}) · Remaining: ₹{remaining.toLocaleString('en-IN')}</p></div>)}
          {draft.design_styles.length>0 && (<div className="mt-3 border-t border-stone-100 pt-3"><p className="text-xs font-semibold text-stone-600 mb-1.5">Event Types:</p><div className="flex flex-wrap gap-1">{draft.design_styles.map(s => <span key={s} className="rounded-full bg-cyan-700/8 px-2 py-0.5 text-[11px] text-cyan-700">{s}</span>)}</div></div>)}
          {draft.coverage.length>0 && (<div className="mt-3 border-t border-stone-100 pt-3"><p className="text-xs font-semibold text-stone-600 mb-1.5">Coverage:</p><div className="flex flex-wrap gap-1">{draft.coverage.map(c => <span key={c} className="rounded-full bg-teal-50 border border-teal-200 px-2 py-0.5 text-[11px] text-teal-800">{c}</span>)}</div></div>)}
          {draft.inclusions.length>0 && (<div className="mt-3 border-t border-stone-100 pt-3"><p className="text-xs font-semibold text-stone-600 mb-1.5">Inclusions:</p><div className="flex flex-wrap gap-1">{draft.inclusions.map(i => <span key={i} className="rounded-full border border-cyan-200 px-2 py-0.5 text-[11px] text-cyan-800">{i}</span>)}</div></div>)}
          {draft.deliverables.length>0 && (<div className="mt-3 border-t border-stone-100 pt-3"><p className="text-xs font-semibold text-stone-600 mb-1.5">Deliverables:</p><div className="flex flex-wrap gap-1">{draft.deliverables.map(d => <span key={d} className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] text-emerald-800">{d}</span>)}</div></div>)}
          <div className="mt-3 border-t border-stone-100 pt-3 flex gap-4 text-[11px] text-stone-500">
            {Number(draft.lead_artist)>0 && <span>Lead: {draft.lead_artist}</span>}
            {Number(draft.assistant_artists)>0 && <span>Assistants: {draft.assistant_artists}</span>}
          </div>
          {draft.addons.filter(a=>a.name.trim()).length>0 && (<div className="mt-3 border-t border-stone-100 pt-3"><p className="text-xs font-semibold text-stone-600 mb-1.5">Add-ons:</p>{draft.addons.filter(a=>a.name.trim()).map((a,i) => (<div key={i} className="flex justify-between text-xs mt-1"><span className="text-stone-700">{a.name}</span>{a.price&&<span className="font-semibold text-cyan-800">+₹{Number(a.price).toLocaleString('en-IN')}</span>}</div>))}</div>)}
        </div>
      </div>
    </div></div>
  );
}
