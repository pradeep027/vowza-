import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Filter, MapPin, Star, Clock, IndianRupee, SlidersHorizontal, X, Calendar, Award, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { useArtists, useCategories, ArtistFilters } from '@/hooks/useArtists';

const Artists = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const categoryParam = searchParams.get('category');

  // Enhanced filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedBudget, setSelectedBudget] = useState('');
  const [selectedRating, setSelectedRating] = useState('');
  const [selectedExperience, setSelectedExperience] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [sortBy, setSortBy] = useState<'rating' | 'price-low' | 'price-high' | 'newest' | 'experience'>('rating');
  const [showFilters, setShowFilters] = useState(false);
  const [filterVerified, setFilterVerified] = useState(false);
  const [filterFeatured, setFilterFeatured] = useState(false);
  const [filterAvailable, setFilterAvailable] = useState(false);

  // Build filters object for React Query
  const filters: ArtistFilters = {
    category: categoryParam || undefined,
    search: searchQuery || undefined,
    city: selectedCity || undefined,
    budgetMin: selectedBudget ? parseInt(selectedBudget.split('-')[0]) : undefined,
    budgetMax: selectedBudget ? parseInt(selectedBudget.split('-')[1]) : undefined,
    rating: selectedRating ? parseFloat(selectedRating) : undefined,
    experience: selectedExperience ? parseInt(selectedExperience) : undefined,
    language: selectedLanguage || undefined,
    sortBy,
    verified: filterVerified || undefined,
    featured: filterFeatured || undefined,
    available: filterAvailable || undefined,
  };

  // Use React Query for data fetching
  const { data: artists = [], isLoading, error } = useArtists(filters);
  const { data: categories = [] } = useCategories();

  const getCategoryName = (categoryId: string) => {
    const category = categories.find((c: any) => c.profession_type === categoryId);
    return category?.name || categoryId;
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCity('');
    setSelectedBudget('');
    setSelectedRating('');
    setSelectedExperience('');
    setSelectedLanguage('');
    setSortBy('rating');
    setFilterVerified(false);
    setFilterFeatured(false);
    setFilterAvailable(false);
  };

  const handleArtistClick = (artistId: string) => {
    navigate(`/artist/${artistId}`);
  };

  if (error) {
    toast.error('Failed to load artists');
  }

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
              <SelectItem value="experience">Most Experience</SelectItem>
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

              {/* Experience */}
              <div>
                <label className="text-sm font-medium mb-2 block">Experience</label>
                <Select value={selectedExperience} onValueChange={setSelectedExperience}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select experience" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1+ Years</SelectItem>
                    <SelectItem value="3">3+ Years</SelectItem>
                    <SelectItem value="5">5+ Years</SelectItem>
                    <SelectItem value="10">10+ Years</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Language */}
              <div>
                <label className="text-sm font-medium mb-2 block">Language</label>
                <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Hindi">Hindi</SelectItem>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="Telugu">Telugu</SelectItem>
                    <SelectItem value="Tamil">Tamil</SelectItem>
                    <SelectItem value="Kannada">Kannada</SelectItem>
                    <SelectItem value="Marathi">Marathi</SelectItem>
                    <SelectItem value="Bengali">Bengali</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Quick Filters */}
              <div className="space-y-3">
                <label className="text-sm font-medium block">Quick Filters</label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="verified"
                      checked={filterVerified}
                      onCheckedChange={(checked) => setFilterVerified(checked as boolean)}
                    />
                    <label htmlFor="verified" className="text-sm cursor-pointer flex items-center gap-1">
                      <Award className="w-4 h-4" />
                      Verified Only
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="featured"
                      checked={filterFeatured}
                      onCheckedChange={(checked) => setFilterFeatured(checked as boolean)}
                    />
                    <label htmlFor="featured" className="text-sm cursor-pointer flex items-center gap-1">
                      <Star className="w-4 h-4" />
                      Featured Only
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="available"
                      checked={filterAvailable}
                      onCheckedChange={(checked) => setFilterAvailable(checked as boolean)}
                    />
                    <label htmlFor="available" className="text-sm cursor-pointer flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Available Now
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Artists Grid */}
      <div className="container px-4 py-8">
        {isLoading ? (
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
                      src={artist.cover_image_url || artist.avatar_url || '/placeholder.svg'}
                      alt={artist.full_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
                    
                    {/* Badges */}
                    <div className="absolute top-3 left-3 flex gap-2">
                      {artist.is_verified && (
                        <Badge className="bg-gold text-foreground border-0 shadow-gold">
                          ✓ Verified
                        </Badge>
                      )}
                      {artist.is_featured && (
                        <Badge className="bg-purple-500 text-primary-foreground border-0">
                          ⭐ Featured
                        </Badge>
                      )}
                      {artist.is_available ? (
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
                      <span className="text-sm font-semibold text-foreground">{artist.average_rating.toFixed(1)}</span>
                      <span className="text-xs text-muted-foreground">({artist.total_reviews})</span>
                    </div>
                  </div>

                  <CardContent className="p-5">
                    <h3 className="text-lg font-display font-semibold text-foreground mb-1 group-hover:text-maroon transition-colors">
                      {artist.full_name}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">{artist.category_name || artist.profession}</p>

                    <div className="flex items-center gap-4 mb-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        <span>{artist.city}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{artist.experience_years} yrs</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <div>
                        <p className="text-xs text-muted-foreground">Starting from</p>
                        <p className="text-sm font-semibold text-foreground">
                          <IndianRupee className="w-3 h-3 inline" />
                          {artist.price_min.toLocaleString()}
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
