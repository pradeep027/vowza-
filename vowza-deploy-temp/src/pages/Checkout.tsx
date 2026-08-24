import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCart, type CartItem } from '@/contexts/CartContext';
import { supabase } from '@/integrations/supabase/client';
import { NotificationService } from '@/services/notificationService';
import { usePlatformFee, calculatePlatformFee } from '@/hooks/usePlatformFee';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, IndianRupee, Loader2, AlertTriangle, CheckCircle2, ShoppingBag } from 'lucide-react';
import LocationPicker, { type LocationData, validateLocationData, emptyLocationData } from '@/components/booking/LocationPicker';
import WaterProductCheckout from '@/components/WaterProductCheckout';
import PhotographyPackageCheckout from '@/components/PhotographyPackageCheckout';

/* ─── Types ────────────────────────────────────────────────────────────────── */
interface PriceValidation {
  itemId: string;
  currentPrice: number;
  cartPrice: number;
  changed: boolean;
  unavailable: boolean;
}

type CheckoutStep = 'review' | 'details' | 'confirm';
const ADVANCE_PERCENT = 20;
const EVENT_TYPES = ['Wedding','Reception','Sangeet','Engagement','Birthday','Corporate','College Fest','Private Party','Anniversary','Haldi','Mehendi','Baby Shower','Housewarming','Festival','Other'];

