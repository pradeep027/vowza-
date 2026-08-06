import { ChangeEvent, DragEvent, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Eye, EyeOff, GripVertical, ImagePlus, Pencil, Plus, Star, Trash2, Upload, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

type Image = { id: string; public_url: string; storage_path: string; is_cover: boolean; sort_order: number };
type Addon = { name: string; price: string; description: string };
type Album = { type: string; size: string; pages: string; price: string; is_active: boolean };
type Draft = { id?: string; name: string; price: string; photography_type: string; duration: string; team_size: string; team_custom: string; edited: string; unlimited: boolean; raw: boolean; delivery: string; travel: boolean; radius: string; travelCharge: string; maxDistance: string; description: string; highlights: string[]; highlightInput: string; status: string; albumIncluded: boolean; addons: Addon[]; albums: Album[]; files: File[]; images: Image[] };

const PHOTOGRAPHY_TYPES = ['Wedding', 'Pre-Wedding', 'Engagement', 'Maternity', 'Newborn', 'Birthday', 'Baby Shower', 'Corporate', 'Fashion', 'Product', 'Portrait', 'Event', 'Other'] as const;
const DURATION_OPTIONS = ['1 Hour', '2 Hours', '4 Hours', 'Half Day', 'Full Day', '2 Days', 'Custom'] as const;
const TEAM_OPTIONS = ['1 Photographer', '2 Photographers', '3 Photographers', '4 Photographers', '5+ Photographers', 'Custom'] as const;
const DELIVERY_OPTIONS = ['3 Days', '5 Days', '7 Days', '10 Days', '15 Days', '30 Days', 'Custom'] as const;
const emptyAlbum = (): Album => ({ type: '', size: '', pages: '', price: '', is_active: true });
const emptyAddon = (): Addon => ({ name: '', price: '', description: '' });
const nullableNum = (value: string) => value === '' ? null : Number(value);
const inputClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition placeholder:text-stone-400 focus:border-[#8b1538] focus:ring-2 focus:ring-[#8b1538]/15 disabled:bg-stone-100';
const blank = (): Draft => ({ name: '', price: '', photography_type: 'Wedding', duration: '', team_size: '1 Photographer', team_custom: '', edited: '', unlimited: false, raw: false, delivery: '7 Days', travel: false, radius: '', travelCharge: '', maxDistance: '', description: '', highlights: [], highlightInput: '', status: 'draft', albumIncluded: false, addons: [], albums: [], files: [], images: [] });

const teamValue = (team: string) => team === 'Custom' ? 0 : team === '5+ Photographers' ? 5 : Number(team.charAt(0));
const teamLabel = (draft: Draft) => draft.team_size === 'Custom' ? `${draft.team_custom || 'Custom'} Photographers Included` : `${draft.team_size} Included`;
const parseTravelDetails = (value: unknown) => { try { const parsed = JSON.parse(String(value || '{}')); return typeof parsed.maxDistance === 'number' || typeof parsed.maxDistance === 'string' ? String(parsed.maxDistance) : ''; } catch { return ''; } };

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
    id: pack.id, name: pack.name, price: String(pack.price), photography_type: pack.photography_type || 'Wedding', duration: pack.duration || '',
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
    if (error) toast.error(error.message); else { setDraft({ ...draft, images }); refresh(); }
  };
  const setCover = async (image: Image) => {
    if (!draft?.id) return;
    const off = await supabase.from('photography_package_images' as any).update({ is_cover: false }).eq('package_id', draft.id);
    const on = !off.error && await supabase.from('photography_package_images' as any).update({ is_cover: true }).eq('id', image.id);
    if (off.error || (on as any)?.error) return toast.error(off.error?.message || (on as any).error.message);
    setDraft({ ...draft, images: draft.images.map(current => ({ ...current, is_cover: current.id === image.id })) });
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
    {draft && <Editor d={draft} patch={(value: Partial<Draft>) => setDraft(current => current && ({ ...current, ...value }))} close={() => setDraft(null)} save={save} busy={busy} setCover={setCover} removeImage={removeImage} updateImageOrder={updateImageOrder} />}
  </div>;
}

function Editor({ d, patch, close, save, busy, setCover, removeImage, updateImageOrder }: any) {
  const [dragging, setDragging] = useState(false);
  const addFiles = (files: FileList | File[]) => patch({ files: [...d.files, ...Array.from(files)] });
  const addHighlight = () => { const text = d.highlightInput.trim(); if (text && !d.highlights.includes(text)) patch({ highlights: [...d.highlights, text], highlightInput: '' }); };
  const previews = useMemo(() => d.files.map((file: File) => ({ file, url: URL.createObjectURL(file) })), [d.files]);
  useEffect(() => () => previews.forEach(item => URL.revokeObjectURL(item.url)), [previews]);
  const Field = ({ label, children, hint }: { label: string; children: any; hint?: string }) => <label className="block"><span className="text-sm font-semibold text-[#4b1d2b]">{label}</span>{hint && <span className="ml-1.5 text-xs font-normal text-stone-500">{hint}</span>}<div className="mt-1.5">{children}</div></label>;
  const Card = ({ title, subtitle, children }: { title: string; subtitle?: string; children: any }) => <section className="rounded-2xl border border-[#eadfcf] bg-[#fffdfa] p-4 shadow-[0_2px_10px_rgba(72,28,37,0.04)] sm:p-5"><div className="mb-4"><h3 className="font-bold text-[#62132d]">{title}</h3>{subtitle && <p className="mt-0.5 text-xs text-stone-500">{subtitle}</p>}</div>{children}</section>;
  const Toggle = ({ checked, onChange, label, description }: { checked: boolean; onChange: (checked: boolean) => void; label: string; description: string }) => <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#eadfcf] bg-white p-3 text-left transition hover:border-[#c99b43]"><span><span className="block text-sm font-semibold text-[#4b1d2b]">{label}</span><span className="block text-xs text-stone-500">{description}</span></span><span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-[#8b1538]' : 'bg-stone-300'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${checked ? 'left-6' : 'left-1'}`} /></span></button>;
  return <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#250914]/65 p-3 backdrop-blur-sm sm:p-6"><div className="mx-auto my-3 max-w-5xl overflow-hidden rounded-[24px] bg-[#fffaf3] shadow-2xl"><header className="flex items-start justify-between gap-4 bg-[#70102d] px-5 py-5 text-white sm:px-7"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f4d58d]">Vowza studio</p><h2 className="mt-1 text-xl font-bold">{d.id ? 'Edit photography package' : 'Create photography package'}</h2><p className="mt-1 text-sm text-white/75">Build a polished package your customers can understand at a glance.</p></div><button type="button" onClick={close} className="rounded-full p-2 text-white/85 transition hover:bg-white/15 hover:text-white" aria-label="Close"><X /></button></header><div className="space-y-4 p-4 sm:p-6">
    <Card title="Package details" subtitle="Set the essentials customers see first."><div className="grid gap-4 sm:grid-cols-2"><Field label="Package Name"><input className={inputClass} value={d.name} onChange={e => patch({ name: e.target.value })} placeholder="e.g. Timeless Wedding Story" /></Field><Field label="Photography Type"><select className={inputClass} value={d.photography_type} onChange={e => patch({ photography_type: e.target.value })}>{PHOTOGRAPHY_TYPES.map(type => <option key={type}>{type}</option>)}</select></Field><Field label="Duration"><select className={inputClass} value={d.duration} onChange={e => patch({ duration: e.target.value })}><option value="">Select duration</option>{DURATION_OPTIONS.map(duration => <option key={duration}>{duration}</option>)}</select></Field><Field label="Starting Price"><div className="relative"><span className="absolute left-3.5 top-2.5 text-sm text-stone-500">₹</span><input className={`${inputClass} pl-7`} type="number" min="0" value={d.price} onChange={e => patch({ price: e.target.value })} placeholder="0" /></div></Field></div></Card>
    <Card title="Package inclusions" subtitle="Make your offering specific and easy to compare."><div className="grid gap-4 sm:grid-cols-2"><Field label="Photography Team"><select className={inputClass} value={d.team_size} onChange={e => patch({ team_size: e.target.value })}>{TEAM_OPTIONS.map(team => <option key={team}>{team}</option>)}</select></Field>{d.team_size === 'Custom' && <Field label="Custom team size *"><input className={inputClass} type="number" min="1" value={d.team_custom} onChange={e => patch({ team_custom: e.target.value })} placeholder="Number of photographers" /></Field>}<Field label="Edited Photos Included"><div className="space-y-2"><input className={inputClass} disabled={d.unlimited} type="number" min="0" value={d.edited} onChange={e => patch({ edited: e.target.value })} placeholder="Number of edited photos" /><label className="flex items-center gap-2 text-xs font-medium text-[#62132d]"><input type="checkbox" checked={d.unlimited} onChange={e => patch({ unlimited: e.target.checked, edited: e.target.checked ? '' : d.edited })} className="accent-[#8b1538]" />Unlimited edited photos</label></div></Field><Field label="Delivery Time"><select className={inputClass} value={d.delivery} onChange={e => patch({ delivery: e.target.value })}>{DELIVERY_OPTIONS.map(delivery => <option key={delivery}>{delivery}</option>)}</select></Field></div></Card>
    <Card title="Description" subtitle="A concise customer-facing summary of this package."><textarea className={`${inputClass} min-h-24 resize-y`} value={d.description} onChange={e => patch({ description: e.target.value })} placeholder="Tell customers what makes this package special..." /></Card>
    <Card title="Raw Photos Included" subtitle="Let customers know whether they receive original files."><Toggle checked={d.raw} onChange={raw => patch({ raw })} label="Include raw photos" description={d.raw ? 'Original files are included with this package.' : 'Original files are not included.'} /></Card>
    <Card title="Album Included" subtitle="Offer included or paid album choices through the existing album options."><Toggle checked={d.albumIncluded} onChange={albumIncluded => patch({ albumIncluded, albums: albumIncluded && !d.albums.length ? [emptyAlbum()] : d.albums })} label="Include album options" description={d.albumIncluded ? 'Customers can select an album with this package.' : 'No album options will be shown.'} />{d.albumIncluded && <AlbumRows albums={d.albums} onChange={(albums: Album[]) => patch({ albums })} />}</Card>
    <Card title="Travel Included" subtitle="Set included travel coverage and any additional travel charge."><Toggle checked={d.travel} onChange={travel => patch({ travel })} label="Include travel" description={d.travel ? 'Travel coverage is part of this package.' : 'Travel terms are not included.'} />{d.travel && <div className="mt-4 grid gap-4 sm:grid-cols-3"><Field label="Free Radius (KM)"><input className={inputClass} type="number" min="0" value={d.radius} onChange={e => patch({ radius: e.target.value })} placeholder="0" /></Field><Field label="Extra per KM (₹)"><input className={inputClass} type="number" min="0" value={d.travelCharge} onChange={e => patch({ travelCharge: e.target.value })} placeholder="0" /></Field><Field label="Maximum Distance (KM)"><input className={inputClass} type="number" min="0" value={d.maxDistance} onChange={e => patch({ maxDistance: e.target.value })} placeholder="Optional" /></Field></div>}</Card>
    <Card title="Highlights" subtitle="Add concise selling points as chips—one at a time."><div className="flex gap-2"><input className={inputClass} value={d.highlightInput} onChange={e => patch({ highlightInput: e.target.value })} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addHighlight())} placeholder="e.g. Candid coverage" /><button type="button" onClick={addHighlight} className="shrink-0 rounded-xl bg-[#f4d58d] px-4 text-sm font-bold text-[#62132d] transition hover:bg-[#e8c46e]">Add</button></div>{d.highlights.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{d.highlights.map((highlight: string) => <span key={highlight} className="inline-flex items-center gap-1.5 rounded-full bg-[#f7ead7] px-3 py-1.5 text-xs font-semibold text-[#70102d]"><Check className="h-3 w-3" />{highlight}<button type="button" onClick={() => patch({ highlights: d.highlights.filter((item: string) => item !== highlight) })} aria-label={`Remove ${highlight}`}><X className="h-3.5 w-3.5" /></button></span>)}</div>}</Card>
    <Card title="Package Images" subtitle="Upload up to 8MB per image. Drag existing images to reorder; choose a cover image."><div onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event: DragEvent) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }} className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${dragging ? 'border-[#8b1538] bg-[#fbf0e4]' : 'border-[#d8b77b] bg-[#fffdf9]'}`}><Upload className="mx-auto mb-2 h-6 w-6 text-[#8b1538]" /><p className="text-sm font-semibold text-[#4b1d2b]">Drop your images here</p><p className="mt-1 text-xs text-stone-500">or <label className="cursor-pointer font-bold text-[#8b1538] underline">browse files<input className="hidden" type="file" accept="image/*" multiple onChange={(event: ChangeEvent<HTMLInputElement>) => addFiles(event.target.files ?? [])} /></label></p></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{d.images.map((image: Image, index: number) => <ImageTile key={image.id} image={image} index={index} onReorder={(from: number, to: number) => { if (from === to) return; const next = [...d.images]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); updateImageOrder(next); }} setCover={setCover} remove={() => removeImage(image)} />)}{previews.map(({ file, url }: { file: File; url: string }, index: number) => <div key={`${file.name}-${index}`} className="relative overflow-hidden rounded-xl border border-[#eadfcf]"><img src={url} className="h-28 w-full object-cover" alt="New package preview" /><span className="absolute left-2 top-2 rounded-full bg-[#f4d58d] px-2 py-0.5 text-[10px] font-bold text-[#62132d]">NEW</span><button type="button" onClick={() => patch({ files: d.files.filter((_: File, fileIndex: number) => fileIndex !== index) })} className="absolute right-2 top-2 rounded-full bg-black/65 p-1 text-white"><X className="h-3.5 w-3.5" /></button></div>)}</div></Card>
    <Card title="Add-ons" subtitle="Give customers optional extras to tailor their package."><AddonRows addons={d.addons} onChange={(addons: Addon[]) => patch({ addons })} /></Card>
    <Card title="Preview" subtitle="This mirrors the compact package card customers will review."><PackagePreview d={d} /></Card>
    <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-[#eadfcf] bg-[#fffaf3]/95 pt-4 backdrop-blur sm:flex-row"><button type="button" onClick={close} className="rounded-xl border border-[#d7c5ae] px-5 py-3 text-sm font-bold text-[#5a3440] transition hover:bg-white sm:flex-1">Cancel</button><button type="button" disabled={busy} onClick={save} className="rounded-xl bg-[#8b1538] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#70102d] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-[2]">{busy ? 'Saving package…' : 'Save Package'}</button></div>
  </div></div></div>;
}

function ImageTile({ image, index, onReorder, setCover, remove }: { image: Image; index: number; onReorder: (from: number, to: number) => void; setCover: (image: Image) => void; remove: () => void }) { return <div draggable onDragStart={(event: any) => event.dataTransfer.setData('image-index', String(index))} onDrop={(event: any) => { const from = Number(event.dataTransfer.getData('image-index')); if (!Number.isNaN(from)) onReorder(from, index); }} onDragOver={(event: any) => event.preventDefault()} className="group relative overflow-hidden rounded-xl border border-[#eadfcf]"><img src={image.public_url} className="h-28 w-full object-cover" alt="Package" />{image.is_cover && <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#f4d58d] px-2 py-0.5 text-[10px] font-bold text-[#62132d]"><Star className="h-3 w-3 fill-current" />Cover</span>}<div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/65 p-2 text-[10px] text-white opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100"><GripVertical className="h-4 w-4" /><button type="button" onClick={() => setCover(image)} className="font-bold">{image.is_cover ? 'Cover image' : 'Set cover'}</button><button type="button" onClick={remove}>Delete</button></div></div>; }

function AlbumRows({ albums, onChange }: { albums: Album[]; onChange: (albums: Album[]) => void }) { const update = (index: number, key: keyof Album, value: string | boolean) => onChange(albums.map((album, albumIndex) => albumIndex === index ? { ...album, [key]: value } : album)); return <div className="mt-4 space-y-3">{albums.map((album, index) => <div key={index} className="rounded-xl border border-[#eadfcf] bg-white p-3"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><input className={inputClass} placeholder="Album type" value={album.type} onChange={event => update(index, 'type', event.target.value)} /><input className={inputClass} placeholder="Album size" value={album.size} onChange={event => update(index, 'size', event.target.value)} /><input className={inputClass} type="number" min="1" placeholder="Pages" value={album.pages} onChange={event => update(index, 'pages', event.target.value)} /><input className={inputClass} type="number" min="0" placeholder="Additional price (₹)" value={album.price} onChange={event => update(index, 'price', event.target.value)} /></div><div className="mt-3 flex items-center justify-between"><label className="text-xs font-semibold text-[#62132d]"><input type="checkbox" checked={album.is_active} onChange={event => update(index, 'is_active', event.target.checked)} className="mr-2 accent-[#8b1538]" />Available to customers</label><button type="button" onClick={() => onChange(albums.filter((_, albumIndex) => albumIndex !== index))} className="text-xs font-bold text-red-700"><Trash2 className="mr-1 inline h-3.5 w-3.5" />Remove</button></div></div>)}<button type="button" onClick={() => onChange([...albums, emptyAlbum()])} className="text-sm font-bold text-[#8b1538]"><Plus className="mr-1 inline h-4" />Add album option</button></div>; }

function AddonRows({ addons, onChange }: { addons: Addon[]; onChange: (addons: Addon[]) => void }) { const update = (index: number, key: keyof Addon, value: string) => onChange(addons.map((addon, addonIndex) => addonIndex === index ? { ...addon, [key]: value } : addon)); return <div className="space-y-3">{addons.map((addon, index) => <div key={index} className="grid gap-3 rounded-xl border border-[#eadfcf] bg-white p-3 sm:grid-cols-[1fr_150px_1.5fr_auto]"><input className={inputClass} placeholder="Name" value={addon.name} onChange={event => update(index, 'name', event.target.value)} /><input className={inputClass} type="number" min="0" placeholder="Price (₹)" value={addon.price} onChange={event => update(index, 'price', event.target.value)} /><input className={inputClass} placeholder="Description" value={addon.description} onChange={event => update(index, 'description', event.target.value)} /><button type="button" onClick={() => onChange(addons.filter((_, addonIndex) => addonIndex !== index))} className="self-center rounded-lg p-2 text-red-700 hover:bg-red-50" aria-label="Remove add-on"><Trash2 className="h-4 w-4" /></button></div>)}<button type="button" onClick={() => onChange([...addons, emptyAddon()])} className="text-sm font-bold text-[#8b1538]"><Plus className="mr-1 inline h-4" />Add add-on</button></div>; }

function PackagePreview({ d }: { d: Draft }) { const albumPrices = d.albums.filter(album => album.price !== '').map(album => Number(album.price)); return <div className="overflow-hidden rounded-2xl border border-[#e4d4bd] bg-white shadow-sm"><div className="h-24 bg-gradient-to-br from-[#68102c] via-[#8b1538] to-[#bd8134] p-4 text-white"><span className="rounded-full bg-white/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide">{d.photography_type}</span><div className="mt-3 flex items-end justify-between gap-3"><h4 className="truncate text-lg font-bold">{d.name || 'Your package name'}</h4><span className="shrink-0 text-lg font-bold">₹{d.price || '0'}</span></div></div><div className="space-y-2 p-4 text-sm text-[#4b1d2b]"><p>{d.duration || 'Duration'} · {teamLabel(d)}</p><p>{d.unlimited ? 'Unlimited edited photos' : `${d.edited || '0'} edited photos`} · Delivery in {d.delivery}</p>{d.raw && <p>Raw photos included</p>}{d.travel && <p>Travel included{d.radius && ` within ${d.radius} KM`}</p>}{d.highlights.length > 0 && <div className="flex flex-wrap gap-1.5 pt-1">{d.highlights.map(highlight => <span key={highlight} className="rounded-full bg-[#f7ead7] px-2 py-1 text-xs font-semibold text-[#70102d]">{highlight}</span>)}</div>}{d.albumIncluded && albumPrices.length > 0 && <p className="border-t border-stone-100 pt-2 text-xs text-stone-600">Album options from ₹{Math.min(...albumPrices).toLocaleString('en-IN')}</p>}</div></div>; }
