import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { 
  Calendar,
  MapPin,
  Users,
  IndianRupee,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Download,
  Bell,
  TrendingUp,
  Plus,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface EventBooking {
  id: string;
  event_name: string;
  event_date: string;
  location: string;
  guest_count: number;
  total_budget: number;
  status: 'planning' | 'pending' | 'confirmed' | 'in_progress' | 'completed';
  created_at: string;
}

interface ArtistBooking {
  id: string;
  event_id: string;
  provider_id: string;
  provider_name: string;
  category: string;
  price: number;
  status: 'pending' | 'accepted' | 'rejected' | 'negotiating';
  created_at: string;
}

const CustomerEventDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [events, setEvents] = useState<EventBooking[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventBooking | null>(null);
  const [artistBookings, setArtistBookings] = useState<ArtistBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    fetchEvents();
  }, [user, navigate]);

  useEffect(() => {
    if (selectedEvent) {
      fetchArtistBookings(selectedEvent.id);
    }
  }, [selectedEvent]);

  const fetchEvents = async () => {
    try {
      // @ts-ignore
      const { data, error } = await supabase
        .from('event_bookings')
        .select('*')
        .eq('customer_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
      
      if (data && data.length > 0) {
        setSelectedEvent(data[0]);
      }
    } catch (error) {
      toast.error('Failed to fetch events');
    } finally {
      setLoading(false);
    }
  };

  const fetchArtistBookings = async (eventId: string) => {
    try {
      // @ts-ignore
      const { data, error } = await supabase
        .from('artist_bookings')
        .select('*')
        .eq('event_id', eventId);

      if (error) throw error;
      setArtistBookings(data || []);
    } catch (error) {
      toast.error('Failed to fetch artist bookings');
    }
  };

  const handleReplaceArtist = (bookingId: string, category: string) => {
    // Navigate to artists page with replace mode
    navigate(`/artists?category=${category}&replace=${bookingId}`);
  };

  const handleDownloadSummary = () => {
    if (!selectedEvent) return;
    
    const summary = {
      event: selectedEvent.event_name,
      date: selectedEvent.event_date,
      location: selectedEvent.location,
      guests: selectedEvent.guest_count,
      budget: selectedEvent.total_budget,
      artists: artistBookings.map(b => ({
        name: b.provider_name,
        category: b.category,
        price: b.price,
        status: b.status,
      })),
    };
    
    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event-summary-${selectedEvent.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Summary downloaded');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
      case 'confirmed':
      case 'completed':
        return 'bg-green-500/20 text-green-700 border-green-500/30';
      case 'rejected':
        return 'bg-red-500/20 text-red-700 border-red-500/30';
      case 'pending':
      case 'negotiating':
        return 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30';
      default:
        return 'bg-gray-500/20 text-gray-700 border-gray-500/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted':
      case 'confirmed':
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      case 'pending':
      case 'negotiating':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const acceptedCount = artistBookings.filter(b => b.status === 'accepted').length;
  const pendingCount = artistBookings.filter(b => b.status === 'pending').length;
  const rejectedCount = artistBookings.filter(b => b.status === 'rejected').length;
  const totalBookedAmount = artistBookings.reduce((sum, b) => sum + b.price, 0);
  const progress = artistBookings.length > 0 ? (acceptedCount / artistBookings.length) * 100 : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-maroon to-maroon-dark text-white py-8 px-4">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold mb-2">Event Dashboard</h1>
          <p className="text-white/80">Manage your event bookings and team</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Events List */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Your Events</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {events.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No events yet
                  </p>
                ) : (
                  events.map((event) => (
                    <div
                      key={event.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedEvent?.id === event.id
                          ? 'border-gold bg-gold/10'
                          : 'border-border hover:border-gold/50'
                      }`}
                      onClick={() => setSelectedEvent(event)}
                    >
                      <p className="font-medium">{event.event_name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(event.event_date).toLocaleDateString()}
                      </div>
                      <Badge className={getStatusColor(event.status)} variant="outline" size="sm">
                        {event.status}
                      </Badge>
                    </div>
                  ))
                )}
                
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate('/browse')}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Plan New Event
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {!selectedEvent ? (
              <Card>
                <CardContent className="text-center py-12">
                  <p className="text-muted-foreground mb-4">Select an event to view details</p>
                  <Button onClick={() => navigate('/browse')}>
                    Plan Your First Event
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Event Overview */}
                <Card>
                  <CardHeader>
                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <CardTitle>{selectedEvent.event_name}</CardTitle>
                      <Badge className={getStatusColor(selectedEvent.status)} variant="outline">
                        {selectedEvent.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Date</p>
                          <p className="font-medium">{new Date(selectedEvent.event_date).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Location</p>
                          <p className="font-medium">{selectedEvent.location}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Guests</p>
                          <p className="font-medium">{selectedEvent.guest_count}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <IndianRupee className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Budget</p>
                          <p className="font-medium">₹{(selectedEvent.total_budget / 1000).toFixed(0)}K</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Accepted</p>
                          <p className="text-2xl font-bold text-green-600">{acceptedCount}</p>
                        </div>
                        <CheckCircle className="w-8 h-8 text-green-600" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Pending</p>
                          <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
                        </div>
                        <Clock className="w-8 h-8 text-yellow-600" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Rejected</p>
                          <p className="text-2xl font-bold text-red-600">{rejectedCount}</p>
                        </div>
                        <XCircle className="w-8 h-8 text-red-600" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Booked</p>
                          <p className="text-2xl font-bold">₹{(totalBookedAmount / 1000).toFixed(0)}K</p>
                        </div>
                        <IndianRupee className="w-8 h-8" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Booking Progress */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      Booking Progress
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Artists Confirmed</span>
                          <span>{acceptedCount}/{artistBookings.length}</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Remaining Budget</span>
                        <span className="font-semibold text-green-600">
                          ₹{((selectedEvent.total_budget - totalBookedAmount) / 1000).toFixed(0)}K
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Artist Bookings */}
                <Card>
                  <CardHeader>
                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <CardTitle>Selected Artists</CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadSummary}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Summary
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {artistBookings.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No artists selected yet
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {artistBookings.map((booking) => (
                          <div key={booking.id} className="flex flex-col items-start gap-3 p-4 border rounded-lg sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                                  <Users className="w-6 h-6 text-muted-foreground" />
                                </div>
                                <div>
                                  <p className="font-medium">{booking.provider_name}</p>
                                  <p className="text-sm text-muted-foreground capitalize">
                                    {booking.category.replace('_', ' ')}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm">
                                <div className="flex items-center gap-1">
                                  <IndianRupee className="w-3 h-3" />
                                  {booking.price}
                                </div>
                                <Badge className={getStatusColor(booking.status)} variant="outline" size="sm">
                                  {getStatusIcon(booking.status)}
                                  <span className="ml-1">{booking.status}</span>
                                </Badge>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {booking.status === 'rejected' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleReplaceArtist(booking.id, booking.category)}
                                >
                                  <RefreshCw className="w-4 h-4 mr-1" />
                                  Replace
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => navigate(`/provider/${booking.provider_id}`)}
                              >
                                View
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Notifications */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="w-5 h-5" />
                      Notifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {rejectedCount > 0 && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-3">
                        <p className="text-sm text-red-700">
                          {rejectedCount} artist(s) rejected your booking. Click "Replace" to find alternatives.
                        </p>
                      </div>
                    )}
                    {pendingCount > 0 && (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-700">
                          {pendingCount} artist(s) are reviewing your booking request.
                        </p>
                      </div>
                    )}
                    {rejectedCount === 0 && pendingCount === 0 && acceptedCount > 0 && (
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-700">
                          All artists have accepted! Your event is ready.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerEventDashboard;
