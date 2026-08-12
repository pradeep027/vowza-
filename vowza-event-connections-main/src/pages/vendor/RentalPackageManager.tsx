import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, Eye, EyeOff, X, Check,
  ChevronRight, ChevronLeft, Upload, Truck, ChevronDown,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/* ─── Constants ─────────────────────────────────────────────────────────────── */
const PACKAGE_TYPES = [
  { value: 'Tents', name: 'Tents', included: ['Transportation','Installation','Setup','Dismantling'], details: { tent_type: '', tent_size: '', dimensions: '', capacity: '', fabric_material: '', color: '', flooring_available: false, side_walls: false, roof_type: '', weather_protection: false, lighting_included: false, setup_included: true } },
  { value: 'Samiyana / Shamiana', name: 'Samiyana / Shamiana', included: ['Transportation','Installation','Setup','Dismantling'], details: { samiyana_type: '', size_dimensions: '', fabric_material: '', color_design: '', capacity: '', flooring_available: false, side_curtains: false, roof_style: '', decorative_options: '', lighting_option: false, setup_included: true } },
  { value: 'Chairs', name: 'Chairs', included: ['Transportation','Setup','Dismantling','Cleaning'], details: { chair_type: '', material: '', color: '', cushion_available: false, cover_available: false } },
  { value: 'Tables', name: 'Tables', included: ['Transportation','Setup','Dismantling','Cleaning'], details: { table_type: '', shape: '', dimensions: '', material: '', seating_capacity: '', cover_available: false } },
  { value: 'Sofas & Seating', name: 'Sofas & Seating', included: ['Transportation','Setup','Dismantling'], details: { seating_type: '', material: '', color: '', number_of_seats: '', cushions: false } },
  { value: 'Stage & Mandap', name: 'Stage & Mandap', included: ['Transportation','Installation','Setup','Dismantling','Technician'], details: { stage_type: '', dimensions: '', height: '', material: '', design_style: '', flooring: false, backdrop: false, lighting: false } },
  { value: 'Lighting Equipment', name: 'Lighting Equipment', included: ['Transportation','Installation','Operator','Backup Equipment'], details: { lighting_type: '', wattage: '', quantity: '', indoor_outdoor: '', power_requirements: '', installation_included: true, technician_included: false } },
  { value: 'Sound Equipment', name: 'Sound Equipment', included: ['Transportation','Installation','Operator','Backup Equipment'], details: { equipment_type: '', brand_model: '', power_output: '', speakers: '', subwoofers: '', microphones: '', mixer: false, amplifiers: false, technician_included: false, setup_included: true } },
  { value: 'LED Walls & Displays', name: 'LED Walls & Displays', included: ['Transportation','Installation','Technician','Backup Equipment'], details: { screen_type: '', screen_size: '', resolution: '', indoor_outdoor: '', controller_included: false, installation_included: true, technician_included: false } },
  { value: 'Generators', name: 'Generators', included: ['Transportation','Installation','Operator','Backup Equipment'], details: { generator_type: '', capacity_kva: '', fuel_type: '', runtime: '', fuel_included: false, operator_included: false } },
  { value: 'Projectors & Screens', name: 'Projectors & Screens', included: ['Transportation','Installation','Technician'], details: { projector_type: '', resolution: '', brightness: '', screen_size: '', hdmi_wireless: false, technician_included: false, installation_included: true } },
  { value: 'Decor Items', name: 'Decor Items', included: ['Transportation','Setup','Dismantling'], details: { decor_type: '', material: '', color: '', theme: '' } },
  { value: 'Crockery & Dining', name: 'Crockery & Dining Equipment', included: ['Transportation','Cleaning','Setup'], details: { item_type: '', material: '', color: '', set_size: '' } },
  { value: 'Catering Equipment', name: 'Catering Equipment', included: ['Transportation','Setup','Cleaning'], details: { equipment_type: '', capacity: '', fuel_type: '', quantity: '' } },
  { value: 'Wedding Furniture', name: 'Wedding Furniture', included: ['Transportation','Setup','Dismantling'], details: { furniture_type: '', material: '', style: '', color: '' } },
  { value: 'Other Rentals', name: 'Other Rentals', included: [], details: {} },
];

const ALL_INCLUDED_ITEMS = ['Transportation','Installation','Setup','Dismantling','Operator','Technician','Backup Equipment','Cleaning','Support','Maintenance'];
const ADDON_TEMPLATES = ['Extra Chairs','Extra Tables','Additional Lighting','Extra Generator','Extra Speaker','Decoration','Operator','Technician','Transportation','Installation','Cleaning'];
const RENTAL_TYPE_OPTIONS = [
  { value: 'per_event', label: 'Per Event' },
  { value: 'per_day', label: 'Per Day' },
  { value: 'per_hour', label: 'Per Hour' },
  { value: 'package_price', label: 'Package Price' },
];
const STEP_LABELS = ['Package Type','Pricing','Rental Details','Included Items','Availability','Delivery & Setup','Add-ons','Preview'];

const inputClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition placeholder:text-stone-400 focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/15';

/* ─── Types ─────────────────────────────────────────────────────────────────── */
type Addon = { name: string; price: string; description: string };

type Draft = {
  id?: string;
  name: string;
  description: string;
  package_type: string;
  status: string;
  rental_type: string;
  price: string;
  advance_percentage: string;
  security_deposit: string;
  transportation_charges: string;
  installation_charges: string;
  outside_city_charges: string;
  extra_hour_charges: string;
  late_return_charges: string;
  rental_details: Record<string, any>;
  included_items: string[];
  inventory_quantity: string;
  available_units: string;
  delivery_radius: string;
  available_cities: string[];
  setup_time: string;
  delivery_time: string;
  pickup_time: string;
  installation_team: string;
  support_contact: string;
  emergency_contact: string;
  addons: Addon[];
  cover_file: File | null;
  cover_url: string;
  gallery_files: File[];
  gallery_urls: { id: string; url: string; is_cover: boolean }[];
  video_files: File[];
  video_urls: { id: string; url: string }[];
};

