import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Music, Check, ChevronDown, ChevronUp, X, ChevronLeft, ChevronRight, Loader2, MapPin, Clock, Users, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { NotificationService } from '@/services/notificationService';
import { toast } from 'sonner';
import LocationPicker, { type LocationData, validateLocationData, emptyLocationData } from '@/components/booking/LocationPicker';
import ScopedCartBar from '@/components/ScopedCartBar';

const inputClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition placeholder:text-stone-400 focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/15';

export default function BandMenu({ provider, profile }: { provider: any; profile: any }) {
  const { user } = useAuth();
  const { addToCart, isInCart } = useCart();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [bookingPkg, setBookingPkg] = useState<any>(null);
  const [bookingAddons, setBookingAddons] = useState<any[]>([]);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['public-band-packages', provider.id],
    queryFn: async () => {
      const r = await supabase.from('band_packages' as any).select('*, band_gallery(*), band_addons(*)').eq('provider_id', provider.id).eq('status', 'active').order('created_at');
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });

  useEffect(() => {
    const channel = supabase.channel(`public-band-${provider.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'band_packages', filter: `provider_id=eq.${provider.id}` }, () => qc.invalidateQueries({ queryKey: ['public-band-packages', provider.id] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [provider.id]);

  const toggle = (id: string) => setExpanded(s => ({ ...s, [id]: !s[id] }));
  const handleBook = (pkg: any) => {
    if (!user) { toast.error('Please log in to book'); return nav('/auth'); }
    setBookingAddons(pkg.band_addons ?? []);
    setBookingPkg(pkg);
  };

  if (isLoading) return <div className="h-48 animate-pulse rounded-2xl bg-muted" />;
  if (!packages.length) return <div className="rounded-2xl border border-border/60 bg-surface-1 p-10 text-center text-sm text-muted-foreground">This band has not published any packages yet.</div>;

  return (
    <div className="space-y-5">
      <div><h2 className="text-xl font-bold">Band Packages</h2><p className="text-sm text-muted-foreground">Browse performance packages and book for your event.</p></div>
      <div className="grid gap-5 md:grid-cols-2">
        {packages.map((pkg: any) => {
          const isOpen = expanded[pkg.id];
          const gallery = pkg.band_gallery ?? [];
          const cover = gallery.find((g: any) => g.is_cover);
          const photos = gallery.filter((g: any) => !g.is_cover && (g.media_type === 'image' || !g.media_type));
          const videos = gallery.filter((g: any) => g.media_type === 'video');
          const addons = pkg.band_addons ?? [];
          const price = pkg.package_price || 0;

          return (
            <div key={pkg.id} className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm transition hover:shadow-md">
              <div className="relative h-44 sm:h-52 bg-gradient-to-br from-purple-50 to-indigo-50 overflow-hidden">
                {cover ? <img src={cover.public_url} alt={pkg.name} className="w-full h-full object-cover" loading="lazy" /> : <div className="flex h-full items-center justify-center"><Music className="h-12 w-12 text-purple-400/40" /></div>}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-foreground leading-tight">{pkg.name}</h3>
                  <div className="text-right shrink-0"><p className="text-lg font-bold text-purple-700">₹{Number(price).toLocaleString('en-IN')}</p><p className="text-xs text-muted-foreground">package</p></div>
                </div>
                {pkg.description && <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{pkg.description}</p>}

                <div className="mt-2 flex flex-wrap gap-2">
                  {pkg.band_category && <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 border border-purple-200 px-2.5 py-0.5 text-[11px] font-medium text-purple-800"><Music className="h-3 w-3" />{pkg.band_category}</span>}
                  {pkg.performance_duration && <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-[11px] text-indigo-700"><Clock className="h-3 w-3" />{pkg.performance_duration}</span>}
                  {pkg.number_of_performers && <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 border border-violet-200 px-2.5 py-0.5 text-[11px] text-violet-700"><Users className="h-3 w-3" />{pkg.number_of_performers}</span>}
                </div>

                {(pkg.instruments ?? []).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {pkg.instruments.slice(0, 5).map((s: string) => <span key={s} className="inline-flex items-center rounded-full bg-purple-50 border border-purple-100 px-2 py-0.5 text-[11px] text-purple-700">{s}</span>)}
                    {pkg.instruments.length > 5 && <span className="text-[11px] text-muted-foreground">+{pkg.instruments.length - 5} more</span>}
                  </div>
                )}

                {isOpen && (
                  <div className="mt-3 space-y-3">
                    {/* Performance Videos */}
                    {videos.length > 0 && (
                      <div className="rounded-xl bg-purple-50/60 border border-purple-100 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-purple-700 mb-2">Performance Videos</p>
                        <div className="grid grid-cols-2 gap-2">
                          {videos.map((v: any) => (
                            <div key={v.id} className="rounded-xl overflow-hidden border border-purple-200 aspect-video bg-black">
                              <video src={v.public_url} controls preload="metadata" className="w-full h-full object-cover" controlsList="nodownload" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {(pkg.music_genres ?? []).length > 0 && (
                      <div className="rounded-xl bg-purple-50/60 border border-purple-100 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-purple-700 mb-1">Music Genres</p>
                        <div className="flex flex-wrap gap-1">{pkg.music_genres.map((s: string) => <span key={s} className="rounded-full border border-purple-200 px-2 py-0.5 text-xs text-purple-800">{s}</span>)}</div>
                      </div>
                    )}
                    {(pkg.event_types_supported ?? []).length > 0 && (
                      <div className="rounded-xl bg-indigo-50/60 border border-indigo-100 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-700 mb-1">Events Supported</p>
                        <div className="flex flex-wrap gap-1">{pkg.event_types_supported.map((e: string) => <span key={e} className="rounded-full border border-indigo-200 px-2 py-0.5 text-xs text-indigo-800">{e}</span>)}</div>
                      </div>
                    )}
                    {(pkg.equipment_included ?? []).length > 0 && (
                      <div className="rounded-xl bg-violet-50/60 border border-violet-100 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-violet-700 mb-1">Equipment Included</p>
                        <div className="flex flex-wrap gap-1">{pkg.equipment_included.map((e: string) => <span key={e} className="rounded-full border border-violet-200 px-2 py-0.5 text-xs text-violet-800">{e}</span>)}</div>
                      </div>
                    )}
                    {(pkg.deliverables ?? []).length > 0 && (
                      <div className="rounded-xl bg-stone-50 border border-stone-200 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-stone-700 mb-1">Deliverables</p>
                        <div className="flex flex-wrap gap-1">{pkg.deliverables.map((d: string) => <span key={d} className="rounded-full border border-stone-300 px-2 py-0.5 text-xs text-stone-700">{d}</span>)}</div>
                      </div>
                    )}
                    {addons.length > 0 && (
                      <div className="rounded-xl bg-amber-50/60 border border-amber-100 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 mb-1">Available Add-ons</p>
                        {addons.map((a: any) => <div key={a.id} className="flex justify-between text-xs mt-1"><span className="text-stone-700">{a.name}</span><span className="font-semibold text-amber-800">+₹{Number(a.price).toLocaleString('en-IN')}</span></div>)}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button onClick={() => toggle(pkg.id)} className="rounded-xl border py-2 text-xs font-semibold flex items-center justify-center gap-1 transition hover:bg-secondary/50">
                    {isOpen ? <><ChevronUp className="h-3 w-3" />Hide Details</> : <><ChevronDown className="h-3 w-3" />View Details</>}
                  </button>
                  <button onClick={() => handleBook(pkg)} className="rounded-xl bg-purple-700 py-2 text-xs font-semibold text-white transition hover:bg-purple-800">Book Now</button>
                </div>
                <button
                  onClick={() => { if (!user) { toast.error('Please log in'); return nav('/auth'); } addToCart({ packageId: pkg.id, providerId: provider.id, providerName: profile?.full_name || 'Artist', category: 'band', packageTable: 'band_packages', bookingTable: 'band_bookings', packageName: pkg.name, price: Number(pkg.package_price || pkg.price || 0), duration: pkg.performance_duration || undefined, imageUrl: (pkg.band_gallery ?? []).find((g: any) => g.is_cover)?.public_url || undefined }); }}
                  disabled={isInCart(pkg.id, 'band')}
                  className="mt-2 w-full rounded-xl border border-purple-200 bg-purple-50 py-2 text-xs font-semibold text-purple-700 transition hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <ShoppingCart className="h-3 w-3" />{isInCart(pkg.id, 'band') ? 'In Cart' : 'Add to Cart'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <ScopedCartBar providerId={provider.id} category="band" />
      {bookingPkg && <BandBookingModal isOpen={!!bookingPkg} onClose={() => setBookingPkg(null)} pkg={bookingPkg} provider={provider} addons={bookingAddons} />}
    </div>
  );
}


/* ─── Band Booking Modal ───────────────────────────────────────────────────── */
function BandBookingModal({ isOpen, onClose, pkg, provider, addons }: { isOpen: boolean; onClose: () => void; pkg: any; provider: any; addons: any[] }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventType, setEventType] = useState('');
  const [location, setLocation] = useState<LocationData>(emptyLocationData);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [specialRequirements, setSpecialRequirements] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => { if (isOpen) { setStep(1); setEventDate(''); setEventTime(''); setEventType(''); setLocation(emptyLocationData); setSelectedAddonIds([]); setSpecialRequirements(''); setTermsAccepted(false); } }, [isOpen]);
  useEffect(() => { if (isOpen) document.body.style.overflow='hidden'; else document.body.style.overflow=''; return () => { document.body.style.overflow=''; }; }, [isOpen]);

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
      const { data: booking, error } = await supabase.from('band_bookings' as any).insert({
        package_id: pkg.id, provider_id: provider.id, customer_id: user.id,
        event_date: eventDate, event_time: eventTime || null,
        event_type: eventType || pkg.band_category || null,
        venue: location.venue_name || location.locality || null, city: location.town_city || null,
        selected_addon_ids: selectedAddonIds,
        special_requirements: specialRequirements || null,
        base_amount: baseAmount, addons_amount: addonsAmount,
        total_amount: total, advance_amount: advanceAmount, remaining_amount: remaining,
        status: 'pending',
      }).select('id').single();
      if (error) throw error;

      // Save structured location
      await supabase.from('booking_locations' as any).insert({
        booking_table: 'band_bookings', booking_id: booking.id,
        state: location.state, district: location.district, town_city: location.town_city,
        exact_address: [location.venue_name, location.locality, location.address_line].filter(Boolean).join(', '),
        pincode: location.pincode, landmark: location.address_line || null,
        latitude: location.latitude, longitude: location.longitude,
      });

      await NotificationService.notifyBookingReceived(user.id, provider.id, booking.id);
      sessionStorage.setItem('vowza_booking_success', JSON.stringify({
        bookingId: booking.id, artistName: provider.business_name || provider.contact_person || provider.stage_name || 'Band',
        eventDate, eventTime, venue: location.venue_name || location.locality || 'TBD', city: location.town_city || '',
        amount: total, advanceAmount, remainingBalance: remaining,
        eventType: eventType || pkg.band_category || 'Band Performance', status: 'pending',
      }));
      toast.success('Band booking request sent!'); onClose(); nav('/booking-success');
    } catch (err: any) { toast.error(err.message || 'Could not create booking'); }
    finally { setBusy(false); }
  };

  if (!isOpen) return null;
  const STEPS = ['Package', 'Event Details', 'Add-ons', 'Requirements', 'Confirm'];

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#2d1b69]/65 p-3 backdrop-blur-sm sm:p-6">
      <div className="mx-auto my-3 max-w-2xl overflow-hidden rounded-[24px] bg-[#fefeff] shadow-2xl">
        <header className="flex items-start justify-between gap-4 bg-purple-800 px-5 py-5 sm:px-7">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-purple-200">Vowza Bands</p><h2 className="mt-1 text-lg font-bold text-white">Book: {pkg.name}</h2></div>
          <button onClick={onClose} className="rounded-full p-2 text-white/85 hover:bg-white/15"><X className="h-5 w-5" /></button>
        </header>
        <div className="border-b border-[#eadfcf] bg-[#faf8ff] px-5 py-3 sm:px-7">
          <div className="flex items-center justify-between overflow-x-auto">
            {STEPS.map((label, i) => (<div key={i} className="flex items-center">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${step>i+1?'bg-purple-500 text-white':step===i+1?'bg-purple-700 text-white':'border-2 border-[#e7d9c4] text-stone-400'}`}>{step>i+1?<Check className="h-3.5 w-3.5" />:i+1}</div>
              {i<4&&<div className={`mx-0.5 h-0.5 w-4 sm:w-5 rounded ${step>i+1?'bg-purple-400':'bg-[#e7d9c4]'}`}/>}
            </div>))}
          </div>
        </div>

        <div className="p-5 sm:p-7 max-h-[60vh] overflow-y-auto">
          {step === 1 && (
            <div className="rounded-2xl border border-[#eadfcf] bg-white p-5">
              <h3 className="font-bold text-[#4b1d6b] mb-2">{pkg.name}</h3>
              {pkg.description && <p className="text-sm text-muted-foreground mb-3">{pkg.description}</p>}
              <p className="text-xl font-bold text-purple-700">₹{baseAmount.toLocaleString('en-IN')}</p>
              {pkg.band_category && <p className="mt-1 text-xs text-muted-foreground"><Music className="inline h-3 w-3 mr-1" />{pkg.band_category}</p>}
              {pkg.performance_duration && <p className="mt-1 text-xs text-muted-foreground"><Clock className="inline h-3 w-3 mr-1" />{pkg.performance_duration}</p>}
              {pkg.number_of_performers && <p className="mt-1 text-xs text-muted-foreground"><Users className="inline h-3 w-3 mr-1" />{pkg.number_of_performers}</p>}
              {(pkg.instruments??[]).length>0 && (<div className="mt-3"><p className="text-xs font-semibold text-stone-600 mb-1">Instruments:</p><div className="flex flex-wrap gap-1">{pkg.instruments.map((s: string) => <span key={s} className="rounded-full bg-purple-700/8 px-2 py-0.5 text-[11px] text-purple-700">{s}</span>)}</div></div>)}
            </div>
          )}

          {step === 2 && (
            <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-4">
              <h3 className="font-bold text-[#4b1d6b]">Event Details</h3>
              <label className="block"><span className="text-sm font-semibold text-[#4b1d6b]">Event Date <span className="text-red-500">*</span></span>
                <input type="date" className={inputClass} value={eventDate} onChange={e => setEventDate(e.target.value)} min={new Date().toISOString().split('T')[0]} /></label>
              <label className="block"><span className="text-sm font-semibold text-[#4b1d6b]">Event Time</span>
                <input type="time" className={inputClass} value={eventTime} onChange={e => setEventTime(e.target.value)} /></label>
              <label className="block"><span className="text-sm font-semibold text-[#4b1d6b]">Event Type</span>
                <select className={inputClass} value={eventType} onChange={e => setEventType(e.target.value)}>
                  <option value="">Select event type</option>
                  {['Wedding','Baraat','Reception','Engagement','Sangeet','Haldi','Birthday','Anniversary','Housewarming','Temple Event','Festival','Corporate Event','College Fest','Private Party','Other'].map(v => <option key={v} value={v}>{v}</option>)}
                </select></label>
              <LocationPicker value={location} onChange={setLocation} compact />
            </div>
          )}

          {step === 3 && (
            <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-4">
              <h3 className="font-bold text-[#4b1d6b]">Add-ons</h3>
              {addons.length > 0 ? (<div className="space-y-2">{addons.map((addon: any) => (
                <label key={addon.id} className={`flex items-center justify-between rounded-xl border p-3.5 cursor-pointer transition ${selectedAddonIds.includes(addon.id)?'border-purple-600 bg-purple-50':'border-[#e7d9c4] hover:border-purple-400'}`}>
                  <div className="flex items-center gap-3"><input type="checkbox" checked={selectedAddonIds.includes(addon.id)} onChange={() => toggleAddon(addon.id)} className="h-4 w-4 rounded border-[#e7d9c4] text-purple-700" />
                    <div><p className="text-sm font-semibold text-[#4b1d6b]">{addon.name}</p>{addon.description&&<p className="text-xs text-stone-500">{addon.description}</p>}</div></div>
                  <span className="text-sm font-bold text-purple-700">+₹{Number(addon.price).toLocaleString('en-IN')}</span>
                </label>
              ))}</div>) : (<p className="text-sm text-stone-400 text-center py-4">No add-ons available.</p>)}
              {selectedAddonIds.length>0 && (<div className="rounded-xl border border-[#eadfcf] bg-[#faf8ff] p-3"><p className="text-xs font-semibold text-stone-600">Add-ons total: <span className="text-purple-700">₹{addonsAmount.toLocaleString('en-IN')}</span></p></div>)}
            </div>
          )}

          {step === 4 && (
            <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-4">
              <h3 className="font-bold text-[#4b1d6b]">Special Requirements</h3>
              <label className="block"><span className="text-sm font-semibold text-[#4b1d6b]">Instructions</span>
                <textarea className={`${inputClass} min-h-[100px] resize-y`} value={specialRequirements} onChange={e => setSpecialRequirements(e.target.value)} placeholder="Any specific requirements: procession route, timing, song requests, parking details..." /></label>
            </div>
          )}

          {step === 5 && (
            <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-3">
              <h3 className="font-bold text-[#4b1d6b]">Confirm Booking</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-stone-600">Package</span><span className="font-semibold">{pkg.name}</span></div>
                {pkg.band_category && <div className="flex justify-between"><span className="text-stone-600">Band Type</span><span className="font-medium">{pkg.band_category}</span></div>}
                {eventDate && <div className="flex justify-between"><span className="text-stone-600">Date</span><span className="font-medium">{new Date(eventDate).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</span></div>}
                {eventTime && <div className="flex justify-between"><span className="text-stone-600">Time</span><span className="font-medium">{eventTime}</span></div>}
                {eventType && <div className="flex justify-between"><span className="text-stone-600">Event</span><span className="font-medium">{eventType}</span></div>}
                {(location.venue_name || location.locality) && <div className="flex justify-between"><span className="text-stone-600">Venue</span><span className="font-medium text-right max-w-[180px] truncate">{location.venue_name || location.locality}</span></div>}
              </div>
              <div className="border-t border-[#eadfcf] pt-3 space-y-1.5">
                <div className="flex justify-between text-sm"><span className="text-stone-600">Package Price</span><span>₹{baseAmount.toLocaleString('en-IN')}</span></div>
                {addonsAmount>0 && <div className="flex justify-between text-sm"><span className="text-stone-600">Add-ons</span><span>₹{addonsAmount.toLocaleString('en-IN')}</span></div>}
                <div className="flex justify-between text-base font-bold border-t border-stone-100 pt-2"><span className="text-[#4b1d6b]">Total</span><span className="text-purple-700">₹{total.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between text-xs text-stone-500"><span>Advance ({advancePercent}%)</span><span>₹{advanceAmount.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between text-xs text-stone-500"><span>Remaining</span><span>₹{remaining.toLocaleString('en-IN')}</span></div>
              </div>
              <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4"><p className="text-sm font-semibold text-purple-700 flex items-center gap-2"><Check className="h-4 w-4" />Ready to submit</p><p className="mt-1 text-xs text-purple-600">The band will review your request and confirm availability.</p></div>
              <label className="flex items-start gap-3 cursor-pointer mt-4 rounded-xl border border-[#eadfcf] p-3"><input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-[#e7d9c4] text-purple-700" />
                <span className="text-xs text-stone-600">I agree to the booking terms. Advance payment ({advancePercent}%) will be required after the band accepts your request.</span></label>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[#eadfcf] bg-[#faf8ff]/95 px-5 py-4 backdrop-blur sm:px-7">
          <button type="button" onClick={() => step>1?setStep(step-1):onClose()} className="flex items-center gap-1.5 rounded-xl border border-[#d7c5ae] px-4 py-2.5 text-sm font-semibold text-[#4b1d6b] hover:bg-white"><ChevronLeft className="h-4 w-4" />{step===1?'Cancel':'Back'}</button>
          {step < 5 ? (<button type="button" onClick={() => setStep(step+1)} className="flex items-center gap-1.5 rounded-xl bg-purple-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-purple-800">Next<ChevronRight className="h-4 w-4" /></button>
          ) : (<button type="button" disabled={busy||!termsAccepted} onClick={handleSubmit} className="rounded-xl bg-purple-700 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-purple-800 disabled:opacity-60">{busy?<><Loader2 className="mr-1.5 inline h-4 w-4 animate-spin" />Submitting…</>:'Confirm Booking'}</button>)}
        </div>
      </div>
    </div>
  );
}
