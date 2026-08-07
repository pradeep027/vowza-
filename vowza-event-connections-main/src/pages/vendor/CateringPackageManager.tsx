import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Copy, Trash2, Eye, EyeOff, Utensils, Users, X,
  Check, ChevronRight, ChevronLeft, GripVertical, Star, Leaf,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/* ─── Constants ─────────────────────────────────────────────────────────────── */
const CUISINE_OPTIONS = ['Pure Vegetarian', 'Non-Vegetarian', 'Jain Food', 'Vegan', 'Multi Cuisine'];
const SERVICE_TYPES = ['Wedding', 'Reception', 'Birthday', 'Corporate', 'Outdoor', 'Indoor', 'Live Counters'];
const SERVING_STYLES = ['Buffet', 'Plated Service', 'Banana Leaf', 'Live Stations', 'Family Style'];
const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'High Tea', 'Snacks'];

const STEP_LABELS = ['Basic Info', 'Pricing & Guests', "What's Included", 'Menu Builder', 'Cuisine & Services', 'Add-ons & Preview'];

const DEFAULT_PLATE_INCLUDES: PlateInclude[] = [
  { section: 'Welcome Drinks', quantity: '1' },
  { section: 'Starters', quantity: '2' },
  { section: 'Soups', quantity: '1' },
  { section: 'Main Course', quantity: '5' },
  { section: 'Rice', quantity: '1' },
  { section: 'Breads', quantity: '2' },
  { section: 'Desserts', quantity: '2' },
  { section: 'Ice Cream', quantity: '1' },
  { section: 'Salads', quantity: 'Unlimited' },
  { section: 'Papad', quantity: 'Included' },
  { section: 'Pickle', quantity: 'Included' },
  { section: 'Water', quantity: 'Included' },
];

/* ─── Types ─────────────────────────────────────────────────────────────────── */
type PlateInclude = { section: string; quantity: string };
type Addon = { name: string; price: string; description: string };
type MenuItem = { name: string; is_veg: boolean; is_premium: boolean; is_bestseller: boolean };
type MenuSection = { name: string; items: MenuItem[] };

type Draft = {
  id?: string;
  name: string;
  description: string;
  price_per_plate: string;
  starting_price: string;
  min_guests: string;
  max_guests: string;
  recommended_guests: string;
  is_veg: boolean;
  is_nonveg: boolean;
  is_jain: boolean;
  status: string;
  cuisine_types: string[];
  service_types: string[];
  meal_types: string[];
  serving_styles: string[];
  plate_includes: PlateInclude[];
  menu_sections: MenuSection[];
  addons: Addon[];
};

const blank = (): Draft => ({
  name: '', description: '', price_per_plate: '', starting_price: '',
  min_guests: '50', max_guests: '500', recommended_guests: '',
  is_veg: true, is_nonveg: false, is_jain: false, status: 'draft',
  cuisine_types: [], service_types: [], meal_types: [], serving_styles: [],
  plate_includes: [...DEFAULT_PLATE_INCLUDES],
  menu_sections: [], addons: [],
});

const inputClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition placeholder:text-stone-400 focus:border-[#8b1538] focus:ring-2 focus:ring-[#8b1538]/15';

/* ─── Main Component ────────────────────────────────────────────────────────── */
export default function CateringPackageManager({ provider }: { provider: any }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['catering-packages', provider.id],
    queryFn: async () => {
      const r = await supabase.from('catering_packages' as any).select('*').eq('provider_id', provider.id).order('created_at', { ascending: false });
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['catering-packages', provider.id] });

  useEffect(() => {
    const channel = supabase.channel(`catering-packages-${provider.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'catering_packages', filter: `provider_id=eq.${provider.id}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [provider.id]);

  /* ─── Edit existing package ────────────────────────────────────────────── */
  const edit = async (pkg: any) => {
    // Load menu sections and addons from their respective tables
    let menuSections: MenuSection[] = [];
    let addons: Addon[] = [];
    let plateIncludes: PlateInclude[] = [...DEFAULT_PLATE_INCLUDES];

    try {
      const secRes = await supabase.from('catering_menu_sections' as any)
        .select('id, name, sort_order').eq('package_id', pkg.id).order('sort_order');
      if (secRes.data && secRes.data.length > 0) {
        for (const sec of secRes.data) {
          const itemRes = await supabase.from('catering_menu_items' as any)
            .select('name, is_veg, is_premium, is_bestseller').eq('section_id', sec.id).order('sort_order');
          menuSections.push({
            name: sec.name,
            items: (itemRes.data ?? []).map((it: any) => ({
              name: it.name, is_veg: it.is_veg, is_premium: it.is_premium, is_bestseller: it.is_bestseller,
            })),
          });
        }
      }
      const addonRes = await supabase.from('catering_addons' as any)
        .select('name, price, description').eq('package_id', pkg.id).order('sort_order');
      if (addonRes.data) {
        addons = addonRes.data.map((a: any) => ({ name: a.name, price: String(a.price ?? ''), description: a.description || '' }));
      }
    } catch (_) { /* non-critical */ }

    // Parse plate_includes from cancellation_policy field
    if (pkg.cancellation_policy) {
      try {
        const parsed = JSON.parse(pkg.cancellation_policy);
        if (Array.isArray(parsed)) plateIncludes = parsed;
      } catch (_) { /* keep defaults */ }
    }

    setDraft({
      id: pkg.id, name: pkg.name || '', description: pkg.description || '',
      price_per_plate: String(pkg.price_per_plate ?? ''), starting_price: String(pkg.starting_price ?? ''),
      min_guests: String(pkg.min_guests ?? '50'), max_guests: String(pkg.max_guests ?? '500'),
      recommended_guests: String(pkg.recommended_guests ?? ''),
      is_veg: pkg.is_veg ?? true, is_nonveg: pkg.is_nonveg ?? false, is_jain: pkg.is_jain ?? false,
      status: pkg.status || 'draft',
      cuisine_types: pkg.cuisine_types ?? [], service_types: pkg.service_types ?? [],
      meal_types: pkg.meal_types ?? [], serving_styles: pkg.serving_styles ?? [],
      plate_includes: plateIncludes, menu_sections: menuSections, addons: addons,
    });
    setStep(1);
  };

  /* ─── Save handler ─────────────────────────────────────────────────────── */
  const save = async () => {
    if (!draft || !draft.name.trim() || !draft.price_per_plate) {
      toast.error('Package name and price per plate are required.');
      setStep(1);
      return;
    }
    setBusy(true);
    try {
      const payload: any = {
        provider_id: provider.id,
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        price_per_plate: Number(draft.price_per_plate),
        starting_price: draft.starting_price ? Number(draft.starting_price) : null,
        min_guests: Number(draft.min_guests) || 50,
        max_guests: Number(draft.max_guests) || 500,
        recommended_guests: draft.recommended_guests ? Number(draft.recommended_guests) : null,
        is_veg: draft.is_veg,
        is_nonveg: draft.is_nonveg,
        is_jain: draft.is_jain,
        status: draft.status,
        cuisine_types: draft.cuisine_types,
        service_types: draft.service_types,
        meal_types: draft.meal_types,
        serving_styles: draft.serving_styles,
        cancellation_policy: JSON.stringify(draft.plate_includes),
      };

      let packageId = draft.id;
      if (draft.id) {
        const r = await supabase.from('catering_packages' as any).update(payload).eq('id', draft.id).select('id').single();
        if (r.error) throw r.error;
      } else {
        const r = await supabase.from('catering_packages' as any).insert(payload).select('id').single();
        if (r.error) throw r.error;
        packageId = r.data.id;
      }

      // Save menu sections & items
      if (packageId) {
        // Delete existing sections (cascade deletes items)
        await supabase.from('catering_menu_sections' as any).delete().eq('package_id', packageId);
        for (let si = 0; si < draft.menu_sections.length; si++) {
          const sec = draft.menu_sections[si];
          if (!sec.name.trim()) continue;
          const secR = await supabase.from('catering_menu_sections' as any)
            .insert({ package_id: packageId, name: sec.name.trim(), sort_order: si })
            .select('id').single();
          if (secR.error || !secR.data) continue;
          const sectionId = secR.data.id;
          const validItems = sec.items.filter(it => it.name.trim());
          if (validItems.length > 0) {
            await supabase.from('catering_menu_items' as any).insert(
              validItems.map((it, ii) => ({
                section_id: sectionId, name: it.name.trim(),
                is_veg: it.is_veg, is_premium: it.is_premium, is_bestseller: it.is_bestseller,
                sort_order: ii,
              }))
            );
          }
        }

        // Save add-ons
        await supabase.from('catering_addons' as any).delete().eq('package_id', packageId);
        const validAddons = draft.addons.filter(a => a.name.trim());
        if (validAddons.length > 0) {
          await supabase.from('catering_addons' as any).insert(
            validAddons.map((a, i) => ({
              package_id: packageId, name: a.name.trim(),
              price: Number(a.price) || 0, description: a.description || null, sort_order: i,
            }))
          );
        }
      }

      toast.success('Catering package saved!');
      setDraft(null);
      setStep(1);
      refresh();
    } catch (err: any) {
      toast.error(err.message || 'Could not save package');
    } finally {
      setBusy(false);
    }
  };

  /* ─── Duplicate / Toggle / Remove ──────────────────────────────────────── */
  const duplicate = async (pkg: any) => {
    const payload: any = {
      provider_id: provider.id, name: `${pkg.name} (Copy)`, price_per_plate: pkg.price_per_plate,
      cuisine_types: pkg.cuisine_types, service_types: pkg.service_types,
      meal_types: pkg.meal_types, serving_styles: pkg.serving_styles,
      min_guests: pkg.min_guests, max_guests: pkg.max_guests,
      is_veg: pkg.is_veg, is_nonveg: pkg.is_nonveg, is_jain: pkg.is_jain,
      status: 'draft', cancellation_policy: pkg.cancellation_policy,
    };
    await supabase.from('catering_packages' as any).insert(payload);
    refresh();
    toast.success('Package duplicated');
  };

  const toggleStatus = async (pkg: any) => {
    const newStatus = pkg.status === 'active' ? 'draft' : 'active';
    await supabase.from('catering_packages' as any).update({ status: newStatus }).eq('id', pkg.id);
    refresh();
  };

  const remove = async (pkg: any) => {
    if (!confirm('Delete this package? This cannot be undone.')) return;
    await supabase.from('catering_packages' as any).delete().eq('id', pkg.id);
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
              selected.includes(opt) ? 'border-[#8b1538] bg-[#8b1538]/10 text-[#8b1538]' : 'border-[#e7d9c4] text-stone-600 hover:border-[#c99b43]'
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
      case 2: return <StepPricingGuests draft={draft} setDraft={setDraft} />;
      case 3: return <StepPlateIncludes draft={draft} setDraft={setDraft} />;
      case 4: return <StepMenuBuilder draft={draft} setDraft={setDraft} />;
      case 5: return <StepCuisineServices draft={draft} setDraft={setDraft} ChipSelect={ChipSelect} />;
      case 6: return <StepAddonsPreview draft={draft} setDraft={setDraft} />;
      default: return null;
    }
  };

  /* ─── Render ───────────────────────────────────────────────────────────── */
  return (
    <div className="max-w-[1200px] space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#3d1924]">Catering Packages</h1>
          <p className="text-sm text-muted-foreground">Create and manage your catering menus and pricing.</p>
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
          <Utensils className="h-12 w-12 text-[#8b1538]/30" />
          <p className="mt-3 font-semibold text-[#3d1924]">No packages yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create your first catering package to get started.</p>
          <button onClick={openNew} className="mt-4 rounded-xl bg-[#8B1538] px-5 py-2.5 text-sm font-semibold text-white">
            <Plus className="mr-1 inline h-4 w-4" />Create Package
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg: any) => (
            <div key={pkg.id} className="overflow-hidden rounded-2xl border border-[#eadfcf] bg-white shadow-sm transition hover:shadow-md">
              <div className="flex h-28 items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50">
                <Utensils className="h-10 w-10 text-[#8b1538]/40" />
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-bold text-[#3d1924] leading-tight">{pkg.name}</h2>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    pkg.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                    pkg.status === 'paused' ? 'bg-amber-100 text-amber-700' :
                    pkg.status === 'archived' ? 'bg-stone-100 text-stone-600' :
                    'bg-blue-50 text-blue-700'
                  }`}>{pkg.status}</span>
                </div>
                <p className="mt-1.5 text-lg font-bold text-[#8b1538]">
                  ₹{Number(pkg.price_per_plate).toLocaleString('en-IN')}
                  <span className="text-xs font-normal text-muted-foreground"> /plate</span>
                </p>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />{pkg.min_guests}–{pkg.max_guests} guests
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {(pkg.cuisine_types ?? []).slice(0, 3).map((c: string) => (
                    <span key={c} className="rounded-full bg-[#8b1538]/8 px-2 py-0.5 text-[11px] font-medium text-[#8b1538]">{c}</span>
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

      {/* ─── Wizard Modal ─────────────────────────────────────────────────── */}
      {draft && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#250914]/65 p-3 backdrop-blur-sm sm:p-6">
          <div className="mx-auto my-3 max-w-3xl overflow-hidden rounded-[24px] bg-[#fffaf3] shadow-2xl">
            {/* Header */}
            <header className="flex items-start justify-between gap-4 bg-[#70102d] px-5 py-5 sm:px-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f4d58d]">Vowza Catering</p>
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
              placeholder="e.g. Grand Wedding Feast" />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-semibold text-[#4b1d2b]">Short Description</span>
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
              <option value="archived">Archived</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}


/* ─── Step 2: Pricing & Guests ───────────────────────────────────────────────── */
function StepPricingGuests({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
        <h3 className="mb-4 text-base font-bold text-[#62132d]">Pricing</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-[#4b1d2b]">Price Per Plate <span className="text-red-500">*</span></span>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span>
              <input className={`${inputClass} pl-7`} type="number" min="0"
                value={draft.price_per_plate}
                onChange={e => setDraft({ ...draft, price_per_plate: e.target.value })}
                placeholder="0" />
            </div>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#4b1d2b]">Starting Price (optional)</span>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span>
              <input className={`${inputClass} pl-7`} type="number" min="0"
                value={draft.starting_price}
                onChange={e => setDraft({ ...draft, starting_price: e.target.value })}
                placeholder="Total package starting price" />
            </div>
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
        <h3 className="mb-4 text-base font-bold text-[#62132d]">Guest Range</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-sm font-semibold text-[#4b1d2b]">Min Guests <span className="text-red-500">*</span></span>
            <input className={inputClass} type="number" min="1"
              value={draft.min_guests}
              onChange={e => setDraft({ ...draft, min_guests: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#4b1d2b]">Max Guests <span className="text-red-500">*</span></span>
            <input className={inputClass} type="number" min="1"
              value={draft.max_guests}
              onChange={e => setDraft({ ...draft, max_guests: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#4b1d2b]">Recommended</span>
            <input className={inputClass} type="number" min="1"
              value={draft.recommended_guests}
              onChange={e => setDraft({ ...draft, recommended_guests: e.target.value })}
              placeholder="Optional" />
          </label>
        </div>
        <div className="mt-4">
          <span className="text-sm font-semibold text-[#4b1d2b]">Dietary Options</span>
          <div className="mt-2 flex flex-wrap gap-4">
            {([
              { key: 'is_veg' as const, label: 'Vegetarian', icon: '🥬' },
              { key: 'is_nonveg' as const, label: 'Non-Vegetarian', icon: '🍗' },
              { key: 'is_jain' as const, label: 'Jain', icon: '🙏' },
            ]).map(({ key, label, icon }) => (
              <label key={key} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2 text-sm transition ${
                draft[key] ? 'border-[#8b1538] bg-[#8b1538]/5' : 'border-[#e7d9c4]'
              }`}>
                <input type="checkbox" checked={draft[key]}
                  onChange={e => setDraft({ ...draft, [key]: e.target.checked })}
                  className="accent-[#8b1538]" />
                <span>{icon} {label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


/* ─── Step 3: What's Included (Per Plate) ────────────────────────────────────── */
function StepPlateIncludes({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const addInclude = () => {
    setDraft({ ...draft, plate_includes: [...draft.plate_includes, { section: '', quantity: '1' }] });
  };
  const removeInclude = (i: number) => {
    setDraft({ ...draft, plate_includes: draft.plate_includes.filter((_, idx) => idx !== i) });
  };
  const updateInclude = (i: number, field: keyof PlateInclude, value: string) => {
    const updated = [...draft.plate_includes];
    updated[i] = { ...updated[i], [field]: value };
    setDraft({ ...draft, plate_includes: updated });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-[#62132d]">What&apos;s Included Per Plate</h3>
            <p className="mt-0.5 text-xs text-stone-500">Define what one plate contains in this package</p>
          </div>
          <button type="button" onClick={addInclude}
            className="rounded-lg bg-[#8b1538]/10 px-3 py-1.5 text-xs font-semibold text-[#8b1538] transition hover:bg-[#8b1538]/20">
            <Plus className="mr-1 inline h-3 w-3" />Add Item
          </button>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_120px_36px] gap-2 text-xs font-semibold text-stone-500 px-1">
            <span>Section</span><span>Quantity</span><span></span>
          </div>
          {draft.plate_includes.map((inc, i) => (
            <div key={i} className="grid grid-cols-[1fr_120px_36px] gap-2 items-center">
              <input className={inputClass} value={inc.section}
                onChange={e => updateInclude(i, 'section', e.target.value)}
                placeholder="e.g. Starters" />
              <select className={inputClass} value={inc.quantity}
                onChange={e => updateInclude(i, 'quantity', e.target.value)}>
                {['1','2','3','4','5','6','7','8','9','10','Unlimited','Included'].map(q => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
              <button type="button" onClick={() => removeInclude(i)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-red-400 transition hover:bg-red-50 hover:text-red-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


/* ─── Step 4: Menu Builder ───────────────────────────────────────────────────── */
function StepMenuBuilder({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const addSection = () => {
    setDraft({ ...draft, menu_sections: [...draft.menu_sections, { name: '', items: [] }] });
  };
  const removeSection = (i: number) => {
    setDraft({ ...draft, menu_sections: draft.menu_sections.filter((_, idx) => idx !== i) });
  };
  const updateSectionName = (i: number, name: string) => {
    const s = [...draft.menu_sections];
    s[i] = { ...s[i], name };
    setDraft({ ...draft, menu_sections: s });
  };
  const addItem = (si: number) => {
    const s = [...draft.menu_sections];
    s[si] = { ...s[si], items: [...s[si].items, { name: '', is_veg: true, is_premium: false, is_bestseller: false }] };
    setDraft({ ...draft, menu_sections: s });
  };
  const removeItem = (si: number, ii: number) => {
    const s = [...draft.menu_sections];
    s[si] = { ...s[si], items: s[si].items.filter((_, idx) => idx !== ii) };
    setDraft({ ...draft, menu_sections: s });
  };
  const updateItem = (si: number, ii: number, field: keyof MenuItem, value: any) => {
    const s = [...draft.menu_sections];
    s[si].items[ii] = { ...s[si].items[ii], [field]: value };
    setDraft({ ...draft, menu_sections: s });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-[#62132d]">Menu Builder</h3>
            <p className="mt-0.5 text-xs text-stone-500">Add menu sections and items your customers can expect</p>
          </div>
          <button type="button" onClick={addSection}
            className="rounded-lg bg-[#8b1538]/10 px-3 py-1.5 text-xs font-semibold text-[#8b1538] transition hover:bg-[#8b1538]/20">
            <Plus className="mr-1 inline h-3 w-3" />Add Section
          </button>
        </div>

        {draft.menu_sections.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-[#e7d9c4] py-8 text-center">
            <Utensils className="mx-auto h-8 w-8 text-stone-300" />
            <p className="mt-2 text-sm text-stone-500">No menu sections yet. Add sections like Starters, Main Course, Desserts, etc.</p>
          </div>
        )}

        <div className="space-y-4">
          {draft.menu_sections.map((sec, si) => (
            <div key={si} className="rounded-xl border border-[#eadfcf] bg-white p-4">
              <div className="flex items-center gap-2 mb-3">
                <GripVertical className="h-4 w-4 text-stone-300" />
                <input className={`${inputClass} flex-1 font-semibold`} value={sec.name}
                  onChange={e => updateSectionName(si, e.target.value)}
                  placeholder="Section name (e.g. Starters)" />
                <button type="button" onClick={() => removeSection(si)}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50">Remove</button>
              </div>

              <div className="ml-6 space-y-2">
                {sec.items.map((item, ii) => (
                  <div key={ii} className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-100 bg-stone-50/50 p-2">
                    <input className="flex-1 min-w-[140px] rounded-lg border border-[#e7d9c4] bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#8b1538]"
                      value={item.name}
                      onChange={e => updateItem(si, ii, 'name', e.target.value)}
                      placeholder="Item name" />
                    <label className="flex items-center gap-1 text-xs">
                      <input type="checkbox" checked={item.is_veg}
                        onChange={e => updateItem(si, ii, 'is_veg', e.target.checked)}
                        className="accent-emerald-600" />
                      <Leaf className="h-3 w-3 text-emerald-600" />
                    </label>
                    <label className="flex items-center gap-1 text-xs text-amber-700">
                      <input type="checkbox" checked={item.is_premium}
                        onChange={e => updateItem(si, ii, 'is_premium', e.target.checked)}
                        className="accent-amber-600" />Premium
                    </label>
                    <label className="flex items-center gap-1 text-xs text-[#8b1538]">
                      <input type="checkbox" checked={item.is_bestseller}
                        onChange={e => updateItem(si, ii, 'is_bestseller', e.target.checked)}
                        className="accent-[#8b1538]" />
                      <Star className="h-3 w-3" />
                    </label>
                    <button type="button" onClick={() => removeItem(si, ii)}
                      className="ml-auto rounded p-1 text-red-400 hover:bg-red-50">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => addItem(si)}
                  className="mt-1 text-xs font-semibold text-[#8b1538] hover:underline">
                  <Plus className="mr-0.5 inline h-3 w-3" />Add Item
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


/* ─── Step 5: Cuisine & Services ─────────────────────────────────────────────── */
function StepCuisineServices({ draft, setDraft, ChipSelect }: { draft: Draft; setDraft: (d: Draft) => void; ChipSelect: any }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5 space-y-5">
        <h3 className="text-base font-bold text-[#62132d]">Cuisine & Service Details</h3>
        <ChipSelect label="Cuisine Types" options={CUISINE_OPTIONS}
          selected={draft.cuisine_types}
          onChange={(v: string[]) => setDraft({ ...draft, cuisine_types: v })} />
        <ChipSelect label="Service Types" options={SERVICE_TYPES}
          selected={draft.service_types}
          onChange={(v: string[]) => setDraft({ ...draft, service_types: v })} />
        <ChipSelect label="Meal Types" options={MEAL_TYPES}
          selected={draft.meal_types}
          onChange={(v: string[]) => setDraft({ ...draft, meal_types: v })} />
        <ChipSelect label="Serving Styles" options={SERVING_STYLES}
          selected={draft.serving_styles}
          onChange={(v: string[]) => setDraft({ ...draft, serving_styles: v })} />
      </div>
    </div>
  );
}


/* ─── Step 6: Add-ons & Preview ──────────────────────────────────────────────── */
function StepAddonsPreview({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const addAddon = () => {
    setDraft({ ...draft, addons: [...draft.addons, { name: '', price: '', description: '' }] });
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
      {/* Add-ons Section */}
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-[#62132d]">Add-ons</h3>
            <p className="mt-0.5 text-xs text-stone-500">Optional extras customers can add to their order</p>
          </div>
          <button type="button" onClick={addAddon}
            className="rounded-lg bg-[#8b1538]/10 px-3 py-1.5 text-xs font-semibold text-[#8b1538] transition hover:bg-[#8b1538]/20">
            <Plus className="mr-1 inline h-3 w-3" />Add
          </button>
        </div>

        {draft.addons.length === 0 ? (
          <p className="text-center text-sm text-stone-400 py-4">No add-ons yet. Add optional extras like Live Counters, Welcome Drinks, etc.</p>
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

      {/* Preview Card */}
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
        <h3 className="mb-4 text-base font-bold text-[#62132d]">Preview</h3>
        <div className="overflow-hidden rounded-2xl border border-[#eadfcf] bg-white shadow-sm">
          <div className="flex h-24 items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50">
            <Utensils className="h-8 w-8 text-[#8b1538]/40" />
          </div>
          <div className="p-4">
            <div className="flex items-start justify-between">
              <h4 className="font-bold text-[#3d1924]">{draft.name || 'Package Name'}</h4>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                draft.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-50 text-blue-700'
              }`}>{draft.status}</span>
            </div>
            {draft.description && <p className="mt-1 text-xs text-stone-500 line-clamp-2">{draft.description}</p>}
            <p className="mt-2 text-xl font-bold text-[#8b1538]">
              ₹{Number(draft.price_per_plate || 0).toLocaleString('en-IN')}
              <span className="text-xs font-normal text-muted-foreground"> /plate</span>
            </p>
            <div className="mt-1.5 flex items-center gap-2 text-xs text-stone-500">
              <Users className="h-3.5 w-3.5" />{draft.min_guests || '50'}–{draft.max_guests || '500'} guests
            </div>
            {draft.cuisine_types.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1">
                {draft.cuisine_types.map(c => (
                  <span key={c} className="rounded-full bg-[#8b1538]/8 px-2 py-0.5 text-[11px] font-medium text-[#8b1538]">{c}</span>
                ))}
              </div>
            )}
            {draft.plate_includes.filter(p => p.section).length > 0 && (
              <div className="mt-3 border-t border-stone-100 pt-3">
                <p className="text-xs font-semibold text-stone-600 mb-1.5">Per Plate Includes:</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500">
                  {draft.plate_includes.filter(p => p.section).map((inc, i) => (
                    <span key={i}>{inc.section} × {inc.quantity}</span>
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
          </div>
        </div>
      </div>
    </div>
  );
}