const blank = (): Draft => ({
  name: '', description: '', package_type: '', status: 'draft',
  rental_type: 'per_event', price: '', advance_percentage: '20',
  security_deposit: '', transportation_charges: '',
  installation_charges: '', outside_city_charges: '',
  extra_hour_charges: '', late_return_charges: '',
  rental_details: {}, included_items: [],
  inventory_quantity: '1', available_units: '1',
  delivery_radius: '', available_cities: [],
  setup_time: '', delivery_time: '', pickup_time: '',
  installation_team: '', support_contact: '', emergency_contact: '',
  addons: [],
  cover_file: null, cover_url: '', gallery_files: [], gallery_urls: [],
  video_files: [], video_urls: [],
});

/* ─── Main Component ────────────────────────────────────────────────────────── */
export default function RentalPackageManager({ provider }: { provider: any }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['rental-packages', provider.id],
    queryFn: async () => {
      const r = await (supabase.from('rental_packages' as any).select('*').eq('provider_id', provider.id).order('created_at', { ascending: false }));
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['rental-packages', provider.id] });

  useEffect(() => {
    const channel = supabase.channel(`rental-packages-${provider.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rental_packages', filter: `provider_id=eq.${provider.id}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [provider.id]);

  /* ─── Edit existing ───────────────────────────────────────────────── */
  const edit = async (pkg: any) => {
    let addons: Addon[] = [];
    let galleryUrls: { id: string; url: string; is_cover: boolean }[] = [];
    let videoUrls: { id: string; url: string }[] = [];
    let coverUrl = '';
    try {
      const addonRes = await (supabase.from('rental_addons' as any).select('name, price, description').eq('package_id', pkg.id).order('sort_order'));
      if (addonRes.data) addons = addonRes.data.map((a: any) => ({ name: a.name, price: String(a.price ?? ''), description: a.description || '' }));
    } catch (_) {}
    try {
      const galRes = await (supabase.from('rental_gallery' as any).select('id, public_url, is_cover, sort_order, media_type').eq('package_id', pkg.id).order('sort_order'));
      const gallery = (galRes.data ?? []).map((g: any) => ({ id: g.id, url: g.public_url, is_cover: g.is_cover, media_type: g.media_type || 'image' }));
      const cover = gallery.find((g: any) => g.is_cover);
      coverUrl = cover?.url || '';
      galleryUrls = gallery.filter((g: any) => !g.is_cover && g.media_type === 'image');
      videoUrls = gallery.filter((g: any) => g.media_type === 'video').map((g: any) => ({ id: g.id, url: g.url }));
    } catch (_) {}

    setDraft({
      id: pkg.id, name: pkg.name || '', description: pkg.description || '',
      package_type: pkg.package_type || '', status: pkg.status || 'draft',
      rental_type: pkg.rental_type || 'per_event',
      price: String(pkg.price ?? ''), advance_percentage: String(pkg.advance_percentage ?? '20'),
      security_deposit: String(pkg.security_deposit ?? ''),
      transportation_charges: String(pkg.transportation_charges ?? ''),
      installation_charges: String(pkg.installation_charges ?? ''),
      outside_city_charges: String(pkg.outside_city_charges ?? ''),
      extra_hour_charges: String(pkg.extra_hour_charges ?? ''),
      late_return_charges: String(pkg.late_return_charges ?? ''),
      rental_details: pkg.rental_details ?? {},
      included_items: pkg.included_items ?? [],
      inventory_quantity: String(pkg.inventory_quantity ?? '1'),
      available_units: String(pkg.available_units ?? '1'),
      delivery_radius: pkg.delivery_radius || '',
      available_cities: pkg.available_cities ?? [],
      setup_time: pkg.setup_time || '', delivery_time: pkg.delivery_time || '',
      pickup_time: pkg.pickup_time || '', installation_team: pkg.installation_team || '',
      support_contact: pkg.support_contact || '', emergency_contact: pkg.emergency_contact || '',
      addons, cover_file: null, cover_url: coverUrl,
      gallery_files: [], gallery_urls: galleryUrls,
      video_files: [], video_urls: videoUrls,
    });
    setStep(1);
  };

  /* ─── Save handler ─────────────────────────────────────────────────────── */
  const save = async () => {
    if (!draft || !draft.name.trim()) { toast.error('Package name is required.'); setStep(1); return; }
    if (!draft.price) { toast.error('Price is required.'); setStep(2); return; }
    if (!draft.cover_file && !draft.cover_url) { toast.error('Cover photo is required.'); setStep(1); return; }
    setBusy(true);
    try {
      const payload: any = {
        provider_id: provider.id, name: draft.name.trim(),
        package_type: draft.package_type || null, description: draft.description.trim() || null,
        status: draft.status, rental_type: draft.rental_type,
        price: Number(draft.price),
        advance_percentage: draft.advance_percentage ? Number(draft.advance_percentage) : 20,
        security_deposit: draft.security_deposit ? Number(draft.security_deposit) : 0,
        transportation_charges: draft.transportation_charges ? Number(draft.transportation_charges) : 0,
        installation_charges: draft.installation_charges ? Number(draft.installation_charges) : 0,
        outside_city_charges: draft.outside_city_charges ? Number(draft.outside_city_charges) : 0,
        extra_hour_charges: draft.extra_hour_charges ? Number(draft.extra_hour_charges) : 0,
        late_return_charges: draft.late_return_charges ? Number(draft.late_return_charges) : 0,
        rental_details: draft.rental_details,
        included_items: draft.included_items,
        inventory_quantity: Number(draft.inventory_quantity) || 1,
        available_units: Number(draft.available_units) || 1,
        delivery_radius: draft.delivery_radius || null,
        available_cities: draft.available_cities,
        setup_time: draft.setup_time || null, delivery_time: draft.delivery_time || null,
        pickup_time: draft.pickup_time || null, installation_team: draft.installation_team || null,
        support_contact: draft.support_contact || null, emergency_contact: draft.emergency_contact || null,
      };

      let packageId = draft.id;
      if (draft.id) {
        const r = await (supabase.from('rental_packages' as any).update(payload).eq('id', draft.id).select('id').single());
        if (r.error) throw r.error;
      } else {
        const r = await (supabase.from('rental_packages' as any).insert(payload).select('id').single());
        if (r.error) throw r.error;
        packageId = r.data.id;
      }

      if (packageId) {
        await (supabase.from('rental_addons' as any).delete().eq('package_id', packageId));
        const validAddons = draft.addons.filter(a => a.name.trim());
        if (validAddons.length > 0) {
          await (supabase.from('rental_addons' as any).insert(validAddons.map((a, i) => ({
            package_id: packageId, name: a.name.trim(), price: Number(a.price) || 0,
            description: a.description || null, sort_order: i,
          }))));
        }

        if (draft.cover_file) {
          const ext = draft.cover_file.name.split('.').pop();
          const path = `${user!.id}/${packageId}/cover-${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage.from('rental-media').upload(path, draft.cover_file, { contentType: draft.cover_file.type });
          if (!upErr) {
            const publicUrl = supabase.storage.from('rental-media').getPublicUrl(path).data.publicUrl;
            await (supabase.from('rental_gallery' as any).delete().eq('package_id', packageId).eq('is_cover', true));
            await (supabase.from('rental_gallery' as any).insert({ package_id: packageId, storage_path: path, public_url: publicUrl, is_cover: true, sort_order: 0 }));
          }
        }
        if (draft.gallery_files.length > 0) {
          for (let i = 0; i < draft.gallery_files.length; i++) {
            const file = draft.gallery_files[i];
            const ext = file.name.split('.').pop();
            const path = `${user!.id}/${packageId}/gallery-${crypto.randomUUID()}.${ext}`;
            const { error: upErr } = await supabase.storage.from('rental-media').upload(path, file, { contentType: file.type });
            if (!upErr) {
              const publicUrl = supabase.storage.from('rental-media').getPublicUrl(path).data.publicUrl;
              await (supabase.from('rental_gallery' as any).insert({ package_id: packageId, storage_path: path, public_url: publicUrl, is_cover: false, media_type: 'image', sort_order: draft.gallery_urls.length + i + 1 }));
            }
          }
        }
        // Upload videos
        if (draft.video_files.length > 0) {
          for (let i = 0; i < draft.video_files.length; i++) {
            const file = draft.video_files[i];
            const ext = file.name.split('.').pop();
            const path = `${user!.id}/${packageId}/video-${crypto.randomUUID()}.${ext}`;
            const { error: upErr } = await supabase.storage.from('rental-media').upload(path, file, { contentType: file.type });
            if (!upErr) {
              const publicUrl = supabase.storage.from('rental-media').getPublicUrl(path).data.publicUrl;
              await (supabase.from('rental_gallery' as any).insert({ package_id: packageId, storage_path: path, public_url: publicUrl, is_cover: false, media_type: 'video', sort_order: 100 + i }));
            }
          }
        }
        if (draft.id) {
          const currentIds = [...draft.gallery_urls.map(g => g.id), ...draft.video_urls.map(v => v.id)].filter(Boolean);
          const { data: existing } = await (supabase.from('rental_gallery' as any).select('id').eq('package_id', packageId).eq('is_cover', false));
          const existingIds = (existing ?? []).map((e: any) => e.id);
          const toDelete = existingIds.filter((id: string) => !currentIds.includes(id));
          if (toDelete.length > 0) await (supabase.from('rental_gallery' as any).delete().in('id', toDelete));
        }
      }
      toast.success('Rental package saved!');
      setDraft(null); setStep(1); refresh();
    } catch (err: any) { toast.error(err.message || 'Could not save package'); }
    finally { setBusy(false); }
  };

  const toggleStatus = async (pkg: any) => {
    const newStatus = pkg.status === 'active' ? 'draft' : 'active';
    await (supabase.from('rental_packages' as any).update({ status: newStatus }).eq('id', pkg.id));
    refresh();
  };
  const remove = async (pkg: any) => {
    if (!confirm('Delete this package? This cannot be undone.')) return;
    await (supabase.from('rental_packages' as any).delete().eq('id', pkg.id));
    refresh(); toast.success('Package deleted');
  };
  const openNew = () => { setDraft(blank()); setStep(1); };

  /* ─── Chip Multi-Select ─────────────────────────────────────────── */
  const ChipSelect = ({ options, selected, onChange, label }: { options: string[]; selected: string[]; onChange: (v: string[]) => void; label: string }) => (
    <div>
      <span className="text-sm font-semibold text-[#134e4a]">{label}</span>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {options.map(opt => (
          <button key={opt} type="button"
            onClick={() => onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt])}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              selected.includes(opt)
                ? 'border-teal-600 bg-teal-600/10 text-teal-700'
                : 'border-[#e7d9c4] text-stone-600 hover:border-teal-500'
            }`}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );

  const renderStep = () => {
    if (!draft) return null;
    switch (step) {
      case 1: return <StepPackageType draft={draft} setDraft={setDraft} />;
      case 2: return <StepPricing draft={draft} setDraft={setDraft} />;
      case 3: return <StepRentalDetails draft={draft} setDraft={setDraft} />;
      case 4: return <StepIncludedItems draft={draft} setDraft={setDraft} ChipSelect={ChipSelect} />;
      case 5: return <StepAvailability draft={draft} setDraft={setDraft} />;
      case 6: return <StepDelivery draft={draft} setDraft={setDraft} />;
      case 7: return <StepAddons draft={draft} setDraft={setDraft} />;
      case 8: return <StepPreview draft={draft} />;
      default: return null;
    }
  };

  return (
    <div className="max-w-[1200px] space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#134e4a]">Rental Packages</h1>
          <p className="text-sm text-muted-foreground">Create and manage your rental equipment packages.</p>
        </div>
        <button onClick={openNew} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800">
          <Plus className="mr-1 inline h-4 w-4" />Add Package
        </button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[1,2,3].map(i => <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : packages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#eadfcf] py-16 text-center">
          <Truck className="h-12 w-12 text-teal-700/30" />
          <p className="mt-3 font-semibold text-[#134e4a]">No packages yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create your first rental package.</p>
          <button onClick={openNew} className="mt-4 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white"><Plus className="mr-1 inline h-4 w-4" />Add Package</button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg: any) => (
            <div key={pkg.id} className="overflow-hidden rounded-2xl border border-[#eadfcf] bg-[#f7fdfc] shadow-sm transition hover:shadow-md">
              <div className="flex h-28 items-center justify-center bg-gradient-to-br from-teal-50 to-amber-50">
                <Truck className="h-10 w-10 text-teal-700/40" />
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-bold text-[#134e4a] leading-tight">{pkg.name}</h2>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    pkg.status === 'active' ? 'bg-teal-100 text-teal-700' : pkg.status === 'paused' ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-700'
                  }`}>{pkg.status}</span>
                </div>
                {pkg.price && <p className="mt-1.5 text-lg font-bold text-teal-700">₹{Number(pkg.price).toLocaleString('en-IN')}<span className="text-xs font-normal text-stone-500 ml-1">/{pkg.rental_type?.replace('per_','').replace('package_price','pkg')}</span></p>}
                {pkg.package_type && <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><Truck className="h-3.5 w-3.5" />{pkg.package_type}</div>}
                {pkg.available_units != null && <div className="mt-0.5 text-xs text-muted-foreground">Available: {pkg.available_units}/{pkg.inventory_quantity}</div>}
                <div className="mt-4 flex gap-2">
                  <button onClick={() => edit(pkg)} className="flex-1 rounded-lg border border-[#e7d9c4] py-2 text-xs font-medium text-[#134e4a] transition hover:bg-[#f7fdfc]"><Pencil className="mr-1 inline h-3 w-3" />Edit</button>
                  <button onClick={() => toggleStatus(pkg)} className="rounded-lg border border-[#e7d9c4] p-2 transition hover:bg-[#f7fdfc]" title="Toggle status">
                    {pkg.status === 'active' ? <EyeOff className="h-3.5 w-3.5 text-stone-600" /> : <Eye className="h-3.5 w-3.5 text-stone-600" />}
                  </button>
                  <button onClick={() => remove(pkg)} className="rounded-lg border border-red-200 p-2 transition hover:bg-red-50" title="Delete"><Trash2 className="h-3.5 w-3.5 text-red-600" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Wizard Modal */}
      {draft && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#0f3b3b]/65 p-3 backdrop-blur-sm sm:p-6">
          <div className="mx-auto my-3 max-w-3xl overflow-hidden rounded-[24px] bg-[#fefffd] shadow-2xl">
            <header className="flex items-start justify-between gap-4 bg-teal-800 px-5 py-5 sm:px-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-200">Vowza Rentals</p>
                <h2 className="mt-1 text-lg font-bold text-white">{draft.id ? 'Edit Package' : 'Add New Package'}</h2>
              </div>
              <button onClick={() => { setDraft(null); setStep(1); }} className="rounded-full p-2 text-white/85 hover:bg-white/15"><X className="h-5 w-5" /></button>
            </header>
            <div className="border-b border-[#eadfcf] bg-[#f7fdfc] px-5 py-4 sm:px-7">
              <div className="flex items-center justify-between">
                {STEP_LABELS.map((label, i) => {
                  const stepNum = i + 1;
                  const isCompleted = step > stepNum;
                  const isCurrent = step === stepNum;
                  return (
                    <div key={i} className="flex flex-1 items-center">
                      <div className="flex flex-col items-center">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${
                          isCompleted ? 'bg-teal-500 text-white' : isCurrent ? 'bg-teal-700 text-white shadow-md shadow-teal-700/30' : 'border-2 border-[#e7d9c4] text-stone-400'
                        }`}>{isCompleted ? <Check className="h-4 w-4" /> : stepNum}</div>
                        <span className={`mt-1 hidden text-[10px] font-medium sm:block ${isCurrent ? 'text-teal-700' : isCompleted ? 'text-teal-600' : 'text-stone-400'}`}>{label}</span>
                      </div>
                      {i < 7 && <div className={`mx-1 h-0.5 flex-1 rounded ${isCompleted ? 'bg-teal-400' : 'bg-[#e7d9c4]'}`} />}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="p-5 sm:p-7 max-h-[60vh] overflow-y-auto">{renderStep()}</div>
            <div className="flex items-center justify-between border-t border-[#eadfcf] bg-[#f7fdfc]/95 px-5 py-4 backdrop-blur sm:px-7">
              <button type="button" onClick={() => step > 1 ? setStep(step - 1) : setDraft(null)}
                className="flex items-center gap-1.5 rounded-xl border border-[#d7c5ae] px-4 py-2.5 text-sm font-semibold text-[#134e4a] transition hover:bg-white">
                <ChevronLeft className="h-4 w-4" />{step === 1 ? 'Cancel' : 'Back'}
              </button>
              {step < 8 ? (
                <button type="button" onClick={() => setStep(step + 1)}
                  className="flex items-center gap-1.5 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800">
                  Next<ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button type="button" disabled={busy} onClick={save}
                  className="rounded-xl bg-teal-700 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800 disabled:opacity-60">
                  {busy ? 'Saving…' : 'Save Package'}
                </button>
              )}
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
    const selected = PACKAGE_TYPES.find(t => t.value === value);
    if (selected) {
      setDraft({ ...draft, package_type: value, name: selected.name, included_items: [...selected.included], rental_details: { ...selected.details } });
    } else {
      setDraft({ ...draft, package_type: value });
    }
  };
  const selectedType = PACKAGE_TYPES.find(t => t.value === draft.package_type);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#f7fdfc] p-5">
        <h3 className="mb-4 text-base font-bold text-teal-800">Select Package Type</h3>
        <p className="mb-4 text-xs text-stone-500">Choose a rental category to auto-populate details.</p>
        <select className={`${inputClass} text-base py-3`} value={draft.package_type} onChange={e => handleTypeChange(e.target.value)}>
          <option value="">Select Rental Package Type</option>
          {PACKAGE_TYPES.map(t => <option key={t.value} value={t.value}>{t.name}</option>)}
        </select>
        {selectedType && selectedType.value !== 'Custom Rental Package' && (
          <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50/50 p-3">
            <p className="text-xs font-semibold text-teal-700 flex items-center gap-1"><Check className="h-3.5 w-3.5" />Auto-loaded from "{selectedType.name}"</p>
            <p className="mt-1 text-[11px] text-teal-600">{selectedType.included.length} included items pre-populated.</p>
          </div>
        )}
      </div>
      <div className="rounded-2xl border border-[#eadfcf] bg-[#f7fdfc] p-5 space-y-4">
        <h3 className="text-base font-bold text-teal-800">Package Info</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2"><span className="text-sm font-semibold text-[#134e4a]">Package Name <span className="text-red-500">*</span></span>
            <input className={inputClass} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Premium Stage Setup" /></label>
          <label className="block sm:col-span-2"><span className="text-sm font-semibold text-[#134e4a]">Description</span>
            <textarea className={`${inputClass} min-h-[80px] resize-y`} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="Describe your rental package..." /></label>
          <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Status</span>
            <select className={inputClass} value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}>
              <option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option>
            </select></label>
        </div>
      </div>
      {/* Cover Photo */}
      <div className="rounded-2xl border border-[#eadfcf] bg-[#f7fdfc] p-5">
        <span className="text-sm font-semibold text-[#134e4a]">Cover Photo <span className="text-red-500">*</span></span>
        <p className="text-xs text-stone-500 mb-2">Recommended: 1600x900px, max 5MB</p>
        {(draft.cover_file || draft.cover_url) ? (
          <div className="relative rounded-xl overflow-hidden border border-[#eadfcf] bg-stone-50">
            <img src={draft.cover_file ? URL.createObjectURL(draft.cover_file) : draft.cover_url} alt="Cover" className="w-full h-40 object-cover" />
            <button type="button" onClick={() => setDraft({ ...draft, cover_file: null, cover_url: '' })} className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"><X className="h-3.5 w-3.5" /></button>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-teal-300 bg-teal-50 p-6 transition hover:border-teal-600">
            <Upload className="h-6 w-6 text-teal-700 mb-2" /><span className="text-sm font-semibold text-[#134e4a]">Upload cover photo</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f && f.size <= 5*1024*1024) setDraft({ ...draft, cover_file: f }); else if (f) toast.error('Max 5MB'); }} />
          </label>
        )}
      </div>
      {/* Gallery */}
      <div className="rounded-2xl border border-[#eadfcf] bg-[#f7fdfc] p-5">
        <span className="text-sm font-semibold text-[#134e4a]">Gallery Images (max 30)</span>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2">
          {draft.gallery_urls.map((img, i) => (
            <div key={img.id || i} className="relative rounded-xl overflow-hidden border border-[#eadfcf] aspect-square bg-stone-50">
              <img src={img.url} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => setDraft({ ...draft, gallery_urls: draft.gallery_urls.filter((_, idx) => idx !== i) })} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"><X className="h-3 w-3" /></button>
            </div>
          ))}
          {draft.gallery_files.map((f, i) => (
            <div key={`new-${i}`} className="relative rounded-xl overflow-hidden border border-[#eadfcf] aspect-square bg-stone-50">
              <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => setDraft({ ...draft, gallery_files: draft.gallery_files.filter((_, idx) => idx !== i) })} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"><X className="h-3 w-3" /></button>
            </div>
          ))}
          {(draft.gallery_urls.length + draft.gallery_files.length) < 30 && (
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-teal-300 bg-teal-50 aspect-square transition hover:border-teal-600">
              <Plus className="h-5 w-5 text-teal-700" />
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
                onChange={e => { const files = Array.from(e.target.files ?? []).filter(f => f.size <= 5*1024*1024).slice(0, 30 - draft.gallery_urls.length - draft.gallery_files.length); if (files.length) setDraft({ ...draft, gallery_files: [...draft.gallery_files, ...files] }); }} />
            </label>
          )}
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
      <div className="rounded-2xl border border-[#eadfcf] bg-[#f7fdfc] p-5">
        <h3 className="mb-4 text-base font-bold text-teal-800">Rental Pricing</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Rental Type <span className="text-red-500">*</span></span>
            <select className={inputClass} value={draft.rental_type} onChange={e => setDraft({ ...draft, rental_type: e.target.value })}>
              {RENTAL_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select></label>
          <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Price <span className="text-red-500">*</span></span>
            <div className="relative"><span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span>
              <input className={`${inputClass} pl-7`} type="number" min="0" value={draft.price} onChange={e => setDraft({ ...draft, price: e.target.value })} placeholder="Rental price" /></div></label>
          <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Advance Percentage</span>
            <div className="relative"><span className="absolute right-3.5 top-2.5 text-sm text-stone-500">%</span>
              <input className={`${inputClass} pr-7`} type="number" min="0" max="100" value={draft.advance_percentage} onChange={e => setDraft({ ...draft, advance_percentage: e.target.value })} placeholder="20" /></div></label>
        </div>
      </div>
      <div className="rounded-2xl border border-[#eadfcf] bg-[#f7fdfc] p-5">
        <button type="button" onClick={() => setShowAdditional(!showAdditional)} className="flex w-full items-center justify-between text-left">
          <div><h3 className="text-base font-bold text-teal-800">Additional Charges</h3><p className="text-xs text-stone-500">Optional charges</p></div>
          <ChevronDown className={`h-5 w-5 text-stone-400 transition ${showAdditional ? 'rotate-180' : ''}`} />
        </button>
        {showAdditional && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 border-t border-[#eadfcf] pt-4">
            {[
              { key: 'security_deposit', label: 'Security Deposit' },
              { key: 'transportation_charges', label: 'Transportation Charges' },
              { key: 'installation_charges', label: 'Installation Charges' },
              { key: 'outside_city_charges', label: 'Outside City Charges' },
              { key: 'extra_hour_charges', label: 'Extra Hour Charges' },
              { key: 'late_return_charges', label: 'Late Return Charges' },
            ].map(({ key, label }) => (
              <label key={key} className="block"><span className="text-sm font-semibold text-[#134e4a]">{label}</span>
                <div className="relative"><span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span>
                  <input className={`${inputClass} pl-7`} type="number" min="0" value={(draft as any)[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} placeholder="0" /></div></label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Step 3: Rental Details (Dynamic per package_type) ──────────────────────── */
function StepRentalDetails({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const updateDetail = (key: string, value: any) => setDraft({ ...draft, rental_details: { ...draft.rental_details, [key]: value } });
  const d = draft.rental_details;
  const type = draft.package_type;

  const renderFields = () => {
    if (type === 'Tent & Shamiana') return (<>
      <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Tent Size</span><input className={inputClass} value={d.tent_size||''} onChange={e=>updateDetail('tent_size',e.target.value)} placeholder="e.g. 40x60 ft" /></label>
      <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Capacity</span><input className={inputClass} value={d.capacity||''} onChange={e=>updateDetail('capacity',e.target.value)} placeholder="e.g. 500 guests" /></label>
      <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Fabric Type</span><input className={inputClass} value={d.fabric_type||''} onChange={e=>updateDetail('fabric_type',e.target.value)} placeholder="e.g. Waterproof Canvas" /></label>
      <label className="flex items-center gap-3 rounded-xl border border-[#eadfcf] p-3"><input type="checkbox" checked={!!d.waterproof} onChange={e=>updateDetail('waterproof',e.target.checked)} className="h-4 w-4 rounded border-[#e7d9c4] text-teal-700" /><span className="text-sm font-semibold text-[#134e4a]">Waterproof</span></label>
      <label className="flex items-center gap-3 rounded-xl border border-[#eadfcf] p-3"><input type="checkbox" checked={!!d.decoration_included} onChange={e=>updateDetail('decoration_included',e.target.checked)} className="h-4 w-4 rounded border-[#e7d9c4] text-teal-700" /><span className="text-sm font-semibold text-[#134e4a]">Decoration Included</span></label>
    </>);
    if (type === 'Stage') return (<>
      <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Stage Size</span><input className={inputClass} value={d.stage_size||''} onChange={e=>updateDetail('stage_size',e.target.value)} placeholder="e.g. 20x16 ft" /></label>
      <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Height</span><input className={inputClass} value={d.height||''} onChange={e=>updateDetail('height',e.target.value)} placeholder="e.g. 4 ft" /></label>
      <label className="flex items-center gap-3 rounded-xl border border-[#eadfcf] p-3"><input type="checkbox" checked={!!d.backdrop} onChange={e=>updateDetail('backdrop',e.target.checked)} className="h-4 w-4 rounded border-[#e7d9c4] text-teal-700" /><span className="text-sm font-semibold text-[#134e4a]">Backdrop</span></label>
      <label className="flex items-center gap-3 rounded-xl border border-[#eadfcf] p-3"><input type="checkbox" checked={!!d.carpet} onChange={e=>updateDetail('carpet',e.target.checked)} className="h-4 w-4 rounded border-[#e7d9c4] text-teal-700" /><span className="text-sm font-semibold text-[#134e4a]">Carpet</span></label>
      <label className="flex items-center gap-3 rounded-xl border border-[#eadfcf] p-3"><input type="checkbox" checked={!!d.led_stage} onChange={e=>updateDetail('led_stage',e.target.checked)} className="h-4 w-4 rounded border-[#e7d9c4] text-teal-700" /><span className="text-sm font-semibold text-[#134e4a]">LED Stage</span></label>
    </>);
    if (type === 'Chairs & Tables') return (<>
      {['plastic_chairs','steel_chairs','vip_chairs','round_tables','dining_tables'].map(k => (
        <label key={k} className="block"><span className="text-sm font-semibold text-[#134e4a]">{k.split('_').map(w=>w[0].toUpperCase()+w.slice(1)).join(' ')}</span>
          <input className={inputClass} type="number" min="0" value={d[k]||''} onChange={e=>updateDetail(k,e.target.value)} placeholder="Quantity" /></label>
      ))}
    </>);
    if (type === 'Furniture') return (<>
      {['sofa','vip_sofa','coffee_table','reception_table'].map(k => (
        <label key={k} className="block"><span className="text-sm font-semibold text-[#134e4a]">{k.split('_').map(w=>w[0].toUpperCase()+w.slice(1)).join(' ')}</span>
          <input className={inputClass} type="number" min="0" value={d[k]||''} onChange={e=>updateDetail(k,e.target.value)} placeholder="Quantity" /></label>
      ))}
    </>);
    if (type === 'Generator') return (<>
      <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Generator Capacity</span><input className={inputClass} value={d.generator_capacity||''} onChange={e=>updateDetail('generator_capacity',e.target.value)} placeholder="e.g. 62.5 KVA" /></label>
      <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Backup Hours</span><input className={inputClass} value={d.backup_hours||''} onChange={e=>updateDetail('backup_hours',e.target.value)} placeholder="e.g. 8 hours" /></label>
      <label className="flex items-center gap-3 rounded-xl border border-[#eadfcf] p-3"><input type="checkbox" checked={!!d.fuel_included} onChange={e=>updateDetail('fuel_included',e.target.checked)} className="h-4 w-4 rounded border-[#e7d9c4] text-teal-700" /><span className="text-sm font-semibold text-[#134e4a]">Fuel Included</span></label>
    </>);
    if (type === 'AC Cooler') return (<>
      <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Cooler Type</span><input className={inputClass} value={d.cooler_type||''} onChange={e=>updateDetail('cooler_type',e.target.value)} placeholder="e.g. Industrial Cooler" /></label>
      <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Capacity (Tons)</span><input className={inputClass} value={d.capacity_tons||''} onChange={e=>updateDetail('capacity_tons',e.target.value)} placeholder="e.g. 2 Ton" /></label>
      <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Units</span><input className={inputClass} type="number" min="0" value={d.units||''} onChange={e=>updateDetail('units',e.target.value)} placeholder="Number of units" /></label>
    </>);
    if (type === 'LED Wall') return (<>
      <label className="block"><span className="text-sm font-semibold text-[#134e4a]">LED Size</span><input className={inputClass} value={d.led_size||''} onChange={e=>updateDetail('led_size',e.target.value)} placeholder="e.g. 12x8 ft" /></label>
      <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Resolution</span><input className={inputClass} value={d.resolution||''} onChange={e=>updateDetail('resolution',e.target.value)} placeholder="e.g. P3, P4" /></label>
      <label className="flex items-center gap-3 rounded-xl border border-[#eadfcf] p-3"><input type="checkbox" checked={!!d.indoor} onChange={e=>updateDetail('indoor',e.target.checked)} className="h-4 w-4 rounded border-[#e7d9c4] text-teal-700" /><span className="text-sm font-semibold text-[#134e4a]">Indoor</span></label>
      <label className="flex items-center gap-3 rounded-xl border border-[#eadfcf] p-3"><input type="checkbox" checked={!!d.outdoor} onChange={e=>updateDetail('outdoor',e.target.checked)} className="h-4 w-4 rounded border-[#e7d9c4] text-teal-700" /><span className="text-sm font-semibold text-[#134e4a]">Outdoor</span></label>
    </>);
    if (type === 'Sound Equipment') return (<>
      <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Speakers</span><input className={inputClass} type="number" min="0" value={d.speakers||''} onChange={e=>updateDetail('speakers',e.target.value)} placeholder="Qty" /></label>
      <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Woofers</span><input className={inputClass} type="number" min="0" value={d.woofers||''} onChange={e=>updateDetail('woofers',e.target.value)} placeholder="Qty" /></label>
      <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Microphones</span><input className={inputClass} type="number" min="0" value={d.microphones||''} onChange={e=>updateDetail('microphones',e.target.value)} placeholder="Qty" /></label>
      <label className="flex items-center gap-3 rounded-xl border border-[#eadfcf] p-3"><input type="checkbox" checked={!!d.dj_console} onChange={e=>updateDetail('dj_console',e.target.checked)} className="h-4 w-4 rounded border-[#e7d9c4] text-teal-700" /><span className="text-sm font-semibold text-[#134e4a]">DJ Console</span></label>
      <label className="flex items-center gap-3 rounded-xl border border-[#eadfcf] p-3"><input type="checkbox" checked={!!d.mixer} onChange={e=>updateDetail('mixer',e.target.checked)} className="h-4 w-4 rounded border-[#e7d9c4] text-teal-700" /><span className="text-sm font-semibold text-[#134e4a]">Mixer</span></label>
    </>);
    if (type === 'Lighting Equipment') return (<>
      <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Moving Heads</span><input className={inputClass} type="number" min="0" value={d.moving_heads||''} onChange={e=>updateDetail('moving_heads',e.target.value)} placeholder="Qty" /></label>
      <label className="block"><span className="text-sm font-semibold text-[#134e4a]">PAR Lights</span><input className={inputClass} type="number" min="0" value={d.par_lights||''} onChange={e=>updateDetail('par_lights',e.target.value)} placeholder="Qty" /></label>
      <label className="flex items-center gap-3 rounded-xl border border-[#eadfcf] p-3"><input type="checkbox" checked={!!d.laser} onChange={e=>updateDetail('laser',e.target.checked)} className="h-4 w-4 rounded border-[#e7d9c4] text-teal-700" /><span className="text-sm font-semibold text-[#134e4a]">Laser</span></label>
      <label className="flex items-center gap-3 rounded-xl border border-[#eadfcf] p-3"><input type="checkbox" checked={!!d.smoke_machine} onChange={e=>updateDetail('smoke_machine',e.target.checked)} className="h-4 w-4 rounded border-[#e7d9c4] text-teal-700" /><span className="text-sm font-semibold text-[#134e4a]">Smoke Machine</span></label>
    </>);
    return <p className="text-sm text-stone-500">Select a package type in Step 1 to see specific fields, or add custom details below.</p>;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#f7fdfc] p-5 space-y-4">
        <h3 className="text-base font-bold text-teal-800">Rental Details — {type || 'Custom'}</h3>
        <div className="grid gap-4 sm:grid-cols-2">{renderFields()}</div>
      </div>
    </div>
  );
}


/* ─── Step 4: Included Items ─────────────────────────────────────────────────── */
function StepIncludedItems({ draft, setDraft, ChipSelect }: { draft: Draft; setDraft: (d: Draft) => void; ChipSelect: any }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#f7fdfc] p-5 space-y-5">
        <h3 className="text-base font-bold text-teal-800">Included Items</h3>
        <p className="text-xs text-stone-500">Select all items/services included in this rental package.</p>
        <ChipSelect label="Included Items" options={ALL_INCLUDED_ITEMS} selected={draft.included_items} onChange={(v: string[]) => setDraft({ ...draft, included_items: v })} />
      </div>
    </div>
  );
}

/* ─── Step 5: Availability ───────────────────────────────────────────────────── */
function StepAvailability({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const [cityInput, setCityInput] = useState('');
  const addCity = () => {
    if (cityInput.trim() && !draft.available_cities.includes(cityInput.trim())) {
      setDraft({ ...draft, available_cities: [...draft.available_cities, cityInput.trim()] });
      setCityInput('');
    }
  };
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#f7fdfc] p-5 space-y-4">
        <h3 className="text-base font-bold text-teal-800">Inventory & Availability</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Total Inventory Quantity</span>
            <input className={inputClass} type="number" min="1" value={draft.inventory_quantity} onChange={e => setDraft({ ...draft, inventory_quantity: e.target.value, available_units: e.target.value })} placeholder="1" /></label>
          <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Currently Available Units</span>
            <input className={inputClass} type="number" min="0" value={draft.available_units} onChange={e => setDraft({ ...draft, available_units: e.target.value })} placeholder="1" /></label>
          <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Delivery Radius</span>
            <input className={inputClass} value={draft.delivery_radius} onChange={e => setDraft({ ...draft, delivery_radius: e.target.value })} placeholder="e.g. 50 km" /></label>
        </div>
        <div>
          <span className="text-sm font-semibold text-[#134e4a]">Available Cities</span>
          <div className="mt-1 flex gap-2">
            <input className={inputClass} value={cityInput} onChange={e => setCityInput(e.target.value)} placeholder="Add city" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCity())} />
            <button type="button" onClick={addCity} className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Add</button>
          </div>
          {draft.available_cities.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {draft.available_cities.map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs text-teal-700">
                  {c}<button type="button" onClick={() => setDraft({ ...draft, available_cities: draft.available_cities.filter((_, idx) => idx !== i) })} className="text-teal-500 hover:text-red-500"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Step 6: Delivery & Setup ───────────────────────────────────────────────── */
function StepDelivery({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#f7fdfc] p-5 space-y-4">
        <h3 className="text-base font-bold text-teal-800">Delivery & Setup</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Setup Time</span><input className={inputClass} value={draft.setup_time} onChange={e => setDraft({ ...draft, setup_time: e.target.value })} placeholder="e.g. 3 hours before event" /></label>
          <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Delivery Time</span><input className={inputClass} value={draft.delivery_time} onChange={e => setDraft({ ...draft, delivery_time: e.target.value })} placeholder="e.g. 6 AM on event day" /></label>
          <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Pickup Time</span><input className={inputClass} value={draft.pickup_time} onChange={e => setDraft({ ...draft, pickup_time: e.target.value })} placeholder="e.g. Next day 10 AM" /></label>
          <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Installation Team</span><input className={inputClass} value={draft.installation_team} onChange={e => setDraft({ ...draft, installation_team: e.target.value })} placeholder="e.g. 4 persons" /></label>
          <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Support Contact</span><input className={inputClass} value={draft.support_contact} onChange={e => setDraft({ ...draft, support_contact: e.target.value })} placeholder="Phone number" /></label>
          <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Emergency Contact</span><input className={inputClass} value={draft.emergency_contact} onChange={e => setDraft({ ...draft, emergency_contact: e.target.value })} placeholder="Phone number" /></label>
        </div>
      </div>
    </div>
  );
}


/* ─── Step 7: Add-ons ────────────────────────────────────────────────────────── */
function StepAddons({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const addAddon = (name?: string) => { setDraft({ ...draft, addons: [...draft.addons, { name: name || '', price: '', description: '' }] }); };
  const removeAddon = (i: number) => { setDraft({ ...draft, addons: draft.addons.filter((_, idx) => idx !== i) }); };
  const updateAddon = (i: number, field: keyof Addon, value: string) => { const a = [...draft.addons]; a[i] = { ...a[i], [field]: value }; setDraft({ ...draft, addons: a }); };
  const addFromTemplate = (templateName: string) => {
    if (!draft.addons.some(a => a.name.toLowerCase() === templateName.toLowerCase())) addAddon(templateName);
    else toast.info(`"${templateName}" already added`);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#f7fdfc] p-5">
        <div className="flex items-center justify-between mb-4">
          <div><h3 className="text-base font-bold text-teal-800">Add-ons</h3><p className="mt-0.5 text-xs text-stone-500">Optional extras customers can add</p></div>
          <button type="button" onClick={() => addAddon()} className="rounded-lg bg-teal-700/10 px-3 py-1.5 text-xs font-semibold text-teal-700 transition hover:bg-teal-700/20"><Plus className="mr-1 inline h-3 w-3" />Custom</button>
        </div>
        <div className="mb-4">
          <span className="text-xs font-semibold text-[#134e4a] mb-2 block">Quick Add:</span>
          <div className="flex flex-wrap gap-1.5">
            {ADDON_TEMPLATES.map(t => (
              <button key={t} type="button" onClick={() => addFromTemplate(t)} className="rounded-full border border-[#e7d9c4] bg-white px-2.5 py-1 text-[11px] font-medium text-stone-600 transition hover:border-teal-600 hover:bg-teal-50 hover:text-teal-700">+ {t}</button>
            ))}
          </div>
        </div>
        {draft.addons.length === 0 ? (
          <p className="text-center text-sm text-stone-400 py-4">No add-ons yet.</p>
        ) : (
          <div className="space-y-2">
            {draft.addons.map((addon, i) => (
              <div key={i} className="grid grid-cols-[1fr_90px_1fr_32px] gap-2 items-center">
                <input className={inputClass} value={addon.name} onChange={e => updateAddon(i, 'name', e.target.value)} placeholder="Add-on name" />
                <div className="relative"><span className="absolute left-2.5 top-2.5 text-xs text-stone-400">₹</span>
                  <input className={`${inputClass} pl-6`} type="number" value={addon.price} onChange={e => updateAddon(i, 'price', e.target.value)} placeholder="0" /></div>
                <input className={inputClass} value={addon.description} onChange={e => updateAddon(i, 'description', e.target.value)} placeholder="Description" />
                <button type="button" onClick={() => removeAddon(i)} className="flex h-9 w-9 items-center justify-center rounded-lg text-red-400 hover:bg-red-50"><X className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Step 8: Preview ────────────────────────────────────────────────────────── */
function StepPreview({ draft }: { draft: Draft }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#f7fdfc] p-5">
        <h3 className="mb-4 text-base font-bold text-teal-800">Preview</h3>
        <div className="overflow-hidden rounded-2xl border border-[#eadfcf] bg-white shadow-sm">
          {draft.cover_file || draft.cover_url ? (
            <div className="h-36 overflow-hidden"><img src={draft.cover_file ? URL.createObjectURL(draft.cover_file) : draft.cover_url} alt="Cover" className="w-full h-full object-cover" /></div>
          ) : (
            <div className="flex h-36 items-center justify-center bg-gradient-to-br from-teal-50 to-amber-50"><Truck className="h-8 w-8 text-teal-700/40" /></div>
          )}
          <div className="p-5">
            <div className="flex items-start justify-between">
              <h4 className="text-lg font-bold text-[#134e4a]">{draft.name || 'Package Name'}</h4>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${draft.status === 'active' ? 'bg-teal-100 text-teal-700' : draft.status === 'paused' ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>{draft.status}</span>
            </div>
            {draft.package_type && <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-0.5 text-[11px] font-medium text-teal-800"><Truck className="h-3 w-3" />{draft.package_type}</span>}
            {draft.description && <p className="mt-2 text-sm text-stone-500 line-clamp-2">{draft.description}</p>}
            {draft.price && <p className="mt-2 text-2xl font-bold text-teal-700">₹{Number(draft.price || 0).toLocaleString('en-IN')}<span className="text-xs font-normal text-stone-500 ml-1">/{draft.rental_type.replace('per_','').replace('package_price','pkg')}</span></p>}
            {draft.advance_percentage && <p className="text-xs text-stone-500">Advance: {draft.advance_percentage}%</p>}
            <p className="mt-1 text-xs text-stone-500">Inventory: {draft.available_units}/{draft.inventory_quantity} available</p>
            {draft.included_items.length > 0 && (
              <div className="mt-3 border-t border-stone-100 pt-3">
                <p className="text-xs font-semibold text-stone-600 mb-1.5">Included:</p>
                <div className="flex flex-wrap gap-1">{draft.included_items.map(s => <span key={s} className="rounded-full bg-teal-700/8 px-2 py-0.5 text-[11px] text-teal-700">{s}</span>)}</div>
              </div>
            )}
            {draft.available_cities.length > 0 && (
              <div className="mt-3 border-t border-stone-100 pt-3">
                <p className="text-xs font-semibold text-stone-600 mb-1.5">Cities:</p>
                <div className="flex flex-wrap gap-1">{draft.available_cities.map(c => <span key={c} className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">{c}</span>)}</div>
              </div>
            )}
            {draft.addons.filter(a => a.name.trim()).length > 0 && (
              <div className="mt-3 border-t border-stone-100 pt-3">
                <p className="text-xs font-semibold text-stone-600 mb-1.5">Add-ons:</p>
                {draft.addons.filter(a => a.name.trim()).map((a, i) => (
                  <div key={i} className="flex justify-between text-xs mt-1"><span className="text-stone-700">{a.name}</span>{a.price && <span className="font-semibold text-amber-800">+₹{Number(a.price).toLocaleString('en-IN')}</span>}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
