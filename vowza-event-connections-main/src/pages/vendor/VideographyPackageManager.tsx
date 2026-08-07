import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Copy, Trash2, Eye, EyeOff, Video, X,
  Check, ChevronRight, ChevronLeft,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/* ─── Constants ─────────────────────────────────────────────────── */
const EVENT_TYPES = [
  'Wedding', 'Pre-Wedding', 'Engagement', 'Reception',
  'Birthday', 'Corporate', 'Music Video', 'Short Film',
  'Documentary', 'Product Shoot', 'Live Event',
];

const INCLUDED_SERVICES = [
  'Cinematic Film', 'Traditional Video', 'Highlight Reel', 'Teaser',
  'Instagram Reel', 'Drone Coverage', 'Live Streaming', 'Couple Shoot',
  '4K Recording', 'Multi Camera',
];

const DELIVERABLES = [
  'Full Wedding Film', 'Highlight Film', 'Trailer',
  'Instagram Reels', 'Raw Footage', 'USB Delivery', 'Cloud Download',
];

const EQUIPMENT_OPTIONS = [
  'DSLR', 'Cinema Camera', 'Drone', 'Gimbal',
  'Crane', 'LED Lights', 'Wireless Mic',
];

const EDITING_OPTIONS = [
  'Color Grading', 'Cinematic LUTs', 'Audio Mixing',
  'Background Music', 'Motion Graphics', 'Subtitles',
];

const COVERAGE_HOURS = ['4', '6', '8', '10', '12', '16', 'Full Day'];
const DELIVERY_TIMES = ['7 days', '14 days', '21 days', '30 days', '45 days', '60 days'];

const STEP_LABELS = [
  'Basic Info', 'Pricing', 'Coverage & Included',
  'Deliverables & Equipment', 'Team & Editing', 'Add-ons & Preview',
];

/* ─── Types ─────────────────────────────────────────────────────── */
type Addon = { name: string; price: string; description: string };

type Draft = {
  id?: string;
  name: string;
  description: string;
  status: string;
  starting_price: string;
  full_day_price: string;
  half_day_price: string;
  hourly_price: string;
  extra_hour_cost: string;
  advance_percentage: string;
  event_types: string[];
  coverage_hours: string;
  included_services: string[];
  deliverables: string[];
  delivery_time: string;
  equipment: string[];
  team_videographers: string;
  team_assistants: string;
  team_drone_operator: string;
  team_editor: string;
  editing_options: string[];
  addons: Addon[];
};

const blank = (): Draft => ({
  name: '', description: '', status: 'draft',
  starting_price: '', full_day_price: '', half_day_price: '',
  hourly_price: '', extra_hour_cost: '', advance_percentage: '50',
  event_types: [], coverage_hours: '8', included_services: [],
  deliverables: [], delivery_time: '30 days', equipment: [],
  team_videographers: '1', team_assistants: '0',
  team_drone_operator: '0', team_editor: '1',
  editing_options: [], addons: [],
});

const inputClass =
  'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition placeholder:text-stone-400 focus:border-[#8b1538] focus:ring-2 focus:ring-[#8b1538]/15';

