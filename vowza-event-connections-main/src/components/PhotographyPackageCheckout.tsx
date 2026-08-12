import { useEffect, useState } from 'react';
import { ArrowLeft, Calendar, Clock, MapPin, Users, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePlatformFee, calculatePlatformFee } from '@/hooks/usePlatformFee';
import LocationPicker, { type LocationData, validateLocationData, emptyLocationData } from '@/components/booking/LocationPicker';

const EVENT_TYPES = ['Wedding', 'Reception', 'Birthday', 'Engagement', 'Corporate', 'Haldi', 'Sangeet', 'Baby Shower', 'Housewarming', 'College Fest', 'Private Party', 'Anniversary', 'Other'] as const;

export default function PhotographyPackageCheckout({ payload }: { payload: any }) {
  const nav = useNavigate();
  const { data: feeConfig } = usePlatformFee();
  const [cart, setCart] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  // Form state
  const [eventType, setEventType] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [venueCity, setVenueCity] = useState('');
  const [venueState, setVenueState] = useState('');
  const [pincode, setPincode] = useState('');
  const [location, setLocation] = useState<LocationData>(emptyLocationData);
  const [notes, setNotes] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = () => {
    if (!payload.cartId) return;
    supabase.from('photography_carts' as any).select('*, photography_cart_items(*, photography_packages(name,price,photography_type,duration,team_size,photography_package_addons(id,name,price), photography_albums(id,type,size,pages,price)))').eq('id', payload.cartId).single().then(({ data, error }) => { if (error) { console.error('[PhotographyCheckout] cart load error:', error.message); toast.error('Could not load cart. Please go back and try again.'); } else setCart(data); });
  };

  useEffect(() => { if (!payload.cartId) return; load(); }, [payload.cartId]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!date) e.date = 'Event date is required';
    if (!time) e.time = 'Event time is required';
    if (!termsAccepted) e.terms = 'Please accept the terms';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const book = async () => {
    if (!validate()) return;
    if (!payload.cartId) return toast.error('Cart is missing. Please choose a package again.');
    const locErr = validateLocationData(location);
    if (locErr) { toast.error(locErr); setStep(1); return; }
    setBusy(true);
    const venueStr = [location.venue_name, location.locality, location.town_city, location.district, location.state, location.pincode].filter(Boolean).join(', ');
    const notesStr = [notes, eventType && `Event: ${eventType}`, guestCount && `Guests: ${guestCount}`, duration && `Duration: ${duration}`].filter(Boolean).join(' | ');
    const { error } = await supabase.rpc('checkout_photography_cart' as any, { p_cart_id: payload.cartId, p_event_date: date, p_event_time: time || null, p_venue: venueStr || null, p_notes: notesStr || null });
    setBusy(false);
    if (error) return toast.error(error.message);
    // Save structured location to booking_locations
    await supabase.from('booking_locations' as any).insert({
      booking_table: 'photography_package_bookings', booking_id: payload.cartId,
      state: location.state, district: location.district, town_city: location.town_city,
      exact_address: [location.venue_name, location.locality, location.address_line].filter(Boolean).join(', '),
      pincode: location.pincode, landmark: location.address_line || null,
      latitude: location.latitude, longitude: location.longitude,
    });
    sessionStorage.removeItem('vowza_photography_checkout');
    // Navigate to booking success
    sessionStorage.setItem('vowza_booking_success', JSON.stringify({
      bookingId: payload.cartId.slice(0, 8),
      artistName: payload.providerName,
      eventDate: date,
      eventTime: time,
      duration: duration || 'Full Day',
      venue: venueStr,
      amount: total,
      eventType: eventType || 'Photography',
      status: 'requested'
    }));
    nav('/booking-success');
  };

  const itemTotal = (item: any) => Number(item.photography_packages?.price ?? 0) + (item.photography_packages?.photography_package_addons ?? []).filter((a: any) => item.addon_ids?.includes(a.id)).reduce((sum: number, a: any) => sum + Number(a.price), 0) + Number(item.photography_packages?.photography_albums?.find((a: any) => a.id === item.album_id)?.price ?? 0);
  const total = (cart?.photography_cart_items ?? []).reduce((sum: number, item: any) => sum + itemTotal(item), 0);
  const platformFee = feeConfig ? calculatePlatformFee(total, feeConfig) : 0;
  const grandTotal = total + platformFee;
  const ADVANCE_PERCENT = 20;
  const advancePayable = Math.round(grandTotal * ADVANCE_PERCENT / 100);
  const remainingBalance = grandTotal - advancePayable;

  const inputClass = 'w-full rounded-xl border border-border/60 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#8B1538] focus:ring-2 focus:ring-[#8B1538]/10';
  const labelClass = 'block text-sm font-semibold text-foreground mb-1.5';
  const errorClass = 'text-xs text-red-500 mt-1';

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream via-background to-blush/10 py-6 px-4 md:py-10">
      <div className="mx-auto max-w-4xl">
        <button onClick={() => nav(-1)} className="mb-6 flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />Back to packages
        </button>

        {/* Progress indicator */}
        <div className="mb-8 flex items-center gap-3">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-[#8B1538]' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step >= 1 ? 'bg-[#8B1538] text-white' : 'bg-muted'}`}>1</div>
            <span className="text-sm font-semibold hidden sm:inline">Event Details</span>
          </div>
          <div className="h-px flex-1 bg-border" />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-[#8B1538]' : 'text-muted-foreground'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step >= 2 ? 'bg-[#8B1538] text-white' : 'bg-muted'}`}>2</div>
            <span className="text-sm font-semibold hidden sm:inline">Review & Confirm</span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr,380px]">
          {/* Main form */}
          <div className="space-y-6">
            {step === 1 && (
              <div className="rounded-2xl border border-border/60 bg-white p-6 shadow-sm space-y-5">
                <div>
                  <h1 className="text-2xl font-display font-bold text-foreground">Book Photography</h1>
                  <p className="text-sm text-muted-foreground mt-1">Fill in your event details for {payload.providerName}</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}><Calendar className="inline h-3.5 w-3.5 mr-1" />Event Date *</label>
                    <input type="date" min={new Date().toISOString().slice(0, 10)} value={date} onChange={e => { setDate(e.target.value); setErrors(prev => ({ ...prev, date: '' })); }} className={`${inputClass} ${errors.date ? 'border-red-500' : ''}`} />
                    {errors.date && <p className={errorClass}>{errors.date}</p>}
                  </div>
                  <div>
                    <label className={labelClass}><Clock className="inline h-3.5 w-3.5 mr-1" />Event Time *</label>
                    <input type="time" value={time} onChange={e => { setTime(e.target.value); setErrors(prev => ({ ...prev, time: '' })); }} className={`${inputClass} ${errors.time ? 'border-red-500' : ''}`} />
                    {errors.time && <p className={errorClass}>{errors.time}</p>}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Event Type</label>
                    <select value={eventType} onChange={e => setEventType(e.target.value)} className={inputClass}>
                      <option value="">Select event type</option>
                      {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}><Users className="inline h-3.5 w-3.5 mr-1" />Guest Count</label>
                    <input type="number" placeholder="Expected guests" value={guestCount} onChange={e => setGuestCount(e.target.value)} className={inputClass} />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Duration</label>
                  <select value={duration} onChange={e => setDuration(e.target.value)} className={inputClass}>
                    <option value="">Select duration</option>
                    <option value="2 Hours">2 Hours</option>
                    <option value="4 Hours">4 Hours</option>
                    <option value="Half Day">Half Day</option>
                    <option value="Full Day">Full Day</option>
                    <option value="2 Days">2 Days</option>
                  </select>
                </div>

                <hr className="border-border/40" />

                <LocationPicker value={location} onChange={setLocation} />

                <div>
                  <label className={labelClass}><FileText className="inline h-3.5 w-3.5 mr-1" />Special Instructions</label>
                  <textarea placeholder="Any special requirements, preferred style, references…" value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={`${inputClass} resize-none`} />
                </div>

                <button onClick={() => { const locErr = validateLocationData(location); if (!date || !time) { validate(); return; } if (locErr) { toast.error(locErr); return; } setStep(2); }} className="w-full rounded-xl bg-[#8B1538] py-3.5 font-semibold text-white transition hover:bg-[#70102d]">
                  Continue to Review →
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="rounded-2xl border border-border/60 bg-white p-6 shadow-sm space-y-5">
                <div>
                  <h2 className="text-xl font-display font-bold text-foreground">Review & Confirm</h2>
                  <p className="text-sm text-muted-foreground mt-1">Verify your booking details before confirming</p>
                </div>

                {/* Booking summary */}
                <div className="rounded-xl bg-[#8B1538]/5 border border-[#8B1538]/15 p-4 space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Artist</span><span className="font-semibold">{payload.providerName}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="font-semibold">{new Date(date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
                  {time && <div className="flex justify-between"><span className="text-muted-foreground">Time</span><span className="font-semibold">{time}</span></div>}
                  {eventType && <div className="flex justify-between"><span className="text-muted-foreground">Event</span><span className="font-semibold">{eventType}</span></div>}
                  {guestCount && <div className="flex justify-between"><span className="text-muted-foreground">Guests</span><span className="font-semibold">{guestCount}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">Venue</span><span className="font-semibold text-right max-w-[200px]">{[location.venue_name, location.town_city, location.district, location.state].filter(Boolean).join(', ')}</span></div>
                  {location.pincode && <div className="flex justify-between"><span className="text-muted-foreground">Pincode</span><span className="font-semibold">{location.pincode}</span></div>}
                </div>

                {/* Price breakdown */}
                <div className="rounded-xl bg-secondary p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span>Subtotal</span><b>₹{total.toLocaleString('en-IN')}</b></div>
                  <div className="flex justify-between text-xs text-muted-foreground"><span>Platform Fee{feeConfig?.type === 'percentage' ? ` (${feeConfig.rate}%)` : ''}</span><span>₹{platformFee.toLocaleString('en-IN')}</span></div>
                  <hr className="border-border/40" />
                  <div className="flex justify-between font-semibold"><span>Total</span><span>₹{grandTotal.toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Advance Payable ({ADVANCE_PERCENT}%)</span><span className="font-bold text-[#8B1538]">₹{advancePayable.toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Remaining Balance</span><span>₹{remainingBalance.toLocaleString('en-IN')}</span></div>
                </div>

                {/* Info notice */}
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-xs text-blue-700">
                  Your booking request will be sent to the artist. They typically respond within 24 hours. Contact details will be shared after confirmation.
                </div>

                {/* Terms */}
                <label className="flex items-start gap-3 p-3 rounded-xl border border-border/60 bg-secondary/30 cursor-pointer">
                  <input type="checkbox" checked={termsAccepted} onChange={e => { setTermsAccepted(e.target.checked); setErrors(prev => ({ ...prev, terms: '' })); }} className="mt-1 accent-[#8B1538]" />
                  <span className="text-xs text-muted-foreground">
                    I agree to the <a href="/terms" target="_blank" className="text-[#8B1538] underline">Terms & Conditions</a>, <a href="/terms" target="_blank" className="text-[#8B1538] underline">Cancellation Policy</a>, and <a href="/privacy" target="_blank" className="text-[#8B1538] underline">Privacy Policy</a>.
                  </span>
                </label>
                {errors.terms && <p className={errorClass}>{errors.terms}</p>}

                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className="flex-1 rounded-xl border border-border py-3 font-semibold text-foreground hover:bg-secondary transition">← Back</button>
                  <button disabled={busy || !termsAccepted} onClick={book} className="flex-[2] rounded-xl bg-[#8B1538] py-3 font-semibold text-white disabled:opacity-50 transition hover:bg-[#70102d]">
                    {busy ? <><Loader2 className="inline h-4 w-4 mr-2 animate-spin" />Processing…</> : <><CheckCircle2 className="inline h-4 w-4 mr-2" />Confirm Booking</>}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Cart sidebar */}
          <aside className="lg:sticky lg:top-20 self-start rounded-2xl border border-border/60 bg-white p-6 shadow-sm">
            <h2 className="font-bold text-foreground mb-4">Your Photography Cart</h2>
            {!cart ? <div className="h-20 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : (
              <div className="space-y-4">
                {cart.photography_cart_items.map((item: any) => {
                  const album = item.photography_packages?.photography_albums?.find((a: any) => a.id === item.album_id);
                  const addons = item.photography_packages?.photography_package_addons?.filter((a: any) => item.addon_ids?.includes(a.id)) ?? [];
                  return (
                    <div key={item.id} className="border-b border-border/40 pb-4 last:border-0">
                      <div className="flex justify-between gap-3">
                        <div>
                          <p className="font-semibold text-sm">{item.photography_packages?.name}</p>
                          <p className="text-xs text-muted-foreground">{item.photography_packages?.photography_type} · {item.photography_packages?.duration}</p>
                        </div>
                        <b className="text-sm flex-shrink-0">₹{Number(item.photography_packages?.price ?? 0).toLocaleString('en-IN')}</b>
                      </div>
                      {album && <div className="flex justify-between mt-1 text-xs text-muted-foreground"><span>Album: {album.type}</span><span>+₹{Number(album.price).toLocaleString('en-IN')}</span></div>}
                      {addons.map((a: any) => <div key={a.id} className="flex justify-between mt-1 text-xs text-muted-foreground"><span>{a.name}</span><span>+₹{Number(a.price).toLocaleString('en-IN')}</span></div>)}
                    </div>
                  );
                })}
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-sm"><span>Subtotal</span><b>₹{total.toLocaleString('en-IN')}</b></div>
                  <div className="flex justify-between text-xs text-muted-foreground"><span>Platform Fee{feeConfig?.type === 'percentage' ? ` (${feeConfig.rate}%)` : ''}</span><span>₹{platformFee.toLocaleString('en-IN')}</span></div>
                  <hr className="border-border/40" />
                  <div className="flex justify-between text-sm font-semibold"><span>Total</span><span>₹{grandTotal.toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Advance Payable ({ADVANCE_PERCENT}%)</span><span className="font-semibold text-[#8B1538]">₹{advancePayable.toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Remaining Balance</span><span>₹{remainingBalance.toLocaleString('en-IN')}</span></div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
