import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { NotificationService } from '@/services/notificationService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import AvailabilityCalendar from '@/components/booking/AvailabilityCalendar';
import { useArtistAvailabilityManager } from '@/hooks/useAvailability';
import { toast } from 'sonner';
import {
  Calendar,
  DollarSign,
  Star,
  Clock,
  CheckCircle,
  XCircle,
  Bell,
  User,
  LogOut,
  TrendingUp,
  MessageCircle,
  Edit,
  Settings,
  IndianRupee,
  CalendarDays,
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type BookingStatus = Database['public']['Enums']['booking_status'];

interface Booking {
  id: string;
  event_date: string;
  event_time: string | null;
  venue_city: string;
  venue_address: string;
  amount: number;
  status: BookingStatus;
  requirements: string | null;
  customer_id: string;
}

interface CustomerProfile {
  id: string;
  full_name: string;
  phone: string | null;
}

interface ProviderProfile {
  id: string;
  profession: string;
  is_available: boolean;
  average_rating: number;
  total_reviews: number;
  total_bookings: number;
  total_earnings?: number;
  bio: string | null;
  min_price?: number | null;
  max_price?: number | null;
  [key: string]: any;
}

interface Review {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  customer_name: string;
}

const ProviderDashboard = () => {
  const [providerProfile, setProviderProfile] = useState<ProviderProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [customers, setCustomers] = useState<Map<string, CustomerProfile>>(new Map());
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(true);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editMinPrice, setEditMinPrice] = useState('');
  const [editMaxPrice, setEditMaxPrice] = useState('');
  const [activeTab, setActiveTab] = useState<'bookings' | 'calendar' | 'reviews'>('bookings');
  const [blockReason, setBlockReason] = useState('');

  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  const { blockDate, unblockDate, isSubmitting: isBlockingDate } =
    useArtistAvailabilityManager(providerProfile?.id);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
      return;
    }

    if (user) {
      fetchProviderData();
      subscribeToBookings();
    }
  }, [user, loading, navigate]);

  const fetchProviderData = async () => {
    if (!user) return;

    try {
      // Fetch provider profile
      const { data: profile, error: profileError } = await supabase
        .from('provider_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile) {
        navigate('/provider/register');
        return;
      }

      setProviderProfile(profile as any);
      setIsAvailable(profile.is_available);
      setEditBio(profile.bio || '');
      setEditMinPrice((profile as any).min_price?.toString() || '');
      setEditMaxPrice((profile as any).max_price?.toString() || '');

      // Fetch bookings
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, event_date, event_time, venue_city, venue_address, amount, status, requirements, customer_id')
        .eq('provider_id', profile.id)
        .order('event_date', { ascending: true });

      if (bookingsError) throw bookingsError;

      setBookings(bookingsData || []);

      // Fetch customer profiles
      if (bookingsData && bookingsData.length > 0) {
        const customerIds = [...new Set(bookingsData.map(b => b.customer_id))];
        const { data: customersData, error: customersError } = await supabase
          .from('profiles')
          .select('id, full_name, phone')
          .in('id', customerIds);

        if (!customersError && customersData) {
          setCustomers(new Map(customersData.map(c => [c.id, c])));
        }
      }

      // Fetch reviews
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('reviews')
        .select('id, rating, review_text, created_at, customer_id')
        .eq('provider_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!reviewsError && reviewsData) {
        const reviewCustomerIds = reviewsData.map(r => r.customer_id);
        const { data: reviewCustomersData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', reviewCustomerIds);

        const customersMap = new Map(reviewCustomersData?.map(c => [c.id, c.full_name]) || []);
        
        setReviews(reviewsData.map(r => ({
          ...r,
          customer_name: customersMap.get(r.customer_id) || 'Anonymous'
        })));
      }

      // Calculate total earnings from completed bookings
      const completedBookings = bookingsData?.filter(b => b.status === 'completed') || [];
      const totalEarnings = completedBookings.reduce((sum, b) => sum + (b.amount || 0), 0);
      setProviderProfile(prev => prev ? { ...prev, total_earnings: totalEarnings } : null);

    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const subscribeToBookings = () => {
    if (!user) return;

    const channel = supabase
      .channel('provider-bookings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings'
        },
        () => {
          fetchProviderData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const toggleAvailability = async (checked: boolean) => {
    if (!providerProfile) return;

    try {
      const { error } = await supabase
        .from('provider_profiles')
        .update({ is_available: checked })
        .eq('id', providerProfile.id);

      if (error) throw error;

      setIsAvailable(checked);
      toast.success(checked ? 'You are now online' : 'You are now offline');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleBookingAction = async (bookingId: string, action: 'accepted' | 'rejected') => {
    try {
      // Get booking details to fetch customer_id
      const { data: booking } = await supabase
        .from('bookings')
        .select('customer_id')
        .eq('id', bookingId)
        .single();

      if (!booking) throw new Error('Booking not found');

      const { error } = await supabase
        .from('bookings')
        .update({ status: action })
        .eq('id', bookingId);

      if (error) throw error;

      // Send notification to customer
      if (action === 'accepted') {
        await NotificationService.notifyBookingAccepted(booking.customer_id, user?.id || '', bookingId);
      } else if (action === 'rejected') {
        await NotificationService.notifyBookingRejected(booking.customer_id, user?.id || '', bookingId);
      } else if (action === 'completed') {
        await NotificationService.notifyBookingCompleted(booking.customer_id, user?.id || '', bookingId);
      }

      toast.success(`Booking ${action}`);
      fetchProviderData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getStatusColor = (status: BookingStatus) => {
    switch (status) {
      case 'requested': return 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30';
      case 'accepted': return 'bg-blue-500/20 text-blue-700 border-blue-500/30';
      case 'in_progress': return 'bg-purple-500/20 text-purple-700 border-purple-500/30';
      case 'completed': return 'bg-green-500/20 text-green-700 border-green-500/30';
      case 'cancelled': return 'bg-red-500/20 text-red-700 border-red-500/30';
      case 'rejected': return 'bg-gray-500/20 text-gray-700 border-gray-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cream via-background to-blush/20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
      </div>
    );
  }

  const pendingBookings = bookings.filter(b => b.status === 'requested');
  const upcomingBookings = bookings.filter(b => b.status === 'accepted');
  const completedBookings = bookings.filter(b => b.status === 'completed');
  const totalEarnings = providerProfile?.total_earnings || completedBookings.reduce((sum, b) => sum + b.amount, 0);

  const handleSaveProfile = async () => {
    if (!providerProfile) return;
    
    try {
      const { error } = await supabase
        .from('provider_profiles')
        .update({
          bio: editBio,
          min_price: parseInt(editMinPrice) || null,
          max_price: parseInt(editMaxPrice) || null
        })
        .eq('id', providerProfile.id);

      if (error) throw error;

      toast.success('Profile updated successfully');
      setShowEditProfile(false);
      fetchProviderData();
      // Notify user their profile was updated
      if (user) await NotificationService.notifyProfileUpdated(user.id);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream via-background to-blush/20">

      {/* ── Approval Status Banner ── */}
      {providerProfile && providerProfile.verification_status !== 'approved' && (
        <div className={`w-full px-4 py-3 text-center text-sm font-semibold ${
          providerProfile.verification_status === 'pending'
            ? 'bg-amber-50 border-b border-amber-200 text-amber-700'
            : 'bg-red-50 border-b border-red-200 text-red-700'
        }`}>
          {providerProfile.verification_status === 'pending' ? (
            <>⏳ Your profile is under review. Our team will verify and notify you within 24–48 hours.</>
          ) : (
            <>
              ❌ Your profile was not approved.
              {(providerProfile as any).rejection_reason && (
                <> Reason: <strong>{(providerProfile as any).rejection_reason}</strong>.</>
              )}
              {' '}
              <a href="/vendor/edit" className="underline font-bold ml-1">
                Update your profile and resubmit →
              </a>
            </>
          )}
        </div>
      )}

      {/* Approved: show live badge */}
      {providerProfile && providerProfile.verification_status === 'approved' && (
        <div className="w-full px-4 py-2 text-center text-xs font-semibold bg-emerald-50 border-b border-emerald-200 text-emerald-700">
          ✅ Your profile is <strong>Live on Vowza</strong> — customers can discover and book you.
          <a href={`/artist/${providerProfile.id}`} target="_blank" rel="noopener noreferrer" className="underline ml-2">
            View public profile →
          </a>
        </div>
      )}
      {/* Header */}
      <header className="bg-card/95 backdrop-blur-sm border-b border-gold/20 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-gold to-maroon bg-clip-text text-transparent">
            Vowza Pro
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {isAvailable ? 'Online' : 'Offline'}
              </span>
              <Switch
                checked={isAvailable}
                onCheckedChange={toggleAvailability}
                className="data-[state=checked]:bg-green-500"
              />
            </div>
            <Button variant="ghost" size="icon">
              <Bell className="w-5 h-5" />
            </Button>
            <Link to="/vendor/edit">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Edit className="w-3.5 h-3.5" /> Edit Full Profile
              </Button>
            </Link>
            <Dialog open={showEditProfile} onOpenChange={setShowEditProfile}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Edit className="w-5 h-5" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Profile</DialogTitle>
                  <DialogDescription>Update your profile information</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Bio</label>
                    <Textarea
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      placeholder="Tell customers about yourself..."
                      rows={4}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Min Price (₹)</label>
                      <Input
                        type="number"
                        value={editMinPrice}
                        onChange={(e) => setEditMinPrice(e.target.value)}
                        placeholder="5000"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Max Price (₹)</label>
                      <Input
                        type="number"
                        value={editMaxPrice}
                        onChange={(e) => setEditMaxPrice(e.target.value)}
                        placeholder="20000"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowEditProfile(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveProfile}>
                    Save Changes
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="icon">
              <User className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-gold/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-gold/10">
                  <DollarSign className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Earnings</p>
                  <p className="text-xl font-bold">₹{totalEarnings.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-gold/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-maroon/10">
                  <Calendar className="w-5 h-5 text-maroon" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Bookings</p>
                  <p className="text-xl font-bold">{providerProfile?.total_bookings || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-gold/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-royal/10">
                  <Star className="w-5 h-5 text-royal" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Rating</p>
                  <p className="text-xl font-bold">
                    {providerProfile?.average_rating?.toFixed(1) || '0.0'}
                    <span className="text-sm text-muted-foreground ml-1">
                      ({providerProfile?.total_reviews || 0})
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-gold/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-green-500/10">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-xl font-bold">{pendingBookings.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Tab Navigation ─────────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 bg-muted rounded-xl mb-6 w-fit">
          {([
            { id: 'bookings', label: 'Bookings', icon: Calendar },
            { id: 'calendar', label: 'My Calendar', icon: CalendarDays },
            { id: 'reviews',  label: 'Reviews',  icon: Star },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── CALENDAR TAB ────────────────────────────────────────────────── */}
        {activeTab === 'calendar' && providerProfile && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card className="border-gold/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-gold" />
                  Manage Your Availability
                </CardTitle>
                <CardDescription>
                  Click available dates to block them. Click blocked dates to unblock them.
                  Booked dates (confirmed bookings) cannot be changed here.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AvailabilityCalendar
                  providerId={providerProfile.id}
                  manageMode={true}
                  onBlockDate={async (date) => {
                    await blockDate(date, blockReason || undefined);
                    toast.success(`${new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} blocked`);
                  }}
                  onUnblockDate={async (date) => {
                    await unblockDate(date);
                    toast.success(`${new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} unblocked`);
                  }}
                />

                {/* Block reason input */}
                <div className="mt-4 space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Reason (optional — shown to customers)
                  </label>
                  <input
                    type="text"
                    value={blockReason}
                    onChange={e => setBlockReason(e.target.value)}
                    placeholder="e.g., Personal event, Out of city, Holiday…"
                    className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:border-gold transition-colors"
                  />
                </div>

                {isBlockingDate && (
                  <p className="text-xs text-muted-foreground mt-2 animate-pulse">Updating availability…</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-gold/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-gold" />
                  Upcoming Bookings Calendar
                </CardTitle>
                <CardDescription>Your confirmed bookings this month</CardDescription>
              </CardHeader>
              <CardContent>
                <AvailabilityCalendar
                  providerId={providerProfile.id}
                  readOnly={true}
                />
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Confirmed Events
                  </p>
                  {upcomingBookings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No upcoming bookings</p>
                  ) : (
                    upcomingBookings.slice(0, 5).map(b => (
                      <div key={b.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                        <div>
                          <p className="text-sm font-medium">
                            {new Date(b.event_date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
                          </p>
                          <p className="text-xs text-muted-foreground">{b.venue_city}</p>
                        </div>
                        <Badge className="bg-blue-100 text-blue-700 border-0 text-[11px]">
                          ₹{b.amount.toLocaleString()}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── BOOKINGS TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'bookings' && (
          <div className="space-y-8">
            {/* Pending Requests */}
            {pendingBookings.length > 0 && (
              <Card className="border-yellow-500/30 bg-yellow-500/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-yellow-600" />
                    New Booking Requests
                  </CardTitle>
                  <CardDescription>Respond to these requests quickly</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {pendingBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="p-4 rounded-lg bg-card border border-border flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={getStatusColor(booking.status)}>
                            {booking.status}
                          </Badge>
                          <span className="font-semibold">₹{booking.amount.toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(booking.event_date).toLocaleDateString('en-IN', {
                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                          })}
                          {booking.event_time && ` at ${booking.event_time}`}
                        </p>
                        <p className="text-sm">{booking.venue_address}, {booking.venue_city}</p>
                        {booking.requirements && (
                          <p className="text-sm text-muted-foreground mt-1">Note: {booking.requirements}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Link to={`/chat/${booking.id}`}>
                          <Button variant="outline" size="sm" className="border-gold text-gold hover:bg-gold/10">
                            <MessageCircle className="w-4 h-4 mr-1" />Chat
                          </Button>
                        </Link>
                        <Button variant="outline" size="sm" className="border-red-500 text-red-600 hover:bg-red-50"
                          onClick={() => handleBookingAction(booking.id, 'rejected')}>
                          <XCircle className="w-4 h-4 mr-1" />Decline
                        </Button>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleBookingAction(booking.id, 'accepted')}>
                          <CheckCircle className="w-4 h-4 mr-1" />Accept
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Upcoming Bookings */}
            <Card className="border-gold/20">
              <CardHeader>
                <CardTitle>Upcoming Events</CardTitle>
                <CardDescription>Your confirmed bookings</CardDescription>
              </CardHeader>
              <CardContent>
                {upcomingBookings.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No upcoming bookings yet</p>
                ) : (
                  <div className="space-y-4">
                    {upcomingBookings.map((booking) => (
                      <div key={booking.id} className="p-4 rounded-lg bg-muted/30 border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <Badge className={getStatusColor(booking.status)}>{booking.status}</Badge>
                          <span className="font-semibold text-gold">₹{booking.amount.toLocaleString()}</span>
                        </div>
                        <p className="font-medium">
                          {new Date(booking.event_date).toLocaleDateString('en-IN', {
                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                          })}
                        </p>
                        <p className="text-sm text-muted-foreground mb-3">
                          {booking.venue_address}, {booking.venue_city}
                        </p>
                        <Link to={`/chat/${booking.id}`}>
                          <Button variant="outline" size="sm" className="border-gold text-gold hover:bg-gold/10">
                            <MessageCircle className="w-4 h-4 mr-1" />Message Customer
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── REVIEWS TAB ──────────────────────────────────────────────────── */}
        {activeTab === 'reviews' && (
          <Card className="border-gold/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5 text-gold" />
                Reviews ({reviews.length})
              </CardTitle>
              <CardDescription>What customers are saying about you</CardDescription>
            </CardHeader>
            <CardContent>
              {reviews.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No reviews yet</p>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="p-4 rounded-lg bg-muted/30 border border-border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{review.customer_name}</span>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'fill-gold text-gold' : 'text-muted'}`} />
                          ))}
                        </div>
                      </div>
                      {review.review_text && (
                        <p className="text-sm text-muted-foreground">{review.review_text}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(review.created_at).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </main>
    </div>
  );
};

export default ProviderDashboard;