/* ─── Main Component ────────────────────────────────────────────── */
export default function VideographyPackageManager({ provider }: { provider: any }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['videography-packages', provider.id],
    queryFn: async () => {
      const r = await supabase
        .from('videography_packages' as any)
        .select('*')
        .eq('provider_id', provider.id)
        .order('created_at', { ascending: false });
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['videography-packages', provider.id] });

  useEffect(() => {
    const channel = supabase
      .channel(`videography-packages-${provider.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public',
        table: 'videography_packages',
        filter: `provider_id=eq.${provider.id}`,
      }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [provider.id]);

  /* ─── Edit existing package ─────────────────────────────────── */
  const edit = async (pkg: any) => {
    let addons: Addon[] = [];
    try {
      const addonRes = await supabase
        .from('videography_addons' as any)
        .select('name, price, description')
        .eq('package_id', pkg.id)
        .order('sort_order');
      if (addonRes.data) {
        addons = addonRes.data.map((a: any) => ({
          name: a.name,
          price: String(a.price ?? ''),
          description: a.description || '',
        }));
      }
    } catch (_) { /* non-critical */ }

    setDraft({
      id: pkg.id,
      name: pkg.name || '',
      description: pkg.description || '',
      status: pkg.status || 'draft',
      starting_price: String(pkg.starting_price ?? ''),
      full_day_price: String(pkg.full_day_price ?? ''),
      half_day_price: String(pkg.half_day_price ?? ''),
      hourly_price: String(pkg.hourly_price ?? ''),
      extra_hour_cost: String(pkg.extra_hour_cost ?? ''),
      advance_percentage: String(pkg.advance_percentage ?? '50'),
      event_types: pkg.event_types ?? [],
      coverage_hours: String(pkg.coverage_hours ?? '8'),
      included_services: pkg.included_services ?? [],
      deliverables: pkg.deliverables ?? [],
      delivery_time: pkg.delivery_time || '30 days',
      equipment: pkg.equipment ?? [],
      team_videographers: String(pkg.team_videographers ?? '1'),
      team_assistants: String(pkg.team_assistants ?? '0'),
      team_drone_operator: String(pkg.team_drone_operator ?? '0'),
      team_editor: String(pkg.team_editor ?? '1'),
      editing_options: pkg.editing_options ?? [],
      addons,
    });
    setStep(1);
  };

  /* ─── Save handler ──────────────────────────────────────────── */
  const save = async () => {
    if (!draft || !draft.name.trim() || !draft.starting_price) {
      toast.error('Package name and starting price are required.');
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
        starting_price: Number(draft.starting_price) || 0,
        full_day_price: draft.full_day_price ? Number(draft.full_day_price) : null,
        half_day_price: draft.half_day_price ? Number(draft.half_day_price) : null,
        hourly_price: draft.hourly_price ? Number(draft.hourly_price) : null,
        extra_hour_cost: draft.extra_hour_cost ? Number(draft.extra_hour_cost) : null,
        advance_percentage: Number(draft.advance_percentage) || 50,
        event_types: draft.event_types,
        coverage_hours: draft.coverage_hours,
        included_services: draft.included_services,
        deliverables: draft.deliverables,
        delivery_time: draft.delivery_time,
        equipment: draft.equipment,
        team_videographers: Number(draft.team_videographers) || 1,
        team_assistants: Number(draft.team_assistants) || 0,
        team_drone_operator: Number(draft.team_drone_operator) || 0,
        team_editor: Number(draft.team_editor) || 1,
        editing_options: draft.editing_options,
      };

      let packageId = draft.id;
      if (draft.id) {
        const r = await supabase
          .from('videography_packages' as any)
          .update(payload).eq('id', draft.id).select('id').single();
        if (r.error) throw r.error;
      } else {
        const r = await supabase
          .from('videography_packages' as any)
          .insert(payload).select('id').single();
        if (r.error) throw r.error;
        packageId = r.data.id;
      }

      // Save add-ons
      if (packageId) {
        await supabase.from('videography_addons' as any).delete().eq('package_id', packageId);
        const validAddons = draft.addons.filter(a => a.name.trim());
        if (validAddons.length > 0) {
          await supabase.from('videography_addons' as any).insert(
            validAddons.map((a, i) => ({
              package_id: packageId,
              name: a.name.trim(),
              price: Number(a.price) || 0,
              description: a.description || null,
              sort_order: i,
            }))
          );
        }
      }

      toast.success('Videography package saved!');
      setDraft(null);
      setStep(1);
      refresh();
    } catch (err: any) {
      toast.error(err.message || 'Could not save package');
    } finally {
      setBusy(false);
    }
  };

  /* ─── Duplicate / Toggle / Remove ───────────────────────────── */
  const duplicate = async (pkg: any) => {
    const payload: any = {
      provider_id: provider.id,
      name: `${pkg.name} (Copy)`,
      starting_price: pkg.starting_price,
      event_types: pkg.event_types,
      coverage_hours: pkg.coverage_hours,
      included_services: pkg.included_services,
      deliverables: pkg.deliverables,
      equipment: pkg.equipment,
      editing_options: pkg.editing_options,
      status: 'draft',
    };
    await supabase.from('videography_packages' as any).insert(payload);
    refresh();
    toast.success('Package duplicated');
  };

  const toggleStatus = async (pkg: any) => {
    const newStatus = pkg.status === 'active' ? 'draft' : 'active';
    await supabase.from('videography_packages' as any).update({ status: newStatus }).eq('id', pkg.id);
    refresh();
  };

  const remove = async (pkg: any) => {
    if (!confirm('Delete this package? This cannot be undone.')) return;
    await supabase.from('videography_packages' as any).delete().eq('id', pkg.id);
    refresh();
    toast.success('Package deleted');
  };

  const openNew = () => { setDraft(blank()); setStep(1); };

  /* ─── Chip Multi-Select ─────────────────────────────────────── */
  const ChipSelect = ({ options, selected, onChange, label }: {
    options: string[]; selected: string[];
    onChange: (v: string[]) => void; label: string;
  }) => (
    <div>
      <span className="text-sm font-semibold text-[#4b1d2b]">{label}</span>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {options.map(opt => (
          <button key={opt} type="button"
            onClick={() => onChange(
              selected.includes(opt)
                ? selected.filter(s => s !== opt)
                : [...selected, opt]
            )}
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

  /* ─── Wizard Steps ──────────────────────────────────────────── */
  const renderStep = () => {
    if (!draft) return null;
    switch (step) {
      case 1: return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
            <h3 className="mb-4 text-base font-bold text-[#62132d]">Basic Information</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-sm font-semibold text-[#4b1d2b]">Package Name <span className="text-red-500">*</span></span>
                <input className={inputClass} value={draft.name}
                  onChange={e => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Cinematic Wedding Film" />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-semibold text-[#4b1d2b]">Description</span>
                <textarea className={`${inputClass} min-h-[80px] resize-y`} value={draft.description}
                  onChange={e => setDraft({ ...draft, description: e.target.value })}
                  placeholder="Describe what makes this package special..." />
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
            </div>
          </div>
        </div>
      );

      case 2: return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
            <h3 className="mb-4 text-base font-bold text-[#62132d]">Pricing</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-[#4b1d2b]">Starting Price <span className="text-red-500">*</span></span>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span>
                  <input className={`${inputClass} pl-7`} type="number" min="0"
                    value={draft.starting_price}
                    onChange={e => setDraft({ ...draft, starting_price: e.target.value })}
                    placeholder="0" />
                </div>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[#4b1d2b]">Full Day Price</span>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span>
                  <input className={`${inputClass} pl-7`} type="number" min="0"
                    value={draft.full_day_price}
                    onChange={e => setDraft({ ...draft, full_day_price: e.target.value })}
                    placeholder="0" />
                </div>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[#4b1d2b]">Half Day Price</span>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span>
                  <input className={`${inputClass} pl-7`} type="number" min="0"
                    value={draft.half_day_price}
                    onChange={e => setDraft({ ...draft, half_day_price: e.target.value })}
                    placeholder="0" />
                </div>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[#4b1d2b]">Hourly Price</span>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span>
                  <input className={`${inputClass} pl-7`} type="number" min="0"
                    value={draft.hourly_price}
                    onChange={e => setDraft({ ...draft, hourly_price: e.target.value })}
                    placeholder="0" />
                </div>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[#4b1d2b]">Extra Hour Cost</span>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span>
                  <input className={`${inputClass} pl-7`} type="number" min="0"
                    value={draft.extra_hour_cost}
                    onChange={e => setDraft({ ...draft, extra_hour_cost: e.target.value })}
                    placeholder="0" />
                </div>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[#4b1d2b]">Advance %</span>
                <input className={inputClass} type="number" min="0" max="100"
                  value={draft.advance_percentage}
                  onChange={e => setDraft({ ...draft, advance_percentage: e.target.value })}
                  placeholder="50" />
              </label>
            </div>
          </div>
        </div>
      );

      case 3: return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
            <h3 className="mb-4 text-base font-bold text-[#62132d]">Coverage & Included Services</h3>
            <div className="space-y-5">
              <ChipSelect label="Event Types" options={EVENT_TYPES}
                selected={draft.event_types}
                onChange={v => setDraft({ ...draft, event_types: v })} />
              <label className="block">
                <span className="text-sm font-semibold text-[#4b1d2b]">Coverage Hours</span>
                <select className={inputClass} value={draft.coverage_hours}
                  onChange={e => setDraft({ ...draft, coverage_hours: e.target.value })}>
                  {COVERAGE_HOURS.map(h => <option key={h} value={h}>{h} {h !== 'Full Day' ? 'hours' : ''}</option>)}
                </select>
              </label>
              <ChipSelect label="Included Services" options={INCLUDED_SERVICES}
                selected={draft.included_services}
                onChange={v => setDraft({ ...draft, included_services: v })} />
            </div>
          </div>
        </div>
      );

      case 4: return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
            <h3 className="mb-4 text-base font-bold text-[#62132d]">Deliverables & Equipment</h3>
            <div className="space-y-5">
              <ChipSelect label="Deliverables" options={DELIVERABLES}
                selected={draft.deliverables}
                onChange={v => setDraft({ ...draft, deliverables: v })} />
              <label className="block">
                <span className="text-sm font-semibold text-[#4b1d2b]">Delivery Time</span>
                <select className={inputClass} value={draft.delivery_time}
                  onChange={e => setDraft({ ...draft, delivery_time: e.target.value })}>
                  {DELIVERY_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <ChipSelect label="Equipment" options={EQUIPMENT_OPTIONS}
                selected={draft.equipment}
                onChange={v => setDraft({ ...draft, equipment: v })} />
            </div>
          </div>
        </div>
      );

      case 5: return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
            <h3 className="mb-4 text-base font-bold text-[#62132d]">Team & Editing</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-[#4b1d2b]">Videographers</span>
                <input className={inputClass} type="number" min="0"
                  value={draft.team_videographers}
                  onChange={e => setDraft({ ...draft, team_videographers: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[#4b1d2b]">Assistants</span>
                <input className={inputClass} type="number" min="0"
                  value={draft.team_assistants}
                  onChange={e => setDraft({ ...draft, team_assistants: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[#4b1d2b]">Drone Operator</span>
                <input className={inputClass} type="number" min="0"
                  value={draft.team_drone_operator}
                  onChange={e => setDraft({ ...draft, team_drone_operator: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-[#4b1d2b]">Editor</span>
                <input className={inputClass} type="number" min="0"
                  value={draft.team_editor}
                  onChange={e => setDraft({ ...draft, team_editor: e.target.value })} />
              </label>
            </div>
            <div className="mt-5">
              <ChipSelect label="Editing Options" options={EDITING_OPTIONS}
                selected={draft.editing_options}
                onChange={v => setDraft({ ...draft, editing_options: v })} />
            </div>
          </div>
        </div>
      );

      case 6: return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-[#62132d]">Add-ons</h3>
              <button type="button"
                onClick={() => setDraft({ ...draft, addons: [...draft.addons, { name: '', price: '', description: '' }] })}
                className="rounded-lg bg-[#8b1538]/10 px-3 py-1.5 text-xs font-semibold text-[#8b1538] transition hover:bg-[#8b1538]/20">
                <Plus className="mr-1 inline h-3 w-3" />Add
              </button>
            </div>
            {draft.addons.length === 0 && (
              <p className="text-sm text-stone-400 text-center py-4">No add-ons yet. Add optional extras for your clients.</p>
            )}
            <div className="space-y-3">
              {draft.addons.map((addon, i) => (
                <div key={i} className="grid grid-cols-[1fr_100px_36px] gap-2 items-start">
                  <div>
                    <input className={inputClass} value={addon.name}
                      onChange={e => {
                        const a = [...draft.addons]; a[i] = { ...a[i], name: e.target.value };
                        setDraft({ ...draft, addons: a });
                      }} placeholder="Add-on name" />
                    <input className={`${inputClass} mt-1`} value={addon.description}
                      onChange={e => {
                        const a = [...draft.addons]; a[i] = { ...a[i], description: e.target.value };
                        setDraft({ ...draft, addons: a });
                      }} placeholder="Description (optional)" />
                  </div>
                  <input className={inputClass} type="number" min="0" value={addon.price}
                    onChange={e => {
                      const a = [...draft.addons]; a[i] = { ...a[i], price: e.target.value };
                      setDraft({ ...draft, addons: a });
                    }} placeholder="₹" />
                  <button type="button"
                    onClick={() => setDraft({ ...draft, addons: draft.addons.filter((_, idx) => idx !== i) })}
                    className="mt-1 flex h-9 w-9 items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Preview Card */}
          <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
            <h3 className="mb-4 text-base font-bold text-[#62132d]">Preview</h3>
            <div className="overflow-hidden rounded-xl border border-[#eadfcf] bg-white">
              <div className="flex h-24 items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
                <Video className="h-8 w-8 text-[#8b1538]/40" />
              </div>
              <div className="p-4">
                <h4 className="font-bold text-[#3d1924]">{draft.name || 'Package Name'}</h4>
                <p className="mt-1 text-lg font-bold text-[#8b1538]">
                  ₹{Number(draft.starting_price || 0).toLocaleString('en-IN')}
                  <span className="text-xs font-normal text-stone-500"> starting</span>
                </p>
                {draft.coverage_hours && (
                  <p className="mt-1 text-xs text-stone-500">Coverage: {draft.coverage_hours} {draft.coverage_hours !== 'Full Day' ? 'hours' : ''}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1">
                  {draft.included_services.slice(0, 4).map(s => (
                    <span key={s} className="rounded-full bg-[#8b1538]/8 px-2 py-0.5 text-[11px] font-medium text-[#8b1538]">{s}</span>
                  ))}
                  {draft.included_services.length > 4 && (
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-500">+{draft.included_services.length - 4} more</span>
                  )}
                </div>
                <p className="mt-2 text-xs text-stone-500">
                  Team: {Number(draft.team_videographers) + Number(draft.team_assistants) + Number(draft.team_drone_operator)} crew · Delivery: {draft.delivery_time}
                </p>
              </div>
            </div>
          </div>
        </div>
      );
      default: return null;
    }
  };

  /* ─── Render ────────────────────────────────────────────────── */
  return (
    <div className="max-w-[1200px] space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#3d1924]">Videography Packages</h1>
          <p className="text-sm text-muted-foreground">Create and manage your videography packages and pricing.</p>
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
          <Video className="h-12 w-12 text-[#8b1538]/30" />
          <p className="mt-3 font-semibold text-[#3d1924]">No packages yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create your first videography package to get started.</p>
          <button onClick={openNew} className="mt-4 rounded-xl bg-[#8B1538] px-5 py-2.5 text-sm font-semibold text-white">
            <Plus className="mr-1 inline h-4 w-4" />Create Package
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg: any) => (
            <div key={pkg.id} className="overflow-hidden rounded-2xl border border-[#eadfcf] bg-white shadow-sm transition hover:shadow-md">
              <div className="flex h-28 items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
                <Video className="h-10 w-10 text-[#8b1538]/40" />
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-bold text-[#3d1924] leading-tight">{pkg.name}</h2>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    pkg.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                    pkg.status === 'paused' ? 'bg-amber-100 text-amber-700' :
                    'bg-blue-50 text-blue-700'
                  }`}>{pkg.status}</span>
                </div>
                <p className="mt-1.5 text-lg font-bold text-[#8b1538]">
                  ₹{Number(pkg.starting_price).toLocaleString('en-IN')}
                  <span className="text-xs font-normal text-muted-foreground"> starting</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Coverage: {pkg.coverage_hours} {pkg.coverage_hours !== 'Full Day' ? 'hrs' : ''}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(pkg.included_services ?? []).slice(0, 3).map((s: string) => (
                    <span key={s} className="rounded-full bg-[#8b1538]/8 px-2 py-0.5 text-[11px] font-medium text-[#8b1538]">{s}</span>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => edit(pkg)} className="flex-1 rounded-lg border border-[#e7d9c4] py-2 text-xs font-medium text-[#3d1924] transition hover:bg-[#fffaf3]">
                    <Pencil className="mr-1 inline h-3 w-3" />Edit
                  </button>
                  <button onClick={() => duplicate(pkg)} className="rounded-lg border border-[#e7d9c4] p-2 transition hover:bg-[#fffaf3]" title="Duplicate"><Copy className="h-3.5 w-3.5 text-stone-600" /></button>
                  <button onClick={() => toggleStatus(pkg)} className="rounded-lg border border-[#e7d9c4] p-2 transition hover:bg-[#fffaf3]" title="Toggle status">
                    {pkg.status === 'active' ? <EyeOff className="h-3.5 w-3.5 text-stone-600" /> : <Eye className="h-3.5 w-3.5 text-stone-600" />}
                  </button>
                  <button onClick={() => remove(pkg)} className="rounded-lg border border-red-200 p-2 transition hover:bg-red-50" title="Delete"><Trash2 className="h-3.5 w-3.5 text-red-600" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Wizard Modal ─────────────────────────────────────────── */}
      {draft && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#250914]/65 p-3 backdrop-blur-sm sm:p-6">
          <div className="mx-auto my-3 max-w-3xl overflow-hidden rounded-[24px] bg-[#fffaf3] shadow-2xl">
            {/* Header */}
            <header className="flex items-start justify-between gap-4 bg-[#70102d] px-5 py-5 sm:px-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f4d58d]">Vowza Videography</p>
                <h2 className="mt-1 text-lg font-bold text-white">{draft.id ? 'Edit Package' : 'Create New Package'}</h2>
              </div>
              <button onClick={() => { setDraft(null); setStep(1); }} className="rounded-full p-2 text-white/85 hover:bg-white/15"><X className="h-5 w-5" /></button>
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
