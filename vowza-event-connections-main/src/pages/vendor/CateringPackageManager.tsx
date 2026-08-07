import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Copy, Trash2, Eye, EyeOff, Utensils, Users, MapPin, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const CUISINE_OPTIONS = ['Pure Vegetarian', 'Non-Vegetarian', 'Jain Food', 'Vegan', 'Multi Cuisine'];
const SERVICE_TYPES = ['Wedding Catering', 'Reception Catering', 'Birthday Catering', 'Corporate Catering', 'Housewarming', 'Outdoor Catering', 'Indoor Catering', 'Live Counters'];
const SERVING_STYLES = ['Buffet', 'Plated Service', 'Banana Leaf', 'Live Stations', 'Family Style', 'Self Service'];
const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'High Tea', 'Snacks', 'Midnight Buffet'];

type Addon = { name: string; price: string; description: string };
type MenuItem = { name: string; is_veg: boolean; is_premium: boolean; is_bestseller: boolean; spicy_level: number; extra_cost: string };
type MenuSection = { name: string; items: MenuItem[] };
type Draft = {
  id?: string; name: string; description: string; price_per_plate: string; starting_price: string;
  cuisine_types: string[]; service_types: string[]; meal_types: string[]; serving_styles: string[];
  min_guests: string; max_guests: string; is_veg: boolean; is_nonveg: boolean; is_jain: boolean;
  status: string; menu_sections: MenuSection[]; addons: Addon[];
};

const blank = (): Draft => ({
  name: '', description: '', price_per_plate: '', starting_price: '',
  cuisine_types: [], service_types: [], meal_types: [], serving_styles: [],
  min_guests: '50', max_guests: '500', is_veg: true, is_nonveg: false, is_jain: false,
  status: 'draft', menu_sections: [], addons: [],
});

const inputClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition placeholder:text-stone-400 focus:border-[#8b1538] focus:ring-2 focus:ring-[#8b1538]/15';

export default function CateringPackageManager({ provider }: { provider: any }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
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

  const edit = (pkg: any) => setDraft({
    id: pkg.id, name: pkg.name || '', description: pkg.description || '',
    price_per_plate: String(pkg.price_per_plate ?? ''), starting_price: String(pkg.starting_price ?? ''),
    cuisine_types: pkg.cuisine_types ?? [], service_types: pkg.service_types ?? [],
    meal_types: pkg.meal_types ?? [], serving_styles: pkg.serving_styles ?? [],
    min_guests: String(pkg.min_guests ?? '50'), max_guests: String(pkg.max_guests ?? '500'),
    is_veg: pkg.is_veg ?? true, is_nonveg: pkg.is_nonveg ?? false, is_jain: pkg.is_jain ?? false,
    status: pkg.status || 'draft', menu_sections: pkg.menu_sections ?? [], addons: pkg.addons ?? [],
  });

  const save = async () => {
    if (!draft || !draft.name.trim() || !draft.price_per_plate) {
      return toast.error('Package name and price per plate are required.');
    }
    setBusy(true);
    try {
      const payload = {
        provider_id: provider.id, name: draft.name.trim(), description: draft.description.trim() || null,
        price_per_plate: Number(draft.price_per_plate), starting_price: draft.starting_price ? Number(draft.starting_price) : null,
        cuisine_types: draft.cuisine_types, service_types: draft.service_types,
        meal_types: draft.meal_types, serving_styles: draft.serving_styles,
        min_guests: Number(draft.min_guests) || 50, max_guests: Number(draft.max_guests) || 500,
        is_veg: draft.is_veg, is_nonveg: draft.is_nonveg, is_jain: draft.is_jain,
        status: draft.status, is_active: draft.status !== 'archived',
        menu_sections: draft.menu_sections, addons: draft.addons,
      };
      const result = draft.id
        ? await supabase.from('catering_packages' as any).update(payload).eq('id', draft.id).select().single()
        : await supabase.from('catering_packages' as any).insert(payload).select().single();
      if (result.error) throw result.error;
      toast.success('Catering package saved');
      setDraft(null); refresh();
    } catch (err: any) { toast.error(err.message || 'Could not save package'); } finally { setBusy(false); }
  };

  const duplicate = async (pkg: any) => {
    await supabase.from('catering_packages' as any).insert({
      provider_id: provider.id, name: `${pkg.name} (Copy)`, price_per_plate: pkg.price_per_plate,
      cuisine_types: pkg.cuisine_types, service_types: pkg.service_types, status: 'draft', is_active: true,
      min_guests: pkg.min_guests, max_guests: pkg.max_guests, menu_sections: pkg.menu_sections, addons: pkg.addons,
    });
    refresh();
  };

  const toggleStatus = async (pkg: any) => {
    const newStatus = pkg.status === 'active' ? 'draft' : 'active';
    await supabase.from('catering_packages' as any).update({ status: newStatus, is_active: newStatus !== 'archived' }).eq('id', pkg.id);
    refresh();
  };

  const remove = async (pkg: any) => {
    if (!confirm('Delete this package?')) return;
    await supabase.from('catering_packages' as any).delete().eq('id', pkg.id);
    refresh();
  };

  const ChipSelect = ({ options, selected, onChange, label }: { options: string[]; selected: string[]; onChange: (v: string[]) => void; label: string }) => (
    <div>
      <span className="text-sm font-semibold text-[#4b1d2b]">{label}</span>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {options.map(opt => (
          <button key={opt} type="button" onClick={() => onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt])}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${selected.includes(opt) ? 'border-[#8b1538] bg-[#8b1538]/10 text-[#8b1538]' : 'border-[#e7d9c4] text-stone-600 hover:border-[#c99b43]'}`}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-[1200px] space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div><h1 className="text-xl font-bold">Catering Packages</h1><p className="text-sm text-muted-foreground">Create and manage your catering menus and pricing.</p></div>
        <button onClick={() => setDraft(blank())} className="rounded-xl bg-[#8B1538] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#70102d]"><Plus className="mr-1 inline h-4" />Create package</button>
      </div>

      {isLoading ? <div className="h-48 animate-pulse rounded-2xl bg-muted" /> : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg: any) => (
            <div key={pkg.id} className="overflow-hidden rounded-2xl border bg-white">
              <div className="flex h-32 items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50">
                <Utensils className="h-10 w-10 text-[#8b1538]/40" />
              </div>
              <div className="p-4">
                <div className="flex justify-between">
                  <h2 className="font-bold">{pkg.name}</h2>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs uppercase">{pkg.status}</span>
                </div>
                <p className="mt-1 text-lg font-bold">₹{Number(pkg.price_per_plate).toLocaleString('en-IN')}<span className="text-xs font-normal text-muted-foreground"> /plate</span></p>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />{pkg.min_guests}–{pkg.max_guests} guests
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(pkg.cuisine_types ?? []).slice(0, 3).map((c: string) => (
                    <span key={c} className="rounded-full bg-[#8b1538]/10 px-2 py-0.5 text-xs text-[#8b1538]">{c}</span>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => edit(pkg)} className="flex-1 rounded-lg border py-2 text-xs"><Pencil className="mr-1 inline h-3" />Edit</button>
                  <button onClick={() => duplicate(pkg)} className="rounded-lg border p-2"><Copy className="h-3" /></button>
                  <button onClick={() => toggleStatus(pkg)} className="rounded-lg border p-2">{pkg.status === 'active' ? <EyeOff className="h-3" /> : <Eye className="h-3" />}</button>
                  <button onClick={() => remove(pkg)} className="rounded-lg border p-2 text-red-600"><Trash2 className="h-3" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {draft && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#250914]/65 p-3 backdrop-blur-sm sm:p-6">
          <div className="mx-auto my-3 max-w-4xl overflow-hidden rounded-[24px] bg-[#fffaf3] shadow-2xl">
            <header className="flex items-start justify-between gap-4 bg-[#70102d] px-5 py-5 text-white sm:px-7">
              <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f4d58d]">Vowza catering</p><h2 className="mt-1 text-xl font-bold">{draft.id ? 'Edit catering package' : 'Create catering package'}</h2></div>
              <button onClick={() => setDraft(null)} className="rounded-full p-2 text-white/85 hover:bg-white/15"><X /></button>
            </header>
            <div className="space-y-5 p-4 sm:p-6">
              {/* Basic Info */}
              <section className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-4">
                <h3 className="mb-3 font-bold text-[#62132d]">Basic Information</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block"><span className="text-sm font-semibold text-[#4b1d2b]">Package Name</span><input className={inputClass} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Grand Wedding Feast" /></label>
                  <label className="block"><span className="text-sm font-semibold text-[#4b1d2b]">Price per Plate</span><div className="relative"><span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span><input className={`${inputClass} pl-7`} type="number" min="0" value={draft.price_per_plate} onChange={e => setDraft({ ...draft, price_per_plate: e.target.value })} placeholder="0" /></div></label>
                  <label className="block"><span className="text-sm font-semibold text-[#4b1d2b]">Starting Price (total)</span><div className="relative"><span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span><input className={`${inputClass} pl-7`} type="number" min="0" value={draft.starting_price} onChange={e => setDraft({ ...draft, starting_price: e.target.value })} placeholder="Optional" /></div></label>
                  <label className="block"><span className="text-sm font-semibold text-[#4b1d2b]">Status</span><select className={inputClass} value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}><option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option><option value="archived">Archived</option></select></label>
                  <label className="block sm:col-span-2"><span className="text-sm font-semibold text-[#4b1d2b]">Description</span><textarea className={`${inputClass} min-h-20 resize-y`} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="Describe what makes this package special..." /></label>
                </div>
              </section>

              {/* Guest Range */}
              <section className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-4">
                <h3 className="mb-3 font-bold text-[#62132d]">Guest Range</h3>
                <div className="grid grid-cols-2 gap-4">
                  <label className="block"><span className="text-sm font-semibold text-[#4b1d2b]">Min Guests</span><input className={inputClass} type="number" min="1" value={draft.min_guests} onChange={e => setDraft({ ...draft, min_guests: e.target.value })} /></label>
                  <label className="block"><span className="text-sm font-semibold text-[#4b1d2b]">Max Guests</span><input className={inputClass} type="number" min="1" value={draft.max_guests} onChange={e => setDraft({ ...draft, max_guests: e.target.value })} /></label>
                </div>
                <div className="mt-3 flex gap-4">
                  {[{ key: 'is_veg', label: 'Veg' }, { key: 'is_nonveg', label: 'Non-Veg' }, { key: 'is_jain', label: 'Jain' }].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={(draft as any)[key]} onChange={e => setDraft({ ...draft, [key]: e.target.checked })} className="accent-[#8b1538]" />{label}</label>
                  ))}
                </div>
              </section>

              {/* Cuisine, Service, Meal, Serving */}
              <section className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-4 space-y-4">
                <h3 className="font-bold text-[#62132d]">Categories</h3>
                <ChipSelect label="Cuisine Types" options={CUISINE_OPTIONS} selected={draft.cuisine_types} onChange={v => setDraft({ ...draft, cuisine_types: v })} />
                <ChipSelect label="Service Types" options={SERVICE_TYPES} selected={draft.service_types} onChange={v => setDraft({ ...draft, service_types: v })} />
                <ChipSelect label="Meal Types" options={MEAL_TYPES} selected={draft.meal_types} onChange={v => setDraft({ ...draft, meal_types: v })} />
                <ChipSelect label="Serving Styles" options={SERVING_STYLES} selected={draft.serving_styles} onChange={v => setDraft({ ...draft, serving_styles: v })} />
              </section>

              {/* Menu Builder */}
              <section className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-4">
                <div className="flex justify-between">
                  <h3 className="font-bold text-[#62132d]">Menu Sections</h3>
                  <button type="button" onClick={() => setDraft({ ...draft, menu_sections: [...draft.menu_sections, { name: '', items: [] }] })} className="text-xs font-semibold text-[#8b1538]"><Plus className="mr-0.5 inline h-3" />Add Section</button>
                </div>
                {draft.menu_sections.map((sec, si) => (
                  <div key={si} className="mt-3 rounded-xl border border-[#eadfcf] p-3">
                    <div className="flex gap-2">
                      <input className={`${inputClass} flex-1`} value={sec.name} onChange={e => { const s = [...draft.menu_sections]; s[si] = { ...s[si], name: e.target.value }; setDraft({ ...draft, menu_sections: s }); }} placeholder="Section name (e.g. Starters)" />
                      <button onClick={() => setDraft({ ...draft, menu_sections: draft.menu_sections.filter((_, i) => i !== si) })} className="text-red-500 text-xs">Remove</button>
                    </div>
                    {sec.items.map((item, ii) => (
                      <div key={ii} className="mt-2 ml-2 flex flex-wrap gap-2 items-center text-xs">
                        <input className="rounded-lg border px-2 py-1 flex-1 min-w-[120px]" value={item.name} onChange={e => { const s = [...draft.menu_sections]; s[si].items[ii] = { ...item, name: e.target.value }; setDraft({ ...draft, menu_sections: s }); }} placeholder="Item name" />
                        <label className="flex items-center gap-1"><input type="checkbox" checked={item.is_veg} onChange={e => { const s = [...draft.menu_sections]; s[si].items[ii] = { ...item, is_veg: e.target.checked }; setDraft({ ...draft, menu_sections: s }); }} />Veg</label>
                        <label className="flex items-center gap-1"><input type="checkbox" checked={item.is_premium} onChange={e => { const s = [...draft.menu_sections]; s[si].items[ii] = { ...item, is_premium: e.target.checked }; setDraft({ ...draft, menu_sections: s }); }} />Premium</label>
                        <label className="flex items-center gap-1"><input type="checkbox" checked={item.is_bestseller} onChange={e => { const s = [...draft.menu_sections]; s[si].items[ii] = { ...item, is_bestseller: e.target.checked }; setDraft({ ...draft, menu_sections: s }); }} />Bestseller</label>
                        <button onClick={() => { const s = [...draft.menu_sections]; s[si].items = s[si].items.filter((_, i) => i !== ii); setDraft({ ...draft, menu_sections: s }); }} className="text-red-400">×</button>
                      </div>
                    ))}
                    <button onClick={() => { const s = [...draft.menu_sections]; s[si].items.push({ name: '', is_veg: true, is_premium: false, is_bestseller: false, spicy_level: 0, extra_cost: '' }); setDraft({ ...draft, menu_sections: s }); }} className="mt-2 ml-2 text-xs text-[#8b1538]"><Plus className="mr-0.5 inline h-3" />Add Item</button>
                  </div>
                ))}
              </section>

              {/* Add-ons */}
              <section className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-4">
                <div className="flex justify-between">
                  <h3 className="font-bold text-[#62132d]">Add-ons</h3>
                  <button type="button" onClick={() => setDraft({ ...draft, addons: [...draft.addons, { name: '', price: '', description: '' }] })} className="text-xs font-semibold text-[#8b1538]"><Plus className="mr-0.5 inline h-3" />Add</button>
                </div>
                {draft.addons.map((addon, i) => (
                  <div key={i} className="mt-2 grid grid-cols-[1fr_80px_1fr_auto] gap-2 items-center">
                    <input className={inputClass} value={addon.name} onChange={e => { const a = [...draft.addons]; a[i] = { ...a[i], name: e.target.value }; setDraft({ ...draft, addons: a }); }} placeholder="Add-on name" />
                    <input className={inputClass} type="number" value={addon.price} onChange={e => { const a = [...draft.addons]; a[i] = { ...a[i], price: e.target.value }; setDraft({ ...draft, addons: a }); }} placeholder="₹" />
                    <input className={inputClass} value={addon.description} onChange={e => { const a = [...draft.addons]; a[i] = { ...a[i], description: e.target.value }; setDraft({ ...draft, addons: a }); }} placeholder="Description" />
                    <button onClick={() => setDraft({ ...draft, addons: draft.addons.filter((_, idx) => idx !== i) })} className="text-red-500 text-xs">×</button>
                  </div>
                ))}
              </section>

              {/* Actions */}
              <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-[#eadfcf] bg-[#fffaf3]/95 pt-4 backdrop-blur sm:flex-row">
                <button type="button" onClick={() => setDraft(null)} className="rounded-xl border border-[#d7c5ae] px-5 py-3 text-sm font-bold text-[#5a3440] transition hover:bg-white sm:flex-1">Cancel</button>
                <button type="button" disabled={busy} onClick={save} className="rounded-xl bg-[#8b1538] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#70102d] disabled:opacity-60 sm:flex-[2]">{busy ? 'Saving…' : 'Save Package'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
