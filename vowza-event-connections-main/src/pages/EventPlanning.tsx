import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useArtists } from '@/hooks/useArtists';
import { eventTypes } from '@/data/services';
import { getCategoriesForEvent, getBudgetDistribution } from '@/data/eventCategoryMappings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  MapPin, 
  Star, 
  Calendar,
  Users,
  IndianRupee,
  Sparkles,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  Plus,
  Minus,
} from 'lucide-react';

interface SelectedArtist {
  providerId: string;
  category: string;
  artistName: string;
  price: number;
  status: 'pending' | 'accepted' | 'rejected';
}

interface BudgetItem {
  category: string;
  priority: 'essential' | 'recommended' | 'optional';
  budget: number;
  budgetPercentage: number;
  allocatedBudget: number;
}

const EventPlanning = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [totalBudget, setTotalBudget] = useState<number>(500000);
  const [guestCount, setGuestCount] = useState<number>(200);
  const [eventDate, setEventDate] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [selectedArtists, setSelectedArtists] = useState<SelectedArtist[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [activeSection, setActiveSection] = useState<'recommended' | 'available' | 'nearby' | 'featured' | 'popular'>('recommended');
  
  const event = eventTypes.find(e => e.id === eventId);
  const requiredCategories = getCategoriesForEvent(eventId || '');
  
  // Fetch artists for each category
  const { data: recommendedArtists, isLoading: loadingRecommended } = useArtists({
    sortBy: 'rating',
    verified: true,
    available: true,
  });
  
  useEffect(() => {
    if (!eventId) {
      navigate('/browse');
      return;
    }
    
    // Initialize budget distribution
    const distribution = getBudgetDistribution(eventId, totalBudget);
    setBudgetItems(distribution.map(item => ({
      ...item,
      allocatedBudget: item.budget,
    })));
  }, [eventId, totalBudget, navigate]);
  
  const handleBudgetChange = (value: number[]) => {
    const newBudget = value[0];
    setTotalBudget(newBudget);
    
    // Update budget distribution
    const distribution = getBudgetDistribution(eventId || '', newBudget);
    setBudgetItems(distribution.map(item => ({
      ...item,
      allocatedBudget: item.budget,
    })));
  };
  
  const handleManualBudgetChange = (category: string, value: number) => {
    setBudgetItems(prev => prev.map(item => 
      item.category === category ? { ...item, allocatedBudget: value } : item
    ));
  };
  
  const handleSelectArtist = (artist: any, category: string) => {
    const existing = selectedArtists.find(a => a.providerId === artist.id);
    if (existing) {
      toast.error('Artist already selected');
      return;
    }
    
    setSelectedArtists([...selectedArtists, {
      providerId: artist.id,
      category,
      artistName: artist.full_name,
      price: artist.price_min,
      status: 'pending',
    }]);
    
    toast.success(`${artist.full_name} added to your team`);
  };
  
  const handleRemoveArtist = (providerId: string) => {
    setSelectedArtists(prev => prev.filter(a => a.providerId !== providerId));
    toast.info('Artist removed from team');
  };
  
  const handleReplaceArtist = (providerId: string, category: string) => {
    // Remove current artist
    handleRemoveArtist(providerId);
    // Show similar artists modal or navigate to replacements
    navigate(`/artists?category=${category}&replace=${providerId}`);
  };
  
  const handleConfirmBooking = async () => {
    if (selectedArtists.length === 0) {
      toast.error('Please select at least one artist');
      return;
    }
    
    if (!eventDate) {
      toast.error('Please select event date');
      return;
    }
    
    if (!location) {
      toast.error('Please enter location');
      return;
    }
    
    try {
      // Create event booking
      // @ts-ignore
      const { data: newEventId, error: eventError } = await supabase
        .rpc('create_event_booking', {
          p_customer_id: user?.id,
          p_event_name: event?.name || 'Event',
          p_event_type: eventId,
          p_event_date: eventDate,
          p_location: location,
          p_guest_count: guestCount,
          p_total_budget: totalBudget,
        });

      if (eventError) throw eventError;

      // Add artists to event
      for (const artist of selectedArtists) {
        // @ts-ignore
        await supabase.rpc('add_artist_to_event', {
          p_event_id: newEventId,
          p_provider_id: artist.providerId,
          p_provider_name: artist.artistName,
          p_category: artist.category,
          p_price: artist.price,
        });
      }

      // Add budget allocations
      for (const item of budgetItems) {
        // @ts-ignore
        await supabase.from('budget_allocations').insert({
          event_id: newEventId,
          category: item.category,
          priority: item.priority,
          budget_percentage: item.budgetPercentage,
          allocated_budget: item.allocatedBudget,
        });
      }

      toast.success('Event created successfully!');
      navigate('/event-dashboard');
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error('Failed to create event. Please try again.');
    }
  };
  
  const totalAllocated = budgetItems.reduce((sum, item) => sum + item.allocatedBudget, 0);
  const remainingBudget = totalBudget - totalAllocated;
  
  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Event not found</p>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className={`bg-gradient-to-r ${event.gradient} text-white py-8 px-4`}>
        <div className="container mx-auto">
          <Button
            variant="ghost"
            className="text-white hover:bg-white/20 mb-4"
            onClick={() => navigate('/browse')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Browse
          </Button>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{event.name} Planning</h1>
          <p className="text-white/80">{event.description}</p>
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Sidebar - Budget & Selection */}
          <div className="space-y-6">
            {/* Budget Builder */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IndianRupee className="w-5 h-5" />
                  Smart Budget Builder
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Total Budget</label>
                  <div className="flex items-center gap-2">
                    <IndianRupee className="w-4 h-4" />
                    <span className="text-2xl font-bold">{(totalBudget / 1000).toFixed(0)}K</span>
                  </div>
                  <Slider
                    value={[totalBudget]}
                    onValueChange={handleBudgetChange}
                    min={50000}
                    max={5000000}
                    step={50000}
                    className="mt-2"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Guest Count</label>
                  <Input
                    type="number"
                    value={guestCount}
                    onChange={(e) => setGuestCount(parseInt(e.target.value) || 0)}
                    placeholder="Number of guests"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Event Date</label>
                  <Input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Location</label>
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="City or venue"
                  />
                </div>
                
                <div className="pt-4 border-t">
                  <div className="flex justify-between text-sm mb-2">
                    <span>Total Allocated</span>
                    <span className="font-semibold">₹{(totalAllocated / 1000).toFixed(0)}K</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Remaining</span>
                    <span className={`font-semibold ${remainingBudget >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ₹{(remainingBudget / 1000).toFixed(0)}K
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Budget Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Budget Distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {budgetItems.map((item) => (
                  <div key={item.category} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={item.priority === 'essential' ? 'default' : item.priority === 'recommended' ? 'secondary' : 'outline'}>
                          {item.priority}
                        </Badge>
                        <span className="text-sm font-medium capitalize">{item.category.replace('_', ' ')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <IndianRupee className="w-3 h-3" />
                        <Input
                          type="number"
                          value={item.allocatedBudget}
                          onChange={(e) => handleManualBudgetChange(item.category, parseInt(e.target.value) || 0)}
                          className="w-24 h-8 text-right"
                        />
                      </div>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-gold h-2 rounded-full transition-all"
                        style={{ width: `${(item.allocatedBudget / totalBudget) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            
            {/* Selected Artists */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Your Team</span>
                  <Badge variant="secondary">{selectedArtists.length} selected</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedArtists.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No artists selected yet
                  </p>
                ) : (
                  selectedArtists.map((artist) => (
                    <div key={artist.providerId} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{artist.artistName}</p>
                        <p className="text-xs text-muted-foreground capitalize">{artist.category.replace('_', ' ')}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={artist.status === 'accepted' ? 'default' : artist.status === 'rejected' ? 'destructive' : 'secondary'}>
                            {artist.status}
                          </Badge>
                          <span className="text-xs">₹{artist.price}</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReplaceArtist(artist.providerId, artist.category)}
                        >
                          <RefreshCw className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveArtist(artist.providerId)}
                        >
                          <XCircle className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
                
                {selectedArtists.length > 0 && (
                  <Button
                    className="w-full"
                    onClick={handleConfirmBooking}
                  >
                    Confirm Booking
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Main Content - Artist Recommendations */}
          <div className="lg:col-span-2 space-y-6">
            {/* Section Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {[
                { id: 'recommended', label: 'Recommended', icon: Sparkles },
                { id: 'available', label: 'Available', icon: Calendar },
                { id: 'nearby', label: 'Nearby', icon: MapPin },
                { id: 'featured', label: 'Featured', icon: Star },
                { id: 'popular', label: 'Popular', icon: TrendingUp },
              ].map((tab) => (
                <Button
                  key={tab.id}
                  variant={activeSection === tab.id ? 'default' : 'outline'}
                  onClick={() => setActiveSection(tab.id as any)}
                  className="flex items-center gap-2"
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </Button>
              ))}
            </div>
            
            {/* AI Team Builder */}
            <Card className="border-gold/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-gold" />
                  AI Team Builder
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Based on your {event.name}, we recommend these essential categories:
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {requiredCategories.map((cat) => (
                    <div
                      key={cat.category}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedArtists.some(a => a.category === cat.category)
                          ? 'border-gold bg-gold/10'
                          : 'border-border hover:border-gold/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant={cat.priority === 'essential' ? 'default' : 'secondary'}>
                          {cat.priority}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{cat.budgetPercentage}%</span>
                      </div>
                      <p className="text-sm font-medium capitalize">{cat.category.replace('_', ' ')}</p>
                      {selectedArtists.some(a => a.category === cat.category) && (
                        <CheckCircle className="w-4 h-4 text-green-600 mt-2" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {/* Artist Grid */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {activeSection === 'recommended' && 'Recommended Artists'}
                  {activeSection === 'available' && 'Available Artists'}
                  {activeSection === 'nearby' && 'Nearby Artists'}
                  {activeSection === 'featured' && 'Featured Artists'}
                  {activeSection === 'popular' && 'Popular Artists'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingRecommended ? (
                  <div className="text-center py-8">Loading artists...</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(recommendedArtists || []).slice(0, 8).map((artist) => (
                      <div key={artist.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="w-16 h-16 rounded-lg bg-secondary overflow-hidden">
                            {artist.avatar_url ? (
                              <img src={artist.avatar_url} alt={artist.full_name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                <Users className="w-8 h-8" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold">{artist.full_name}</h3>
                            <p className="text-sm text-muted-foreground capitalize">{artist.profession.replace('_', ' ')}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Star className="w-3 h-3 text-gold fill-gold" />
                              <span className="text-sm">{artist.average_rating.toFixed(1)}</span>
                              <span className="text-xs text-muted-foreground">({artist.total_reviews})</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <MapPin className="w-3 h-3" />
                            {artist.city}
                          </div>
                          <div className="flex items-center gap-1 font-semibold">
                            <IndianRupee className="w-3 h-3" />
                            {artist.price_min} - {artist.price_max}
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => handleSelectArtist(artist, artist.profession)}
                            disabled={selectedArtists.some(a => a.providerId === artist.id)}
                          >
                            {selectedArtists.some(a => a.providerId === artist.id) ? (
                              <CheckCircle className="w-4 h-4 mr-1" />
                            ) : (
                              <Plus className="w-4 h-4 mr-1" />
                            )}
                            {selectedArtists.some(a => a.providerId === artist.id) ? 'Selected' : 'Add to Team'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/provider/${artist.id}`)}
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventPlanning;
