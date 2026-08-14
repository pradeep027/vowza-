import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Calendar, MapPin, IndianRupee, Lock, MessageSquareOff } from 'lucide-react';
import ChatBox from '@/components/ChatBox';
import AppLogo from '@/components/AppLogo';
import { useDashboardLink } from '@/hooks/useDashboardLink';

/* ─── Types ────────────────────────────────────────────────────────────────── */
interface BookingDetails {
  id: string;
  event_date: string;
  event_time: string | null;
  venue: string;
  city: string;
  amount: number;
  status: string;
  requirements: string | null;
  customer_id: string;
  provider_id: string;
  source: string;
  packageName: string;
}

/* ─── All category booking tables to search ────────────────────────────────── */
const BOOKING_TABLES = [
  { table: 'bookings', source: 'generic', providerField: 'provider_id', pkgJoin: null },
  { table: 'singer_bookings', source: 'singer', providerField: 'provider_id', pkgJoin: 'singer_packages(name)' },
  { table: 'dancer_bookings', source: 'dancer', providerField: 'provider_id', pkgJoin: 'dancer_packages(name)' },
  { table: 'videography_bookings', source: 'videography', providerField: 'provider_id', pkgJoin: 'videography_packages(name)' },
  { table: 'drone_bookings', source: 'drone', providerField: 'provider_id', pkgJoin: 'drone_packages(name)' },
  { table: 'dj_bookings', source: 'dj', providerField: 'provider_id', pkgJoin: 'dj_packages(name)' },
  { table: 'decorator_bookings', source: 'decorator', providerField: 'provider_id', pkgJoin: 'decorator_packages(name)' },
  { table: 'makeup_bookings', source: 'makeup', providerField: 'provider_id', pkgJoin: 'makeup_packages(name)' },
  { table: 'mehendi_bookings', source: 'mehendi', providerField: 'provider_id', pkgJoin: 'mehendi_packages(name)' },
  { table: 'anchor_bookings', source: 'anchor', providerField: 'provider_id', pkgJoin: 'anchor_packages(name)' },
  { table: 'band_bookings', source: 'band', providerField: 'provider_id', pkgJoin: 'band_packages(name)' },
  { table: 'priest_bookings', source: 'priest', providerField: 'provider_id', pkgJoin: 'priest_packages(name)' },
  { table: 'water_bookings', source: 'water', providerField: 'provider_id', pkgJoin: 'water_packages(name)' },
  { table: 'rental_bookings', source: 'rental', providerField: 'provider_id', pkgJoin: 'rental_packages(name)' },
  { table: 'banquet_bookings', source: 'banquet', providerField: 'provider_id', pkgJoin: 'banquet_halls(name)' },
  { table: 'catering_bookings', source: 'catering', providerField: 'provider_id', pkgJoin: 'catering_packages(name)' },
  { table: 'photography_package_bookings', source: 'photography', providerField: 'photographer_id', pkgJoin: 'photography_packages(name)' },
];

