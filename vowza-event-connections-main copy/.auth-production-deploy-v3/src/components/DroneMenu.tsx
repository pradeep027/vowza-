import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Check, ChevronDown, ChevronUp, MapPin, Clock, Calendar, X, ChevronLeft, ChevronRight, Loader2, AlertCircle, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { NotificationService } from '@/services/notificationService';
import { toast } from 'sonner';
import LocationPicker, { type LocationData, validateLocationData, emptyLocationData } from '@/components/booking/LocationPicker';
import ScopedCartBar from '@/components/ScopedCartBar';

const EVENT_TYPES = ['Wedding','Reception','Engagement','Haldi','Mehendi','Birthday','Corporate Events','Housewarming','Temple Events','College Fest','Resort Coverage','Real Estate','Construction','Tourism','Agriculture'];
const DURATIONS = ['30 Minutes','1 Hour','2 Hours','4 Hours','Full Day'];
const inputClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition placeholder:text-stone-400 focus:border-[#8b1538] focus:ring-2 focus:ring-[#8b1538]/15';

export default function DroneMenu({ provider, profile }: { provider: any; profile: any }) {
  const { user } = useAuth();
  const { addToCart, isInCart } = useCart();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [bookingPkg, setBookingPkg] = useState<any>(null);
  const [bookingAddons, setBookingAddons] = useState<any[]>([]);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['public-drone-packages', provider.id],
    queryFn: async () => {
      const r = await supabase.from('drone_packages' as any).select('*, drone_gallery(*), drone_addons(*)').eq('provider_id', provider.id).eq('status', 'active').order('created_at');
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });

  useEffect(() => {
    const channel = supabase.channel(`public-drone-${provider.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drone_packages', filter: `provider_id=eq.${provider.id}` }, () => qc.invalidateQueries({ queryKey: ['public-drone-packages', provider.id] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [provider.id]);

  const toggle = (id: string) => setExpanded(s => ({ ...s, [id]: !s[id] }));

  const handleBook = (pkg: any) => {
    if (!user) { toast.error('Please log in to book'); return nav('/auth'); }
    setBookingAddons(pkg.drone_addons ?? []);
    setBookingPkg(pkg);
  };

  if (isLoading) return <div className="h-48 animate-pulse rounded-2xl bg-muted" />;
  if (!packages.length) return <div className="rounded-2xl border border-border/60 bg-surface-1 p-10 text-center text-sm text-muted-foreground">This drone operator has not published any packages yet.</div>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">Drone Packages</h2>
        <p className="text-sm text-muted-foreground">Browse aerial coverage packages and book your event.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {packages.map((pkg: any) => {
          const isOpen = expanded[pkg.id];
          const gallery = pkg.drone_gallery ?? [];
          const cover = gallery.find((g: any) => g.is_cover);
          const addons = pkg.drone_addons ?? [];
          const price = pkg.package_price || pkg.starting_price || pkg.fixed_price || pkg.hourly_price || 0;

          return (
            <div key={pkg.id} className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm transition hover:shadow-md">
              <div className="relative h-44 sm:h-52 bg-gradient-to-br from-sky-50 to-indigo-50 overflow-hidden">
                {cover ? (
                  <img src={cover.public_url} alt={pkg.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full items-center justify-center"><Camera className="h-12 w-12 text-[#8b1538]/20" /></div>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-foreground leading-tight">{pkg.name}</h3>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-[#8b1538]">₹{Number(price).toLocaleString('en-IN')}</p>
                    <p className="text-xs text-muted-foreground">{pkg.fixed_price ? 'fixed' : pkg.hourly_price ? '/hour' : 'starting'}</p>
                  </div>
                </div>
                {pkg.description && <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{pkg.description}</p>}

                {/* Drone info */}
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {pkg.drone_brand && <span className="flex items-center gap-1"><Camera className="h-3 w-3" />{pkg.drone_brand} {pkg.drone_model}</span>}
                  {pkg.camera_resolution && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-700">{pkg.camera_resolution}</span>}
                </div>

                {/* Coverage includes */}
                {(pkg.coverage_includes ?? []).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {pkg.coverage_includes.slice(0, 5).map((c: string) => (
                      <span key={c} className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700">
                        <Check className="h-2.5 w-2.5" />{c}
                      </span>
                    ))}
                    {pkg.coverage_includes.length > 5 && <span className="text-[11px] text-muted-foreground">+{pkg.coverage_includes.length - 5} more</span>}
                  </div>
                )}

                {/* Expanded details */}
                {isOpen && (
                  <div className="mt-3 space-y-3">
                    {(pkg.deliverables ?? []).length > 0 && (
                      <div className="rounded-xl bg-secondary/50 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#62132d] mb-1">Deliverables</p>
                        <div className="flex flex-wrap gap-1">
                          {pkg.deliverables.map((d: string) => (
                            <span key={d} className="rounded-full border border-[#e7d9c4] px-2 py-0.5 text-xs text-stone-600">{d}</span>
                          ))}
                        </div>
                        {pkg.delivery_time && <p className="mt-1 text-xs text-muted-foreground">Delivery: {pkg.delivery_time}</p>}
                      </div>
                    )}
                    {(pkg.drone_features ?? []).length > 0 && (
                      <div className="rounded-xl bg-sky-50/60 border border-sky-100 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-sky-700 mb-1">Drone Features</p>
                        <div className="flex flex-wrap gap-1">
                          {pkg.drone_features.map((f: string) => (
                            <span key={f} className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700">{f}</span>
                          ))}
                        </div>
                      </div>
                    )}
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
                  <button onClick={() => handleBook(pkg)} className="rounded-xl bg-[#8B1538] py-2 text-xs font-semibold text-white transition hover:bg-[#70102d]">
                    Book Now
                  </button>
                </div>
                <button
                  onClick={() => { if (!user) { toast.error('Please log in'); return nav('/auth'); } addToCart({ packageId: pkg.id, providerId: provider.id, providerName: profile?.full_name || 'Artist', category: 'drone', packageTable: 'drone_packages', bookingTable: 'drone_bookings', packageName: pkg.name, price: Number(pkg.package_price || pkg.price || 0), duration: pkg.flight_duration || undefined, imageUrl: (pkg.drone_gallery ?? []).find((g: any) => g.is_cover)?.public_url || undefined }); }}
                  disabled={isInCart(pkg.id, 'drone')}
                  className="mt-2 w-full rounded-xl border border-[#8b1538]/20 bg-[#8b1538]/5 py-2 text-xs font-semibold text-[#8b1538] transition hover:bg-[#8b1538]/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <ShoppingCart className="h-3 w-3" />{isInCart(pkg.id, 'drone') ? 'In Cart' : 'Add to Cart'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <ScopedCartBar providerId={provider.id} category="drone" />
      {/* Booking Modal */}
      {bookingPkg && (
        <DroneBookingModal
          isOpen={!!bookingPkg}
          onClose={() => setBookingPkg(null)}
          pkg={bookingPkg}
          provider={provider}
          addons={bookingAddons}
        />
      )}
    </div>
  );
}


/* ─── Drone Booking Modal ─────────────────────────────────────────────────── */
function DroneBookingModal({ isOpen, onClose, pkg, provider, addons }: { isOpen: boolean; onClose: () => void; pkg: any; provider: any; addons: any[] }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const [eventType, setEventType] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [duration, setDuration] = useState('');
  const [location, setLocation] = useState<LocationData>(emptyLocationData);
  const [indoorOutdoor, setIndoorOutdoor] = useState('outdoor');
  const [dronePermission, setDronePermission] = useState(false);
  const [restrictedArea, setRestrictedArea] = useState(false);
  const [specialRequests, setSpecialRequests] = useState('');
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(1); setEventType(''); setEventDate(''); setEventTime('');
      setDuration(''); setLocation(emptyLocationData); setIndoorOutdoor('outdoor');
      setDronePermission(false); setRestrictedArea(false);
      setSpecialRequests(''); setSelectedAddonIds([]); setTermsAccepted(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const baseAmount = Number(pkg.package_price || pkg.starting_price || pkg.fixed_price || pkg.hourly_price || 0);
  const addonsAmount = addons.filter(a => selectedAddonIds.includes(a.id)).reduce((s, a) => s + Number(a.price || 0), 0);
  const total = baseAmount + addonsAmount;
  const advanceAmount = Math.round(total * 0.2);
  const remaining = total - advanceAmount;

  const toggleAddon = (id: string) => setSelectedAddonIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSubmit = async () => {
    if (!user) { toast.error('Please log in'); nav('/auth'); return; }
    if (!termsAccepted) { toast.error('Please accept terms'); return; }
    if (!eventDate) { toast.error('Event date is required'); setStep(2); return; }
    const locErr = validateLocationData(location);
    if (locErr) { toast.error(locErr); setStep(2); return; }
    setBusy(true);
    try {
      const { data: booking, error } = await supabase.from('drone_bookings' as any).insert({
        package_id: pkg.id,
        provider_id: provider.id,
        customer_id: user.id,
        event_type: eventType || null,
        event_date: eventDate,
        event_time: eventTime || null,
        coverage_duration: duration || null,
        venue: location.venue_name || location.locality || null,
        indoor_outdoor: indoorOutdoor,
        drone_permission_available: dronePermission,
        restricted_area: restrictedArea,
        special_requests: specialRequests || null,
        selected_addon_ids: selectedAddonIds,
        base_amount: baseAmount,
        addons_amount: addonsAmount,
        total_amount: total,
        status: 'pending',
      }).select('id').single();
      if (error) throw error;

      // Save structured location
      await supabase.from('booking_locations' as any).insert({
        booking_table: 'drone_bookings', booking_id: booking.id,
        state: location.state, district: location.district, town_city: location.town_city,
        exact_address: [location.venue_name, location.locality, location.address_line].filter(Boolean).join(', '),
        pincode: location.pincode, landmark: location.address_line || null,
        latitude: location.latitude, longitude: location.longitude,
      });

      await NotificationService.notifyBookingReceived(user.id, provider.id, booking.id);

      sessionStorage.setItem('vowza_booking_success', JSON.stringify({
        bookingId: booking.id,
        artistName: provider.business_name || provider.contact_person || 'Drone Operator',
        eventDate, eventTime, duration,
        venue: location.venue_name || location.locality || 'TBD',
        amount: total,
        advanceAmount, remainingBalance: remaining,
        eventType: eventType || 'Drone Coverage',
        status: 'pending',
      }));

      toast.success('Drone booking request sent!');
      onClose();
      nav('/booking-success');
    } catch (err: any) {
      toast.error(err.message || 'Could not create booking');
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  const STEPS = ['Package', 'Event', 'Coverage', 'Add-ons', 'Requests', 'Summary', 'Confirm'];

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#250914]/65 p-3 backdrop-blur-sm sm:p-6">
      <div className="mx-auto my-3 max-w-2xl overflow-hidden rounded-[24px] bg-[#fffaf3] shadow-2xl">
        <header className="flex items-start justify-between gap-4 bg-[#70102d] px-5 py-5 sm:px-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f4d58d]">Vowza Drone</p>
            <h2 className="mt-1 text-lg font-bold text-white">Book: {pkg.name}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-white/85 hover:bg-white/15"><X className="h-5 w-5" /></button>
        </header>

        {/* Progress */}
        <div className="border-b border-[#eadfcf] bg-[#fffdfa] px-5 py-3 sm:px-7">
          <div className="flex items-center justify-between overflow-x-auto">
            {STEPS.map((label, i) => (
              <div key={i} className="flex items-center">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${step > i+1 ? 'bg-emerald-500 text-white' : step === i+1 ? 'bg-[#8b1538] text-white' : 'border-2 border-[#e7d9c4] text-stone-400'}`}>
                  {step > i+1 ? <Check className="h-3.5 w-3.5" /> : i+1}
                </div>
                {i < 6 && <div className={`mx-0.5 h-0.5 w-3 sm:w-4 rounded ${step > i+1 ? 'bg-emerald-400' : 'bg-[#e7d9c4]'}`} />}
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 sm:p-7 max-h-[60vh] overflow-y-auto">
          {step === 1 && (
            <div className="rounded-2xl border border-[#eadfcf] bg-white p-5">
              <h3 className="font-bold text-[#3d1924] mb-2">{pkg.name}</h3>
              {pkg.description && <p className="text-sm text-muted-foreground mb-3">{pkg.description}</p>}
              <p className="text-xl font-bold text-[#8b1538]">₹{total.toLocaleString('en-IN')}</p>
              {pkg.drone_brand && <p className="mt-1 text-xs text-muted-foreground">{pkg.drone_brand} {pkg.drone_model} · {pkg.camera_resolution}</p>}
              {(pkg.coverage_includes ?? []).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {pkg.coverage_includes.map((c: string) => <span key={c} className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 border border-emerald-100"><Check className="inline h-2.5 w-2.5 mr-0.5" />{c}</span>)}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-4">
              <h3 className="font-bold text-[#62132d] flex items-center gap-2"><Calendar className="h-4 w-4" />Event Details</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className="text-xs font-semibold text-[#4b1d2b]">Event Type</label><select className={inputClass} value={eventType} onChange={e => setEventType(e.target.value)}><option value="">Select</option>{EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label className="text-xs font-semibold text-[#4b1d2b]">Date *</label><input type="date" min={new Date().toISOString().slice(0,10)} className={inputClass} value={eventDate} onChange={e => setEventDate(e.target.value)} /></div>
                <div><label className="text-xs font-semibold text-[#4b1d2b]">Time</label><input type="time" className={inputClass} value={eventTime} onChange={e => setEventTime(e.target.value)} /></div>
              </div>
              <LocationPicker value={location} onChange={setLocation} compact />
            </div>
          )}

          {step === 3 && (
            <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-4">
              <h3 className="font-bold text-[#62132d] flex items-center gap-2"><Clock className="h-4 w-4" />Coverage Details</h3>
              <div><label className="text-xs font-semibold text-[#4b1d2b]">Flight Duration</label><select className={inputClass} value={duration} onChange={e => setDuration(e.target.value)}><option value="">Select</option>{DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
              <div className="flex flex-wrap gap-3">
                {['outdoor','indoor','both'].map(opt => (
                  <label key={opt} className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm cursor-pointer transition ${indoorOutdoor === opt ? 'border-[#8b1538] bg-[#8b1538]/5' : 'border-[#e7d9c4]'}`}>
                    <input type="radio" name="io" value={opt} checked={indoorOutdoor === opt} onChange={() => setIndoorOutdoor(opt)} className="accent-[#8b1538]" />
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </label>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={dronePermission} onChange={e => setDronePermission(e.target.checked)} className="accent-[#8b1538]" />Drone flight permission is available at venue</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={restrictedArea} onChange={e => setRestrictedArea(e.target.checked)} className="accent-[#8b1538]" />Location is in a restricted/no-fly zone</label>
              {restrictedArea && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-2"><AlertCircle className="inline h-3 w-3 mr-1" />Drone flights in restricted zones may require additional permits. The operator will advise.</p>}
            </div>
          )}

          {step === 4 && (
            <div className="rounded-2xl border border-[#eadfcf] bg-white p-5">
              <h3 className="font-bold text-[#62132d] mb-3">Optional Add-ons</h3>
              {addons.length === 0 ? <p className="text-sm text-muted-foreground">No add-ons available for this package.</p> : (
                <div className="space-y-2">
                  {addons.map((a: any) => {
                    const sel = selectedAddonIds.includes(a.id);
                    return (
                      <button key={a.id} type="button" onClick={() => toggleAddon(a.id)} className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition ${sel ? 'border-[#8b1538] bg-[#8b1538]/5' : 'border-[#e7d9c4] hover:border-[#c99b43]'}`}>
                        <div className={`flex h-5 w-5 items-center justify-center rounded border ${sel ? 'border-[#8b1538] bg-[#8b1538] text-white' : 'border-stone-300'}`}>{sel && <Check className="h-3 w-3" />}</div>
                        <div className="flex-1"><p className="text-sm font-semibold text-[#3d1924]">{a.name}</p>{a.description && <p className="text-xs text-muted-foreground">{a.description}</p>}</div>
                        <span className="text-sm font-bold text-[#8b1538]">+₹{Number(a.price).toLocaleString('en-IN')}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="rounded-2xl border border-[#eadfcf] bg-white p-5">
              <h3 className="font-bold text-[#62132d] mb-3">Special Requests</h3>
              <textarea className={`${inputClass} min-h-[100px] resize-y`} placeholder="Any specific shots, angles, timing requirements, or instructions for the drone operator..." value={specialRequests} onChange={e => setSpecialRequests(e.target.value)} />
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#eadfcf] bg-white p-5">
                <h3 className="font-bold text-[#62132d] mb-3">Booking Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Package</span><span className="font-semibold">{pkg.name}</span></div>
                  {eventType && <div className="flex justify-between"><span className="text-muted-foreground">Event</span><span className="font-semibold">{eventType}</span></div>}
                  {eventDate && <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="font-semibold">{new Date(eventDate).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</span></div>}
                  {duration && <div className="flex justify-between"><span className="text-muted-foreground">Duration</span><span className="font-semibold">{duration}</span></div>}
                  {(location.venue_name || location.locality) && <div className="flex justify-between"><span className="text-muted-foreground">Venue</span><span className="font-semibold text-right max-w-[200px]">{location.venue_name || location.locality}</span></div>}
                </div>
              </div>
              <div className="rounded-2xl border border-[#eadfcf] bg-gradient-to-br from-sky-50 to-indigo-50 p-5">
                <h3 className="font-bold text-[#62132d] mb-3">Price</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Base Package</span><span className="font-semibold">₹{baseAmount.toLocaleString('en-IN')}</span></div>
                  {addonsAmount > 0 && <div className="flex justify-between"><span>Add-ons</span><span className="font-semibold">₹{addonsAmount.toLocaleString('en-IN')}</span></div>}
                  <div className="border-t pt-2 flex justify-between text-lg font-bold"><span>Total</span><span className="text-[#8b1538]">₹{total.toLocaleString('en-IN')}</span></div>
                </div>
                <div className="mt-3 rounded-xl bg-[#8b1538]/5 border border-[#8b1538]/15 p-3 text-xs">
                  <p className="font-bold text-[#8b1538] mb-1">Payment Structure</p>
                  <div className="flex justify-between"><span>20% Advance</span><span className="font-bold">₹{advanceAmount.toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>Remaining</span><span>₹{remaining.toLocaleString('en-IN')}</span></div>
                </div>
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
                <Check className="mx-auto h-10 w-10 text-emerald-600 mb-2" />
                <h3 className="text-lg font-bold text-emerald-800">Ready to Submit</h3>
                <p className="mt-1 text-sm text-emerald-700">Total: ₹{total.toLocaleString('en-IN')}</p>
                <p className="mt-2 text-xs text-emerald-600">The drone operator will review and accept your request. You'll pay 20% advance after acceptance.</p>
              </div>
              <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-xs text-blue-700">
                <AlertCircle className="inline h-3.5 w-3.5 mr-1" />Your payment will be securely held by Vowza until the service is completed.
              </div>
              <label className="flex items-start gap-3 p-4 rounded-xl border border-[#e7d9c4] bg-white cursor-pointer">
                <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="mt-1 accent-[#8b1538]" />
                <span className="text-xs text-muted-foreground">I agree to the <a href="/terms" target="_blank" className="text-[#8b1538] underline">Terms</a> and <a href="/privacy" target="_blank" className="text-[#8b1538] underline">Privacy Policy</a>.</span>
              </label>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[#eadfcf] bg-[#fffdfa]/95 px-5 py-4 sm:px-7">
          <button onClick={step === 1 ? onClose : () => setStep(step - 1)} className="flex items-center gap-1.5 rounded-xl border border-[#d7c5ae] px-4 py-2.5 text-sm font-semibold text-[#5a3440] hover:bg-white">
            <ChevronLeft className="h-4 w-4" />{step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step < 7 ? (
            <button onClick={() => setStep(step + 1)} className="flex items-center gap-1.5 rounded-xl bg-[#8b1538] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#70102d]">
              Next<ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button disabled={busy || !termsAccepted} onClick={handleSubmit} className="rounded-xl bg-[#8b1538] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#70102d] disabled:opacity-60">
              {busy ? <><Loader2 className="inline h-4 w-4 mr-2 animate-spin" />Submitting…</> : 'Submit Booking'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
