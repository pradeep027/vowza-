// MyBookingsPage — customer dashboard bookings list (real data only)
import { useState, useEffect, useMemo } from 'react';
import VowzaIcon from '@/components/VowzaIcon';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useBookings } from '@/hooks/useBookings';
import { supabase } from '@/integrations/supabase/client';
import { NotificationService } from '@/services/notificationService';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Calendar, Clock, MapPin, XCircle, Download, Eye,
  CalendarX
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type BookingStatus = Database['public']['Enums']['booking_status'];
type PaymentStatus = Database['public']['Enums']['payment_status'];

interface ProviderInfo {
  full_name: string;
  profession: string;
}

const statusStyles: Record<BookingStatus, string> = {
  requested: 'bg-amber-100 text-amber-700 border-amber-200',
  accepted: 'bg-blue-100 text-blue-700 border-blue-200',
  in_progress: 'bg-purple-100 text-purple-700 border-purple-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
  rejected: 'bg-gray-100 text-gray-700 border-gray-200',
};

const statusLabels: Record<BookingStatus, string> = {
  requested: 'Pending',
  accepted: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Declined',
};

const paymentStyles: Record<PaymentStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  refunded: 'bg-sky-100 text-sky-700 border-sky-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
};

export default function MyBookingsPage() {
  const { user } = useAuth();
  const { bookings, isLoading, cancelBooking } = useBookings();
  const [providers, setProviders] = useState<Map<string, ProviderInfo>>(new Map());
  const [eventTypes, setEventTypes] = useState<Map<string, string>>(new Map());
  const [paymentStatuses, setPaymentStatuses] = useState<Map<string, PaymentStatus>>(new Map());
  const [detailBooking, setDetailBooking] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (bookings.length === 0) return;

    (async () => {
      const providerIds = [...new Set(bookings.map(b => b.provider_id))];
      const eventTypeIds = [...new Set(bookings.map(b => b.event_type_id).filter(Boolean))] as string[];
      const bookingIds = bookings.map(b => b.id);

      const [{ data: providersData }, { data: eventTypesData }, { data: paymentsData }] = await Promise.all([
        supabase.from('provider_profiles').select('id, user_id, profession').in('id', providerIds),
        eventTypeIds.length
          ? supabase.from('event_types').select('id, name').in('id', eventTypeIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
        supabase.from('payments').select('booking_id, status').in('booking_id', bookingIds),
      ]);

      if (providersData) {
        const userIds = providersData.map(p => p.user_id);
        const { data: profilesData } = await supabase
          .from('profiles').select('id, full_name').in('id', userIds);
        const profilesMap = new Map(profilesData?.map(p => [p.id, p.full_name]) ?? []);
        setProviders(new Map(providersData.map(p => [p.id, {
          full_name: profilesMap.get(p.user_id) || 'Unknown Artist',
          profession: p.profession,
        }])));
      }

      setEventTypes(new Map((eventTypesData ?? []).map(e => [e.id, e.name])));
      setPaymentStatuses(new Map((paymentsData ?? []).map(p => [p.booking_id, p.status as PaymentStatus])));
    })();
  }, [bookings]);

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setIsCancelling(true);
    try {
      await cancelBooking(cancelTarget);
      const booking = bookings.find(b => b.id === cancelTarget);
      if (booking && user) {
        await NotificationService.notifyBookingCancelled(user.id, booking.provider_id, cancelTarget, 'customer');
      }
      toast.success('Booking cancelled successfully.');
      setCancelTarget(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel booking');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleDownloadInvoice = (booking: typeof bookings[number]) => {
    const provider = providers.get(booking.provider_id);
    const html = `
      <html><head><title>Invoice - ${booking.id}</title>
      <style>body{font-family:sans-serif;padding:40px;color:#222}
      h1{color:#8B1538}table{width:100%;border-collapse:collapse;margin-top:20px}
      td,th{padding:8px;border-bottom:1px solid #eee;text-align:left}</style></head>
      <body>
        <h1>Vowza Invoice</h1>
        <p>Booking ID: ${booking.id}</p>
        <table>
          <tr><th>Artist</th><td>${provider?.full_name ?? 'Unknown Artist'}</td></tr>
          <tr><th>Event Date</th><td>${new Date(booking.event_date).toLocaleDateString('en-IN')}</td></tr>
          <tr><th>Venue</th><td>${booking.venue_address}, ${booking.venue_city}</td></tr>
          <tr><th>Amount</th><td>₹${booking.amount.toLocaleString()}</td></tr>
          <tr><th>Platform Fee</th><td>₹${(booking.platform_fee ?? 0).toLocaleString()}</td></tr>
          <tr><th>Status</th><td>${statusLabels[booking.status]}</td></tr>
        </table>
      </body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); win.print(); }
  };

  const sorted = useMemo(
    () => [...bookings].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [bookings]
  );

  const activeBookings = sorted.filter(b => !['cancelled', 'rejected', 'completed'].includes(b.status));
  const pastBookings = sorted.filter(b => ['cancelled', 'rejected', 'completed'].includes(b.status));
  const detail = sorted.find(b => b.id === detailBooking);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">My Bookings</h1>
        <p className="text-muted-foreground text-sm mt-1">Track and manage all your event bookings.</p>
      </div>

      {sorted.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {activeBookings.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Active</h2>
              <AnimatePresence>
                {activeBookings.map((booking, i) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    index={i}
                    providerName={providers.get(booking.provider_id)?.full_name ?? 'Unknown Artist'}
                    eventTypeName={booking.event_type_id ? eventTypes.get(booking.event_type_id) ?? 'Event' : 'Event'}
                    paymentStatus={paymentStatuses.get(booking.id)}
                    onView={() => setDetailBooking(booking.id)}
                    onCancel={() => setCancelTarget(booking.id)}
                    onDownload={() => handleDownloadInvoice(booking)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {pastBookings.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Past</h2>
              <AnimatePresence>
                {pastBookings.map((booking, i) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    index={i}
                    providerName={providers.get(booking.provider_id)?.full_name ?? 'Unknown Artist'}
                    eventTypeName={booking.event_type_id ? eventTypes.get(booking.event_type_id) ?? 'Event' : 'Event'}
                    paymentStatus={paymentStatuses.get(booking.id)}
                    onView={() => setDetailBooking(booking.id)}
                    onDownload={() => handleDownloadInvoice(booking)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      {/* Detail dialog */}
      <Dialog open={!!detailBooking} onOpenChange={() => setDetailBooking(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <Row label="Artist" value={providers.get(detail.provider_id)?.full_name ?? 'Unknown Artist'} />
              <Row label="Event Type" value={detail.event_type_id ? eventTypes.get(detail.event_type_id) ?? '—' : '—'} />
              <Row label="Date" value={new Date(detail.event_date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
              <Row label="Time" value={detail.event_time ?? '—'} />
              <Row label="Duration" value={detail.event_duration_hours ? `${detail.event_duration_hours} hrs` : '—'} />
              <Row label="Venue" value={`${detail.venue_address}, ${detail.venue_city}`} />
              <Row label="Amount" value={`₹${detail.amount.toLocaleString()}`} />
              <Row label="Status" value={statusLabels[detail.status]} />
              {detail.customer_notes && <Row label="Your Notes" value={detail.customer_notes} />}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel confirm dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={() => setCancelTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel? The artist will be notified. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setCancelTarget(null)}>Keep Booking</Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" disabled={isCancelling} onClick={handleConfirmCancel}>
              {isCancelling ? 'Cancelling…' : 'Yes, Cancel'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-border/60 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground text-right">{value}</span>
    </div>
  );
}

function BookingCard({
  booking, index, providerName, eventTypeName, paymentStatus, onView, onCancel, onDownload,
}: {
  booking: any;
  index: number;
  providerName: string;
  eventTypeName: string;
  paymentStatus?: PaymentStatus;
  onView: () => void;
  onCancel?: () => void;
  onDownload: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileHover={{ y: -3 }}
      className="rounded-2xl bg-white border border-border p-5 shadow-sm hover:shadow-md transition-shadow duration-300"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusStyles[booking.status as BookingStatus]}`}>
              {statusLabels[booking.status as BookingStatus]}
            </span>
            {paymentStatus && (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${paymentStyles[paymentStatus]}`}>
                Payment: {paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1)}
              </span>
            )}
            <span className="text-sm font-semibold text-[#8B1538] ml-auto">₹{booking.amount.toLocaleString()}</span>
          </div>
          <h3 className="font-semibold text-foreground truncate">{providerName}</h3>
          <p className="text-sm text-muted-foreground">{eventTypeName}</p>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(booking.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            {booking.event_time && (
              <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{booking.event_time}</span>
            )}
            <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{booking.venue_city}</span>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onView}>
            <Eye className="w-4 h-4 mr-1" /> View
          </Button>
          <Button variant="outline" size="sm" onClick={onDownload}>
            <Download className="w-4 h-4 mr-1" /> Invoice
          </Button>
          {onCancel && booking.status === 'requested' && (
            <Button variant="outline" size="sm" className="border-red-300 text-red-600 hover:bg-red-50" onClick={onCancel}>
              <XCircle className="w-4 h-4 mr-1" /> Cancel
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="rounded-3xl border border-dashed border-border bg-white/60 py-16 flex flex-col items-center text-center px-6"
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#8B1538]/10 to-[#D4AF37]/10 flex items-center justify-center mb-4">
        <CalendarX className="w-8 h-8 text-[#8B1538]" />
      </div>
      <h3 className="font-display font-semibold text-lg text-foreground mb-1">No bookings yet</h3>
      <p className="text-muted-foreground text-sm max-w-sm mb-5">
        Start planning your event by browsing our curated list of talented artists.
      </p>
      <Link to="/browse">
        <Button className="bg-gradient-to-r from-[#8B1538] to-[#A31E42] hover:opacity-90">
          <VowzaIcon className="w-4 h-4 mr-1.5" /> Browse Artists
        </Button>
      </Link>
    </motion.div>
  );
}
