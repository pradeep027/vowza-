import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, Eye, EyeOff, X, Check,
  ChevronRight, ChevronLeft, Upload, Sparkles, ChevronDown,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/* ─── Constants ─────────────────────────────────────────────────────────────── */
const PACKAGE_TYPES = [
  { value: 'Bridal Makeup', name: 'Bridal Makeup', services: ['HD Makeup','Hair Styling','Saree Draping','Jewellery Setting','Dupatta Setting'], deliverables: ['Bridal Makeup','Hair Styling','Touch-up','Saree Draping','Jewellery Setting'] },
  { value: 'Reception Makeup', name: 'Reception Makeup', services: ['HD Makeup','Hair Styling','Saree Draping'], deliverables: ['Reception Makeup','Hair Styling','Touch-up'] },
  { value: 'Engagement Makeup', name: 'Engagement Makeup', services: ['HD Makeup','Hair Styling','Nail Polish'], deliverables: ['Engagement Makeup','Hair Styling'] },
  { value: 'Haldi Makeup', name: 'Haldi Makeup', services: ['HD Makeup','Flower Accessories'], deliverables: ['Haldi Makeup','Hair Styling'] },
  { value: 'Mehendi Makeup', name: 'Mehendi Makeup', services: ['HD Makeup','Hair Styling'], deliverables: ['Mehendi Makeup','Hair Styling'] },
  { value: 'Party Makeup', name: 'Party Makeup', services: ['HD Makeup','Hair Styling','Eyelashes'], deliverables: ['Party Makeup','Hair Styling'] },
  { value: 'Birthday Makeup', name: 'Birthday Makeup', services: ['HD Makeup','Hair Styling'], deliverables: ['Birthday Makeup','Hair Styling'] },
  { value: 'Groom Makeup', name: 'Groom Makeup', services: ['Beard Grooming','Groom Styling','Skin Preparation'], deliverables: ['Groom Makeup','Beard Grooming'] },
  { value: 'HD Makeup', name: 'HD Makeup', services: ['HD Makeup','Skin Preparation'], deliverables: ['HD Makeup'] },
  { value: 'Airbrush Makeup', name: 'Airbrush Makeup', services: ['Airbrush Makeup','Skin Preparation'], deliverables: ['Airbrush Makeup'] },
  { value: 'Custom Package', name: 'Custom Package', services: [], deliverables: [] },
];

const ALL_SERVICES = ['HD Makeup','Airbrush Makeup','Hair Styling','Hair Extensions','Saree Draping','Lens Assistance','Eyelashes','Nail Polish','Jewellery Setting','Dupatta Setting','Veil Setting','Flower Accessories','Touch-up Kit','Trial Makeup','Skin Preparation','Beard Grooming','Groom Styling'];
const ALL_BRANDS = ['MAC','Huda Beauty','Kryolan','PAC','Bobbi Brown','Estee Lauder','Charlotte Tilbury','Forever52','Lakme','Maybelline','NYX','Sugar','Kay Beauty','Others'];
const SKIN_TYPES = ['Dry','Oily','Combination','Sensitive'];
const ALL_DELIVERABLES = ['Bridal Makeup','Hair Styling','Touch-up','Saree Draping','Jewellery Setting','Trial Session','Bride Kit','Groom Makeup','Reception Look','Party Look'];
const ADDON_TEMPLATES = ['Extra Family Makeup','Bridesmaid Makeup','Mother Makeup','Guest Makeup','Flower Jewellery','Extra Hairstyle','Second Touch-up','Extended Stay'];
const STEP_LABELS = ['Package Type','Pricing','Services','Products','Team','Deliverables','Add-ons','Preview'];

const inputClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition placeholder:text-stone-400 focus:border-[#8b1538] focus:ring-2 focus:ring-[#8b1538]/15';

/* ─── Types ─────────────────────────────────────────────────────────────────── */
type Addon = { name: string; price: string; description: string };

type Draft = {
  id?: string;
  name: string;
  description: string;
  package_type: string;
  status: string;
  package_price: string;
  advance_percentage: string;
  travel_charges: string;
  outside_city_charges: string;
  touchup_charges: string;
  early_morning_charges: string;
  late_night_charges: string;
  services_included: string[];
  brands: string[];
  skin_types: string[];
  lead_artist: string;
  assistant_artists: string;
  hair_stylists: string;
  saree_drapers: string;
  male_grooming_artist: string;
  deliverables: string[];
  addons: Addon[];
  cover_file: File | null;
  cover_url: string;
  gallery_files: File[];
  gallery_urls: { id: string; url: string; is_cover: boolean }[];
};

const blank = (): Draft => ({
  name: '', description: '', package_type: '', status: 'draft',
  package_price: '', advance_percentage: '20',
  travel_charges: '', outside_city_charges: '',
  touchup_charges: '', early_morning_charges: '', late_night_charges: '',
  services_included: [], brands: [], skin_types: [],
  lead_artist: '1', assistant_artists: '0', hair_stylists: '0',
  saree_drapers: '0', male_grooming_artist: '0',
  deliverables: [], addons: [],
  cover_file: null, cover_url: '', gallery_files: [], gallery_urls: [],
});

/* ─── Main Component ────────────────────────────────────────────────────────── */
export default function MakeupPackageManager({ provider }: { provider: any }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['makeup-packages', provider.id],
    queryFn: async () => {
      const r = await (supabase
        .from('makeup_packages' as any)
        .select('*')
        .eq('provider_id', provider.id)
        .order('created_at', { ascending: false }));
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['makeup-packages', provider.id] });

  useEffect(() => {
    const channel = supabase
      .channel(`makeup-packages-${provider.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'makeup_packages',
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
        .from('makeup_addons' as any)
        .select('name, price, description')
        .eq('package_id', pkg.id)
        .order('sort_order'));
      if (addonRes.data) {
        addons = addonRes.data.map((a: any) => ({
          name: a.name, price: String(a.price ?? ''), description: a.description || '',
        }));
      }
    } catch (_) {}

    try {
      const galRes = await (supabase
        .from('makeup_gallery' as any)
        .select('id, public_url, is_cover, sort_order')
        .eq('package_id', pkg.id)
        .order('sort_order'));
      const gallery = (galRes.data ?? []).map((g: any) => ({
        id: g.id, url: g.public_url, is_cover: g.is_cover,
      }));
      const cover = gallery.find((g: any) => g.is_cover);
      coverUrl = cover?.url || '';
      galleryUrls = gallery;
    } catch (_) {}

    setDraft({
      id: pkg.id,
      name: pkg.name || '',
      description: pkg.description || '',
      package_type: pkg.package_type || '',
      status: pkg.status || 'draft',
      package_price: String(pkg.package_price ?? ''),
      advance_percentage: String(pkg.advance_percentage ?? '20'),
      travel_charges: String(pkg.travel_charges ?? ''),
      outside_city_charges: String(pkg.outside_city_charges ?? ''),
      touchup_charges: String(pkg.touchup_charges ?? ''),
      early_morning_charges: String(pkg.early_morning_charges ?? ''),
      late_night_charges: String(pkg.late_night_charges ?? ''),
      services_included: pkg.services_included ?? [],
      brands: pkg.brands_used ?? pkg.brands ?? [],
      skin_types: pkg.skin_types ?? [],
      lead_artist: String(pkg.lead_artist ?? '1'),
      assistant_artists: String(pkg.assistant_artists ?? '0'),
      hair_stylists: String(pkg.hair_stylists ?? '0'),
      saree_drapers: String(pkg.saree_drapers ?? '0'),
      male_grooming_artist: String(pkg.male_grooming_artist ?? '0'),
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
        package_type: draft.package_type || null,
        description: draft.description.trim() || null,
        status: draft.status,
        package_price: Number(draft.package_price),
        advance_percentage: draft.advance_percentage ? Number(draft.advance_percentage) : 20,
        travel_charges: draft.travel_charges ? Number(draft.travel_charges) : null,
        outside_city_charges: draft.outside_city_charges ? Number(draft.outside_city_charges) : null,
        touchup_charges: draft.touchup_charges ? Number(draft.touchup_charges) : null,
        early_morning_charges: draft.early_morning_charges ? Number(draft.early_morning_charges) : null,
        late_night_charges: draft.late_night_charges ? Number(draft.late_night_charges) : null,
        services_included: draft.services_included,
        brands_used: draft.brands,
        skin_types: draft.skin_types,
        lead_artist: Number(draft.lead_artist) || 1,
        assistant_artists: Number(draft.assistant_artists) || 0,
        hair_stylists: Number(draft.hair_stylists) || 0,
        saree_drapers: Number(draft.saree_drapers) || 0,
        male_grooming_artist: Number(draft.male_grooming_artist) || 0,
        deliverables: draft.deliverables,
      };

      let packageId = draft.id;
      if (draft.id) {
        const r = await (supabase
          .from('makeup_packages' as any)
          .update(payload)
          .eq('id', draft.id)
          .select('id')
          .single());
        if (r.error) throw r.error;
      } else {
        const r = await (supabase
          .from('makeup_packages' as any)
          .insert(payload)
          .select('id')
          .single());
        if (r.error) throw r.error;
        packageId = r.data.id;
      }

      // Save add-ons
      if (packageId) {
        await (supabase.from('makeup_addons' as any).delete().eq('package_id', packageId));
        const validAddons = draft.addons.filter(a => a.name.trim());
        if (validAddons.length > 0) {
          await (supabase.from('makeup_addons' as any).insert(
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
            .from('makeup-media')
            .upload(path, draft.cover_file, { contentType: draft.cover_file.type });
          if (!upErr) {
            const publicUrl = supabase.storage.from('makeup-media').getPublicUrl(path).data.publicUrl;
            await (supabase.from('makeup_gallery' as any).delete().eq('package_id', packageId).eq('is_cover', true));
            await (supabase.from('makeup_gallery' as any).insert({
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
              .from('makeup-media')
              .upload(path, file, { contentType: file.type });
            if (!upErr) {
              const publicUrl = supabase.storage.from('makeup-media').getPublicUrl(path).data.publicUrl;
              await (supabase.from('makeup_gallery' as any).insert({
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
            .from('makeup_gallery' as any)
            .select('id')
            .eq('package_id', packageId)
            .eq('is_cover', false));
          const existingIds = (existing ?? []).map((e: any) => e.id);
          const toDelete = existingIds.filter((id: string) => !currentIds.includes(id));
          if (toDelete.length > 0) {
            await (supabase.from('makeup_gallery' as any).delete().in('id', toDelete));
          }
        }
      }

      toast.success('Makeup package saved!');
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
    await (supabase.from('makeup_packages' as any).update({ status: newStatus }).eq('id', pkg.id));
    refresh();
  };

  const remove = async (pkg: any) => {
    if (!confirm('Delete this package? This cannot be undone.')) return;
    await (supabase.from('makeup_packages' as any).delete().eq('id', pkg.id));
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
      case 1: return <StepPackageType draft={draft} setDraft={setDraft} />;
      case 2: return <StepPricing draft={draft} setDraft={setDraft} />;
      case 3: return <StepServices draft={draft} setDraft={setDraft} ChipSelect={ChipSelect} />;
      case 4: return <StepProducts draft={draft} setDraft={setDraft} ChipSelect={ChipSelect} />;
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
          <h1 className="text-xl font-bold text-[#3d1924]">Makeup Packages</h1>
          <p className="text-sm text-muted-foreground">Create and manage your makeup packages and pricing.</p>
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
          <Sparkles className="h-12 w-12 text-[#8b1538]/30" />
          <p className="mt-3 font-semibold text-[#3d1924]">No packages yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create your first makeup package to get started.</p>
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
                  <div className="flex h-28 items-center justify-center bg-gradient-to-br from-pink-50 to-amber-50">
                    <Sparkles className="h-10 w-10 text-[#8b1538]/40" />
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
                  {pkg.package_type && (
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Sparkles className="h-3.5 w-3.5" />
                      {pkg.package_type}
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
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f4d58d]">Vowza Makeup</p>
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
            <div className="p-5 sm:p-7 max-h-[60vh] overflow-y-auto">{renderStep()}</div>

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


/* ─── Step 1: Package Type ───────────────────────────────────────────────────── */
function StepPackageType({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  const handleTypeChange = (value: string) => {
    const selected = PACKAGE_TYPES.find(t => t.value === value);
    if (selected) {
      setDraft({
        ...draft,
        package_type: value,
        name: selected.name,
        services_included: [...selected.services],
        deliverables: [...selected.deliverables],
      });
    } else {
      setDraft({ ...draft, package_type: value });
    }
  };

  const selectedType = PACKAGE_TYPES.find(t => t.value === draft.package_type);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
        <h3 className="mb-4 text-base font-bold text-[#62132d]">Select Package Type</h3>
        <p className="mb-4 text-xs text-stone-500">Choose a makeup package type to auto-populate services and deliverables, or select Custom to start from scratch.</p>

        <select
          className={`${inputClass} text-base py-3`}
          value={draft.package_type}
          onChange={e => handleTypeChange(e.target.value)}
        >
          <option value="">Select Makeup Package Type</option>
          {PACKAGE_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.name}</option>
          ))}
        </select>

        {selectedType && selectedType.value !== 'Custom Package' && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
            <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
              <Check className="h-3.5 w-3.5" />Auto-loaded from "{selectedType.name}"
            </p>
            <p className="mt-1 text-[11px] text-emerald-600">
              {selectedType.services.length} services and {selectedType.deliverables.length} deliverables pre-populated. You can edit them in later steps.
            </p>
          </div>
        )}
      </div>

      {/* Editable Name, Description, Status, Cover, Gallery */}
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5 space-y-4">
        <h3 className="text-base font-bold text-[#62132d]">Package Info</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-sm font-semibold text-[#4b1d2b]">Package Name <span className="text-red-500">*</span></span>
            <input className={inputClass} value={draft.name}
              onChange={e => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Bridal HD Makeup Package" />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-semibold text-[#4b1d2b]">Description</span>
            <textarea className={`${inputClass} min-h-[80px] resize-y`} value={draft.description}
              onChange={e => setDraft({ ...draft, description: e.target.value })}
              placeholder="Describe what makes this makeup package special..." />
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

      {/* Cover Photo */}
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
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

      {/* Gallery Images */}
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
        <span className="text-sm font-semibold text-[#4b1d2b]">Gallery Images</span>
        <p className="text-xs text-stone-500 mb-2">Upload makeup looks, before/after shots (max 15 images)</p>
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
          {(draft.gallery_urls.length + draft.gallery_files.length) < 15 && (
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#d8b77b] bg-[#fffdf9] aspect-square transition hover:border-[#8b1538]">
              <Plus className="h-5 w-5 text-[#8b1538]" />
              <span className="text-[10px] text-stone-500 mt-1">Add photo</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
                onChange={e => {
                  const files = Array.from(e.target.files ?? [])
                    .filter(f => f.size <= 5 * 1024 * 1024)
                    .slice(0, 15 - draft.gallery_urls.length - draft.gallery_files.length);
                  if (files.length) setDraft({ ...draft, gallery_files: [...draft.gallery_files, ...files] });
                }} />
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
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
        <h3 className="mb-4 text-base font-bold text-[#62132d]">Pricing</h3>
        <p className="mb-4 text-xs text-stone-500">Set your makeup package pricing.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-[#4b1d2b]">Package Price <span className="text-red-500">*</span></span>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span>
              <input className={`${inputClass} pl-7`} type="number" min="0"
                value={draft.package_price}
                onChange={e => setDraft({ ...draft, package_price: e.target.value })}
                placeholder="Total package price" />
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
      </div>

      {/* Collapsible Additional Charges */}
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
        <button type="button" onClick={() => setShowAdditional(!showAdditional)}
          className="flex w-full items-center justify-between text-left">
          <div>
            <h3 className="text-base font-bold text-[#62132d]">Additional Charges</h3>
            <p className="text-xs text-stone-500">Optional extra charges for special conditions</p>
          </div>
          <ChevronDown className={`h-5 w-5 text-stone-400 transition ${showAdditional ? 'rotate-180' : ''}`} />
        </button>

        {showAdditional && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 border-t border-[#eadfcf] pt-4">
            <label className="block">
              <span className="text-sm font-semibold text-[#4b1d2b]">Travel Charges</span>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span>
                <input className={`${inputClass} pl-7`} type="number" min="0"
                  value={draft.travel_charges}
                  onChange={e => setDraft({ ...draft, travel_charges: e.target.value })}
                  placeholder="0" />
              </div>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-[#4b1d2b]">Outside City Charges</span>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span>
                <input className={`${inputClass} pl-7`} type="number" min="0"
                  value={draft.outside_city_charges}
                  onChange={e => setDraft({ ...draft, outside_city_charges: e.target.value })}
                  placeholder="0" />
              </div>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-[#4b1d2b]">Touch-up Charges</span>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span>
                <input className={`${inputClass} pl-7`} type="number" min="0"
                  value={draft.touchup_charges}
                  onChange={e => setDraft({ ...draft, touchup_charges: e.target.value })}
                  placeholder="0" />
              </div>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-[#4b1d2b]">Early Morning Charges</span>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span>
                <input className={`${inputClass} pl-7`} type="number" min="0"
                  value={draft.early_morning_charges}
                  onChange={e => setDraft({ ...draft, early_morning_charges: e.target.value })}
                  placeholder="0" />
              </div>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-[#4b1d2b]">Late Night Charges</span>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span>
                <input className={`${inputClass} pl-7`} type="number" min="0"
                  value={draft.late_night_charges}
                  onChange={e => setDraft({ ...draft, late_night_charges: e.target.value })}
                  placeholder="0" />
              </div>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}


/* ─── Step 3: Services ───────────────────────────────────────────────────────── */
function StepServices({ draft, setDraft, ChipSelect }: { draft: Draft; setDraft: (d: Draft) => void; ChipSelect: any }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5 space-y-5">
        <h3 className="text-base font-bold text-[#62132d]">Services Included</h3>
        <p className="text-xs text-stone-500">Select all makeup services included in this package.</p>
        <ChipSelect label="Services" options={ALL_SERVICES}
          selected={draft.services_included}
          onChange={(v: string[]) => setDraft({ ...draft, services_included: v })} />
      </div>
    </div>
  );
}


/* ─── Step 4: Products ───────────────────────────────────────────────────────── */
function StepProducts({ draft, setDraft, ChipSelect }: { draft: Draft; setDraft: (d: Draft) => void; ChipSelect: any }) {
  const [customBrandInput, setCustomBrandInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const addCustomBrand = () => {
    const name = customBrandInput.trim();
    if (!name) return;
    if (draft.brands.some(b => b.toLowerCase() === name.toLowerCase())) {
      toast.info(`"${name}" is already added`);
      return;
    }
    setDraft({ ...draft, brands: [...draft.brands, name] });
    setCustomBrandInput('');
    setShowCustomInput(false);
  };

  // Merge predefined brands with any custom brands already saved
  const allBrandOptions = Array.from(new Set([...ALL_BRANDS.filter(b => b !== 'Others'), ...draft.brands.filter(b => !ALL_BRANDS.includes(b))]));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5 space-y-5">
        <h3 className="text-base font-bold text-[#62132d]">Products & Brands</h3>
        <p className="text-xs text-stone-500">Select brands you use in this package. You can also add custom brands.</p>

        {/* Brand Chips */}
        <div>
          <span className="text-sm font-semibold text-[#4b1d2b]">Brands Used</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {allBrandOptions.map(opt => (
              <button key={opt} type="button"
                onClick={() => setDraft({ ...draft, brands: draft.brands.includes(opt) ? draft.brands.filter(s => s !== opt) : [...draft.brands, opt] })}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  draft.brands.includes(opt)
                    ? 'border-[#8b1538] bg-[#8b1538]/10 text-[#8b1538]'
                    : 'border-[#e7d9c4] text-stone-600 hover:border-[#c99b43]'
                }`}>
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Add Custom Brand */}
        {showCustomInput ? (
          <div className="rounded-xl border border-[#eadfcf] bg-[#fffdf9] p-3 space-y-2">
            <label className="block">
              <span className="text-xs font-semibold text-[#4b1d2b]">Custom Brand Name *</span>
              <input className={inputClass} value={customBrandInput} onChange={e => setCustomBrandInput(e.target.value)}
                placeholder="Enter brand name" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomBrand())} />
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={addCustomBrand} className="rounded-lg bg-[#8b1538] px-4 py-2 text-xs font-semibold text-white hover:bg-[#70102d]">Add Brand</button>
              <button type="button" onClick={() => { setShowCustomInput(false); setCustomBrandInput(''); }} className="rounded-lg border border-[#e7d9c4] px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50">Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setShowCustomInput(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-dashed border-[#8b1538]/40 bg-[#8b1538]/5 px-3 py-2 text-xs font-semibold text-[#8b1538] hover:bg-[#8b1538]/10 transition">
            + Add Custom Brand
          </button>
        )}

        {/* Skin Types */}
        <ChipSelect label="Skin Types Catered" options={SKIN_TYPES}
          selected={draft.skin_types}
          onChange={(v: string[]) => setDraft({ ...draft, skin_types: v })} />
      </div>
    </div>
  );
}


