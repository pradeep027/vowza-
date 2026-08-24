import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Music, Clock, Users, Check, ChevronDown, ChevronUp, X, ChevronLeft, ChevronRight, Loader2, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { NotificationService } from '@/services/notificationService';
import { toast } from 'sonner';
import LocationPicker, { type LocationData, validateLocationData, emptyLocationData } from '@/components/booking/LocationPicker';
import ScopedCartBar from '@/components/ScopedCartBar';

const EVENT_TYPES = ['Wedding','Sangeet','Reception','Engagement','Birthday','Corporate','Cultural Event','College Fest','Private Party','Other'];
const inputClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition placeholder:text-stone-400 focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/15';

export default function DancerMenu({ provider, profile }: { provider: any; profile: any }) {
  const { user } = useAuth();
  const { addToCart, isInCart } = useCart();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [bookingPkg, setBookingPkg] = useState<any>(null);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['public-dancer-packages', provider.id],
    queryFn: async () => {
      const r = await supabase.from('dancer_packages' as any).select('*, dancer_gallery(*)').eq('provider_id', provider.id).eq('status', 'active').order('created_at');
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase.channel(`public-dancer-${provider.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dancer_packages', filter: `provider_id=eq.${provider.id}` }, () => qc.invalidateQueries({ queryKey: ['public-dancer-packages', provider.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [provider.id]);

  const toggle = (id: string) => setExpanded(s => ({ ...s, [id]: !s[id] }));
  const handleBook = (pkg: any) => {
    if (!user) { toast.error('Please log in to book'); return nav('/auth'); }
    setBookingPkg(pkg);
  };

  if (isLoading) return <div className="h-48 animate-pulse rounded-2xl bg-muted" />;
  if (!packages.length) return <div className="rounded-2xl border border-border/60 bg-surface-1 p-10 text-center text-sm text-muted-foreground">This dancer has not published any packages yet.</div>;

  return (
    <div className="space-y-5">
      <div><h2 className="text-xl font-bold">Dance Packages</h2><p className="text-sm text-muted-foreground">Browse performance packages and book.</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        {packages.map((pkg: any) => {
          const isOpen = expanded[pkg.id];
          const price = Number(pkg.package_price || 0);
          const gallery = pkg.dancer_gallery ?? [];
          const cover = gallery.find((g: any) => g.is_cover);
          return (
            <div key={pkg.id} className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm transition hover:shadow-md">
              <div className="relative h-32 bg-gradient-to-br from-purple-50 to-violet-100 overflow-hidden">
                {cover ? (
                  <img src={cover.public_url} alt={pkg.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full items-center justify-center"><Music className="h-10 w-10 text-[#7c3aed]/30" /></div>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-foreground leading-tight">{pkg.name}</h3>
                    {pkg.dance_type && <p className="text-xs text-purple-600 font-medium mt-0.5">{pkg.dance_type}</p>}
                  </div>
                  <div className="text-right shrink-0"><p className="text-lg font-bold text-[#7c3aed]">₹{price.toLocaleString('en-IN')}</p></div>
                </div>
                {pkg.description && <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{pkg.description}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {pkg.team_size > 1 && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{pkg.team_size} dancers</span>}
                  {pkg.duration && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{pkg.duration}</span>}
                  {pkg.package_type && <span>{pkg.package_type}</span>}
                </div>
                {(pkg.services_included ?? []).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {(pkg.services_included as string[]).slice(0, 4).map((s: string) => <span key={s} className="inline-flex items-center gap-0.5 rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700"><Check className="h-2.5 w-2.5" />{s}</span>)}
                    {pkg.services_included.length > 4 && <span className="text-[11px] text-muted-foreground">+{pkg.services_included.length - 4} more</span>}
                  </div>
                )}
                {isOpen && (pkg.services_included ?? []).length > 4 && (
                  <div className="mt-2 flex flex-wrap gap-1">{(pkg.services_included as string[]).map((s: string) => <span key={s} className="rounded-full border border-purple-200 px-2 py-0.5 text-xs text-purple-700">{s}</span>)}</div>
                )}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button onClick={() => toggle(pkg.id)} className="rounded-xl border py-2 text-xs font-semibold flex items-center justify-center gap-1 transition hover:bg-secondary/50">
                    {isOpen ? <><ChevronUp className="h-3 w-3" />Hide</> : <><ChevronDown className="h-3 w-3" />Details</>}
                  </button>
                  <button onClick={() => handleBook(pkg)} className="rounded-xl bg-[#7c3aed] py-2 text-xs font-semibold text-white transition hover:bg-[#6d28d9]">Book Now</button>
                </div>
                <button
                  onClick={() => { if (!user) { toast.error('Please log in'); return nav('/auth'); } addToCart({ packageId: pkg.id, providerId: provider.id, providerName: profile?.full_name || 'Artist', category: 'dancer', packageTable: 'dancer_packages', bookingTable: 'dancer_bookings', packageName: pkg.name, price: Number(pkg.package_price || 0), duration: pkg.duration || undefined, imageUrl: (pkg.dancer_gallery ?? []).find((g: any) => g.is_cover)?.public_url || undefined }); }}
                  disabled={isInCart(pkg.id, 'dancer')}
                  className="mt-2 w-full rounded-xl border border-purple-200 bg-purple-50 py-2 text-xs font-semibold text-purple-700 transition hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <ShoppingCart className="h-3 w-3" />{isInCart(pkg.id, 'dancer') ? 'In Cart' : 'Add to Cart'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <ScopedCartBar providerId={provider.id} category="dancer" />
      {bookingPkg && <DancerBookingModal isOpen={!!bookingPkg} onClose={() => setBookingPkg(null)} pkg={bookingPkg} provider={provider} />}
    </div>
  );
}


/* ─── Dancer Booking Modal ─────────────────────────────────────────────────── */
function DancerBookingModal({ isOpen, onClose, pkg, provider }: { isOpen: boolean; onClose: () => void; pkg: any; provider: any }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventType, setEventType] = useState('');
  const [numberOfDancers, setNumberOfDancers] = useState(String(pkg.team_size || 1));
  const [performanceDuration, setPerformanceDuration] = useState(pkg.duration || '');
  const [location, setLocation] = useState<LocationData>(emptyLocationData);
  const [specialRequirements, setSpecialRequirements] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    if (isOpen) { setStep(1); setEventDate(''); setEventTime(''); setEventType(''); setNumberOfDancers(String(pkg.team_size || 1)); setPerformanceDuration(pkg.duration || ''); setLocation(emptyLocationData); setSpecialRequirements(''); setTermsAccepted(false); }
  }, [isOpen]);
  useEffect(() => { if (isOpen) document.body.style.overflow = 'hidden'; else document.body.style.overflow = ''; return () => { document.body.style.overflow = ''; }; }, [isOpen]);

  const baseAmount = Number(pkg.package_price || 0);
  const advancePercent = Number(pkg.advance_percentage || 20);
  const advanceAmount = Math.round(baseAmount * advancePercent / 100);
  const remaining = baseAmount - advanceAmount;

  const validateStep = (s: number): boolean => {
    if (s === 2) {
      if (!eventDate) { toast.error('Please select an event date'); return false; }
      if (!eventTime) { toast.error('Please select an event time'); return false; }
      if (!eventType) { toast.error('Please select an event type'); return false; }
    }
    if (s === 3) {
      const locErr = validateLocationData(location);
      if (locErr) { toast.error(locErr); return false; }
    }
    return true;
  };
  const goNext = () => { if (validateStep(step)) setStep(step + 1); };

  const handleSubmit = async () => {
    if (!user) { toast.error('Please log in'); nav('/auth'); return; }
    if (!termsAccepted) { toast.error('Please accept booking terms'); return; }
    setBusy(true);
    try {
      const { data: booking, error } = await supabase.from('dancer_bookings' as any).insert({
        package_id: pkg.id, provider_id: provider.id, customer_id: user.id,
        event_date: eventDate, event_time: eventTime || null,
        event_type: eventType || null,
        venue: location.venue_name || location.locality || null,
        city: location.town_city || null,
        dance_type: pkg.dance_type || null,
        number_of_dancers: Number(numberOfDancers) || 1,
        performance_duration: performanceDuration || null,
        special_requirements: specialRequirements || null,
        selected_addon_ids: [],
        base_amount: baseAmount, addons_amount: 0, total_amount: baseAmount,
        advance_amount: advanceAmount, remaining_amount: remaining,
        status: 'pending',
      }).select('id').single();
      if (error) throw error;

      // Save structured location
      await supabase.from('booking_locations' as any).insert({
        booking_table: 'dancer_bookings', booking_id: booking.id,
        state: location.state, district: location.district, town_city: location.town_city,
        exact_address: [location.venue_name, location.locality, location.address_line].filter(Boolean).join(', '),
        pincode: location.pincode, landmark: location.address_line || null,
        latitude: location.latitude, longitude: location.longitude,
      });

      await NotificationService.notifyBookingReceived(user.id, provider.id, booking.id);
      sessionStorage.setItem('vowza_booking_success', JSON.stringify({
        bookingId: booking.id, artistName: provider.business_name || provider.contact_person || provider.stage_name || 'Dancer',
        eventDate, eventTime, venue: location.venue_name || location.locality || 'TBD', city: location.town_city || '',
        amount: baseAmount, advanceAmount, remainingBalance: remaining,
        eventType: eventType || pkg.dance_type || 'Dance Performance', status: 'pending',
      }));
      toast.success('Dance booking request sent!'); onClose(); nav('/booking-success');
    } catch (err: any) { toast.error(err.message || 'Could not create booking'); }
    finally { setBusy(false); }
  };

  if (!isOpen) return null;
  const STEPS = ['Package', 'Event Details', 'Location', 'Requirements', 'Review'];

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#250914]/65 p-3 backdrop-blur-sm sm:p-6">
      <div className="mx-auto my-3 max-w-2xl overflow-hidden rounded-[24px] bg-[#fffaf3] shadow-2xl">
        <header className="flex items-start justify-between gap-4 bg-[#5b21b6] px-5 py-5 sm:px-7">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-purple-200">Vowza Dance</p><h2 className="mt-1 text-lg font-bold text-white">Book: {pkg.name}</h2></div>
          <button onClick={onClose} className="rounded-full p-2 text-white/85 hover:bg-white/15"><X className="h-5 w-5" /></button>
        </header>

        {/* Stepper */}
        <div className="border-b border-[#eadfcf] bg-[#fffdfa] px-5 py-3 sm:px-7">
          <div className="flex items-center justify-between">
            {STEPS.map((label, i) => (
              <div key={i} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${step > i + 1 ? 'bg-emerald-500 text-white' : step === i + 1 ? 'bg-[#7c3aed] text-white' : 'border-2 border-[#e7d9c4] text-stone-400'}`}>
                    {step > i + 1 ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <span className={`mt-1 text-[9px] font-medium hidden sm:block ${step === i + 1 ? 'text-[#7c3aed]' : step > i + 1 ? 'text-emerald-600' : 'text-stone-400'}`}>{label}</span>
                </div>
                {i < 4 && <div className={`mx-1 h-0.5 w-4 sm:w-6 rounded ${step > i + 1 ? 'bg-emerald-400' : 'bg-[#e7d9c4]'}`} />}
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 sm:p-7 max-h-[60vh] overflow-y-auto">
          {/* Step 1: Package */}
          {step === 1 && (
            <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div><h3 className="text-lg font-bold text-[#3d1924]">{pkg.name}</h3>{pkg.description && <p className="mt-1 text-sm text-muted-foreground">{pkg.description}</p>}</div>
                <p className="text-xl font-bold text-[#7c3aed] shrink-0">₹{baseAmount.toLocaleString('en-IN')}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {pkg.dance_type && <div className="rounded-lg bg-purple-50 p-2.5"><p className="text-stone-500">Dance Type</p><p className="font-semibold text-[#3d1924]">{pkg.dance_type}</p></div>}
                {pkg.duration && <div className="rounded-lg bg-purple-50 p-2.5"><p className="text-stone-500">Duration</p><p className="font-semibold text-[#3d1924]">{pkg.duration}</p></div>}
                {pkg.team_size > 1 && <div className="rounded-lg bg-purple-50 p-2.5"><p className="text-stone-500">Team</p><p className="font-semibold text-[#3d1924]">{pkg.team_size} dancers</p></div>}
                <div className="rounded-lg bg-purple-50 p-2.5"><p className="text-stone-500">Advance</p><p className="font-semibold text-[#3d1924]">{advancePercent}%</p></div>
              </div>
              {(pkg.services_included ?? []).length > 0 && (
                <div><p className="text-xs font-semibold text-stone-600 mb-1">Services:</p><div className="flex flex-wrap gap-1">{(pkg.services_included as string[]).map((s: string) => <span key={s} className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] text-purple-700">{s}</span>)}</div></div>
              )}
            </div>
          )}

          {/* Step 2: Event Details */}
          {step === 2 && (
            <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-4">
              <h3 className="font-bold text-[#3d1924]">Event Details</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="text-sm font-semibold text-[#3d1924]">Event Date <span className="text-red-500">*</span></span>
                  <input type="date" className={inputClass} value={eventDate} onChange={e => setEventDate(e.target.value)} min={new Date().toISOString().split('T')[0]} /></label>
                <label className="block"><span className="text-sm font-semibold text-[#3d1924]">Event Time <span className="text-red-500">*</span></span>
                  <input type="time" className={inputClass} value={eventTime} onChange={e => setEventTime(e.target.value)} /></label>
              </div>
              <label className="block"><span className="text-sm font-semibold text-[#3d1924]">Event Type <span className="text-red-500">*</span></span>
                <select className={inputClass} value={eventType} onChange={e => setEventType(e.target.value)}>
                  <option value="">Select event type</option>
                  {EVENT_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
                </select></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="text-sm font-semibold text-[#3d1924]">Number of Dancers</span>
                  <input type="number" className={inputClass} min="1" value={numberOfDancers} onChange={e => setNumberOfDancers(e.target.value)} /></label>
                <label className="block"><span className="text-sm font-semibold text-[#3d1924]">Performance Duration</span>
                  <input className={inputClass} value={performanceDuration} onChange={e => setPerformanceDuration(e.target.value)} placeholder="e.g. 30 Minutes, 1 Hour" /></label>
              </div>
            </div>
          )}

          {/* Step 3: Location */}
          {step === 3 && (
            <div className="rounded-2xl border border-[#eadfcf] bg-white p-5">
              <LocationPicker value={location} onChange={setLocation} />
            </div>
          )}

          {/* Step 4: Requirements */}
          {step === 4 && (
            <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-4">
              <h3 className="font-bold text-[#3d1924]">Special Requirements</h3>
              <label className="block"><span className="text-sm font-semibold text-[#3d1924]">Instructions for the dancer</span>
                <textarea className={`${inputClass} min-h-[100px] resize-y`} value={specialRequirements} onChange={e => setSpecialRequirements(e.target.value)}
                  placeholder="Song preferences, choreography style, costume requirements, stage setup, entry style, any specific dance moves..." /></label>
            </div>
          )}

          {/* Step 5: Review */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-4">
                <h3 className="font-bold text-[#3d1924]">Booking Summary</h3>
                <div className="rounded-xl bg-stone-50 p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-stone-500">Dancer</span><span className="font-semibold">{provider.business_name || provider.contact_person || provider.stage_name || 'Dancer'}</span></div>
                  <div className="flex justify-between"><span className="text-stone-500">Package</span><span className="font-semibold">{pkg.name}</span></div>
                  {pkg.dance_type && <div className="flex justify-between"><span className="text-stone-500">Dance Type</span><span className="font-medium">{pkg.dance_type}</span></div>}
                  {numberOfDancers && <div className="flex justify-between"><span className="text-stone-500">Dancers</span><span className="font-medium">{numberOfDancers}</span></div>}
                  {performanceDuration && <div className="flex justify-between"><span className="text-stone-500">Duration</span><span className="font-medium">{performanceDuration}</span></div>}
                </div>
                <div className="rounded-xl bg-stone-50 p-3 space-y-1.5 text-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-stone-400 mb-1">Event</p>
                  <div className="flex justify-between"><span className="text-stone-500">Date</span><span className="font-medium">{eventDate ? new Date(eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</span></div>
                  {eventTime && <div className="flex justify-between"><span className="text-stone-500">Time</span><span className="font-medium">{eventTime}</span></div>}
                  <div className="flex justify-between"><span className="text-stone-500">Event</span><span className="font-medium">{eventType || '—'}</span></div>
                </div>
                <div className="rounded-xl bg-stone-50 p-3 space-y-1.5 text-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-stone-400 mb-1">Location</p>
                  {location.venue_name && <div className="flex justify-between"><span className="text-stone-500">Venue</span><span className="font-medium">{location.venue_name}</span></div>}
                  {location.town_city && <div className="flex justify-between"><span className="text-stone-500">City</span><span className="font-medium">{location.town_city}</span></div>}
                  {location.district && <div className="flex justify-between"><span className="text-stone-500">District</span><span className="font-medium">{location.district}</span></div>}
                  {location.state && <div className="flex justify-between"><span className="text-stone-500">State</span><span className="font-medium">{location.state}</span></div>}
                  {location.pincode && <div className="flex justify-between"><span className="text-stone-500">Pincode</span><span className="font-medium">{location.pincode}</span></div>}
                </div>
                {specialRequirements && (
                  <div className="rounded-xl bg-stone-50 p-3 text-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-stone-400 mb-1">Requirements</p>
                    <p className="text-xs text-stone-600 whitespace-pre-line">{specialRequirements}</p>
                  </div>
                )}
              </div>
              {/* Price */}
              <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-stone-600">Package Price</span><span className="font-medium">₹{baseAmount.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between text-base font-bold border-t border-stone-200 pt-2 mt-2"><span className="text-[#3d1924]">Total</span><span className="text-[#7c3aed]">₹{baseAmount.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between text-xs text-stone-500"><span>Advance ({advancePercent}%)</span><span>₹{advanceAmount.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between text-xs text-stone-500"><span>Remaining</span><span>₹{remaining.toLocaleString('en-IN')}</span></div>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                <p className="text-sm font-semibold text-emerald-700 flex items-center gap-2"><Check className="h-4 w-4" />Ready to submit</p>
                <p className="mt-1 text-xs text-emerald-600">The dancer will review your request and confirm availability.</p>
              </div>
              <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-[#eadfcf] p-3">
                <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-[#e7d9c4] text-[#7c3aed] accent-[#7c3aed]" />
                <span className="text-xs text-stone-600">I agree to the booking terms. Advance payment will be required after the dancer accepts.</span>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#eadfcf] bg-[#fffdfa]/95 px-5 py-4 backdrop-blur sm:px-7">
          <button type="button" onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="flex items-center gap-1.5 rounded-xl border border-[#d7c5ae] px-4 py-2.5 text-sm font-semibold text-[#5a3440] hover:bg-white transition">
            <ChevronLeft className="h-4 w-4" />{step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step < 5 ? (
            <button type="button" onClick={goNext}
              className="flex items-center gap-1.5 rounded-xl bg-[#7c3aed] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#6d28d9] transition">
              Next<ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" disabled={busy || !termsAccepted} onClick={handleSubmit}
              className="rounded-xl bg-[#7c3aed] px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#6d28d9] disabled:opacity-60 transition">
              {busy ? <><Loader2 className="mr-1.5 inline h-4 w-4 animate-spin" />Submitting…</> : 'Confirm Booking'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
