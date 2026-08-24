// ─── CateringBookingModal — Full production booking flow ──────────────────────
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import LocationPicker, { type LocationData, validateLocationData, emptyLocationData } from '@/components/booking/LocationPicker';
import {
  X, ChevronLeft, ChevronRight, Check, Loader2,
  Utensils, Users, Calendar, MapPin, Clock,
  Star, Leaf, Plus, Minus, Images, AlertCircle,
} from 'lucide-react';

/* ─── Types ───────────────────────────────────────────────────────────────── */
interface CateringBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  pkg: any;
  provider: any;
  gallery: any[];
  menuSections: { name: string; items: any[] }[];
  addons: any[];
}

interface EventDetails {
  eventType: string;
  eventDate: string;
  eventTime: string;
  duration: string;
  venueName: string;
  venueAddress: string;
  city: string;
  state: string;
  pincode: string;
}

const EVENT_TYPES = [
  'Wedding', 'Reception', 'Engagement', 'Birthday', 'Corporate',
  'Haldi', 'Sangeet', 'Baby Shower', 'Housewarming', 'Anniversary',
  'College Fest', 'Private Party', 'Temple Event', 'Other',
];

const STEP_LABELS = ['Package', 'Event Details', 'Guests', 'Menu & Add-ons', 'Requests', 'Summary', 'Review Cart'];

const inputClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition placeholder:text-stone-400 focus:border-[#8b1538] focus:ring-2 focus:ring-[#8b1538]/15';

/* ─── Main Component ──────────────────────────────────────────────────────── */
export default function CateringBookingModal({ isOpen, onClose, pkg, provider, gallery, menuSections, addons }: CateringBookingModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [busy] = useState(false);

  // Event details
  const [event, setEvent] = useState<EventDetails>({
    eventType: '', eventDate: '', eventTime: '', duration: '4 Hours',
    venueName: '', venueAddress: '', city: '', state: '', pincode: '',
  });

  // Location (structured)
  const [location, setLocation] = useState<LocationData>(emptyLocationData);

  // Guest & pricing
  const [guestCount, setGuestCount] = useState('');
  const [guestError, setGuestError] = useState('');

  // Add-ons selection
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);

  // Special requests
  const [specialRequests, setSpecialRequests] = useState('');
  const [dietaryPrefs, setDietaryPrefs] = useState<string[]>([]);

  // Terms
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Menu acknowledgement (when no menu/addons configured)
  const [menuAcknowledged, setMenuAcknowledged] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setEvent({ eventType: '', eventDate: '', eventTime: '', duration: '4 Hours', venueName: '', venueAddress: '', city: '', state: '', pincode: '' });
      setLocation(emptyLocationData);
      setGuestCount('');
      setGuestError('');
      setSelectedAddonIds([]);
      setSpecialRequests('');
      setDietaryPrefs([]);
      setTermsAccepted(false);
      setMenuAcknowledged(false);
      setErrors({});
    }
  }, [isOpen]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // ─── Calculations ──────────────────────────────────────────────────────
  const guests = parseInt(guestCount) || 0;
  const pricePerPlate = Number(pkg.price_per_plate) || 0;
  const baseAmount = guests * pricePerPlate;
  const selectedAddons = addons.filter(a => selectedAddonIds.includes(a.id));
  const addonsAmount = selectedAddons.reduce((sum, a) => sum + (Number(a.price) || 0), 0);
  const grandTotal = baseAmount + addonsAmount;
  const advancePercent = 20;
  const advanceAmount = Math.round(grandTotal * (advancePercent / 100));
  const remainingBalance = grandTotal - advanceAmount;

  // ─── Validations ───────────────────────────────────────────────────────
  const validateEventDetails = (): boolean => {
    const e: Record<string, string> = {};
    if (!event.eventDate) e.eventDate = 'Event date is required';
    else {
      const selected = new Date(event.eventDate);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (selected < today) e.eventDate = 'Date must be in the future';
    }
    const locErr = validateLocationData(location);
    if (locErr) e.location = locErr;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateGuests = (): boolean => {
    const min = pkg.min_guests || 1;
    const max = pkg.max_guests || 99999;
    if (!guestCount || guests <= 0) { setGuestError('Please enter guest count'); return false; }
    if (guests < min) { setGuestError(`Minimum ${min} guests required`); return false; }
    if (guests > max) { setGuestError(`Maximum ${max} guests allowed`); return false; }
    setGuestError('');
    return true;
  };

  // ─── Navigation ────────────────────────────────────────────────────────
  const goNext = () => {
    if (step === 2 && !validateEventDetails()) return;
    if (step === 3 && !validateGuests()) return;
    if (step === 4 && menuSections.length === 0 && addons.length === 0 && !menuAcknowledged) {
      toast.error('Please acknowledge before continuing.');
      return;
    }
    if (step < 7) setStep(step + 1);
  };
  const goBack = () => { if (step > 1) setStep(step - 1); };

  // ─── Submit Booking ────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!user) { toast.error('Please log in to book'); navigate('/auth'); return; }
    if (!termsAccepted) { toast.error('Please accept the terms'); return; }

    // Store all cart data in sessionStorage and navigate to full cart review page
    sessionStorage.setItem('vowza_catering_cart', JSON.stringify({
      pkg, provider, gallery, menuSections, addons,
      event: { ...event, venueName: location.venue_name, venueAddress: [location.venue_name, location.locality, location.address_line].filter(Boolean).join(', '), city: location.town_city, state: location.state, pincode: location.pincode },
      location,
      guestCount: guests, selectedAddonIds, specialRequests, dietaryPrefs,
    }));

    onClose();
    navigate('/catering-cart');
  };

  // ─── Toggle addon ──────────────────────────────────────────────────────
  const toggleAddon = (id: string) => {
    setSelectedAddonIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // ─── Dietary prefs toggle ─────────────────────────────────────────────
  const DIETARY_OPTIONS = ['Jain Counter', 'No Onion/Garlic', 'Kids Menu', 'Extra Spicy', 'Separate Buffet', 'Sugar Free Options', 'Gluten Free'];
  const toggleDietary = (opt: string) => {
    setDietaryPrefs(prev => prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt]);
  };

  if (!isOpen) return null;

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#250914]/65 p-3 backdrop-blur-sm sm:p-6">
      <div className="mx-auto my-3 max-w-2xl overflow-hidden rounded-[24px] bg-[#fffaf3] shadow-2xl">
        {/* Header */}
        <header className="flex items-start justify-between gap-4 bg-[#70102d] px-5 py-5 sm:px-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f4d58d]">Vowza Catering</p>
            <h2 className="mt-1 text-lg font-bold text-white">Book: {pkg.name}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-white/85 hover:bg-white/15">
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Progress */}
        <div className="border-b border-[#eadfcf] bg-[#fffdfa] px-5 py-3 sm:px-7">
          <div className="flex items-center justify-between overflow-x-auto">
            {STEP_LABELS.map((label, i) => {
              const num = i + 1;
              const done = step > num;
              const current = step === num;
              return (
                <div key={i} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold transition ${
                      done ? 'bg-emerald-500 text-white' :
                      current ? 'bg-[#8b1538] text-white shadow-md' :
                      'border-2 border-[#e7d9c4] text-stone-400'
                    }`}>
                      {done ? <Check className="h-3.5 w-3.5" /> : num}
                    </div>
                    <span className={`mt-0.5 hidden text-[9px] font-medium sm:block ${current ? 'text-[#8b1538]' : done ? 'text-emerald-600' : 'text-stone-400'}`}>{label}</span>
                  </div>
                  {i < 6 && <div className={`mx-0.5 h-0.5 w-3 sm:w-5 rounded ${done ? 'bg-emerald-400' : 'bg-[#e7d9c4]'}`} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-7 max-h-[60vh] overflow-y-auto">
          {step === 1 && <StepPackagePreview pkg={pkg} gallery={gallery} />}
          {step === 2 && <StepEventDetails event={event} setEvent={setEvent} errors={errors} setErrors={setErrors} location={location} setLocation={setLocation} />}
          {step === 3 && <StepGuests pkg={pkg} guestCount={guestCount} setGuestCount={setGuestCount} guestError={guestError} setGuestError={setGuestError} pricePerPlate={pricePerPlate} baseAmount={baseAmount} />}
          {step === 4 && <StepMenuAddons menuSections={menuSections} addons={addons} selectedAddonIds={selectedAddonIds} toggleAddon={toggleAddon} gallery={gallery} menuAcknowledged={menuAcknowledged} setMenuAcknowledged={setMenuAcknowledged} />}
          {step === 5 && <StepSpecialRequests specialRequests={specialRequests} setSpecialRequests={setSpecialRequests} dietaryPrefs={dietaryPrefs} toggleDietary={toggleDietary} DIETARY_OPTIONS={DIETARY_OPTIONS} />}
          {step === 6 && <StepSummary pkg={pkg} event={event} location={location} guests={guests} baseAmount={baseAmount} addonsAmount={addonsAmount} selectedAddons={selectedAddons} grandTotal={grandTotal} advanceAmount={advanceAmount} remainingBalance={remainingBalance} advancePercent={advancePercent} dietaryPrefs={dietaryPrefs} specialRequests={specialRequests} />}
          {step === 7 && <StepConfirm termsAccepted={termsAccepted} setTermsAccepted={setTermsAccepted} grandTotal={grandTotal} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#eadfcf] bg-[#fffdfa]/95 px-5 py-4 sm:px-7">
          <button type="button" onClick={step === 1 ? onClose : goBack}
            className="flex items-center gap-1.5 rounded-xl border border-[#d7c5ae] px-4 py-2.5 text-sm font-semibold text-[#5a3440] transition hover:bg-white">
            <ChevronLeft className="h-4 w-4" />{step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step < 7 ? (
            <button type="button" onClick={goNext}
              className="flex items-center gap-1.5 rounded-xl bg-[#8b1538] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#70102d]">
              Next<ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" disabled={busy || !termsAccepted} onClick={handleSubmit}
              className="rounded-xl bg-[#8b1538] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#70102d] disabled:opacity-60">
              {busy ? <><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Booking…</> : 'Review in Cart →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


/* ─── Step 1: Package Preview ─────────────────────────────────────────────── */
function StepPackagePreview({ pkg, gallery }: { pkg: any; gallery: any[] }) {
  const cover = gallery.find((g: any) => g.is_cover);
  const plateIncludes = (() => { try { return JSON.parse(pkg.cancellation_policy || '[]'); } catch { return []; } })();

  return (
    <div className="space-y-4">
      {/* Cover */}
      {cover && (
        <div className="overflow-hidden rounded-xl border border-[#eadfcf]">
          <img src={cover.public_url} alt={pkg.name} className="w-full h-40 object-cover" />
        </div>
      )}

      <div className="rounded-2xl border border-[#eadfcf] bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-[#3d1924]">{pkg.name}</h3>
            {pkg.description && <p className="mt-1 text-sm text-muted-foreground">{pkg.description}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-bold text-[#8b1538]">₹{Number(pkg.price_per_plate).toLocaleString('en-IN')}</p>
            <p className="text-xs text-muted-foreground">per plate</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{pkg.min_guests}–{pkg.max_guests} guests</span>
          {pkg.is_veg && <span className="flex items-center gap-1 text-emerald-700"><Leaf className="h-3 w-3" />Veg</span>}
          {pkg.is_nonveg && <span className="text-red-600">Non-Veg</span>}
        </div>

        {/* Cuisine badges */}
        {(pkg.cuisine_types ?? []).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {pkg.cuisine_types.map((c: string) => (
              <span key={c} className="rounded-full bg-[#8b1538]/8 px-2.5 py-0.5 text-xs font-medium text-[#8b1538]">{c}</span>
            ))}
          </div>
        )}

        {/* Per plate includes */}
        {plateIncludes.length > 0 && (
          <div className="mt-4 border-t border-[#eadfcf] pt-3">
            <p className="text-xs font-semibold text-[#4b1d2b] mb-2">Per Plate Includes:</p>
            <div className="grid grid-cols-2 gap-1.5">
              {plateIncludes.filter((p: any) => p.section).map((inc: any, i: number) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-stone-600">
                  <Check className="h-3 w-3 text-emerald-500" />
                  <span>{inc.section} × {inc.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-xs text-blue-700">
        <AlertCircle className="inline h-3.5 w-3.5 mr-1" />
        Review the package details above, then click Next to proceed with booking.
      </div>
    </div>
  );
}


/* ─── Step 2: Event Details ───────────────────────────────────────────────── */
function StepEventDetails({ event, setEvent, errors, setErrors, location, setLocation }: { event: EventDetails; setEvent: (e: EventDetails) => void; errors: Record<string, string>; setErrors: (e: Record<string, string>) => void; location: LocationData; setLocation: (loc: LocationData) => void }) {
  const update = (field: keyof EventDetails, value: string) => {
    setEvent({ ...event, [field]: value });
    if (errors[field]) setErrors({ ...errors, [field]: '' });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-white p-5">
        <h3 className="mb-4 text-base font-bold text-[#62132d] flex items-center gap-2">
          <Calendar className="h-4 w-4" />Event Details
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-semibold text-[#4b1d2b]">Event Type</label>
            <select className={inputClass} value={event.eventType} onChange={e => update('eventType', e.target.value)}>
              <option value="">Select event type</option>
              {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold text-[#4b1d2b]">Event Date <span className="text-red-500">*</span></label>
            <input type="date" min={new Date().toISOString().slice(0, 10)} className={`${inputClass} ${errors.eventDate ? 'border-red-500' : ''}`}
              value={event.eventDate} onChange={e => update('eventDate', e.target.value)} />
            {errors.eventDate && <p className="text-xs text-red-500 mt-1">{errors.eventDate}</p>}
          </div>
          <div>
            <label className="text-sm font-semibold text-[#4b1d2b]">Event Time</label>
            <input type="time" className={inputClass} value={event.eventTime} onChange={e => update('eventTime', e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-semibold text-[#4b1d2b]">Duration</label>
            <select className={inputClass} value={event.duration} onChange={e => update('duration', e.target.value)}>
              <option value="2 Hours">2 Hours</option>
              <option value="4 Hours">4 Hours</option>
              <option value="6 Hours">6 Hours</option>
              <option value="8 Hours">8 Hours</option>
              <option value="Full Day">Full Day</option>
              <option value="2 Days">2 Days</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#eadfcf] bg-white p-5">
        <LocationPicker value={location} onChange={setLocation} compact />
        {errors.location && <p className="text-xs text-red-500 mt-2">{errors.location}</p>}
      </div>
    </div>
  );
}


/* ─── Step 3: Guest Details ───────────────────────────────────────────────── */
function StepGuests({ pkg, guestCount, setGuestCount, guestError, setGuestError, pricePerPlate, baseAmount }: { pkg: any; guestCount: string; setGuestCount: (v: string) => void; guestError: string; setGuestError: (v: string) => void; pricePerPlate: number; baseAmount: number }) {
  const min = pkg.min_guests || 1;
  const max = pkg.max_guests || 99999;
  const guests = parseInt(guestCount) || 0;

  const handleChange = (val: string) => {
    setGuestCount(val);
    const n = parseInt(val) || 0;
    if (n > 0 && n < min) setGuestError(`Minimum ${min} guests required`);
    else if (n > max) setGuestError(`Maximum ${max} guests allowed`);
    else setGuestError('');
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-white p-5">
        <h3 className="mb-4 text-base font-bold text-[#62132d] flex items-center gap-2">
          <Users className="h-4 w-4" />Guest Count
        </h3>

        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs text-muted-foreground">Min: {min}</span>
          <div className="h-1 flex-1 rounded bg-[#eadfcf]">
            <div className="h-1 rounded bg-[#8b1538] transition-all" style={{ width: `${Math.min(100, (guests / max) * 100)}%` }} />
          </div>
          <span className="text-xs text-muted-foreground">Max: {max}</span>
        </div>

        <div className="flex items-center justify-center gap-4">
          <button type="button" onClick={() => handleChange(String(Math.max(0, guests - 10)))}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e7d9c4] transition hover:bg-[#8b1538]/10">
            <Minus className="h-4 w-4" />
          </button>
          <input type="number" min={min} max={max} className={`w-32 text-center text-2xl font-bold rounded-xl border ${guestError ? 'border-red-500' : 'border-[#e7d9c4]'} py-3 outline-none focus:border-[#8b1538]`}
            value={guestCount} onChange={e => handleChange(e.target.value)} placeholder="0" />
          <button type="button" onClick={() => handleChange(String(guests + 10))}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e7d9c4] transition hover:bg-[#8b1538]/10">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {guestError && <p className="mt-2 text-center text-xs text-red-500">{guestError}</p>}
        {pkg.recommended_guests && <p className="mt-2 text-center text-xs text-muted-foreground">Recommended: {pkg.recommended_guests} guests</p>}
      </div>

      {/* Price calculation */}
      {guests > 0 && !guestError && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <h4 className="text-sm font-bold text-emerald-800 mb-3">Price Calculation</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-emerald-700">Price per plate</span>
              <span className="font-semibold">₹{pricePerPlate.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-emerald-700">Guest count</span>
              <span className="font-semibold">× {guests}</span>
            </div>
            <div className="border-t border-emerald-200 pt-2 flex justify-between text-base">
              <span className="font-bold text-emerald-800">Base Amount</span>
              <span className="font-bold text-[#8b1538]">₹{baseAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ─── Step 4: Menu & Add-ons ──────────────────────────────────────────────── */
function StepMenuAddons({ menuSections, addons, selectedAddonIds, toggleAddon, gallery, menuAcknowledged, setMenuAcknowledged }: { menuSections: any[]; addons: any[]; selectedAddonIds: string[]; toggleAddon: (id: string) => void; gallery: any[]; menuAcknowledged: boolean; setMenuAcknowledged: (v: boolean) => void }) {
  const galleryImages = gallery.filter((g: any) => !g.is_cover);
  const isEmpty = menuSections.length === 0 && addons.length === 0;

  return (
    <div className="space-y-4">
      {/* Menu Preview */}
      {menuSections.length > 0 && (
        <div className="rounded-2xl border border-[#eadfcf] bg-white p-5">
          <h3 className="mb-3 text-base font-bold text-[#62132d] flex items-center gap-2">
            <Utensils className="h-4 w-4" />Menu Preview
          </h3>
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {menuSections.map((sec, i) => (
              <div key={i}>
                <p className="text-xs font-bold text-[#8b1538] uppercase tracking-wide">{sec.name}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {sec.items.map((item: any, ii: number) => (
                    <span key={ii} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs">
                      {item.is_veg && <Leaf className="h-2.5 w-2.5 text-emerald-600" />}
                      {item.name}
                      {item.is_bestseller && <Star className="h-2.5 w-2.5 text-amber-500" />}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gallery preview */}
      {galleryImages.length > 0 && (
        <div className="rounded-2xl border border-[#eadfcf] bg-white p-5">
          <h3 className="mb-3 text-sm font-bold text-[#62132d] flex items-center gap-2">
            <Images className="h-4 w-4" />Gallery
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {galleryImages.slice(0, 6).map((img: any, i: number) => (
              <div key={i} className="aspect-square overflow-hidden rounded-lg border border-[#eadfcf]">
                <img src={img.public_url} alt="" className="h-full w-full object-cover" loading="lazy" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add-ons */}
      {addons.length > 0 && (
        <div className="rounded-2xl border border-[#eadfcf] bg-white p-5">
          <h3 className="mb-3 text-base font-bold text-[#62132d]">Optional Add-ons</h3>
          <p className="text-xs text-muted-foreground mb-3">Select additional services to enhance your catering</p>
          <div className="space-y-2">
            {addons.map((addon: any) => {
              const selected = selectedAddonIds.includes(addon.id);
              return (
                <button key={addon.id} type="button" onClick={() => toggleAddon(addon.id)}
                  className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                    selected ? 'border-[#8b1538] bg-[#8b1538]/5' : 'border-[#e7d9c4] hover:border-[#c99b43]'
                  }`}>
                  <div className={`flex h-5 w-5 items-center justify-center rounded border ${selected ? 'border-[#8b1538] bg-[#8b1538] text-white' : 'border-stone-300'}`}>
                    {selected && <Check className="h-3 w-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#3d1924]">{addon.name}</p>
                    {addon.description && <p className="text-xs text-muted-foreground truncate">{addon.description}</p>}
                  </div>
                  <span className="text-sm font-bold text-[#8b1538] shrink-0">+₹{Number(addon.price).toLocaleString('en-IN')}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state — Acknowledgement required */}
      {isEmpty && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 shrink-0 mt-0.5">
                <AlertCircle className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-900">No menu or optional add-ons have been configured for this catering package.</p>
                <p className="mt-2 text-xs text-amber-800 leading-relaxed">
                  By continuing, you acknowledge that this package does not currently include a detailed menu or optional add-ons. You can contact the caterer for complete menu information before confirming your booking.
                </p>
              </div>
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-2xl border border-[#e7d9c4] bg-white p-4 cursor-pointer transition hover:border-[#8b1538]/40">
            <input type="checkbox" checked={menuAcknowledged} onChange={e => setMenuAcknowledged(e.target.checked)}
              className="mt-0.5 accent-[#8b1538] h-4 w-4" />
            <span className="text-xs text-[#3d1924] leading-relaxed">
              I understand that this catering package does not have a detailed menu or optional add-ons configured, and I wish to continue with my booking.
            </span>
          </label>

          {!menuAcknowledged && (
            <p className="text-xs text-amber-700 pl-1">Please acknowledge before continuing.</p>
          )}
        </div>
      )}
    </div>
  );
}


/* ─── Step 5: Special Requests ────────────────────────────────────────────── */
function StepSpecialRequests({ specialRequests, setSpecialRequests, dietaryPrefs, toggleDietary, DIETARY_OPTIONS }: { specialRequests: string; setSpecialRequests: (v: string) => void; dietaryPrefs: string[]; toggleDietary: (v: string) => void; DIETARY_OPTIONS: string[] }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-white p-5">
        <h3 className="mb-3 text-base font-bold text-[#62132d]">Dietary Preferences</h3>
        <p className="text-xs text-muted-foreground mb-3">Select any dietary requirements</p>
        <div className="flex flex-wrap gap-2">
          {DIETARY_OPTIONS.map(opt => (
            <button key={opt} type="button" onClick={() => toggleDietary(opt)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                dietaryPrefs.includes(opt) ? 'border-[#8b1538] bg-[#8b1538]/10 text-[#8b1538]' : 'border-[#e7d9c4] text-stone-600 hover:border-[#c99b43]'
              }`}>
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[#eadfcf] bg-white p-5">
        <h3 className="mb-3 text-base font-bold text-[#62132d]">Special Instructions</h3>
        <textarea className={`${inputClass} min-h-[120px] resize-y`}
          placeholder="Any timing notes, vendor instructions, special arrangements, food preferences..."
          value={specialRequests} onChange={e => setSpecialRequests(e.target.value)} />
        <p className="mt-2 text-xs text-muted-foreground">Examples: Timing preferences, separate counters, specific dietary needs, decor coordination</p>
      </div>
    </div>
  );
}


/* ─── Step 6: Summary ─────────────────────────────────────────────────────── */
function StepSummary({ pkg, event, location, guests, baseAmount, addonsAmount, selectedAddons, grandTotal, advanceAmount, remainingBalance, advancePercent, dietaryPrefs, specialRequests }: any) {
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfcf] bg-white p-5">
        <h3 className="mb-4 text-base font-bold text-[#62132d]">Booking Summary</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Package</span><span className="font-semibold text-right max-w-[200px]">{pkg.name}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Event</span><span className="font-semibold">{event.eventType || 'Not specified'}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="font-semibold">{event.eventDate ? fmtDate(event.eventDate) : '—'}</span></div>
          {event.eventTime && <div className="flex justify-between"><span className="text-muted-foreground">Time</span><span className="font-semibold">{event.eventTime} ({event.duration})</span></div>}
          <div className="flex justify-between"><span className="text-muted-foreground">Venue</span><span className="font-semibold text-right max-w-[200px]">{[location?.venue_name || location?.locality, location?.town_city].filter(Boolean).join(', ') || '—'}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Guest Count</span><span className="font-semibold">{guests}</span></div>
          {dietaryPrefs.length > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Dietary</span><span className="font-semibold text-right max-w-[200px]">{dietaryPrefs.join(', ')}</span></div>}
          {specialRequests && <div className="flex justify-between"><span className="text-muted-foreground">Notes</span><span className="font-semibold text-right max-w-[200px] line-clamp-2">{specialRequests}</span></div>}
        </div>
      </div>

      {/* Price breakdown */}
      <div className="rounded-2xl border border-[#eadfcf] bg-gradient-to-br from-amber-50 to-orange-50 p-5">
        <h3 className="mb-3 text-base font-bold text-[#62132d]">Price Breakdown</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>₹{Number(pkg.price_per_plate).toLocaleString('en-IN')} × {guests} guests</span>
            <span className="font-semibold">₹{baseAmount.toLocaleString('en-IN')}</span>
          </div>
          {selectedAddons.length > 0 && (
            <>
              <p className="text-xs font-semibold text-muted-foreground mt-2">Add-ons:</p>
              {selectedAddons.map((a: any) => (
                <div key={a.id} className="flex justify-between text-xs pl-3">
                  <span>{a.name}</span>
                  <span>₹{Number(a.price).toLocaleString('en-IN')}</span>
                </div>
              ))}
              <div className="flex justify-between">
                <span>Add-ons Total</span>
                <span className="font-semibold">₹{addonsAmount.toLocaleString('en-IN')}</span>
              </div>
            </>
          )}
          <div className="border-t border-[#e7d9c4] pt-2 flex justify-between text-lg font-bold">
            <span>Grand Total</span><span className="text-[#8b1538]">₹{grandTotal.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Payment breakdown */}
      <div className="rounded-xl bg-[#8b1538]/5 border border-[#8b1538]/15 p-4">
        <p className="text-xs font-bold text-[#8b1538] mb-2">Payment Structure</p>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between"><span>Advance ({advancePercent}%)</span><span className="font-bold">₹{advanceAmount.toLocaleString('en-IN')}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>Remaining (on event day)</span><span>₹{remainingBalance.toLocaleString('en-IN')}</span></div>
        </div>
      </div>
    </div>
  );
}


/* ─── Step 7: Confirm ─────────────────────────────────────────────────────── */
function StepConfirm({ termsAccepted, setTermsAccepted, grandTotal }: { termsAccepted: boolean; setTermsAccepted: (v: boolean) => void; grandTotal: number }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <Check className="h-7 w-7 text-emerald-600" />
        </div>
        <h3 className="text-lg font-bold text-emerald-800">Ready to Review</h3>
        <p className="mt-1 text-sm text-emerald-700">Your total is <span className="font-bold">₹{grandTotal.toLocaleString('en-IN')}</span></p>
        <p className="mt-2 text-xs text-emerald-600">You'll be taken to a full cart review page where you can edit details and confirm your booking.</p>
      </div>

      <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-xs text-blue-700">
        <AlertCircle className="inline h-3.5 w-3.5 mr-1" />
        On the cart page you can edit guest count, event details, add-ons, and special requests before final confirmation.
      </div>

      <label className="flex items-start gap-3 p-4 rounded-xl border border-[#e7d9c4] bg-white cursor-pointer">
        <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="mt-1 accent-[#8b1538]" />
        <span className="text-xs text-muted-foreground leading-relaxed">
          I agree to the <a href="/terms" target="_blank" className="text-[#8b1538] underline">Terms & Conditions</a>,{' '}
          <a href="/terms" target="_blank" className="text-[#8b1538] underline">Cancellation Policy</a>, and{' '}
          <a href="/privacy" target="_blank" className="text-[#8b1538] underline">Privacy Policy</a>.
        </span>
      </label>
    </div>
  );
}
