import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useBookings } from '@/hooks/useBookings';
import { supabase } from '@/integrations/supabase/client';
import { NotificationService } from '@/services/notificationService';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import AvailabilityCalendar from '@/components/booking/AvailabilityCalendar';
import { checkDateAvailable } from '@/hooks/useAvailability';
import AppLogo from '@/components/AppLogo';
import { toast } from 'sonner';
import {
  ArrowLeft, Calendar, Clock, MapPin, XCircle, MessageCircle,
  RefreshCw, AlertCircle, Lock, Loader2, CheckCircle2
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type BookingStatus = Database['public']['Enums']['booking_status'];

interface ProviderInfo { id: string; full_name: string; profession: string; phone?: string; email?: string; whatsapp?: string; }
interface RescheduleReq { id: string; booking_id: string; status: string; requested_date: string; requested_time: string | null; refund_amount: number; refund_status: string; created_at: string; }

const statusColors: Record<BookingStatus, string> = {
  requested: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  accepted: 'bg-blue-100 text-blue-700 border-blue-200',
  in_progress: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
  rejected: 'bg-gray-100 text-gray-700 border-gray-200',
};
const statusLabels: Record<BookingStatus, string> = {
  requested: 'Pending', accepted: 'Accepted — Pay Advance', in_progress: 'Confirmed',
  completed: 'Completed', cancelled: 'Cancelled', rejected: 'Declined',
};

function getBookingTable(booking: any): string {
  const src = booking._source;
  if (src === 'photography') return 'photography_package_bookings';
  if (src === 'catering') return 'catering_bookings';
  if (src === 'drone') return 'drone_bookings';
  if (src === 'videography') return 'videography_bookings';
  if (src === 'dj') return 'dj_bookings';
  if (src === 'decorator') return 'decorator_bookings';
  if (src === 'makeup') return 'makeup_bookings';
  if (src === 'mehendi') return 'mehendi_bookings';
  if (src === 'anchor') return 'anchor_bookings';
  if (src === 'banquet') return 'banquet_bookings';
  if (src === 'rental') return 'rental_bookings';
  if (src === 'priest') return 'priest_bookings';
  if (src === 'water') return 'water_bookings';
  if (src === 'band') return 'band_bookings';
  if (src === 'singer') return 'singer_bookings';
  if (src === 'dancer') return 'dancer_bookings';
  return 'bookings';
}

/** Map _source to readable category label */
function getCategoryLabel(source: string): string {
  const map: Record<string, string> = {
    generic: 'Service', photography: 'Photography', catering: 'Catering',
    drone: 'Drone Photography', videography: 'Videography', dj: 'DJ & Music',
    decorator: 'Decoration', makeup: 'Makeup', mehendi: 'Mehendi',
    anchor: 'Anchors & Hosts', banquet: 'Banquet Hall', rental: 'Rentals',
    priest: 'Pandit / Priest', water: 'Drinking Water', band: 'Band',
    singer: 'Singer', dancer: 'Dance',
  };
  return map[source] || source?.charAt(0).toUpperCase() + source?.slice(1) || 'Service';
}

/** Returns true if event is more than 48 hours away */
function isRescheduleEligible(eventDate: string): boolean {
  const event = new Date(eventDate + 'T00:00:00');
  const now = new Date();
  const diffMs = event.getTime() - now.getTime();
  return diffMs > 48 * 60 * 60 * 1000;
}

const MyBookings = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { bookings, isLoading, cancelBooking, refetch } = useBookings();
  const [providers, setProviders] = useState<Map<string, ProviderInfo>>(new Map());
  const [payingId, setPayingId] = useState<string | null>(null);
  const [rescheduleRequests, setRescheduleRequests] = useState<RescheduleReq[]>([]);

  // Reschedule modal state
  const [rescheduleBooking, setRescheduleBooking] = useState<any>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [checkingAvail, setCheckingAvail] = useState(false);
  const [availError, setAvailError] = useState<string | null>(null);
  const [isRescheduling, setIsRescheduling] = useState(false);

  // Cancel state
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => { if (!loading && !user) navigate('/auth'); }, [user, loading]);

  // Fetch reschedule requests for all customer bookings
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('reschedule_requests' as any)
        .select('id, booking_id, status, requested_date, requested_time, refund_amount, refund_status, created_at')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });
      if (data) setRescheduleRequests(data as any);
    })();
  }, [user, bookings]);

  // Realtime for reschedule updates
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`reschedule-rt-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reschedule_requests', filter: `customer_id=eq.${user.id}` }, () => {
        supabase.from('reschedule_requests' as any).select('id, booking_id, status, requested_date, requested_time, refund_amount, refund_status, created_at').eq('customer_id', user.id).order('created_at', { ascending: false }).then(({ data }) => { if (data) setRescheduleRequests(data as any); });
        refetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  // Fetch providers
  useEffect(() => {
    if (bookings.length === 0) return;
    (async () => {
      const providerIds = [...new Set(bookings.map(b => b.provider_id))];
      const { data: providersData } = await supabase.from('provider_profiles').select('id, user_id, profession, whatsapp').in('id', providerIds);
      if (providersData) {
        const userIds = providersData.map(p => p.user_id);
        const { data: profilesData } = await supabase.from('profiles').select('id, full_name, phone, email').in('id', userIds);
        setProviders(new Map(providersData.map(p => {
          const prof = profilesData?.find(pr => pr.id === p.user_id);
          return [p.id, { id: p.id, full_name: prof?.full_name || 'Unknown', profession: p.profession, phone: prof?.phone || undefined, email: prof?.email || undefined, whatsapp: (p as any).whatsapp || prof?.phone || undefined }];
        })));
      }
    })();
  }, [bookings]);

  // Pay Advance
  const handlePayAdvance = async (booking: any) => {
    if (payingId) return;
    setPayingId(booking.id);
    try {
      const table = getBookingTable(booking);
      const advanceAmt = Math.round(booking.amount * 0.2);
      const { error } = await supabase.from(table as any).update({ advance_paid_at: new Date().toISOString(), confirmed_at: new Date().toISOString(), calendar_locked: true, status: 'in_progress' }).eq('id', booking.id);
      if (error) throw error;
      await NotificationService.notifyAdvancePaymentSuccess(booking.customer_id, booking.provider_id, booking.id, advanceAmt);
      toast.success('Advance paid! Booking confirmed.');
      refetch();
    } catch (err: any) { toast.error(err.message || 'Payment failed.'); }
    finally { setPayingId(null); }
  };

  // Cancel booking
  const handleConfirmCancel = async () => {
    if (!cancelTarget || !user) return;
    setIsCancelling(true);
    try {
      const booking = bookings.find(b => b.id === cancelTarget);
      if (!booking) throw new Error('Booking not found');

      const table = getBookingTable(booking);
      const advancePaid = booking.status === 'in_progress';
      const amountPaid = advancePaid ? Math.round(booking.amount * 0.2) : 0;

      // Recalculate refund at submission time (authoritative)
      const { calculateCancellationRefund } = await import('@/utils/cancellationPolicy');
      const refund = calculateCancellationRefund(booking.event_date, booking.event_time, amountPaid);

      // 1. Cancel the booking
      const { error: cancelErr } = await supabase.from(table as any).update({ status: 'cancelled', calendar_locked: false }).eq('id', booking.id);
      if (cancelErr) throw cancelErr;

      // 2. Record cancellation with refund details
      if (amountPaid > 0) {
        await supabase.from('booking_cancellations' as any).insert({
          booking_id: booking.id,
          booking_table: table,
          customer_id: user.id,
          provider_id: booking.provider_id,
          event_date: booking.event_date,
          event_time: booking.event_time || null,
          hours_remaining: refund.hoursRemaining,
          policy_tier: refund.policyTier,
          amount_paid: amountPaid,
          refund_percentage: refund.refundPercentage,
          refund_amount: refund.refundAmount,
          amount_retained: refund.amountRetained,
          refund_status: refund.refundAmount > 0 ? 'completed' : 'none',
          refund_initiated_at: refund.refundAmount > 0 ? new Date().toISOString() : null,
          refund_completed_at: refund.refundAmount > 0 ? new Date().toISOString() : null,
        });
      }

      // 3. Notify vendor
      await NotificationService.notifyBookingCancelled(user.id, booking.provider_id, cancelTarget, 'customer');

      const refundMsg = refund.refundAmount > 0 ? ` Refund of ₹${refund.refundAmount.toLocaleString()} (${refund.refundPercentage}%) processed.` : '';
      toast.success(`Booking cancelled.${refundMsg}`);
      setCancelTarget(null);
      refetch();
    } catch (error: any) { toast.error(error.message || 'Failed to cancel'); }
    finally { setIsCancelling(false); }
  };

  // Reschedule: availability check
  const handleRescheduleSelect = async (date: string) => {
    setNewDate(date);
    if (!rescheduleBooking) return;
    setCheckingAvail(true); setAvailError(null);
    const result = await checkDateAvailable(rescheduleBooking.provider_id, date, newTime || undefined);
    setCheckingAvail(false);
    if (!result.available) setAvailError(result.reason ?? 'Not available on this date');
  };

  // Reschedule: submit REQUEST (does NOT modify booking directly)
  const handleConfirmReschedule = async () => {
    if (!rescheduleBooking || !newDate || !user) return;
    setIsRescheduling(true);
    try {
      // Final availability check
      const result = await checkDateAvailable(rescheduleBooking.provider_id, newDate, newTime || undefined);
      if (!result.available) { setAvailError(result.reason ?? 'Not available'); setIsRescheduling(false); return; }

      // 48-hour re-validation (server-side safety)
      if (!isRescheduleEligible(rescheduleBooking.event_date)) {
        toast.error('Event is within 48 hours. Rescheduling not allowed.');
        setIsRescheduling(false); return;
      }

      // Check no pending request exists
      const existing = rescheduleRequests.find(r => r.booking_id === rescheduleBooking.id && r.status === 'pending');
      if (existing) { toast.error('A reschedule request is already pending.'); setIsRescheduling(false); return; }

      const table = getBookingTable(rescheduleBooking);
      const advancePaid = rescheduleBooking.status === 'in_progress';
      const amountPaid = advancePaid ? Math.round(rescheduleBooking.amount * 0.2) : 0;

      // Insert reschedule request
      const { error } = await supabase.from('reschedule_requests' as any).insert({
        booking_id: rescheduleBooking.id,
        booking_table: table,
        customer_id: user.id,
        provider_id: rescheduleBooking.provider_id,
        original_date: rescheduleBooking.event_date,
        original_time: rescheduleBooking.event_time || null,
        requested_date: newDate,
        requested_time: newTime || null,
        reason: rescheduleReason || null,
        status: 'pending',
        refund_eligible: advancePaid,
        original_amount_paid: amountPaid,
        refund_percentage: 80,
        refund_amount: Math.round(amountPaid * 0.8),
      });
      if (error) throw error;

      // Notify vendor
      await NotificationService.createNotification({
        userId: rescheduleBooking.provider_id, type: 'booking_received',
        title: 'Reschedule Request',
        message: `Customer requested reschedule from ${new Date(rescheduleBooking.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} to ${new Date(newDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.`,
        metadata: { bookingId: rescheduleBooking.id },
      });

      toast.success('Reschedule request sent! Waiting for artist approval.');
      setRescheduleBooking(null); setNewDate(''); setNewTime(''); setRescheduleReason(''); setAvailError(null);
      // Refresh reschedule requests
      const { data: fresh } = await supabase.from('reschedule_requests' as any).select('id, booking_id, status, requested_date, requested_time, refund_amount, refund_status, created_at').eq('customer_id', user.id).order('created_at', { ascending: false });
      if (fresh) setRescheduleRequests(fresh as any);
    } catch (err: any) { toast.error(err.message || 'Failed to submit reschedule request'); }
    finally { setIsRescheduling(false); }
  };

  if (loading || isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cream via-background to-blush/20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
    </div>
  );

  const activeBookings = bookings.filter(b => !['cancelled', 'rejected', 'completed'].includes(b.status));
  const pastBookings = bookings.filter(b => ['cancelled', 'rejected', 'completed'].includes(b.status));

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream via-background to-blush/20">
      <header className="bg-card/95 backdrop-blur-sm border-b border-gold/20 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/browse')}><ArrowLeft className="w-5 h-5" /></Button>
          <AppLogo size="md" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6 bg-gradient-to-r from-gold to-maroon bg-clip-text text-transparent">My Bookings</h1>

        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Calendar className="w-5 h-5 text-gold" />Active Bookings</h2>
          {activeBookings.length === 0 ? (
            <Card className="border-gold/20"><CardContent className="py-8 text-center"><p className="text-muted-foreground">No active bookings</p><Link to="/browse"><Button className="mt-4 bg-gradient-gold hover:opacity-90">Browse Artists</Button></Link></CardContent></Card>
          ) : (
            <div className="space-y-4">
              {activeBookings.map((booking) => {
                const provider = providers.get(booking.provider_id);
                const advancePaid = booking.status === 'in_progress';
                const canReschedule = (booking.status === 'in_progress' || booking.status === 'requested') && isRescheduleEligible(booking.event_date);
                const pendingReschedule = rescheduleRequests.find(r => r.booking_id === booking.id && r.status === 'pending');
                const lastDeclinedReschedule = rescheduleRequests.find(r => r.booking_id === booking.id && r.status === 'declined');
                const lastApprovedReschedule = rescheduleRequests.find(r => r.booking_id === booking.id && r.status === 'approved');

                return (
                  <Card key={booking.id} className="border-gold/20">
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={statusColors[booking.status]}>{statusLabels[booking.status]}</Badge>
                        <Badge variant="outline" className="text-[10px] font-bold capitalize">{getCategoryLabel((booking as any)._source)}</Badge>
                        <span className="font-bold text-gold ml-auto">₹{booking.amount.toLocaleString()}</span>
                      </div>
                      <h3 className="font-semibold text-foreground">{provider?.full_name || 'Unknown Artist'}</h3>
                      {(booking as any)._packageName && <p className="text-xs text-muted-foreground mt-0.5">{(booking as any)._packageName}</p>}
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{new Date(booking.event_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        {booking.event_time && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{booking.event_time}</span>}
                        {booking.venue_city && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{booking.venue_city}</span>}
                      </div>

                      {/* ═══ PENDING RESCHEDULE REQUEST ═══ */}
                      {pendingReschedule && (
                        <div className="mt-3 rounded-xl bg-indigo-50 border border-indigo-200 p-3 space-y-1">
                          <p className="text-xs font-semibold text-indigo-700 flex items-center gap-1.5"><RefreshCw className="w-3 h-3" />Reschedule Request Pending</p>
                          <p className="text-[11px] text-indigo-600">Requested: {new Date(pendingReschedule.requested_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}{pendingReschedule.requested_time ? ` at ${pendingReschedule.requested_time}` : ''}</p>
                          <p className="text-[10px] text-indigo-500">Waiting for artist approval. Original date remains until accepted.</p>
                        </div>
                      )}

                      {/* ═══ APPROVED RESCHEDULE ═══ */}
                      {lastApprovedReschedule && !pendingReschedule && (
                        <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 p-2.5">
                          <p className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Rescheduled successfully</p>
                        </div>
                      )}

                      {/* ═══ DECLINED RESCHEDULE + REFUND ═══ */}
                      {lastDeclinedReschedule && !pendingReschedule && (
                        <div className="mt-3 rounded-xl bg-orange-50 border border-orange-200 p-3 space-y-1">
                          <p className="text-xs font-semibold text-orange-700">Reschedule Declined</p>
                          {Number(lastDeclinedReschedule.refund_amount) > 0 && (
                            <p className="text-[11px] text-orange-600">Refund: ₹{Number(lastDeclinedReschedule.refund_amount).toLocaleString()} (80%) — Status: {lastDeclinedReschedule.refund_status === 'completed' ? '✓ Completed' : 'Processing'}</p>
                          )}
                        </div>
                      )}

                      {/* ═══ STATE A: PENDING / REQUESTED ═══ */}
                      {booking.status === 'requested' && (
                        <div className="mt-4 space-y-3">
                          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
                            ⏳ Waiting for artist to respond. Contact details will be shared after advance payment.
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {canReschedule && !pendingReschedule && (
                              <Button variant="outline" size="sm" className="border-blue-300 text-blue-600 hover:bg-blue-50"
                                onClick={() => { setRescheduleBooking(booking); setNewDate(''); setNewTime(''); setRescheduleReason(''); setAvailError(null); }}>
                                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reschedule
                              </Button>
                            )}
                            {!canReschedule && !pendingReschedule && booking.event_date && (
                              <span className="text-[10px] text-stone-400">Reschedule unavailable (event within 48hrs)</span>
                            )}
                            <Button variant="outline" size="sm" className="border-red-300 text-red-600 hover:bg-red-50" onClick={() => setCancelTarget(booking.id)}>
                              <XCircle className="w-3.5 h-3.5 mr-1" /> Cancel
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* ═══ STATE B: ACCEPTED — PAY ADVANCE ═══ */}
                      {booking.status === 'accepted' && (
                        <div className="mt-4 space-y-3">
                          <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700">
                            ✓ Artist accepted! Pay 20% advance (₹{Math.round(booking.amount * 0.2).toLocaleString()}) to confirm.
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button size="sm" className="bg-[#8B1538] hover:bg-[#70102d] text-white" disabled={payingId === booking.id} onClick={() => handlePayAdvance(booking)}>
                              {payingId === booking.id ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Processing...</> : <>💳 Pay ₹{Math.round(booking.amount * 0.2).toLocaleString()} Advance</>}
                            </Button>
                            <Button variant="outline" size="sm" className="border-red-300 text-red-600 hover:bg-red-50" onClick={() => setCancelTarget(booking.id)}>
                              <XCircle className="w-3.5 h-3.5 mr-1" /> Cancel
                            </Button>
                          </div>
                          <div className="rounded-xl bg-stone-50 border border-stone-200 p-3 flex items-center gap-2">
                            <Lock className="w-3.5 h-3.5 text-stone-400" />
                            <p className="text-xs text-stone-500">Communication locked. Pay advance to unlock.</p>
                          </div>
                        </div>
                      )}

                      {/* ═══ STATE C: CONFIRMED (in_progress) — COMMUNICATION UNLOCKED ═══ */}
                      {advancePaid && (
                        <div className="mt-4 space-y-3">
                          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                            <p className="text-xs font-semibold text-emerald-700 mb-0.5">✓ BOOKING CONFIRMED — CONTACT ARTIST</p>
                            <p className="text-[10px] text-emerald-600">Advance paid. Contact the artist directly.</p>
                          </div>
                          {provider && (provider.phone || provider.email) && (
                            <div className="flex flex-wrap gap-2">
                              {provider.phone && <a href={`tel:${provider.phone}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition">📞 Call {provider.phone}</a>}
                              {(provider.whatsapp || provider.phone) && <a href={`https://wa.me/${(provider.whatsapp || provider.phone || '').replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition">💬 WhatsApp</a>}
                              {provider.email && <a href={`mailto:${provider.email}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition">✉️ Email</a>}
                              <Link to={`/chat/${booking.id}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"><MessageCircle className="w-3 h-3" /> Chat</Link>
                              <Link to={`/artist/${provider.id}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary border border-border/60 text-xs font-semibold text-foreground hover:bg-secondary/80 transition">View Profile</Link>
                            </div>
                          )}
                          {/* Reschedule for confirmed bookings */}
                          {canReschedule && !pendingReschedule && (
                            <Button variant="outline" size="sm" className="border-blue-300 text-blue-600 hover:bg-blue-50"
                              onClick={() => { setRescheduleBooking(booking); setNewDate(''); setNewTime(''); setRescheduleReason(''); setAvailError(null); }}>
                              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reschedule
                            </Button>
                          )}
                          {!canReschedule && !pendingReschedule && booking.event_date && booking.status === 'in_progress' && (
                            <span className="text-[10px] text-stone-400">Reschedule unavailable (event within 48hrs)</span>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Past Bookings ─────────────────────────────────────────────── */}
        {pastBookings.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4 text-muted-foreground">Past Bookings</h2>
            <div className="space-y-4">
              {pastBookings.map((booking) => {
                const provider = providers.get(booking.provider_id);
                const showContact = booking.status === 'completed';
                return (
                  <Card key={booking.id} className="border-border bg-muted/30">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Badge className={statusColors[booking.status]}>{statusLabels[booking.status]}</Badge>
                          <h3 className="font-medium mt-1">{provider?.full_name || 'Unknown Artist'}</h3>
                          <p className="text-sm text-muted-foreground">{new Date(booking.event_date).toLocaleDateString('en-IN')} • {booking.venue_city}</p>
                        </div>
                        <span className="font-semibold">₹{booking.amount.toLocaleString()}</span>
                      </div>
                      {showContact && provider && (provider.phone || provider.email) && (
                        <div className="mt-3 pt-3 border-t border-border/40 flex flex-wrap gap-2">
                          {provider.phone && <a href={`tel:${provider.phone}`} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">📞 Call</a>}
                          {provider.email && <a href={`mailto:${provider.email}`} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">✉️ Email</a>}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ── Reschedule Modal ──────────────────────────────────────────── */}
      <Dialog open={!!rescheduleBooking} onOpenChange={() => setRescheduleBooking(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request Reschedule</DialogTitle>
            <DialogDescription>Select a new date. The artist must approve before the date changes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {rescheduleBooking && (
              <div className="rounded-xl bg-muted/50 p-3 text-xs space-y-1">
                <p><span className="text-muted-foreground">Current date:</span> <span className="font-medium">{new Date(rescheduleBooking.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span></p>
                {rescheduleBooking.event_time && <p><span className="text-muted-foreground">Current time:</span> <span className="font-medium">{rescheduleBooking.event_time}</span></p>}
              </div>
            )}
            <AvailabilityCalendar providerId={rescheduleBooking?.provider_id ?? ''} selectedDate={newDate} onSelectDate={handleRescheduleSelect} />
            {checkingAvail && <p className="text-xs text-muted-foreground animate-pulse">Checking availability...</p>}
            {availError && <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{availError}</div>}
            {newDate && !availError && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-medium">✓ Available: {new Date(newDate).toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</div>}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Preferred Time (optional)</Label>
              <Input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} className="border-border focus:border-gold" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Reason (optional)</Label>
              <Textarea value={rescheduleReason} onChange={e => setRescheduleReason(e.target.value)} placeholder="Why do you need to reschedule?" rows={2} className="text-sm" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setRescheduleBooking(null)}>Cancel</Button>
              <Button className="flex-1 bg-gradient-gold hover:opacity-90" disabled={!newDate || !!availError || checkingAvail || isRescheduling} onClick={handleConfirmReschedule}>
                {isRescheduling ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Cancel Dialog with Refund Preview ─────────────────────────── */}
      <Dialog open={!!cancelTarget} onOpenChange={() => setCancelTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Cancel Booking</DialogTitle><DialogDescription>Review the cancellation details and refund policy below.</DialogDescription></DialogHeader>
          {cancelTarget && (() => {
            const booking = bookings.find(b => b.id === cancelTarget);
            if (!booking) return <p className="text-sm text-muted-foreground">Booking not found.</p>;
            const provider = providers.get(booking.provider_id);
            const advancePaid = booking.status === 'in_progress';
            const amountPaid = advancePaid ? Math.round(booking.amount * 0.2) : 0;

            // Dynamic import workaround — calculate inline
            const eventStr = booking.event_time ? `${booking.event_date}T${booking.event_time}:00` : `${booking.event_date}T00:00:00`;
            const hoursRemaining = Math.max(0, (new Date(eventStr).getTime() - Date.now()) / (1000 * 60 * 60));
            const pct = hoursRemaining >= 120 ? 95 : hoursRemaining >= 96 ? 90 : hoursRemaining >= 72 ? 80 : hoursRemaining >= 48 ? 50 : 0;
            const tierLabel = pct === 95 ? '5+ days — 95% refund' : pct === 90 ? '4-5 days — 90% refund' : pct === 80 ? '3-4 days — 80% refund' : pct === 50 ? '48hrs-3 days — 50% refund' : 'Under 48hrs — No refund';
            const refundAmt = Math.round(amountPaid * pct / 100);
            const retained = amountPaid - refundAmt;
            const daysRemaining = Math.floor(hoursRemaining / 24);
            const hrsRem = Math.round(hoursRemaining % 24);

            return (
              <div className="space-y-4 mt-2">
                <div className="rounded-xl bg-muted/50 p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Package</span><span className="font-medium">{(booking as any)._packageName || 'Package'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Artist</span><span className="font-medium">{provider?.full_name || 'Artist'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Event Date</span><span className="font-medium">{new Date(booking.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Time Remaining</span><span className="font-medium">{daysRemaining > 0 ? `${daysRemaining}d ${hrsRem}h` : `${Math.round(hoursRemaining)}h`}</span></div>
                </div>

                <div className={`rounded-xl p-3 border ${pct > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                  <p className={`text-xs font-semibold mb-1 ${pct > 0 ? 'text-emerald-700' : 'text-red-700'}`}>Cancellation Policy: {tierLabel}</p>
                  {amountPaid > 0 ? (
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Amount Paid</span><span className="font-medium">₹{amountPaid.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Refund ({pct}%)</span><span className="font-bold text-emerald-700">₹{refundAmt.toLocaleString()}</span></div>
                      {retained > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Retained</span><span className="text-red-600">₹{retained.toLocaleString()}</span></div>}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No advance payment was made. No refund applicable.</p>
                  )}
                </div>

                {pct === 0 && amountPaid > 0 && (
                  <div className="rounded-xl bg-red-50 border border-red-200 p-3">
                    <p className="text-xs text-red-700 font-medium">Your booking will be cancelled but no refund is available because the event is within 48 hours.</p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setCancelTarget(null)}>Keep Booking</Button>
                  <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" disabled={isCancelling} onClick={handleConfirmCancel}>
                    {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyBookings;
