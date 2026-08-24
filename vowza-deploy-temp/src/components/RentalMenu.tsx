import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Truck, Check, ChevronDown, ChevronUp, X, ChevronLeft, ChevronRight, Loader2, MapPin, Package, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { NotificationService } from '@/services/notificationService';
import { toast } from 'sonner';
import LocationPicker, { type LocationData, validateLocationData, emptyLocationData } from '@/components/booking/LocationPicker';
import ScopedCartBar from '@/components/ScopedCartBar';

const inputClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition placeholder:text-stone-400 focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/15';

export default function RentalMenu({ provider, profile }: { provider: any; profile: any }) {
  const { user } = useAuth();
  const { addToCart, isInCart } = useCart();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [bookingPkg, setBookingPkg] = useState<any>(null);
  const [bookingAddons, setBookingAddons] = useState<any[]>([]);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['public-rental-packages', provider.id],
    queryFn: async () => {
      const r = await supabase.from('rental_packages' as any).select('*, rental_gallery(*), rental_addons(*)').eq('provider_id', provider.id).eq('status', 'active').order('created_at');
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });

  useEffect(() => {
    const channel = supabase.channel(`public-rental-${provider.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rental_packages', filter: `provider_id=eq.${provider.id}` }, () => qc.invalidateQueries({ queryKey: ['public-rental-packages', provider.id] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [provider.id]);

  const toggle = (id: string) => setExpanded(s => ({ ...s, [id]: !s[id] }));

  const handleBook = (pkg: any) => {
    if (!user) { toast.error('Please log in to book'); return nav('/auth'); }
    if (pkg.available_units <= 0) { toast.error('This item is currently out of stock'); return; }
    setBookingAddons(pkg.rental_addons ?? []);
    setBookingPkg(pkg);
  };

  if (isLoading) return <div className="h-48 animate-pulse rounded-2xl bg-muted" />;
  if (!packages.length) return <div className="rounded-2xl border border-border/60 bg-surface-1 p-10 text-center text-sm text-muted-foreground">This rental service has not published any packages yet.</div>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">Rental Packages</h2>
        <p className="text-sm text-muted-foreground">Browse rental equipment and book for your event.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {packages.map((pkg: any) => {
          const isOpen = expanded[pkg.id];
          const gallery = pkg.rental_gallery ?? [];
          const cover = gallery.find((g: any) => g.is_cover);
          const addons = pkg.rental_addons ?? [];
          const price = pkg.price || 0;
          const rentalLabel = pkg.rental_type?.replace('per_', '/ ').replace('package_price', 'package') || '';

          return (
            <div key={pkg.id} className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm transition hover:shadow-md">
              <div className="relative h-44 sm:h-52 bg-gradient-to-br from-teal-50 to-amber-50 overflow-hidden">
                {cover ? (
                  <img src={cover.public_url} alt={pkg.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full items-center justify-center"><Truck className="h-12 w-12 text-teal-400/40" /></div>
                )}
                {pkg.available_units <= 0 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="rounded-full bg-red-600 px-4 py-1.5 text-sm font-bold text-white">Out of Stock</span>
                  </div>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-foreground leading-tight">{pkg.name}</h3>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-teal-700">₹{Number(price).toLocaleString('en-IN')}</p>
                    <p className="text-xs text-muted-foreground">{rentalLabel}</p>
                  </div>
                </div>
                {pkg.description && <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{pkg.description}</p>}

                {/* Package type & inventory badges */}
                <div className="mt-2 flex flex-wrap gap-2">
                  {pkg.package_type && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 border border-teal-200 px-2.5 py-0.5 text-[11px] font-medium text-teal-800">
                      <Truck className="h-3 w-3" />{pkg.package_type}
                    </span>
                  )}
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                    pkg.available_units > 0 ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'
                  }`}>
                    <Package className="h-3 w-3" />{pkg.available_units}/{pkg.inventory_quantity} available
                  </span>
                </div>

                {/* Included items */}
                {(pkg.included_items ?? []).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {pkg.included_items.slice(0, 5).map((s: string) => (
                      <span key={s} className="inline-flex items-center rounded-full bg-teal-50 border border-teal-100 px-2 py-0.5 text-[11px] text-teal-700">{s}</span>
                    ))}
                    {pkg.included_items.length > 5 && <span className="text-[11px] text-muted-foreground">+{pkg.included_items.length - 5} more</span>}
                  </div>
                )}

                {/* Available cities */}
                {(pkg.available_cities ?? []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {pkg.available_cities.slice(0, 3).map((c: string) => (
                      <span key={c} className="inline-flex items-center gap-0.5 rounded-full bg-stone-50 border border-stone-200 px-2 py-0.5 text-[11px] text-stone-600">
                        <MapPin className="h-2.5 w-2.5" />{c}
                      </span>
                    ))}
                    {pkg.available_cities.length > 3 && <span className="text-[11px] text-muted-foreground">+{pkg.available_cities.length - 3} more</span>}
                  </div>
                )}

                {/* Expanded details */}
                {isOpen && (
                  <div className="mt-3 space-y-3">
                    {(pkg.included_items ?? []).length > 0 && (
                      <div className="rounded-xl bg-teal-50/60 border border-teal-100 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-teal-700 mb-1">All Included Items</p>
                        <div className="flex flex-wrap gap-1">
                          {pkg.included_items.map((s: string) => <span key={s} className="rounded-full border border-teal-200 px-2 py-0.5 text-xs text-teal-800">{s}</span>)}
                        </div>
                      </div>
                    )}
                    {/* Rental details */}
                    {Object.keys(pkg.rental_details ?? {}).length > 0 && (
                      <div className="rounded-xl bg-secondary/50 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-teal-800 mb-1">Equipment Details</p>
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          {Object.entries(pkg.rental_details).filter(([,v]) => v !== '' && v !== false && v !== null).map(([k, v]) => (
                            <div key={k} className="flex justify-between"><span className="text-stone-500 capitalize">{k.replace(/_/g, ' ')}</span><span className="font-medium text-stone-700">{v === true ? '✓' : String(v)}</span></div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Delivery info */}
                    <div className="rounded-xl bg-amber-50/60 border border-amber-100 p-3 text-xs space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 mb-1">Delivery & Setup</p>
                      {pkg.setup_time && <p>🔧 Setup: {pkg.setup_time}</p>}
                      {pkg.delivery_time && <p>🚚 Delivery: {pkg.delivery_time}</p>}
                      {pkg.pickup_time && <p>📦 Pickup: {pkg.pickup_time}</p>}
                      {pkg.delivery_radius && <p>📍 Radius: {pkg.delivery_radius}</p>}
                    </div>
                    {/* Add-ons */}
                    {addons.length > 0 && (
                      <div className="rounded-xl bg-amber-50/60 border border-amber-100 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 mb-1">Available Add-ons</p>
                        {addons.map((a: any) => (
                          <div key={a.id} className="flex justify-between text-xs mt-1">
                            <span className="text-stone-700">{a.name}</span>
                            <span className="font-semibold text-amber-800">+₹{Number(a.price).toLocaleString('en-IN')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button onClick={() => toggle(pkg.id)} className="rounded-xl border py-2 text-xs font-semibold flex items-center justify-center gap-1 transition hover:bg-secondary/50">
                    {isOpen ? <><ChevronUp className="h-3 w-3" />Hide Details</> : <><ChevronDown className="h-3 w-3" />View Details</>}
                  </button>
                  <button onClick={() => handleBook(pkg)} disabled={pkg.available_units <= 0}
                    className="rounded-xl bg-teal-700 py-2 text-xs font-semibold text-white transition hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed">
                    {pkg.available_units <= 0 ? 'Out of Stock' : 'Book Now'}
                  </button>
                </div>
                <button
                  onClick={() => { if (!user) { toast.error('Please log in'); return nav('/auth'); } if (pkg.available_units <= 0) { toast.error('Out of stock'); return; } addToCart({ packageId: pkg.id, providerId: provider.id, providerName: profile?.full_name || 'Artist', category: 'rental', packageTable: 'rental_packages', bookingTable: 'rental_bookings', packageName: pkg.name, price: Number(pkg.rental_price || pkg.price || 0), duration: pkg.rental_period || undefined, imageUrl: (pkg.rental_gallery ?? []).find((g: any) => g.is_cover)?.public_url || undefined }); }}
                  disabled={isInCart(pkg.id, 'rental') || pkg.available_units <= 0}
                  className="mt-2 w-full rounded-xl border border-teal-200 bg-teal-50 py-2 text-xs font-semibold text-teal-700 transition hover:bg-teal-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <ShoppingCart className="h-3 w-3" />{isInCart(pkg.id, 'rental') ? 'In Cart' : 'Add to Cart'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <ScopedCartBar providerId={provider.id} category="rental" />
      {bookingPkg && (
        <RentalBookingModal isOpen={!!bookingPkg} onClose={() => setBookingPkg(null)} pkg={bookingPkg} provider={provider} addons={bookingAddons} />
      )}
    </div>
  );
}


/* ─── Rental Booking Modal ─────────────────────────────────────────────────── */
function RentalBookingModal({ isOpen, onClose, pkg, provider, addons }: { isOpen: boolean; onClose: () => void; pkg: any; provider: any; addons: any[] }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventType, setEventType] = useState('');
  const [rentalDuration, setRentalDuration] = useState('');
  const [location, setLocation] = useState<LocationData>(emptyLocationData);
  const [quantityRequired, setQuantityRequired] = useState('1');
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(1); setEventDate(''); setEventTime(''); setEventType('');
      setRentalDuration(''); setLocation(emptyLocationData);
      setQuantityRequired('1'); setSelectedAddonIds([]);
      setSpecialInstructions(''); setTermsAccepted(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const qty = Math.max(1, Number(quantityRequired) || 1);
  const baseAmount = Number(pkg.price || 0) * qty;
  const addonsAmount = addons.filter(a => selectedAddonIds.includes(a.id)).reduce((s, a) => s + Number(a.price || 0), 0);
  const total = baseAmount + addonsAmount;
  const advancePercent = Number(pkg.advance_percentage || 20);
  const advanceAmount = Math.round(total * advancePercent / 100);
  const remaining = total - advanceAmount;

  const toggleAddon = (id: string) => setSelectedAddonIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSubmit = async () => {
    if (!user) { toast.error('Please log in'); nav('/auth'); return; }
    if (!termsAccepted) { toast.error('Please accept terms'); return; }
    if (!eventDate) { toast.error('Event date is required'); setStep(2); return; }
    if (qty > pkg.available_units) { toast.error(`Only ${pkg.available_units} units available`); setStep(3); return; }
    const locErr = validateLocationData(location);
    if (locErr) { toast.error(locErr); setStep(2); return; }
    setBusy(true);
    try {
      const { data: booking, error } = await supabase.from('rental_bookings' as any).insert({
        package_id: pkg.id,
        provider_id: provider.id,
        customer_id: user.id,
        event_date: eventDate,
        event_time: eventTime || null,
        event_type: eventType || null,
        rental_duration: rentalDuration || null,
        delivery_address: [location.venue_name, location.locality, location.address_line].filter(Boolean).join(', ') || null,
        city: location.town_city || null,
        quantity_required: qty,
        selected_addon_ids: selectedAddonIds,
        special_instructions: specialInstructions || null,
        base_amount: baseAmount,
        addons_amount: addonsAmount,
        total_amount: total,
        advance_amount: advanceAmount,
        remaining_amount: remaining,
        status: 'pending',
      }).select('id').single();
      if (error) throw error;

      // Save structured location
      await supabase.from('booking_locations' as any).insert({
        booking_table: 'rental_bookings', booking_id: booking.id,
        state: location.state, district: location.district, town_city: location.town_city,
        exact_address: [location.venue_name, location.locality, location.address_line].filter(Boolean).join(', '),
        pincode: location.pincode, landmark: location.address_line || null,
        latitude: location.latitude, longitude: location.longitude,
      });

      await NotificationService.notifyBookingReceived(user.id, provider.id, booking.id);

      sessionStorage.setItem('vowza_booking_success', JSON.stringify({
        bookingId: booking.id,
        artistName: provider.business_name || provider.contact_person || 'Rental Service',
        eventDate, eventTime,
        venue: location.venue_name || location.locality || 'TBD',
        city: location.town_city || '',
        amount: total, advanceAmount, remainingBalance: remaining,
        eventType: eventType || pkg.package_type || 'Rental',
        status: 'pending',
      }));

      toast.success('Rental booking request sent!');
      onClose();
      nav('/booking-success');
    } catch (err: any) {
      toast.error(err.message || 'Could not create booking');
    } finally { setBusy(false); }
  };

  if (!isOpen) return null;

  const STEPS = ['Package', 'Event Details', 'Quantity', 'Add-ons', 'Instructions', 'Confirm'];

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#0f3b3b]/65 p-3 backdrop-blur-sm sm:p-6">
      <div className="mx-auto my-3 max-w-2xl overflow-hidden rounded-[24px] bg-[#fefffd] shadow-2xl">
        <header className="flex items-start justify-between gap-4 bg-teal-800 px-5 py-5 sm:px-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-200">Vowza Rentals</p>
            <h2 className="mt-1 text-lg font-bold text-white">Book: {pkg.name}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-white/85 hover:bg-white/15"><X className="h-5 w-5" /></button>
        </header>

        <div className="border-b border-[#eadfcf] bg-[#f7fdfc] px-5 py-3 sm:px-7">
          <div className="flex items-center justify-between overflow-x-auto">
            {STEPS.map((label, i) => (
              <div key={i} className="flex items-center">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${step > i+1 ? 'bg-teal-500 text-white' : step === i+1 ? 'bg-teal-700 text-white' : 'border-2 border-[#e7d9c4] text-stone-400'}`}>
                  {step > i+1 ? <Check className="h-3.5 w-3.5" /> : i+1}
                </div>
                {i < 5 && <div className={`mx-0.5 h-0.5 w-3 sm:w-4 rounded ${step > i+1 ? 'bg-teal-400' : 'bg-[#e7d9c4]'}`} />}
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 sm:p-7 max-h-[60vh] overflow-y-auto">

          {/* Step 1: Package Preview */}
          {step === 1 && (
            <div className="rounded-2xl border border-[#eadfcf] bg-white p-5">
              <h3 className="font-bold text-[#134e4a] mb-2">{pkg.name}</h3>
              {pkg.description && <p className="text-sm text-muted-foreground mb-3">{pkg.description}</p>}
              <p className="text-xl font-bold text-teal-700">₹{Number(pkg.price || 0).toLocaleString('en-IN')} <span className="text-xs font-normal text-stone-500">/{pkg.rental_type?.replace('per_','').replace('package_price','pkg')}</span></p>
              {pkg.package_type && <p className="mt-1 text-xs text-muted-foreground"><Truck className="inline h-3 w-3 mr-1" />{pkg.package_type}</p>}
              <p className="mt-1 text-xs text-muted-foreground"><Package className="inline h-3 w-3 mr-1" />{pkg.available_units} units available</p>
              {(pkg.included_items ?? []).length > 0 && (
                <div className="mt-3"><p className="text-xs font-semibold text-stone-600 mb-1">Included:</p>
                  <div className="flex flex-wrap gap-1">{pkg.included_items.map((s: string) => <span key={s} className="rounded-full bg-teal-700/8 px-2 py-0.5 text-[11px] text-teal-700">{s}</span>)}</div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Event Details */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-4">
                <h3 className="font-bold text-[#134e4a]">Event & Delivery Details</h3>
                <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Event Date <span className="text-red-500">*</span></span>
                  <input type="date" className={inputClass} value={eventDate} onChange={e => setEventDate(e.target.value)} min={new Date().toISOString().split('T')[0]} /></label>
                <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Event Time</span>
                  <input type="time" className={inputClass} value={eventTime} onChange={e => setEventTime(e.target.value)} /></label>
                <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Event Type</span>
                  <select className={inputClass} value={eventType} onChange={e => setEventType(e.target.value)}>
                    <option value="">Select event type</option>
                    {['Wedding','Reception','Engagement','Birthday','Corporate Event','Festival','Religious Event','Private Party','Other'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select></label>
                <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Rental Duration</span>
                  <select className={inputClass} value={rentalDuration} onChange={e => setRentalDuration(e.target.value)}>
                    <option value="">Select duration</option>
                    {['Few Hours','Half Day','Full Day','2 Days','3 Days','1 Week','Custom'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select></label>
                <LocationPicker value={location} onChange={setLocation} compact />
              </div>
            </div>
          )}

          {/* Step 3: Quantity */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-4">
                <h3 className="font-bold text-[#134e4a]">Quantity Required</h3>
                <p className="text-xs text-stone-500">How many units do you need? Available: {pkg.available_units}</p>
                <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Quantity</span>
                  <input className={inputClass} type="number" min="1" max={pkg.available_units}
                    value={quantityRequired} onChange={e => setQuantityRequired(e.target.value)} placeholder="1" /></label>
                {qty > pkg.available_units && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                    <p className="text-xs text-red-700">Only {pkg.available_units} units are available. Please reduce quantity.</p>
                  </div>
                )}
                <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3">
                  <p className="text-xs text-teal-700">Price: ₹{Number(pkg.price || 0).toLocaleString('en-IN')} × {qty} = <span className="font-bold">₹{baseAmount.toLocaleString('en-IN')}</span></p>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Add-ons */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-4">
                <h3 className="font-bold text-[#134e4a]">Add-ons</h3>
                <p className="text-xs text-stone-500">Select optional extras for your rental.</p>
                {addons.length > 0 ? (
                  <div className="space-y-2">
                    {addons.map((addon: any) => (
                      <label key={addon.id} className={`flex items-center justify-between rounded-xl border p-3.5 cursor-pointer transition ${
                        selectedAddonIds.includes(addon.id) ? 'border-teal-600 bg-teal-50' : 'border-[#e7d9c4] hover:border-teal-400'
                      }`}>
                        <div className="flex items-center gap-3">
                          <input type="checkbox" checked={selectedAddonIds.includes(addon.id)} onChange={() => toggleAddon(addon.id)}
                            className="h-4 w-4 rounded border-[#e7d9c4] text-teal-700 focus:ring-teal-700/20" />
                          <div><p className="text-sm font-semibold text-[#134e4a]">{addon.name}</p>
                            {addon.description && <p className="text-xs text-stone-500">{addon.description}</p>}</div>
                        </div>
                        <span className="text-sm font-bold text-teal-700">+₹{Number(addon.price).toLocaleString('en-IN')}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-stone-400 text-center py-4">No add-ons available for this package.</p>
                )}
                {selectedAddonIds.length > 0 && (
                  <div className="rounded-xl border border-[#eadfcf] bg-[#f7fdfc] p-3">
                    <p className="text-xs font-semibold text-stone-600">Add-ons total: <span className="text-teal-700">₹{addonsAmount.toLocaleString('en-IN')}</span></p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 5: Special Instructions */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-4">
                <h3 className="font-bold text-[#134e4a]">Special Instructions</h3>
                <label className="block"><span className="text-sm font-semibold text-[#134e4a]">Instructions</span>
                  <textarea className={`${inputClass} min-h-[100px] resize-y`} value={specialInstructions}
                    onChange={e => setSpecialInstructions(e.target.value)}
                    placeholder="Any specific setup requirements, power supply needs, space dimensions, access restrictions..." /></label>
              </div>
            </div>
          )}

          {/* Step 6: Confirm */}
          {step === 6 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-3">
                <h3 className="font-bold text-[#134e4a]">Confirm Booking</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-stone-600">Package</span><span className="font-semibold">{pkg.name}</span></div>
                  {pkg.package_type && <div className="flex justify-between"><span className="text-stone-600">Type</span><span className="font-medium">{pkg.package_type}</span></div>}
                  {eventDate && <div className="flex justify-between"><span className="text-stone-600">Date</span><span className="font-medium">{new Date(eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>}
                  {eventTime && <div className="flex justify-between"><span className="text-stone-600">Time</span><span className="font-medium">{eventTime}</span></div>}
                  {eventType && <div className="flex justify-between"><span className="text-stone-600">Event</span><span className="font-medium">{eventType}</span></div>}
                  {rentalDuration && <div className="flex justify-between"><span className="text-stone-600">Duration</span><span className="font-medium">{rentalDuration}</span></div>}
                  <div className="flex justify-between"><span className="text-stone-600">Quantity</span><span className="font-medium">{qty} units</span></div>
                  {(location.venue_name || location.locality) && <div className="flex justify-between"><span className="text-stone-600">Delivery</span><span className="font-medium text-right max-w-[180px] truncate">{location.venue_name || location.locality}</span></div>}
                </div>
                <div className="border-t border-[#eadfcf] pt-3 space-y-1.5">
                  <div className="flex justify-between text-sm"><span className="text-stone-600">Base (₹{Number(pkg.price||0).toLocaleString('en-IN')} × {qty})</span><span>₹{baseAmount.toLocaleString('en-IN')}</span></div>
                  {addonsAmount > 0 && <div className="flex justify-between text-sm"><span className="text-stone-600">Add-ons</span><span>₹{addonsAmount.toLocaleString('en-IN')}</span></div>}
                  <div className="flex justify-between text-base font-bold border-t border-stone-100 pt-2"><span className="text-[#134e4a]">Total</span><span className="text-teal-700">₹{total.toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between text-xs text-stone-500"><span>Advance ({advancePercent}%)</span><span>₹{advanceAmount.toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between text-xs text-stone-500"><span>Remaining</span><span>₹{remaining.toLocaleString('en-IN')}</span></div>
                </div>
                <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4">
                  <p className="text-sm font-semibold text-teal-700 flex items-center gap-2"><Check className="h-4 w-4" />Ready to submit your booking</p>
                  <p className="mt-1 text-xs text-teal-600">The rental service will review your request. You will be notified once they respond.</p>
                </div>
                <label className="flex items-start gap-3 cursor-pointer mt-4 rounded-xl border border-[#eadfcf] p-3">
                  <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-[#e7d9c4] text-teal-700 focus:ring-teal-700/20" />
                  <span className="text-xs text-stone-600">I agree to the booking terms. Advance payment will be required after confirmation. Equipment must be returned in good condition.</span>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[#eadfcf] bg-[#f7fdfc]/95 px-5 py-4 backdrop-blur sm:px-7">
          <button type="button" onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="flex items-center gap-1.5 rounded-xl border border-[#d7c5ae] px-4 py-2.5 text-sm font-semibold text-[#134e4a] transition hover:bg-white">
            <ChevronLeft className="h-4 w-4" />{step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step < 6 ? (
            <button type="button" onClick={() => setStep(step + 1)}
              className="flex items-center gap-1.5 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800">
              Next<ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" disabled={busy || !termsAccepted} onClick={handleSubmit}
              className="rounded-xl bg-teal-700 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800 disabled:opacity-60">
              {busy ? <><Loader2 className="mr-1.5 inline h-4 w-4 animate-spin" />Submitting…</> : 'Confirm Booking'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
