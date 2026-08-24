import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Video, Clock, Users, Check, ChevronDown, ChevronUp, X, ChevronLeft, ChevronRight, Loader2, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { NotificationService } from '@/services/notificationService';
import { toast } from 'sonner';
import LocationPicker, { type LocationData, validateLocationData, emptyLocationData } from '@/components/booking/LocationPicker';
import ScopedCartBar from '@/components/ScopedCartBar';

const inputClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition placeholder:text-stone-400 focus:border-[#8b1538] focus:ring-2 focus:ring-[#8b1538]/15';

export default function VideographyMenu({ provider, profile }: { provider: any; profile: any }) {
  const { user } = useAuth();
  const { addToCart, isInCart } = useCart();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [bookingPkg, setBookingPkg] = useState<any>(null);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['public-videography-packages', provider.id],
    queryFn: async () => {
      const r = await supabase.from('videography_packages' as any).select('*, videography_gallery(*)').eq('provider_id', provider.id).eq('status', 'active').order('created_at');
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });

  useEffect(() => {
    const channel = supabase.channel(`public-videography-${provider.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'videography_packages', filter: `provider_id=eq.${provider.id}` }, () => qc.invalidateQueries({ queryKey: ['public-videography-packages', provider.id] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [provider.id]);

  const toggle = (id: string) => setExpanded(s => ({ ...s, [id]: !s[id] }));
  const handleBook = (pkg: any) => {
    if (!user) { toast.error('Please log in to book'); return nav('/auth'); }
    setBookingPkg(pkg);
  };

  if (isLoading) return <div className="h-48 animate-pulse rounded-2xl bg-muted" />;
  if (!packages.length) return <div className="rounded-2xl border border-border/60 bg-surface-1 p-10 text-center text-sm text-muted-foreground">This videographer has not published any packages yet.</div>;

  return (
    <div className="space-y-5">
      <div><h2 className="text-xl font-bold">Videography Packages</h2><p className="text-sm text-muted-foreground">Browse packages and book your cinematic experience.</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        {packages.map((pkg: any) => {
          const isOpen = expanded[pkg.id];
          const teamSize = (pkg.team_videographers ?? 0) + (pkg.team_assistants ?? 0) + (pkg.team_drone_operator ?? 0);
          const price = pkg.starting_price || pkg.package_price || 0;
          const gallery = pkg.videography_gallery ?? [];
          const cover = gallery.find((g: any) => g.is_cover);
          return (
            <div key={pkg.id} className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm transition hover:shadow-md">
              <div className="relative h-36 bg-gradient-to-br from-indigo-50 to-purple-50 overflow-hidden">
                {cover ? (
                  <img src={cover.public_url} alt={pkg.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full items-center justify-center"><Video className="h-12 w-12 text-[#8b1538]/30" /></div>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-foreground leading-tight">{pkg.name}</h3>
                  <div className="text-right shrink-0"><p className="text-lg font-bold text-[#8b1538]">₹{Number(price).toLocaleString('en-IN')}</p><p className="text-xs text-muted-foreground">starting</p></div>
                </div>
                {pkg.description && <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{pkg.description}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {pkg.coverage_hours && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{pkg.coverage_hours}{pkg.coverage_hours !== 'Full Day' ? ' hrs' : ''}</span>}
                  {teamSize > 0 && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{teamSize} crew</span>}
                  {pkg.delivery_time && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Delivery: {pkg.delivery_time}</span>}
                </div>
                {(pkg.included_services ?? []).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {(pkg.included_services as string[]).slice(0, 5).map((s: string) => <span key={s} className="inline-flex items-center gap-0.5 rounded-full bg-[#8b1538]/8 px-2 py-0.5 text-[11px] font-medium text-[#8b1538]"><Check className="h-2.5 w-2.5" />{s}</span>)}
                    {pkg.included_services.length > 5 && <span className="text-[11px] text-muted-foreground">+{pkg.included_services.length - 5} more</span>}
                  </div>
                )}
                {isOpen && (
                  <div className="mt-3 space-y-3">
                    {(pkg.included_services ?? []).length > 5 && (
                      <div className="rounded-xl bg-secondary/50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-[#8b1538] mb-1">All Services</p><div className="flex flex-wrap gap-1">{(pkg.included_services as string[]).map((s: string) => <span key={s} className="rounded-full border border-[#e7d9c4] px-2 py-0.5 text-xs text-stone-600">{s}</span>)}</div></div>
                    )}
                    {(pkg.deliverables ?? []).length > 0 && (
                      <div className="rounded-xl bg-indigo-50/60 border border-indigo-100 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-indigo-700 mb-1">Deliverables</p><div className="flex flex-wrap gap-1">{(pkg.deliverables as string[]).map((d: string) => <span key={d} className="rounded-full border border-indigo-200 px-2 py-0.5 text-xs text-indigo-800">{d}</span>)}</div></div>
                    )}
                  </div>
                )}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button onClick={() => toggle(pkg.id)} className="rounded-xl border py-2 text-xs font-semibold flex items-center justify-center gap-1 transition hover:bg-secondary/50">
                    {isOpen ? <><ChevronUp className="h-3 w-3" />Hide</> : <><ChevronDown className="h-3 w-3" />Details</>}
                  </button>
                  <button onClick={() => handleBook(pkg)} className="rounded-xl bg-[#8B1538] py-2 text-xs font-semibold text-white transition hover:bg-[#70102d]">Book Now</button>
                </div>
                <button
                  onClick={() => { if (!user) { toast.error('Please log in'); return nav('/auth'); } addToCart({ packageId: pkg.id, providerId: provider.id, providerName: profile?.full_name || 'Artist', category: 'videography', packageTable: 'videography_packages', bookingTable: 'videography_bookings', packageName: pkg.name, price: Number(pkg.starting_price || pkg.package_price || 0), duration: pkg.coverage_hours || undefined, imageUrl: (pkg.videography_gallery ?? []).find((g: any) => g.is_cover)?.public_url || undefined }); }}
                  disabled={isInCart(pkg.id, 'videography')}
                  className="mt-2 w-full rounded-xl border border-[#8b1538]/20 bg-[#8b1538]/5 py-2 text-xs font-semibold text-[#8b1538] transition hover:bg-[#8b1538]/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <ShoppingCart className="h-3 w-3" />{isInCart(pkg.id, 'videography') ? 'In Cart' : 'Add to Cart'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <ScopedCartBar providerId={provider.id} category="videography" />
      {bookingPkg && <VideographyBookingModal isOpen={!!bookingPkg} onClose={() => setBookingPkg(null)} pkg={bookingPkg} provider={provider} />}
    </div>
  );
}

/* ─── Videography Booking Modal — Enhanced 5-Step Flow ─────────────────────── */
const EVENT_TYPES = ['Wedding', 'Reception', 'Engagement', 'Pre-Wedding', 'Birthday', 'Corporate', 'Sangeet', 'Haldi', 'Mehendi', 'Baby Shower', 'Private Party', 'Other'];
const SHOOTING_STYLES = ['Cinematic', 'Traditional', 'Candid', 'Documentary', 'Drone', 'Pre-Wedding', 'Highlight Film', 'Short Reels', 'Live Streaming'];

function VideographyBookingModal({ isOpen, onClose, pkg, provider }: { isOpen: boolean; onClose: () => void; pkg: any; provider: any }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  // Step 2 — Event Details
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventType, setEventType] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [eventDuration, setEventDuration] = useState('');

  // Step 3 — Location (new LocationPicker)
  const [location, setLocation] = useState<LocationData>(emptyLocationData);

  // Step 4 — Requirements
  const [specialRequirements, setSpecialRequirements] = useState('');
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);

  // Step 5 — Terms
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(1); setEventDate(''); setEventTime(''); setEventType('');
      setGuestCount(''); setEventDuration(''); setLocation(emptyLocationData);
      setSpecialRequirements(''); setSelectedStyles([]); setTermsAccepted(false);
    }
  }, [isOpen]);
  useEffect(() => { if (isOpen) document.body.style.overflow='hidden'; else document.body.style.overflow=''; return () => { document.body.style.overflow=''; }; }, [isOpen]);

  const baseAmount = Number(pkg.starting_price || pkg.package_price || 0);
  const advancePercent = Number(pkg.advance_percentage || 20);
  const advanceAmount = Math.round(baseAmount * advancePercent / 100);
  const remaining = baseAmount - advanceAmount;

  // Step validation before advancing
  const validateStep = (currentStep: number): boolean => {
    if (currentStep === 2) {
      if (!eventDate) { toast.error('Please select an event date'); return false; }
      if (!eventType) { toast.error('Please select an event type'); return false; }
      if (!eventTime) { toast.error('Please select an event time'); return false; }
    }
    if (currentStep === 3) {
      const locErr = validateLocationData(location);
      if (locErr) { toast.error(locErr); return false; }
    }
    return true;
  };

  const goNext = () => {
    if (validateStep(step)) setStep(step + 1);
  };

  const handleSubmit = async () => {
    if (!user) { toast.error('Please log in'); nav('/auth'); return; }
    if (!termsAccepted) { toast.error('Please accept the booking terms'); return; }
    setBusy(true);
    try {
      const { data: booking, error } = await supabase.from('videography_bookings' as any).insert({
        package_id: pkg.id, provider_id: provider.id, customer_id: user.id,
        event_date: eventDate, event_time: eventTime || null,
        event_type: eventType || null,
        venue: location.venue_name || location.locality || null,
        city: location.town_city || null,
        special_requirements: [
          selectedStyles.length ? `Styles: ${selectedStyles.join(', ')}` : '',
          specialRequirements
        ].filter(Boolean).join('\n') || null,
        base_amount: baseAmount, addons_amount: 0, total_amount: baseAmount,
        advance_amount: advanceAmount, remaining_amount: remaining,
        status: 'pending',
      }).select('id').single();
      if (error) throw error;

      // Save structured location to booking_locations
      await supabase.from('booking_locations' as any).insert({
        booking_table: 'videography_bookings', booking_id: booking.id,
        state: location.state, district: location.district, town_city: location.town_city,
        exact_address: [location.venue_name, location.locality, location.address_line].filter(Boolean).join(', '),
        pincode: location.pincode, landmark: location.address_line || null,
        latitude: location.latitude, longitude: location.longitude,
      });

      await NotificationService.notifyBookingReceived(user.id, provider.id, booking.id);
      sessionStorage.setItem('vowza_booking_success', JSON.stringify({
        bookingId: booking.id,
        artistName: provider.business_name || provider.contact_person || provider.stage_name || 'Videographer',
        eventDate, eventTime,
        venue: location.venue_name || location.locality || 'TBD',
        city: location.town_city || '',
        amount: baseAmount, advanceAmount, remainingBalance: remaining,
        eventType: eventType || 'Videography', status: 'pending',
      }));
      toast.success('Videography booking request sent!');
      onClose();
      nav('/booking-success');
    } catch (err: any) { toast.error(err.message || 'Could not create booking'); }
    finally { setBusy(false); }
  };

  if (!isOpen) return null;
  const STEPS = ['Package', 'Event Details', 'Location', 'Requirements', 'Review'];

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#250914]/65 p-3 backdrop-blur-sm sm:p-6">
      <div className="mx-auto my-3 max-w-2xl overflow-hidden rounded-[24px] bg-[#fffaf3] shadow-2xl">
        {/* Header */}
        <header className="flex items-start justify-between gap-4 bg-[#70102d] px-5 py-5 sm:px-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f4d58d]">Vowza Videography</p>
            <h2 className="mt-1 text-lg font-bold text-white">Book: {pkg.name}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-white/85 hover:bg-white/15"><X className="h-5 w-5" /></button>
        </header>

        {/* Stepper */}
        <div className="border-b border-[#eadfcf] bg-[#fffdfa] px-5 py-3 sm:px-7">
          <div className="flex items-center justify-between">
            {STEPS.map((label, i) => (
              <div key={i} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${step > i + 1 ? 'bg-emerald-500 text-white' : step === i + 1 ? 'bg-[#8b1538] text-white' : 'border-2 border-[#e7d9c4] text-stone-400'}`}>
                    {step > i + 1 ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <span className={`mt-1 text-[9px] font-medium hidden sm:block ${step === i + 1 ? 'text-[#8b1538]' : step > i + 1 ? 'text-emerald-600' : 'text-stone-400'}`}>{label}</span>
                </div>
                {i < 4 && <div className={`mx-1 h-0.5 w-4 sm:w-6 rounded ${step > i + 1 ? 'bg-emerald-400' : 'bg-[#e7d9c4]'}`} />}
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 sm:p-7 max-h-[60vh] overflow-y-auto">
          {/* STEP 1 — Package */}
          {step === 1 && (
            <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-[#3d1924]">{pkg.name}</h3>
                  {pkg.description && <p className="mt-1 text-sm text-muted-foreground">{pkg.description}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xl font-bold text-[#8b1538]">₹{baseAmount.toLocaleString('en-IN')}</p>
                  {pkg.coverage_hours && <p className="text-xs text-muted-foreground">{pkg.coverage_hours} coverage</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {pkg.coverage_hours && <div className="rounded-lg bg-stone-50 p-2.5"><p className="text-stone-500">Duration</p><p className="font-semibold text-[#3d1924]">{pkg.coverage_hours}</p></div>}
                {pkg.delivery_time && <div className="rounded-lg bg-stone-50 p-2.5"><p className="text-stone-500">Delivery</p><p className="font-semibold text-[#3d1924]">{pkg.delivery_time}</p></div>}
                <div className="rounded-lg bg-stone-50 p-2.5"><p className="text-stone-500">Advance</p><p className="font-semibold text-[#3d1924]">{advancePercent}% (₹{advanceAmount.toLocaleString('en-IN')})</p></div>
                {(pkg.team_videographers || pkg.team_assistants) && <div className="rounded-lg bg-stone-50 p-2.5"><p className="text-stone-500">Team</p><p className="font-semibold text-[#3d1924]">{(pkg.team_videographers||0)+(pkg.team_assistants||0)+(pkg.team_drone_operator||0)} members</p></div>}
              </div>
              {(pkg.included_services??[]).length > 0 && (
                <div><p className="text-xs font-semibold text-stone-600 mb-1.5">Included Services</p>
                  <div className="flex flex-wrap gap-1.5">{(pkg.included_services as string[]).map((s: string) => <span key={s} className="inline-flex items-center gap-0.5 rounded-full bg-[#8b1538]/8 px-2.5 py-1 text-[11px] font-medium text-[#8b1538]"><Check className="h-2.5 w-2.5" />{s}</span>)}</div>
                </div>
              )}
              {(pkg.deliverables??[]).length > 0 && (
                <div><p className="text-xs font-semibold text-stone-600 mb-1.5">Deliverables</p>
                  <div className="flex flex-wrap gap-1.5">{(pkg.deliverables as string[]).map((d: string) => <span key={d} className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700">{d}</span>)}</div>
                </div>
              )}
            </div>
          )}
          {/* STEP 2 — Event Details */}
          {step === 2 && (
            <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-4">
              <h3 className="font-bold text-[#3d1924]">Tell us about your event</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="text-sm font-semibold text-[#3d1924]">Event Date <span className="text-red-500">*</span></span>
                  <input type="date" className={inputClass} value={eventDate} onChange={e => setEventDate(e.target.value)} min={new Date().toISOString().split('T')[0]} /></label>
                <label className="block"><span className="text-sm font-semibold text-[#3d1924]">Event Time <span className="text-red-500">*</span></span>
                  <input type="time" className={inputClass} value={eventTime} onChange={e => setEventTime(e.target.value)} /></label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="text-sm font-semibold text-[#3d1924]">Event Type <span className="text-red-500">*</span></span>
                  <select className={inputClass} value={eventType} onChange={e => setEventType(e.target.value)}>
                    <option value="">Select event type</option>
                    {EVENT_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
                  </select></label>
                <label className="block"><span className="text-sm font-semibold text-[#3d1924]">Expected Guests <span className="text-stone-400 font-normal">(optional)</span></span>
                  <input type="number" className={inputClass} value={guestCount} onChange={e => setGuestCount(e.target.value)} placeholder="e.g. 200" min="1" /></label>
              </div>
              <label className="block"><span className="text-sm font-semibold text-[#3d1924]">Event Duration <span className="text-stone-400 font-normal">(optional)</span></span>
                <select className={inputClass} value={eventDuration} onChange={e => setEventDuration(e.target.value)}>
                  <option value="">Select duration</option>
                  <option value="2-4 hours">2–4 Hours</option>
                  <option value="Half Day">Half Day (4–6 Hours)</option>
                  <option value="Full Day">Full Day (8–12 Hours)</option>
                  <option value="Multi-Day">Multi-Day Event</option>
                </select></label>
            </div>
          )}
          {/* STEP 3 — Location */}
          {step === 3 && (
            <div className="rounded-2xl border border-[#eadfcf] bg-white p-5">
              <LocationPicker value={location} onChange={setLocation} />
            </div>
          )}
          {/* STEP 4 — Requirements */}
          {step === 4 && (
            <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-4">
              <h3 className="font-bold text-[#3d1924]">Any special requirements?</h3>
              <div>
                <p className="text-sm font-semibold text-[#3d1924] mb-2">Preferred Shooting Styles</p>
                <div className="flex flex-wrap gap-2">
                  {SHOOTING_STYLES.map(style => (
                    <button key={style} type="button"
                      onClick={() => setSelectedStyles(prev => prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style])}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium border transition ${selectedStyles.includes(style) ? 'bg-[#8b1538] text-white border-[#8b1538]' : 'bg-white text-stone-600 border-[#e7d9c4] hover:border-[#8b1538]/40'}`}>
                      {selectedStyles.includes(style) && <Check className="inline h-3 w-3 mr-1" />}{style}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block"><span className="text-sm font-semibold text-[#3d1924]">Additional Instructions <span className="text-stone-400 font-normal">(optional)</span></span>
                <textarea className={`${inputClass} min-h-[100px] resize-y`} value={specialRequirements} onChange={e => setSpecialRequirements(e.target.value)}
                  placeholder="Tell the videographer about specific scenes, drone requirements, delivery format, important moments to capture, references..." /></label>
            </div>
          )}
          {/* STEP 5 — Review & Submit */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-4">
                <h3 className="font-bold text-[#3d1924] text-base">Booking Summary</h3>
                {/* Vendor + Package */}
                <div className="rounded-xl bg-stone-50 p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-stone-500">Vendor</span><span className="font-semibold text-[#3d1924]">{provider.business_name || provider.contact_person || provider.stage_name || 'Videographer'}</span></div>
                  <div className="flex justify-between"><span className="text-stone-500">Package</span><span className="font-semibold text-[#3d1924]">{pkg.name}</span></div>
                  {pkg.coverage_hours && <div className="flex justify-between"><span className="text-stone-500">Duration</span><span className="font-medium">{pkg.coverage_hours}</span></div>}
                </div>
                {/* Event Details */}
                <div className="rounded-xl bg-stone-50 p-3 space-y-1.5 text-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-stone-400 mb-1">Event Details</p>
                  <div className="flex justify-between"><span className="text-stone-500">Date</span><span className="font-medium">{eventDate ? new Date(eventDate).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}) : '—'}</span></div>
                  {eventTime && <div className="flex justify-between"><span className="text-stone-500">Time</span><span className="font-medium">{eventTime}</span></div>}
                  <div className="flex justify-between"><span className="text-stone-500">Event Type</span><span className="font-medium">{eventType || '—'}</span></div>
                  {guestCount && <div className="flex justify-between"><span className="text-stone-500">Guests</span><span className="font-medium">~{guestCount}</span></div>}
                  {eventDuration && <div className="flex justify-between"><span className="text-stone-500">Duration</span><span className="font-medium">{eventDuration}</span></div>}
                </div>
                {/* Location */}
                <div className="rounded-xl bg-stone-50 p-3 space-y-1.5 text-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-stone-400 mb-1">Location</p>
                  {location.venue_name && <div className="flex justify-between"><span className="text-stone-500">Venue</span><span className="font-medium text-right max-w-[200px]">{location.venue_name}</span></div>}
                  {location.locality && <div className="flex justify-between"><span className="text-stone-500">Area</span><span className="font-medium">{location.locality}</span></div>}
                  <div className="flex justify-between"><span className="text-stone-500">Town/City</span><span className="font-medium">{location.town_city||'—'}</span></div>
                  <div className="flex justify-between"><span className="text-stone-500">District</span><span className="font-medium">{location.district||'—'}</span></div>
                  <div className="flex justify-between"><span className="text-stone-500">State</span><span className="font-medium">{location.state||'—'}</span></div>
                  <div className="flex justify-between"><span className="text-stone-500">Pincode</span><span className="font-medium">{location.pincode||'—'}</span></div>
                  {location.latitude && location.longitude && (
                    <a href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}&z=15`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1">📍 View on Map</a>
                  )}
                </div>
                {/* Requirements */}
                {(selectedStyles.length > 0 || specialRequirements) && (
                  <div className="rounded-xl bg-stone-50 p-3 space-y-1.5 text-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-stone-400 mb-1">Requirements</p>
                    {selectedStyles.length > 0 && <div className="flex flex-wrap gap-1">{selectedStyles.map(s => <span key={s} className="rounded-full bg-[#8b1538]/10 px-2 py-0.5 text-[11px] text-[#8b1538]">{s}</span>)}</div>}
                    {specialRequirements && <p className="text-xs text-stone-600 whitespace-pre-line">{specialRequirements}</p>}
                  </div>
                )}
              </div>
              {/* Price Summary */}
              <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Price Summary</p>
                <div className="flex justify-between text-sm"><span className="text-stone-600">Package Price</span><span className="font-medium">₹{baseAmount.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between text-sm"><span className="text-stone-600">Platform Fee</span><span className="font-medium">₹0</span></div>
                <div className="flex justify-between text-base font-bold border-t border-stone-200 pt-2 mt-2"><span className="text-[#3d1924]">Total</span><span className="text-[#8b1538]">₹{baseAmount.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between text-xs text-stone-500"><span>Advance ({advancePercent}%)</span><span>₹{advanceAmount.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between text-xs text-stone-500"><span>Remaining (after acceptance)</span><span>₹{remaining.toLocaleString('en-IN')}</span></div>
              </div>
              {/* Confirmation */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                <p className="text-sm font-semibold text-emerald-700 flex items-center gap-2"><Check className="h-4 w-4" />Ready to submit</p>
                <p className="mt-1 text-xs text-emerald-600">The videographer will review your request and confirm availability. Advance payment is required only after they accept.</p>
              </div>
              <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-[#eadfcf] p-3">
                <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-[#e7d9c4] text-[#8b1538] accent-[#8b1538]" />
                <span className="text-xs text-stone-600">I agree to the booking terms. Advance payment will be required after the videographer accepts my booking request.</span>
              </label>
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between border-t border-[#eadfcf] bg-[#fffdfa]/95 px-5 py-4 backdrop-blur sm:px-7">
          <button type="button" onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="flex items-center gap-1.5 rounded-xl border border-[#d7c5ae] px-4 py-2.5 text-sm font-semibold text-[#5a3440] hover:bg-white transition">
            <ChevronLeft className="h-4 w-4" />{step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step < 5 ? (
            <button type="button" onClick={goNext}
              className="flex items-center gap-1.5 rounded-xl bg-[#8b1538] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#70102d] transition">
              Next<ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" disabled={busy || !termsAccepted} onClick={handleSubmit}
              className="rounded-xl bg-[#8b1538] px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#70102d] disabled:opacity-60 transition">
              {busy ? <><Loader2 className="mr-1.5 inline h-4 w-4 animate-spin" />Submitting…</> : 'Confirm Booking'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