/* ─── Main Component ───────────────────────────────────────────────────────── */
const BookingChat = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { dashboardLink } = useDashboardLink();

  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [otherUserName, setOtherUserName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCustomer, setIsCustomer] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }
    if (bookingId && user) {
      findBooking();
    }
  }, [bookingId, user, authLoading]);

  /* ─── Find booking across ALL tables ─────────────────────────────────── */
  const findBooking = async () => {
    if (!bookingId || !user) return;
    setIsLoading(true);

    try {
      let found: BookingDetails | null = null;

      for (const cfg of BOOKING_TABLES) {
        try {
          // Use minimal safe select — only columns guaranteed to exist
          const { data, error } = await supabase
            .from(cfg.table as any)
            .select('*')
            .eq('id', bookingId)
            .maybeSingle();

          if (error || !data) continue;

          // Extract fields safely with fallbacks
          const isGeneric = cfg.table === 'bookings';
          const providerId = (data as any)[cfg.providerField] || (data as any).provider_id || '';

          found = {
            id: data.id,
            event_date: (data as any).event_date || '',
            event_time: (data as any).event_time || null,
            venue: (data as any).venue_address || (data as any).venue || (data as any).venue_name || '',
            city: (data as any).venue_city || (data as any).city || '',
            amount: Number((data as any).total_amount || (data as any).base_amount || (data as any).amount || 0),
            status: (data as any).status || 'pending',
            requirements: (data as any).requirements || (data as any).special_requirements || (data as any).notes || null,
            customer_id: (data as any).customer_id,
            provider_id: providerId,
            source: cfg.source,
            packageName: `${cfg.source.charAt(0).toUpperCase() + cfg.source.slice(1)} Package`,
          };

          // Try to get package name via join (non-critical, may fail)
          if (cfg.pkgJoin && (data as any).package_id) {
            const pkgTable = cfg.pkgJoin.split('(')[0];
            const { data: pkgData } = await supabase
              .from(pkgTable as any)
              .select('name')
              .eq('id', (data as any).package_id)
              .maybeSingle();
            if (pkgData?.name) found.packageName = pkgData.name;
          }

          break; // Found the booking, stop searching
        } catch {
          continue; // This table doesn't have the booking, try next
        }
      }

      if (!found) {
        toast.error('Booking not found');
        navigate(-1);
        return;
      }

      // Check if user is a participant
      const customerView = found.customer_id === user.id;
      let isProvider = false;
      if (!customerView) {
        const { data: pp } = await supabase
          .from('provider_profiles')
          .select('id')
          .eq('id', found.provider_id)
          .eq('user_id', user.id)
          .maybeSingle();
        isProvider = !!pp;
      }

      if (!customerView && !isProvider) {
        setAccessDenied(true);
        setIsLoading(false);
        return;
      }

      setBooking(found);
      setIsCustomer(customerView);

      // Fetch the other party's name
      if (customerView) {
        const { data: providerData } = await supabase
          .from('provider_profiles')
          .select('user_id')
          .eq('id', found.provider_id)
          .maybeSingle();
        if (providerData) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', providerData.user_id)
            .maybeSingle();
          setOtherUserName(profileData?.full_name || 'Artist');
        }
      } else {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', found.customer_id)
          .maybeSingle();
        setOtherUserName(profileData?.full_name || 'Customer');
      }
    } catch (error: any) {
      console.error('[BookingChat] Error:', error);
      toast.error('Failed to load booking');
      navigate(-1);
    } finally {
      setIsLoading(false);
    }
  };

  /* ─── Loading state ──────────────────────────────────────────────────── */
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cream via-background to-blush/20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
      </div>
    );
  }

  /* ─── Access denied ──────────────────────────────────────────────────── */
  if (accessDenied) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-cream via-background to-blush/20 px-4">
        <Lock className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
        <p className="text-sm text-muted-foreground text-center mb-6">You don't have permission to view this conversation.</p>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  /* ─── Booking not found ──────────────────────────────────────────────── */
  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cream via-background to-blush/20">
        <p className="text-muted-foreground">Booking not found</p>
      </div>
    );
  }

  /* ─── Determine chat eligibility ─────────────────────────────────────── */
  const normalizedStatus = booking.status === 'confirmed' ? 'in_progress' : booking.status === 'pending' ? 'requested' : booking.status;
  const advancePaid = normalizedStatus === 'in_progress' || normalizedStatus === 'completed';
  const isCompleted = normalizedStatus === 'completed';
  const chatLocked = !advancePaid;

  /* ─── Status styling ─────────────────────────────────────────────────── */
  const statusColor = chatLocked
    ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
    : isCompleted
      ? 'bg-green-100 text-green-700 border-green-200'
      : 'bg-emerald-100 text-emerald-700 border-emerald-200';

  const statusLabel = chatLocked
    ? 'Advance Payment Required'
    : isCompleted
      ? 'Completed'
      : 'Active';

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
          <Badge className={statusColor}>{statusLabel}</Badge>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ─── Chat Section ─────────────────────────────────────────── */}
          <div className="lg:col-span-2">
            {/* LOCKED: advance not paid */}
            {chatLocked && (
              <div className="flex flex-col items-center justify-center h-[500px] bg-card rounded-lg border border-gold/20 p-8">
                <Lock className="w-12 h-12 text-stone-400 mb-4" />
                <h3 className="font-semibold text-lg mb-2">Chat Locked</h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
                  Pay the 20% advance to unlock communication with the artist. Once paid, you can chat directly about your event details.
                </p>
                <Button onClick={() => navigate('/my-bookings')} className="bg-[#8B1538] hover:bg-[#70102d] text-white">
                  Go to My Bookings
                </Button>
              </div>
            )}

            {/* COMPLETED: read-only */}
            {isCompleted && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 rounded-xl bg-stone-50 border border-stone-200">
                  <MessageSquareOff className="w-4 h-4 text-stone-500" />
                  <p className="text-xs text-stone-600">This chat is closed because the event has been completed. You can view the conversation history below.</p>
                </div>
                <ChatBox bookingId={booking.id} otherUserName={otherUserName} disabled />
              </div>
            )}

            {/* ACTIVE: chat enabled */}
            {advancePaid && !isCompleted && (
              <ChatBox bookingId={booking.id} otherUserName={otherUserName} />
            )}
          </div>

          {/* ─── Booking Details Sidebar ──────────────────────────────── */}
          <div>
            <Card className="border-gold/20 sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg">Booking Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">Package</p>
                  <p className="text-sm font-medium">{booking.packageName}</p>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>
                    {new Date(booking.event_date).toLocaleDateString('en-IN', {
                      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                    })}
                    {booking.event_time && ` at ${booking.event_time}`}
                  </span>
                </div>

                {(booking.venue || booking.city) && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{[booking.venue, booking.city].filter(Boolean).join(', ')}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm">
                  <IndianRupee className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold text-gold">₹{booking.amount.toLocaleString()}</span>
                </div>

                {booking.requirements && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-1">Requirements</p>
                    <p className="text-sm">{booking.requirements}</p>
                  </div>
                )}

                <div className="pt-4">
                  <Link to={isCustomer ? '/my-bookings' : (dashboardLink || '/vendor/bookings')}>
                    <Button variant="outline" className="w-full">View All Bookings</Button>
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
