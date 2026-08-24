import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Music, Check, ChevronDown, ChevronUp, MapPin, Clock, Calendar, X, ChevronLeft, ChevronRight, Loader2, AlertCircle, Users, Headphones, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { NotificationService } from '@/services/notificationService';
import { toast } from 'sonner';
import LocationPicker, { type LocationData, validateLocationData, emptyLocationData } from '@/components/booking/LocationPicker';
import ScopedCartBar from '@/components/ScopedCartBar';

const EVENT_TYPES = ['Wedding','Reception','Engagement','Sangeet','Birthday','Club Night','Corporate Events','College Fest','Pool Party','New Year Party','Anniversary','House Party','Music Festival','Private Party'];
const inputClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition placeholder:text-stone-400 focus:border-[#8b1538] focus:ring-2 focus:ring-[#8b1538]/15';

export default function DJMenu({ provider, profile }: { provider: any; profile: any }) {
  const { user } = useAuth();
  const { addToCart, isInCart } = useCart();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [bookingPkg, setBookingPkg] = useState<any>(null);
  const [bookingAddons, setBookingAddons] = useState<any[]>([]);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['public-dj-packages', provider.id],
    queryFn: async () => {
      const r = await supabase.from('dj_packages' as any).select('*, dj_gallery(*), dj_addons(*)').eq('provider_id', provider.id).eq('status', 'active').order('created_at');
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });

  useEffect(() => {
    const channel = supabase.channel(`public-dj-${provider.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dj_packages', filter: `provider_id=eq.${provider.id}` }, () => qc.invalidateQueries({ queryKey: ['public-dj-packages', provider.id] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [provider.id]);

  const toggle = (id: string) => setExpanded(s => ({ ...s, [id]: !s[id] }));

  const handleBook = (pkg: any) => {
    if (!user) { toast.error('Please log in to book'); return nav('/auth'); }
    setBookingAddons(pkg.dj_addons ?? []);
    setBookingPkg(pkg);
  };

  if (isLoading) return <div className="h-48 animate-pulse rounded-2xl bg-muted" />;
  if (!packages.length) return <div className="rounded-2xl border border-border/60 bg-surface-1 p-10 text-center text-sm text-muted-foreground">This DJ has not published any packages yet.</div>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">DJ Packages</h2>
        <p className="text-sm text-muted-foreground">Browse DJ performance packages and book your event.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {packages.map((pkg: any) => {
          const isOpen = expanded[pkg.id];
          const gallery = pkg.dj_gallery ?? [];
          const cover = gallery.find((g: any) => g.is_cover);
          const addons = pkg.dj_addons ?? [];
          const price = pkg.package_price || pkg.starting_price || pkg.fixed_price || pkg.hourly_price || 0;

          return (
            <div key={pkg.id} className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm transition hover:shadow-md">
              <div className="relative h-44 sm:h-52 bg-gradient-to-br from-purple-50 to-fuchsia-50 overflow-hidden">
                {cover ? (
                  <img src={cover.public_url} alt={pkg.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full items-center justify-center"><Music className="h-12 w-12 text-purple-400/40" /></div>
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

                {/* Event type & duration */}
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {pkg.event_type && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{pkg.event_type}</span>}
                  {pkg.performance_duration && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{pkg.performance_duration}</span>}
                  {pkg.team_size && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{pkg.team_size} member{pkg.team_size > 1 ? 's' : ''}</span>}
                </div>

                {/* Music genres */}
                {(pkg.music_genres ?? []).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {pkg.music_genres.slice(0, 6).map((g: string) => (
                      <span key={g} className="inline-flex items-center gap-0.5 rounded-full bg-purple-50 border border-purple-100 px-2 py-0.5 text-[11px] text-purple-700">
                        <Headphones className="h-2.5 w-2.5" />{g}
                      </span>
                    ))}
                    {pkg.music_genres.length > 6 && <span className="text-[11px] text-muted-foreground">+{pkg.music_genres.length - 6} more</span>}
                  </div>
                )}

                {/* Expanded details */}
                {isOpen && (
                  <div className="mt-3 space-y-3">
                    {/* Equipment list */}
                    {(pkg.equipment_list ?? []).length > 0 && (
                      <div className="rounded-xl bg-secondary/50 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#62132d] mb-1">Equipment</p>
                        <div className="flex flex-wrap gap-1">
                          {pkg.equipment_list.map((e: string) => (
                            <span key={e} className="rounded-full border border-[#e7d9c4] px-2 py-0.5 text-xs text-stone-600">{e}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Deliverables */}
                    {(pkg.deliverables ?? []).length > 0 && (
                      <div className="rounded-xl bg-secondary/50 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#62132d] mb-1">Deliverables</p>
                        <div className="flex flex-wrap gap-1">
                          {pkg.deliverables.map((d: string) => (
                            <span key={d} className="rounded-full border border-[#e7d9c4] px-2 py-0.5 text-xs text-stone-600">{d}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Team info */}
                    {pkg.team_info && (
                      <div className="rounded-xl bg-blue-50/60 border border-blue-100 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700 mb-1">Team</p>
                        <p className="text-xs text-blue-800">{pkg.team_info}</p>
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
                  onClick={() => { if (!user) { toast.error('Please log in'); return nav('/auth'); } addToCart({ packageId: pkg.id, providerId: provider.id, providerName: profile?.full_name || 'Artist', category: 'dj', packageTable: 'dj_packages', bookingTable: 'dj_bookings', packageName: pkg.name, price: Number(pkg.package_price || pkg.price || 0), duration: pkg.performance_hours || undefined, imageUrl: (pkg.dj_gallery ?? []).find((g: any) => g.is_cover)?.public_url || undefined }); }}
                  disabled={isInCart(pkg.id, 'dj')}
                  className="mt-2 w-full rounded-xl border border-[#8b1538]/20 bg-[#8b1538]/5 py-2 text-xs font-semibold text-[#8b1538] transition hover:bg-[#8b1538]/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <ShoppingCart className="h-3 w-3" />{isInCart(pkg.id, 'dj') ? 'In Cart' : 'Add to Cart'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <ScopedCartBar providerId={provider.id} category="dj" />
      {/* Booking Modal */}
      {bookingPkg && (
        <DJBookingModal
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


/* ─── DJ Booking Modal ─────────────────────────────────────────────────── */
function DJBookingModal({ isOpen, onClose, pkg, provider, addons }: { isOpen: boolean; onClose: () => void; pkg: any; provider: any; addons: any[] }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const [eventType, setEventType] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [location, setLocation] = useState<LocationData>(emptyLocationData);
  const [expectedAudience, setExpectedAudience] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [songRequests, setSongRequests] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(1); setEventType(''); setEventDate(''); setEventTime('');
      setLocation(emptyLocationData); setExpectedAudience('');
      setSpecialInstructions(''); setSelectedAddonIds([]);
      setSongRequests(''); setTermsAccepted(false);
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
      const { data: booking, error } = await supabase.from('dj_bookings' as any).insert({
        package_id: pkg.id,
        provider_id: provider.id,
        customer_id: user.id,
        event_type: eventType || null,
        event_date: eventDate,
        event_time: eventTime || null,
        venue: location.venue_name || location.locality || null,
        city: location.town_city || null,
        expected_audience: expectedAudience ? Number(expectedAudience) : null,
        special_instructions: specialInstructions || null,
        selected_addon_ids: selectedAddonIds,
        song_requests: songRequests || null,
        base_amount: baseAmount,
        addons_amount: addonsAmount,
        total_amount: total,
        status: 'pending',
      }).select('id').single();
      if (error) throw error;

      // Save structured location
      await supabase.from('booking_locations' as any).insert({
        booking_table: 'dj_bookings', booking_id: booking.id,
        state: location.state, district: location.district, town_city: location.town_city,
        exact_address: [location.venue_name, location.locality, location.address_line].filter(Boolean).join(', '),
        pincode: location.pincode, landmark: location.address_line || null,
        latitude: location.latitude, longitude: location.longitude,
      });

      await NotificationService.notifyBookingReceived(user.id, provider.id, booking.id);

      sessionStorage.setItem('vowza_booking_success', JSON.stringify({
        bookingId: booking.id,
        artistName: provider.business_name || provider.contact_person || 'DJ',
        eventDate, eventTime,
        venue: location.venue_name || location.locality || 'TBD',
        city: location.town_city || '',
        amount: total,
        advanceAmount, remainingBalance: remaining,
        eventType: eventType || 'DJ Performance',
        status: 'pending',
      }));

      toast.success('DJ booking request sent!');
      onClose();
      nav('/booking-success');
    } catch (err: any) {
      toast.error(err.message || 'Could not create booking');
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  const STEPS = ['Package', 'Event Details', 'Audience', 'Add-ons', 'Song Requests', 'Summary', 'Confirm'];

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#250914]/65 p-3 backdrop-blur-sm sm:p-6">
      <div className="mx-auto my-3 max-w-2xl overflow-hidden rounded-[24px] bg-[#fffaf3] shadow-2xl">
        <header className="flex items-start justify-between gap-4 bg-[#70102d] px-5 py-5 sm:px-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f4d58d]">Vowza DJ</p>
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

          {/* Step 1: Package Preview */}
          {step === 1 && (
            <div className="rounded-2xl border border-[#eadfcf] bg-white p-5">
              <h3 className="font-bold text-[#3d1924] mb-2">{pkg.name}</h3>
              {pkg.description && <p className="text-sm text-muted-foreground mb-3">{pkg.description}</p>}
              <p className="text-xl font-bold text-[#8b1538]">₹{baseAmount.toLocaleString('en-IN')}</p>
              {pkg.performance_duration && <p className="mt-1 text-xs text-muted-foreground"><Clock className="inline h-3 w-3 mr-1" />Duration: {pkg.performance_duration}</p>}
              {(pkg.music_genres ?? []).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {pkg.music_genres.map((g: string) => <span key={g} className="rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700 border border-purple-100"><Headphones className="inline h-2.5 w-2.5 mr-0.5" />{g}</span>)}
                </div>
              )}
              {(pkg.equipment_list ?? []).length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#62132d] mb-1">Equipment Included</p>
                  <div className="flex flex-wrap gap-1">
                    {pkg.equipment_list.map((e: string) => <span key={e} className="rounded-full border border-[#e7d9c4] px-2 py-0.5 text-xs text-stone-600">{e}</span>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Event Details */}
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

          {/* Step 3: Audience & Instructions */}
          {step === 3 && (
            <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-4">
              <h3 className="font-bold text-[#62132d] flex items-center gap-2"><Users className="h-4 w-4" />Audience & Instructions</h3>
              <div>
                <label className="text-xs font-semibold text-[#4b1d2b]">Expected Audience Size</label>
                <input type="number" min="1" className={inputClass} placeholder="e.g. 200" value={expectedAudience} onChange={e => setExpectedAudience(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#4b1d2b]">Special Instructions</label>
                <textarea className={`${inputClass} min-h-[100px] resize-y`} placeholder="Any specific requirements, vibe preferences, do-not-play list, timing instructions..." value={specialInstructions} onChange={e => setSpecialInstructions(e.target.value)} />
              </div>
            </div>
          )}

          {/* Step 4: Add-ons */}
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

          {/* Step 5: Song Requests */}
          {step === 5 && (
            <div className="rounded-2xl border border-[#eadfcf] bg-white p-5">
              <h3 className="font-bold text-[#62132d] flex items-center gap-2 mb-3"><Music className="h-4 w-4" />Song Requests</h3>
              <textarea className={`${inputClass} min-h-[120px] resize-y`} placeholder="List any specific songs or artists you'd like the DJ to play. One per line or comma-separated..." value={songRequests} onChange={e => setSongRequests(e.target.value)} />
              <p className="mt-2 text-xs text-muted-foreground">These are requests and the DJ will try their best to include them in the set.</p>
            </div>
          )}

          {/* Step 6: Summary */}
          {step === 6 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#eadfcf] bg-white p-5">
                <h3 className="font-bold text-[#62132d] mb-3">Booking Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Package</span><span className="font-semibold">{pkg.name}</span></div>
                  {eventType && <div className="flex justify-between"><span className="text-muted-foreground">Event</span><span className="font-semibold">{eventType}</span></div>}
                  {eventDate && <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="font-semibold">{new Date(eventDate).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</span></div>}
                  {eventTime && <div className="flex justify-between"><span className="text-muted-foreground">Time</span><span className="font-semibold">{eventTime}</span></div>}
                  {(location.venue_name || location.locality) && <div className="flex justify-between"><span className="text-muted-foreground">Venue</span><span className="font-semibold text-right max-w-[200px]">{location.venue_name || location.locality}</span></div>}
                  {location.town_city && <div className="flex justify-between"><span className="text-muted-foreground">City</span><span className="font-semibold">{location.town_city}</span></div>}
                  {expectedAudience && <div className="flex justify-between"><span className="text-muted-foreground">Audience</span><span className="font-semibold">~{expectedAudience} people</span></div>}
                </div>
              </div>
              <div className="rounded-2xl border border-[#eadfcf] bg-gradient-to-br from-purple-50 to-fuchsia-50 p-5">
                <h3 className="font-bold text-[#62132d] mb-3">Price Breakdown</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Base Package</span><span className="font-semibold">₹{baseAmount.toLocaleString('en-IN')}</span></div>
                  {addonsAmount > 0 && <div className="flex justify-between"><span>Add-ons</span><span className="font-semibold">₹{addonsAmount.toLocaleString('en-IN')}</span></div>}
                  <div className="border-t pt-2 flex justify-between text-lg font-bold"><span>Total</span><span className="text-[#8b1538]">₹{total.toLocaleString('en-IN')}</span></div>
                </div>
                <div className="mt-3 rounded-xl bg-[#8b1538]/5 border border-[#8b1538]/15 p-3 text-xs">
                  <p className="font-bold text-[#8b1538] mb-1">Payment Structure</p>
                  <div className="flex justify-between"><span>20% Advance</span><span className="font-bold">₹{advanceAmount.toLocaleString('en-IN')}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>Remaining after event</span><span>₹{remaining.toLocaleString('en-IN')}</span></div>
                </div>
              </div>
            </div>
          )}

          {/* Step 7: Confirm */}
          {step === 7 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
                <Check className="mx-auto h-10 w-10 text-emerald-600 mb-2" />
                <h3 className="text-lg font-bold text-emerald-800">Ready to Submit</h3>
                <p className="mt-1 text-sm text-emerald-700">Total: ₹{total.toLocaleString('en-IN')}</p>
                <p className="mt-2 text-xs text-emerald-600">The DJ will review and accept your request. You'll pay 20% advance after acceptance.</p>
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
