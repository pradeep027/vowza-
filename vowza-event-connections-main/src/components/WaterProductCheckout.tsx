import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, MapPin, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Payload = { providerId: string; providerName: string; lines: { productId: string; variantId: string; productName: string; variantLabel: string; price: number; quantity: number }[] };

export default function WaterProductCheckout({ payload }: { payload: Payload }) {
  const navigate = useNavigate();
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [slot, setSlot] = useState('Same day');
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const subtotal = useMemo(() => payload.lines.reduce((sum, line) => sum + line.price * line.quantity, 0), [payload]);
  const getQuote = async () => {
    if (!address.trim() || !latitude || !longitude) { toast.error('Enter your delivery address and map coordinates.'); return; }
    setLoading(true);
    const { data, error } = await supabase.rpc('quote_water_delivery' as any, { p_provider_id: payload.providerId, p_delivery_lat: Number(latitude), p_delivery_lng: Number(longitude) });
    setLoading(false);
    if (error) toast.error(error.message); else setQuote(Array.isArray(data) ? data[0] : data);
  };
  const placeOrder = async () => {
    if (!quote) { toast.error('Calculate delivery before placing the order.'); return; }
    setLoading(true);
    const { data, error } = await supabase.rpc('create_water_product_order' as any, { p_provider_id: payload.providerId, p_items: payload.lines.map(line => ({ productId: line.productId, variantId: line.variantId, quantity: line.quantity })), p_delivery_address: address.trim(), p_delivery_lat: Number(latitude), p_delivery_lng: Number(longitude), p_delivery_date: date, p_delivery_time_slot: slot });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    sessionStorage.removeItem('vowza_water_checkout');
    toast.success('Water order placed successfully.');
    navigate('/my-bookings');
  };
  return <div className="min-h-screen bg-background px-4 py-8"><div className="mx-auto max-w-4xl"><button onClick={() => navigate(-1)} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"><ArrowLeft className="h-4 w-4" />Back to menu</button><h1 className="text-2xl font-bold">Water product checkout</h1><p className="mt-1 text-sm text-muted-foreground">Ordering from {payload.providerName}</p><div className="mt-6 grid gap-6 md:grid-cols-2"><div className="space-y-5 rounded-2xl border border-border bg-white p-5"><h2 className="font-bold">Delivery details</h2><label className="block text-sm font-medium">Delivery address<textarea value={address} onChange={event => setAddress(event.target.value)} className="mt-1 w-full rounded-xl border border-border p-3" rows={3} placeholder="House, street, area, city" /></label><div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium">Latitude<input value={latitude} onChange={event => setLatitude(event.target.value)} className="mt-1 w-full rounded-xl border border-border p-3" placeholder="17.3850" /></label><label className="text-sm font-medium">Longitude<input value={longitude} onChange={event => setLongitude(event.target.value)} className="mt-1 w-full rounded-xl border border-border p-3" placeholder="78.4867" /></label></div><p className="text-xs text-muted-foreground">Coordinates are supplied by the configured map/geocoder integration; they are used only to calculate the supplier&apos;s configured delivery distance.</p><div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium">Date<input type="date" min={new Date().toISOString().slice(0, 10)} value={date} onChange={event => setDate(event.target.value)} className="mt-1 w-full rounded-xl border border-border p-3" /></label><label className="text-sm font-medium">Time<select value={slot} onChange={event => setSlot(event.target.value)} className="mt-1 w-full rounded-xl border border-border p-3"><option>Same day</option><option>Morning</option><option>Afternoon</option><option>Evening</option></select></label></div><button disabled={loading} onClick={getQuote} className="w-full rounded-xl border border-maroon py-3 text-sm font-bold text-maroon disabled:opacity-50"><MapPin className="mr-1 inline h-4 w-4" />Calculate delivery</button></div><div className="space-y-4 rounded-2xl border border-border bg-white p-5"><h2 className="font-bold">Order summary</h2>{payload.lines.map(line => <div key={line.variantId} className="flex justify-between gap-3 text-sm"><span>{line.productName} · {line.variantLabel} × {line.quantity}</span><b>₹{(line.price * line.quantity).toLocaleString('en-IN')}</b></div>)}<div className="border-t pt-3 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>₹{subtotal.toLocaleString('en-IN')}</span></div>{quote && <><div className="mt-2 flex justify-between"><span>Distance</span><span>{Number(quote.distance_km).toFixed(1)} km</span></div><div className="mt-2 flex justify-between"><span>Delivery</span><b className={Number(quote.delivery_charge) === 0 ? 'text-emerald-600' : ''}>{Number(quote.delivery_charge) === 0 ? 'FREE DELIVERY' : `₹${Number(quote.delivery_charge).toLocaleString('en-IN')}`}</b></div><div className="mt-2 flex justify-between"><span>Estimated time</span><span>{quote.estimated_delivery_minutes} minutes</span></div><div className="mt-3 flex justify-between text-lg font-bold"><span>Total</span><span>₹{(subtotal + Number(quote.delivery_charge)).toLocaleString('en-IN')}</span></div></>}</div><button disabled={!quote || loading} onClick={placeOrder} className="w-full rounded-xl bg-[#8B1538] py-3 text-sm font-bold text-white disabled:opacity-50"><CheckCircle2 className="mr-1 inline h-4 w-4" />Place water order</button></div></div></div></div>;
}
