import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, MapPin, Star, Clock, IndianRupee, SlidersHorizontal, X } from 'lucide-react';
import { toast } from 'sonner';

interface Artist {
  id: string;
  full_name: string;
  category: string;
  subcategory: string;
  city: string;
  state: string;
  experience: string;
  starting_price: number;
  bio: string;
  profile_image: string;
  rating: number;
  total_reviews: number;
  verified: boolean;
  available: boolean;
  approval_status: string;
}

const Artists = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const categoryParam = searchParams.get('category');

  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedBudget, setSelectedBudget] = useState('');
  const [selectedRating, setSelectedRating] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchArtists();

    // Set up real-time subscription
    const channel = supabase
      .channel('artists-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'provider_profiles'
        },
        () => {
          fetchArtists();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [categoryParam, searchQuery, selectedCity, selectedBudget, selectedRating, sortBy]);

  const fetchArtists = async () => {
    setLoading(true);
    try {
      // Accept both 'approved' and 'verified' — different migrations used different values
      let query = supabase
        .from('provider_profiles')
        .select('*')
        .in('verification_status', ['approved', 'verified']);

      if (categoryParam) {
        query = query.eq('profession', getCategoryName(categoryParam) as any);
      }

      if (selectedBudget) {
        const [min, max] = selectedBudget.split('-').map(Number);
        if (min !== undefined) query = query.gte('price_min', min);
        if (max !== undefined) query = query.lte('price_max', max);
      }

      const { data: providerData, error: providerError } = await query;
      if (providerError) throw providerError;

      if (!providerData || providerData.length === 0) {
        setArtists([]);
        setLoading(false);
        return;
      }

      // Step 2: Fetch matching profiles using user_ids from provider_profiles
      const userIds = providerData.map((p: any) => p.user_id).filter(Boolean);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, city, state, avatar_url, area')
        .in('id', userIds);

      // Build a lookup map: user_id → profile
      const profileMap = new Map<string, any>();
      (profilesData ?? []).forEach(p => profileMap.set(p.id, p));

      // Step 3: Merge and map to Artist interface
      let artistsData: Artist[] = providerData.map((artist: any) => {
        const profile = profileMap.get(artist.user_id) ?? {};
        const artistCity = artist.service_city || profile.city || '';
        const artistState = profile.state || '';
        const fullName = profile.full_name || 'Unknown Artist';

        return {
          id:              artist.id,
          full_name:       fullName,
          category:        artist.profession || 'Artist',
          subcategory:     Array.isArray(artist.specialties)
                             ? artist.specialties.join(', ')
                             : (artist.specialties || ''),
          city:            artistCity,
          state:           artistState,
          experience:      artist.experience_years ? `${artist.experience_years} yrs` : '',
          starting_price:  artist.price_min || 0,
          bio:             artist.bio || '',
          profile_image:   artist.cover_image_url || profile.avatar_url || '/placeholder.svg',
          rating:          typeof artist.average_rating === 'number' ? artist.average_rating : 4.5,
          total_reviews:   artist.total_reviews || 0,
          verified:        artist.is_verified === true,
          available:       artist.is_available !== false,
          approval_status: artist.verification_status || 'pending',
        };
      });

      // Step 4: Client-side filters that couldn't be done in SQL
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        artistsData = artistsData.filter(a =>
          a.full_name.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q) ||
          a.city.toLowerCase().includes(q) ||
          a.bio.toLowerCase().includes(q)
        );
      }

      if (selectedCity) {
        artistsData = artistsData.filter(a =>
          a.city.toLowerCase() === selectedCity.toLowerCase()
        );
      }

      if (selectedRating) {
        const minRating = parseFloat(selectedRating);
        artistsData = artistsData.filter(a => a.rating >= minRating);
      }

      // Step 5: Sort
      artistsData = sortArtists(artistsData);

      setArtists(artistsData);
    } catch (error: any) {
      toast.error('Failed to load artists. Please try again.');
      console.error('[Artists] fetchArtists error:', error?.message ?? error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryName = (categoryId: string) => {
    const categoryMap: Record<string, string> = {
      'bands': 'Music Band',
      'traditional-bands': 'Traditional Band',
      'dj': 'DJ',
      'photographers': 'Photographer',
      'dancers': 'Dancer',
      'decorators': 'Event Decorator'
    };
    return categoryMap[categoryId] || categoryId;
  };

  const sortArtists = (data: Artist[]) => {
    const sorted = [...data];
    switch (sortBy) {
      case 'price-low':
        return sorted.sort((a, b) => a.starting_price - b.starting_price);
      case 'price-high':
        return sorted.sort((a, b) => b.starting_price - a.starting_price);
      case 'rating':
        return sorted.sort((a, b) => b.rating - a.rating);
      case 'newest':
        return sorted.reverse();
      default:
        return sorted;
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCity('');
    setSelectedBudget('');
    setSelectedRating('');
    setSortBy('rating');
  };

  const handleArtistClick = (artistId: string) => {
    navigate(`/artist/${artistId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Header */}
      <div className="pt-24 pb-8 bg-gradient-to-b from-maroon/10 to-background">
        <div className="container px-4">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
            {categoryParam ? getCategoryName(categoryParam) : 'All Artists'}
          </h1>
          <p className="text-muted-foreground text-lg">
            Discover and book verified professionals for your events
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="container px-4 py-6 sticky top-20 z-40 bg-background/95 backdrop-blur-md border-b">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          {/* Search */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by artist name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters Toggle */}
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="w-full md:w-auto"
          >
            <SlidersHorizontal className="w-4 h-4 mr-2" />
            Filters
          </Button>

          {/* Sort */}
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rating">Highest Rated</SelectItem>
              <SelectItem value="price-low">Lowest Price</SelectItem>
              <SelectItem value="price-high">Highest Price</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mt-4 p-4 bg-card rounded-lg border space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Filters</h3>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" />
                Clear All
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* City */}
              <div>
                <label className="text-sm font-medium mb-2 block">City</label>
                <Select value={selectedCity} onValueChange={setSelectedCity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select city" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Hyderabad">Hyderabad</SelectItem>
                    <SelectItem value="Bangalore">Bangalore</SelectItem>
                    <SelectItem value="Chennai">Chennai</SelectItem>
                    <SelectItem value="Mumbai">Mumbai</SelectItem>
                    <SelectItem value="Delhi">Delhi</SelectItem>
                    <SelectItem value="Pune">Pune</SelectItem>
                    <SelectItem value="Vizag">Vizag</SelectItem>
                    <SelectItem value="Vijayawada">Vijayawada</SelectItem>
                    <SelectItem value="Warangal">Warangal</SelectItem>
                    <SelectItem value="Nagpur">Nagpur</SelectItem>
                    <SelectItem value="Nashik">Nashik</SelectItem>
                    <SelectItem value="Kolkata">Kolkata</SelectItem>
                    <SelectItem value="Ahmedabad">Ahmedabad</SelectItem>
                    <SelectItem value="Jaipur">Jaipur</SelectItem>
                    <SelectItem value="Lucknow">Lucknow</SelectItem>
                    <SelectItem value="Kochi">Kochi</SelectItem>
                    <SelectItem value="Indore">Indore</SelectItem>
                    <SelectItem value="Bhopal">Bhopal</SelectItem>
                    <SelectItem value="Coimbatore">Coimbatore</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Budget */}
              <div>
                <label className="text-sm font-medium mb-2 block">Budget</label>
                <Select value={selectedBudget} onValueChange={setSelectedBudget}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select budget" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0-15000">Under ₹15,000</SelectItem>
                    <SelectItem value="15000-30000">₹15,000 - ₹30,000</SelectItem>
                    <SelectItem value="30000-50000">₹30,000 - ₹50,000</SelectItem>
                    <SelectItem value="50000-100000">₹50,000 - ₹1,00,000</SelectItem>
                    <SelectItem value="100000-999999">Above ₹1,00,000</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Rating */}
              <div>
                <label className="text-sm font-medium mb-2 block">Rating</label>
                <Select value={selectedRating} onValueChange={setSelectedRating}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4.5">4.5+ Stars</SelectItem>
                    <SelectItem value="4">4+ Stars</SelectItem>
                    <SelectItem value="3.5">3.5+ Stars</SelectItem>
                    <SelectItem value="3">3+ Stars</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Artists Grid */}
      <div className="container px-4 py-8">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-48 bg-muted" />
                <CardContent className="p-5 space-y-3">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                  <div className="h-3 bg-muted rounded w-1/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : artists.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎭</div>
            <h3 className="text-2xl font-semibold mb-2">No Artists Found</h3>
            <p className="text-muted-foreground mb-6">
              Try adjusting your filters or search terms
            </p>
            <Button onClick={clearFilters}>Clear Filters</Button>
          </div>
        ) : (
          <>
            <p className="text-muted-foreground mb-6">
              Showing {artists.length} artist{artists.length !== 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {artists.map((artist) => (
                <Card
                  key={artist.id}
                  onClick={() => handleArtistClick(artist.id)}
                  className="group cursor-pointer hover:shadow-elevated transition-all duration-300 overflow-hidden"
                >
                  <div className="relative h-56 bg-muted overflow-hidden">
                    <img
                      src={artist.profile_image}
                      alt={artist.full_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
                    
                    {/* Badges */}
                    <div className="absolute top-3 left-3 flex gap-2">
                      {artist.verified && (
                        <Badge className="bg-gold text-foreground border-0 shadow-gold">
                          ✓ Verified
                        </Badge>
                      )}
                      {artist.available ? (
                        <Badge className="bg-emerald-500 text-primary-foreground border-0">
                          Available
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground">
                          Busy
                        </Badge>
                      )}
                    </div>

                    {/* Rating */}
                    <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-card/90 backdrop-blur-sm px-2 py-1 rounded-lg">
                      <Star className="w-4 h-4 text-gold fill-gold" />
                      <span className="text-sm font-semibold text-foreground">{artist.rating}</span>
                      <span className="text-xs text-muted-foreground">({artist.total_reviews})</span>
                    </div>
                  </div>

                  <CardContent className="p-5">
                    <h3 className="text-lg font-display font-semibold text-foreground mb-1 group-hover:text-maroon transition-colors">
                      {artist.full_name}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">{artist.category}</p>

                    <div className="flex items-center gap-4 mb-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        <span>{artist.city}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{artist.experience}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <div>
                        <p className="text-xs text-muted-foreground">Starting from</p>
                        <p className="text-sm font-semibold text-foreground">
                          <IndianRupee className="w-3 h-3 inline" />
                          {artist.starting_price.toLocaleString()}
                        </p>
                      </div>
                      <Button size="sm" className="bg-gradient-maroon text-primary-foreground">
                        View Profile
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default Artists;
