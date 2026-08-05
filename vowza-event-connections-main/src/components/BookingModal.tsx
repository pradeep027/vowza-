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
}

type Step = 'calendar' | 'details' | 'confirm';

const BookingModal = ({ isOpen, onClose, provider, providerName }: BookingModalProps) => {
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
  const [venueAddress,   setVenueAddress]   = useState('');
  const [venueCity,      setVenueCity]      = useState('');
  const [venueArea,      setVenueArea]      = useState('');
  const [requirements,   setRequirements]   = useState('');
  const [amount,         setAmount]         = useState('');

  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setStep('calendar');
      setEventDate('');
      setAvailError(null);
      setNearbyDates([]);
      supabase.from('event_types').select('id, name').order('name').then(({ data }) => {
        if (data) setEventTypes(data);
      });
      if (provider.price_min) setAmount(provider.price_min.toString());
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

  const handleDetailsNext = async () => {
    if (!venueAddress || !venueCity || !amount) {
      toast.error('Please fill in all required fields');
      return;
    }
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
      const platformFee   = Math.round(bookingAmount * 0.1);

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
          platform_fee:         platformFee,
          status:               'requested',
        })
        .select()
        .single();

      if (error) throw error;

      await NotificationService.notifyBookingReceived(user.id, provider.id, bookingData.id);

      toast.success('Booking request sent! The artist will respond within 24 hours.');
      onClose();
      navigate('/my-bookings');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create booking');
    } finally {
      setIsLoading(false);
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const eventTypeName = eventTypes.find(e => e.id === eventTypeId)?.name;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[92vw] sm:w-full max-w-lg max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-gold to-maroon bg-clip-text text-transparent">
            Book {providerName}
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

        {/* ── STEP 1: Calendar ────────────────────────────────────────── */}
        {step === 'calendar' && (
          <div className="space-y-3">
            <AvailabilityCalendar
              providerId={provider.id}
              selectedDate={eventDate}
              onSelectDate={handleDateSelect}
            />

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

            {/* Venue */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />Venue Address *</Label>
              <Input placeholder="Full venue address" value={venueAddress}
                onChange={e => setVenueAddress(e.target.value)} required
                className="border-border focus:border-gold" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>City *</Label>
                <Input placeholder="City" value={venueCity}
                  onChange={e => setVenueCity(e.target.value)} required
                  className="border-border focus:border-gold" />
              </div>
              <div className="space-y-1.5">
                <Label>Area</Label>
                <Input placeholder="Area / Locality" value={venueArea}
                  onChange={e => setVenueArea(e.target.value)}
                  className="border-border focus:border-gold" />
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
              <Label className="flex items-center gap-1"><IndianRupee className="w-3.5 h-3.5" />Offered Amount (₹) *</Label>
              <Input type="number" min={provider.price_min || 0}
                placeholder={`Min: ₹${provider.price_min?.toLocaleString() || '0'}`}
                value={amount} onChange={e => setAmount(e.target.value)} required
                className="border-border focus:border-gold" />
              {provider.price_min && provider.price_max && (
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
                <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="font-medium">{fmtDate(eventDate)}</span></div>
                {eventTime && <div className="flex justify-between"><span className="text-muted-foreground">Time</span><span className="font-medium">{eventTime} ({duration} hrs)</span></div>}
                {eventTypeName && <div className="flex items-start justify-between gap-4"><span className="text-muted-foreground flex-shrink-0">Event</span><span className="font-medium text-right min-w-0 break-words">{eventTypeName}</span></div>}
                <div className="flex items-start justify-between gap-4"><span className="text-muted-foreground flex-shrink-0">Venue</span><span className="font-medium text-right min-w-0 break-words max-w-[200px]">{venueAddress}, {venueCity}</span></div>
                <div className="border-t border-border/40 pt-2 flex justify-between font-bold">
                  <span>Amount</span><span className="text-gold">₹{parseInt(amount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Platform fee (10%)</span><span>₹{Math.round(parseInt(amount) * 0.1).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              Your booking request will be sent to the artist. The artist has 24 hours to accept or decline.
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('details')} className="flex-1">← Back</Button>
              <Button onClick={handleSubmit} disabled={isLoading}
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
