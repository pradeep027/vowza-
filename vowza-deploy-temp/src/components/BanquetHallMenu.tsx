import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Check, ChevronDown, ChevronUp, Calendar, X, ChevronLeft, ChevronRight, Loader2, MapPin, Users, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { NotificationService } from '@/services/notificationService';
import { toast } from 'sonner';
import LocationPicker, { type LocationData, validateLocationData, emptyLocationData } from '@/components/booking/LocationPicker';
import ScopedCartBar from '@/components/ScopedCartBar';

const inputClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition placeholder:text-stone-400 focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/15';

export default function BanquetHallMenu({ provider, profile }: { provider: any; profile: any }) {
  const { user } = useAuth();
  const { addToCart, isInCart } = useCart();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [bookingPkg, setBookingPkg] = useState<any>(null);
  const [bookingAddons, setBookingAddons] = useState<any[]>([]);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['public-banquet-halls', provider.id],
    queryFn: async () => {
      const r = await supabase.from('banquet_halls' as any).select('*, hall_gallery(*), hall_addons(*)').eq('provider_id', provider.id).eq('status', 'active').order('created_at');
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });

  useEffect(() => {
    const channel = supabase.channel(`public-banquet-${provider.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'banquet_halls', filter: `provider_id=eq.${provider.id}` }, () => qc.invalidateQueries({ queryKey: ['public-banquet-halls', provider.id] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [provider.id]);

  const toggle = (id: string) => setExpanded(s => ({ ...s, [id]: !s[id] }));

  const handleBook = (pkg: any) => {
    if (!user) { toast.error('Please log in to book'); return nav('/auth'); }
    setBookingAddons(pkg.hall_addons ?? []);
    setBookingPkg(pkg);
  };

  if (isLoading) return <div className="h-48 animate-pulse rounded-2xl bg-muted" />;
  if (!packages.length) return <div className="rounded-2xl border border-border/60 bg-surface-1 p-10 text-center text-sm text-muted-foreground">This venue owner has not published any venues yet.</div>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">Banquet Hall Venues</h2>
        <p className="text-sm text-muted-foreground">Browse venues and book for your event.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {packages.map((pkg: any) => {
          const isOpen = expanded[pkg.id];
          const gallery = pkg.hall_gallery ?? [];
          const cover = gallery.find((g: any) => g.is_cover);
          const addons = pkg.hall_addons ?? [];
          const price = pkg.hall_rental_price || 0;

          return (
            <div key={pkg.id} className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm transition hover:shadow-md">
              <div className="relative h-44 sm:h-52 bg-gradient-to-br from-violet-50 to-amber-50 overflow-hidden">
                {cover ? (
                  <img src={cover.public_url} alt={pkg.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full items-center justify-center"><Building2 className="h-12 w-12 text-violet-400/40" /></div>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-foreground leading-tight">{pkg.name}</h3>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-violet-700">₹{Number(price).toLocaleString('en-IN')}</p>
                    <p className="text-xs text-muted-foreground">rental</p>
                  </div>
                </div>
                {pkg.description && <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{pkg.description}</p>}

                {/* Venue type badge */}
                {pkg.venue_type && (
                  <div className="mt-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 border border-violet-200 px-2.5 py-0.5 text-[11px] font-medium text-violet-800">
                      <Building2 className="h-3 w-3" />{pkg.venue_type}
                    </span>
                  </div>
                )}

                {/* Capacity & Location */}
                <div className="mt-2 flex flex-wrap gap-2">
                  {pkg.hall_capacity && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-100 px-2 py-0.5 text-[11px] text-amber-700">
                      <Users className="h-3 w-3" />{pkg.hall_capacity} guests
                    </span>
                  )}
                  {pkg.city && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-stone-50 border border-stone-200 px-2 py-0.5 text-[11px] text-stone-600">
                      <MapPin className="h-3 w-3" />{pkg.city}
                    </span>
                  )}
                </div>

                {/* Facilities chips */}
                {(pkg.facilities_included ?? []).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {pkg.facilities_included.slice(0, 5).map((s: string) => (
                      <span key={s} className="inline-flex items-center rounded-full bg-violet-50 border border-violet-100 px-2 py-0.5 text-[11px] text-violet-700">{s}</span>
                    ))}
                    {pkg.facilities_included.length > 5 && <span className="text-[11px] text-muted-foreground">+{pkg.facilities_included.length - 5} more</span>}
                  </div>
                )}

                {/* Expanded details */}
                {isOpen && (
                  <div className="mt-3 space-y-3">
                    {/* All facilities */}
                    {(pkg.facilities_included ?? []).length > 0 && (
                      <div className="rounded-xl bg-secondary/50 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-violet-800 mb-1">All Facilities</p>
                        <div className="flex flex-wrap gap-1">
                          {pkg.facilities_included.map((s: string) => <span key={s} className="rounded-full border border-[#e7d9c4] px-2 py-0.5 text-xs text-stone-600">{s}</span>)}
                        </div>
                      </div>
                    )}
                    {/* Venue features */}
                    {(pkg.venue_features ?? []).length > 0 && (
                      <div className="rounded-xl bg-violet-50/60 border border-violet-100 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-violet-700 mb-1">Venue Features</p>
                        <div className="flex flex-wrap gap-1">
                          {pkg.venue_features.map((s: string) => <span key={s} className="rounded-full border border-violet-200 px-2 py-0.5 text-xs text-violet-800">{s}</span>)}
                        </div>
                      </div>
                    )}
                    {/* Seating styles */}
                    {(pkg.seating_styles ?? []).length > 0 && (
                      <div className="rounded-xl bg-amber-50/60 border border-amber-100 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 mb-1">Seating Styles</p>
                        <div className="flex flex-wrap gap-1">
                          {pkg.seating_styles.map((s: string) => <span key={s} className="rounded-full border border-amber-200 px-2 py-0.5 text-xs text-amber-800">{s}</span>)}
                        </div>
                      </div>
                    )}
                    {/* Event types */}
                    {(pkg.event_types_supported ?? []).length > 0 && (
                      <div className="rounded-xl bg-violet-50/60 border border-violet-100 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-violet-700 mb-1">Events Supported</p>
                        <div className="flex flex-wrap gap-1">
                          {pkg.event_types_supported.map((e: string) => <span key={e} className="rounded-full border border-violet-200 px-2 py-0.5 text-xs text-violet-800">{e}</span>)}
                        </div>
                      </div>
                    )}
                    {/* Rules summary */}
                    <div className="rounded-xl bg-stone-50 border border-stone-200 p-3 space-y-1 text-xs text-stone-600">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-stone-700 mb-1">Venue Rules</p>
                      {pkg.allowed_time && <p>⏰ {pkg.allowed_time}</p>}
                      <p>🎨 Outside Decoration: {pkg.outside_decoration_allowed ? '✅ Allowed' : '❌ Not allowed'}</p>
                      <p>🍽️ Outside Catering: {pkg.outside_catering_allowed ? '✅ Allowed' : '❌ Not allowed'}</p>
                      <p>🍷 Alcohol: {pkg.alcohol_allowed ? '✅ Allowed' : '❌ Not allowed'}</p>
                      <p>🎆 Fireworks: {pkg.fireworks_allowed ? '✅ Allowed' : '❌ Not allowed'}</p>
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
                    {/* Address & Maps */}
                    {pkg.address && <p className="text-xs text-stone-600">📍 {pkg.address}{pkg.city ? `, ${pkg.city}` : ''}</p>}
                    {pkg.google_maps_url && <a href={pkg.google_maps_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-violet-700 hover:underline"><MapPin className="h-3 w-3" />View on Google Maps</a>}
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button onClick={() => toggle(pkg.id)} className="rounded-xl border py-2 text-xs font-semibold flex items-center justify-center gap-1 transition hover:bg-secondary/50">
                    {isOpen ? <><ChevronUp className="h-3 w-3" />Hide Details</> : <><ChevronDown className="h-3 w-3" />View Details</>}
                  </button>
                  <button onClick={() => handleBook(pkg)} className="rounded-xl bg-violet-700 py-2 text-xs font-semibold text-white transition hover:bg-violet-800">
                    Book Now
                  </button>
                </div>
                <button
                  onClick={() => { if (!user) { toast.error('Please log in'); return nav('/auth'); } addToCart({ packageId: pkg.id, providerId: provider.id, providerName: profile?.full_name || 'Artist', category: 'banquet', packageTable: 'banquet_halls', bookingTable: 'banquet_bookings', packageName: pkg.name, price: Number(pkg.package_price || pkg.price || 0), duration: undefined, imageUrl: (pkg.hall_gallery ?? []).find((g: any) => g.is_cover)?.public_url || undefined }); }}
                  disabled={isInCart(pkg.id, 'banquet')}
                  className="mt-2 w-full rounded-xl border border-violet-200 bg-violet-50 py-2 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <ShoppingCart className="h-3 w-3" />{isInCart(pkg.id, 'banquet') ? 'In Cart' : 'Add to Cart'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <ScopedCartBar providerId={provider.id} category="banquet" />
      {/* Booking Modal */}
      {bookingPkg && (
        <BanquetBookingModal isOpen={!!bookingPkg} onClose={() => setBookingPkg(null)} pkg={bookingPkg} provider={provider} addons={bookingAddons} />
      )}
    </div>
  );
}


/* ─── Banquet Hall Booking Modal ───────────────────────────────────────────── */
function BanquetBookingModal({ isOpen, onClose, pkg, provider, addons }: { isOpen: boolean; onClose: () => void; pkg: any; provider: any; addons: any[] }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventType, setEventType] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [location, setLocation] = useState<LocationData>(emptyLocationData);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [specialRequirements, setSpecialRequirements] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(1); setEventDate(''); setEventTime('');
      setEventType(''); setGuestCount('');
      setLocation(emptyLocationData);
      setSelectedAddonIds([]); setSpecialRequirements('');
      setTermsAccepted(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const baseAmount = Number(pkg.hall_rental_price || 0);
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
    const locErr = validateLocationData(location);
    if (locErr) { toast.error(locErr); setStep(2); return; }
    setBusy(true);
    try {
      const { data: booking, error } = await supabase.from('banquet_bookings' as any).insert({
        package_id: pkg.id,
        provider_id: provider.id,
        customer_id: user.id,
        event_date: eventDate,
        event_time: eventTime || null,
        event_type: eventType || null,
        guest_count: guestCount || null,
        venue: location.venue_name || location.locality || null,
        city: location.town_city || null,
        selected_addon_ids: selectedAddonIds,
        special_requirements: specialRequirements || null,
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
        booking_table: 'banquet_bookings', booking_id: booking.id,
        state: location.state, district: location.district, town_city: location.town_city,
        exact_address: [location.venue_name, location.locality, location.address_line].filter(Boolean).join(', '),
        pincode: location.pincode, landmark: location.address_line || null,
        latitude: location.latitude, longitude: location.longitude,
      });

      await NotificationService.notifyBookingReceived(user.id, provider.id, booking.id);

      sessionStorage.setItem('vowza_booking_success', JSON.stringify({
        bookingId: booking.id,
        artistName: provider.business_name || provider.contact_person || 'Venue',
        eventDate, eventTime,
        venue: location.venue_name || location.locality || 'TBD',
        city: location.town_city || '',
        amount: total, advanceAmount, remainingBalance: remaining,
        eventType: eventType || pkg.venue_type || 'Banquet Hall',
        status: 'pending',
      }));

      toast.success('Venue booking request sent!');
      onClose();
      nav('/booking-success');
    } catch (err: any) {
      toast.error(err.message || 'Could not create booking');
    } finally { setBusy(false); }
  };

  if (!isOpen) return null;

  const STEPS = ['Venue', 'Event Details', 'Guest Count', 'Add-ons', 'Requirements', 'Confirm'];

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#1b1b4e]/65 p-3 backdrop-blur-sm sm:p-6">
      <div className="mx-auto my-3 max-w-2xl overflow-hidden rounded-[24px] bg-[#fefeff] shadow-2xl">
        <header className="flex items-start justify-between gap-4 bg-violet-800 px-5 py-5 sm:px-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-200">Vowza Banquet Hall</p>
            <h2 className="mt-1 text-lg font-bold text-white">Book: {pkg.name}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-white/85 hover:bg-white/15"><X className="h-5 w-5" /></button>
        </header>

        {/* Progress */}
        <div className="border-b border-[#eadfcf] bg-[#faf8ff] px-5 py-3 sm:px-7">
          <div className="flex items-center justify-between overflow-x-auto">
            {STEPS.map((label, i) => (
              <div key={i} className="flex items-center">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${step > i+1 ? 'bg-violet-500 text-white' : step === i+1 ? 'bg-violet-700 text-white' : 'border-2 border-[#e7d9c4] text-stone-400'}`}>
                  {step > i+1 ? <Check className="h-3.5 w-3.5" /> : i+1}
                </div>
                {i < 5 && <div className={`mx-0.5 h-0.5 w-3 sm:w-4 rounded ${step > i+1 ? 'bg-violet-400' : 'bg-[#e7d9c4]'}`} />}
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 sm:p-7 max-h-[60vh] overflow-y-auto">

          {/* Step 1: Venue Preview */}
          {step === 1 && (
            <div className="rounded-2xl border border-[#eadfcf] bg-white p-5">
              <h3 className="font-bold text-[#1b1b4e] mb-2">{pkg.name}</h3>
              {pkg.description && <p className="text-sm text-muted-foreground mb-3">{pkg.description}</p>}
              <p className="text-xl font-bold text-violet-700">₹{baseAmount.toLocaleString('en-IN')}</p>
              {pkg.venue_type && <p className="mt-1 text-xs text-muted-foreground"><Building2 className="inline h-3 w-3 mr-1" />Type: {pkg.venue_type}</p>}
              {pkg.hall_capacity && <p className="mt-1 text-xs text-muted-foreground"><Users className="inline h-3 w-3 mr-1" />Capacity: {pkg.hall_capacity} guests</p>}
              {pkg.address && <p className="mt-1 text-xs text-muted-foreground"><MapPin className="inline h-3 w-3 mr-1" />{pkg.address}{pkg.city ? `, ${pkg.city}` : ''}</p>}
              {(pkg.facilities_included ?? []).length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-stone-600 mb-1">Facilities:</p>
                  <div className="flex flex-wrap gap-1">
                    {pkg.facilities_included.map((s: string) => <span key={s} className="rounded-full bg-violet-700/8 px-2 py-0.5 text-[11px] text-violet-700">{s}</span>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Event Details */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-4">
                <h3 className="font-bold text-[#1b1b4e]">Event Details</h3>
                <label className="block"><span className="text-sm font-semibold text-[#1b1b4e]">Event Date <span className="text-red-500">*</span></span>
                  <input type="date" className={inputClass} value={eventDate} onChange={e => setEventDate(e.target.value)} min={new Date().toISOString().split('T')[0]} /></label>
                <label className="block"><span className="text-sm font-semibold text-[#1b1b4e]">Event Time</span>
                  <input type="time" className={inputClass} value={eventTime} onChange={e => setEventTime(e.target.value)} /></label>
                <label className="block"><span className="text-sm font-semibold text-[#1b1b4e]">Event Type</span>
                  <select className={inputClass} value={eventType} onChange={e => setEventType(e.target.value)}>
                    <option value="">Select event type</option>
                    {['Wedding','Reception','Engagement','Haldi','Mehendi','Birthday','Baby Shower','Naming Ceremony','Corporate Event','Seminar','Conference','Award Function','College Fest','Festival','Religious Event','Private Party','Other'].map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select></label>
                <LocationPicker value={location} onChange={setLocation} compact />
              </div>
            </div>
          )}

          {/* Step 3: Guest Count */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-4">
                <h3 className="font-bold text-[#1b1b4e]">Guest Count</h3>
                <p className="text-xs text-stone-500">How many guests are expected at the event?</p>
                <label className="block"><span className="text-sm font-semibold text-[#1b1b4e]">Expected Guests</span>
                  <select className={inputClass} value={guestCount} onChange={e => setGuestCount(e.target.value)}>
                    <option value="">Select guest count</option>
                    {['Up to 50','50-100','100-200','200-300','300-500','500-750','750-1000','1000-1500','1500-2000','2000+'].map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select></label>
                {pkg.hall_capacity && guestCount && (
                  <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3">
                    <p className="text-xs text-violet-700">Venue capacity: {pkg.hall_capacity} guests</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Add-ons */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-4">
                <h3 className="font-bold text-[#1b1b4e]">Add-ons</h3>
                <p className="text-xs text-stone-500">Select optional extras for your event.</p>
                {addons.length > 0 ? (
                  <div className="space-y-2">
                    {addons.map((addon: any) => (
                      <label key={addon.id} className={`flex items-center justify-between rounded-xl border p-3.5 cursor-pointer transition ${
                        selectedAddonIds.includes(addon.id) ? 'border-violet-600 bg-violet-50' : 'border-[#e7d9c4] hover:border-violet-400'
                      }`}>
                        <div className="flex items-center gap-3">
                          <input type="checkbox" checked={selectedAddonIds.includes(addon.id)} onChange={() => toggleAddon(addon.id)}
                            className="h-4 w-4 rounded border-[#e7d9c4] text-violet-700 focus:ring-violet-700/20" />
                          <div><p className="text-sm font-semibold text-[#1b1b4e]">{addon.name}</p>
                            {addon.description && <p className="text-xs text-stone-500">{addon.description}</p>}</div>
                        </div>
                        <span className="text-sm font-bold text-violet-700">+₹{Number(addon.price).toLocaleString('en-IN')}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-stone-400 text-center py-4">No add-ons available for this venue.</p>
                )}
                {selectedAddonIds.length > 0 && (
                  <div className="rounded-xl border border-[#eadfcf] bg-[#faf8ff] p-3">
                    <p className="text-xs font-semibold text-stone-600">Add-ons total: <span className="text-violet-700">₹{addonsAmount.toLocaleString('en-IN')}</span></p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 5: Special Requirements */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-4">
                <h3 className="font-bold text-[#1b1b4e]">Special Requirements</h3>
                <label className="block"><span className="text-sm font-semibold text-[#1b1b4e]">Special Instructions</span>
                  <textarea className={`${inputClass} min-h-[100px] resize-y`} value={specialRequirements}
                    onChange={e => setSpecialRequirements(e.target.value)}
                    placeholder="Any specific requirements like setup time, decoration needs, catering arrangements, parking requirements..." /></label>
              </div>
            </div>
          )}

          {/* Step 6: Confirm */}
          {step === 6 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-3">
                <h3 className="font-bold text-[#1b1b4e]">Confirm Booking</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-stone-600">Venue</span><span className="font-semibold">{pkg.name}</span></div>
                  {pkg.venue_type && <div className="flex justify-between"><span className="text-stone-600">Type</span><span className="font-medium">{pkg.venue_type}</span></div>}
                  {eventDate && <div className="flex justify-between"><span className="text-stone-600">Date</span><span className="font-medium">{new Date(eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>}
                  {eventTime && <div className="flex justify-between"><span className="text-stone-600">Time</span><span className="font-medium">{eventTime}</span></div>}
                  {eventType && <div className="flex justify-between"><span className="text-stone-600">Event</span><span className="font-medium">{eventType}</span></div>}
                  {guestCount && <div className="flex justify-between"><span className="text-stone-600">Guests</span><span className="font-medium">{guestCount}</span></div>}
                  {pkg.address && <div className="flex justify-between"><span className="text-stone-600">Location</span><span className="font-medium text-right max-w-[180px] truncate">{pkg.address}</span></div>}
                </div>
                <div className="border-t border-[#eadfcf] pt-3 space-y-1.5">
                  <div className="flex justify-between text-sm"><span className="text-stone-600">Hall Rental</span><span>₹{baseAmount.toLocaleString('en-IN')}</span></div>
                  {addonsAmount > 0 && <div className="flex justify-between text-sm"><span className="text-stone-600">Add-ons</span><span>₹{addonsAmount.toLocaleString('en-IN')}</span></div>}
                  <div className="flex justify-between text-base font-bold border-t border-stone-100 pt-2"><span className="text-[#1b1b4e]">Total</span><span className="text-violet-700">₹{total.toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between text-xs text-stone-500"><span>Advance ({advancePercent}%)</span><span>₹{advanceAmount.toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between text-xs text-stone-500"><span>Remaining</span><span>₹{remaining.toLocaleString('en-IN')}</span></div>
                </div>
                <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4">
                  <p className="text-sm font-semibold text-violet-700 flex items-center gap-2"><Check className="h-4 w-4" />Ready to submit your booking</p>
                  <p className="mt-1 text-xs text-violet-600">The venue owner will review your request and confirm availability. You will be notified once they respond.</p>
                </div>
                <label className="flex items-start gap-3 cursor-pointer mt-4 rounded-xl border border-[#eadfcf] p-3">
                  <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-[#e7d9c4] text-violet-700 focus:ring-violet-700/20" />
                  <span className="text-xs text-stone-600">I agree to the booking terms. The venue owner will review my request and confirm availability. Advance payment will be required after confirmation.</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#eadfcf] bg-[#faf8ff]/95 px-5 py-4 backdrop-blur sm:px-7">
          <button type="button" onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="flex items-center gap-1.5 rounded-xl border border-[#d7c5ae] px-4 py-2.5 text-sm font-semibold text-[#1b1b4e] transition hover:bg-white">
            <ChevronLeft className="h-4 w-4" />{step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step < 6 ? (
            <button type="button" onClick={() => setStep(step + 1)}
              className="flex items-center gap-1.5 rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-800">
              Next<ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" disabled={busy || !termsAccepted} onClick={handleSubmit}
              className="rounded-xl bg-violet-700 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-800 disabled:opacity-60">
              {busy ? <><Loader2 className="mr-1.5 inline h-4 w-4 animate-spin" />Submitting…</> : 'Confirm Booking'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
