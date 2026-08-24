import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Mic, Clock, Users, Check, ChevronDown, ChevronUp, X, ChevronLeft, ChevronRight, Loader2, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { NotificationService } from '@/services/notificationService';
import { toast } from 'sonner';
import LocationPicker, { type LocationData, validateLocationData, emptyLocationData } from '@/components/booking/LocationPicker';
import ScopedCartBar from '@/components/ScopedCartBar';

const EVENT_TYPES = ['Wedding','Reception','Sangeet','Engagement','Birthday','Corporate','College Fest','Private Party','Festival','Other'];
const inputClass = 'w-full rounded-xl border border-[#e7d9c4] bg-white px-3.5 py-2.5 text-sm text-[#3d1924] outline-none transition placeholder:text-stone-400 focus:border-[#c94b4b] focus:ring-2 focus:ring-[#c94b4b]/15';

export default function SingerMenu({ provider, profile }: { provider: any; profile: any }) {
  const { user } = useAuth();
  const { addToCart, isInCart } = useCart();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [bookingPkg, setBookingPkg] = useState<any>(null);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['public-singer-packages', provider.id],
    queryFn: async () => {
      const r = await supabase.from('singer_packages' as any).select('*, singer_gallery(*)').eq('provider_id', provider.id).eq('status', 'active').order('created_at');
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase.channel(`public-singer-${provider.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'singer_packages', filter: `provider_id=eq.${provider.id}` }, () => qc.invalidateQueries({ queryKey: ['public-singer-packages', provider.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [provider.id]);

  const toggle = (id: string) => setExpanded(s => ({ ...s, [id]: !s[id] }));
  const handleBook = (pkg: any) => {
    if (!user) { toast.error('Please log in to book'); return nav('/auth'); }
    setBookingPkg(pkg);
  };

  if (isLoading) return <div className="h-48 animate-pulse rounded-2xl bg-muted" />;
  if (!packages.length) return <div className="rounded-2xl border border-border/60 bg-surface-1 p-10 text-center text-sm text-muted-foreground">This singer has not published any packages yet.</div>;

  return (
    <div className="space-y-5">
      <div><h2 className="text-xl font-bold">Singer Packages</h2><p className="text-sm text-muted-foreground">Browse performance packages and book.</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        {packages.map((pkg: any) => {
          const isOpen = expanded[pkg.id];
          const price = Number(pkg.package_price || 0);
          const gallery = pkg.singer_gallery ?? [];
          const cover = gallery.find((g: any) => g.is_cover);
          return (
            <div key={pkg.id} className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm transition hover:shadow-md">
              <div className="relative h-36 bg-gradient-to-br from-rose-50 to-purple-50 overflow-hidden">
                {cover ? (
                  <img src={cover.public_url} alt={pkg.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full items-center justify-center"><Mic className="h-10 w-10 text-rose-700/30" /></div>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-foreground leading-tight">{pkg.name}</h3>
                    {pkg.package_type && <p className="text-xs text-rose-600 font-medium mt-0.5">{pkg.package_type}</p>}
                  </div>
                  <div className="text-right shrink-0"><p className="text-lg font-bold text-rose-700">₹{price.toLocaleString('en-IN')}</p></div>
                </div>
                {pkg.description && <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{pkg.description}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {pkg.performance_duration && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{pkg.performance_duration}</span>}
                  {pkg.performance_style && <span>{pkg.performance_style}</span>}
                </div>
                {(pkg.languages ?? []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {pkg.languages.slice(0, 4).map((l: string) => <span key={l} className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] text-rose-700">{l}</span>)}
                    {pkg.languages.length > 4 && <span className="text-[11px] text-muted-foreground">+{pkg.languages.length - 4}</span>}
                  </div>
                )}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button onClick={() => toggle(pkg.id)} className="rounded-xl border py-2 text-xs font-semibold flex items-center justify-center gap-1 transition hover:bg-secondary/50">
                    {isOpen ? <><ChevronUp className="h-3 w-3" />Hide</> : <><ChevronDown className="h-3 w-3" />Details</>}
                  </button>
                  <button onClick={() => handleBook(pkg)} className="rounded-xl bg-rose-700 py-2 text-xs font-semibold text-white transition hover:bg-rose-800">Book Now</button>
                </div>
                <button
                  onClick={() => { if (!user) { toast.error('Please log in'); return nav('/auth'); } addToCart({ packageId: pkg.id, providerId: provider.id, providerName: profile?.full_name || 'Artist', category: 'singer', packageTable: 'singer_packages', bookingTable: 'singer_bookings', packageName: pkg.name, price: Number(pkg.package_price || 0), duration: pkg.performance_duration || undefined, imageUrl: (pkg.singer_gallery ?? []).find((g: any) => g.is_cover)?.public_url || undefined }); }}
                  disabled={isInCart(pkg.id, 'singer')}
                  className="mt-2 w-full rounded-xl border border-rose-200 bg-rose-50 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <ShoppingCart className="h-3 w-3" />{isInCart(pkg.id, 'singer') ? 'In Cart' : 'Add to Cart'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <ScopedCartBar providerId={provider.id} category="singer" />
      {bookingPkg && <SingerBookingModal isOpen={!!bookingPkg} onClose={() => setBookingPkg(null)} pkg={bookingPkg} provider={provider} />}
    </div>
  );
}


/* ─── Singer Booking Modal ─────────────────────────────────────────────────── */
function SingerBookingModal({ isOpen, onClose, pkg, provider }: { isOpen: boolean; onClose: () => void; pkg: any; provider: any }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventType, setEventType] = useState('');
  const [location, setLocation] = useState<LocationData>(emptyLocationData);
  const [specialRequirements, setSpecialRequirements] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => { if (isOpen) { setStep(1); setEventDate(''); setEventTime(''); setEventType(''); setLocation(emptyLocationData); setSpecialRequirements(''); setTermsAccepted(false); } }, [isOpen]);
  useEffect(() => { if (isOpen) document.body.style.overflow = 'hidden'; else document.body.style.overflow = ''; return () => { document.body.style.overflow = ''; }; }, [isOpen]);

  const baseAmount = Number(pkg.package_price || 0);
  const advancePercent = Number(pkg.advance_percentage || 20);
  const advanceAmount = Math.round(baseAmount * advancePercent / 100);
  const remaining = baseAmount - advanceAmount;

  const validateStep = (s: number): boolean => {
    if (s === 2) { if (!eventDate) { toast.error('Please select a date'); return false; } if (!eventType) { toast.error('Please select event type'); return false; } }
    if (s === 3) { const e = validateLocationData(location); if (e) { toast.error(e); return false; } }
    return true;
  };
  const goNext = () => { if (validateStep(step)) setStep(step + 1); };

  const handleSubmit = async () => {
    if (!user) { toast.error('Please log in'); nav('/auth'); return; }
    if (!termsAccepted) { toast.error('Please accept terms'); return; }
    setBusy(true);
    try {
      const { data: booking, error } = await supabase.from('singer_bookings' as any).insert({
        package_id: pkg.id, provider_id: provider.id, customer_id: user.id,
        event_date: eventDate, event_time: eventTime || null, event_type: eventType || null,
        venue: location.venue_name || location.locality || null, city: location.town_city || null,
        special_requirements: specialRequirements || null, selected_addon_ids: [],
        base_amount: baseAmount, addons_amount: 0, total_amount: baseAmount,
        advance_amount: advanceAmount, remaining_amount: remaining, status: 'pending',
      }).select('id').single();
      if (error) throw error;
      await supabase.from('booking_locations' as any).insert({ booking_table: 'singer_bookings', booking_id: booking.id, state: location.state, district: location.district, town_city: location.town_city, exact_address: [location.venue_name, location.locality, location.address_line].filter(Boolean).join(', '), pincode: location.pincode, landmark: location.address_line || null, latitude: location.latitude, longitude: location.longitude });
      await NotificationService.notifyBookingReceived(user.id, provider.id, booking.id);
      toast.success('Singer booking request sent!'); onClose(); nav('/booking-success');
    } catch (err: any) { toast.error(err.message || 'Could not create booking'); }
    finally { setBusy(false); }
  };

  if (!isOpen) return null;
  const STEPS = ['Package', 'Event', 'Location', 'Requirements', 'Review'];
  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#250914]/65 p-3 backdrop-blur-sm sm:p-6">
      <div className="mx-auto my-3 max-w-2xl overflow-hidden rounded-[24px] bg-[#fffaf3] shadow-2xl">
        <header className="flex items-start justify-between gap-4 bg-rose-800 px-5 py-5 sm:px-7">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-200">Vowza Singer</p><h2 className="mt-1 text-lg font-bold text-white">Book: {pkg.name}</h2></div>
          <button onClick={onClose} className="rounded-full p-2 text-white/85 hover:bg-white/15"><X className="h-5 w-5" /></button>
        </header>
        <div className="p-5 sm:p-7 max-h-[60vh] overflow-y-auto">
          {step === 1 && <div className="rounded-2xl border border-[#eadfcf] bg-white p-5"><h3 className="font-bold text-[#3d1924] mb-2">{pkg.name}</h3>{pkg.description && <p className="text-sm text-muted-foreground mb-3">{pkg.description}</p>}<p className="text-xl font-bold text-rose-700">₹{baseAmount.toLocaleString('en-IN')}</p></div>}
          {step === 2 && <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-4"><h3 className="font-bold text-[#3d1924]">Event Details</h3><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="text-sm font-semibold">Date *</span><input type="date" className={inputClass} value={eventDate} onChange={e => setEventDate(e.target.value)} min={new Date().toISOString().split('T')[0]} /></label><label className="block"><span className="text-sm font-semibold">Time</span><input type="time" className={inputClass} value={eventTime} onChange={e => setEventTime(e.target.value)} /></label></div><label className="block"><span className="text-sm font-semibold">Event Type *</span><select className={inputClass} value={eventType} onChange={e => setEventType(e.target.value)}><option value="">Select</option>{EVENT_TYPES.map(v => <option key={v} value={v}>{v}</option>)}</select></label></div>}
          {step === 3 && <div className="rounded-2xl border border-[#eadfcf] bg-white p-5"><LocationPicker value={location} onChange={setLocation} /></div>}
          {step === 4 && <div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-4"><h3 className="font-bold text-[#3d1924]">Special Requirements</h3><textarea className={`${inputClass} min-h-[100px] resize-y`} value={specialRequirements} onChange={e => setSpecialRequirements(e.target.value)} placeholder="Song preferences, language, performance style..." /></div>}
          {step === 5 && <div className="space-y-4"><div className="rounded-2xl border border-[#eadfcf] bg-white p-5 space-y-3"><h3 className="font-bold text-[#3d1924]">Booking Summary</h3><div className="space-y-1.5 text-sm"><div className="flex justify-between"><span className="text-stone-600">Package</span><span className="font-semibold">{pkg.name}</span></div>{eventDate && <div className="flex justify-between"><span className="text-stone-600">Date</span><span>{new Date(eventDate).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</span></div>}{location.state && <div className="flex justify-between"><span className="text-stone-600">Location</span><span>{location.town_city}, {location.state}</span></div>}</div><div className="border-t pt-3 space-y-1"><div className="flex justify-between font-bold"><span>Total</span><span className="text-rose-700">₹{baseAmount.toLocaleString('en-IN')}</span></div><div className="flex justify-between text-xs text-stone-500"><span>Advance ({advancePercent}%)</span><span>₹{advanceAmount.toLocaleString('en-IN')}</span></div></div></div><label className="flex items-start gap-3 cursor-pointer rounded-xl border border-[#eadfcf] p-3"><input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="mt-0.5 h-4 w-4" /><span className="text-xs text-stone-600">I agree to the booking terms.</span></label></div>}
        </div>
        <div className="flex items-center justify-between border-t border-[#eadfcf] bg-[#fffdfa]/95 px-5 py-4 sm:px-7">
          <button onClick={() => step > 1 ? setStep(step - 1) : onClose()} className="flex items-center gap-1.5 rounded-xl border border-[#d7c5ae] px-4 py-2.5 text-sm font-semibold text-[#5a3440] hover:bg-white"><ChevronLeft className="h-4 w-4" />{step === 1 ? 'Cancel' : 'Back'}</button>
          {step < 5 ? <button onClick={goNext} className="flex items-center gap-1.5 rounded-xl bg-rose-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-rose-800">Next<ChevronRight className="h-4 w-4" /></button>
          : <button disabled={busy || !termsAccepted} onClick={handleSubmit} className="rounded-xl bg-rose-700 px-6 py-2.5 text-sm font-bold text-white hover:bg-rose-800 disabled:opacity-60">{busy ? <><Loader2 className="mr-1.5 inline h-4 w-4 animate-spin" />Submitting…</> : 'Confirm Booking'}</button>}
        </div>
      </div>
    </div>
  );
}
