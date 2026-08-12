import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Check, ChevronDown, ChevronUp, Clock, Calendar, X, ChevronLeft, ChevronRight, Loader2, AlertCircle, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { NotificationService } from '@/services/notificationService';
import { toast } from 'sonner';
import LocationPicker, { type LocationData, validateLocationData, emptyLocationData } from '@/components/booking/LocationPicker';
import ScopedCartBar from '@/components/ScopedCartBar';

const inputClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition placeholder:text-stone-400 focus:border-[#8b1538] focus:ring-2 focus:ring-[#8b1538]/15';

export default function MakeupMenu({ provider, profile }: { provider: any; profile: any }) {
  const { user } = useAuth();
  const { addToCart, isInCart } = useCart();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [bookingPkg, setBookingPkg] = useState<any>(null);
  const [bookingAddons, setBookingAddons] = useState<any[]>([]);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['public-makeup-packages', provider.id],
    queryFn: async () => {
      const r = await supabase.from('makeup_packages' as any).select('*, makeup_gallery(*), makeup_addons(*)').eq('provider_id', provider.id).eq('status', 'active').order('created_at');
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });

  useEffect(() => {
    const channel = supabase.channel(`public-makeup-${provider.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'makeup_packages', filter: `provider_id=eq.${provider.id}` }, () => qc.invalidateQueries({ queryKey: ['public-makeup-packages', provider.id] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [provider.id]);

  const toggle = (id: string) => setExpanded(s => ({ ...s, [id]: !s[id] }));

  const handleBook = (pkg: any) => {
    if (!user) { toast.error('Please log in to book'); return nav('/auth'); }
    setBookingAddons(pkg.makeup_addons ?? []);
    setBookingPkg(pkg);
  };

  if (isLoading) return <div className="h-48 animate-pulse rounded-2xl bg-muted" />;
  if (!packages.length) return <div className="rounded-2xl border border-border/60 bg-surface-1 p-10 text-center text-sm text-muted-foreground">This makeup artist has not published any packages yet.</div>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">Makeup Packages</h2>
        <p className="text-sm text-muted-foreground">Browse makeup packages and book your look.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {packages.map((pkg: any) => {
          const isOpen = expanded[pkg.id];
          const gallery = pkg.makeup_gallery ?? [];
          const cover = gallery.find((g: any) => g.is_cover);
          const addons = pkg.makeup_addons ?? [];
          const price = pkg.package_price || 0;

          return (
            <div key={pkg.id} className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm transition hover:shadow-md">
              <div className="relative h-44 sm:h-52 bg-gradient-to-br from-pink-50 to-amber-50 overflow-hidden">
                {cover ? (
                  <img src={cover.public_url} alt={pkg.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full items-center justify-center"><Sparkles className="h-12 w-12 text-pink-400/40" /></div>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-foreground leading-tight">{pkg.name}</h3>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-[#8b1538]">₹{Number(price).toLocaleString('en-IN')}</p>
                    <p className="text-xs text-muted-foreground">package</p>
                  </div>
                </div>
                {pkg.description && <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{pkg.description}</p>}

                {/* Package type badge */}
                {pkg.package_type && (
                  <div className="mt-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#f4d58d]/30 border border-[#f4d58d]/50 px-2.5 py-0.5 text-[11px] font-medium text-[#62132d]">
                      <Sparkles className="h-3 w-3" />{pkg.package_type}
                    </span>
                  </div>
                )}

                {/* Services chips */}
                {(pkg.services_included ?? []).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {pkg.services_included.slice(0, 5).map((s: string) => (
                      <span key={s} className="inline-flex items-center rounded-full bg-pink-50 border border-pink-100 px-2 py-0.5 text-[11px] text-pink-700">
                        {s}
                      </span>
                    ))}
                    {pkg.services_included.length > 5 && <span className="text-[11px] text-muted-foreground">+{pkg.services_included.length - 5} more</span>}
                  </div>
                )}

                {/* Brands */}
                {(pkg.brands ?? []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {pkg.brands.slice(0, 4).map((b: string) => (
                      <span key={b} className="inline-flex items-center rounded-full bg-amber-50 border border-amber-100 px-2 py-0.5 text-[11px] text-amber-700">
                        {b}
                      </span>
                    ))}
                    {pkg.brands.length > 4 && <span className="text-[11px] text-muted-foreground">+{pkg.brands.length - 4} more</span>}
                  </div>
                )}

                {/* Expanded details */}
                {isOpen && (
                  <div className="mt-3 space-y-3">
                    {/* All services */}
                    {(pkg.services_included ?? []).length > 0 && (
                      <div className="rounded-xl bg-secondary/50 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#62132d] mb-1">All Services</p>
                        <div className="flex flex-wrap gap-1">
                          {pkg.services_included.map((s: string) => (
                            <span key={s} className="rounded-full border border-[#e7d9c4] px-2 py-0.5 text-xs text-stone-600">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Deliverables */}
                    {(pkg.deliverables ?? []).length > 0 && (
                      <div className="rounded-xl bg-pink-50/60 border border-pink-100 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-pink-700 mb-1">Deliverables</p>
                        <div className="flex flex-wrap gap-1">
                          {pkg.deliverables.map((d: string) => (
                            <span key={d} className="rounded-full border border-pink-200 px-2 py-0.5 text-xs text-pink-800">{d}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Team info */}
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      {pkg.lead_artist > 0 && <span>Lead: {pkg.lead_artist}</span>}
                      {pkg.hair_stylists > 0 && <span>Hair Stylists: {pkg.hair_stylists}</span>}
                      {pkg.assistant_artists > 0 && <span>Assistants: {pkg.assistant_artists}</span>}
                    </div>

                    {/* Brands */}
                    {(pkg.brands ?? []).length > 0 && (
                      <div className="rounded-xl bg-amber-50/60 border border-amber-100 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 mb-1">Brands Used</p>
                        <div className="flex flex-wrap gap-1">
                          {pkg.brands.map((b: string) => (
                            <span key={b} className="rounded-full border border-amber-200 px-2 py-0.5 text-xs text-amber-800">{b}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Skin Types */}
                    {(pkg.skin_types ?? []).length > 0 && (
                      <div className="rounded-xl bg-rose-50/60 border border-rose-100 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-rose-700 mb-1">Skin Types Catered</p>
                        <div className="flex flex-wrap gap-1">
                          {pkg.skin_types.map((s: string) => (
                            <span key={s} className="rounded-full border border-rose-200 px-2 py-0.5 text-xs text-rose-800">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}

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
                  onClick={() => { if (!user) { toast.error('Please log in'); return nav('/auth'); } addToCart({ packageId: pkg.id, providerId: provider.id, providerName: profile?.full_name || 'Artist', category: 'makeup', packageTable: 'makeup_packages', bookingTable: 'makeup_bookings', packageName: pkg.name, price: Number(pkg.package_price || pkg.price || 0), duration: pkg.duration || undefined, imageUrl: (pkg.makeup_gallery ?? []).find((g: any) => g.is_cover)?.public_url || undefined }); }}
                  disabled={isInCart(pkg.id, 'makeup')}
                  className="mt-2 w-full rounded-xl border border-[#8b1538]/20 bg-[#8b1538]/5 py-2 text-xs font-semibold text-[#8b1538] transition hover:bg-[#8b1538]/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <ShoppingCart className="h-3 w-3" />{isInCart(pkg.id, 'makeup') ? 'In Cart' : 'Add to Cart'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <ScopedCartBar providerId={provider.id} category="makeup" />
      {/* Booking Modal */}
      {bookingPkg && (
        <MakeupBookingModal
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


/* ─── Makeup Booking Modal ─────────────────────────────────────────────────── */
function MakeupBookingModal({ isOpen, onClose, pkg, provider, addons }: { isOpen: boolean; onClose: () => void; pkg: any; provider: any; addons: any[] }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [location, setLocation] = useState<LocationData>(emptyLocationData);
  const [eventType, setEventType] = useState('');
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [specialRequests, setSpecialRequests] = useState('');
  const [skinType, setSkinType] = useState('');
  const [allergies, setAllergies] = useState('');
  const [lookPreference, setLookPreference] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(1); setEventDate(''); setEventTime('');
      setLocation(emptyLocationData); setEventType('');
      setSelectedAddonIds([]); setSpecialRequests('');
      setSkinType(''); setAllergies(''); setLookPreference('');
      setTermsAccepted(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const baseAmount = Number(pkg.package_price || 0);
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
      const { data: booking, error } = await supabase.from('makeup_bookings' as any).insert({
        package_id: pkg.id,
        provider_id: provider.id,
        customer_id: user.id,
        event_date: eventDate,
        event_time: eventTime || null,
        venue: location.venue_name || location.locality || null,
        city: location.town_city || null,
        event_type: eventType || null,
        selected_addon_ids: selectedAddonIds,
        special_requirements: [
          skinType && `Skin Type: ${skinType}`,
          allergies && `Allergies: ${allergies}`,
          lookPreference && `Look: ${lookPreference}`,
          specialRequests
        ].filter(Boolean).join('\n') || null,
        base_amount: baseAmount,
        addons_amount: addonsAmount,
        total_amount: total,
        status: 'pending',
      }).select('id').single();
      if (error) throw error;

      // Save structured location
      await supabase.from('booking_locations' as any).insert({
        booking_table: 'makeup_bookings', booking_id: booking.id,
        state: location.state, district: location.district, town_city: location.town_city,
        exact_address: [location.venue_name, location.locality, location.address_line].filter(Boolean).join(', '),
        pincode: location.pincode, landmark: location.address_line || null,
        latitude: location.latitude, longitude: location.longitude,
      });

      await NotificationService.notifyBookingReceived(user.id, provider.id, booking.id);

      sessionStorage.setItem('vowza_booking_success', JSON.stringify({
        bookingId: booking.id,
        artistName: provider.business_name || provider.contact_person || 'Makeup Artist',
        eventDate, eventTime,
        venue: location.venue_name || location.locality || 'TBD',
        city: location.town_city || '',
        amount: total,
        advanceAmount, remainingBalance: remaining,
        eventType: pkg.package_type || 'Makeup',
        status: 'pending',
      }));

      toast.success('Makeup booking request sent!');
      onClose();
      nav('/booking-success');
    } catch (err: any) {
      toast.error(err.message || 'Could not create booking');
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  const STEPS = ['Package', 'Event', 'Add-ons', 'Special Requirements', 'Summary', 'Confirm'];

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#250914]/65 p-3 backdrop-blur-sm sm:p-6">
      <div className="mx-auto my-3 max-w-2xl overflow-hidden rounded-[24px] bg-[#fffaf3] shadow-2xl">
        <header className="flex items-start justify-between gap-4 bg-[#70102d] px-5 py-5 sm:px-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f4d58d]">Vowza Makeup</p>
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
                {i < 5 && <div className={`mx-0.5 h-0.5 w-3 sm:w-4 rounded ${step > i+1 ? 'bg-emerald-400' : 'bg-[#e7d9c4]'}`} />}
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 sm:p-7 max-h-[60vh] overflow-y-auto">

          {/* Step 1: Package Preview */}
          {step === 1 && (
            <div className="rounded-2xl border border-[#eadfcf] bg-white p-5">
              <h3 className="font-bold text-[#3d1924] mb-2">{pkg.name}</h3>
              {pkg.description && <p className="text-sm text-muted-foreground mb-3">{pkg.description}</p>}
              <p className="text-xl font-bold text-[#8b1538]">₹{baseAmount.toLocaleString('en-IN')}</p>
              {pkg.package_type && <p className="mt-1 text-xs text-muted-foreground"><Sparkles className="inline h-3 w-3 mr-1" />Type: {pkg.package_type}</p>}
              {(pkg.services_included ?? []).length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-stone-600 mb-1">Services Included:</p>
                  <div className="flex flex-wrap gap-1">
                    {pkg.services_included.map((s: string) => (
                      <span key={s} className="rounded-full bg-[#8b1538]/8 px-2 py-0.5 text-[11px] text-[#8b1538]">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {(pkg.brands ?? []).length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-stone-600 mb-1">Brands Used:</p>
                  <div className="flex flex-wrap gap-1">
                    {pkg.brands.map((b: string) => (
                      <span key={b} className="rounded-full bg-[#f4d58d]/30 px-2 py-0.5 text-[11px] text-[#62132d]">{b}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Event Details */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-4">
                <h3 className="font-bold text-[#3d1924]">Event Details</h3>
                <label className="block">
                  <span className="text-sm font-semibold text-[#4b1d2b]">Event Date <span className="text-red-500">*</span></span>
                  <input type="date" className={inputClass} value={eventDate}
                    onChange={e => setEventDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#4b1d2b]">Event Time</span>
                  <input type="time" className={inputClass} value={eventTime}
                    onChange={e => setEventTime(e.target.value)} />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#4b1d2b]">Event Type</span>
                  <select className={inputClass} value={eventType}
                    onChange={e => setEventType(e.target.value)}>
                    <option value="">Select event type</option>
                    {['Wedding','Reception','Engagement','Haldi','Mehendi','Party','Birthday','Corporate','Other'].map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <LocationPicker value={location} onChange={setLocation} compact />
              </div>
            </div>
          )}

          {/* Step 3: Add-ons */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-4">
                <h3 className="font-bold text-[#3d1924]">Add-ons</h3>
                <p className="text-xs text-stone-500">Select optional extras to enhance your look.</p>
                {addons.length > 0 ? (
                  <div className="space-y-2">
                    {addons.map((addon: any) => (
                      <label key={addon.id} className={`flex items-center justify-between rounded-xl border p-3.5 cursor-pointer transition ${
                        selectedAddonIds.includes(addon.id) ? 'border-[#8b1538] bg-[#8b1538]/5' : 'border-[#e7d9c4] hover:border-[#c99b43]'
                      }`}>
                        <div className="flex items-center gap-3">
                          <input type="checkbox" checked={selectedAddonIds.includes(addon.id)}
                            onChange={() => toggleAddon(addon.id)}
                            className="h-4 w-4 rounded border-[#e7d9c4] text-[#8b1538] focus:ring-[#8b1538]/20" />
                          <div>
                            <p className="text-sm font-semibold text-[#3d1924]">{addon.name}</p>
                            {addon.description && <p className="text-xs text-stone-500">{addon.description}</p>}
                          </div>
                        </div>
                        <span className="text-sm font-bold text-[#8b1538]">+₹{Number(addon.price).toLocaleString('en-IN')}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-stone-400 text-center py-4">No add-ons available for this package.</p>
                )}
                {selectedAddonIds.length > 0 && (
                  <div className="rounded-xl border border-[#eadfcf] bg-[#fffdfa] p-3">
                    <p className="text-xs font-semibold text-stone-600">Add-ons total: <span className="text-[#8b1538]">₹{addonsAmount.toLocaleString('en-IN')}</span></p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Special Requirements */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-4">
                <h3 className="font-bold text-[#3d1924]">Special Requirements</h3>
                <label className="block">
                  <span className="text-sm font-semibold text-[#4b1d2b]">Skin Type</span>
                  <select className={inputClass} value={skinType}
                    onChange={e => setSkinType(e.target.value)}>
                    <option value="">Select skin type</option>
                    {['Dry','Oily','Combination','Sensitive','Normal'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#4b1d2b]">Allergies / Sensitivities</span>
                  <input className={inputClass} value={allergies}
                    onChange={e => setAllergies(e.target.value)}
                    placeholder="Any known allergies to cosmetics or ingredients" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#4b1d2b]">Look Preference</span>
                  <input className={inputClass} value={lookPreference}
                    onChange={e => setLookPreference(e.target.value)}
                    placeholder="e.g. Natural, Glam, Dewy, Matte, Bold" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#4b1d2b]">Special Instructions</span>
                  <textarea className={`${inputClass} min-h-[100px] resize-y`} value={specialRequests}
                    onChange={e => setSpecialRequests(e.target.value)}
                    placeholder="Any specific requirements, inspiration images, or references for the artist..." />
                </label>
              </div>
            </div>
          )}

          {/* Step 5: Summary */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-3">
                <h3 className="font-bold text-[#3d1924]">Booking Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-stone-600">Package</span><span className="font-semibold">{pkg.name}</span></div>
                  {pkg.package_type && <div className="flex justify-between"><span className="text-stone-600">Type</span><span className="font-medium">{pkg.package_type}</span></div>}
                  {eventDate && <div className="flex justify-between"><span className="text-stone-600">Date</span><span className="font-medium">{new Date(eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>}
                  {eventTime && <div className="flex justify-between"><span className="text-stone-600">Time</span><span className="font-medium">{eventTime}</span></div>}
                  {location.venue_name && <div className="flex justify-between"><span className="text-stone-600">Venue</span><span className="font-medium">{location.venue_name}</span></div>}
                  {location.town_city && <div className="flex justify-between"><span className="text-stone-600">City</span><span className="font-medium">{location.town_city}, {location.district}</span></div>}
                  {location.state && <div className="flex justify-between"><span className="text-stone-600">State</span><span className="font-medium">{location.state}</span></div>}
                  {eventType && <div className="flex justify-between"><span className="text-stone-600">Event Type</span><span className="font-medium">{eventType}</span></div>}
                  {skinType && <div className="flex justify-between"><span className="text-stone-600">Skin Type</span><span className="font-medium">{skinType}</span></div>}
                  {lookPreference && <div className="flex justify-between"><span className="text-stone-600">Look</span><span className="font-medium">{lookPreference}</span></div>}
                </div>

                {/* Pricing */}
                <div className="border-t border-[#eadfcf] pt-3 space-y-1.5">
                  <div className="flex justify-between text-sm"><span className="text-stone-600">Base Price</span><span>₹{baseAmount.toLocaleString('en-IN')}</span></div>
                  {addonsAmount > 0 && <div className="flex justify-between text-sm"><span className="text-stone-600">Add-ons</span><span>₹{addonsAmount.toLocaleString('en-IN')}</span></div>}
                  <div className="flex justify-between text-base font-bold border-t border-stone-100 pt-2"><span className="text-[#3d1924]">Total</span><span className="text-[#8b1538]">₹{total.toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between text-xs text-stone-500"><span>Advance ({advancePercent}%)</span><span>₹{advanceAmount.toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between text-xs text-stone-500"><span>Remaining</span><span>₹{remaining.toLocaleString('en-IN')}</span></div>
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Confirm */}
          {step === 6 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-3">
                <h3 className="font-bold text-[#3d1924]">Confirm Booking</h3>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                  <p className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
                    <Check className="h-4 w-4" />Ready to submit your booking
                  </p>
                  <p className="mt-1 text-xs text-emerald-600">
                    The makeup artist will review your request and confirm availability. You will be notified once they respond.
                  </p>
                </div>

                {/* Final pricing recap */}
                <div className="border-t border-[#eadfcf] pt-3 space-y-1.5">
                  <div className="flex justify-between text-base font-bold"><span className="text-[#3d1924]">Total Amount</span><span className="text-[#8b1538]">₹{total.toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between text-xs text-stone-500"><span>Advance ({advancePercent}%)</span><span>₹{advanceAmount.toLocaleString('en-IN')}</span></div>
                </div>

                {/* Terms */}
                <label className="flex items-start gap-3 cursor-pointer mt-4 rounded-xl border border-[#eadfcf] p-3">
                  <input type="checkbox" checked={termsAccepted}
                    onChange={e => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-[#e7d9c4] text-[#8b1538] focus:ring-[#8b1538]/20" />
                  <span className="text-xs text-stone-600">
                    I agree to the booking terms. The makeup artist will review my request and confirm availability. Advance payment will be required after confirmation.
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#eadfcf] bg-[#fffdfa]/95 px-5 py-4 backdrop-blur sm:px-7">
          <button type="button" onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="flex items-center gap-1.5 rounded-xl border border-[#d7c5ae] px-4 py-2.5 text-sm font-semibold text-[#5a3440] transition hover:bg-white">
            <ChevronLeft className="h-4 w-4" />{step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step < 6 ? (
            <button type="button" onClick={() => setStep(step + 1)}
              className="flex items-center gap-1.5 rounded-xl bg-[#8b1538] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#70102d]">
              Next<ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" disabled={busy || !termsAccepted} onClick={handleSubmit}
              className="rounded-xl bg-[#8b1538] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#70102d] disabled:opacity-60">
              {busy ? <><Loader2 className="mr-1.5 inline h-4 w-4 animate-spin" />Submitting…</> : 'Confirm Booking'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}