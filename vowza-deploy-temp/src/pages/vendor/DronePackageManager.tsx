import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, Eye, EyeOff, X, Check,
  ChevronRight, ChevronLeft, Upload, Camera,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/* ─── Constants ─────────────────────────────────────────────────────────────── */
const SERVICE_TYPES = [
  'Wedding', 'Pre-Wedding', 'Real Estate', 'Construction',
  'Agriculture', 'Surveying', 'Event Coverage', 'Film Production',
  'Corporate', 'Sports', 'Tourism', 'Industrial Inspection',
];
const COVERAGE_INCLUDES = [
  'Aerial Photos', 'Aerial Videos', 'Panoramic Shots', 'Orbit Shots',
  'Top-Down Mapping', 'Reveal Shots', 'Tracking Shots', 'Hyperlapse',
  'Timelapse', 'FPV Footage', 'Night Shots', 'Thermal Imaging',
];
const COVERAGE_DURATIONS = ['30 Minutes', '1 Hour', '2 Hours', '4 Hours', 'Full Day'];
const MAX_FLIGHT_TIMES = ['15 Minutes', '20 Minutes', '25 Minutes', '30 Minutes'];
const CAMERA_RESOLUTIONS = ['4K', '6K', '8K'];
const DRONE_FEATURES = [
  'Gimbal', 'Obstacle Avoidance', 'GPS', 'FPV', 'Night Mode',
  'Thermal Camera', '4K Camera', '6K Camera', '8K Camera',
  'Waypoint Navigation', 'ActiveTrack', 'Hyperlapse', 'Timelapse',
  'Panorama', 'HDR',
];
const DELIVERABLE_OPTIONS = [
  'Edited Photos', 'RAW Photos', 'Edited Videos', 'RAW Videos',
  'Highlight Reel', 'Instagram Reel', 'Short Film', 'Cloud Delivery',
  'Google Drive', 'Dropbox', 'USB Delivery',
];
const DELIVERY_TIMES = ['3 Days', '7 Days', '15 Days', '30 Days'];
const ADDON_TEMPLATES = [
  'Extra Flight', 'Night Flight', 'FPV Drone', 'Additional Battery',
  'Additional Pilot', 'Hyperlapse', 'Timelapse', 'Express Delivery',
];

const STEP_LABELS = ['Basic Info', 'Pricing', 'Coverage', 'Drone Details', 'Deliverables', 'Add-ons'];

/* ─── Types ─────────────────────────────────────────────────────────────────── */
type Addon = { name: string; price: string; description: string };

type Draft = {
  id?: string;
  name: string;
  description: string;
  status: string;
  package_price: string;
  advance_percentage: string;
  travel_charges_amount: string;
  extra_flight_hour_charges: string;
  flexible_pricing: boolean;
  hourly_price: string;
  half_day_price: string;
  full_day_price: string;
  coverage_duration: string;
  max_flight_time: string;
  flights_included: string;
  battery_count: string;
  coverage_indoor: boolean;
  coverage_outdoor: boolean;
  travel_radius_km: string;
  service_types: string[];
  coverage_includes: string[];
  drone_brand: string;
  drone_model: string;
  camera_resolution: string;
  drone_features: string[];
  deliverables: string[];
  delivery_time: string;
  addons: Addon[];
  cover_file: File | null;
  cover_url: string;
  gallery_files: File[];
  gallery_urls: { id: string; url: string; is_cover: boolean }[];
};

const blank = (): Draft => ({
  name: '', description: '', status: 'draft',
  package_price: '', advance_percentage: '20',
  travel_charges_amount: '', extra_flight_hour_charges: '',
  flexible_pricing: false,
  hourly_price: '', half_day_price: '', full_day_price: '',
  coverage_duration: '1 Hour',
  max_flight_time: '25 Minutes',
  flights_included: '1', battery_count: '2',
  coverage_indoor: false, coverage_outdoor: true,
  travel_radius_km: '',
  service_types: [], coverage_includes: [],
  drone_brand: '', drone_model: '', camera_resolution: '4K',
  drone_features: [],
  deliverables: [], delivery_time: '7 Days',
  addons: [],
  cover_file: null, cover_url: '', gallery_files: [], gallery_urls: [],
});

const inputClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition placeholder:text-stone-400 focus:border-[#8b1538] focus:ring-2 focus:ring-[#8b1538]/15';

/* ─── Main Component ────────────────────────────────────────────────────────── */
export default function DronePackageManager({ provider }: { provider: any }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['drone-packages', provider.id],
    queryFn: async () => {
      const r = await (supabase
        .from('drone_packages' as any)
        .select('*')
        .eq('provider_id', provider.id)
        .order('created_at', { ascending: false }));
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['drone-packages', provider.id] });

  useEffect(() => {
    const channel = supabase
      .channel(`drone-packages-${provider.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'drone_packages',
        filter: `provider_id=eq.${provider.id}`,
      }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [provider.id]);

  /* ─── Edit existing package ────────────────────────────────────────────── */
  const edit = async (pkg: any) => {
    let addons: Addon[] = [];
    let galleryUrls: { id: string; url: string; is_cover: boolean }[] = [];
    let coverUrl = '';

    try {
      const addonRes = await (supabase
        .from('drone_addons' as any)
        .select('name, price, description')
        .eq('package_id', pkg.id)
        .order('sort_order'));
      if (addonRes.data) {
        addons = addonRes.data.map((a: any) => ({
          name: a.name, price: String(a.price ?? ''), description: a.description || '',
        }));
      }
    } catch (_) { /* non-critical */ }

    try {
      const galRes = await (supabase
        .from('drone_gallery' as any)
        .select('id, public_url, is_cover, sort_order')
        .eq('package_id', pkg.id)
        .order('sort_order'));
      const gallery = (galRes.data ?? []).map((g: any) => ({
        id: g.id, url: g.public_url, is_cover: g.is_cover,
      }));
      const cover = gallery.find((g: any) => g.is_cover);
      coverUrl = cover?.url || '';
      galleryUrls = gallery;
    } catch (_) { /* non-critical */ }

    setDraft({
      id: pkg.id,
      name: pkg.name || '',
      description: pkg.description || '',
      status: pkg.status || 'draft',
      package_price: String(pkg.package_price ?? ''),
      advance_percentage: String(pkg.advance_percentage ?? '20'),
      travel_charges_amount: String(pkg.travel_charges_amount ?? ''),
      extra_flight_hour_charges: String(pkg.extra_flight_hour_charges ?? ''),
      flexible_pricing: pkg.flexible_pricing ?? false,
      hourly_price: String(pkg.hourly_price ?? ''),
      half_day_price: String(pkg.half_day_price ?? ''),
      full_day_price: String(pkg.full_day_price ?? ''),
      coverage_duration: (pkg.coverage_durations && pkg.coverage_durations[0]) || '1 Hour',
      max_flight_time: pkg.max_flight_time || '25 Minutes',
      flights_included: String(pkg.flights_included ?? '1'),
      battery_count: String(pkg.battery_count ?? '2'),
      coverage_indoor: pkg.coverage_indoor ?? false,
      coverage_outdoor: pkg.coverage_outdoor ?? true,
      travel_radius_km: String(pkg.travel_radius_km ?? ''),
      service_types: pkg.service_types ?? [],
      coverage_includes: pkg.coverage_includes ?? [],
      drone_brand: pkg.drone_brand || '',
      drone_model: pkg.drone_model || '',
      camera_resolution: pkg.camera_resolution || '4K',
      drone_features: pkg.drone_features ?? [],
      deliverables: pkg.deliverables ?? [],
      delivery_time: pkg.delivery_time || '7 Days',
      addons,
      cover_file: null, cover_url: coverUrl,
      gallery_files: [], gallery_urls: galleryUrls,
    });
    setStep(1);
  };

  /* ─── Save handler ─────────────────────────────────────────────────────── */
  const save = async () => {
    if (!draft || !draft.name.trim()) {
      toast.error('Package name is required.');
      setStep(1);
      return;
    }
    if (!draft.package_price) {
      toast.error('Package price is required.');
      setStep(2);
      return;
    }
    if (!draft.cover_file && !draft.cover_url) {
      toast.error('Cover photo is required.');
      setStep(1);
      return;
    }
    setBusy(true);
    try {
      const payload: any = {
        provider_id: provider.id,
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        status: draft.status,
        package_price: Number(draft.package_price),
        advance_percentage: draft.advance_percentage ? Number(draft.advance_percentage) : 20,
        travel_charges_amount: draft.travel_charges_amount ? Number(draft.travel_charges_amount) : null,
        extra_flight_hour_charges: draft.extra_flight_hour_charges ? Number(draft.extra_flight_hour_charges) : null,
        flexible_pricing: draft.flexible_pricing,
        hourly_price: draft.flexible_pricing && draft.hourly_price ? Number(draft.hourly_price) : null,
        half_day_price: draft.flexible_pricing && draft.half_day_price ? Number(draft.half_day_price) : null,
        full_day_price: draft.flexible_pricing && draft.full_day_price ? Number(draft.full_day_price) : null,
        coverage_durations: [draft.coverage_duration],
        max_flight_time: draft.max_flight_time || null,
        flights_included: draft.flights_included ? Number(draft.flights_included) : 1,
        battery_count: draft.battery_count ? Number(draft.battery_count) : 2,
        coverage_indoor: draft.coverage_indoor,
        coverage_outdoor: draft.coverage_outdoor,
        travel_radius_km: draft.travel_radius_km ? Number(draft.travel_radius_km) : null,
        service_types: draft.service_types,
        coverage_includes: draft.coverage_includes,
        drone_brand: draft.drone_brand.trim() || null,
        drone_model: draft.drone_model.trim() || null,
        camera_resolution: draft.camera_resolution || null,
        drone_features: draft.drone_features,
        deliverables: draft.deliverables,
        delivery_time: draft.delivery_time || null,
      };

      let packageId = draft.id;
      if (draft.id) {
        const r = await (supabase
          .from('drone_packages' as any)
          .update(payload)
          .eq('id', draft.id)
          .select('id')
          .single());
        if (r.error) throw r.error;
      } else {
        const r = await (supabase
          .from('drone_packages' as any)
          .insert(payload)
          .select('id')
          .single());
        if (r.error) throw r.error;
        packageId = r.data.id;
      }

      // Save add-ons
      if (packageId) {
        await (supabase.from('drone_addons' as any).delete().eq('package_id', packageId));
        const validAddons = draft.addons.filter(a => a.name.trim());
        if (validAddons.length > 0) {
          await (supabase.from('drone_addons' as any).insert(
            validAddons.map((a, i) => ({
              package_id: packageId,
              name: a.name.trim(),
              price: Number(a.price) || 0,
              description: a.description || null,
              sort_order: i,
            }))
          ));
        }

        // Upload cover photo
        if (draft.cover_file) {
          const ext = draft.cover_file.name.split('.').pop();
          const path = `${user!.id}/${packageId}/cover-${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from('drone-media')
            .upload(path, draft.cover_file, { contentType: draft.cover_file.type });
          if (!upErr) {
            const publicUrl = supabase.storage.from('drone-media').getPublicUrl(path).data.publicUrl;
            await (supabase.from('drone_gallery' as any).delete().eq('package_id', packageId).eq('is_cover', true));
            await (supabase.from('drone_gallery' as any).insert({
              package_id: packageId, storage_path: path,
              public_url: publicUrl, is_cover: true, sort_order: 0,
            }));
          }
        }

        // Upload new gallery files
        if (draft.gallery_files.length > 0) {
          for (let i = 0; i < draft.gallery_files.length; i++) {
            const file = draft.gallery_files[i];
            const ext = file.name.split('.').pop();
            const path = `${user!.id}/${packageId}/gallery-${crypto.randomUUID()}.${ext}`;
            const { error: upErr } = await supabase.storage
              .from('drone-media')
              .upload(path, file, { contentType: file.type });
            if (!upErr) {
              const publicUrl = supabase.storage.from('drone-media').getPublicUrl(path).data.publicUrl;
              await (supabase.from('drone_gallery' as any).insert({
                package_id: packageId, storage_path: path,
                public_url: publicUrl, is_cover: false,
                sort_order: draft.gallery_urls.length + i + 1,
              }));
            }
          }
        }

        // Delete removed gallery images
        if (draft.id) {
          const currentIds = draft.gallery_urls.map(g => g.id).filter(Boolean);
          const { data: existing } = await (supabase
            .from('drone_gallery' as any)
            .select('id')
            .eq('package_id', packageId)
            .eq('is_cover', false));
          const existingIds = (existing ?? []).map((e: any) => e.id);
          const toDelete = existingIds.filter((id: string) => !currentIds.includes(id));
          if (toDelete.length > 0) {
            await (supabase.from('drone_gallery' as any).delete().in('id', toDelete));
          }
        }
      }

      toast.success('Drone package saved!');
      setDraft(null);
      setStep(1);
      refresh();
    } catch (err: any) {
      toast.error(err.message || 'Could not save package');
    } finally {
      setBusy(false);
    }
  };

  /* ─── Toggle / Remove ────────────────────────────────────────────────── */
  const toggleStatus = async (pkg: any) => {
    const newStatus = pkg.status === 'active' ? 'draft' : 'active';
    await (supabase.from('drone_packages' as any).update({ status: newStatus }).eq('id', pkg.id));
    refresh();
  };

  const remove = async (pkg: any) => {
    if (!confirm('Delete this package? This cannot be undone.')) return;
    await (supabase.from('drone_packages' as any).delete().eq('id', pkg.id));
    refresh();
    toast.success('Package deleted');
  };

  const openNew = () => { setDraft(blank()); setStep(1); };

  /* ─── Chip Multi-Select Sub-component ──────────────────────────────────── */
  const ChipSelect = ({ options, selected, onChange, label }: { options: string[]; selected: string[]; onChange: (v: string[]) => void; label: string }) => (
    <div>
      <span className="text-sm font-semibold text-[#4b1d2b]">{label}</span>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {options.map(opt => (
          <button key={opt} type="button"
            onClick={() => onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt])}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              selected.includes(opt)
                ? 'border-[#8b1538] bg-[#8b1538]/10 text-[#8b1538]'
                : 'border-[#e7d9c4] text-stone-600 hover:border-[#c99b43]'
            }`}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );

  /* ─── Wizard Steps ─────────────────────────────────────────────────────── */
  const renderStep = () => {
    if (!draft) return null;
    switch (step) {
      case 1: return <StepBasicInfo draft={draft} setDraft={setDraft} />;
      case 2: return <StepPricing draft={draft} setDraft={setDraft} />;
      case 3: return <StepCoverage draft={draft} setDraft={setDraft} ChipSelect={ChipSelect} />;
      case 4: return <StepDroneDetails draft={draft} setDraft={setDraft} ChipSelect={ChipSelect} />;
      case 5: return <StepDeliverables draft={draft} setDraft={setDraft} ChipSelect={ChipSelect} />;
      case 6: return <StepAddons draft={draft} setDraft={setDraft} />;
      default: return null;
    }
  };

  /* ─── Render ───────────────────────────────────────────────────────────── */
  return (
    <div className="max-w-[1200px] space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#3d1924]">Drone Packages</h1>
          <p className="text-sm text-muted-foreground">Create and manage your drone photography packages and pricing.</p>
        </div>
        <button onClick={openNew} className="rounded-xl bg-[#8B1538] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#70102d]">
          <Plus className="mr-1 inline h-4 w-4" />Create Package
        </button>
      </div>

      {/* Package Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => <div key={i} className="h-64 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : packages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#eadfcf] py-16 text-center">
          <Camera className="h-12 w-12 text-[#8b1538]/30" />
          <p className="mt-3 font-semibold text-[#3d1924]">No packages yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create your first drone photography package to get started.</p>
          <button onClick={openNew} className="mt-4 rounded-xl bg-[#8B1538] px-5 py-2.5 text-sm font-semibold text-white">
            <Plus className="mr-1 inline h-4 w-4" />Create Package
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg: any) => {
            const coverImg = pkg.cover_url || '';
            return (
              <div key={pkg.id} className="overflow-hidden rounded-2xl border border-[#eadfcf] bg-[#fffaf3] shadow-sm transition hover:shadow-md">
                {coverImg ? (
                  <div className="h-28 overflow-hidden">
                    <img src={coverImg} alt={pkg.name} className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="flex h-28 items-center justify-center bg-gradient-to-br from-sky-50 to-indigo-50">
                    <Camera className="h-10 w-10 text-[#8b1538]/40" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-bold text-[#3d1924] leading-tight">{pkg.name}</h2>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      pkg.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                      pkg.status === 'paused' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-50 text-blue-700'
                    }`}>{pkg.status}</span>
                  </div>
                  {pkg.package_price && (
                    <p className="mt-1.5 text-lg font-bold text-[#8b1538]">
                      ₹{Number(pkg.package_price).toLocaleString('en-IN')}
                    </p>
                  )}
                  {(pkg.drone_brand || pkg.drone_model) && (
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Camera className="h-3.5 w-3.5" />
                      {[pkg.drone_brand, pkg.drone_model].filter(Boolean).join(' ')}
                    </div>
                  )}
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => edit(pkg)} className="flex-1 rounded-lg border border-[#e7d9c4] py-2 text-xs font-medium text-[#3d1924] transition hover:bg-[#fffaf3]">
                      <Pencil className="mr-1 inline h-3 w-3" />Edit
                    </button>
                    <button onClick={() => toggleStatus(pkg)} className="rounded-lg border border-[#e7d9c4] p-2 transition hover:bg-[#fffaf3]" title="Toggle status">
                      {pkg.status === 'active' ? <EyeOff className="h-3.5 w-3.5 text-stone-600" /> : <Eye className="h-3.5 w-3.5 text-stone-600" />}
                    </button>
                    <button onClick={() => remove(pkg)} className="rounded-lg border border-red-200 p-2 transition hover:bg-red-50" title="Delete">
                      <Trash2 className="h-3.5 w-3.5 text-red-600" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Wizard Modal ─────────────────────────────────────────────────── */}
      {draft && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#250914]/65 p-3 backdrop-blur-sm sm:p-6">
          <div className="mx-auto my-3 max-w-3xl overflow-hidden rounded-[24px] bg-[#fffaf3] shadow-2xl">
            {/* Header */}
            <header className="flex items-start justify-between gap-4 bg-[#70102d] px-5 py-5 sm:px-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f4d58d]">Vowza Drone</p>
                <h2 className="mt-1 text-lg font-bold text-white">{draft.id ? 'Edit Package' : 'Create New Package'}</h2>
              </div>
              <button onClick={() => { setDraft(null); setStep(1); }} className="rounded-full p-2 text-white/85 hover:bg-white/15">
                <X className="h-5 w-5" />
              </button>
            </header>

            {/* Progress Bar */}
            <div className="border-b border-[#eadfcf] bg-[#fffdfa] px-5 py-4 sm:px-7">
              <div className="flex items-center justify-between">
                {STEP_LABELS.map((label, i) => {
                  const stepNum = i + 1;
                  const isCompleted = step > stepNum;
                  const isCurrent = step === stepNum;
                  return (
                    <div key={i} className="flex flex-1 items-center">
                      <div className="flex flex-col items-center">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${
                          isCompleted ? 'bg-emerald-500 text-white' :
                          isCurrent ? 'bg-[#8b1538] text-white shadow-md shadow-[#8b1538]/30' :
                          'border-2 border-[#e7d9c4] text-stone-400'
                        }`}>
                          {isCompleted ? <Check className="h-4 w-4" /> : stepNum}
                        </div>
                        <span className={`mt-1 hidden text-[10px] font-medium sm:block ${
                          isCurrent ? 'text-[#8b1538]' : isCompleted ? 'text-emerald-600' : 'text-stone-400'
                        }`}>{label}</span>
                      </div>
                      {i < 5 && <div className={`mx-1 h-0.5 flex-1 rounded ${isCompleted ? 'bg-emerald-400' : 'bg-[#e7d9c4]'}`} />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step Content */}
            <div className="p-5 sm:p-7">{renderStep()}</div>

            {/* Footer Navigation */}
            <div className="flex items-center justify-between border-t border-[#eadfcf] bg-[#fffdfa]/95 px-5 py-4 backdrop-blur sm:px-7">
              <button type="button" onClick={() => step > 1 ? setStep(step - 1) : setDraft(null)}
                className="flex items-center gap-1.5 rounded-xl border border-[#d7c5ae] px-4 py-2.5 text-sm font-semibold text-[#5a3440] transition hover:bg-white">
                <ChevronLeft className="h-4 w-4" />{step === 1 ? 'Cancel' : 'Back'}
              </button>
              {step < 6 ? (
                <button type="button" onClick={() => setStep(step + 1)}
                  className="flex items-center gap-1.5 rounded-xl bg-[#8b1538] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#70102d]">
                  Next<ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button type="button" disabled={busy} onClick={save}
                  className="rounded-xl bg-[#8b1538] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#70102d] disabled:opacity-60">
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


/* ─── Step 1: Basic Info ─────────────────────────────────────────────────────── */
function StepBasicInfo({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
        <h3 className="mb-4 text-base font-bold text-[#62132d]">Basic Information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-sm font-semibold text-[#4b1d2b]">Package Name <span className="text-red-500">*</span></span>
            <input className={inputClass} value={draft.name}
              onChange={e => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Premium Aerial Wedding Package" />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-semibold text-[#4b1d2b]">Description</span>
            <textarea className={`${inputClass} min-h-[80px] resize-y`} value={draft.description}
              onChange={e => setDraft({ ...draft, description: e.target.value })}
              placeholder="Describe what makes this drone package special..." />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#4b1d2b]">Status</span>
            <select className={inputClass} value={draft.status}
              onChange={e => setDraft({ ...draft, status: e.target.value })}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </select>
          </label>

          {/* Cover Photo */}
          <div className="sm:col-span-2">
            <span className="text-sm font-semibold text-[#4b1d2b]">Cover Photo <span className="text-red-500">*</span></span>
            <p className="text-xs text-stone-500 mb-2">Recommended: 1600x900px, JPG/PNG/WEBP, max 5MB</p>
            {(draft.cover_file || draft.cover_url) ? (
              <div className="relative rounded-xl overflow-hidden border border-[#eadfcf] bg-stone-50">
                <img src={draft.cover_file ? URL.createObjectURL(draft.cover_file) : draft.cover_url} alt="Cover" className="w-full h-40 object-cover" />
                <button type="button" onClick={() => setDraft({ ...draft, cover_file: null, cover_url: '' })}
                  className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#d8b77b] bg-[#fffdf9] p-6 transition hover:border-[#8b1538] hover:bg-[#fbf0e4]">
                <Upload className="h-6 w-6 text-[#8b1538] mb-2" />
                <span className="text-sm font-semibold text-[#4b1d2b]">Upload cover photo</span>
                <span className="text-xs text-stone-500 mt-1">Drag & drop or click to browse</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f && f.size <= 5 * 1024 * 1024) setDraft({ ...draft, cover_file: f });
                    else if (f) toast.error('Max 5MB');
                  }} />
              </label>
            )}
          </div>

          {/* Gallery */}
          <div className="sm:col-span-2">
            <span className="text-sm font-semibold text-[#4b1d2b]">Gallery Images</span>
            <p className="text-xs text-stone-500 mb-2">Upload aerial shots, behind-the-scenes, and sample work (max 8 images)</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {draft.gallery_urls.map((img, i) => (
                <div key={img.id || i} className="relative rounded-xl overflow-hidden border border-[#eadfcf] aspect-square bg-stone-50">
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setDraft({ ...draft, gallery_urls: draft.gallery_urls.filter((_, idx) => idx !== i) })}
                    className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {draft.gallery_files.map((f, i) => (
                <div key={`new-${i}`} className="relative rounded-xl overflow-hidden border border-[#eadfcf] aspect-square bg-stone-50">
                  <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                  <span className="absolute top-1 left-1 rounded-full bg-[#f4d58d] px-1.5 py-0.5 text-[9px] font-bold text-[#62132d]">NEW</span>
                  <button type="button" onClick={() => setDraft({ ...draft, gallery_files: draft.gallery_files.filter((_, idx) => idx !== i) })}
                    className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {(draft.gallery_urls.length + draft.gallery_files.length) < 8 && (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#d8b77b] bg-[#fffdf9] aspect-square transition hover:border-[#8b1538]">
                  <Plus className="h-5 w-5 text-[#8b1538]" />
                  <span className="text-[10px] text-stone-500 mt-1">Add photo</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
                    onChange={e => {
                      const files = Array.from(e.target.files ?? [])
                        .filter(f => f.size <= 5 * 1024 * 1024)
                        .slice(0, 8 - draft.gallery_urls.length - draft.gallery_files.length);
                      if (files.length) setDraft({ ...draft, gallery_files: [...draft.gallery_files, ...files] });
                    }} />
                </label>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


/* ─── Step 2: Pricing ────────────────────────────────────────────────────────── */
function StepPricing({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
        <h3 className="mb-4 text-base font-bold text-[#62132d]">Pricing</h3>
        <p className="mb-4 text-xs text-stone-500">Set your package pricing. Package price is required.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-[#4b1d2b]">Package Price <span className="text-red-500">*</span></span>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span>
              <input className={`${inputClass} pl-7`} type="number" min="0"
                value={draft.package_price}
                onChange={e => setDraft({ ...draft, package_price: e.target.value })}
                placeholder="Main package price" />
            </div>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#4b1d2b]">Advance Percentage</span>
            <div className="relative">
              <input className={`${inputClass} pr-7`} type="number" min="0" max="100"
                value={draft.advance_percentage}
                onChange={e => setDraft({ ...draft, advance_percentage: e.target.value })}
                placeholder="20" />
              <span className="absolute right-3.5 top-2.5 text-sm text-stone-500">%</span>
            </div>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#4b1d2b]">Travel Charges</span>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span>
              <input className={`${inputClass} pl-7`} type="number" min="0"
                value={draft.travel_charges_amount}
                onChange={e => setDraft({ ...draft, travel_charges_amount: e.target.value })}
                placeholder="Optional travel charges" />
            </div>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#4b1d2b]">Extra Flight Hour Charges</span>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span>
              <input className={`${inputClass} pl-7`} type="number" min="0"
                value={draft.extra_flight_hour_charges}
                onChange={e => setDraft({ ...draft, extra_flight_hour_charges: e.target.value })}
                placeholder="Per extra flight hour" />
            </div>
          </label>

          {/* Flexible Pricing Toggle */}
          <div className="sm:col-span-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={draft.flexible_pricing}
                onChange={e => setDraft({ ...draft, flexible_pricing: e.target.checked })}
                className="h-4 w-4 rounded border-[#e7d9c4] text-[#8b1538] focus:ring-[#8b1538]/20" />
              <span className="text-sm font-semibold text-[#4b1d2b]">Flexible Pricing</span>
              <span className="text-xs text-stone-400">(offer hourly / half-day / full-day rates)</span>
            </label>
          </div>

          {draft.flexible_pricing && (
            <>
              <label className="block">
                <span className="text-sm font-semibold text-[#4b1d2b]">Hourly Price</span>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span>
                  <input className={`${inputClass} pl-7`} type="number" min="0"
                    value={draft.hourly_price}
                    onChange={e => setDraft({ ...draft, hourly_price: e.target.value })}
                    placeholder="Per hour rate" />
                </div>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[#4b1d2b]">Half Day Price</span>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span>
                  <input className={`${inputClass} pl-7`} type="number" min="0"
                    value={draft.half_day_price}
                    onChange={e => setDraft({ ...draft, half_day_price: e.target.value })}
                    placeholder="Half day rate" />
                </div>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[#4b1d2b]">Full Day Price</span>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span>
                  <input className={`${inputClass} pl-7`} type="number" min="0"
                    value={draft.full_day_price}
                    onChange={e => setDraft({ ...draft, full_day_price: e.target.value })}
                    placeholder="Full day rate" />
                </div>
              </label>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


/* ─── Step 3: Coverage ───────────────────────────────────────────────────────── */
function StepCoverage({ draft, setDraft, ChipSelect }: { draft: Draft; setDraft: (d: Draft) => void; ChipSelect: any }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5 space-y-5">
        <h3 className="text-base font-bold text-[#62132d]">Coverage Details</h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-[#4b1d2b]">Coverage Duration</span>
            <select className={inputClass} value={draft.coverage_duration}
              onChange={e => setDraft({ ...draft, coverage_duration: e.target.value })}>
              {COVERAGE_DURATIONS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#4b1d2b]">Maximum Flight Time</span>
            <select className={inputClass} value={draft.max_flight_time}
              onChange={e => setDraft({ ...draft, max_flight_time: e.target.value })}>
              {MAX_FLIGHT_TIMES.map(t => (
                <option key={t} value={t}>{t} per flight</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#4b1d2b]">Flights Included</span>
            <input className={inputClass} type="number" min="1" max="50"
              value={draft.flights_included}
              onChange={e => setDraft({ ...draft, flights_included: e.target.value })}
              placeholder="1" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#4b1d2b]">Battery Count</span>
            <input className={inputClass} type="number" min="1" max="20"
              value={draft.battery_count}
              onChange={e => setDraft({ ...draft, battery_count: e.target.value })}
              placeholder="2" />
          </label>
        </div>

        {/* Coverage Type */}
        <div>
          <span className="text-sm font-semibold text-[#4b1d2b]">Coverage Type</span>
          <div className="mt-1.5 flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={draft.coverage_indoor}
                onChange={e => setDraft({ ...draft, coverage_indoor: e.target.checked })}
                className="h-4 w-4 rounded border-[#e7d9c4] text-[#8b1538] focus:ring-[#8b1538]/20" />
              <span className="text-sm text-[#4b1d2b]">Indoor</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={draft.coverage_outdoor}
                onChange={e => setDraft({ ...draft, coverage_outdoor: e.target.checked })}
                className="h-4 w-4 rounded border-[#e7d9c4] text-[#8b1538] focus:ring-[#8b1538]/20" />
              <span className="text-sm text-[#4b1d2b]">Outdoor</span>
            </label>
          </div>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-[#4b1d2b]">Travel Radius (km)</span>
          <input className={inputClass} type="number" min="0"
            value={draft.travel_radius_km}
            onChange={e => setDraft({ ...draft, travel_radius_km: e.target.value })}
            placeholder="e.g. 50" />
        </label>

        <ChipSelect label="Service Types" options={SERVICE_TYPES}
          selected={draft.service_types}
          onChange={(v: string[]) => setDraft({ ...draft, service_types: v })} />

        <ChipSelect label="Coverage Includes" options={COVERAGE_INCLUDES}
          selected={draft.coverage_includes}
          onChange={(v: string[]) => setDraft({ ...draft, coverage_includes: v })} />
      </div>
    </div>
  );
}


/* ─── Step 4: Drone Details ──────────────────────────────────────────────────── */
function StepDroneDetails({ draft, setDraft, ChipSelect }: { draft: Draft; setDraft: (d: Draft) => void; ChipSelect: any }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5 space-y-5">
        <h3 className="text-base font-bold text-[#62132d]">Drone Details</h3>
        <p className="text-xs text-stone-500">Specify your drone equipment details.</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-[#4b1d2b]">Drone Brand</span>
            <input className={inputClass} value={draft.drone_brand}
              onChange={e => setDraft({ ...draft, drone_brand: e.target.value })}
              placeholder="e.g. DJI" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#4b1d2b]">Drone Model</span>
            <input className={inputClass} value={draft.drone_model}
              onChange={e => setDraft({ ...draft, drone_model: e.target.value })}
              placeholder="e.g. Mavic 3 Pro" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#4b1d2b]">Camera Resolution</span>
            <select className={inputClass} value={draft.camera_resolution}
              onChange={e => setDraft({ ...draft, camera_resolution: e.target.value })}>
              {CAMERA_RESOLUTIONS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
        </div>

        <ChipSelect label="Drone Features" options={DRONE_FEATURES}
          selected={draft.drone_features}
          onChange={(v: string[]) => setDraft({ ...draft, drone_features: v })} />
      </div>
    </div>
  );
}


/* ─── Step 5: Deliverables ───────────────────────────────────────────────────── */
function StepDeliverables({ draft, setDraft, ChipSelect }: { draft: Draft; setDraft: (d: Draft) => void; ChipSelect: any }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5 space-y-5">
        <h3 className="text-base font-bold text-[#62132d]">Deliverables</h3>
        <p className="text-xs text-stone-500">Select what's included in this drone package.</p>

        <ChipSelect label="Deliverables" options={DELIVERABLE_OPTIONS}
          selected={draft.deliverables}
          onChange={(v: string[]) => setDraft({ ...draft, deliverables: v })} />

        <label className="block">
          <span className="text-sm font-semibold text-[#4b1d2b]">Delivery Time</span>
          <select className={inputClass} value={draft.delivery_time}
            onChange={e => setDraft({ ...draft, delivery_time: e.target.value })}>
            {DELIVERY_TIMES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}


/* ─── Step 6: Add-ons & Preview ──────────────────────────────────────────────── */
function StepAddons({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const addAddon = (templateName?: string) => {
    setDraft({ ...draft, addons: [...draft.addons, { name: templateName || '', price: '', description: '' }] });
  };
  const removeAddon = (i: number) => {
    setDraft({ ...draft, addons: draft.addons.filter((_, idx) => idx !== i) });
  };
  const updateAddon = (i: number, field: keyof Addon, value: string) => {
    const a = [...draft.addons];
    a[i] = { ...a[i], [field]: value };
    setDraft({ ...draft, addons: a });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-[#62132d]">Add-ons</h3>
            <p className="mt-0.5 text-xs text-stone-500">Optional extras customers can add to their booking</p>
          </div>
          <button type="button" onClick={() => addAddon()}
            className="rounded-lg bg-[#8b1538]/10 px-3 py-1.5 text-xs font-semibold text-[#8b1538] transition hover:bg-[#8b1538]/20">
            <Plus className="mr-1 inline h-3 w-3" />Add Custom
          </button>
        </div>

        {/* Quick Template Buttons */}
        <div className="mb-4">
          <span className="text-xs font-medium text-stone-500 mb-1.5 block">Quick add:</span>
          <div className="flex flex-wrap gap-1.5">
            {ADDON_TEMPLATES.map(tpl => (
              <button key={tpl} type="button" onClick={() => addAddon(tpl)}
                className="rounded-full border border-[#e7d9c4] px-2.5 py-1 text-[11px] font-medium text-stone-600 transition hover:border-[#8b1538] hover:bg-[#8b1538]/5 hover:text-[#8b1538]">
                + {tpl}
              </button>
            ))}
          </div>
        </div>

        {draft.addons.length === 0 ? (
          <p className="text-center text-sm text-stone-400 py-4">No add-ons yet. Use quick-add buttons above or add custom extras.</p>
        ) : (
          <div className="space-y-2">
            {draft.addons.map((addon, i) => (
              <div key={i} className="grid grid-cols-[1fr_90px_1fr_32px] gap-2 items-center">
                <input className={inputClass} value={addon.name}
                  onChange={e => updateAddon(i, 'name', e.target.value)} placeholder="Add-on name" />
                <div className="relative">
                  <span className="absolute left-2.5 top-2.5 text-xs text-stone-400">₹</span>
                  <input className={`${inputClass} pl-6`} type="number" value={addon.price}
                    onChange={e => updateAddon(i, 'price', e.target.value)} placeholder="0" />
                </div>
                <input className={inputClass} value={addon.description}
                  onChange={e => updateAddon(i, 'description', e.target.value)} placeholder="Description" />
                <button type="button" onClick={() => removeAddon(i)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-red-400 hover:bg-red-50">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live Preview Card */}
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
        <h3 className="mb-4 text-base font-bold text-[#62132d]">Preview</h3>
        <div className="overflow-hidden rounded-2xl border border-[#eadfcf] bg-white shadow-sm">
          {draft.cover_file || draft.cover_url ? (
            <div className="h-32 overflow-hidden">
              <img src={draft.cover_file ? URL.createObjectURL(draft.cover_file) : draft.cover_url} alt="Cover" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center bg-gradient-to-br from-sky-50 to-indigo-50">
              <Camera className="h-8 w-8 text-[#8b1538]/40" />
            </div>
          )}
          <div className="p-4">
            <div className="flex items-start justify-between">
              <h4 className="font-bold text-[#3d1924]">{draft.name || 'Package Name'}</h4>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                draft.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-50 text-blue-700'
              }`}>{draft.status}</span>
            </div>
            {draft.description && <p className="mt-1 text-xs text-stone-500 line-clamp-2">{draft.description}</p>}
            {draft.package_price && (
              <p className="mt-2 text-xl font-bold text-[#8b1538]">
                ₹{Number(draft.package_price || 0).toLocaleString('en-IN')}
              </p>
            )}
            <div className="mt-1.5 flex items-center gap-2 text-xs text-stone-500">
              <Camera className="h-3.5 w-3.5" />
              {[draft.drone_brand, draft.drone_model].filter(Boolean).join(' ') || 'Drone'} · {draft.camera_resolution} · {draft.coverage_duration}
            </div>

            {draft.drone_features.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1">
                {draft.drone_features.slice(0, 5).map(f => (
                  <span key={f} className="rounded-full bg-[#8b1538]/8 px-2 py-0.5 text-[11px] font-medium text-[#8b1538]">{f}</span>
                ))}
                {draft.drone_features.length > 5 && (
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500">+{draft.drone_features.length - 5}</span>
                )}
              </div>
            )}

            {draft.deliverables.length > 0 && (
              <div className="mt-3 border-t border-stone-100 pt-3">
                <p className="text-xs font-semibold text-stone-600 mb-1.5">Deliverables:</p>
                <div className="flex flex-wrap gap-1">
                  {draft.deliverables.map(d => (
                    <span key={d} className="rounded-full border border-[#e7d9c4] px-2 py-0.5 text-[11px] text-stone-600">{d}</span>
                  ))}
                </div>
              </div>
            )}

            {draft.addons.filter(a => a.name).length > 0 && (
              <div className="mt-3 border-t border-stone-100 pt-3">
                <p className="text-xs font-semibold text-stone-600 mb-1">Add-ons available:</p>
                <div className="flex flex-wrap gap-1">
                  {draft.addons.filter(a => a.name).map((a, i) => (
                    <span key={i} className="rounded-full border border-[#e7d9c4] px-2 py-0.5 text-[11px] text-stone-600">
                      {a.name}{a.price ? ` +₹${a.price}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {draft.flexible_pricing && (
              <div className="mt-3 border-t border-stone-100 pt-3">
                <p className="text-xs font-semibold text-stone-600 mb-1">Flexible Pricing:</p>
                <div className="flex gap-3 text-xs text-stone-500">
                  {draft.hourly_price && <span>₹{Number(draft.hourly_price).toLocaleString('en-IN')}/hr</span>}
                  {draft.half_day_price && <span>₹{Number(draft.half_day_price).toLocaleString('en-IN')}/half-day</span>}
                  {draft.full_day_price && <span>₹{Number(draft.full_day_price).toLocaleString('en-IN')}/full-day</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
