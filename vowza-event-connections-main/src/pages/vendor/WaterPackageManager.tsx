import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, Eye, EyeOff, X, Check,
  ChevronRight, ChevronLeft, Upload, Droplets, ChevronDown,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/* ─── Constants ─────────────────────────────────────────────────────────────── */
const PACKAGE_TYPES = [
  { value: 'Cool Water', name: 'Cool Water', features: ['Cold Water','Clean Tank','On Time Delivery','Sanitized Equipment'], details: { quantity: '', can_bottle_size: '', cooling_capacity: '', cooling_unit_available: false } },
  { value: 'RO Water', name: 'RO Water', features: ['RO Purified','Clean Tank','On Time Delivery','Sanitized Equipment'], details: { quantity: '', container_size: '', ro_purification_details: '' } },
  { value: 'Mineral Water', name: 'Mineral Water', features: ['Mineral Water','Food Grade Tank','On Time Delivery','Sealed Packaging'], details: { quantity: '', bottle_can_size: '', brand_source: '' } },
  { value: 'Water Tankers', name: 'Water Tankers', features: ['Clean Tank','Food Grade Tank','On Time Delivery','Leak Proof'], details: { tanker_capacity: '', number_of_tankers: '', water_type: '', delivery_method: '' } },
];

const ALL_FEATURES = ['RO Purified','Mineral Water','Cold Water','Normal Water','Food Grade Tank','Leak Proof','Clean Tank','Sanitized Equipment','On Time Delivery','24x7 Service','Emergency Supply'];
const PRICING_TYPE_OPTIONS = [
  { value: 'per_can', label: 'Per Can' },
  { value: 'per_bottle', label: 'Per Bottle' },
  { value: 'per_tanker', label: 'Per Tanker' },
  { value: 'per_delivery', label: 'Per Delivery' },
];
const VEHICLE_OPTIONS = ['Mini Truck','Water Tanker','Pickup','Tempo'];
const ADDON_TEMPLATES = ['Extra Water Cans','Extra Bottles','Additional Tankers','Water Dispenser','Stand','Cooling Unit','Ice Box','Emergency Delivery','Technician'];
const STEP_LABELS = ['Package Type','Pricing','Supply Details','Features','Availability','Equipment & Delivery','Add-ons','Preview'];

const inputClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition placeholder:text-stone-400 focus:border-[#0284c7] focus:ring-2 focus:ring-[#0284c7]/15';

/* ─── Types ─────────────────────────────────────────────────────────────────── */
type Addon = { name: string; price: string; description: string };
type Draft = {
  id?: string; name: string; description: string; package_type: string; status: string;
  pricing_type: string; base_price: string; advance_percentage: string;
  transportation_charges: string; outside_city_charges: string;
  night_delivery_charges: string; emergency_delivery_charges: string;
  additional_tank_charges: string; discount_percentage: string;
  supply_details: Record<string, any>; supply_features: string[];
  available_cities: string[]; delivery_radius: string;
  available_time_slots: string[]; max_deliveries_per_day: string; fleet_capacity: string;
  vehicle_type: string; delivery_team_size: string; delivery_time: string;
  installation_included: boolean; water_dispenser_available: boolean;
  stand_included: boolean; cooling_unit_available: boolean;
  addons: Addon[];
  cover_file: File | null; cover_url: string;
  gallery_files: File[]; gallery_urls: { id: string; url: string; is_cover: boolean }[];
  video_files: File[]; video_urls: { id: string; url: string }[];
};

const blank = (): Draft => ({
  name: '', description: '', package_type: '', status: 'draft',
  pricing_type: 'per_can', base_price: '', advance_percentage: '20',
  transportation_charges: '', outside_city_charges: '',
  night_delivery_charges: '', emergency_delivery_charges: '',
  additional_tank_charges: '', discount_percentage: '0',
  supply_details: {}, supply_features: [],
  available_cities: [], delivery_radius: '',
  available_time_slots: [], max_deliveries_per_day: '10', fleet_capacity: '',
  vehicle_type: '', delivery_team_size: '', delivery_time: '',
  installation_included: false, water_dispenser_available: false,
  stand_included: false, cooling_unit_available: false,
  addons: [],
  cover_file: null, cover_url: '', gallery_files: [], gallery_urls: [],
  video_files: [], video_urls: [],
});

/* ─── Main Component ────────────────────────────────────────────────────────── */
export default function WaterPackageManager({ provider }: { provider: any }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['water-packages', provider.id],
    queryFn: async () => { const r = await (supabase.from('water_packages' as any).select('*').eq('provider_id', provider.id).order('created_at', { ascending: false })); if (r.error) throw r.error; return r.data ?? []; },
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['water-packages', provider.id] });
  useEffect(() => { const ch = supabase.channel(`water-packages-${provider.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'water_packages', filter: `provider_id=eq.${provider.id}` }, refresh).subscribe(); return () => { supabase.removeChannel(ch); }; }, [provider.id]);

  const edit = async (pkg: any) => {
    let addons: Addon[] = []; let galleryUrls: { id: string; url: string; is_cover: boolean }[] = []; let videoUrls: { id: string; url: string }[] = []; let coverUrl = '';
    try { const r = await (supabase.from('water_addons' as any).select('name, price, description').eq('package_id', pkg.id).order('sort_order')); if (r.data) addons = r.data.map((a: any) => ({ name: a.name, price: String(a.price??''), description: a.description||'' })); } catch (_) {}
    try { const r = await (supabase.from('water_gallery' as any).select('id, public_url, is_cover, sort_order, media_type').eq('package_id', pkg.id).order('sort_order')); const g = (r.data??[]).map((x: any) => ({ id: x.id, url: x.public_url, is_cover: x.is_cover, media_type: x.media_type||'image' })); coverUrl = g.find((x: any) => x.is_cover)?.url||''; galleryUrls = g.filter((x: any) => !x.is_cover && x.media_type==='image'); videoUrls = g.filter((x: any) => x.media_type==='video').map((x: any) => ({ id: x.id, url: x.url })); } catch (_) {}
    setDraft({ id: pkg.id, name: pkg.name||'', description: pkg.description||'', package_type: pkg.package_type||'', status: pkg.status||'draft',
      pricing_type: pkg.pricing_type||'per_can', base_price: String(pkg.base_price??''), advance_percentage: String(pkg.advance_percentage??'20'),
      transportation_charges: String(pkg.transportation_charges??''), outside_city_charges: String(pkg.outside_city_charges??''),
      night_delivery_charges: String(pkg.night_delivery_charges??''), emergency_delivery_charges: String(pkg.emergency_delivery_charges??''),
      additional_tank_charges: String(pkg.additional_tank_charges??''), discount_percentage: String(pkg.discount_percentage??'0'),
      supply_details: pkg.supply_details??{}, supply_features: pkg.supply_features??[],
      available_cities: pkg.available_cities??[], delivery_radius: pkg.delivery_radius||'',
      available_time_slots: pkg.available_time_slots??[], max_deliveries_per_day: String(pkg.max_deliveries_per_day??'10'), fleet_capacity: pkg.fleet_capacity||'',
      vehicle_type: pkg.vehicle_type||'', delivery_team_size: pkg.delivery_team_size||'', delivery_time: pkg.delivery_time||'',
      installation_included: pkg.installation_included??false, water_dispenser_available: pkg.water_dispenser_available??false,
      stand_included: pkg.stand_included??false, cooling_unit_available: pkg.cooling_unit_available??false,
      addons, cover_file: null, cover_url: coverUrl, gallery_files: [], gallery_urls: galleryUrls,
      video_files: [], video_urls: videoUrls });
    setStep(1);
  };

  const save = async () => {
    if (!draft || !draft.name.trim()) { toast.error('Package name is required.'); setStep(1); return; }
    if (!draft.base_price) { toast.error('Base price is required.'); setStep(2); return; }
    if (!draft.cover_file && !draft.cover_url) { toast.error('Cover photo is required.'); setStep(1); return; }
    setBusy(true);
    try {
      const payload: any = {
        provider_id: provider.id, name: draft.name.trim(), package_type: draft.package_type||null,
        description: draft.description.trim()||null, status: draft.status, pricing_type: draft.pricing_type,
        base_price: Number(draft.base_price), advance_percentage: draft.advance_percentage ? Number(draft.advance_percentage) : 20,
        transportation_charges: draft.transportation_charges ? Number(draft.transportation_charges) : 0,
        outside_city_charges: draft.outside_city_charges ? Number(draft.outside_city_charges) : 0,
        night_delivery_charges: draft.night_delivery_charges ? Number(draft.night_delivery_charges) : 0,
        emergency_delivery_charges: draft.emergency_delivery_charges ? Number(draft.emergency_delivery_charges) : 0,
        additional_tank_charges: draft.additional_tank_charges ? Number(draft.additional_tank_charges) : 0,
        discount_percentage: draft.discount_percentage ? Number(draft.discount_percentage) : 0,
        supply_details: draft.supply_details, supply_features: draft.supply_features,
        available_cities: draft.available_cities, delivery_radius: draft.delivery_radius||null,
        available_time_slots: draft.available_time_slots, max_deliveries_per_day: Number(draft.max_deliveries_per_day)||10,
        fleet_capacity: draft.fleet_capacity||null, vehicle_type: draft.vehicle_type||null,
        delivery_team_size: draft.delivery_team_size||null, delivery_time: draft.delivery_time||null,
        installation_included: draft.installation_included, water_dispenser_available: draft.water_dispenser_available,
        stand_included: draft.stand_included, cooling_unit_available: draft.cooling_unit_available,
      };
      let packageId = draft.id;
      if (draft.id) { const r = await (supabase.from('water_packages' as any).update(payload).eq('id', draft.id).select('id').single()); if (r.error) throw r.error; }
      else { const r = await (supabase.from('water_packages' as any).insert(payload).select('id').single()); if (r.error) throw r.error; packageId = r.data.id; }
      if (packageId) {
        await (supabase.from('water_addons' as any).delete().eq('package_id', packageId));
        const valid = draft.addons.filter(a => a.name.trim());
        if (valid.length > 0) await (supabase.from('water_addons' as any).insert(valid.map((a, i) => ({ package_id: packageId, name: a.name.trim(), price: Number(a.price)||0, description: a.description||null, sort_order: i }))));
        if (draft.cover_file) { const ext = draft.cover_file.name.split('.').pop(); const path = `${user!.id}/${packageId}/cover-${crypto.randomUUID()}.${ext}`; const { error: upErr } = await supabase.storage.from('water-media').upload(path, draft.cover_file, { contentType: draft.cover_file.type }); if (!upErr) { const url = supabase.storage.from('water-media').getPublicUrl(path).data.publicUrl; await (supabase.from('water_gallery' as any).delete().eq('package_id', packageId).eq('is_cover', true)); await (supabase.from('water_gallery' as any).insert({ package_id: packageId, storage_path: path, public_url: url, is_cover: true, sort_order: 0 })); } }
        if (draft.gallery_files.length > 0) { for (let i = 0; i < draft.gallery_files.length; i++) { const file = draft.gallery_files[i]; const ext = file.name.split('.').pop(); const path = `${user!.id}/${packageId}/gallery-${crypto.randomUUID()}.${ext}`; const { error: upErr } = await supabase.storage.from('water-media').upload(path, file, { contentType: file.type }); if (!upErr) { const url = supabase.storage.from('water-media').getPublicUrl(path).data.publicUrl; await (supabase.from('water_gallery' as any).insert({ package_id: packageId, storage_path: path, public_url: url, is_cover: false, media_type: 'image', sort_order: draft.gallery_urls.length + i + 1 })); } } }
        if (draft.video_files.length > 0) { for (let i = 0; i < draft.video_files.length; i++) { const file = draft.video_files[i]; const ext = file.name.split('.').pop(); const path = `${user!.id}/${packageId}/video-${crypto.randomUUID()}.${ext}`; const { error: upErr } = await supabase.storage.from('water-media').upload(path, file, { contentType: file.type }); if (!upErr) { const url = supabase.storage.from('water-media').getPublicUrl(path).data.publicUrl; await (supabase.from('water_gallery' as any).insert({ package_id: packageId, storage_path: path, public_url: url, is_cover: false, media_type: 'video', sort_order: 100 + i })); } } }
        if (draft.id) { const cur = [...draft.gallery_urls.map(g => g.id), ...draft.video_urls.map(v => v.id)].filter(Boolean); const { data: ex } = await (supabase.from('water_gallery' as any).select('id').eq('package_id', packageId).eq('is_cover', false)); const del = (ex??[]).map((e: any) => e.id).filter((id: string) => !cur.includes(id)); if (del.length > 0) await (supabase.from('water_gallery' as any).delete().in('id', del)); }
      }
      toast.success('Water package saved!'); setDraft(null); setStep(1); refresh();
    } catch (err: any) { toast.error(err.message || 'Could not save'); } finally { setBusy(false); }
  };

  const toggleStatus = async (pkg: any) => { await (supabase.from('water_packages' as any).update({ status: pkg.status === 'active' ? 'draft' : 'active' }).eq('id', pkg.id)); refresh(); };
  const remove = async (pkg: any) => { if (!confirm('Delete this package?')) return; await (supabase.from('water_packages' as any).delete().eq('id', pkg.id)); refresh(); toast.success('Deleted'); };
  const openNew = () => { setDraft(blank()); setStep(1); };

  const ChipSelect = ({ options, selected, onChange, label }: { options: string[]; selected: string[]; onChange: (v: string[]) => void; label: string }) => (
    <div><span className="text-sm font-semibold text-[#0c4a6e]">{label}</span><div className="mt-1.5 flex flex-wrap gap-2">{options.map(opt => (
      <button key={opt} type="button" onClick={() => onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt])}
        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${selected.includes(opt) ? 'border-sky-600 bg-sky-600/10 text-sky-700' : 'border-[#e7d9c4] text-stone-600 hover:border-sky-500'}`}>{opt}</button>
    ))}</div></div>
  );

  const renderStep = () => { if (!draft) return null; switch(step) {
    case 1: return <StepPackageType draft={draft} setDraft={setDraft} />;
    case 2: return <StepPricing draft={draft} setDraft={setDraft} />;
    case 3: return <StepSupplyDetails draft={draft} setDraft={setDraft} />;
    case 4: return <StepFeatures draft={draft} setDraft={setDraft} ChipSelect={ChipSelect} />;
    case 5: return <StepAvailability draft={draft} setDraft={setDraft} />;
    case 6: return <StepEquipment draft={draft} setDraft={setDraft} />;
    case 7: return <StepAddons draft={draft} setDraft={setDraft} />;
    case 8: return <StepPreview draft={draft} />;
    default: return null;
  }};

  return (
    <div className="max-w-[1200px] space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div><h1 className="text-xl font-bold text-[#0c4a6e]">Water Supply Packages</h1><p className="text-sm text-muted-foreground">Create and manage your water supply packages.</p></div>
        <button onClick={openNew} className="rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800"><Plus className="mr-1 inline h-4 w-4" />Add Package</button>
      </div>
      {isLoading ? (<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[1,2,3].map(i => <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : packages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#eadfcf] py-16 text-center">
          <Droplets className="h-12 w-12 text-sky-700/30" /><p className="mt-3 font-semibold text-[#0c4a6e]">No packages yet</p>
          <button onClick={openNew} className="mt-4 rounded-xl bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white"><Plus className="mr-1 inline h-4 w-4" />Add Package</button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{packages.map((pkg: any) => (
          <div key={pkg.id} className="overflow-hidden rounded-2xl border border-[#eadfcf] bg-[#f0f9ff] shadow-sm transition hover:shadow-md">
            <div className="flex h-28 items-center justify-center bg-gradient-to-br from-sky-50 to-cyan-50"><Droplets className="h-10 w-10 text-sky-700/40" /></div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2"><h2 className="font-bold text-[#0c4a6e] leading-tight">{pkg.name}</h2>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${pkg.status==='active'?'bg-sky-100 text-sky-700':pkg.status==='paused'?'bg-amber-100 text-amber-700':'bg-blue-50 text-blue-700'}`}>{pkg.status}</span></div>
              {pkg.base_price && <p className="mt-1.5 text-lg font-bold text-sky-700">₹{Number(pkg.base_price).toLocaleString('en-IN')}<span className="text-xs font-normal text-stone-500 ml-1">/{pkg.pricing_type?.replace('per_','').replace('custom_quote','quote')}</span></p>}
              {pkg.package_type && <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1"><Droplets className="h-3.5 w-3.5" />{pkg.package_type}</div>}
              <div className="mt-4 flex gap-2">
                <button onClick={() => edit(pkg)} className="flex-1 rounded-lg border border-[#e7d9c4] py-2 text-xs font-medium text-[#0c4a6e] hover:bg-[#f0f9ff]"><Pencil className="mr-1 inline h-3 w-3" />Edit</button>
                <button onClick={() => toggleStatus(pkg)} className="rounded-lg border border-[#e7d9c4] p-2 hover:bg-[#f0f9ff]">{pkg.status==='active'?<EyeOff className="h-3.5 w-3.5 text-stone-600" />:<Eye className="h-3.5 w-3.5 text-stone-600" />}</button>
                <button onClick={() => remove(pkg)} className="rounded-lg border border-red-200 p-2 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5 text-red-600" /></button>
              </div>
            </div>
          </div>
        ))}</div>
      )}
      {draft && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#0c4a6e]/65 p-3 backdrop-blur-sm sm:p-6">
          <div className="mx-auto my-3 max-w-3xl overflow-hidden rounded-[24px] bg-[#fefffe] shadow-2xl">
            <header className="flex items-start justify-between gap-4 bg-sky-800 px-5 py-5 sm:px-7"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-200">Vowza Water Supply</p><h2 className="mt-1 text-lg font-bold text-white">{draft.id?'Edit Package':'Add New Package'}</h2></div><button onClick={() => {setDraft(null);setStep(1);}} className="rounded-full p-2 text-white/85 hover:bg-white/15"><X className="h-5 w-5" /></button></header>
            <div className="border-b border-[#eadfcf] bg-[#f0f9ff] px-3 py-4 sm:px-7"><div className="grid" style={{ gridTemplateColumns: `repeat(8, minmax(0, 1fr))` }}>{STEP_LABELS.map((label, i) => { const sn=i+1; const done=step>sn; const cur=step===sn; return (<div key={i} className="flex flex-col items-center relative"><div className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full text-[10px] sm:text-xs font-bold transition-colors z-10 ${done?'bg-sky-500 text-white':cur?'bg-sky-700 text-white shadow-md shadow-sky-700/30':'border-2 border-[#e7d9c4] text-stone-400 bg-white'}`}>{done?<Check className="h-3.5 w-3.5" />:sn}</div><span className={`mt-1 hidden sm:block text-[9px] font-medium text-center leading-tight ${cur?'text-sky-700':done?'text-sky-600':'text-stone-400'}`}>{label}</span>{i<7&&<div className={`absolute top-[14px] left-[calc(50%+14px)] sm:left-[calc(50%+16px)] h-0.5 rounded ${done?'bg-sky-400':'bg-[#e7d9c4]'}`} style={{ width: 'calc(100% - 28px)' }} />}</div>);})}</div></div>
            <div className="p-5 sm:p-7 max-h-[60vh] overflow-y-auto">{renderStep()}</div>
            <div className="flex items-center justify-between border-t border-[#eadfcf] bg-[#f0f9ff]/95 px-5 py-4 backdrop-blur sm:px-7">
              <button type="button" onClick={() => step>1?setStep(step-1):setDraft(null)} className="flex items-center gap-1.5 rounded-xl border border-[#d7c5ae] px-4 py-2.5 text-sm font-semibold text-[#0c4a6e] hover:bg-white"><ChevronLeft className="h-4 w-4" />{step===1?'Cancel':'Back'}</button>
              {step<8?(<button type="button" onClick={() => setStep(step+1)} className="flex items-center gap-1.5 rounded-xl bg-sky-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-sky-800">Next<ChevronRight className="h-4 w-4" /></button>
              ):(<button type="button" disabled={busy} onClick={save} className="rounded-xl bg-sky-700 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-sky-800 disabled:opacity-60">{busy?'Saving…':'Save Package'}</button>)}
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
    if (sel) setDraft({ ...draft, package_type: value, name: sel.name, supply_features: [...sel.features], supply_details: { ...sel.details } });
    else setDraft({ ...draft, package_type: value });
  };
  const selectedType = PACKAGE_TYPES.find(t => t.value === draft.package_type);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#f0f9ff] p-5">
        <h3 className="mb-4 text-base font-bold text-sky-800">Select Package Type</h3>
        <select className={`${inputClass} text-base py-3`} value={draft.package_type} onChange={e => handleTypeChange(e.target.value)}>
          <option value="">Select Water Package Type</option>
          {PACKAGE_TYPES.map(t => <option key={t.value} value={t.value}>{t.name}</option>)}
        </select>
        {selectedType && selectedType.value !== 'Custom Package' && (
          <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/50 p-3"><p className="text-xs font-semibold text-sky-700 flex items-center gap-1"><Check className="h-3.5 w-3.5" />Auto-loaded "{selectedType.name}"</p></div>
        )}
      </div>
      <div className="rounded-2xl border border-[#eadfcf] bg-[#f0f9ff] p-5 space-y-4">
        <h3 className="text-base font-bold text-sky-800">Package Info</h3>
        <label className="block"><span className="text-sm font-semibold text-[#0c4a6e]">Package Name <span className="text-red-500">*</span></span>
          <input className={inputClass} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Premium RO Water Supply" /></label>
        <label className="block"><span className="text-sm font-semibold text-[#0c4a6e]">Description</span>
          <textarea className={`${inputClass} min-h-[80px] resize-y`} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="Describe your water supply service..." /></label>
        <label className="block"><span className="text-sm font-semibold text-[#0c4a6e]">Status</span>
          <select className={inputClass} value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}><option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option></select></label>
      </div>
      {/* Cover */}
      <div className="rounded-2xl border border-[#eadfcf] bg-[#f0f9ff] p-5">
        <span className="text-sm font-semibold text-[#0c4a6e]">Cover Photo <span className="text-red-500">*</span></span>
        {(draft.cover_file||draft.cover_url) ? (
          <div className="relative rounded-xl overflow-hidden border border-[#eadfcf] bg-stone-50 mt-2"><img src={draft.cover_file?URL.createObjectURL(draft.cover_file):draft.cover_url} alt="Cover" className="w-full h-40 object-cover" /><button type="button" onClick={() => setDraft({ ...draft, cover_file: null, cover_url: '' })} className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"><X className="h-3.5 w-3.5" /></button></div>
        ) : (
          <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-sky-300 bg-sky-50 p-6 hover:border-sky-600"><Upload className="h-6 w-6 text-sky-700 mb-2" /><span className="text-sm font-semibold text-[#0c4a6e]">Upload cover photo</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f=e.target.files?.[0]; if (f&&f.size<=5*1024*1024) setDraft({...draft,cover_file:f}); else if(f) toast.error('Max 5MB'); }} /></label>
        )}
      </div>
      {/* Gallery */}
      <div className="rounded-2xl border border-[#eadfcf] bg-[#f0f9ff] p-5">
        <span className="text-sm font-semibold text-[#0c4a6e]">Gallery (max 30)</span>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2">
          {draft.gallery_urls.map((img,i) => (<div key={img.id||i} className="relative rounded-xl overflow-hidden border border-[#eadfcf] aspect-square bg-stone-50"><img src={img.url} alt="" className="w-full h-full object-cover" /><button type="button" onClick={() => setDraft({...draft,gallery_urls:draft.gallery_urls.filter((_,idx)=>idx!==i)})} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white"><X className="h-3 w-3" /></button></div>))}
          {draft.gallery_files.map((f,i) => (<div key={`new-${i}`} className="relative rounded-xl overflow-hidden border border-[#eadfcf] aspect-square bg-stone-50"><img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" /><button type="button" onClick={() => setDraft({...draft,gallery_files:draft.gallery_files.filter((_,idx)=>idx!==i)})} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white"><X className="h-3 w-3" /></button></div>))}
          {(draft.gallery_urls.length+draft.gallery_files.length)<30 && (<label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-sky-300 bg-sky-50 aspect-square hover:border-sky-600"><Plus className="h-5 w-5 text-sky-700" /><input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={e => { const files=Array.from(e.target.files??[]).filter(f=>f.size<=5*1024*1024).slice(0,30-draft.gallery_urls.length-draft.gallery_files.length); if(files.length) setDraft({...draft,gallery_files:[...draft.gallery_files,...files]}); }} /></label>)}
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
      <div className="rounded-2xl border border-[#eadfcf] bg-[#f0f9ff] p-5">
        <h3 className="mb-4 text-base font-bold text-sky-800">Pricing</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="text-sm font-semibold text-[#0c4a6e]">Pricing Type <span className="text-red-500">*</span></span>
            <select className={inputClass} value={draft.pricing_type} onChange={e => setDraft({...draft,pricing_type:e.target.value})}>{PRICING_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
          <label className="block"><span className="text-sm font-semibold text-[#0c4a6e]">Base Price <span className="text-red-500">*</span></span>
            <div className="relative"><span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span><input className={`${inputClass} pl-7`} type="number" min="0" value={draft.base_price} onChange={e => setDraft({...draft,base_price:e.target.value})} placeholder="Price" /></div></label>
          <label className="block"><span className="text-sm font-semibold text-[#0c4a6e]">Advance %</span>
            <div className="relative"><span className="absolute right-3.5 top-2.5 text-sm text-stone-500">%</span><input className={`${inputClass} pr-7`} type="number" min="0" max="100" value={draft.advance_percentage} onChange={e => setDraft({...draft,advance_percentage:e.target.value})} placeholder="20" /></div></label>
          <label className="block"><span className="text-sm font-semibold text-[#0c4a6e]">Discount</span>
            <div className="relative"><span className="absolute right-3.5 top-2.5 text-sm text-stone-500">%</span><input className={`${inputClass} pr-7`} type="number" min="0" max="100" value={draft.discount_percentage} onChange={e => setDraft({...draft,discount_percentage:e.target.value})} placeholder="0" /></div></label>
        </div>
      </div>
      <div className="rounded-2xl border border-[#eadfcf] bg-[#f0f9ff] p-5">
        <button type="button" onClick={() => setShowAdditional(!showAdditional)} className="flex w-full items-center justify-between text-left"><div><h3 className="text-base font-bold text-sky-800">Additional Charges</h3></div><ChevronDown className={`h-5 w-5 text-stone-400 transition ${showAdditional?'rotate-180':''}`} /></button>
        {showAdditional && (<div className="mt-4 grid gap-4 sm:grid-cols-2 border-t border-[#eadfcf] pt-4">
          {[{key:'transportation_charges',label:'Transportation'},{key:'outside_city_charges',label:'Outside City'},{key:'night_delivery_charges',label:'Night Delivery'},{key:'emergency_delivery_charges',label:'Emergency Delivery'},{key:'additional_tank_charges',label:'Additional Tank'}].map(({key,label}) => (
            <label key={key} className="block"><span className="text-sm font-semibold text-[#0c4a6e]">{label}</span><div className="relative"><span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span><input className={`${inputClass} pl-7`} type="number" min="0" value={(draft as any)[key]} onChange={e => setDraft({...draft,[key]:e.target.value})} placeholder="0" /></div></label>
          ))}
        </div>)}
      </div>
    </div>
  );
}


/* ─── Step 3: Supply Details (Dynamic) ───────────────────────────────────────── */
function StepSupplyDetails({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const updateDetail = (key: string, value: any) => setDraft({ ...draft, supply_details: { ...draft.supply_details, [key]: value } });
  const d = draft.supply_details;
  const keys = Object.keys(d);
  return (
    <div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#f0f9ff] p-5 space-y-4">
      <h3 className="text-base font-bold text-sky-800">Supply Details — {draft.package_type || 'Custom'}</h3>
      {keys.length > 0 ? (<div className="grid gap-3 sm:grid-cols-2">{keys.map(k => {
        const val = d[k];
        if (typeof val === 'boolean') return (
          <label key={k} className="flex items-center gap-3 rounded-xl border border-[#eadfcf] p-3 cursor-pointer"><input type="checkbox" checked={val} onChange={e => updateDetail(k, e.target.checked)} className="h-4 w-4 rounded border-[#e7d9c4] text-sky-700" /><span className="text-sm font-semibold text-[#0c4a6e] capitalize">{k.replace(/_/g,' ')}</span></label>
        );
        return (<label key={k} className="block"><span className="text-sm font-semibold text-[#0c4a6e] capitalize">{k.replace(/_/g,' ')}</span><input className={inputClass} value={val||''} onChange={e => updateDetail(k,e.target.value)} placeholder="Quantity / details" /></label>);
      })}</div>) : (<p className="text-sm text-stone-500">Select a package type in Step 1 to see specific fields.</p>)}
    </div></div>
  );
}

/* ─── Step 4: Features ───────────────────────────────────────────────────────── */
function StepFeatures({ draft, setDraft, ChipSelect }: { draft: Draft; setDraft: (d: Draft) => void; ChipSelect: any }) {
  return (<div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#f0f9ff] p-5 space-y-5"><h3 className="text-base font-bold text-sky-800">Supply Features</h3><ChipSelect label="Features" options={ALL_FEATURES} selected={draft.supply_features} onChange={(v: string[]) => setDraft({...draft,supply_features:v})} /></div></div>);
}

/* ─── Step 5: Availability ───────────────────────────────────────────────────── */
function StepAvailability({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const [cityInput, setCityInput] = useState('');
  const [slotInput, setSlotInput] = useState('');
  const addCity = () => { if (cityInput.trim() && !draft.available_cities.includes(cityInput.trim())) { setDraft({...draft,available_cities:[...draft.available_cities,cityInput.trim()]}); setCityInput(''); } };
  const addSlot = () => { if (slotInput.trim() && !draft.available_time_slots.includes(slotInput.trim())) { setDraft({...draft,available_time_slots:[...draft.available_time_slots,slotInput.trim()]}); setSlotInput(''); } };
  return (
    <div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#f0f9ff] p-5 space-y-4">
      <h3 className="text-base font-bold text-sky-800">Availability</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="text-sm font-semibold text-[#0c4a6e]">Delivery Radius</span><input className={inputClass} value={draft.delivery_radius} onChange={e => setDraft({...draft,delivery_radius:e.target.value})} placeholder="e.g. 30 km" /></label>
        <label className="block"><span className="text-sm font-semibold text-[#0c4a6e]">Max Deliveries/Day</span><input className={inputClass} type="number" min="1" value={draft.max_deliveries_per_day} onChange={e => setDraft({...draft,max_deliveries_per_day:e.target.value})} placeholder="10" /></label>
        <label className="block"><span className="text-sm font-semibold text-[#0c4a6e]">Fleet Capacity</span><input className={inputClass} value={draft.fleet_capacity} onChange={e => setDraft({...draft,fleet_capacity:e.target.value})} placeholder="e.g. 5 tankers, 200 cans" /></label>
      </div>
      <div><span className="text-sm font-semibold text-[#0c4a6e]">Available Cities</span><div className="mt-1 flex gap-2"><input className={inputClass} value={cityInput} onChange={e => setCityInput(e.target.value)} placeholder="Add city" onKeyDown={e => e.key==='Enter'&&(e.preventDefault(),addCity())} /><button type="button" onClick={addCity} className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white">Add</button></div>
        {draft.available_cities.length>0&&(<div className="mt-2 flex flex-wrap gap-1.5">{draft.available_cities.map((c,i) => (<span key={i} className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs text-sky-700">{c}<button type="button" onClick={() => setDraft({...draft,available_cities:draft.available_cities.filter((_,idx)=>idx!==i)})}><X className="h-3 w-3" /></button></span>))}</div>)}</div>
      <div><span className="text-sm font-semibold text-[#0c4a6e]">Time Slots</span><div className="mt-1 flex gap-2"><input className={inputClass} value={slotInput} onChange={e => setSlotInput(e.target.value)} placeholder="e.g. 6 AM - 9 AM" onKeyDown={e => e.key==='Enter'&&(e.preventDefault(),addSlot())} /><button type="button" onClick={addSlot} className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white">Add</button></div>
        {draft.available_time_slots.length>0&&(<div className="mt-2 flex flex-wrap gap-1.5">{draft.available_time_slots.map((s,i) => (<span key={i} className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs text-sky-700">{s}<button type="button" onClick={() => setDraft({...draft,available_time_slots:draft.available_time_slots.filter((_,idx)=>idx!==i)})}><X className="h-3 w-3" /></button></span>))}</div>)}</div>
    </div></div>
  );
}

/* ─── Step 6: Equipment & Delivery ───────────────────────────────────────────── */
function StepEquipment({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  return (
    <div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#f0f9ff] p-5 space-y-4">
      <h3 className="text-base font-bold text-sky-800">Equipment & Delivery</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="text-sm font-semibold text-[#0c4a6e]">Vehicle Type</span><select className={inputClass} value={draft.vehicle_type} onChange={e => setDraft({...draft,vehicle_type:e.target.value})}><option value="">Select vehicle</option>{VEHICLE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}</select></label>
        <label className="block"><span className="text-sm font-semibold text-[#0c4a6e]">Delivery Team Size</span><input className={inputClass} value={draft.delivery_team_size} onChange={e => setDraft({...draft,delivery_team_size:e.target.value})} placeholder="e.g. 2 persons" /></label>
        <label className="block"><span className="text-sm font-semibold text-[#0c4a6e]">Delivery Time</span><input className={inputClass} value={draft.delivery_time} onChange={e => setDraft({...draft,delivery_time:e.target.value})} placeholder="e.g. Within 2 hours" /></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-3 rounded-xl border border-[#eadfcf] p-3 cursor-pointer"><input type="checkbox" checked={draft.installation_included} onChange={e => setDraft({...draft,installation_included:e.target.checked})} className="h-4 w-4 rounded border-[#e7d9c4] text-sky-700" /><span className="text-sm font-semibold text-[#0c4a6e]">Installation Included</span></label>
        <label className="flex items-center gap-3 rounded-xl border border-[#eadfcf] p-3 cursor-pointer"><input type="checkbox" checked={draft.water_dispenser_available} onChange={e => setDraft({...draft,water_dispenser_available:e.target.checked})} className="h-4 w-4 rounded border-[#e7d9c4] text-sky-700" /><span className="text-sm font-semibold text-[#0c4a6e]">Water Dispenser Available</span></label>
        <label className="flex items-center gap-3 rounded-xl border border-[#eadfcf] p-3 cursor-pointer"><input type="checkbox" checked={draft.stand_included} onChange={e => setDraft({...draft,stand_included:e.target.checked})} className="h-4 w-4 rounded border-[#e7d9c4] text-sky-700" /><span className="text-sm font-semibold text-[#0c4a6e]">Stand Included</span></label>
        <label className="flex items-center gap-3 rounded-xl border border-[#eadfcf] p-3 cursor-pointer"><input type="checkbox" checked={draft.cooling_unit_available} onChange={e => setDraft({...draft,cooling_unit_available:e.target.checked})} className="h-4 w-4 rounded border-[#e7d9c4] text-sky-700" /><span className="text-sm font-semibold text-[#0c4a6e]">Cooling Unit Available</span></label>
      </div>
    </div></div>
  );
}


/* ─── Step 7: Add-ons ────────────────────────────────────────────────────────── */
function StepAddons({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const addAddon = (name?: string) => { setDraft({...draft,addons:[...draft.addons,{name:name||'',price:'',description:''}]}); };
  const removeAddon = (i: number) => { setDraft({...draft,addons:draft.addons.filter((_,idx)=>idx!==i)}); };
  const updateAddon = (i: number, field: keyof Addon, value: string) => { const a=[...draft.addons]; a[i]={...a[i],[field]:value}; setDraft({...draft,addons:a}); };
  const addFromTemplate = (t: string) => { if (!draft.addons.some(a => a.name.toLowerCase()===t.toLowerCase())) addAddon(t); else toast.info(`"${t}" already added`); };
  return (
    <div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#f0f9ff] p-5">
      <div className="flex items-center justify-between mb-4"><div><h3 className="text-base font-bold text-sky-800">Add-ons</h3></div><button type="button" onClick={() => addAddon()} className="rounded-lg bg-sky-700/10 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-700/20"><Plus className="mr-1 inline h-3 w-3" />Custom</button></div>
      <div className="mb-4"><span className="text-xs font-semibold text-[#0c4a6e] mb-2 block">Quick Add:</span><div className="flex flex-wrap gap-1.5">{ADDON_TEMPLATES.map(t => (<button key={t} type="button" onClick={() => addFromTemplate(t)} className="rounded-full border border-[#e7d9c4] bg-white px-2.5 py-1 text-[11px] font-medium text-stone-600 hover:border-sky-600 hover:bg-sky-50 hover:text-sky-700">+ {t}</button>))}</div></div>
      {draft.addons.length===0?(<p className="text-center text-sm text-stone-400 py-4">No add-ons yet.</p>):(<div className="space-y-2">{draft.addons.map((addon,i) => (<div key={i} className="grid grid-cols-[1fr_90px_1fr_32px] gap-2 items-center"><input className={inputClass} value={addon.name} onChange={e => updateAddon(i,'name',e.target.value)} placeholder="Name" /><div className="relative"><span className="absolute left-2.5 top-2.5 text-xs text-stone-400">₹</span><input className={`${inputClass} pl-6`} type="number" value={addon.price} onChange={e => updateAddon(i,'price',e.target.value)} placeholder="0" /></div><input className={inputClass} value={addon.description} onChange={e => updateAddon(i,'description',e.target.value)} placeholder="Description" /><button type="button" onClick={() => removeAddon(i)} className="flex h-9 w-9 items-center justify-center rounded-lg text-red-400 hover:bg-red-50"><X className="h-4 w-4" /></button></div>))}</div>)}
    </div></div>
  );
}

/* ─── Step 8: Preview ────────────────────────────────────────────────────────── */
function StepPreview({ draft }: { draft: Draft }) {
  return (
    <div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-[#f0f9ff] p-5">
      <h3 className="mb-4 text-base font-bold text-sky-800">Preview</h3>
      <div className="overflow-hidden rounded-2xl border border-[#eadfcf] bg-white shadow-sm">
        {draft.cover_file||draft.cover_url?(<div className="h-36 overflow-hidden"><img src={draft.cover_file?URL.createObjectURL(draft.cover_file):draft.cover_url} alt="Cover" className="w-full h-full object-cover" /></div>):(<div className="flex h-36 items-center justify-center bg-gradient-to-br from-sky-50 to-cyan-50"><Droplets className="h-8 w-8 text-sky-700/40" /></div>)}
        <div className="p-5">
          <div className="flex items-start justify-between"><h4 className="text-lg font-bold text-[#0c4a6e]">{draft.name||'Package Name'}</h4><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${draft.status==='active'?'bg-sky-100 text-sky-700':'bg-blue-50 text-blue-700'}`}>{draft.status}</span></div>
          {draft.package_type && <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-medium text-sky-800"><Droplets className="h-3 w-3" />{draft.package_type}</span>}
          {draft.description && <p className="mt-2 text-sm text-stone-500 line-clamp-2">{draft.description}</p>}
          {draft.base_price && <p className="mt-2 text-2xl font-bold text-sky-700">₹{Number(draft.base_price||0).toLocaleString('en-IN')}<span className="text-xs font-normal text-stone-500 ml-1">/{draft.pricing_type.replace('per_','').replace('custom_quote','quote')}</span></p>}
          {draft.supply_features.length>0 && (<div className="mt-3 border-t border-stone-100 pt-3"><p className="text-xs font-semibold text-stone-600 mb-1.5">Features:</p><div className="flex flex-wrap gap-1">{draft.supply_features.map(s => <span key={s} className="rounded-full bg-sky-700/8 px-2 py-0.5 text-[11px] text-sky-700">{s}</span>)}</div></div>)}
          {draft.available_cities.length>0 && (<div className="mt-3 border-t border-stone-100 pt-3"><p className="text-xs font-semibold text-stone-600 mb-1.5">Cities:</p><div className="flex flex-wrap gap-1">{draft.available_cities.map(c => <span key={c} className="rounded-full bg-cyan-50 border border-cyan-200 px-2 py-0.5 text-[11px] text-cyan-800">{c}</span>)}</div></div>)}
          {draft.addons.filter(a=>a.name.trim()).length>0 && (<div className="mt-3 border-t border-stone-100 pt-3"><p className="text-xs font-semibold text-stone-600 mb-1.5">Add-ons:</p>{draft.addons.filter(a=>a.name.trim()).map((a,i) => (<div key={i} className="flex justify-between text-xs mt-1"><span className="text-stone-700">{a.name}</span>{a.price&&<span className="font-semibold text-sky-800">+₹{Number(a.price).toLocaleString('en-IN')}</span>}</div>))}</div>)}
        </div>
      </div>
    </div></div>
  );
}
