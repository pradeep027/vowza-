import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Calendar, MapPin, IndianRupee } from 'lucide-react';
import ChatBox from '@/components/ChatBox';
import AppLogo from '@/components/AppLogo';
import type { Database } from '@/integrations/supabase/types';
import { useDashboardLink } from '@/hooks/useDashboardLink';

type BookingStatus = Database['public']['Enums']['booking_status'];

interface BookingDetails {
  id: string;
  event_date: string;
  event_time: string | null;
  venue_address: string;
  venue_city: string;
  amount: number;
  status: BookingStatus;
  requirements: string | null;
  customer_id: string;
  provider_id: string;
}

const statusColors: Record<BookingStatus, string> = {
  requested: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30',
  accepted: 'bg-blue-500/20 text-blue-700 border-blue-500/30',
  in_progress: 'bg-purple-500/20 text-purple-700 border-purple-500/30',
  completed: 'bg-green-500/20 text-green-700 border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-700 border-red-500/30',
  rejected: 'bg-gray-500/20 text-gray-700 border-gray-500/30',
};

const BookingChat = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [otherUserName, setOtherUserName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCustomer, setIsCustomer] = useState(false);
  const { dashboardLink } = useDashboardLink();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    if (bookingId && user) {
      fetchBookingDetails();
    }
  }, [bookingId, user, authLoading, navigate]);

  const fetchBookingDetails = async () => {
    if (!bookingId || !user) return;

    try {
      // Fetch booking
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select('id, event_date, event_time, venue_address, venue_city, amount, status, requirements, customer_id, provider_id')
        .eq('id', bookingId)
        .single();

      if (bookingError) throw bookingError;

      setBooking(bookingData);
      const customerView = bookingData.customer_id === user.id;
      setIsCustomer(customerView);

      // Fetch the other party's name
      if (customerView) {
        // Customer viewing - get provider name
        const { data: providerData } = await supabase
          .from('provider_profiles')
          .select('user_id')
          .eq('id', bookingData.provider_id)
          .single();

        if (providerData) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', providerData.user_id)
            .single();

          setOtherUserName(profileData?.full_name || 'Provider');
        }
      } else {
        // Provider viewing - get customer name
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', bookingData.customer_id)
          .single();

        setOtherUserName(profileData?.full_name || 'Customer');
      }
    } catch (error: any) {
      toast.error('Failed to load booking');
      navigate(-1);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cream via-background to-blush/20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cream via-background to-blush/20">
        <p className="text-muted-foreground">Booking not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream via-background to-blush/20">
      {/* Header */}
      <header className="bg-card/95 backdrop-blur-sm border-b border-gold/20 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <AppLogo size="md" />
          <div className="flex-1" />
          <Badge className={statusColors[booking.status]}>
            {booking.status.replace('_', ' ')}
          </Badge>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chat Section */}
          <div className="lg:col-span-2">
            <ChatBox bookingId={booking.id} otherUserName={otherUserName} />
          </div>

          {/* Booking Details Sidebar */}
          <div>
            <Card className="border-gold/20 sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg">Booking Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>
                    {new Date(booking.event_date).toLocaleDateString('en-IN', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                    {booking.event_time && ` at ${booking.event_time}`}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span>{booking.venue_address}, {booking.venue_city}</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <IndianRupee className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold text-gold">
                    ₹{booking.amount.toLocaleString()}
                  </span>
                </div>

                {booking.requirements && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-1">Requirements</p>
                    <p className="text-sm">{booking.requirements}</p>
                  </div>
                )}

                <div className="pt-4">
                  <Link to={isCustomer ? '/my-bookings' : dashboardLink}>
                    <Button variant="outline" className="w-full">
                      View All Bookings
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default BookingChat;