/* ─── Step 5: Team ───────────────────────────────────────────────────────────── */
function StepTeam({ draft, setDraft }: { draft: Draft; setDraft: (d: Draft) => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-5">
        <h3 className="mb-4 text-base font-bold text-[#62132d]">Team Composition</h3>
        <p className="mb-4 text-xs text-stone-500">How many artists are included in this package?</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-[#4b1d2b]">Lead Artist</span>
            <input className={inputClass} type="number" min="0"
              value={draft.lead_artist}
              onChange={e => setDraft({ ...draft, lead_artist: e.target.value })}
              placeholder="1" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#4b1d2b]">Assistant Artists</span>
            <input className={inputClass} type="number" min="0"
              value={draft.assistant_artists}
              onChange={e => setDraft({ ...draft, assistant_artists: e.target.value })}
              placeholder="0" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#4b1d2b]">Hair Stylists</span>
            <input className={inputClass} type="number" min="0"
              value={draft.hair_stylists}
              onChange={e => setDraft({ ...draft, hair_stylists: e.target.value })}
              placeholder="0" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#4b1d2b]">Saree Drapers</span>
            <input className={inputClass} type="number" min="0"
              value={draft.saree_drapers}
              onChange={e => setDraft({ ...draft, saree_drapers: e.target.value })}
              placeholder="0" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[#4b1d2b]">Male Grooming Artist</span>
            <input className={inputClass} type="number" min="0"
              value={draft.male_grooming_artist}
              onChange={e => setDraft({ ...draft, male_grooming_artist: e.target.value })}
              placeholder="0" />
          </label>
        </div>
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
        <p className="text-xs text-stone-500">Select the deliverables included in this package.</p>
        <ChipSelect label="Deliverables" options={ALL_DELIVERABLES}
          selected={draft.deliverables}
          onChange={(v: string[]) => setDraft({ ...draft, deliverables: v })} />
      </div>
    </div>
  );
}


/* ─── Step 7: Add-ons ────────────────────────────────────────────────────────── */
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
        <p className="mb-4 text-xs text-stone-500">This is how customers will see your makeup package.</p>
        <div className="overflow-hidden rounded-2xl border border-[#eadfcf] bg-white shadow-sm">
          {/* Cover */}
          {draft.cover_file || draft.cover_url ? (
            <div className="h-36 overflow-hidden">
              <img src={draft.cover_file ? URL.createObjectURL(draft.cover_file) : draft.cover_url} alt="Cover" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="flex h-36 items-center justify-center bg-gradient-to-br from-pink-50 to-amber-50">
              <Sparkles className="h-8 w-8 text-[#8b1538]/40" />
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
            {draft.package_type && (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#f4d58d]/30 px-2.5 py-0.5 text-[11px] font-medium text-[#62132d]">
                <Sparkles className="h-3 w-3" />{draft.package_type}
              </span>
            )}
            {draft.description && <p className="mt-2 text-sm text-stone-500 line-clamp-2">{draft.description}</p>}

            {/* Price */}
            {draft.package_price && (
              <p className="mt-2 text-2xl font-bold text-[#8b1538]">
                ₹{Number(draft.package_price || 0).toLocaleString('en-IN')}
              </p>
            )}
            {draft.advance_percentage && (
              <p className="text-xs text-stone-500">Advance: {draft.advance_percentage}%</p>
            )}

            {/* Services */}
            {draft.services_included.length > 0 && (
              <div className="mt-3 border-t border-stone-100 pt-3">
                <p className="text-xs font-semibold text-stone-600 mb-1.5">Services:</p>
                <div className="flex flex-wrap gap-1">
                  {draft.services_included.map(s => (
                    <span key={s} className="rounded-full bg-[#8b1538]/8 px-2 py-0.5 text-[11px] font-medium text-[#8b1538]">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Brands */}
            {draft.brands.length > 0 && (
              <div className="mt-3 border-t border-stone-100 pt-3">
                <p className="text-xs font-semibold text-stone-600 mb-1.5">Brands:</p>
                <div className="flex flex-wrap gap-1">
                  {draft.brands.map(b => (
                    <span key={b} className="rounded-full bg-[#f4d58d]/30 px-2 py-0.5 text-[11px] font-medium text-[#62132d]">{b}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Team */}
            <div className="mt-3 border-t border-stone-100 pt-3 flex flex-wrap gap-3 text-[11px] text-stone-500">
              {Number(draft.lead_artist) > 0 && <span>Lead: {draft.lead_artist}</span>}
              {Number(draft.assistant_artists) > 0 && <span>Assistants: {draft.assistant_artists}</span>}
              {Number(draft.hair_stylists) > 0 && <span>Hair Stylists: {draft.hair_stylists}</span>}
              {Number(draft.saree_drapers) > 0 && <span>Saree Drapers: {draft.saree_drapers}</span>}
              {Number(draft.male_grooming_artist) > 0 && <span>Male Grooming: {draft.male_grooming_artist}</span>}
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
            {draft.addons.filter(a => a.name.trim()).length > 0 && (
              <div className="mt-3 border-t border-stone-100 pt-3">
                <p className="text-xs font-semibold text-stone-600 mb-1.5">Add-ons:</p>
                {draft.addons.filter(a => a.name.trim()).map((a, i) => (
                  <div key={i} className="flex justify-between text-xs mt-1">
                    <span className="text-stone-700">{a.name}</span>
                    {a.price && <span className="font-semibold text-amber-800">+₹{Number(a.price).toLocaleString('en-IN')}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}