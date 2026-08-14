// ─── BookingModal — with availability check + double-booking prevention ───────
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationService } from '@/services/notificationService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import AvailabilityCalendar from '@/components/booking/AvailabilityCalendar';
import { checkDateAvailable, getNearestAvailableDates } from '@/hooks/useAvailability';
import { toast } from 'sonner';
import LocationPicker, { type LocationData, validateLocationData, emptyLocationData } from '@/components/booking/LocationPicker';
import {
  Calendar, Clock, MapPin, IndianRupee,
  AlertCircle, CheckCircle, ChevronRight, Loader2,
} from 'lucide-react';

interface EventType { id: string; name: string; }

interface BookingModalProps {
  isOpen:       boolean;
  onClose:      () => void;
  provider: {
    id:        string;
    price_min: number | null;
    price_max: number | null;
  };
  providerName: string;
  selectedPackage?: any;
}

type Step = 'calendar' | 'details' | 'confirm';

interface ValidationErrors {
  location?: string;
  amount?: string;
}

const BookingModal = ({ isOpen, onClose, provider, providerName, selectedPackage }: BookingModalProps) => {
  const [step,              setStep]             = useState<Step>('calendar');
  const [eventTypes,        setEventTypes]        = useState<EventType[]>([]);
  const [isLoading,         setIsLoading]         = useState(false);
  const [checkingAvail,     setCheckingAvail]     = useState(false);
  const [availError,        setAvailError]        = useState<string | null>(null);
  const [nearbyDates,       setNearbyDates]       = useState<string[]>([]);

  // Form state
  const [eventTypeId,    setEventTypeId]    = useState('');
  const [eventDate,      setEventDate]      = useState('');
  const [eventTime,      setEventTime]      = useState('');
  const [duration,       setDuration]       = useState('4');
  const [location,       setLocation]       = useState<LocationData>(emptyLocationData);
  // Derived from location for backward-compat with DB columns
  const venueName = location.venue_name;
  const venueAddress = [location.venue_name, location.locality, location.address_line].filter(Boolean).join(', ');
  const venueCity = location.town_city;
  const venueState = location.state;
  const venuePincode = location.pincode;
  const venueArea = location.locality;
  const [guestCount,     setGuestCount]     = useState('');
  const [requirements,   setRequirements]   = useState('');
  const [amount,         setAmount]         = useState('');

  // Special requirements checkboxes
  const [specialReqs, setSpecialReqs] = useState({
    candidPhotography: false,
    traditionalPhotography: false,
    droneCoverage: false,
    videography: false,
    familyGroupPhotos: false,
  });

  // Validation
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  // Terms acceptance (Step 3)
  const [termsAccepted, setTermsAccepted] = useState(false);

  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setStep('calendar');
      setEventDate('');
      setAvailError(null);
      setNearbyDates([]);
      setValidationErrors({});
      setTermsAccepted(false);
      supabase.from('event_types').select('id, name').order('name').then(({ data }) => {
        if (data && data.length > 0) setEventTypes(data);
        else setEventTypes([
          { id: 'wedding', name: 'Wedding' }, { id: 'reception', name: 'Reception' },
          { id: 'engagement', name: 'Engagement' }, { id: 'birthday', name: 'Birthday' },
          { id: 'corporate', name: 'Corporate Event' }, { id: 'haldi', name: 'Haldi' },
          { id: 'sangeet', name: 'Sangeet' }, { id: 'other', name: 'Other' },
        ]);
      }).catch(() => {
        setEventTypes([
          { id: 'wedding', name: 'Wedding' }, { id: 'reception', name: 'Reception' },
          { id: 'engagement', name: 'Engagement' }, { id: 'birthday', name: 'Birthday' },
          { id: 'corporate', name: 'Corporate Event' }, { id: 'other', name: 'Other' },
        ]);
      });
      if (selectedPackage?.price) setAmount(String(selectedPackage.price));
      else if (provider.price_min) setAmount(provider.price_min.toString());
    }
  }, [isOpen, provider.price_min]);

  // When date or time changes, re-check availability
  useEffect(() => {
    if (!eventDate || step !== 'details') return;
    const timer = setTimeout(async () => {
      setCheckingAvail(true);
      setAvailError(null);
      const result = await checkDateAvailable(provider.id, eventDate, eventTime || undefined, parseInt(duration));
      if (!result.available) {
        setAvailError(result.reason ?? 'Not available');
        const nearby = await getNearestAvailableDates(provider.id, eventDate);
        setNearbyDates(nearby);
      } else {
        setAvailError(null);
        setNearbyDates([]);
      }
      setCheckingAvail(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [eventDate, eventTime, duration, provider.id, step]);

  const handleDateSelect = async (date: string) => {
    setCheckingAvail(true);
    setAvailError(null);
    const result = await checkDateAvailable(provider.id, date);
    setCheckingAvail(false);

    if (!result.available) {
      setAvailError(result.reason ?? 'Not available');
      const nearby = await getNearestAvailableDates(provider.id, date);
      setNearbyDates(nearby);
      setEventDate(date); // still show selection so user can see why it's blocked
    } else {
      setEventDate(date);
      setAvailError(null);
      setNearbyDates([]);
      // Auto-advance to details step
      setTimeout(() => setStep('details'), 200);
    }
  };

  const validateDetails = (): boolean => {
    const errors: ValidationErrors = {};
    const locErr = validateLocationData(location);
    if (locErr) errors.location = locErr;
    if (!amount || parseInt(amount) <= 0) errors.amount = 'Please enter a valid amount';
    setValidationErrors(errors);
    if (locErr) toast.error(locErr);
    return Object.keys(errors).length === 0;
  };

  const handleDetailsNext = async () => {
    if (!validateDetails()) return;

    // Final availability check before showing confirm
    setCheckingAvail(true);
    const result = await checkDateAvailable(provider.id, eventDate, eventTime || undefined, parseInt(duration));
    setCheckingAvail(false);
    if (!result.available) {
      setAvailError(result.reason ?? 'Not available');
      return;
    }
    setStep('confirm');
  };

  const handleSubmit = async () => {
    if (!user) { toast.error('Please login to book'); return; }
    if (!termsAccepted) { toast.error('Please accept the terms and conditions'); return; }
    setIsLoading(true);

    try {
      // ── Atomic availability check + insert ──────────────────────────────
      // Re-check one final time (handles concurrent requests)
      const result = await checkDateAvailable(provider.id, eventDate, eventTime || undefined, parseInt(duration));
      if (!result.available) {
        toast.error(result.reason ?? 'This slot was just booked. Please choose another date.');
        setStep('calendar');
        setIsLoading(false);
        return;
      }

      const bookingAmount = parseInt(amount);

      const { data: bookingData, error } = await supabase
        .from('bookings')
        .insert({
          customer_id:          user.id,
          provider_id:          provider.id,
          event_type_id:        eventTypeId || null,
          event_date:           eventDate,
          event_time:           eventTime || null,
          event_duration_hours: parseInt(duration),
          venue_address:        venueAddress,
          venue_city:           venueCity,
          venue_area:           venueArea || null,
          requirements:         requirements || null,
          amount:               bookingAmount,
          platform_fee:         0,
          status:               'requested',
        })
        .select()
        .single();

      if (error) throw error;

      // Save structured location
      await supabase.from('booking_locations' as any).insert({
        booking_table: 'bookings', booking_id: bookingData.id,
        state: location.state, district: location.district, town_city: location.town_city,
        exact_address: venueAddress, pincode: location.pincode, landmark: location.address_line || null,
        latitude: location.latitude, longitude: location.longitude,
      });

      await NotificationService.notifyBookingReceived(user.id, provider.id, bookingData.id);

      // Store booking details for success page
      const eventTypeName = eventTypes.find(e => e.id === eventTypeId)?.name;
      sessionStorage.setItem('vowza_booking_success', JSON.stringify({
        bookingId: bookingData.id,
        artistName: providerName,
        eventDate: eventDate,
        eventTime: eventTime,
        duration: duration,
        venue: `${venueAddress}, ${venueCity}`,
        amount: bookingAmount,
        eventType: eventTypeName || 'Event',
        status: 'requested'
      }));

      toast.success('Booking request sent! The artist will respond within 24 hours.');
      onClose();
      navigate('/booking-success');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create booking');
    } finally {
      setIsLoading(false);
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const eventTypeName = eventTypes.find(e => e.id === eventTypeId)?.name;

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[92vw] sm:w-full max-w-lg max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-gold to-maroon bg-clip-text text-transparent">
            {selectedPackage ? `Book: ${selectedPackage.name}` : `Book ${providerName}`}
          </DialogTitle>
          <DialogDescription>
            {step === 'calendar' && 'Select an available date on the calendar'}
            {step === 'details'  && 'Fill in your event details'}
            {step === 'confirm'  && 'Review and confirm your booking'}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-4">
          {(['calendar','details','confirm'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step === s ? 'bg-gold text-foreground' :
                (['calendar','details','confirm'].indexOf(step) > i) ? 'bg-emerald-500 text-white' :
                'bg-muted text-muted-foreground'
              }`}>{i + 1}</div>
              {i < 2 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            </div>
          ))}
          <span className="text-xs text-muted-foreground ml-auto capitalize">{step}</span>
        </div>

        {/* Selected Package Banner */}
        {selectedPackage && (
          <div className="p-3 rounded-xl bg-[#8B1538]/5 border border-[#8B1538]/15 mb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">{selectedPackage.name}</p>
                {selectedPackage.duration && <p className="text-xs text-muted-foreground mt-0.5">Duration: {selectedPackage.duration}</p>}
                {selectedPackage.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{selectedPackage.description}</p>}
              </div>
              <p className="text-lg font-bold text-[#8B1538] flex-shrink-0">₹{Number(selectedPackage.price).toLocaleString()}</p>
            </div>
          </div>
        )}

        {/* ── STEP 1: Calendar ────────────────────────────────────────── */}
        {step === 'calendar' && (
          <div className="space-y-3">
            {provider.id ? (
              <AvailabilityCalendar
                providerId={provider.id}
                selectedDate={eventDate}
                onSelectDate={handleDateSelect}
              />
            ) : (
              <div className="text-center py-8 text-sm text-muted-foreground">Loading calendar...</div>
            )}

            {/* Checking state */}
            {checkingAvail && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground px-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Checking availability…
              </div>
            )}

            {/* Availability error + suggestions */}
            {availError && eventDate && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-red-700">Not Available</p>
                    <p className="text-xs text-red-600 mt-0.5">{availError}</p>
                    {nearbyDates.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-red-700 mb-1">Nearest available dates:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {nearbyDates.map(d => (
                            <button
                              key={d}
                              onClick={() => handleDateSelect(d)}
                              className="px-2.5 py-1 rounded-lg bg-white border border-red-200 text-xs text-red-700 hover:bg-red-100 transition-colors font-medium"
                            >
                              {new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Selected + available */}
            {eventDate && !availError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-emerald-700">Available!</p>
                  <p className="text-xs text-emerald-600">{fmtDate(eventDate)}</p>
                </div>
                <Button size="sm" onClick={() => setStep('details')}
                  className="ml-auto bg-emerald-600 text-white hover:bg-emerald-700 h-8 text-xs px-3">
                  Continue →
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: Details ─────────────────────────────────────────── */}
        {step === 'details' && (
          <div className="space-y-4">
            {/* Selected date reminder */}
            <div className="flex items-center gap-2 p-3 rounded-xl bg-gold/10 border border-gold/20">
              <Calendar className="w-4 h-4 text-gold" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-foreground">{fmtDate(eventDate)}</p>
              </div>
              <button onClick={() => setStep('calendar')} className="text-xs text-gold hover:underline">Change</button>
            </div>

            {/* Availability error inline */}
            {checkingAvail && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking availability…
              </div>
            )}
            {availError && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                {availError}
              </div>
            )}

            {/* Event Type */}
            <div className="space-y-1.5">
              <Label>Event Type</Label>
              <Select value={eventTypeId} onValueChange={setEventTypeId}>
                <SelectTrigger className="border-border focus:border-gold">
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  {eventTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Time + Duration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Start Time</Label>
                <Input type="time" value={eventTime}
                  onChange={e => setEventTime(e.target.value)}
                  className="border-border focus:border-gold" />
              </div>
              <div className="space-y-1.5">
                <Label>Duration</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger className="border-border focus:border-gold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2,3,4,5,6,8,10,12].map(h => (
                      <SelectItem key={h} value={h.toString()}>{h} hours</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Location Picker */}
            <LocationPicker value={location} onChange={setLocation} compact />

            {/* Number of Guests */}
            <div className="space-y-1.5">
              <Label>Number of Guests</Label>
              <Input type="number" placeholder="Expected guest count" value={guestCount}
                onChange={e => setGuestCount(e.target.value)}
                className="border-border focus:border-gold" />
            </div>

            {/* Special Requirements */}
            <div className="space-y-2">
              <Label>Special Requirements</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { key: 'candidPhotography' as const, label: 'Candid Photography' },
                  { key: 'traditionalPhotography' as const, label: 'Traditional Photography' },
                  { key: 'droneCoverage' as const, label: 'Drone Coverage' },
                  { key: 'videography' as const, label: 'Videography' },
                  { key: 'familyGroupPhotos' as const, label: 'Family Group Photos' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 p-2 rounded-lg border border-border/60 bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={specialReqs[key]}
                      onChange={e => setSpecialReqs(prev => ({ ...prev, [key]: e.target.checked }))}
                      className="accent-[#8B1538] rounded"
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Requirements */}
            <div className="space-y-1.5">
              <Label>Additional Notes</Label>
              <Textarea placeholder="Any specific requirements for the artist…"
                value={requirements} onChange={e => setRequirements(e.target.value)}
                rows={3} className="border-border focus:border-gold resize-none" />
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><IndianRupee className="w-3.5 h-3.5" />{selectedPackage ? 'Package Price (₹)' : 'Offered Amount (₹) *'}</Label>
              <Input type="number" min={provider.price_min || 0}
                placeholder={`Min: ₹${provider.price_min?.toLocaleString() || '0'}`}
                value={amount} onChange={e => { if (!selectedPackage) { setAmount(e.target.value); if (validationErrors.amount) setValidationErrors(prev => ({ ...prev, amount: undefined })); } }}
                readOnly={!!selectedPackage}
                className={`border-border focus:border-gold ${validationErrors.amount ? 'border-red-500 focus:border-red-500' : ''} ${selectedPackage ? 'bg-muted cursor-not-allowed' : ''}`} />
              {validationErrors.amount && (
                <p className="text-xs text-red-500 mt-1">{validationErrors.amount}</p>
              )}
              {!selectedPackage && provider.price_min && provider.price_max && (
                <p className="text-xs text-muted-foreground">
                  Suggested: ₹{provider.price_min.toLocaleString()} – ₹{provider.price_max.toLocaleString()}
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep('calendar')} className="flex-1 min-w-0">← Back</Button>
              <Button onClick={handleDetailsNext} disabled={!!availError || checkingAvail}
                className="flex-1 bg-gradient-gold hover:opacity-90">
                {checkingAvail ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Checking…</> : 'Review →'}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Confirm ─────────────────────────────────────────── */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-gold/10 to-maroon/10 border border-gold/20 space-y-3">
              <h3 className="font-semibold text-foreground">Booking Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-start justify-between gap-4"><span className="text-muted-foreground flex-shrink-0">Artist</span><span className="font-medium text-right min-w-0 break-words">{providerName}</span></div>
                {selectedPackage && <div className="flex items-start justify-between gap-4"><span className="text-muted-foreground flex-shrink-0">Package</span><span className="font-medium text-right min-w-0 break-words">{selectedPackage.name}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="font-medium">{fmtDate(eventDate)}</span></div>
                {eventTime && <div className="flex justify-between"><span className="text-muted-foreground">Time</span><span className="font-medium">{eventTime} ({duration} hrs)</span></div>}
                {eventTypeName && <div className="flex items-start justify-between gap-4"><span className="text-muted-foreground flex-shrink-0">Event</span><span className="font-medium text-right min-w-0 break-words">{eventTypeName}</span></div>}
                <div className="flex items-start justify-between gap-4"><span className="text-muted-foreground flex-shrink-0">Venue</span><span className="font-medium text-right min-w-0 break-words max-w-[200px]">{venueAddress}, {venueCity}{venueState ? `, ${venueState}` : ''}</span></div>
                {guestCount && <div className="flex justify-between"><span className="text-muted-foreground">Guests</span><span className="font-medium">{guestCount}</span></div>}
                <div className="border-t border-border/40 pt-2 flex justify-between font-bold">
                  <span>Amount</span><span className="text-gold">₹{parseInt(amount).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              Your booking request will be sent to the artist. The artist has 24 hours to accept or decline.
            </div>

            {/* Terms & Conditions checkbox */}
            <label className="flex items-start gap-3 p-3 rounded-xl border border-border/60 bg-secondary/30 cursor-pointer">
              <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="mt-1 accent-[#8B1538]" />
              <span className="text-xs text-muted-foreground">
                I agree to the <a href="/terms" target="_blank" className="text-[#8B1538] underline">Terms &amp; Conditions</a>, <a href="/terms" target="_blank" className="text-[#8B1538] underline">Cancellation Policy</a>, and <a href="/privacy" target="_blank" className="text-[#8B1538] underline">Privacy Policy</a>.
              </span>
            </label>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('details')} className="flex-1">← Back</Button>
              <Button onClick={handleSubmit} disabled={isLoading || !termsAccepted}
                className="flex-1 bg-gradient-gold hover:opacity-90">
                {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</> : 'Confirm Booking'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BookingModal;
