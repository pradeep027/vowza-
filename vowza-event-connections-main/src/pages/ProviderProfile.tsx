import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { NotificationService } from '@/services/notificationService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  MapPin, 
  Star, 
  Clock, 
  CheckCircle,
  User,
  Calendar,
  Sparkles,
  Share2,
  MessageCircle,
  Phone,
  Mail,
  Globe,
  Instagram,
  Facebook,
  Youtube,
  IndianRupee,
  Award,
  Languages,
  Image as ImageIcon,
  Video,
  CalendarDays,
  Heart,
  Flag,
  Download,
  Shield,
  TrendingUp
} from 'lucide-react';
import BookingModal from '@/components/BookingModal';
import type { Database } from '@/integrations/supabase/types';
import { useAvailability, useArtists } from '@/hooks/useArtists';

type ProfessionType = Database['public']['Enums']['profession_type'];

const professionLabels: Record<string, string> = {
  // Original values
  normal_band: 'Music Band',
  maharashtra_band: 'Maharashtra Band',
  musician: 'Musician',
  dj: 'DJ',
  photographer: 'Photographer',
  videographer: 'Videographer',
  decorator: 'Event Decorator',
  kuchipudi_dancer: 'Kuchipudi Dancer',
  classical_dancer: 'Classical Dancer',
  western_dancer: 'Western Dancer',
  event_support: 'Event Support',
  // New V2 values
  music_band: 'Music Band',
  traditional_band: 'Traditional Band',
  singer: 'Singer',
  instrumental_artist: 'Instrumental Artist',
  classical_musician: 'Classical Musician',
  cinematographer: 'Cinematographer',
  drone_operator: 'Drone Operator',
  dancer: 'Dancer',
  choreographer: 'Choreographer',
  wedding_decorator: 'Wedding Decorator',
  stage_decorator: 'Stage Decorator',
  event_decorator: 'Event Decorator',
  makeup_artist: 'Makeup Artist',
  mehendi_artist: 'Mehendi Artist',
  anchor: 'Anchor / Emcee',
  host: 'Host / Presenter',
  magician: 'Magician',
  stand_up_comedian: 'Stand-up Comedian',
  celebrity_artist: 'Celebrity Artist',
  live_performer: 'Live Performer',
  folk_artist: 'Folk Artist',
  lighting_services: 'Lighting Services',
  sound_services: 'Sound Engineer',
  event_planner: 'Event Planner',
  wedding_planner: 'Wedding Planner',
  catering_services: 'Catering Services',
  event_support_staff: 'Event Support',
};

interface ProviderData {
  id: string;
  user_id: string;
  profession: ProfessionType;
  experience_years: number | null;
  min_price: number | null;
  max_price: number | null;
  bio: string | null;
  verification_status: string | null;
  specialties: string | null;
  languages: string | null;
  available_dates: string | null;
  gst_number: string | null;
  instagram: string | null;
  facebook: string | null;
  youtube: string | null;
  website: string | null;
  is_verified?: boolean;
  is_available?: boolean;
  average_rating?: number;
  total_reviews?: number;
  total_bookings?: number;
  price_min?: number;
  price_max?: number;
  [key: string]: any;
}

interface ProfileData {
  full_name: string;
  avatar_url: string | null;
  city: string | null;
  area: string | null;
  state?: string | null;
  address?: string | null;
  phone: string | null;
  email: string | null;
}

interface PortfolioItem {
  id: string;
  media_url: string;
  media_type: string;
  description: string | null;
  title?: string;
  [key: string]: any;
}

interface Review {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  customer_name: string;
}

const ProviderProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart, isInCart } = useCart();
  
  const [provider, setProvider] = useState<ProviderData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [pricingPackages, setPricingPackages] = useState<any[]>([]);
  const [timeSlots, setTimeSlots] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');

  useEffect(() => {
    if (id) {
      fetchProviderData();
      checkFavoriteStatus();
    }
  }, [id, user]);

  const checkFavoriteStatus = async () => {
    if (!user || !id) return;
    
    try {
      const { data } = await supabase
        .from('favorites' as any)
        .select('*')
        .eq('user_id', user.id)
        .eq('provider_id', id)
        .single();
      
      setIsFavorite(!!data);
    } catch (error) {
      setIsFavorite(false);
    }
  };

  const toggleFavorite = async () => {
    if (!user) {
      toast.error('Please login to save favorites');
      return;
    }

    if (!id) return;

    try {
      if (isFavorite) {
        await supabase
          .from('favorites' as any)
          .delete()
          .eq('user_id', user.id)
          .eq('provider_id', id);
        toast.success('Removed from favorites');
        setIsFavorite(false);
      } else {
        await supabase
          .from('favorites' as any)
          .insert({
            user_id: user.id,
            provider_id: id
          });
        toast.success('Added to favorites');
        setIsFavorite(true);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update favorites');
    }
  };

  const fetchProviderData = async () => {
    try {
      // Fetch provider profile
      const { data: providerData, error: providerError } = await supabase
        .from('provider_profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (providerError) throw providerError;
      setProvider(providerData as any);

      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, city, area, phone, state, address, email')
        .eq('id', providerData.user_id)
        .single();

      if (!profileError && profileData) {
        setProfile(profileData as any);
      }

      // Fetch portfolio
      const { data: portfolioData, error: portfolioError } = await supabase
        .from('portfolio_items')
        .select('*')
        .eq('provider_id', id);

      if (!portfolioError && portfolioData) {
        setPortfolio(portfolioData);
      }

      // Fetch reviews
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('reviews')
        .select('id, rating, review_text, created_at, customer_id')
        .eq('provider_id', id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!reviewsError && reviewsData) {
        // Fetch customer names
        const customerIds = reviewsData.map(r => r.customer_id);
        const { data: customersData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', customerIds);

        const reviewsWithNames = reviewsData.map(review => ({
          ...review,
          customer_name: customersData?.find(c => c.id === review.customer_id)?.full_name || 'Anonymous'
        }));
        setReviews(reviewsWithNames);
      }

      // Fetch pricing packages
      const { data: pricingData } = await supabase
        .from('pricing_packages' as any)
        .select('*')
        .eq('provider_id', id)
        .order('sort_order');

      if (pricingData) {
        setPricingPackages(pricingData);
      }

      // Fetch time slots
      const { data: timeSlotsData } = await supabase
        .from('provider_time_slots' as any)
        .select('*')
        .eq('provider_id', id)
        .order('day_of_week');

      if (timeSlotsData) {
        setTimeSlots(timeSlotsData);
      }

      setIsLoading(false);
    } catch (error: any) {
      toast.error('Failed to load provider profile');
      navigate('/browse');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!user) { toast.error('Please login to leave a review'); return; }
    if (!provider) return;
    setSubmittingReview(true);
    try {
      // Find a completed booking between this user and this provider
      const { data: completedBooking } = await supabase
        .from('bookings')
        .select('id')
        .eq('customer_id', user.id)
        .eq('provider_id', provider.id)
        .eq('status', 'completed')
        .limit(1)
        .maybeSingle();

      if (!completedBooking) {
        toast.error('You can only review artists you have booked and completed an event with.');
        return;
      }

      const { error } = await supabase
        .from('reviews')
        .insert({
          booking_id:  completedBooking.id,
          customer_id: user.id,
          provider_id: provider.id,
          rating:      reviewRating,
          review_text: reviewText.trim() || null,
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('You have already reviewed this booking.');
        } else {
          toast.error('Failed to submit review. Please try again.');
        }
        return;
      }

      // Notify the artist
      const { data: customerProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();

      await NotificationService.notifyNewReview(
        provider.user_id,
        customerProfile?.full_name ?? 'A customer',
        reviewRating,
        completedBooking.id
      );

      toast.success('Review submitted successfully! Thank you.');
      setReviewText('');
      setReviewRating(5);
      fetchProviderData(); // refresh reviews
    } catch (err: any) {
      toast.error('Failed to submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleBookNow = () => {
    if (!user) {
      toast.error('Please login to book');
      navigate('/auth');
      return;
    }
    setShowBookingModal(true);
  };

  const handleAddToCart = (pkg?: any) => {
    if (!user) {
      toast.error('Please login to add to cart');
      navigate('/auth');
      return;
    }

    if (!provider || !profile) return;

    const price = pkg?.price || provider.price_min || provider.price_max || 0;
    
    addToCart({
      providerId: provider.id,
      providerName: profile.full_name,
      profession: professionLabels[provider.profession] || provider.profession,
      price: price,
      date: new Date().toLocaleDateString(),
      time: 'Flexible',
      duration: pkg?.duration || '1',
      package: pkg?.name || 'Standard'
    });

    toast.success('Added to cart');
  };

  const handleReportProfile = async () => {
    if (!user) {
      toast.error('Please login to report a profile');
      navigate('/auth');
      return;
    }

    if (!reportReason.trim()) {
      toast.error('Please provide a reason for reporting');
      return;
    }

    try {
      // Use direct SQL call via RPC or insert into a reports table
      const { error } = await supabase
        .from('notifications' as any)
        .insert({
          user_id: user.id,
          title: 'Profile Reported',
          message: `Profile ${id} reported for: ${reportReason}`,
          type: 'report',
          reference_id: id
        });

      if (error) throw error;

      toast.success('Profile reported successfully');
      setShowReportModal(false);
      setReportReason('');
    } catch (error) {
      toast.error('Failed to report profile');
    }
  };

  const { data: isAvailable } = useAvailability(id || '', selectedDate || new Date());

  // Similar artists — same category, different provider
  const { data: similarArtists = [] } = useArtists(
    { category: provider?.profession, sortBy: 'rating' },
    !!provider?.profession
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cream via-background to-blush/20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
      </div>
    );
  }

  if (!provider || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cream via-background to-blush/20">
        <p className="text-muted-foreground">Provider not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream via-background to-blush/20">
      {/* Header */}
      <header className="bg-card/95 backdrop-blur-sm border-b border-gold/20 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-gold flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-foreground" />
              </div>
              <span className="text-lg font-bold text-foreground">Vowza</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Header */}
            <Card className="border-gold/20 overflow-hidden">
              <div className="h-32 bg-gradient-to-r from-gold/30 via-maroon/20 to-royal/30"></div>
              <CardContent className="relative pt-0">
                <div className="flex flex-col md:flex-row md:items-end gap-4 -mt-16">
                  <div className="w-32 h-32 rounded-full border-4 border-card bg-gradient-gold flex items-center justify-center overflow-hidden">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-16 h-16 text-foreground" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <h1 className="text-2xl font-bold">{profile.full_name}</h1>
                      {provider.is_verified && (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      )}
                    </div>
                    <p className="text-muted-foreground">{professionLabels[provider.profession]}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      {profile.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {profile.city}{profile.area && `, ${profile.area}`}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-gold text-gold" />
                        {provider.average_rating?.toFixed(1) || '0.0'} ({provider.total_reviews || 0} reviews)
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={toggleFavorite}
                      className={isFavorite ? 'text-red-500 border-red-500' : ''}
                    >
                      <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        toast.success('Profile link copied');
                      }}
                    >
                      <Share2 className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* About */}
            <Card className="border-gold/20">
              <CardHeader>
                <CardTitle>About</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {provider.bio || 'No description provided.'}
                </p>
                
                {provider.specialties && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Specialties</h4>
                    <div className="flex flex-wrap gap-2">
                      {(typeof provider.specialties === 'string' 
                        ? provider.specialties.split(',') 
                        : Array.isArray(provider.specialties) 
                          ? provider.specialties 
                          : []
                      ).map((specialty: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="bg-gold/10 text-gold border-gold/20">
                          {specialty.trim()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pricing Packages */}
            {pricingPackages.length > 0 ? (
              <Card className="border-gold/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IndianRupee className="w-5 h-5 text-gold" />
                    Pricing Packages
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {pricingPackages.map((pkg) => (
                      <div key={pkg.id} className="p-4 rounded-lg bg-gradient-to-br from-gold/10 to-maroon/10 border border-gold/20">
                        <h4 className="font-semibold text-lg mb-2">{pkg.name}</h4>
                        <p className="text-2xl font-bold text-gold mb-2">₹{pkg.price.toLocaleString()}</p>
                        {pkg.duration && (
                          <p className="text-sm text-muted-foreground mb-2">Duration: {pkg.duration}</p>
                        )}
                        {pkg.description && (
                          <p className="text-sm text-muted-foreground mb-3">{pkg.description}</p>
                        )}
                        <Button
                          onClick={() => handleAddToCart(pkg)}
                          disabled={isInCart(provider.id)}
                          className="w-full bg-gradient-gold hover:opacity-90"
                          size="sm"
                        >
                          {isInCart(provider.id) ? 'In Cart' : 'Add to Cart'}
                        </Button>
                      </div>
                    ))}
                  </div>
                  {provider.travel_charges > 0 && (
                    <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border">
                      <p className="text-sm">
                        <span className="font-medium">Travel Charges:</span> ₹{provider.travel_charges.toLocaleString()}
                      </p>
                    </div>
                  )}
                  {provider.extra_charges > 0 && (
                    <div className="mt-2 p-3 rounded-lg bg-muted/30 border border-border">
                      <p className="text-sm">
                        <span className="font-medium">Extra Charges:</span> ₹{provider.extra_charges.toLocaleString()}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (provider.price_min || provider.price_max) && (
              <Card className="border-gold/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IndianRupee className="w-5 h-5 text-gold" />
                    Pricing
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-gold">
                        ₹{provider.price_min?.toLocaleString() || '0'} - ₹{provider.price_max?.toLocaleString() || '0'}
                      </p>
                      <p className="text-sm text-muted-foreground">Starting price</p>
                    </div>
                    <Button
                      onClick={() => handleAddToCart()}
                      disabled={isInCart(provider.id)}
                      className="bg-gradient-gold hover:opacity-90"
                    >
                      {isInCart(provider.id) ? 'In Cart' : 'Add to Cart'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Portfolio */}
            {portfolio.length > 0 && (
              <Card className="border-gold/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-gold" />
                    Portfolio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {portfolio.map((item) => (
                      <div key={item.id} className="relative group overflow-hidden rounded-lg">
                        {item.media_type === 'video' ? (
                          <div className="aspect-video bg-muted flex items-center justify-center">
                            <Video className="w-12 h-12 text-muted-foreground" />
                          </div>
                        ) : (
                          <img
                            src={item.media_url}
                            alt={item.title || 'Portfolio item'}
                            className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        )}
                        {item.description && (
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                            <p className="text-white text-xs truncate">{item.description}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Social Media */}
            {(provider.instagram || provider.facebook || provider.youtube || provider.website) && (
              <Card className="border-gold/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-gold" />
                    Connect
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {provider.instagram && (
                      <a
                        href={provider.instagram.startsWith('http') ? provider.instagram : `https://instagram.com/${provider.instagram.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:opacity-90 transition-opacity"
                      >
                        <Instagram className="w-4 h-4" />
                        Instagram
                      </a>
                    )}
                    {provider.facebook && (
                      <a
                        href={provider.facebook.startsWith('http') ? provider.facebook : `https://facebook.com/${provider.facebook}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:opacity-90 transition-opacity"
                      >
                        <Facebook className="w-4 h-4" />
                        Facebook
                      </a>
                    )}
                    {provider.youtube && (
                      <a
                        href={provider.youtube.startsWith('http') ? provider.youtube : `https://youtube.com/${provider.youtube}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:opacity-90 transition-opacity"
                      >
                        <Youtube className="w-4 h-4" />
                        YouTube
                      </a>
                    )}
                    {provider.website && (
                      <a
                        href={provider.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:opacity-90 transition-opacity"
                      >
                        <Globe className="w-4 h-4" />
                        Website
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Availability */}
            {timeSlots.length > 0 && (
              <Card className="border-gold/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-gold" />
                    Weekly Availability
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, idx) => {
                      const daySlots = timeSlots.filter(slot => slot.day_of_week === idx);
                      if (daySlots.length === 0) return null;
                      return (
                        <div key={day} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                          <span className="font-medium">{day}</span>
                          <div className="flex gap-2">
                            {daySlots.map((slot) => (
                              <Badge key={slot.id} variant="secondary" className="bg-gold/10 text-gold border-gold/20">
                                {slot.start_time} - {slot.end_time}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
            {provider.available_dates && (
              <Card className="border-gold/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-gold" />
                    Available Dates
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-line">{provider.available_dates}</p>
                </CardContent>
              </Card>
            )}

            {/* Languages */}
            {provider.languages && (
              <Card className="border-gold/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Languages className="w-5 h-5 text-gold" />
                    Languages
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {provider.languages.split(',').map((lang, idx) => (
                      <Badge key={idx} variant="secondary" className="bg-gold/10 text-gold border-gold/20">
                        {lang.trim()}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Reviews */}
            <Card className="border-gold/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-gold" />
                  Reviews ({provider.total_reviews || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reviews.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No reviews yet</p>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <div key={review.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{review.customer_name}</span>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star 
                                key={i} 
                                className={`w-4 h-4 ${i < review.rating ? 'fill-gold text-gold' : 'text-muted'}`} 
                              />
                            ))}
                          </div>
                        </div>
                        {review.review_text && (
                          <p className="text-sm text-muted-foreground">{review.review_text}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(review.created_at).toLocaleDateString('en-IN')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Review submission form — only for logged-in customers */}
                {user && (
                  <div className="mt-6 pt-6 border-t border-border">
                    <h4 className="text-sm font-semibold mb-3">Leave a Review</h4>
                    <div className="flex items-center gap-1 mb-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setReviewRating(i + 1)}
                          className="focus:outline-none"
                        >
                          <Star className={`w-6 h-6 transition-colors ${i < reviewRating ? 'fill-gold text-gold' : 'text-muted-foreground hover:text-gold'}`} />
                        </button>
                      ))}
                      <span className="text-sm text-muted-foreground ml-2">{reviewRating} / 5</span>
                    </div>
                    <textarea
                      value={reviewText}
                      onChange={e => setReviewText(e.target.value)}
                      placeholder="Share your experience with this artist... (optional)"
                      rows={3}
                      className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:border-gold transition-colors resize-none mb-3"
                    />
                    <Button
                      onClick={handleSubmitReview}
                      disabled={submittingReview}
                      size="sm"
                      className="bg-gradient-gold text-foreground hover:opacity-90"
                    >
                      {submittingReview ? 'Submitting…' : 'Submit Review'}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      You can only review artists after completing a booking with them.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Booking Card */}
            <Card className="border-gold/20 sticky top-24">
              <CardHeader>
                <CardTitle className="text-gold">Book Now</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold bg-gradient-to-r from-gold to-maroon bg-clip-text text-transparent">
                    {provider.price_min && provider.price_max ? (
                      <>₹{provider.price_min.toLocaleString()} - ₹{provider.price_max.toLocaleString()}</>
                    ) : (
                      'Contact for price'
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">per event</p>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span>{provider.experience_years || 0} years experience</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>{provider.total_bookings || 0} events completed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${provider.is_available ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span>{provider.is_available ? 'Available for booking' : 'Currently unavailable'}</span>
                  </div>
                </div>

                <Button 
                  className="w-full bg-gradient-gold hover:opacity-90"
                  onClick={handleBookNow}
                  disabled={!provider.is_available}
                >
                  {provider.is_available ? 'Book Now' : 'Not Available'}
                </Button>

                {/* Availability Check */}
                <div className="pt-4 border-t border-border">
                  <label className="text-sm font-medium mb-2 block">Check Availability</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:border-gold"
                    onChange={(e) => setSelectedDate(e.target.value ? new Date(e.target.value) : null)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  {selectedDate && isAvailable !== undefined && (
                    <div className={`mt-2 text-sm ${isAvailable ? 'text-green-600' : 'text-red-600'}`}>
                      {isAvailable ? '✓ Available on this date' : '✗ Not available on this date'}
                    </div>
                  )}
                </div>

                {/* Contact Buttons */}
                <div className="space-y-2 pt-4 border-t border-border">
                  {profile.phone && (
                    <a
                      href={`tel:${profile.phone}`}
                      className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:opacity-90 transition-opacity"
                    >
                      <Phone className="w-4 h-4" />
                      Call Now
                    </a>
                  )}
                  {profile.phone && (
                    <a
                      href={`https://wa.me/${profile.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:opacity-90 transition-opacity"
                    >
                      <MessageCircle className="w-4 h-4" />
                      WhatsApp
                    </a>
                  )}
                  {profile.email && (
                    <a
                      href={`mailto:${profile.email}`}
                      className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:opacity-90 transition-opacity"
                    >
                      <Mail className="w-4 h-4" />
                      Send Email
                    </a>
                  )}
                </div>

                {/* Report Profile */}
                <Button
                  variant="outline"
                  className="w-full text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => setShowReportModal(true)}
                >
                  <Flag className="w-4 h-4 mr-2" />
                  Report Profile
                </Button>
              </CardContent>
            </Card>

            {/* Stats Card */}
            <Card className="border-gold/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-gold" />
                  Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Bookings</span>
                  <span className="font-semibold">{provider.total_bookings || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Reviews</span>
                  <span className="font-semibold">{provider.total_reviews || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Average Rating</span>
                  <span className="font-semibold flex items-center gap-1">
                    <Star className="w-4 h-4 text-gold fill-gold" />
                    {provider.average_rating?.toFixed(1) || '0.0'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Experience</span>
                  <span className="font-semibold">{provider.experience_years || 0} years</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        {/* ── Similar Artists ────────────────────────────────────────── */}
      {similarArtists.filter(a => a.id !== id).length > 0 && (
        <section className="mt-10 mb-4">
          <h2 className="text-xl font-display font-bold text-foreground mb-5">
            Similar {professionLabels[provider?.profession ?? ''] || 'Artists'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {similarArtists
              .filter(a => a.id !== id)
              .slice(0, 4)
              .map(artist => (
                <button
                  key={artist.id}
                  onClick={() => navigate(`/artist/${artist.id}`)}
                  className="group text-left rounded-2xl overflow-hidden border border-border/60
                             hover:border-gold/30 hover:shadow-elevated bg-card transition-all duration-300
                             hover:-translate-y-1"
                >
                  {/* Thumbnail */}
                  <div className="relative h-36 bg-muted overflow-hidden">
                    <img
                      src={artist.cover_image_url || artist.avatar_url || '/placeholder.svg'}
                      alt={artist.full_name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-foreground/50 to-transparent" />
                    {/* Rating pill */}
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-card/90 backdrop-blur-sm px-1.5 py-0.5 rounded-md">
                      <Star className="w-3 h-3 text-gold fill-gold" />
                      <span className="text-[11px] font-semibold text-foreground">
                        {artist.average_rating.toFixed(1)}
                      </span>
                    </div>
                    {/* Avatar */}
                    <div className="absolute bottom-2 right-2 w-8 h-8 rounded-full border-2 border-card overflow-hidden bg-muted">
                      <img
                        src={artist.avatar_url || '/placeholder.svg'}
                        alt={artist.full_name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <p className="text-sm font-semibold text-foreground truncate group-hover:text-maroon transition-colors">
                      {artist.stage_name || artist.full_name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{artist.city || 'India'}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-medium text-foreground">
                        {artist.price_min > 0
                          ? `₹${(artist.price_min / 1000).toFixed(0)}K+`
                          : 'On Request'}
                      </span>
                      {artist.is_verified && (
                        <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </section>
      )}
    </main>

      {/* Booking Modal */}
      {provider && profile && (
        <BookingModal
          isOpen={showBookingModal}
          onClose={() => setShowBookingModal(false)}
          provider={{
            id: provider.id,
            price_min: provider.price_min || provider.min_price || 0,
            price_max: provider.price_max || provider.max_price || 0
          }}
          providerName={profile.full_name}
        />
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Report Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Please describe why you're reporting this profile..."
                rows={4}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:border-gold resize-none"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowReportModal(false);
                    setReportReason('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  onClick={handleReportProfile}
                >
                  Submit Report
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ProviderProfile;
