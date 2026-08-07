import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Check, ShoppingCart, X } from 'lucide-react'; import { useNavigate } from 'react-router-dom'; import { supabase } from '@/integrations/supabase/client'; import { useAuth } from '@/contexts/AuthContext'; import { toast } from 'sonner';
type Selection = { addons: string[]; albumId: string | null };
export default function PhotographerPackages({ provider, profile }: { provider: any; profile: any }) {
 const { user } = useAuth(); const nav = useNavigate(); const qc = useQueryClient(); const [selection, setSelection] = useState<Record<string, Selection>>({}); const [detail, setDetail] = useState<any>(null); const [busy, setBusy] = useState<string | null>(null);
 const [cartCount, setCartCount] = useState(0);
 useEffect(() => {
  if (!user) return;
  supabase.from('photography_carts' as any).select('id, photography_cart_items(id)').eq('customer_id', user.id).eq('photographer_id', provider.id).eq('status', 'active').maybeSingle().then(({ data }) => {
    setCartCount(data?.photography_cart_items?.length ?? 0);
  });
 }, [user, provider.id, busy]);
 const { data: rows = [], isLoading } = useQuery({ queryKey: ['public-photography-packages', provider.id], queryFn: async () => { const r = await supabase.from('photography_packages' as any).select('*, photography_package_images(*), photography_package_highlights(*), photography_package_addons(*), photography_albums(*)').eq('photographer_id', provider.id).eq('is_active', true).eq('is_visible', true).eq('status', 'published').order('created_at'); if (r.error) throw r.error; return r.data ?? []; } });
 useEffect(() => { const c = supabase.channel(`public-photography-${provider.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'photography_packages', filter: `photographer_id=eq.${provider.id}` }, () => qc.invalidateQueries({ queryKey: ['public-photography-packages', provider.id] })).on('postgres_changes', { event: '*', schema: 'public', table: 'photography_package_images' }, () => qc.invalidateQueries({ queryKey: ['public-photography-packages', provider.id] })).on('postgres_changes', { event: '*', schema: 'public', table: 'photography_albums' }, () => qc.invalidateQueries({ queryKey: ['public-photography-packages', provider.id] })).subscribe(); return () => { supabase.removeChannel(c); }; }, [provider.id]);
 const choose = (p: any) => selection[p.id] ?? { addons: [], albumId: null }; const setChoose = (p: any, value: Selection) => setSelection(s => ({ ...s, [p.id]: value }));
 const add = async (p: any, checkout = false) => {
  if (!user) { toast.error('Please log in to continue'); return nav('/auth'); }
  setBusy(p.id);
  const s = choose(p);

  if (checkout) {
    // BOOK NOW: Clear existing cart items first, then add only this package
    const { data: existingCart } = await supabase
      .from('photography_carts' as any)
      .select('id')
      .eq('customer_id', user.id)
      .eq('photographer_id', provider.id)
      .eq('status', 'active')
      .maybeSingle();

    if (existingCart) {
      // Delete all items from existing cart
      await supabase.from('photography_cart_items' as any).delete().eq('cart_id', existingCart.id);
    }
  }

  const { data: cartId, error } = await supabase.rpc('add_photography_cart_item' as any, { p_package_id: p.id, p_addon_ids: s.addons, p_album_id: s.albumId });
  setBusy(null);
  if (error) return toast.error(error.message);
  sessionStorage.setItem('vowza_photography_checkout', JSON.stringify({ cartId, providerName: profile.full_name }));

  if (checkout) {
    toast.success('Proceeding to checkout...');
    nav('/checkout?photography=1');
  } else {
    toast.success('Added to cart! View cart from the menu to checkout.');
  }
 };
 if (isLoading) return <div className="h-48 animate-pulse rounded-2xl bg-muted" />; if (!rows.length) return <div className="rounded-2xl border bg-surface-1 p-10 text-center text-sm text-muted-foreground">This photographer has not published packages yet.</div>;
 return <div className="space-y-5"><div><h2 className="text-xl font-bold">Photography Packages</h2><p className="text-sm text-muted-foreground">Choose coverage, then add optional albums and extras before booking.</p></div><div className="grid gap-4 md:grid-cols-2">{rows.map((p: any) => <Card key={p.id} p={p} value={choose(p)} setValue={(v: Selection) => setChoose(p, v)} view={() => setDetail(p)} add={() => add(p)} book={() => add(p, true)} busy={busy === p.id} />)}</div>{cartCount > 0 && (
  <div className="sticky bottom-4 z-40 flex justify-center">
    <button onClick={async () => {
      const { data } = await supabase.from('photography_carts' as any).select('id').eq('customer_id', user!.id).eq('photographer_id', provider.id).eq('status', 'active').maybeSingle();
      if (data) {
        sessionStorage.setItem('vowza_photography_checkout', JSON.stringify({ cartId: data.id, providerName: profile.full_name }));
        nav('/checkout?photography=1');
      }
    }} className="flex items-center gap-2 rounded-2xl bg-[#8B1538] px-6 py-3.5 text-sm font-bold text-white shadow-2xl hover:bg-[#70102d] transition-colors">
      <ShoppingCart className="h-4 w-4" />
      View Cart ({cartCount} {cartCount === 1 ? 'package' : 'packages'}) — Checkout
    </button>
  </div>
)}{detail && <Detail p={detail} value={choose(detail)} setValue={(v: Selection) => setChoose(detail, v)} close={() => setDetail(null)} add={() => add(detail)} book={() => add(detail, true)} busy={busy === detail.id} />}</div>;
}
const total = (p: any, s: Selection) => Number(p.price) + (p.photography_package_addons ?? []).filter((a: any) => s.addons.includes(a.id)).reduce((n: number, a: any) => n + Number(a.price), 0) + Number((p.photography_albums ?? []).find((a: any) => a.id === s.albumId)?.price ?? 0);
function Options({ p, value, setValue }: any) { const activeAlbums = (p.photography_albums ?? []).filter((a: any) => a.is_active); return <div className="mt-3 space-y-2 text-xs">{activeAlbums.length > 0 && <fieldset><legend className="mb-1 font-semibold">Optional album</legend><label className="mr-3"><input type="radio" checked={!value.albumId} onChange={() => setValue({ ...value, albumId: null })} /> No album</label>{activeAlbums.map((a: any) => <label key={a.id} className="mr-3 inline-block"><input type="radio" checked={value.albumId === a.id} onChange={() => setValue({ ...value, albumId: a.id })} /> {a.type} · {a.size} · {a.pages} pages (+₹{Number(a.price).toLocaleString('en-IN')})</label>)}</fieldset>}{(p.photography_package_addons ?? []).filter((a: any) => a.is_active).map((a: any) => <label key={a.id} className="flex justify-between rounded-lg bg-secondary p-2"><span><input type="checkbox" checked={value.addons.includes(a.id)} onChange={() => setValue({ ...value, addons: value.addons.includes(a.id) ? value.addons.filter((id: string) => id !== a.id) : [...value.addons, a.id] })} /> <b>{a.name}</b>{a.description && ` — ${a.description}`}</span><b>+₹{Number(a.price).toLocaleString('en-IN')}</b></label>)}</div>; }
function Card({ p, value, setValue, view, add, book, busy }: any) { const im = p.photography_package_images?.find((x: any) => x.is_cover) ?? p.photography_package_images?.[0]; return <div className="overflow-hidden rounded-2xl border bg-surface-1"><div className="h-44 bg-secondary">{im ? <img src={im.public_url} alt={p.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Camera /></div>}</div><div className="p-5"><div className="flex justify-between"><h3 className="font-bold">{p.name}</h3><b>₹{Number(p.price).toLocaleString('en-IN')}</b></div><p className="mt-1 text-xs text-muted-foreground">{p.photography_type} · {p.duration} · {p.team_size_custom || p.team_size} member team · Delivery {p.delivery_time}</p><p className="mt-2 text-xs">{p.edited_photos === null ? 'Unlimited edited photos' : `${p.edited_photos} edited photos`}{p.raw_photos_included && ' · Raw files included'}{p.travel_included && ` · ${p.travel_radius_km ?? 0} km travel included`}</p>{p.description && <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>}<ul className="mt-2">{(p.photography_package_highlights ?? []).slice(0, 3).map((h: any) => <li key={h.id} className="text-xs"><Check className="mr-1 inline h-3 text-emerald-600" />{h.text}</li>)}</ul><Options p={p} value={value} setValue={setValue} /><div className="mt-4 grid grid-cols-3 gap-2"><button onClick={view} className="rounded-xl border py-2 text-xs font-semibold">View Details</button><button disabled={busy} onClick={add} className="rounded-xl border border-[#8B1538] py-2 text-xs font-semibold text-[#8B1538]"><ShoppingCart className="mr-1 inline h-3" />Add to Cart</button><button disabled={busy} onClick={book} className="rounded-xl bg-[#8B1538] py-2 text-xs font-semibold text-white">{busy ? 'Adding…' : `Book Now · ₹${total(p, value).toLocaleString('en-IN')}`}</button></div></div></div>; }
function Detail({ p, value, setValue, close, add, book, busy }: any) { const images = [...(p.photography_package_images ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order); return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white"><div className="relative grid grid-cols-2 gap-1 bg-secondary">{images.length ? images.map((im: any) => <img key={im.id} src={im.public_url} alt={p.name} className="h-40 w-full object-cover" />) : <div className="h-56" />}<button onClick={close} className="absolute right-3 top-3 rounded-full bg-white p-2"><X className="h-4" /></button></div><div className="space-y-4 p-6"><div className="flex justify-between"><div><h2 className="text-xl font-bold">{p.name}</h2><p className="text-sm text-muted-foreground">{p.photography_type} · {p.duration}</p></div><b>From ₹{Number(p.price).toLocaleString('en-IN')}</b></div><p className="text-sm">{p.description}</p><div className="grid grid-cols-2 gap-2 rounded-xl bg-secondary p-3 text-sm"><span>Team: {p.team_size_custom || p.team_size}</span><span>Delivery: {p.delivery_time}</span><span>Edited: {p.edited_photos === null ? 'Unlimited' : p.edited_photos}</span><span>Raw files: {p.raw_photos_included ? 'Included' : 'Not included'}</span>{p.travel_included && <span>Travel: {p.travel_radius_km ?? 0} km included</span>}</div><ul>{(p.photography_package_highlights ?? []).map((h: any) => <li key={h.id} className="text-sm"><Check className="mr-1 inline h-4 text-emerald-600" />{h.text}</li>)}</ul><Options p={p} value={value} setValue={setValue} /><div className="flex justify-between border-t pt-3"><b>Total: ₹{total(p, value).toLocaleString('en-IN')}</b><span className="text-xs text-muted-foreground">Album is optional</span></div><div className="grid grid-cols-2 gap-3"><button disabled={busy} onClick={add} className="rounded-xl border border-[#8B1538] py-3 font-semibold text-[#8B1538]">Add to Cart</button><button disabled={busy} onClick={book} className="rounded-xl bg-[#8B1538] py-3 font-semibold text-white">Book Now</button></div></div></div></div>; }
