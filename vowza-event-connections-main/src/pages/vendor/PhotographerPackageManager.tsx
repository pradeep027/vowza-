import { ChangeEvent, DragEvent, memo, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Eye, EyeOff, GripVertical, Pencil, Plus, Star, Trash2, Upload, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

type Image = { id: string; public_url: string; storage_path: string; is_cover: boolean; sort_order: number };
type Addon = { name: string; price: string; description: string };
type Album = { type: string; size: string; pages: string; price: string; is_active: boolean };
type Draft = { id?: string; name: string; price: string; photography_type: string; duration: string; team_size: string; team_custom: string; edited: string; unlimited: boolean; raw: boolean; delivery: string; travel: boolean; radius: string; travelCharge: string; maxDistance: string; description: string; highlights: string[]; highlightInput: string; status: string; albumIncluded: boolean; addons: Addon[]; albums: Album[]; files: File[]; images: Image[] };

type DraftAction =
  | { type: 'SET_FIELD'; field: keyof Draft; value: any }
  | { type: 'SET_MANY'; payload: Partial<Draft> }
  | { type: 'ADD_HIGHLIGHT'; text: string }
  | { type: 'REMOVE_HIGHLIGHT'; text: string }
  | { type: 'SET_IMAGES'; images: Image[] }
  | { type: 'REMOVE_IMAGE'; id: string }
  | { type: 'ADD_FILES'; files: File[] }
  | { type: 'REMOVE_FILE'; index: number }
  | { type: 'SET_ALBUMS'; albums: Album[] }
  | { type: 'SET_ADDONS'; addons: Addon[] }
  | { type: 'RESET'; draft: Draft };

function draftReducer(state: Draft, action: DraftAction): Draft {
  switch (action.type) {
    case 'SET_FIELD': return { ...state, [action.field]: action.value };
    case 'SET_MANY': return { ...state, ...action.payload };
    case 'ADD_HIGHLIGHT': {
      const text = action.text.trim();
      if (!text || state.highlights.includes(text)) return state;
      return { ...state, highlights: [...state.highlights, text], highlightInput: '' };
    }
    case 'REMOVE_HIGHLIGHT': return { ...state, highlights: state.highlights.filter(h => h !== action.text) };
    case 'SET_IMAGES': return { ...state, images: action.images };
    case 'REMOVE_IMAGE': return { ...state, images: state.images.filter(img => img.id !== action.id) };
    case 'ADD_FILES': return { ...state, files: [...state.files, ...action.files] };
    case 'REMOVE_FILE': return { ...state, files: state.files.filter((_, i) => i !== action.index) };
    case 'SET_ALBUMS': return { ...state, albums: action.albums };
    case 'SET_ADDONS': return { ...state, addons: action.addons };
    case 'RESET': return action.draft;
    default: return state;
  }
}

const PHOTOGRAPHY_TYPES = ['Wedding Photography', 'Pre-Wedding Photography', 'Engagement Photography', 'Reception Photography', 'Birthday Photography', 'Baby Photography', 'Maternity Photography', 'Couple Photoshoot', 'Family Photography', 'Outdoor Photoshoot', 'Fashion Photography', 'Product Photography', 'Corporate Photography', 'Portfolio Photography', 'Housewarming Photography', 'Naming Ceremony Photography', 'Anniversary Photography', 'Religious Event Photography', 'Other'] as const;
const DURATION_OPTIONS = ['1 Hour', '2 Hours', '4 Hours', 'Half Day', 'Full Day', '2 Days', 'Custom'] as const;
const TEAM_OPTIONS = ['1 Photographer', '2 Photographers', '3 Photographers', '4 Photographers', '5+ Photographers', 'Custom'] as const;
const DELIVERY_OPTIONS = ['3 Days', '5 Days', '7 Days', '10 Days', '15 Days', '30 Days', 'Custom'] as const;
const emptyAlbum = (): Album => ({ type: '', size: '', pages: '', price: '', is_active: true });
const emptyAddon = (): Addon => ({ name: '', price: '', description: '' });
const nullableNum = (value: string) => value === '' ? null : Number(value);
const inputClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition placeholder:text-stone-400 focus:border-[#8b1538] focus:ring-2 focus:ring-[#8b1538]/15 disabled:bg-stone-100';
const blank = (): Draft => ({ name: '', price: '', photography_type: 'Wedding Photography', duration: '', team_size: '1 Photographer', team_custom: '', edited: '', unlimited: false, raw: false, delivery: '7 Days', travel: false, radius: '', travelCharge: '', maxDistance: '', description: '', highlights: [], highlightInput: '', status: 'draft', albumIncluded: false, addons: [], albums: [], files: [], images: [] });

const teamValue = (team: string) => team === 'Custom' ? 0 : team === '5+ Photographers' ? 5 : Number(team.charAt(0));
const teamLabel = (draft: Draft) => draft.team_size === 'Custom' ? `${draft.team_custom || 'Custom'} Photographers Included` : `${draft.team_size} Included`;
const parseTravelDetails = (value: unknown) => { try { const parsed = JSON.parse(String(value || '{}')); return typeof parsed.maxDistance === 'number' || typeof parsed.maxDistance === 'string' ? String(parsed.maxDistance) : ''; } catch { return ''; } };

/* ─── DebouncedInput: local state input, dispatches on blur ─── */
function DebouncedInput({ value, onCommit, className, ...props }: { value: string; onCommit: (v: string) => void; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onBlur'>) {
  const [local, setLocal] = useState(value);
  const localRef = useRef(local);
  localRef.current = local;
  const committedRef = useRef(value);
  useEffect(() => { setLocal(value); committedRef.current = value; }, [value]);
  const commit = useCallback(() => { if (localRef.current !== committedRef.current) { committedRef.current = localRef.current; onCommit(localRef.current); } }, [onCommit]);
  useEffect(() => () => { commit(); }, [commit]);
  return <input className={className} value={local} onChange={e => setLocal(e.target.value)} onBlur={commit} {...props} />;
}

function DebouncedTextarea({ value, onCommit, className, ...props }: { value: string; onCommit: (v: string) => void; className?: string } & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'onBlur'>) {
  const [local, setLocal] = useState(value);
  const localRef = useRef(local);
  localRef.current = local;
  const committedRef = useRef(value);
  useEffect(() => { setLocal(value); committedRef.current = value; }, [value]);
  const commit = useCallback(() => { if (localRef.current !== committedRef.current) { committedRef.current = localRef.current; onCommit(localRef.current); } }, [onCommit]);
  useEffect(() => () => { commit(); }, [commit]);
  return <textarea className={className} value={local} onChange={e => setLocal(e.target.value)} onBlur={commit} {...props} />;
}

/* ─── Parent component: CRUD, list, realtime – untouched logic ─── */
export default function PhotographerPackageManager({ provider }: { provider: any }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['photography-packages', provider.id],
    queryFn: async () => {
      const result = await supabase.from('photography_packages' as any).select('*, photography_package_images(*), photography_package_highlights(*), photography_package_addons(*), photography_albums(*)').eq('photographer_id', provider.id).order('created_at', { ascending: false });
      if (result.error) throw result.error;
      return result.data ?? [];
    },
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['photography-packages', provider.id] });

  useEffect(() => {
    const channel = supabase.channel(`photographer-packages-${provider.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photography_packages', filter: `photographer_id=eq.${provider.id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photography_albums' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photography_package_images' }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [provider.id]);

  const edit = (pack: any) => setDraft({
    id: pack.id, name: pack.name, price: String(pack.price), photography_type: pack.photography_type || 'Wedding Photography', duration: pack.duration || '',
    team_size: pack.team_size === 0 ? 'Custom' : pack.team_size >= 5 ? '5+ Photographers' : `${pack.team_size ?? 1} Photographer${pack.team_size === 1 ? '' : 's'}`,
    team_custom: String(pack.team_size_custom ?? ''), edited: String(pack.edited_photos ?? ''), unlimited: pack.edited_photos === null,
    raw: !!pack.raw_photos_included, delivery: pack.delivery_time || '7 Days', travel: !!pack.travel_included,
    radius: String(pack.travel_radius_km ?? ''), travelCharge: String(pack.travel_extra_charge ?? ''), maxDistance: parseTravelDetails(pack.travel_details),
    description: pack.description || '', highlights: (pack.photography_package_highlights ?? []).map((highlight: any) => highlight.text), highlightInput: '', status: pack.status || 'draft',
    albumIncluded: !!pack.album_included || (pack.photography_albums ?? []).length > 0,
    addons: (pack.photography_package_addons ?? []).map((addon: any) => ({ name: addon.name, price: String(addon.price), description: addon.description || '' })),
    albums: (pack.photography_albums ?? []).map((album: any) => ({ type: album.type, size: album.size, pages: String(album.pages), price: String(album.price), is_active: album.is_active })),
    files: [], images: [...(pack.photography_package_images ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order),
  });

  const upload = async (packageId: string, files: File[]) => {
    if (!user) return;
    for (const [index, file] of files.entries()) {
      if (!file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) throw new Error('Use image files under 8MB');
      const path = `${user.id}/${packageId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const uploaded = await supabase.storage.from('photography-package-images').upload(path, file, { contentType: file.type });
      if (uploaded.error) throw uploaded.error;
      const publicUrl = supabase.storage.from('photography-package-images').getPublicUrl(path).data.publicUrl;
      const inserted = await supabase.from('photography_package_images' as any).insert({ package_id: packageId, storage_path: path, public_url: publicUrl, alt_text: file.name, is_cover: index === 0 && !draft?.images.length, sort_order: (draft?.images.length ?? 0) + index });
      if (inserted.error) throw inserted.error;
    }
  };

  const save = async () => {
    if (!draft || !draft.name.trim() || draft.price === '' || !draft.duration || !draft.delivery || (draft.team_size === 'Custom' && (!draft.team_custom || Number(draft.team_custom) < 1)) || (!draft.unlimited && (draft.edited === '' || Number(draft.edited) < 0))) {
      return toast.error('Complete the required package, team, delivery, and edited-photo fields.');
    }
    setBusy(true);
    try {
      const d = draft;
      const payload = {
        photographer_id: provider.id, name: d.name.trim(), price: Number(d.price), photography_type: d.photography_type, duration: d.duration,
        team_size: teamValue(d.team_size), team_size_custom: d.team_size === 'Custom' ? Number(d.team_custom) : null,
        edited_photos: d.unlimited ? null : Number(d.edited), raw_photos_included: d.raw, delivery_time: d.delivery,
        travel_included: d.travel, travel_radius_km: d.travel ? nullableNum(d.radius) : null, travel_extra_charge: d.travel ? nullableNum(d.travelCharge) : null,
        travel_details: d.travel ? JSON.stringify({ maxDistance: nullableNum(d.maxDistance) }) : null,
        description: d.description.trim() || null, status: d.status, is_active: d.status !== 'archived', is_visible: d.status === 'published',
        album_included: d.albumIncluded, album_type: null, album_size: null, album_pages: null,
      };
      const result = d.id ? await supabase.from('photography_packages' as any).update(payload).eq('id', d.id).select().single() : await supabase.from('photography_packages' as any).insert(payload).select().single();
      if (result.error) throw result.error;
      const packageId = result.data.id;
      if (d.id) await Promise.all(['photography_package_highlights', 'photography_package_addons', 'photography_albums'].map(table => supabase.from(table as any).delete().eq('package_id', packageId)));
      if (d.highlights.length) {
        const inserted = await supabase.from('photography_package_highlights' as any).insert(d.highlights.map((text, sort_order) => ({ package_id: packageId, text, sort_order })));
        if (inserted.error) throw inserted.error;
      }
      const addons = d.addons.filter(addon => addon.name.trim() && addon.price !== '').map((addon, sort_order) => ({ package_id: packageId, name: addon.name.trim(), price: Number(addon.price), description: addon.description.trim() || null, sort_order }));
      if (addons.length) { const inserted = await supabase.from('photography_package_addons' as any).insert(addons); if (inserted.error) throw inserted.error; }
      const albums = d.albumIncluded ? d.albums.filter(album => album.type.trim() && album.size.trim() && album.pages && album.price !== '').map((album, sort_order) => ({ package_id: packageId, type: album.type.trim(), size: album.size.trim(), pages: Number(album.pages), price: Number(album.price), is_active: album.is_active, sort_order })) : [];
      if (albums.length) { const inserted = await supabase.from('photography_albums' as any).insert(albums); if (inserted.error) throw inserted.error; }
      await upload(packageId, d.files);
      toast.success('Photography package saved');
      setDraft(null); refresh();
    } catch (error: any) { toast.error(error.message || 'Could not save package'); } finally { setBusy(false); }
  };

  const updateImageOrder = async (images: Image[]) => {
    if (!draft?.id) return;
    const responses = await Promise.all(images.map((image, sort_order) => supabase.from('photography_package_images' as any).update({ sort_order }).eq('id', image.id)));
    const error = responses.find((response: any) => response.error)?.error;
    if (error) toast.error(error.message); else { setDraft(current => current && ({ ...current, images })); refresh(); }
  };
  const setCover = async (image: Image) => {
    if (!draft?.id) return;
    const off = await supabase.from('photography_package_images' as any).update({ is_cover: false }).eq('package_id', draft.id);
    const on = !off.error && await supabase.from('photography_package_images' as any).update({ is_cover: true }).eq('id', image.id);
    if (off.error || (on as any)?.error) return toast.error(off.error?.message || (on as any).error.message);
    setDraft(current => current && ({ ...current, images: current.images.map(c => ({ ...c, is_cover: c.id === image.id })) }));
  };
  const removeImage = async (image: Image) => {
    if (!confirm('Remove this image?')) return;
    const result = await supabase.from('photography_package_images' as any).delete().eq('id', image.id);
    if (result.error) return toast.error(result.error.message);
    await supabase.storage.from('photography-package-images').remove([image.storage_path]);
    setDraft(current => current && ({ ...current, images: current.images.filter(existing => existing.id !== image.id) }));
  };

  return <div className="max-w-[1200px] space-y-6">
    <div className="flex items-start justify-between gap-3"><div><h1 className="text-xl font-bold">Photography Packages</h1><p className="text-sm text-muted-foreground">Create customer-ready photography packages and optional upgrades.</p></div><button onClick={() => setDraft(blank())} className="rounded-xl bg-[#8B1538] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#70102d]"><Plus className="mr-1 inline h-4" />Create package</button></div>
    {isLoading ? <div className="h-48 animate-pulse rounded-2xl bg-muted" /> : <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{packages.map((pack: any) => { const image = pack.photography_package_images?.find((item: any) => item.is_cover) ?? pack.photography_package_images?.[0]; return <div key={pack.id} className="overflow-hidden rounded-2xl border bg-white"><div className="h-36 bg-secondary">{image && <img src={image.public_url} alt="" className="h-full w-full object-cover" />}</div><div className="p-4"><div className="flex justify-between"><h2 className="font-bold">{pack.name}</h2><span className="text-xs uppercase">{pack.status}</span></div><p className="font-bold">₹{Number(pack.price).toLocaleString('en-IN')}</p><p className="text-xs text-muted-foreground">{pack.photography_type} · {pack.duration} · {pack.team_size_custom || pack.team_size} team</p><div className="mt-4 flex gap-2"><button onClick={() => edit(pack)} className="flex-1 rounded-lg border py-2 text-xs"><Pencil className="mr-1 inline h-3" />Edit</button><button onClick={() => supabase.from('photography_packages' as any).insert({ photographer_id: provider.id, name: `${pack.name} (Copy)`, price: pack.price, photography_type: pack.photography_type, duration: pack.duration, team_size: pack.team_size, status: 'draft', is_visible: false, is_active: true }).then(refresh)} className="rounded-lg border p-2"><Copy className="h-3" /></button><button onClick={() => supabase.from('photography_packages' as any).update({ status: pack.status === 'published' ? 'draft' : 'published', is_visible: pack.status !== 'published' }).eq('id', pack.id).then(refresh)} className="rounded-lg border p-2">{pack.status === 'published' ? <EyeOff className="h-3" /> : <Eye className="h-3" />}</button><button onClick={() => confirm('Delete this package?') && supabase.from('photography_packages' as any).delete().eq('id', pack.id).then(refresh)} className="rounded-lg border p-2 text-red-600"><Trash2 className="h-3" /></button></div></div></div>; })}</div>}
    {draft && <Editor initialDraft={draft} close={() => setDraft(null)} save={save} busy={busy} setCover={setCover} removeImage={removeImage} updateImageOrder={updateImageOrder} onDraftChange={setDraft} />}
  </div>;
}

/* ─── Editor component with useReducer ─── */
function Editor({ initialDraft, close, save, busy, setCover, removeImage, updateImageOrder, onDraftChange }: { initialDraft: Draft; close: () => void; save: () => void; busy: boolean; setCover: (image: Image) => void; removeImage: (image: Image) => void; updateImageOrder: (images: Image[]) => void; onDraftChange: (d: Draft) => void }) {
  const [state, dispatch] = useReducer(draftReducer, initialDraft);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Sync reducer state back to parent so save() reads current draft
  useEffect(() => { onDraftChange(state); }, [state, onDraftChange]);

  // Stable callbacks for memoized children
  const setField = useCallback((field: keyof Draft, value: any) => dispatch({ type: 'SET_FIELD', field, value }), []);
  const addHighlight = useCallback(() => { dispatch({ type: 'ADD_HIGHLIGHT', text: stateRef.current.highlightInput }); }, []);
  const removeHighlight = useCallback((text: string) => dispatch({ type: 'REMOVE_HIGHLIGHT', text }), []);
  const setAlbums = useCallback((albums: Album[]) => dispatch({ type: 'SET_ALBUMS', albums }), []);
  const setAddons = useCallback((addons: Addon[]) => dispatch({ type: 'SET_ADDONS', addons }), []);
  const addFiles = useCallback((files: FileList | File[]) => dispatch({ type: 'ADD_FILES', files: Array.from(files) }), []);
  const removeFile = useCallback((index: number) => dispatch({ type: 'REMOVE_FILE', index }), []);
  const setImages = useCallback((images: Image[]) => dispatch({ type: 'SET_IMAGES', images }), []);

  return <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#250914]/65 p-3 backdrop-blur-sm sm:p-6"><div className="mx-auto my-3 max-w-5xl overflow-hidden rounded-[24px] bg-[#fffaf3] shadow-2xl">
    <header className="flex items-start justify-between gap-4 bg-[#70102d] px-5 py-5 text-white sm:px-7"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f4d58d]">Vowza studio</p><h2 className="mt-1 text-xl font-bold">{state.id ? 'Edit photography package' : 'Create photography package'}</h2><p className="mt-1 text-sm text-white/75">Build a polished package your customers can understand at a glance.</p></div><button type="button" onClick={close} className="rounded-full p-2 text-white/85 transition hover:bg-white/15 hover:text-white" aria-label="Close"><X /></button></header>
    <div className="space-y-4 p-4 sm:p-6">
      <PackageDetailsSection name={state.name} photography_type={state.photography_type} duration={state.duration} price={state.price} setField={setField} />
      <PackageInclusionsSection team_size={state.team_size} team_custom={state.team_custom} edited={state.edited} unlimited={state.unlimited} delivery={state.delivery} setField={setField} />
      <DescriptionSection description={state.description} setField={setField} />
      <RawPhotosSection raw={state.raw} setField={setField} />
      <AlbumSection albumIncluded={state.albumIncluded} albums={state.albums} setField={setField} setAlbums={setAlbums} />
      <TravelSection travel={state.travel} radius={state.radius} travelCharge={state.travelCharge} maxDistance={state.maxDistance} setField={setField} />
      <HighlightsSection highlights={state.highlights} highlightInput={state.highlightInput} setField={setField} addHighlight={addHighlight} removeHighlight={removeHighlight} />
      <ImagesSection images={state.images} files={state.files} addFiles={addFiles} removeFile={removeFile} updateImageOrder={updateImageOrder} setCover={setCover} removeImage={removeImage} setImages={setImages} />
      <AddonsSection addons={state.addons} setAddons={setAddons} />
      <PreviewSection state={state} />
      <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-[#eadfcf] bg-[#fffaf3]/95 pt-4 backdrop-blur sm:flex-row"><button type="button" onClick={close} className="rounded-xl border border-[#d7c5ae] px-5 py-3 text-sm font-bold text-[#5a3440] transition hover:bg-white sm:flex-1">Cancel</button><button type="button" disabled={busy} onClick={save} className="rounded-xl bg-[#8b1538] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#70102d] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-[2]">{busy ? 'Saving package…' : 'Save Package'}</button></div>
    </div>
  </div></div>;
}

/* ─── Shared UI helpers ─── */
const Field = ({ label, children, hint }: { label: string; children: any; hint?: string }) => <label className="block"><span className="text-sm font-semibold text-[#4b1d2b]">{label}</span>{hint && <span className="ml-1.5 text-xs font-normal text-stone-500">{hint}</span>}<div className="mt-1.5">{children}</div></label>;
const Card = ({ title, subtitle, children }: { title: string; subtitle?: string; children: any }) => <section className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-4 shadow-[0_2px_10px_rgba(72,28,37,0.04)] sm:p-5"><div className="mb-4"><h3 className="font-bold text-[#62132d]">{title}</h3>{subtitle && <p className="mt-0.5 text-xs text-stone-500">{subtitle}</p>}</div>{children}</section>;
const Toggle = ({ checked, onChange, label, description }: { checked: boolean; onChange: (checked: boolean) => void; label: string; description: string }) => <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#eadfcf] bg-white p-3 text-left transition hover:border-[#c99b43]"><span><span className="block text-sm font-semibold text-[#4b1d2b]">{label}</span><span className="block text-xs text-stone-500">{description}</span></span><span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-[#8b1538]' : 'bg-stone-300'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${checked ? 'left-6' : 'left-1'}`} /></span></button>;

/* ─── Section: Package Details ─── */
const PackageDetailsSection = memo(function PackageDetailsSection({ name, photography_type, duration, price, setField }: { name: string; photography_type: string; duration: string; price: string; setField: (field: keyof Draft, value: any) => void }) {
  const onNameCommit = useCallback((v: string) => setField('name', v), [setField]);
  const onPriceCommit = useCallback((v: string) => setField('price', v), [setField]);
  return <Card title="Package details" subtitle="Set the essentials customers see first."><div className="grid gap-4 sm:grid-cols-2">
    <Field label="Package Name"><DebouncedInput className={inputClass} value={name} onCommit={onNameCommit} placeholder="e.g. Timeless Wedding Story" /></Field>
    <Field label="Photography Type"><select className={inputClass} value={photography_type} onChange={e => setField('photography_type', e.target.value)}>{PHOTOGRAPHY_TYPES.map(type => <option key={type}>{type}</option>)}</select></Field>
    <Field label="Duration"><select className={inputClass} value={duration} onChange={e => setField('duration', e.target.value)}><option value="">Select duration</option>{DURATION_OPTIONS.map(d => <option key={d}>{d}</option>)}</select></Field>
    <Field label="Starting Price"><div className="relative"><span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span><DebouncedInput className={`${inputClass} pl-7`} type="number" min="0" value={price} onCommit={onPriceCommit} placeholder="0" /></div></Field>
  </div></Card>;
});

/* ─── Section: Package Inclusions ─── */
const PackageInclusionsSection = memo(function PackageInclusionsSection({ team_size, team_custom, edited, unlimited, delivery, setField }: { team_size: string; team_custom: string; edited: string; unlimited: boolean; delivery: string; setField: (field: keyof Draft, value: any) => void }) {
  const onTeamCustomCommit = useCallback((v: string) => setField('team_custom', v), [setField]);
  const onEditedCommit = useCallback((v: string) => setField('edited', v), [setField]);
  return <Card title="Package inclusions" subtitle="Make your offering specific and easy to compare."><div className="grid gap-4 sm:grid-cols-2">
    <Field label="Photography Team"><select className={inputClass} value={team_size} onChange={e => setField('team_size', e.target.value)}>{TEAM_OPTIONS.map(team => <option key={team}>{team}</option>)}</select></Field>
    {team_size === 'Custom' && <Field label="Custom team size *"><DebouncedInput className={inputClass} type="number" min="1" value={team_custom} onCommit={onTeamCustomCommit} placeholder="Number of photographers" /></Field>}
    <Field label="Edited Photos Included"><div className="space-y-2"><DebouncedInput className={inputClass} disabled={unlimited} type="number" min="0" value={edited} onCommit={onEditedCommit} placeholder="Number of edited photos" /><label className="flex items-center gap-2 text-xs font-medium text-[#62132d]"><input type="checkbox" checked={unlimited} onChange={e => { setField('unlimited', e.target.checked); if (e.target.checked) setField('edited', ''); }} className="accent-[#8b1538]" />Unlimited edited photos</label></div></Field>
    <Field label="Delivery Time"><select className={inputClass} value={delivery} onChange={e => setField('delivery', e.target.value)}>{DELIVERY_OPTIONS.map(d => <option key={d}>{d}</option>)}</select></Field>
  </div></Card>;
});

/* ─── Section: Description ─── */
const DescriptionSection = memo(function DescriptionSection({ description, setField }: { description: string; setField: (field: keyof Draft, value: any) => void }) {
  const onCommit = useCallback((v: string) => setField('description', v), [setField]);
  return <Card title="Description" subtitle="A concise customer-facing summary of this package."><DebouncedTextarea className={`${inputClass} min-h-24 resize-y`} value={description} onCommit={onCommit} placeholder="Tell customers what makes this package special..." /></Card>;
});

/* ─── Section: Raw Photos ─── */
const RawPhotosSection = memo(function RawPhotosSection({ raw, setField }: { raw: boolean; setField: (field: keyof Draft, value: any) => void }) {
  return <Card title="Raw Photos Included" subtitle="Let customers know whether they receive original files."><Toggle checked={raw} onChange={v => setField('raw', v)} label="Include raw photos" description={raw ? 'Original files are included with this package.' : 'Original files are not included.'} /></Card>;
});

/* ─── Section: Album ─── */
const AlbumSection = memo(function AlbumSection({ albumIncluded, albums, setField, setAlbums }: { albumIncluded: boolean; albums: Album[]; setField: (field: keyof Draft, value: any) => void; setAlbums: (albums: Album[]) => void }) {
  const toggleAlbum = useCallback((v: boolean) => { setField('albumIncluded', v); if (v && albums.length === 0) setAlbums([emptyAlbum()]); }, [setField, setAlbums, albums.length]);
  return <Card title="Album Included" subtitle="Offer included or paid album choices through the existing album options."><Toggle checked={albumIncluded} onChange={toggleAlbum} label="Include album options" description={albumIncluded ? 'Customers can select an album with this package.' : 'No album options will be shown.'} />{albumIncluded && <AlbumRows albums={albums} onChange={setAlbums} />}</Card>;
});

/* ─── Section: Travel ─── */
const TravelSection = memo(function TravelSection({ travel, radius, travelCharge, maxDistance, setField }: { travel: boolean; radius: string; travelCharge: string; maxDistance: string; setField: (field: keyof Draft, value: any) => void }) {
  const onRadiusCommit = useCallback((v: string) => setField('radius', v), [setField]);
  const onChargeCommit = useCallback((v: string) => setField('travelCharge', v), [setField]);
  const onMaxCommit = useCallback((v: string) => setField('maxDistance', v), [setField]);
  return <Card title="Travel Included" subtitle="Set included travel coverage and any additional travel charge."><Toggle checked={travel} onChange={v => setField('travel', v)} label="Include travel" description={travel ? 'Travel coverage is part of this package.' : 'Travel terms are not included.'} />{travel && <div className="mt-4 grid gap-4 sm:grid-cols-3"><Field label="Free Radius (KM)"><DebouncedInput className={inputClass} type="number" min="0" value={radius} onCommit={onRadiusCommit} placeholder="0" /></Field><Field label="Extra per KM (₹)"><DebouncedInput className={inputClass} type="number" min="0" value={travelCharge} onCommit={onChargeCommit} placeholder="0" /></Field><Field label="Maximum Distance (KM)"><DebouncedInput className={inputClass} type="number" min="0" value={maxDistance} onCommit={onMaxCommit} placeholder="Optional" /></Field></div>}</Card>;
});

/* ─── Section: Highlights ─── */
const HighlightsSection = memo(function HighlightsSection({ highlights, highlightInput, setField, addHighlight, removeHighlight }: { highlights: string[]; highlightInput: string; setField: (field: keyof Draft, value: any) => void; addHighlight: () => void; removeHighlight: (text: string) => void }) {
  const onInputCommit = useCallback((v: string) => setField('highlightInput', v), [setField]);
  const [localInput, setLocalInput] = useState(highlightInput);
  useEffect(() => { setLocalInput(highlightInput); }, [highlightInput]);
  const handleAdd = useCallback(() => {
    // Sync local to reducer then add
    setField('highlightInput', localInput);
    // Use microtask so the reducer has the value before ADD_HIGHLIGHT fires
    Promise.resolve().then(() => addHighlight());
  }, [localInput, setField, addHighlight]);
  return <Card title="Highlights" subtitle="Add concise selling points as chips—one at a time."><div className="flex gap-2"><input className={inputClass} value={localInput} onChange={e => setLocalInput(e.target.value)} onBlur={() => setField('highlightInput', localInput)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }} placeholder="e.g. Candid coverage" /><button type="button" onClick={handleAdd} className="shrink-0 rounded-xl bg-[#f4d58d] px-4 text-sm font-bold text-[#62132d] transition hover:bg-[#e8c46e]">Add</button></div>{highlights.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{highlights.map((highlight: string) => <span key={highlight} className="inline-flex items-center gap-1.5 rounded-full bg-[#f7ead7] px-3 py-1.5 text-xs font-semibold text-[#70102d]"><Check className="h-3 w-3" />{highlight}<button type="button" onClick={() => removeHighlight(highlight)} aria-label={`Remove ${highlight}`}><X className="h-3.5 w-3.5" /></button></span>)}</div>}</Card>;
});

/* ─── Section: Images ─── */
const ImagesSection = memo(function ImagesSection({ images, files, addFiles, removeFile, updateImageOrder, setCover, removeImage, setImages }: { images: Image[]; files: File[]; addFiles: (files: FileList | File[]) => void; removeFile: (index: number) => void; updateImageOrder: (images: Image[]) => void; setCover: (image: Image) => void; removeImage: (image: Image) => void; setImages: (images: Image[]) => void }) {
  const [dragging, setDragging] = useState(false);
  const previews = useMemo(() => files.map((file: File) => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach(item => URL.revokeObjectURL(item.url)), [previews]);
  return <Card title="Package Images" subtitle="Upload up to 8MB per image. Drag existing images to reorder; choose a cover image."><div onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event: DragEvent) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }} className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${dragging ? 'border-[#8b1538] bg-[#fbf0e4]' : 'border-[#d8b77b] bg-[#fffdf9]'}`}><Upload className="mx-auto mb-2 h-6 w-6 text-[#8b1538]" /><p className="text-sm font-semibold text-[#4b1d2b]">Drop your images here</p><p className="mt-1 text-xs text-stone-500">or <label className="cursor-pointer font-bold text-[#8b1538] underline">browse files<input className="hidden" type="file" accept="image/*" multiple onChange={(event: ChangeEvent<HTMLInputElement>) => addFiles(event.target.files ?? [])} /></label></p></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{images.map((image: Image, index: number) => <ImageTile key={image.id} image={image} index={index} onReorder={(from: number, to: number) => { if (from === to) return; const next = [...images]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); updateImageOrder(next); }} setCover={setCover} remove={() => removeImage(image)} />)}{previews.map(({ file, url }: { file: File; url: string }, index: number) => <div key={`${file.name}-${index}`} className="relative overflow-hidden rounded-xl border border-[#eadfcf]"><img src={url} className="h-28 w-full object-cover" alt="New package preview" /><span className="absolute left-2 top-2 rounded-full bg-[#f4d58d] px-2 py-0.5 text-[10px] font-bold text-[#62132d]">NEW</span><button type="button" onClick={() => removeFile(index)} className="absolute right-2 top-2 rounded-full bg-black/65 p-1 text-white"><X className="h-3.5 w-3.5" /></button></div>)}</div></Card>;
});

/* ─── Section: Add-ons ─── */
const AddonsSection = memo(function AddonsSection({ addons, setAddons }: { addons: Addon[]; setAddons: (addons: Addon[]) => void }) {
  return <Card title="Add-ons" subtitle="Give customers optional extras to tailor their package."><AddonRows addons={addons} onChange={setAddons} /></Card>;
});

/* ─── Section: Preview ─── */
const PreviewSection = memo(function PreviewSection({ state }: { state: Draft }) {
  return <Card title="Preview" subtitle="This mirrors the compact package card customers will review."><PackagePreview d={state} /></Card>;
});

/* ─── ImageTile ─── */
function ImageTile({ image, index, onReorder, setCover, remove }: { image: Image; index: number; onReorder: (from: number, to: number) => void; setCover: (image: Image) => void; remove: () => void }) {
  return <div draggable onDragStart={(event: any) => event.dataTransfer.setData('image-index', String(index))} onDrop={(event: any) => { const from = Number(event.dataTransfer.getData('image-index')); if (!Number.isNaN(from)) onReorder(from, index); }} onDragOver={(event: any) => event.preventDefault()} className="group relative overflow-hidden rounded-xl border border-[#eadfcf]"><img src={image.public_url} className="h-28 w-full object-cover" alt="Package" />{image.is_cover && <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#f4d58d] px-2 py-0.5 text-[10px] font-bold text-[#62132d]"><Star className="h-3 w-3 fill-current" />Cover</span>}<div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/65 p-2 text-[10px] text-white opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100"><GripVertical className="h-4 w-4" /><button type="button" onClick={() => setCover(image)} className="font-bold">{image.is_cover ? 'Cover image' : 'Set cover'}</button><button type="button" onClick={remove}>Delete</button></div></div>;
}

/* ─── AlbumRows ─── */
function AlbumRows({ albums, onChange }: { albums: Album[]; onChange: (albums: Album[]) => void }) {
  return <div className="mt-4 space-y-3">{albums.map((album, index) => <AlbumRow key={index} album={album} index={index} albums={albums} onChange={onChange} />)}<button type="button" onClick={() => onChange([...albums, emptyAlbum()])} className="text-sm font-bold text-[#8b1538]"><Plus className="mr-1 inline h-4" />Add album option</button></div>;
}

function AlbumRow({ album, index, albums, onChange }: { album: Album; index: number; albums: Album[]; onChange: (albums: Album[]) => void }) {
  const update = (key: keyof Album, value: string | boolean) => onChange(albums.map((a, i) => i === index ? { ...a, [key]: value } : a));
  const onTypeCommit = useCallback((v: string) => update('type', v), [albums, index]);
  const onSizeCommit = useCallback((v: string) => update('size', v), [albums, index]);
  const onPagesCommit = useCallback((v: string) => update('pages', v), [albums, index]);
  const onPriceCommit = useCallback((v: string) => update('price', v), [albums, index]);
  return <div className="rounded-xl border border-[#eadfcf] bg-white p-3"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <DebouncedInput className={inputClass} placeholder="Album type" value={album.type} onCommit={onTypeCommit} />
    <DebouncedInput className={inputClass} placeholder="Album size" value={album.size} onCommit={onSizeCommit} />
    <DebouncedInput className={inputClass} type="number" min="1" placeholder="Pages" value={album.pages} onCommit={onPagesCommit} />
    <DebouncedInput className={inputClass} type="number" min="0" placeholder="Additional price (₹)" value={album.price} onCommit={onPriceCommit} />
  </div><div className="mt-3 flex items-center justify-between"><label className="text-xs font-semibold text-[#62132d]"><input type="checkbox" checked={album.is_active} onChange={event => update('is_active', event.target.checked)} className="mr-2 accent-[#8b1538]" />Available to customers</label><button type="button" onClick={() => onChange(albums.filter((_, i) => i !== index))} className="text-xs font-bold text-red-700"><Trash2 className="mr-1 inline h-3.5 w-3.5" />Remove</button></div></div>;
}

/* ─── AddonRows ─── */
function AddonRows({ addons, onChange }: { addons: Addon[]; onChange: (addons: Addon[]) => void }) {
  return <div className="space-y-3">{addons.map((addon, index) => <AddonRow key={index} addon={addon} index={index} addons={addons} onChange={onChange} />)}<button type="button" onClick={() => onChange([...addons, emptyAddon()])} className="text-sm font-bold text-[#8b1538]"><Plus className="mr-1 inline h-4" />Add add-on</button></div>;
}

function AddonRow({ addon, index, addons, onChange }: { addon: Addon; index: number; addons: Addon[]; onChange: (addons: Addon[]) => void }) {
  const update = (key: keyof Addon, value: string) => onChange(addons.map((a, i) => i === index ? { ...a, [key]: value } : a));
  const onNameCommit = useCallback((v: string) => update('name', v), [addons, index]);
  const onPriceCommit = useCallback((v: string) => update('price', v), [addons, index]);
  const onDescCommit = useCallback((v: string) => update('description', v), [addons, index]);
  return <div className="grid gap-3 rounded-xl border border-[#eadfcf] bg-white p-3 sm:grid-cols-[1fr_150px_1.5fr_auto]">
    <DebouncedInput className={inputClass} placeholder="Name" value={addon.name} onCommit={onNameCommit} />
    <DebouncedInput className={inputClass} type="number" min="0" placeholder="Price (₹)" value={addon.price} onCommit={onPriceCommit} />
    <DebouncedInput className={inputClass} placeholder="Description" value={addon.description} onCommit={onDescCommit} />
    <button type="button" onClick={() => onChange(addons.filter((_, i) => i !== index))} className="self-center rounded-lg p-2 text-red-700 hover:bg-red-50" aria-label="Remove add-on"><Trash2 className="h-4 w-4" /></button>
  </div>;
}

/* ─── PackagePreview ─── */
function PackagePreview({ d }: { d: Draft }) {
  const albumPrices = d.albums.filter(album => album.price !== '').map(album => Number(album.price));
  return <div className="overflow-hidden rounded-2xl border border-[#e4d4bd] bg-white shadow-sm"><div className="h-24 bg-gradient-to-br from-[#68102c] via-[#8b1538] to-[#bd8134] p-4 text-white"><span className="rounded-full bg-white/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide">{d.photography_type}</span><div className="mt-3 flex items-end justify-between gap-3"><h4 className="truncate text-lg font-bold">{d.name || 'Your package name'}</h4><span className="shrink-0 text-lg font-bold">₹{d.price || '0'}</span></div></div><div className="space-y-2 p-4 text-sm text-[#4b1d2b]"><p>{d.duration || 'Duration'} · {teamLabel(d)}</p><p>{d.unlimited ? 'Unlimited edited photos' : `${d.edited || '0'} edited photos`} · Delivery in {d.delivery}</p>{d.raw && <p>Raw photos included</p>}{d.travel && <p>Travel included{d.radius && ` within ${d.radius} KM`}</p>}{d.highlights.length > 0 && <div className="flex flex-wrap gap-1.5 pt-1">{d.highlights.map(highlight => <span key={highlight} className="rounded-full bg-[#f7ead7] px-2 py-1 text-xs font-semibold text-[#70102d]">{highlight}</span>)}</div>}{d.albumIncluded && albumPrices.length > 0 && <p className="border-t border-stone-100 pt-2 text-xs text-stone-600">Album options from ₹{Math.min(...albumPrices).toLocaleString('en-IN')}</p>}</div></div>;
}
