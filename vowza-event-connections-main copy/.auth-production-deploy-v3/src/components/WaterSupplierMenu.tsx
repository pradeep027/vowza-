import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Minus, Plus, ShoppingBag, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

type Line = { productId: string; variantId: string; productName: string; variantLabel: string; price: number; quantity: number };

export default function WaterSupplierMenu({ provider, profile }: { provider: any; profile: any }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [lines, setLines] = useState<Record<string, Line>>({});
  const { data: products = [], isLoading } = useQuery({ queryKey: ['public-water-products', provider.id], queryFn: async () => {
    const { data, error } = await supabase.from('water_products' as any).select('*, water_categories(name,code), water_product_variants(*), water_product_images(*)').eq('provider_id', provider.id).eq('is_active', true).eq('is_visible', true).eq('is_archived', false).order('created_at');
    if (error) throw error;
    return (data ?? []) as any[];
  } });
  useEffect(() => {
    const channel = supabase.channel(`water-menu-${provider.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'water_products', filter: `provider_id=eq.${provider.id}` }, () => queryClient.invalidateQueries({ queryKey: ['public-water-products', provider.id] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'water_product_variants' }, () => queryClient.invalidateQueries({ queryKey: ['public-water-products', provider.id] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'water_product_images' }, () => queryClient.invalidateQueries({ queryKey: ['public-water-products', provider.id] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'water_product_stock' }, () => queryClient.invalidateQueries({ queryKey: ['water-variant-availability', provider.id] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'water_product_reviews' }, () => queryClient.invalidateQueries({ queryKey: ['water-product-reviews', provider.id] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [provider.id, queryClient]);

  const { data: availability = [] } = useQuery({ queryKey: ['water-variant-availability', provider.id], queryFn: async () => { const { data, error } = await supabase.rpc('get_water_variant_availability' as any, { p_provider_id: provider.id }); if (error) throw error; return (data ?? []) as any[]; } });
  const { data: reviews = [] } = useQuery({ queryKey: ['water-product-reviews', provider.id], queryFn: async () => { const { data, error } = await supabase.from('water_product_reviews' as any).select('product_id,rating,water_products!inner(provider_id)').eq('water_products.provider_id', provider.id); if (error) throw error; return (data ?? []) as any[]; } });
  const availabilityByVariant = useMemo(() => new Map(availability.map((row: any) => [row.variant_id, row.is_in_stock])), [availability]);
  const ratingByProduct = useMemo(() => reviews.reduce((map: Map<string, { total: number; count: number }>, review: any) => { const current = map.get(review.product_id) ?? { total: 0, count: 0 }; current.total += Number(review.rating); current.count += 1; map.set(review.product_id, current); return map; }, new Map<string, { total: number; count: number }>()), [reviews]);
  const groups = useMemo(() => products.reduce((result: Record<string, any[]>, product: any) => { const key = product.water_categories?.name ?? 'Water Products'; (result[key] ??= []).push(product); return result; }, {}), [products]);
  const selected = Object.values(lines);
  const total = selected.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const update = (product: any, variant: any, delta: number) => setLines(current => {
    const key = variant.id;
    const existing = current[key];
    const quantity = Math.max(0, (existing?.quantity ?? 0) + delta);
    if (!quantity) { const next = { ...current }; delete next[key]; return next; }
    return { ...current, [key]: { productId: product.id, variantId: variant.id, productName: product.name, variantLabel: variant.label, price: Number(variant.price), quantity } };
  });
  const checkout = () => {
    if (!user) { toast.error('Please log in to book water products'); navigate('/auth'); return; }
    if (!selected.length) return;
    sessionStorage.setItem('vowza_water_checkout', JSON.stringify({ providerId: provider.id, providerName: profile.full_name, lines: selected }));
    navigate('/checkout?water=1');
  };
  if (isLoading) return <div className="space-y-4">{[1,2].map(item => <div key={item} className="h-40 animate-pulse rounded-2xl bg-muted" />)}</div>;
  if (!products.length) return <div className="rounded-2xl border border-border/60 bg-surface-1 p-10 text-center text-sm text-muted-foreground">This supplier has not published water products yet.</div>;
  return <div className="space-y-7 pb-24"><div><h2 className="text-xl font-bold">Water Products</h2><p className="mt-1 text-sm text-muted-foreground">Choose products and quantities for delivery.</p></div>{Object.entries(groups).map(([category, items]) => <section key={category}><h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">{category}</h3><div className="space-y-3">{items.map((product: any) => { const image = product.water_product_images?.find((row: any) => row.is_cover) ?? product.water_product_images?.[0]; const rating = ratingByProduct.get(product.id); return <div key={product.id} className="flex gap-4 rounded-2xl border border-border/60 bg-surface-1 p-4"><div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-secondary">{image && <img className="h-full w-full object-cover" src={image.public_url} alt={product.name} />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="font-semibold">{product.name}</h4><p className="mt-1 text-xs text-muted-foreground">{product.description}</p></div><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">Available</span></div><p className="mt-2 text-xs text-muted-foreground">Delivery in {product.delivery_time_minutes} minutes{rating && ` · ★ ${(rating.total / rating.count).toFixed(1)} (${rating.count})`}</p><div className="mt-3 space-y-2">{product.water_product_variants?.filter((variant: any) => variant.is_available && availabilityByVariant.get(variant.id)).map((variant: any) => { const line = lines[variant.id]; return <div key={variant.id} className="flex items-center justify-between gap-3 rounded-lg bg-secondary px-3 py-2"><span className="text-sm font-medium">{variant.label} <b className="ml-1">₹{Number(variant.price).toLocaleString('en-IN')}</b></span><div className="flex items-center gap-2"><button onClick={() => update(product, variant, -1)} disabled={!line} className="rounded-md border border-border p-1 disabled:opacity-30"><Minus className="h-3 w-3" /></button><span className="w-4 text-center text-sm font-bold">{line?.quantity ?? 0}</span><button onClick={() => update(product, variant, 1)} className="rounded-md bg-maroon p-1 text-white"><Plus className="h-3 w-3" /></button></div></div>; })}</div></div></div>; })}</div></section>) }<div className="fixed bottom-3 left-3 right-3 z-40 mx-auto flex max-w-lg items-center justify-between rounded-2xl bg-zinc-950 p-3 text-white shadow-2xl"><div><p className="text-xs text-white/60">{selected.reduce((sum, line) => sum + line.quantity, 0)} item(s)</p><p className="font-bold">₹{total.toLocaleString('en-IN')}</p></div><button disabled={!selected.length} onClick={checkout} className="flex items-center gap-2 rounded-xl bg-gradient-gold px-4 py-3 text-sm font-bold text-zinc-950 disabled:opacity-40"><ShoppingBag className="h-4 w-4" />Proceed to checkout</button></div></div>;
}
