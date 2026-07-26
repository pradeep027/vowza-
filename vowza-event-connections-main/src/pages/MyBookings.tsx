import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useBookings } from '@/hooks/useBookings';
import { supabase } from '@/integrations/supabase/client';
import { NotificationService } from '@/services/notificationService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AvailabilityCalendar from '@/components/booking/AvailabilityCalendar';
import { checkDateAvailable } from '@/hooks/useAvailability';
import { toast } from 'sonner';
import {
  ArrowLeft, Calendar, Clock, MapPin, Sparkles,
  XCircle, MessageCircle, RefreshCw, AlertCircle,
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type BookingStatus = Database['public']['Enums']['booking_status'];

type BookingStatus = Database['public']['Enums']['booking_status'];

interface ProviderInfo {
  id: string;
  full_name: string;
  profession: string;
}

const statusColors: Record<BookingStatus, string> = {
  requested: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30',
  accepted: 'bg-blue-500/20 text-blue-700 border-blue-500/30',
  in_progress: 'bg-purple-500/20 text-purple-700 border-purple-500/30',
  completed: 'bg-green-500/20 text-green-700 border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-700 border-red-500/30',
  rejected: 'bg-gray-500/20 text-gray-700 border-gray-500/30',
};

const statusLabels: Record<BookingStatus, string> = {
  requested: 'Pending',
  accepted: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Declined',
};

const MyBookings = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { bookings, isLoading, cancelBooking } = useBookings();
  const [providers, setProviders] = useState<Map<string, ProviderInfo>>(new Map());

  // ── Reschedule state ────────────────────────────────────────────────────
  const [rescheduleBooking, setRescheduleBooking] = useState<{ id: string; providerId: string } | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [checkingAvail, setCheckingAvail] = useState(false);
  const [availError, setAvailError] = useState<string | null>(null);
  const [isRescheduling, setIsRescheduling] = useState(false);

  // ── Cancel confirm state ────────────────────────────────────────────────
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const fetchProviders = async () => {
      if (bookings.length === 0) return;

      const providerIds = [...new Set(bookings.map(b => b.provider_id))];
      
      const { data: providersData } = await supabase
        .from('provider_profiles')
        .select('id, user_id, profession')
        .in('id', providerIds);

      if (providersData) {
        const userIds = providersData.map(p => p.user_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);

        const profilesMap = new Map(profilesData?.map(p => [p.id, p.full_name]) || []);
        
        const providerMap = new Map(
          providersData.map(p => [
            p.id,
            {
              id: p.id,
              full_name: profilesMap.get(p.user_id) || 'Unknown',
              profession: p.profession
            }
          ])
        );
        
        setProviders(providerMap);
      }
    };

    fetchProviders();
  }, [bookings]);

  const handleCancel = (bookingId: string) => {
    setCancelTarget(bookingId);
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setIsCancelling(true);
    try {
      await cancelBooking(cancelTarget);
      // Notify both customer and artist
      const booking = bookings.find(b => b.id === cancelTarget);
      if (booking && user) {
        await NotificationService.notifyBookingCancelled(
          user.id,
          booking.provider_id,
          cancelTarget,
          'customer'
        );
      }
      toast.success('Booking cancelled successfully.');
      setCancelTarget(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel booking');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRescheduleSelect = async (date: string) => {
    setNewDate(date);
    if (!rescheduleBooking) return;
    setCheckingAvail(true);
    setAvailError(null);
    const result = await checkDateAvailable(rescheduleBooking.providerId, date, newTime || undefined);
    setCheckingAvail(false);
    if (!result.available) {
      setAvailError(result.reason ?? 'Not available on this date');
    }
  };

  const handleConfirmReschedule = async () => {
    if (!rescheduleBooking || !newDate) return;
    setIsRescheduling(true);
    try {
      // Final availability check
      const result = await checkDateAvailable(rescheduleBooking.providerId, newDate, newTime || undefined);
      if (!result.available) {
        setAvailError(result.reason ?? 'Not available');
        setIsRescheduling(false);
        return;
      }

      const updateData: any = { event_date: newDate, status: 'requested' };
      if (newTime) updateData.event_time = newTime;

      const { error } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', rescheduleBooking.id);

      if (error) throw error;

      // Notify artist
      const booking = bookings.find(b => b.id === rescheduleBooking.id);
      if (booking && user) {
        await NotificationService.createNotification({
          userId: booking.provider_id,
          type: 'booking_received',
          title: 'Booking Rescheduled',
          message: `Customer has rescheduled to ${new Date(newDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
          metadata: { bookingId: rescheduleBooking.id },
        });
      }

      toast.success('Booking rescheduled successfully!');
      setRescheduleBooking(null);
      setNewDate('');
      setNewTime('');
      setAvailError(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to reschedule');
    } finally {
      setIsRescheduling(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cream via-background to-blush/20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
      </div>
    );
  }

  const activeBookings = bookings.filter(b => !['cancelled', 'rejected', 'completed'].includes(b.status));
  const pastBookings = bookings.filter(b => ['cancelled', 'rejected', 'completed'].includes(b.status));

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream via-background to-blush/20">
      {/* Header */}
      <header className="bg-card/95 backdrop-blur-sm border-b border-gold/20 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/browse')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-gold flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">Vowza</span>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6 bg-gradient-to-r from-gold to-maroon bg-clip-text text-transparent">
          My Bookings
        </h1>

        {/* Active Bookings */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gold" />
            Active Bookings
          </h2>
          
          {activeBookings.length === 0 ? (
            <Card className="border-gold/20">
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">No active bookings</p>
                <Link to="/browse">
                  <Button className="mt-4 bg-gradient-gold hover:opacity-90">
                    Browse Artists
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {activeBookings.map((booking) => {
                const provider = providers.get(booking.provider_id);
                return (
                  <Card key={booking.id} className="border-gold/20">
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={statusColors[booking.status]}>
                              {statusLabels[booking.status]}
                            </Badge>
                            <span className="font-semibold text-gold">
                              ₹{booking.amount.toLocaleString()}
                            </span>
                          </div>
                          
                          <h3 className="font-semibold">{provider?.full_name || 'Unknown Artist'}</h3>
                          
                          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {new Date(booking.event_date).toLocaleDateString('en-IN', {
                                weekday: 'short',
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                            {booking.event_time && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {booking.event_time}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {booking.venue_city}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Link to={`/chat/${booking.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-gold text-gold hover:bg-gold/10"
                            >
                              <MessageCircle className="w-4 h-4 mr-1" />
                              Chat
                            </Button>
                          </Link>
                          {booking.status === 'requested' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-blue-500 text-blue-600 hover:bg-blue-50"
                                onClick={() => {
                                  setRescheduleBooking({ id: booking.id, providerId: booking.provider_id });
                                  setNewDate('');
                                  setNewTime('');
                                  setAvailError(null);
                                }}
                              >
                                <RefreshCw className="w-4 h-4 mr-1" />
                                Reschedule
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-red-500 text-red-600 hover:bg-red-50"
                                onClick={() => handleCancel(booking.id)}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Cancel
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Past Bookings */}
        {pastBookings.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4 text-muted-foreground">Past Bookings</h2>
            <div className="space-y-4">
              {pastBookings.map((booking) => {
                const provider = providers.get(booking.provider_id);
                return (
                  <Card key={booking.id} className="border-border bg-muted/30">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={statusColors[booking.status]}>
                              {statusLabels[booking.status]}
                            </Badge>
                          </div>
                          <h3 className="font-medium">{provider?.full_name || 'Unknown Artist'}</h3>
                          <p className="text-sm text-muted-foreground">
                            {new Date(booking.event_date).toLocaleDateString('en-IN')} • {booking.venue_city}
                          </p>
                        </div>
                        <span className="font-semibold">₹{booking.amount.toLocaleString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ── Reschedule Modal ──────────────────────────────────────────────── */}
      <Dialog open={!!rescheduleBooking} onOpenChange={() => setRescheduleBooking(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reschedule Booking</DialogTitle>
            <DialogDescription>
              Select a new available date. The booking goes back to "Requested" and the artist must re-confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <AvailabilityCalendar
              providerId={rescheduleBooking?.providerId ?? ''}
              selectedDate={newDate}
              onSelectDate={handleRescheduleSelect}
            />
            {checkingAvail && (
              <p className="text-xs text-muted-foreground animate-pulse">Checking availability…</p>
            )}
            {availError && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{availError}
              </div>
            )}
            {newDate && !availError && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-medium">
                ✓ Available: {new Date(newDate).toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Preferred Start Time (optional)</Label>
              <Input type="time" value={newTime} onChange={e => setNewTime(e.target.value)}
                className="border-border focus:border-gold" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setRescheduleBooking(null)}>Back</Button>
              <Button className="flex-1 bg-gradient-gold hover:opacity-90"
                disabled={!newDate || !!availError || checkingAvail || isRescheduling}
                onClick={handleConfirmReschedule}>
                {isRescheduling ? 'Rescheduling…' : 'Confirm Reschedule'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Cancel Confirm Dialog ─────────────────────────────────────────── */}
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
            <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              disabled={isCancelling} onClick={handleConfirmCancel}>
              {isCancelling ? 'Cancelling…' : 'Yes, Cancel'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default MyBookings;
