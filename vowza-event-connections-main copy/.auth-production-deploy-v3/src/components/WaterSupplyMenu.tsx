import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Droplets, Check, ChevronDown, ChevronUp, X, ChevronLeft, ChevronRight, Loader2, MapPin, Clock, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { NotificationService } from '@/services/notificationService';
import { toast } from 'sonner';
import LocationPicker, { type LocationData, validateLocationData, emptyLocationData } from '@/components/booking/LocationPicker';
import ScopedCartBar from '@/components/ScopedCartBar';

const inputClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition placeholder:text-stone-400 focus:border-[#0284c7] focus:ring-2 focus:ring-[#0284c7]/15';

export default function WaterSupplyMenu({ provider, profile }: { provider: any; profile: any }) {
  const { user } = useAuth();
  const { addToCart, isInCart } = useCart();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [bookingPkg, setBookingPkg] = useState<any>(null);
  const [bookingAddons, setBookingAddons] = useState<any[]>([]);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['public-water-packages', provider.id],
    queryFn: async () => {
      const r = await supabase.from('water_packages' as any).select('*, water_gallery(*), water_addons(*)').eq('provider_id', provider.id).eq('status', 'active').order('created_at');
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });

  useEffect(() => {
    const channel = supabase.channel(`public-water-${provider.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'water_packages', filter: `provider_id=eq.${provider.id}` }, () => qc.invalidateQueries({ queryKey: ['public-water-packages', provider.id] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [provider.id]);

  const toggle = (id: string) => setExpanded(s => ({ ...s, [id]: !s[id] }));
  const handleBook = (pkg: any) => {
    if (!user) { toast.error('Please log in to book'); return nav('/auth'); }
    setBookingAddons(pkg.water_addons ?? []);
    setBookingPkg(pkg);
  };

  if (isLoading) return <div className="h-48 animate-pulse rounded-2xl bg-muted" />;
  if (!packages.length) return <div className="rounded-2xl border border-border/60 bg-surface-1 p-10 text-center text-sm text-muted-foreground">This water supplier has not published any packages yet.</div>;

  return (
    <div className="space-y-5">
      <div><h2 className="text-xl font-bold">Water Supply Packages</h2><p className="text-sm text-muted-foreground">Browse water supply options and book for your event.</p></div>
      <div className="grid gap-5 md:grid-cols-2">
        {packages.map((pkg: any) => {
          const isOpen = expanded[pkg.id];
          const gallery = pkg.water_gallery ?? [];
          const cover = gallery.find((g: any) => g.is_cover);
          const addons = pkg.water_addons ?? [];
          const price = pkg.base_price || 0;
          const pricingLabel = pkg.pricing_type?.replace('per_', '/ ').replace('custom_quote', 'quote') || '';

          return (
            <div key={pkg.id} className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm transition hover:shadow-md">
              <div className="relative h-44 sm:h-52 bg-gradient-to-br from-sky-50 to-cyan-50 overflow-hidden">
                {cover ? <img src={cover.public_url} alt={pkg.name} className="w-full h-full object-cover" loading="lazy" /> : <div className="flex h-full items-center justify-center"><Droplets className="h-12 w-12 text-sky-400/40" /></div>}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-foreground leading-tight">{pkg.name}</h3>
                  <div className="text-right shrink-0"><p className="text-lg font-bold text-sky-700">₹{Number(price).toLocaleString('en-IN')}</p><p className="text-xs text-muted-foreground">{pricingLabel}</p></div>
                </div>
                {pkg.description && <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{pkg.description}</p>}

                {/* Badges */}
                <div className="mt-2 flex flex-wrap gap-2">
                  {pkg.package_type && <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 border border-sky-200 px-2.5 py-0.5 text-[11px] font-medium text-sky-800"><Droplets className="h-3 w-3" />{pkg.package_type}</span>}
                  {pkg.delivery_time && <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 border border-cyan-200 px-2.5 py-0.5 text-[11px] text-cyan-700"><Clock className="h-3 w-3" />{pkg.delivery_time}</span>}
                </div>

                {/* Features */}
                {(pkg.supply_features ?? []).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {pkg.supply_features.slice(0, 4).map((s: string) => <span key={s} className="inline-flex items-center rounded-full bg-sky-50 border border-sky-100 px-2 py-0.5 text-[11px] text-sky-700">{s}</span>)}
                    {pkg.supply_features.length > 4 && <span className="text-[11px] text-muted-foreground">+{pkg.supply_features.length - 4} more</span>}
                  </div>
                )}

                {/* Cities */}
                {(pkg.available_cities ?? []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {pkg.available_cities.slice(0, 3).map((c: string) => <span key={c} className="inline-flex items-center gap-0.5 rounded-full bg-stone-50 border border-stone-200 px-2 py-0.5 text-[11px] text-stone-600"><MapPin className="h-2.5 w-2.5" />{c}</span>)}
                    {pkg.available_cities.length > 3 && <span className="text-[11px] text-muted-foreground">+{pkg.available_cities.length - 3}</span>}
                  </div>
                )}

                {/* Expanded details */}
                {isOpen && (
                  <div className="mt-3 space-y-3">
                    {(pkg.supply_features ?? []).length > 0 && (
                      <div className="rounded-xl bg-sky-50/60 border border-sky-100 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-sky-700 mb-1">All Features</p>
                        <div className="flex flex-wrap gap-1">{pkg.supply_features.map((s: string) => <span key={s} className="rounded-full border border-sky-200 px-2 py-0.5 text-xs text-sky-800">{s}</span>)}</div>
                      </div>
                    )}
                    {Object.keys(pkg.supply_details ?? {}).length > 0 && (
                      <div className="rounded-xl bg-secondary/50 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-sky-800 mb-1">Supply Details</p>
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          {Object.entries(pkg.supply_details).filter(([,v]) => v !== '' && v !== false && v !== null).map(([k, v]) => (
                            <div key={k} className="flex justify-between"><span className="text-stone-500 capitalize">{k.replace(/_/g, ' ')}</span><span className="font-medium text-stone-700">{v === true ? '✓' : String(v)}</span></div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="rounded-xl bg-cyan-50/60 border border-cyan-100 p-3 text-xs space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-cyan-700 mb-1">Delivery Info</p>
                      {pkg.delivery_time && <p>🚚 Delivery: {pkg.delivery_time}</p>}
                      {pkg.vehicle_type && <p>🚛 Vehicle: {pkg.vehicle_type}</p>}
                      {pkg.delivery_radius && <p>📍 Radius: {pkg.delivery_radius}</p>}
                      <p>💧 Dispenser: {pkg.water_dispenser_available ? '✅' : '❌'} | Cooling: {pkg.cooling_unit_available ? '✅' : '❌'}</p>
                    </div>
                    {addons.length > 0 && (
                      <div className="rounded-xl bg-amber-50/60 border border-amber-100 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 mb-1">Available Add-ons</p>
                        {addons.map((a: any) => <div key={a.id} className="flex justify-between text-xs mt-1"><span className="text-stone-700">{a.name}</span><span className="font-semibold text-amber-800">+₹{Number(a.price).toLocaleString('en-IN')}</span></div>)}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button onClick={() => toggle(pkg.id)} className="rounded-xl border py-2 text-xs font-semibold flex items-center justify-center gap-1 transition hover:bg-secondary/50">
                    {isOpen ? <><ChevronUp className="h-3 w-3" />Hide Details</> : <><ChevronDown className="h-3 w-3" />View Details</>}
                  </button>
                  <button onClick={() => handleBook(pkg)} className="rounded-xl bg-sky-700 py-2 text-xs font-semibold text-white transition hover:bg-sky-800">Book Now</button>
                </div>
                <button
                  onClick={() => { if (!user) { toast.error('Please log in'); return nav('/auth'); } addToCart({ packageId: pkg.id, providerId: provider.id, providerName: profile?.full_name || 'Artist', category: 'water', packageTable: 'water_packages', bookingTable: 'water_bookings', packageName: pkg.name, price: Number(pkg.package_price || pkg.price || 0), duration: undefined, imageUrl: (pkg.water_gallery ?? []).find((g: any) => g.is_cover)?.public_url || undefined }); }}
                  disabled={isInCart(pkg.id, 'water')}
                  className="mt-2 w-full rounded-xl border border-sky-200 bg-sky-50 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <ShoppingCart className="h-3 w-3" />{isInCart(pkg.id, 'water') ? 'In Cart' : 'Add to Cart'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <ScopedCartBar providerId={provider.id} category="water" />
      {bookingPkg && <WaterBookingModal isOpen={!!bookingPkg} onClose={() => setBookingPkg(null)} pkg={bookingPkg} provider={provider} addons={bookingAddons} />}
    </div>
  );
}


/* ─── Water Booking Modal ──────────────────────────────────────────────────── */
function WaterBookingModal({ isOpen, onClose, pkg, provider, addons }: { isOpen: boolean; onClose: () => void; pkg: any; provider: any; addons: any[] }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const [eventDate, setEventDate] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [eventType, setEventType] = useState('');
  const [location, setLocation] = useState<LocationData>(emptyLocationData);
  const [quantityRequired, setQuantityRequired] = useState('');
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => { if (isOpen) { setStep(1); setEventDate(''); setDeliveryTime(''); setEventType(''); setLocation(emptyLocationData); setQuantityRequired(''); setSelectedAddonIds([]); setSpecialInstructions(''); setTermsAccepted(false); } }, [isOpen]);
  useEffect(() => { if (isOpen) document.body.style.overflow='hidden'; else document.body.style.overflow=''; return () => { document.body.style.overflow=''; }; }, [isOpen]);

  const baseAmount = Number(pkg.base_price || 0);
  const addonsAmount = addons.filter(a => selectedAddonIds.includes(a.id)).reduce((s, a) => s + Number(a.price || 0), 0);
  const total = baseAmount + addonsAmount;
  const advancePercent = Number(pkg.advance_percentage || 20);
  const advanceAmount = Math.round(total * advancePercent / 100);
  const remaining = total - advanceAmount;
  const toggleAddon = (id: string) => setSelectedAddonIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSubmit = async () => {
    if (!user) { toast.error('Please log in'); nav('/auth'); return; }
    if (!termsAccepted) { toast.error('Please accept terms'); return; }
    if (!eventDate) { toast.error('Delivery date is required'); setStep(2); return; }
    const locErr = validateLocationData(location);
    if (locErr) { toast.error(locErr); setStep(2); return; }
    setBusy(true);
    try {
      const { data: booking, error } = await supabase.from('water_bookings' as any).insert({
        package_id: pkg.id, provider_id: provider.id, customer_id: user.id,
        event_date: eventDate, delivery_time: deliveryTime || null,
        event_type: eventType || pkg.package_type || null,
        delivery_address: [location.venue_name, location.locality, location.address_line].filter(Boolean).join(', ') || null, city: location.town_city || null,
        quantity_required: quantityRequired || null,
        selected_addon_ids: selectedAddonIds,
        special_instructions: specialInstructions || null,
        base_amount: baseAmount, addons_amount: addonsAmount,
        total_amount: total, advance_amount: advanceAmount, remaining_amount: remaining,
        status: 'pending',
      }).select('id').single();
      if (error) throw error;

      // Save structured location
      await supabase.from('booking_locations' as any).insert({
        booking_table: 'water_bookings', booking_id: booking.id,
        state: location.state, district: location.district, town_city: location.town_city,
        exact_address: [location.venue_name, location.locality, location.address_line].filter(Boolean).join(', '),
        pincode: location.pincode, landmark: location.address_line || null,
        latitude: location.latitude, longitude: location.longitude,
      });

      await NotificationService.notifyBookingReceived(user.id, provider.id, booking.id);
      sessionStorage.setItem('vowza_booking_success', JSON.stringify({
        bookingId: booking.id, artistName: provider.business_name || provider.contact_person || 'Water Supplier',
        eventDate, eventTime: deliveryTime, venue: location.venue_name || location.locality || 'TBD', city: location.town_city || '',
        amount: total, advanceAmount, remainingBalance: remaining,
        eventType: eventType || pkg.package_type || 'Water Supply', status: 'pending',
      }));
      toast.success('Water supply booking request sent!'); onClose(); nav('/booking-success');
    } catch (err: any) { toast.error(err.message || 'Could not create booking'); }
    finally { setBusy(false); }
  };

  if (!isOpen) return null;
  const STEPS = ['Package', 'Delivery Details', 'Quantity', 'Add-ons', 'Instructions', 'Confirm'];

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#0c4a6e]/65 p-3 backdrop-blur-sm sm:p-6">
      <div className="mx-auto my-3 max-w-2xl overflow-hidden rounded-[24px] bg-[#fefffe] shadow-2xl">
        <header className="flex items-start justify-between gap-4 bg-sky-800 px-5 py-5 sm:px-7">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-200">Vowza Water Supply</p><h2 className="mt-1 text-lg font-bold text-white">Book: {pkg.name}</h2></div>
          <button onClick={onClose} className="rounded-full p-2 text-white/85 hover:bg-white/15"><X className="h-5 w-5" /></button>
        </header>
        <div className="border-b border-[#eadfcf] bg-[#f0f9ff] px-5 py-3 sm:px-7">
          <div className="flex items-center justify-between overflow-x-auto">
            {STEPS.map((label, i) => (<div key={i} className="flex items-center">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${step>i+1?'bg-sky-500 text-white':step===i+1?'bg-sky-700 text-white':'border-2 border-[#e7d9c4] text-stone-400'}`}>{step>i+1?<Check className="h-3.5 w-3.5" />:i+1}</div>
              {i<5&&<div className={`mx-0.5 h-0.5 w-3 sm:w-4 rounded ${step>i+1?'bg-sky-400':'bg-[#e7d9c4]'}`}/>}
            </div>))}
          </div>
        </div>

        <div className="p-5 sm:p-7 max-h-[60vh] overflow-y-auto">
          {/* Step 1: Package Preview */}
          {step === 1 && (
            <div className="rounded-2xl border border-[#eadfcf] bg-white p-5">
              <h3 className="font-bold text-[#0c4a6e] mb-2">{pkg.name}</h3>
              {pkg.description && <p className="text-sm text-muted-foreground mb-3">{pkg.description}</p>}
              <p className="text-xl font-bold text-sky-700">₹{baseAmount.toLocaleString('en-IN')} <span className="text-xs font-normal text-stone-500">/{pkg.pricing_type?.replace('per_','').replace('custom_quote','quote')}</span></p>
              {pkg.package_type && <p className="mt-1 text-xs text-muted-foreground"><Droplets className="inline h-3 w-3 mr-1" />{pkg.package_type}</p>}
              {(pkg.supply_features??[]).length>0 && (<div className="mt-3"><p className="text-xs font-semibold text-stone-600 mb-1">Features:</p><div className="flex flex-wrap gap-1">{pkg.supply_features.map((s: string) => <span key={s} className="rounded-full bg-sky-700/8 px-2 py-0.5 text-[11px] text-sky-700">{s}</span>)}</div></div>)}
            </div>
          )}

          {/* Step 2: Delivery Details */}
          {step === 2 && (
            <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-4">
              <h3 className="font-bold text-[#0c4a6e]">Delivery Details</h3>
              <label className="block"><span className="text-sm font-semibold text-[#0c4a6e]">Delivery Date <span className="text-red-500">*</span></span>
                <input type="date" className={inputClass} value={eventDate} onChange={e => setEventDate(e.target.value)} min={new Date().toISOString().split('T')[0]} /></label>
              <label className="block"><span className="text-sm font-semibold text-[#0c4a6e]">Delivery Time</span>
                <select className={inputClass} value={deliveryTime} onChange={e => setDeliveryTime(e.target.value)}>
                  <option value="">Select time slot</option>
                  {['6 AM - 9 AM','9 AM - 12 PM','12 PM - 3 PM','3 PM - 6 PM','6 PM - 9 PM','Emergency (ASAP)'].map(v => <option key={v} value={v}>{v}</option>)}
                </select></label>
              <label className="block"><span className="text-sm font-semibold text-[#0c4a6e]">Event Type</span>
                <select className={inputClass} value={eventType} onChange={e => setEventType(e.target.value)}>
                  <option value="">Select type</option>
                  {['Wedding','Reception','Corporate Event','Construction','Industrial','Residential','Festival','Other'].map(v => <option key={v} value={v}>{v}</option>)}
                </select></label>
              <LocationPicker value={location} onChange={setLocation} compact />
            </div>
          )}

          {/* Step 3: Quantity */}
          {step === 3 && (
            <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-4">
              <h3 className="font-bold text-[#0c4a6e]">Quantity Required</h3>
              <p className="text-xs text-stone-500">Specify the quantity you need (e.g. 20 cans, 5000 litres, 2 tankers)</p>
              <label className="block"><span className="text-sm font-semibold text-[#0c4a6e]">Quantity</span>
                <input className={inputClass} value={quantityRequired} onChange={e => setQuantityRequired(e.target.value)} placeholder="e.g. 20 cans, 1 tanker (10000L)" /></label>
            </div>
          )}

          {/* Step 4: Add-ons */}
          {step === 4 && (
            <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-4">
              <h3 className="font-bold text-[#0c4a6e]">Add-ons</h3>
              {addons.length > 0 ? (<div className="space-y-2">{addons.map((addon: any) => (
                <label key={addon.id} className={`flex items-center justify-between rounded-xl border p-3.5 cursor-pointer transition ${selectedAddonIds.includes(addon.id)?'border-sky-600 bg-sky-50':'border-[#e7d9c4] hover:border-sky-400'}`}>
                  <div className="flex items-center gap-3"><input type="checkbox" checked={selectedAddonIds.includes(addon.id)} onChange={() => toggleAddon(addon.id)} className="h-4 w-4 rounded border-[#e7d9c4] text-sky-700" />
                    <div><p className="text-sm font-semibold text-[#0c4a6e]">{addon.name}</p>{addon.description&&<p className="text-xs text-stone-500">{addon.description}</p>}</div></div>
                  <span className="text-sm font-bold text-sky-700">+₹{Number(addon.price).toLocaleString('en-IN')}</span>
                </label>
              ))}</div>) : (<p className="text-sm text-stone-400 text-center py-4">No add-ons available.</p>)}
              {selectedAddonIds.length>0 && (<div className="rounded-xl border border-[#eadfcf] bg-[#f0f9ff] p-3"><p className="text-xs font-semibold text-stone-600">Add-ons total: <span className="text-sky-700">₹{addonsAmount.toLocaleString('en-IN')}</span></p></div>)}
            </div>
          )}

          {/* Step 5: Instructions */}
          {step === 5 && (
            <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-4">
              <h3 className="font-bold text-[#0c4a6e]">Special Instructions</h3>
              <label className="block"><span className="text-sm font-semibold text-[#0c4a6e]">Instructions</span>
                <textarea className={`${inputClass} min-h-[100px] resize-y`} value={specialInstructions} onChange={e => setSpecialInstructions(e.target.value)} placeholder="Any specific requirements: parking access, floor level, timing constraints, recurring delivery needs..." /></label>
            </div>
          )}

          {/* Step 6: Confirm */}
          {step === 6 && (
            <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-3">
              <h3 className="font-bold text-[#0c4a6e]">Confirm Booking</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-stone-600">Package</span><span className="font-semibold">{pkg.name}</span></div>
                {pkg.package_type && <div className="flex justify-between"><span className="text-stone-600">Type</span><span className="font-medium">{pkg.package_type}</span></div>}
                {eventDate && <div className="flex justify-between"><span className="text-stone-600">Date</span><span className="font-medium">{new Date(eventDate).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</span></div>}
                {deliveryTime && <div className="flex justify-between"><span className="text-stone-600">Time</span><span className="font-medium">{deliveryTime}</span></div>}
                {quantityRequired && <div className="flex justify-between"><span className="text-stone-600">Quantity</span><span className="font-medium">{quantityRequired}</span></div>}
                {(location.venue_name || location.locality) && <div className="flex justify-between"><span className="text-stone-600">Address</span><span className="font-medium text-right max-w-[180px] truncate">{location.venue_name || location.locality}</span></div>}
              </div>
              <div className="border-t border-[#eadfcf] pt-3 space-y-1.5">
                <div className="flex justify-between text-sm"><span className="text-stone-600">Base Price</span><span>₹{baseAmount.toLocaleString('en-IN')}</span></div>
                {addonsAmount>0 && <div className="flex justify-between text-sm"><span className="text-stone-600">Add-ons</span><span>₹{addonsAmount.toLocaleString('en-IN')}</span></div>}
                <div className="flex justify-between text-base font-bold border-t border-stone-100 pt-2"><span className="text-[#0c4a6e]">Total</span><span className="text-sky-700">₹{total.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between text-xs text-stone-500"><span>Advance ({advancePercent}%)</span><span>₹{advanceAmount.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between text-xs text-stone-500"><span>Remaining</span><span>₹{remaining.toLocaleString('en-IN')}</span></div>
              </div>
              <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4"><p className="text-sm font-semibold text-sky-700 flex items-center gap-2"><Check className="h-4 w-4" />Ready to submit</p><p className="mt-1 text-xs text-sky-600">The water supplier will review and confirm your request.</p></div>
              <label className="flex items-start gap-3 cursor-pointer mt-4 rounded-xl border border-[#eadfcf] p-3"><input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-[#e7d9c4] text-sky-700" />
                <span className="text-xs text-stone-600">I agree to the booking terms. Advance payment will be required after confirmation.</span></label>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[#eadfcf] bg-[#f0f9ff]/95 px-5 py-4 backdrop-blur sm:px-7">
          <button type="button" onClick={() => step>1?setStep(step-1):onClose()} className="flex items-center gap-1.5 rounded-xl border border-[#d7c5ae] px-4 py-2.5 text-sm font-semibold text-[#0c4a6e] hover:bg-white"><ChevronLeft className="h-4 w-4" />{step===1?'Cancel':'Back'}</button>
          {step < 6 ? (<button type="button" onClick={() => setStep(step+1)} className="flex items-center gap-1.5 rounded-xl bg-sky-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-sky-800">Next<ChevronRight className="h-4 w-4" /></button>
          ) : (<button type="button" disabled={busy||!termsAccepted} onClick={handleSubmit} className="rounded-xl bg-sky-700 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-sky-800 disabled:opacity-60">{busy?<><Loader2 className="mr-1.5 inline h-4 w-4 animate-spin" />Submitting…</>:'Confirm Booking'}</button>)}
        </div>
      </div>
    </div>
  );
}
