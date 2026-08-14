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
const EVENT_TYPES = [
  'Wedding DJ', 'Sangeet DJ', 'Reception DJ', 'Birthday Party DJ',
  'Corporate Event DJ', 'Club DJ', 'House Party DJ', 'College Fest DJ',
  'Festival DJ', 'Private Party DJ', 'Destination Wedding DJ', 'Custom',
];
const PERFORMANCE_DURATIONS = ['2 Hours', '4 Hours', '6 Hours', '8 Hours', 'Custom'];
const MUSIC_GENRES = [
  'Bollywood', 'Tollywood', 'Hollywood', 'Punjabi', 'EDM', 'Commercial',
  'Hip Hop', 'Retro', 'Rock', 'House', 'Regional', 'Sufi', 'Custom Playlist',
];
const LANGUAGES = [
  'Telugu', 'Hindi', 'English', 'Tamil', 'Kannada', 'Malayalam', 'Marathi', 'Punjabi',
];
const CROWD_CAPACITIES = ['Up to 100', 'Up to 300', 'Up to 500', 'Up to 1000', '5000+'];
const EVENT_COVERAGE = [
  'Wedding', 'Reception', 'Birthday', 'Corporate', 'Club',
  'Private Party', 'College Fest', 'Festival',
];
const EQUIPMENT_OPTIONS = [
  'DJ Console', 'Mixer', 'Controllers', 'Speakers', 'Subwoofers',
  'Wireless Microphones', 'LED Lighting', 'Laser Lights', 'Smoke Machine',
  'LED Wall', 'Projector', 'Power Backup', 'Generator', 'Dance Floor Lights', 'Backup Console',
];
const SETUP_TIMES = ['1 Hour', '2 Hours', '3 Hours', '4 Hours'];
const STAGE_SIZES = ['Small (10x10)', 'Medium (15x15)', 'Large (20x20)', 'Custom'];
const DELIVERABLE_OPTIONS = [
  'Professional DJ Performance', 'Equipment Setup', 'Sound Check',
  'Playlist Consultation', 'Custom Playlist', 'Mic Support',
  'Dance Floor Setup', 'Background Music', 'Venue Coordination', 'Event Coordination',
];
const ADDON_TEMPLATES = [
  'Extra Hour', 'LED Dance Floor', 'Cold Pyro', 'CO2 Gun', 'Confetti Blast',
  'Live Dhol', 'Live Saxophone', 'LED Wall', 'Extra Speakers', 'Extra Lighting',
  'Smoke Machine', 'Anchor',
];

const STEP_LABELS = ['Basic Info', 'Pricing', 'Performance', 'Equipment', 'Team', 'Deliverables', 'Add-ons', 'Preview'];

/* ─── Types ─────────────────────────────────────────────────────────────────── */
type Addon = { name: string; price: string; description: string };

type Draft = {
  id?: string;
  name: string;
  description: string;
  event_type: string;
  status: string;
  package_price: string;
  advance_percentage: string;
  travel_charges: string;
  outside_city_charges: string;
  equipment_transport_charges: string;
  extra_hour_charges: string;
  generator_charges: string;
  performance_duration: string;
  music_genres: string[];
  languages_supported: string[];
  crowd_capacity: string;
  playlist_requests_allowed: boolean;
  explicit_songs_allowed: boolean;
  event_coverage: string[];
  equipment: string[];
  setup_time: string;
  stage_size: string;
  backup_equipment: boolean;
  dj_count: string;
  assistant_djs: string;
  sound_engineers: string;
  lighting_operators: string;
  technicians: string;
  stage_crew: string;
  mc_host: boolean;
  mc_name: string;
  mc_experience: string;
  deliverables: string[];
  addons: Addon[];
  cover_file: File | null;
  cover_url: string;
  gallery_files: File[];
  gallery_urls: { id: string; url: string; is_cover: boolean }[];
};

const blank = (): Draft => ({
  name: '', description: '', event_type: '', status: 'draft',
  package_price: '', advance_percentage: '20',
  travel_charges: '', outside_city_charges: '',
  equipment_transport_charges: '', extra_hour_charges: '', generator_charges: '',
  performance_duration: '4 Hours',
  music_genres: [], languages_supported: [], crowd_capacity: '',
  playlist_requests_allowed: true, explicit_songs_allowed: false,
  event_coverage: [], equipment: [],
  setup_time: '2 Hours', stage_size: 'Medium (15x15)', backup_equipment: false,
  dj_count: '1', assistant_djs: '0', sound_engineers: '0',
  lighting_operators: '0', technicians: '0', stage_crew: '0',
  mc_host: false, mc_name: '', mc_experience: '',
  deliverables: [], addons: [],
  cover_file: null, cover_url: '', gallery_files: [], gallery_urls: [],
});

const inputClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition placeholder:text-stone-400 focus:border-[#8b1538] focus:ring-2 focus:ring-[#8b1538]/15';

/* ─── Main Component ────────────────────────────────────────────────────────── */
export default function DJPackageManager({ provider }: { provider: any }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['dj-packages', provider.id],
    queryFn: async () => {
      const r = await (supabase
        .from('dj_packages' as any)
        .select('*')
        .eq('provider_id', provider.id)
        .order('created_at', { ascending: false }));
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['dj-packages', provider.id] });

  useEffect(() => {
    const channel = supabase
      .channel(`dj-packages-${provider.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'dj_packages',
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
        .from('dj_addons' as any)
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
        .from('dj_gallery' as any)
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
      event_type: pkg.event_type || '',
      status: pkg.status || 'draft',
      package_price: String(pkg.package_price ?? ''),
      advance_percentage: String(pkg.advance_percentage ?? '20'),
      travel_charges: String(pkg.travel_charges ?? ''),
      outside_city_charges: String(pkg.outside_city_charges ?? ''),
      equipment_transport_charges: String(pkg.equipment_transport_charges ?? ''),
      extra_hour_charges: String(pkg.extra_hour_charges ?? ''),
      generator_charges: String(pkg.generator_charges ?? ''),
      performance_duration: pkg.performance_duration || '4 Hours',
      music_genres: pkg.music_genres ?? [],
      languages_supported: pkg.languages_supported ?? [],
      crowd_capacity: pkg.crowd_capacity || '',
      playlist_requests_allowed: pkg.playlist_requests_allowed ?? true,
      explicit_songs_allowed: pkg.explicit_songs_allowed ?? false,
      event_coverage: pkg.event_coverage ?? [],
      equipment: pkg.equipment ?? [],
      setup_time: pkg.setup_time || '2 Hours',
      stage_size: pkg.stage_size || 'Medium (15x15)',
      backup_equipment: pkg.backup_equipment ?? false,
      dj_count: String(pkg.dj_count ?? '1'),
      assistant_djs: String(pkg.assistant_djs ?? '0'),
      sound_engineers: String(pkg.sound_engineers ?? '0'),
      lighting_operators: String(pkg.lighting_operators ?? '0'),
      technicians: String(pkg.technicians ?? '0'),
      stage_crew: String(pkg.stage_crew ?? '0'),
      mc_host: pkg.mc_host ?? false,
      mc_name: pkg.mc_name || '',
      mc_experience: pkg.mc_experience || '',
      deliverables: pkg.deliverables ?? [],
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
        event_type: draft.event_type || null,
        status: draft.status,
        package_price: Number(draft.package_price),
        advance_percentage: draft.advance_percentage ? Number(draft.advance_percentage) : 20,
        travel_charges: draft.travel_charges ? Number(draft.travel_charges) : null,
        outside_city_charges: draft.outside_city_charges ? Number(draft.outside_city_charges) : null,
        equipment_transport_charges: draft.equipment_transport_charges ? Number(draft.equipment_transport_charges) : null,
        extra_hour_charges: draft.extra_hour_charges ? Number(draft.extra_hour_charges) : null,
        generator_charges: draft.generator_charges ? Number(draft.generator_charges) : null,
        performance_duration: draft.performance_duration || null,
        music_genres: draft.music_genres,
        languages_supported: draft.languages_supported,
        crowd_capacity: draft.crowd_capacity || null,
        playlist_requests_allowed: draft.playlist_requests_allowed,
        explicit_songs_allowed: draft.explicit_songs_allowed,
        event_coverage: draft.event_coverage,
        equipment: draft.equipment,
        setup_time: draft.setup_time || null,
        stage_size: draft.stage_size || null,
        backup_equipment: draft.backup_equipment,
        dj_count: draft.dj_count ? Number(draft.dj_count) : 1,
        assistant_djs: draft.assistant_djs ? Number(draft.assistant_djs) : 0,
        sound_engineers: draft.sound_engineers ? Number(draft.sound_engineers) : 0,
        lighting_operators: draft.lighting_operators ? Number(draft.lighting_operators) : 0,
        technicians: draft.technicians ? Number(draft.technicians) : 0,
        stage_crew: draft.stage_crew ? Number(draft.stage_crew) : 0,
        mc_host: draft.mc_host,
        mc_name: draft.mc_host ? (draft.mc_name.trim() || null) : null,
        mc_experience: draft.mc_host ? (draft.mc_experience.trim() || null) : null,
        deliverables: draft.deliverables,
      };

      let packageId = draft.id;
      if (draft.id) {
        const r = await (supabase
          .from('dj_packages' as any)
          .update(payload)
          .eq('id', draft.id)
          .select('id')
          .single());
        if (r.error) throw r.error;
      } else {
        const r = await (supabase
          .from('dj_packages' as any)
          .insert(payload)
          .select('id')
          .single());
        if (r.error) throw r.error;
        packageId = r.data.id;
      }

      // Save add-ons
      if (packageId) {
        await (supabase.from('dj_addons' as any).delete().eq('package_id', packageId));
        const validAddons = draft.addons.filter(a => a.name.trim());
        if (validAddons.length > 0) {
          await (supabase.from('dj_addons' as any).insert(
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
            .from('dj-media')
            .upload(path, draft.cover_file, { contentType: draft.cover_file.type });
          if (!upErr) {
            const publicUrl = supabase.storage.from('dj-media').getPublicUrl(path).data.publicUrl;
            await (supabase.from('dj_gallery' as any).delete().eq('package_id', packageId).eq('is_cover', true));
            await (supabase.from('dj_gallery' as any).insert({
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
              .from('dj-media')
              .upload(path, file, { contentType: file.type });
            if (!upErr) {
              const publicUrl = supabase.storage.from('dj-media').getPublicUrl(path).data.publicUrl;
              await (supabase.from('dj_gallery' as any).insert({
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
            .from('dj_gallery' as any)
            .select('id')
            .eq('package_id', packageId)
            .eq('is_cover', false));
          const existingIds = (existing ?? []).map((e: any) => e.id);
          const toDelete = existingIds.filter((id: string) => !currentIds.includes(id));
          if (toDelete.length > 0) {
            await (supabase.from('dj_gallery' as any).delete().in('id', toDelete));
          }
        }
      }

      toast.success('DJ package saved!');
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
    await (supabase.from('dj_packages' as any).update({ status: newStatus }).eq('id', pkg.id));
    refresh();
  };

  const remove = async (pkg: any) => {
    if (!confirm('Delete this package? This cannot be undone.')) return;
    await (supabase.from('dj_packages' as any).delete().eq('id', pkg.id));
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
      case 3: return <StepPerformance draft={draft} setDraft={setDraft} ChipSelect={ChipSelect} />;
      case 4: return <StepEquipment draft={draft} setDraft={setDraft} ChipSelect={ChipSelect} />;
      case 5: return <StepTeam draft={draft} setDraft={setDraft} />;
      case 6: return <StepDeliverables draft={draft} setDraft={setDraft} ChipSelect={ChipSelect} />;
      case 7: return <StepAddons draft={draft} setDraft={setDraft} />;
      case 8: return <StepPreview draft={draft} />;
      default: return null;
    }
  };

  /* ─── Render ───────────────────────────────────────────────────────────── */
  return (
    <div className="max-w-[1200px] space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#3d1924]">DJ Packages</h1>
          <p className="text-sm text-muted-foreground">Create and manage your DJ packages and pricing.</p>
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
          <Music className="h-12 w-12 text-[#8b1538]/30" />
          <p className="mt-3 font-semibold text-[#3d1924]">No packages yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create your first DJ package to get started.</p>
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
                  <div className="flex h-28 items-center justify-center bg-gradient-to-br from-rose-50 to-purple-50">
                    <Music className="h-10 w-10 text-[#8b1538]/40" />
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
                  {pkg.event_type && (
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Music className="h-3.5 w-3.5" />
                      {pkg.event_type}
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
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f4d58d]">Vowza DJ</p>
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
                      {i < 7 && <div className={`mx-1 h-0.5 flex-1 rounded ${isCompleted ? 'bg-emerald-400' : 'bg-[#e7d9c4]'}`} />}
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
              {step < 8 ? (
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
              placeholder="e.g. Premium Wedding DJ Package" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#4b1d2b]">Event Type</span>
            <select className={inputClass} value={draft.event_type}
              onChange={e => setDraft({ ...draft, event_type: e.target.value })}>
              <option value="">Select event type</option>
              {EVENT_TYPES.map(et => <option key={et} value={et}>{et}</option>)}
            </select>
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
          <label className="block sm:col-span-2">
            <span className="text-sm font-semibold text-[#4b1d2b]">Short Description</span>
            <textarea className={`${inputClass} min-h-[80px] resize-y`} value={draft.description}
              onChange={e => setDraft({ ...draft, description: e.target.value })}
              placeholder="Describe what makes this DJ package special..." />
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
            <p className="text-xs text-stone-500 mb-2">Upload performance photos, setup shots, and event images (max 10 images)</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
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
              {(draft.gallery_urls.length + draft.gallery_files.length) < 10 && (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#d8b77b] bg-[#fffdf9] aspect-square transition hover:border-[#8b1538]">
                  <Plus className="h-5 w-5 text-[#8b1538]" />
                  <span className="text-[10px] text-stone-500 mt-1">Add photo</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
                    onChange={e => {
                      const files = Array.from(e.target.files ?? [])
                        .filter(f => f.size <= 5 * 1024 * 1024)
                        .slice(0, 10 - draft.gallery_urls.length - draft.gallery_files.length);
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


/* ─── Step 2: Pricing (Redesigned with collapsible extra charges) ────────────── */
function StepPricing({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const [showAdditionalCharges, setShowAdditionalCharges] = useState(
    !!(draft.travel_charges || draft.outside_city_charges || draft.equipment_transport_charges || draft.extra_hour_charges || draft.generator_charges)
  );

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
              <span className="absolute right-3.5 top-2.5 text-sm text-stone-500">%</span>
              <input className={`${inputClass} pr-7`} type="number" min="0" max="100"
                value={draft.advance_percentage}
                onChange={e => setDraft({ ...draft, advance_percentage: e.target.value })}
                placeholder="20" />
            </div>
          </label>
        </div>

        {/* Collapsible Additional Charges */}
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setShowAdditionalCharges(!showAdditionalCharges)}
            className="flex items-center gap-2 rounded-lg border border-[#e7d9c4] bg-white px-4 py-2.5 text-sm font-semibold text-[#4b1d2b] transition hover:bg-[#fffaf3]"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${showAdditionalCharges ? 'rotate-180' : ''}`} />
            {showAdditionalCharges ? 'Hide' : 'Show'} Additional Charges (Optional)
          </button>

          {showAdditionalCharges && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 rounded-xl border border-[#eadfcf] bg-white p-4">
              <label className="block">
                <span className="text-sm font-semibold text-[#4b1d2b]">Travel Charges</span>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span>
                  <input className={`${inputClass} pl-7`} type="number" min="0"
                    value={draft.travel_charges}
                    onChange={e => setDraft({ ...draft, travel_charges: e.target.value })}
                    placeholder="Travel charges" />
                </div>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[#4b1d2b]">Outside City Charges</span>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span>
                  <input className={`${inputClass} pl-7`} type="number" min="0"
                    value={draft.outside_city_charges}
                    onChange={e => setDraft({ ...draft, outside_city_charges: e.target.value })}
                    placeholder="Outside city premium" />
                </div>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[#4b1d2b]">Equipment Transport Charges</span>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span>
                  <input className={`${inputClass} pl-7`} type="number" min="0"
                    value={draft.equipment_transport_charges}
                    onChange={e => setDraft({ ...draft, equipment_transport_charges: e.target.value })}
                    placeholder="Equipment transport" />
                </div>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[#4b1d2b]">Extra Hour Charges</span>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span>
                  <input className={`${inputClass} pl-7`} type="number" min="0"
                    value={draft.extra_hour_charges}
                    onChange={e => setDraft({ ...draft, extra_hour_charges: e.target.value })}
                    placeholder="Per extra hour" />
                </div>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[#4b1d2b]">Generator Charges</span>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span>
                  <input className={`${inputClass} pl-7`} type="number" min="0"
                    value={draft.generator_charges}
                    onChange={e => setDraft({ ...draft, generator_charges: e.target.value })}
                    placeholder="Generator charges" />
                </div>
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


/* ─── Step 3: Performance ────────────────────────────────────────────────────── */
function StepPerformance({ draft, setDraft, ChipSelect }: { draft: Draft; setDraft: (d: Draft) => void; ChipSelect: any }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5 space-y-5">
        <h3 className="text-base font-bold text-[#62132d]">Performance Details</h3>

        <label className="block">
          <span className="text-sm font-semibold text-[#4b1d2b]">Performance Duration</span>
          <select className={inputClass} value={draft.performance_duration}
            onChange={e => setDraft({ ...draft, performance_duration: e.target.value })}>
            {PERFORMANCE_DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>

        <ChipSelect label="Music Genres" options={MUSIC_GENRES}
          selected={draft.music_genres}
          onChange={(v: string[]) => setDraft({ ...draft, music_genres: v })} />

        <ChipSelect label="Languages Supported" options={LANGUAGES}
          selected={draft.languages_supported}
          onChange={(v: string[]) => setDraft({ ...draft, languages_supported: v })} />

        <label className="block">
          <span className="text-sm font-semibold text-[#4b1d2b]">Crowd Capacity</span>
          <select className={inputClass} value={draft.crowd_capacity}
            onChange={e => setDraft({ ...draft, crowd_capacity: e.target.value })}>
            <option value="">Select crowd capacity</option>
            {CROWD_CAPACITIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        {/* Playlist Requests */}
        <div>
          <span className="text-sm font-semibold text-[#4b1d2b]">Playlist Requests</span>
          <div className="mt-1.5 flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="playlist_requests" checked={draft.playlist_requests_allowed}
                onChange={() => setDraft({ ...draft, playlist_requests_allowed: true })}
                className="h-4 w-4 border-[#e7d9c4] text-[#8b1538] focus:ring-[#8b1538]/20" />
              <span className="text-sm text-[#3d1924]">Allowed</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="playlist_requests" checked={!draft.playlist_requests_allowed}
                onChange={() => setDraft({ ...draft, playlist_requests_allowed: false })}
                className="h-4 w-4 border-[#e7d9c4] text-[#8b1538] focus:ring-[#8b1538]/20" />
              <span className="text-sm text-[#3d1924]">Not Allowed</span>
            </label>
          </div>
        </div>

        {/* Explicit Songs */}
        <div>
          <span className="text-sm font-semibold text-[#4b1d2b]">Explicit Songs</span>
          <div className="mt-1.5 flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="explicit_songs" checked={draft.explicit_songs_allowed}
                onChange={() => setDraft({ ...draft, explicit_songs_allowed: true })}
                className="h-4 w-4 border-[#e7d9c4] text-[#8b1538] focus:ring-[#8b1538]/20" />
              <span className="text-sm text-[#3d1924]">Allowed</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="explicit_songs" checked={!draft.explicit_songs_allowed}
                onChange={() => setDraft({ ...draft, explicit_songs_allowed: false })}
                className="h-4 w-4 border-[#e7d9c4] text-[#8b1538] focus:ring-[#8b1538]/20" />
              <span className="text-sm text-[#3d1924]">Not Allowed</span>
            </label>
          </div>
        </div>

        <ChipSelect label="Event Coverage" options={EVENT_COVERAGE}
          selected={draft.event_coverage}
          onChange={(v: string[]) => setDraft({ ...draft, event_coverage: v })} />
      </div>
    </div>
  );
}


/* ─── Step 4: Equipment ──────────────────────────────────────────────────────── */
function StepEquipment({ draft, setDraft, ChipSelect }: { draft: Draft; setDraft: (d: Draft) => void; ChipSelect: any }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5 space-y-5">
        <h3 className="text-base font-bold text-[#62132d]">Equipment</h3>
        <p className="text-xs text-stone-500">Select all equipment included in this package.</p>

        <ChipSelect label="Equipment Included" options={EQUIPMENT_OPTIONS}
          selected={draft.equipment}
          onChange={(v: string[]) => setDraft({ ...draft, equipment: v })} />

        <label className="block">
          <span className="text-sm font-semibold text-[#4b1d2b]">Setup Time Required</span>
          <select className={inputClass} value={draft.setup_time}
            onChange={e => setDraft({ ...draft, setup_time: e.target.value })}>
            {SETUP_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-[#4b1d2b]">Stage Size Required</span>
          <select className={inputClass} value={draft.stage_size}
            onChange={e => setDraft({ ...draft, stage_size: e.target.value })}>
            {STAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={draft.backup_equipment}
            onChange={e => setDraft({ ...draft, backup_equipment: e.target.checked })}
            className="h-4 w-4 rounded border-[#e7d9c4] text-[#8b1538] focus:ring-[#8b1538]/20" />
          <span className="text-sm font-semibold text-[#4b1d2b]">Backup Equipment Available</span>
        </label>
      </div>
    </div>
  );
}


/* ─── Step 5: Team ───────────────────────────────────────────────────────────── */
function StepTeam({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5 space-y-5">
        <h3 className="text-base font-bold text-[#62132d]">Team</h3>
        <p className="text-xs text-stone-500">Specify team composition for this package.</p>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-sm font-semibold text-[#4b1d2b]">DJ Count</span>
            <input className={inputClass} type="number" min="1" max="10"
              value={draft.dj_count}
              onChange={e => setDraft({ ...draft, dj_count: e.target.value })}
              placeholder="1" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#4b1d2b]">Assistant DJs</span>
            <input className={inputClass} type="number" min="0" max="10"
              value={draft.assistant_djs}
              onChange={e => setDraft({ ...draft, assistant_djs: e.target.value })}
              placeholder="0" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#4b1d2b]">Sound Engineers</span>
            <input className={inputClass} type="number" min="0" max="10"
              value={draft.sound_engineers}
              onChange={e => setDraft({ ...draft, sound_engineers: e.target.value })}
              placeholder="0" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#4b1d2b]">Lighting Operators</span>
            <input className={inputClass} type="number" min="0" max="10"
              value={draft.lighting_operators}
              onChange={e => setDraft({ ...draft, lighting_operators: e.target.value })}
              placeholder="0" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#4b1d2b]">Technicians</span>
            <input className={inputClass} type="number" min="0" max="10"
              value={draft.technicians}
              onChange={e => setDraft({ ...draft, technicians: e.target.value })}
              placeholder="0" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#4b1d2b]">Stage Crew</span>
            <input className={inputClass} type="number" min="0" max="10"
              value={draft.stage_crew}
              onChange={e => setDraft({ ...draft, stage_crew: e.target.value })}
              placeholder="0" />
          </label>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={draft.mc_host}
            onChange={e => setDraft({ ...draft, mc_host: e.target.checked })}
            className="h-4 w-4 rounded border-[#e7d9c4] text-[#8b1538] focus:ring-[#8b1538]/20" />
          <span className="text-sm font-semibold text-[#4b1d2b]">MC / Host Included</span>
        </label>

        {draft.mc_host && (
          <div className="grid gap-4 sm:grid-cols-2 rounded-xl border border-[#eadfcf] bg-white p-4">
            <label className="block">
              <span className="text-sm font-semibold text-[#4b1d2b]">MC Name</span>
              <input className={inputClass} value={draft.mc_name}
                onChange={e => setDraft({ ...draft, mc_name: e.target.value })}
                placeholder="Name of the MC/Host" />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-[#4b1d2b]">MC Experience</span>
              <input className={inputClass} value={draft.mc_experience}
                onChange={e => setDraft({ ...draft, mc_experience: e.target.value })}
                placeholder="e.g. 5+ years, 200+ events" />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}


/* ─── Step 6: Deliverables ───────────────────────────────────────────────────── */
function StepDeliverables({ draft, setDraft, ChipSelect }: { draft: Draft; setDraft: (d: Draft) => void; ChipSelect: any }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5 space-y-5">
        <h3 className="text-base font-bold text-[#62132d]">Deliverables</h3>
        <p className="text-xs text-stone-500">Select what's included in this DJ package.</p>

        <ChipSelect label="Package Deliverables" options={DELIVERABLE_OPTIONS}
          selected={draft.deliverables}
          onChange={(v: string[]) => setDraft({ ...draft, deliverables: v })} />
      </div>
    </div>
  );
}


/* ─── Step 7: Add-ons (with quick template buttons) ──────────────────────────── */
function StepAddons({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const addAddon = (name?: string) => {
    setDraft({ ...draft, addons: [...draft.addons, { name: name || '', price: '', description: '' }] });
  };
  const removeAddon = (i: number) => {
    setDraft({ ...draft, addons: draft.addons.filter((_, idx) => idx !== i) });
  };
  const updateAddon = (i: number, field: keyof Addon, value: string) => {
    const a = [...draft.addons];
    a[i] = { ...a[i], [field]: value };
    setDraft({ ...draft, addons: a });
  };

  const addFromTemplate = (templateName: string) => {
    const exists = draft.addons.some(a => a.name.toLowerCase() === templateName.toLowerCase());
    if (!exists) {
      addAddon(templateName);
    } else {
      toast.info(`"${templateName}" already added`);
    }
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
            <Plus className="mr-1 inline h-3 w-3" />Custom
          </button>
        </div>

        {/* Quick Template Buttons */}
        <div className="mb-4">
          <span className="text-xs font-semibold text-[#4b1d2b] mb-2 block">Quick Add:</span>
          <div className="flex flex-wrap gap-1.5">
            {ADDON_TEMPLATES.map(t => (
              <button key={t} type="button" onClick={() => addFromTemplate(t)}
                className="rounded-full border border-[#e7d9c4] bg-white px-2.5 py-1 text-[11px] font-medium text-stone-600 transition hover:border-[#8b1538] hover:bg-[#8b1538]/5 hover:text-[#8b1538]">
                + {t}
              </button>
            ))}
          </div>
        </div>

        {draft.addons.length === 0 ? (
          <p className="text-center text-sm text-stone-400 py-4">No add-ons yet. Use quick add buttons above or add custom add-ons.</p>
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
    </div>
  );
}


/* ─── Step 8: Preview ────────────────────────────────────────────────────────── */
function StepPreview({ draft }: { draft: Draft }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
        <h3 className="mb-4 text-base font-bold text-[#62132d]">Preview</h3>
        <p className="mb-4 text-xs text-stone-500">This is how customers will see your package.</p>
        <div className="overflow-hidden rounded-2xl border border-[#eadfcf] bg-white shadow-sm">
          {/* Cover */}
          {draft.cover_file || draft.cover_url ? (
            <div className="h-36 overflow-hidden">
              <img src={draft.cover_file ? URL.createObjectURL(draft.cover_file) : draft.cover_url} alt="Cover" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="flex h-36 items-center justify-center bg-gradient-to-br from-rose-50 to-purple-50">
              <Music className="h-8 w-8 text-[#8b1538]/40" />
            </div>
          )}
          <div className="p-5">
            {/* Title & Status */}
            <div className="flex items-start justify-between">
              <h4 className="text-lg font-bold text-[#3d1924]">{draft.name || 'Package Name'}</h4>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                draft.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                draft.status === 'paused' ? 'bg-amber-100 text-amber-700' :
                'bg-blue-50 text-blue-700'
              }`}>{draft.status}</span>
            </div>
            {draft.description && <p className="mt-1 text-sm text-stone-500 line-clamp-2">{draft.description}</p>}

            {/* Price */}
            {draft.package_price && (
              <p className="mt-2 text-2xl font-bold text-[#8b1538]">
                ₹{Number(draft.package_price || 0).toLocaleString('en-IN')}
              </p>
            )}
            {draft.advance_percentage && (
              <p className="text-xs text-stone-500">Advance: {draft.advance_percentage}%</p>
            )}

            {/* Event info */}
            <div className="mt-2 flex items-center gap-2 text-xs text-stone-500">
              <Music className="h-3.5 w-3.5" />
              {draft.event_type || 'DJ'} · {draft.performance_duration}
              {draft.crowd_capacity && ` · ${draft.crowd_capacity}`}
            </div>

            {/* Genres */}
            {draft.music_genres.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {draft.music_genres.map(g => (
                  <span key={g} className="rounded-full bg-[#8b1538]/8 px-2 py-0.5 text-[11px] font-medium text-[#8b1538]">{g}</span>
                ))}
              </div>
            )}

            {/* Languages */}
            {draft.languages_supported.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {draft.languages_supported.map(l => (
                  <span key={l} className="rounded-full bg-[#f4d58d]/30 px-2 py-0.5 text-[11px] font-medium text-[#62132d]">{l}</span>
                ))}
              </div>
            )}

            {/* Equipment */}
            {draft.equipment.length > 0 && (
              <div className="mt-3 border-t border-stone-100 pt-3">
                <p className="text-xs font-semibold text-stone-600 mb-1.5">Equipment:</p>
                <div className="flex flex-wrap gap-1">
                  {draft.equipment.slice(0, 6).map(eq => (
                    <span key={eq} className="rounded-full border border-[#e7d9c4] px-2 py-0.5 text-[11px] text-stone-600">{eq}</span>
                  ))}
                  {draft.equipment.length > 6 && (
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500">+{draft.equipment.length - 6}</span>
                  )}
                </div>
                <div className="mt-1.5 flex gap-3 text-[11px] text-stone-500">
                  {draft.setup_time && <span>Setup: {draft.setup_time}</span>}
                  {draft.stage_size && <span>Stage: {draft.stage_size}</span>}
                  {draft.backup_equipment && <span className="text-emerald-600 font-medium">Backup Available</span>}
                </div>
              </div>
            )}

            {/* Team */}
            {(Number(draft.dj_count) > 0 || Number(draft.sound_engineers) > 0) && (
              <div className="mt-3 border-t border-stone-100 pt-3">
                <p className="text-xs font-semibold text-stone-600 mb-1">Team:</p>
                <p className="text-xs text-stone-500">
                  {draft.dj_count} DJ{Number(draft.dj_count) > 1 ? 's' : ''}
                  {Number(draft.assistant_djs) > 0 && ` · ${draft.assistant_djs} Assistant${Number(draft.assistant_djs) > 1 ? 's' : ''}`}
                  {Number(draft.sound_engineers) > 0 && ` · ${draft.sound_engineers} Sound Engineer${Number(draft.sound_engineers) > 1 ? 's' : ''}`}
                  {Number(draft.lighting_operators) > 0 && ` · ${draft.lighting_operators} Lighting Op${Number(draft.lighting_operators) > 1 ? 's' : ''}`}
                  {Number(draft.technicians) > 0 && ` · ${draft.technicians} Technician${Number(draft.technicians) > 1 ? 's' : ''}`}
                  {Number(draft.stage_crew) > 0 && ` · ${draft.stage_crew} Stage Crew`}
                  {draft.mc_host && ` · MC: ${draft.mc_name || 'Included'}`}
                </p>
                {draft.mc_host && draft.mc_experience && (
                  <p className="text-[11px] text-stone-400 mt-0.5">MC Exp: {draft.mc_experience}</p>
                )}
              </div>
            )}

            {/* Policies */}
            <div className="mt-3 border-t border-stone-100 pt-3 flex gap-3 text-[11px]">
              <span className={draft.playlist_requests_allowed ? 'text-emerald-600' : 'text-stone-400'}>
                Playlist Requests: {draft.playlist_requests_allowed ? 'Allowed' : 'Not Allowed'}
              </span>
              <span className={draft.explicit_songs_allowed ? 'text-amber-600' : 'text-stone-400'}>
                Explicit: {draft.explicit_songs_allowed ? 'Allowed' : 'Not Allowed'}
              </span>
            </div>

            {/* Deliverables */}
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

            {/* Add-ons */}
            {draft.addons.filter(a => a.name).length > 0 && (
              <div className="mt-3 border-t border-stone-100 pt-3">
                <p className="text-xs font-semibold text-stone-600 mb-1">Add-ons available:</p>
                <div className="flex flex-wrap gap-1">
                  {draft.addons.filter(a => a.name).map((a, i) => (
                    <span key={i} className="rounded-full border border-[#e7d9c4] px-2 py-0.5 text-[11px] text-stone-600">
                      {a.name}{a.price ? ` +₹${Number(a.price).toLocaleString('en-IN')}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Additional Charges Summary */}
            {(draft.travel_charges || draft.outside_city_charges || draft.equipment_transport_charges || draft.extra_hour_charges || draft.generator_charges) && (
              <div className="mt-3 border-t border-stone-100 pt-3">
                <p className="text-xs font-semibold text-stone-600 mb-1">Additional Charges:</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-stone-500">
                  {draft.travel_charges && <span>Travel: ₹{Number(draft.travel_charges).toLocaleString('en-IN')}</span>}
                  {draft.outside_city_charges && <span>Outside City: ₹{Number(draft.outside_city_charges).toLocaleString('en-IN')}</span>}
                  {draft.equipment_transport_charges && <span>Equip Transport: ₹{Number(draft.equipment_transport_charges).toLocaleString('en-IN')}</span>}
                  {draft.extra_hour_charges && <span>Extra Hour: ₹{Number(draft.extra_hour_charges).toLocaleString('en-IN')}/hr</span>}
                  {draft.generator_charges && <span>Generator: ₹{Number(draft.generator_charges).toLocaleString('en-IN')}</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