/* ─── Main Component ───────────────────────────────────────────────────────── */
const Checkout = () => {
  const { user } = useAuth();
  const { getScopedCart, clearScopedCart, removeFromCart } = useCart();
  const { data: feeConfig } = usePlatformFee();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Scope from URL: /checkout?vendor=X&category=Y
  const scopeVendor = searchParams.get('vendor') || '';
  const scopeCategory = searchParams.get('category') || '';

  // Get ONLY the scoped items
  const scopedItems = getScopedCart(scopeVendor, scopeCategory);
  const scopeTotal = scopedItems.reduce((s, i) => s + i.price, 0);
  const providerName = scopedItems[0]?.providerName || 'Artist';

  const [step, setStep] = useState<CheckoutStep>('review');
  const [validating, setValidating] = useState(false);
  const [priceValidations, setPriceValidations] = useState<PriceValidation[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Booking details
  const [eventType, setEventType] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [location, setLocation] = useState<LocationData>(emptyLocationData);
  const [specialRequirements, setSpecialRequirements] = useState('');

  // ─── Special checkout flows (only when NO scoped cart params are present) ──
  const hasScope = !!(scopeVendor && scopeCategory);
  const [photographyCheckout] = useState(() => {
    if (hasScope) return null; // Scoped cart takes priority
    try { const raw = sessionStorage.getItem('vowza_photography_checkout'); if (!raw) return null; const parsed = JSON.parse(raw); return parsed && parsed.cartId ? parsed : null; } catch { return null; }
  });
  const [waterCheckout] = useState(() => {
    if (hasScope) return null; // Scoped cart takes priority
    try { const raw = sessionStorage.getItem('vowza_water_checkout'); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });

  if (photographyCheckout) return <PhotographyPackageCheckout payload={photographyCheckout} />;
  if (waterCheckout) return <WaterProductCheckout payload={waterCheckout} />;

  // ─── Price Validation ────────────────────────────────────────────────────
  const validatePrices = async () => {
    if (scopedItems.length === 0) return;
    setValidating(true);
    const validations: PriceValidation[] = [];
    for (const item of scopedItems) {
      try {
        const { data, error } = await supabase.from(item.packageTable as any).select('*').eq('id', item.packageId).maybeSingle();
        if (error || !data) { validations.push({ itemId: item.id, currentPrice: 0, cartPrice: item.price, changed: false, unavailable: true }); continue; }
        if (data.status && data.status !== 'active') { validations.push({ itemId: item.id, currentPrice: 0, cartPrice: item.price, changed: false, unavailable: true }); continue; }
        const currentPrice = Number(data.package_price || data.price || data.starting_price || data.rental_price || data.price_per_plate || 0);
        const changed = currentPrice !== item.price && currentPrice > 0;
        validations.push({ itemId: item.id, currentPrice, cartPrice: item.price, changed, unavailable: false });
      } catch { validations.push({ itemId: item.id, currentPrice: item.price, cartPrice: item.price, changed: false, unavailable: false }); }
    }
    setPriceValidations(validations);
    setValidating(false);
  };

  useEffect(() => { if (scopedItems.length > 0) validatePrices(); }, [scopedItems.length]);

  const hasIssues = priceValidations.some(v => v.changed || v.unavailable);
  const unavailableItems = priceValidations.filter(v => v.unavailable);
  const changedItems = priceValidations.filter(v => v.changed && !v.unavailable);

  const goToDetails = () => { if (hasIssues) { toast.error('Resolve cart issues first'); return; } setStep('details'); };
  const goToConfirm = () => {
    if (!eventDate) { toast.error('Select an event date'); return; }
    const dateObj = new Date(eventDate);
    const today = new Date(); today.setHours(0,0,0,0);
    if (dateObj < today) { toast.error('Event date must be in the future'); return; }
    if (!eventType) { toast.error('Select event type'); return; }
    const locErr = validateLocationData(location);
    if (locErr) { toast.error(locErr); return; }
    setStep('confirm');
  };

  // ─── Create Bookings (scoped) ────────────────────────────────────────────
  const handleCheckout = async () => {
    if (!user) { toast.error('Please log in'); navigate('/auth'); return; }
    if (scopedItems.length === 0) { toast.error('Cart is empty'); return; }
    setSubmitting(true);
    let successCount = 0;
    const errors: string[] = [];

    for (const item of scopedItems) {
      try {
        const baseAmount = item.price;
        const advanceAmount = Math.round(baseAmount * ADVANCE_PERCENT / 100);
        const remaining = baseAmount - advanceAmount;
        const { data: booking, error } = await supabase.from(item.bookingTable as any).insert({
          package_id: item.packageId, provider_id: item.providerId, customer_id: user.id,
          event_date: eventDate, event_time: eventTime || null, event_type: eventType || null,
          venue: location.venue_name || location.locality || null, city: location.town_city || null,
          special_requirements: specialRequirements || null,
          base_amount: baseAmount, addons_amount: 0, total_amount: baseAmount,
          advance_amount: advanceAmount, remaining_amount: remaining, status: 'pending',
        }).select('id').single();
        if (error) throw new Error(`${item.packageName}: ${error.message}`);

        await supabase.from('booking_locations' as any).insert({
          booking_table: item.bookingTable, booking_id: booking.id,
          state: location.state, district: location.district, town_city: location.town_city,
          exact_address: [location.venue_name, location.locality, location.address_line].filter(Boolean).join(', '),
          pincode: location.pincode, landmark: location.address_line || null,
          latitude: location.latitude, longitude: location.longitude,
        });

        await NotificationService.notifyBookingReceived(user.id, item.providerId, booking.id);
        successCount++;
      } catch (err: any) { errors.push(err.message || `Failed to book ${item.packageName}`); }
    }

    setSubmitting(false);
    if (successCount > 0) {
      // Clear ONLY this scope's cart
      clearScopedCart(scopeVendor, scopeCategory);
      if (errors.length > 0) toast.warning(`${successCount} booking(s) created. ${errors.length} failed.`);
      else toast.success(`${successCount} booking request${successCount > 1 ? 's' : ''} sent!`);
      navigate('/booking-success');
    } else {
      toast.error('All bookings failed. Please try again.');
    }
  };

  // ─── No scope or empty ───────────────────────────────────────────────────
  if (!scopeVendor || !scopeCategory || scopedItems.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream via-background to-blush/20 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <Button variant="ghost" onClick={() => navigate('/cart')} className="mb-6"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Carts</Button>
          <Card className="border-gold/20">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <ShoppingBag className="w-16 h-16 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Nothing to checkout</h2>
              <p className="text-muted-foreground text-center mb-6">Add packages from an artist's profile to get started</p>
              <Button className="bg-gradient-gold hover:opacity-90" onClick={() => navigate('/artists')}>Browse Packages</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const validatedTotal = priceValidations.length > 0
    ? priceValidations.reduce((sum, v) => sum + (v.unavailable ? 0 : (v.changed ? v.currentPrice : v.cartPrice)), 0)
    : scopeTotal;
  const platformFee = feeConfig ? calculatePlatformFee(validatedTotal, feeConfig) : 0;
  const grandTotal = validatedTotal + platformFee;
  const advanceTotal = Math.round(grandTotal * ADVANCE_PERCENT / 100);
  const remainingBalance = grandTotal - advanceTotal;

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream via-background to-blush/20 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" onClick={() => step === 'review' ? navigate(`/cart?vendor=${scopeVendor}&category=${scopeCategory}`) : setStep(step === 'confirm' ? 'details' : 'review')} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" /> {step === 'review' ? 'Back to Cart' : 'Back'}
        </Button>

        <h1 className="text-2xl font-display font-bold mb-1">Checkout</h1>
        <p className="text-sm text-muted-foreground mb-4"><span className="font-semibold text-foreground">{providerName}</span> · <span className="capitalize">{scopeCategory}</span></p>

        <div className="flex items-center gap-2 mb-8 text-sm">
          <Badge variant={step === 'review' ? 'default' : 'secondary'} className={step === 'review' ? 'bg-gold' : ''}>1. Review</Badge>
          <span className="text-muted-foreground">→</span>
          <Badge variant={step === 'details' ? 'default' : 'secondary'} className={step === 'details' ? 'bg-gold' : ''}>2. Details</Badge>
          <span className="text-muted-foreground">→</span>
          <Badge variant={step === 'confirm' ? 'default' : 'secondary'} className={step === 'confirm' ? 'bg-gold' : ''}>3. Confirm</Badge>
        </div>

        {/* ─── Step 1: Review ─────────────────────────────────────────────── */}
        {step === 'review' && (
          <div className="space-y-6">
            {validating && <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 rounded-lg bg-muted/50"><Loader2 className="h-4 w-4 animate-spin" /> Validating prices...</div>}
            {unavailableItems.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-red-800 font-semibold text-sm"><AlertTriangle className="h-4 w-4" /> Unavailable</div>
                {unavailableItems.map(v => { const item = scopedItems.find(c => c.id === v.itemId); return item ? <div key={v.itemId} className="flex items-center justify-between text-sm text-red-700"><span>{item.packageName}</span><Button size="sm" variant="ghost" className="text-red-600 h-7" onClick={() => removeFromCart(v.itemId)}>Remove</Button></div> : null; })}
              </div>
            )}
            {changedItems.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm"><AlertTriangle className="h-4 w-4" /> Price Changed</div>
                {changedItems.map(v => { const item = scopedItems.find(c => c.id === v.itemId); return item ? <div key={v.itemId} className="text-sm text-amber-700"><span className="font-medium">{item.packageName}</span>: ₹{v.cartPrice.toLocaleString()} → ₹{v.currentPrice.toLocaleString()}</div> : null; })}
              </div>
            )}
            <Card className="border-gold/20">
              <CardHeader><CardTitle className="text-lg">Order Summary</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {scopedItems.map(item => {
                  const v = priceValidations.find(p => p.itemId === item.id);
                  const price = v?.changed ? v.currentPrice : item.price;
                  const unavailable = v?.unavailable;
                  return (
                    <div key={item.id} className={`flex items-start gap-3 p-3 rounded-lg border ${unavailable ? 'bg-red-50/50 border-red-200 opacity-60' : 'bg-muted/30 border-border'}`}>
                      {item.imageUrl && <img src={item.imageUrl} alt={item.packageName} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />}
                      <div className="flex-1 min-w-0"><h4 className="font-semibold text-sm">{item.packageName}</h4>{item.duration && <p className="text-xs text-muted-foreground">{item.duration}</p>}</div>
                      <p className={`font-semibold ${unavailable ? 'text-red-500' : 'text-gold'}`}>{unavailable ? 'N/A' : `₹${price.toLocaleString()}`}</p>
                    </div>
                  );
                })}
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>₹{validatedTotal.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Platform Fee{feeConfig?.type === 'percentage' ? ` (${feeConfig.rate}%)` : ''}</span><span>₹{platformFee.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm font-semibold"><span>Total</span><span>₹{grandTotal.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Advance Payable ({ADVANCE_PERCENT}%)</span><span className="font-medium text-[#8B1538]">₹{advanceTotal.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Remaining Balance</span><span>₹{remainingBalance.toLocaleString()}</span></div>
                </div>
              </CardContent>
            </Card>
            <Button className="w-full bg-gradient-gold hover:opacity-90 h-12 text-base" onClick={goToDetails} disabled={validating || hasIssues}>
              {validating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Validating...</> : 'Continue to Event Details'}
            </Button>
          </div>
        )}

        {/* ─── Step 2: Details ────────────────────────────────────────────── */}
        {step === 'details' && (
          <div className="space-y-6">
            <Card className="border-gold/20">
              <CardHeader><CardTitle>Event Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label>Event Date *</Label><Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} min={new Date().toISOString().split('T')[0]} /></div>
                  <div className="space-y-2"><Label>Event Time</Label><Input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} /></div>
                </div>
                <div className="space-y-2"><Label>Event Type *</Label><select className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm focus:border-gold focus:ring-2 focus:ring-gold/20" value={eventType} onChange={e => setEventType(e.target.value)}><option value="">Select</option>{EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              </CardContent>
            </Card>
            <Card className="border-gold/20"><CardHeader><CardTitle>Event Location</CardTitle></CardHeader><CardContent><LocationPicker value={location} onChange={setLocation} /></CardContent></Card>
            <Card className="border-gold/20"><CardHeader><CardTitle>Special Requirements</CardTitle></CardHeader><CardContent><Textarea value={specialRequirements} onChange={e => setSpecialRequirements(e.target.value)} placeholder="Any special requests (optional)..." rows={3} /></CardContent></Card>
            <Button className="w-full bg-gradient-gold hover:opacity-90 h-12 text-base" onClick={goToConfirm}>Review & Confirm</Button>
          </div>
        )}

        {/* ─── Step 3: Confirm ────────────────────────────────────────────── */}
        {step === 'confirm' && (
          <div className="space-y-6">
            <Card className="border-gold/20">
              <CardHeader><CardTitle>Booking Confirmation</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl bg-muted/50 p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Artist</span><span className="font-medium">{providerName}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span className="font-medium capitalize">{scopeCategory}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Event Type</span><span className="font-medium">{eventType}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="font-medium">{new Date(eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
                  {eventTime && <div className="flex justify-between"><span className="text-muted-foreground">Time</span><span className="font-medium">{eventTime}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">Location</span><span className="font-medium">{location.town_city}, {location.district}</span></div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Packages ({scopedItems.length})</h4>
                  {scopedItems.map(item => (<div key={item.id} className="flex justify-between items-center text-sm py-1.5 border-b border-border/50 last:border-0"><span className="font-medium">{item.packageName}</span><span className="font-semibold">₹{item.price.toLocaleString()}</span></div>))}
                </div>
                <div className="border-t pt-3 space-y-1.5">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>₹{validatedTotal.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Platform Fee{feeConfig?.type === 'percentage' ? ` (${feeConfig.rate}%)` : ''}</span><span>₹{platformFee.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm font-semibold"><span>Total</span><span>₹{grandTotal.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Advance Payable ({ADVANCE_PERCENT}%)</span><span className="font-medium text-[#8B1538]">₹{advanceTotal.toLocaleString()}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Remaining Balance</span><span>₹{remainingBalance.toLocaleString()}</span></div>
                </div>
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 space-y-2">
                  <h4 className="font-semibold text-sm text-emerald-800 flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" />What happens next</h4>
                  <ol className="text-xs text-emerald-700 space-y-1 list-decimal list-inside">
                    <li>Booking request sent to {providerName}</li>
                    <li>Artist reviews and accepts</li>
                    <li>You pay the advance (₹{advanceTotal.toLocaleString()})</li>
                    <li>Communication unlocked</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
            <Button className="w-full bg-gradient-gold hover:opacity-90 h-12 text-base" onClick={handleCheckout} disabled={submitting}>
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating Booking{scopedItems.length > 1 ? 's' : ''}...</> : `Confirm & Send ${scopedItems.length} Booking Request${scopedItems.length > 1 ? 's' : ''}`}
            </Button>
            <p className="text-xs text-center text-muted-foreground">No payment now. Advance is paid after vendor accepts.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Checkout;
