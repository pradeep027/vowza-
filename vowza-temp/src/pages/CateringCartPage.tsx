// ─── CateringCartPage — Full event catering review before checkout ─────────────
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationService } from '@/services/notificationService';
import { toast } from 'sonner';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import {
  ArrowLeft, Utensils, Users, Calendar, Clock, MapPin, Check,
  ChevronDown, ChevronUp, Leaf, Star, X, Plus, Minus, Loader2,
  Pencil, Trash2, Images, ChevronLeft, ChevronRight, AlertCircle,
  ShoppingBag,
} from 'lucide-react';

/* ─── Types ───────────────────────────────────────────────────────────────── */
interface CartData {
  pkg: any;
  provider: any;
  gallery: any[];
  menuSections: { name: string; items: any[] }[];
  addons: any[];
  event: { eventType: string; eventDate: string; eventTime: string; duration: string; venueName: string; venueAddress: string; city: string; state: string; pincode: string };
  guestCount: number;
  selectedAddonIds: string[];
  specialRequests: string;
  dietaryPrefs: string[];
}

const inputClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition placeholder:text-stone-400 focus:border-[#8b1538] focus:ring-2 focus:ring-[#8b1538]/15';

const EVENT_TYPES = ['Wedding', 'Reception', 'Engagement', 'Birthday', 'Corporate', 'Haldi', 'Sangeet', 'Baby Shower', 'Housewarming', 'Anniversary', 'College Fest', 'Private Party', 'Temple Event', 'Other'];

export default function CateringCartPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartData | null>(null);
  const [busy, setBusy] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Editing states
  const [editingGuests, setEditingGuests] = useState(false);
  const [editingEvent, setEditingEvent] = useState(false);
  const [editingRequests, setEditingRequests] = useState(false);
  const [menuExpanded, setMenuExpanded] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  // Load from sessionStorage
  useEffect(() => {
    const raw = sessionStorage.getItem('vowza_catering_cart');
    if (raw) {
      try { setCart(JSON.parse(raw)); } catch { navigate('/artists'); }
    } else {
      navigate('/artists');
    }
  }, [navigate]);

  // Persist changes back to sessionStorage
  const persistCart = useCallback((updated: CartData) => {
    setCart(updated);
    sessionStorage.setItem('vowza_catering_cart', JSON.stringify(updated));
  }, []);

  if (!cart) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-[#8b1538]" />
    </div>
  );

  const { pkg, provider, gallery, menuSections, addons, event, guestCount, selectedAddonIds, specialRequests, dietaryPrefs } = cart;

  // ─── Calculations ──────────────────────────────────────────────────────
  const pricePerPlate = Number(pkg.price_per_plate) || 0;
  const baseAmount = guestCount * pricePerPlate;
  const selectedAddons = addons.filter(a => selectedAddonIds.includes(a.id));
  const addonsAmount = selectedAddons.reduce((sum, a) => sum + (Number(a.price) || 0), 0);
  const grandTotal = baseAmount + addonsAmount;
  const advancePercent = 20;
  const advanceAmount = Math.round(grandTotal * (advancePercent / 100));
  const remainingBalance = grandTotal - advanceAmount;

  const plateIncludes: { section: string; quantity: string }[] = (() => {
    try { return JSON.parse(pkg.cancellation_policy || '[]'); } catch { return []; }
  })();

  const cover = gallery.find((g: any) => g.is_cover);
  const galleryImages = gallery.filter((g: any) => !g.is_cover);

  const fmtDate = (iso: string) => iso ? new Date(iso).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  // ─── Edit handlers ─────────────────────────────────────────────────────
  const updateGuestCount = (val: number) => {
    const min = pkg.min_guests || 1;
    const max = pkg.max_guests || 99999;
    const clamped = Math.max(min, Math.min(max, val));
    persistCart({ ...cart, guestCount: clamped });
  };

  const toggleAddon = (id: string) => {
    const updated = selectedAddonIds.includes(id) ? selectedAddonIds.filter(x => x !== id) : [...selectedAddonIds, id];
    persistCart({ ...cart, selectedAddonIds: updated });
  };

  const updateEvent = (field: string, value: string) => {
    persistCart({ ...cart, event: { ...event, [field]: value } });
  };

  const updateSpecialRequests = (val: string) => {
    persistCart({ ...cart, specialRequests: val });
  };

  const toggleDietary = (opt: string) => {
    const updated = dietaryPrefs.includes(opt) ? dietaryPrefs.filter(x => x !== opt) : [...dietaryPrefs, opt];
    persistCart({ ...cart, dietaryPrefs: updated });
  };

  const removeFromCart = () => {
    sessionStorage.removeItem('vowza_catering_cart');
    toast.success('Package removed from cart');
    navigate('/artists');
  };

  // ─── Checkout / Submit Booking ─────────────────────────────────────────
  const handleCheckout = async () => {
    if (!user) { toast.error('Please log in to book'); navigate('/auth'); return; }
    if (!termsAccepted) { toast.error('Please accept the terms'); return; }
    if (!event.eventDate) { toast.error('Please select an event date'); return; }
    if (guestCount < (pkg.min_guests || 1)) { toast.error(`Minimum ${pkg.min_guests} guests required`); return; }
    setBusy(true);

    try {
      // Verify package still active
      const { data: freshPkg } = await supabase.from('catering_packages' as any).select('id, status').eq('id', pkg.id).single();
      if (!freshPkg || freshPkg.status !== 'active') { toast.error('This package is no longer available'); setBusy(false); return; }

      // Self-booking check: vendor cannot book their own package
      const { data: vendorCheck } = await supabase.from('provider_profiles' as any).select('id').eq('id', provider.id).eq('user_id', user.id).single();
      if (vendorCheck) { toast.error('You cannot book your own package.'); setBusy(false); return; }

      // Double-booking check
      const { data: existing } = await supabase.from('catering_bookings' as any).select('id').eq('package_id', pkg.id).eq('customer_id', user.id).eq('event_date', event.eventDate).neq('status', 'cancelled');
      if (existing && existing.length > 0) { toast.error('You already have a booking for this package on this date'); setBusy(false); return; }

      // Create booking
      const { data: booking, error } = await supabase.from('catering_bookings' as any).insert({
        package_id: pkg.id,
        provider_id: provider.id,
        customer_id: user.id,
        event_type: event.eventType || null,
        event_date: event.eventDate,
        guest_count: guestCount,
        meal_type: event.duration || null,
        venue: [event.venueName, event.venueAddress, event.city, event.state, event.pincode].filter(Boolean).join(', '),
        special_requests: [specialRequests, dietaryPrefs.length ? `Dietary: ${dietaryPrefs.join(', ')}` : ''].filter(Boolean).join(' | ') || null,
        selected_addon_ids: selectedAddonIds,
        base_amount: baseAmount,
        addons_amount: addonsAmount,
        total_amount: grandTotal,
        status: 'pending',
      }).select('id').single();

      if (error) throw error;

      await NotificationService.notifyBookingReceived(user.id, provider.id, booking.id);

      sessionStorage.removeItem('vowza_catering_cart');
      sessionStorage.setItem('vowza_booking_success', JSON.stringify({
        bookingId: booking.id,
        artistName: provider.business_name || provider.contact_person || 'Caterer',
        eventDate: event.eventDate,
        eventTime: event.eventTime,
        duration: event.duration,
        venue: [event.venueAddress, event.city].filter(Boolean).join(', '),
        amount: grandTotal,
        advanceAmount,
        remainingBalance,
        eventType: event.eventType || 'Catering',
        status: 'pending',
      }));

      toast.success('Catering booking confirmed!');
      navigate('/booking-success');
    } catch (err: any) {
      toast.error(err.message || 'Could not create booking');
    } finally {
      setBusy(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fffaf3] via-background to-[#fff5eb]">
      <Navbar />
      <main className="pt-20 pb-16 px-4">
        <div className="mx-auto max-w-5xl">
          {/* Back button */}
          <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />Back to packages
          </button>

          {/* Page title */}
          <div className="mb-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8b1538]/10">
                <ShoppingBag className="h-5 w-5 text-[#8b1538]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#3d1924]">Catering Order Review</h1>
                <p className="text-sm text-muted-foreground">Review all details before confirming your booking</p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr,380px]">
            {/* ─── Main Content ─────────────────────────────────────── */}
            <div className="space-y-6">
              {/* Package Details */}
              <section className="rounded-2xl border border-[#eadfcf] bg-white overflow-hidden shadow-sm">
                {cover && (
                  <div className="h-48 sm:h-56 overflow-hidden">
                    <img src={cover.public_url} alt={pkg.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-[#3d1924]">{pkg.name}</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">{provider.business_name || provider.contact_person || 'Caterer'}</p>
                      {pkg.description && <p className="mt-2 text-sm text-stone-600">{pkg.description}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-2xl font-bold text-[#8b1538]">₹{pricePerPlate.toLocaleString('en-IN')}</p>
                      <p className="text-xs text-muted-foreground">per plate</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs"><Users className="h-3 w-3" />{pkg.min_guests}–{pkg.max_guests} guests</span>
                    {pkg.is_veg && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs text-emerald-700"><Leaf className="h-3 w-3" />Veg</span>}
                    {pkg.is_nonveg && <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs text-red-700">Non-Veg</span>}
                    {(pkg.cuisine_types ?? []).map((c: string) => (
                      <span key={c} className="rounded-full bg-[#8b1538]/8 px-2.5 py-1 text-xs font-medium text-[#8b1538]">{c}</span>
                    ))}
                  </div>
                </div>
              </section>

              {/* Event Details */}
              <section className="rounded-2xl border border-[#eadfcf] bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-[#62132d] flex items-center gap-2"><Calendar className="h-4 w-4" />Event Details</h3>
                  <button onClick={() => setEditingEvent(!editingEvent)} className="text-xs font-semibold text-[#8b1538] hover:underline flex items-center gap-1">
                    <Pencil className="h-3 w-3" />{editingEvent ? 'Done' : 'Edit'}
                  </button>
                </div>
                {!editingEvent ? (
                  <div className="grid gap-3 sm:grid-cols-2 text-sm">
                    <div><span className="text-muted-foreground">Event Type:</span> <span className="font-semibold">{event.eventType || '—'}</span></div>
                    <div><span className="text-muted-foreground">Date:</span> <span className="font-semibold">{fmtDate(event.eventDate)}</span></div>
                    <div><span className="text-muted-foreground">Time:</span> <span className="font-semibold">{event.eventTime || '—'}</span></div>
                    <div><span className="text-muted-foreground">Duration:</span> <span className="font-semibold">{event.duration}</span></div>
                    <div className="sm:col-span-2"><span className="text-muted-foreground">Venue:</span> <span className="font-semibold">{[event.venueName, event.venueAddress, event.city, event.state, event.pincode].filter(Boolean).join(', ') || '—'}</span></div>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-[#4b1d2b]">Event Type</label>
                      <select className={inputClass} value={event.eventType} onChange={e => updateEvent('eventType', e.target.value)}>
                        <option value="">Select</option>
                        {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[#4b1d2b]">Date</label>
                      <input type="date" min={new Date().toISOString().slice(0, 10)} className={inputClass} value={event.eventDate} onChange={e => updateEvent('eventDate', e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[#4b1d2b]">Time</label>
                      <input type="time" className={inputClass} value={event.eventTime} onChange={e => updateEvent('eventTime', e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[#4b1d2b]">Duration</label>
                      <select className={inputClass} value={event.duration} onChange={e => updateEvent('duration', e.target.value)}>
                        {['2 Hours','4 Hours','6 Hours','8 Hours','Full Day','2 Days'].map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[#4b1d2b]">Venue Name</label>
                      <input className={inputClass} value={event.venueName} onChange={e => updateEvent('venueName', e.target.value)} placeholder="Venue name" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[#4b1d2b]">Address</label>
                      <input className={inputClass} value={event.venueAddress} onChange={e => updateEvent('venueAddress', e.target.value)} placeholder="Full address" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[#4b1d2b]">City</label>
                      <input className={inputClass} value={event.city} onChange={e => updateEvent('city', e.target.value)} placeholder="City" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[#4b1d2b]">State</label>
                      <input className={inputClass} value={event.state} onChange={e => updateEvent('state', e.target.value)} placeholder="State" />
                    </div>
                  </div>
                )}
              </section>

              {/* Guest Count */}
              <section className="rounded-2xl border border-[#eadfcf] bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-[#62132d] flex items-center gap-2"><Users className="h-4 w-4" />Guest Count</h3>
                  <button onClick={() => setEditingGuests(!editingGuests)} className="text-xs font-semibold text-[#8b1538] hover:underline flex items-center gap-1">
                    <Pencil className="h-3 w-3" />{editingGuests ? 'Done' : 'Edit'}
                  </button>
                </div>
                {!editingGuests ? (
                  <div className="flex items-center gap-4">
                    <span className="text-3xl font-bold text-[#8b1538]">{guestCount}</span>
                    <span className="text-sm text-muted-foreground">guests × ₹{pricePerPlate.toLocaleString('en-IN')}/plate = <span className="font-bold text-[#3d1924]">₹{baseAmount.toLocaleString('en-IN')}</span></span>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <button onClick={() => updateGuestCount(guestCount - 10)} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e7d9c4] hover:bg-[#8b1538]/10 transition"><Minus className="h-4 w-4" /></button>
                    <input type="number" min={pkg.min_guests || 1} max={pkg.max_guests || 99999} className="w-28 text-center text-2xl font-bold rounded-xl border border-[#e7d9c4] py-2 outline-none focus:border-[#8b1538]"
                      value={guestCount} onChange={e => updateGuestCount(parseInt(e.target.value) || 0)} />
                    <button onClick={() => updateGuestCount(guestCount + 10)} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e7d9c4] hover:bg-[#8b1538]/10 transition"><Plus className="h-4 w-4" /></button>
                    <span className="text-xs text-muted-foreground">Min: {pkg.min_guests} / Max: {pkg.max_guests}</span>
                  </div>
                )}
              </section>

              {/* One Plate Includes */}
              {plateIncludes.length > 0 && (
                <section className="rounded-2xl border border-[#eadfcf] bg-white p-6 shadow-sm">
                  <h3 className="text-base font-bold text-[#62132d] mb-4 flex items-center gap-2"><Utensils className="h-4 w-4" />One Plate Includes</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {plateIncludes.filter(p => p.section).map((inc, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
                        <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="text-xs text-stone-700"><span className="font-semibold">{inc.quantity}</span> {inc.section}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Full Menu */}
              {menuSections.length > 0 && (
                <section className="rounded-2xl border border-[#eadfcf] bg-white p-6 shadow-sm">
                  <button onClick={() => setMenuExpanded(!menuExpanded)} className="w-full flex items-center justify-between">
                    <h3 className="text-base font-bold text-[#62132d] flex items-center gap-2"><Utensils className="h-4 w-4" />Full Menu ({menuSections.reduce((s, sec) => s + sec.items.length, 0)} items)</h3>
                    {menuExpanded ? <ChevronUp className="h-5 w-5 text-stone-400" /> : <ChevronDown className="h-5 w-5 text-stone-400" />}
                  </button>
                  {menuExpanded && (
                    <div className="mt-4 space-y-4">
                      {menuSections.map((sec, si) => (
                        <div key={si}>
                          <p className="text-xs font-bold uppercase tracking-wide text-[#8b1538] mb-2">{sec.name}</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {sec.items.map((item: any, ii: number) => (
                              <div key={ii} className="flex items-center gap-2 rounded-lg border border-stone-100 bg-stone-50/50 px-3 py-2">
                                {item.is_veg ? <Leaf className="h-3 w-3 text-emerald-600 shrink-0" /> : <span className="h-3 w-3 rounded-sm bg-red-500 shrink-0" />}
                                <span className="text-sm text-stone-700 flex-1">{item.name}</span>
                                {item.is_bestseller && <Star className="h-3 w-3 text-amber-500" />}
                                {item.is_premium && <span className="text-[9px] font-bold text-[#8b1538] bg-[#8b1538]/10 px-1.5 py-0.5 rounded">Premium</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* Selected Add-ons */}
              <section className="rounded-2xl border border-[#eadfcf] bg-white p-6 shadow-sm">
                <h3 className="text-base font-bold text-[#62132d] mb-4">Selected Add-ons</h3>
                {selectedAddons.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No add-ons selected</p>
                ) : (
                  <div className="space-y-2 mb-4">
                    {selectedAddons.map(addon => (
                      <div key={addon.id} className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-emerald-600" />
                          <div>
                            <p className="text-sm font-semibold text-[#3d1924]">{addon.name}</p>
                            {addon.description && <p className="text-xs text-muted-foreground">{addon.description}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-[#8b1538]">₹{Number(addon.price).toLocaleString('en-IN')}</span>
                          <button onClick={() => toggleAddon(addon.id)} className="rounded-full p-1 text-red-400 hover:bg-red-50 hover:text-red-600 transition"><X className="h-4 w-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Add more add-ons */}
                {addons.filter(a => !selectedAddonIds.includes(a.id)).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Add more:</p>
                    <div className="flex flex-wrap gap-2">
                      {addons.filter(a => !selectedAddonIds.includes(a.id)).map(addon => (
                        <button key={addon.id} onClick={() => toggleAddon(addon.id)}
                          className="rounded-full border border-[#e7d9c4] px-3 py-1.5 text-xs font-medium text-stone-600 hover:border-[#8b1538] hover:text-[#8b1538] transition">
                          <Plus className="inline h-3 w-3 mr-1" />{addon.name} (+₹{Number(addon.price).toLocaleString('en-IN')})
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* Special Requests */}
              <section className="rounded-2xl border border-[#eadfcf] bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-[#62132d]">Special Requests</h3>
                  <button onClick={() => setEditingRequests(!editingRequests)} className="text-xs font-semibold text-[#8b1538] hover:underline flex items-center gap-1">
                    <Pencil className="h-3 w-3" />{editingRequests ? 'Done' : 'Edit'}
                  </button>
                </div>
                {!editingRequests ? (
                  <div>
                    {dietaryPrefs.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {dietaryPrefs.map(p => (
                          <span key={p} className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">{p}</span>
                        ))}
                      </div>
                    )}
                    {specialRequests ? <p className="text-sm text-stone-600">{specialRequests}</p> : <p className="text-sm text-muted-foreground">No special requests</p>}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {['Jain Counter', 'No Onion/Garlic', 'Kids Menu', 'Extra Spicy', 'Separate Buffet', 'Sugar Free', 'Gluten Free'].map(opt => (
                        <button key={opt} onClick={() => toggleDietary(opt)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${dietaryPrefs.includes(opt) ? 'border-[#8b1538] bg-[#8b1538]/10 text-[#8b1538]' : 'border-[#e7d9c4] text-stone-600 hover:border-[#c99b43]'}`}>
                          {opt}
                        </button>
                      ))}
                    </div>
                    <textarea className={`${inputClass} min-h-[80px] resize-y`} placeholder="Timing notes, special arrangements..."
                      value={specialRequests} onChange={e => updateSpecialRequests(e.target.value)} />
                  </div>
                )}
              </section>

              {/* Package Gallery */}
              {galleryImages.length > 0 && (
                <section className="rounded-2xl border border-[#eadfcf] bg-white p-6 shadow-sm">
                  <h3 className="text-base font-bold text-[#62132d] mb-4 flex items-center gap-2"><Images className="h-4 w-4" />Package Gallery</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {galleryImages.slice(0, 8).map((img: any, i: number) => (
                      <button key={i} onClick={() => setLightboxIdx(i)} className="aspect-square overflow-hidden rounded-lg border border-[#eadfcf] hover:opacity-90 transition focus:outline-none focus:ring-2 focus:ring-[#8b1538]/30">
                        <img src={img.public_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* ─── Sidebar: Price + Actions ─────────────────────────── */}
            <aside className="lg:sticky lg:top-24 self-start space-y-5">
              {/* Price Breakdown */}
              <div className="rounded-2xl border border-[#eadfcf] bg-white p-6 shadow-sm">
                <h3 className="text-base font-bold text-[#62132d] mb-4">Price Breakdown</h3>
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">₹{pricePerPlate.toLocaleString('en-IN')} × {guestCount} guests</span>
                    <span className="font-semibold">₹{baseAmount.toLocaleString('en-IN')}</span>
                  </div>
                  {selectedAddons.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Add-ons ({selectedAddons.length})</span>
                      <span className="font-semibold">₹{addonsAmount.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="border-t border-[#eadfcf] pt-2.5 flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-[#8b1538]">₹{grandTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Payment structure */}
                <div className="mt-4 rounded-xl bg-[#8b1538]/5 border border-[#8b1538]/15 p-3">
                  <p className="text-xs font-bold text-[#8b1538] mb-1.5">Payment Structure</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span>Advance ({advancePercent}%)</span><span className="font-bold">₹{advanceAmount.toLocaleString('en-IN')}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>On event day</span><span>₹{remainingBalance.toLocaleString('en-IN')}</span></div>
                  </div>
                </div>
              </div>

              {/* Terms + Checkout */}
              <div className="rounded-2xl border border-[#eadfcf] bg-white p-6 shadow-sm space-y-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="mt-1 accent-[#8b1538]" />
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    I agree to the <a href="/terms" target="_blank" className="text-[#8b1538] underline">Terms</a>,{' '}
                    <a href="/terms" target="_blank" className="text-[#8b1538] underline">Cancellation Policy</a>, and{' '}
                    <a href="/privacy" target="_blank" className="text-[#8b1538] underline">Privacy Policy</a>.
                  </span>
                </label>

                <button disabled={busy || !termsAccepted} onClick={handleCheckout}
                  className="w-full rounded-xl bg-[#8b1538] py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#70102d] disabled:opacity-60">
                  {busy ? <><Loader2 className="inline h-4 w-4 mr-2 animate-spin" />Processing…</> : 'Confirm & Book Now'}
                </button>

                <button onClick={() => navigate('/artists')} className="w-full rounded-xl border border-[#e7d9c4] py-3 text-sm font-semibold text-[#5a3440] transition hover:bg-secondary/50">
                  Continue Browsing
                </button>

                <button onClick={removeFromCart} className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-red-200 py-2.5 text-xs font-semibold text-red-600 transition hover:bg-red-50">
                  <Trash2 className="h-3.5 w-3.5" />Remove from Cart
                </button>
              </div>
            </aside>
          </div>
        </div>
      </main>

      {/* Lightbox */}
      {lightboxIdx !== null && galleryImages.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={() => setLightboxIdx(null)}>
          <button className="absolute top-4 right-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" onClick={() => setLightboxIdx(null)}><X className="h-6 w-6" /></button>
          <div className="absolute top-4 left-4 z-10 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white">{lightboxIdx + 1}/{galleryImages.length}</div>
          {galleryImages.length > 1 && <button onClick={e => { e.stopPropagation(); setLightboxIdx((lightboxIdx - 1 + galleryImages.length) % galleryImages.length); }} className="absolute left-3 z-10 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20"><ChevronLeft className="h-6 w-6" /></button>}
          <img src={galleryImages[lightboxIdx].public_url} alt="" className="max-h-[80vh] max-w-[90vw] rounded-xl object-contain" onClick={e => e.stopPropagation()} />
          {galleryImages.length > 1 && <button onClick={e => { e.stopPropagation(); setLightboxIdx((lightboxIdx + 1) % galleryImages.length); }} className="absolute right-3 z-10 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20"><ChevronRight className="h-6 w-6" /></button>}
        </div>
      )}

      <Footer />
    </div>
  );
}
