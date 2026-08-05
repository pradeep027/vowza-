import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppLogo from '@/components/AppLogo';
import { useProviders, Provider } from '@/hooks/useProviders';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Search, 
  MapPin, 
  Star, 
  Filter,
  Music,
  Camera,
  Palette,
  Users,
  Sparkles,
  LogOut,
  Calendar,
  User,
  Download,
  IndianRupee,
  FileText,
  Mic2
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type ProfessionType = Database['public']['Enums']['profession_type'];

// Full label map covering all 34+ profession types
const professionLabels: Record<string, string> = {
  normal_band: 'Music Band', maharashtra_band: 'Maharashtra Band', musician: 'Musician',
  dj: 'DJ', photographer: 'Photographer', videographer: 'Videographer',
  decorator: 'Decorator', kuchipudi_dancer: 'Kuchipudi Dancer', classical_dancer: 'Classical Dancer',
  western_dancer: 'Western Dancer', event_support: 'Event Support',
  music_band: 'Music Band', traditional_band: 'Traditional Band', singer: 'Singer',
  instrumental_artist: 'Instrumental Artist', classical_musician: 'Classical Musician',
  cinematographer: 'Cinematographer', drone_operator: 'Drone Operator', dancer: 'Dancer',
  choreographer: 'Choreographer', event_decorator: 'Event Decorator',
  wedding_decorator: 'Wedding Decorator', stage_decorator: 'Stage Decorator',
  makeup_artist: 'Makeup Artist', mehendi_artist: 'Mehendi Artist', anchor: 'Anchor / Emcee',
  host: 'Host', magician: 'Magician', stand_up_comedian: 'Stand-up Comedian',
  celebrity_artist: 'Celebrity Artist', live_performer: 'Live Performer', folk_artist: 'Folk Artist',
  lighting_services: 'Lighting Services', sound_services: 'Sound Engineer',
  event_planner: 'Event Planner', wedding_planner: 'Wedding Planner',
  catering_services: 'Catering Services', event_support_staff: 'Event Support',
};

const professionIcons: Record<string, React.ReactNode> = {
  normal_band: <Music className="w-4 h-4" />, maharashtra_band: <Music className="w-4 h-4" />,
  musician: <Music className="w-4 h-4" />, music_band: <Music className="w-4 h-4" />,
  traditional_band: <Music className="w-4 h-4" />, singer: <Mic2 className="w-4 h-4" />,
  dj: <Sparkles className="w-4 h-4" />, instrumental_artist: <Music className="w-4 h-4" />,
  classical_musician: <Music className="w-4 h-4" />,
  photographer: <Camera className="w-4 h-4" />, videographer: <Camera className="w-4 h-4" />,
  cinematographer: <Camera className="w-4 h-4" />, drone_operator: <Camera className="w-4 h-4" />,
  decorator: <Palette className="w-4 h-4" />, event_decorator: <Palette className="w-4 h-4" />,
  wedding_decorator: <Palette className="w-4 h-4" />, stage_decorator: <Palette className="w-4 h-4" />,
  dancer: <Users className="w-4 h-4" />, choreographer: <Users className="w-4 h-4" />,
  kuchipudi_dancer: <Users className="w-4 h-4" />, classical_dancer: <Users className="w-4 h-4" />,
  western_dancer: <Users className="w-4 h-4" />,
  makeup_artist: <Sparkles className="w-4 h-4" />, mehendi_artist: <Sparkles className="w-4 h-4" />,
  anchor: <Mic2 className="w-4 h-4" />, host: <Mic2 className="w-4 h-4" />,
  magician: <Sparkles className="w-4 h-4" />, stand_up_comedian: <Mic2 className="w-4 h-4" />,
  celebrity_artist: <Sparkles className="w-4 h-4" />, live_performer: <Music className="w-4 h-4" />,
  folk_artist: <Music className="w-4 h-4" />,
  lighting_services: <Sparkles className="w-4 h-4" />, sound_services: <Music className="w-4 h-4" />,
  event_planner: <Calendar className="w-4 h-4" />, wedding_planner: <Calendar className="w-4 h-4" />,
  catering_services: <Users className="w-4 h-4" />,
  event_support: <Users className="w-4 h-4" />, event_support_staff: <Users className="w-4 h-4" />,
};

const CustomerDashboard = () => {
  const [searchCity, setSearchCity] = useState('');
  const [selectedProfession, setSelectedProfession] = useState<ProfessionType | 'all'>('all');
  const [appliedCity, setAppliedCity] = useState('');
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'browse' | 'bookings' | 'payments'>('browse');
  
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  
  const { providers, isLoading } = useProviders({
    profession: selectedProfession === 'all' ? undefined : selectedProfession,
    city: appliedCity || undefined,
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
      return;
    }

    fetchPaymentHistory();
  }, [user, loading, navigate]);

  const fetchPaymentHistory = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('invoices' as any)
        .select('*')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (data) {
        setPaymentHistory(data);
      }
    } catch (error) {
      console.error('Error fetching payment history:', error);
    }
  };

  const downloadInvoice = async (invoice: any) => {
    try {
      const invoiceContent = `
INVOICE
================================
Invoice Number: ${invoice.invoice_number}
Date: ${new Date(invoice.generated_at).toLocaleDateString()}

Total Amount: ₹${invoice.total_amount.toLocaleString()}
Platform Fee: ₹${invoice.platform_fee.toLocaleString()}
Service Amount: ₹${invoice.amount.toLocaleString()}

Status: ${invoice.status.toUpperCase()}
================================
Thank you for choosing Vowza!
      `;

      const blob = new Blob([invoiceContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.invoice_number}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Invoice downloaded');
    } catch (error) {
      toast.error('Failed to download invoice');
    }
  };

  const handleSearch = () => {
    setAppliedCity(searchCity);
  };

  const handleSignOut = async () => {
    await signOut(); // signOut() handles redirect internally
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cream via-background to-blush/20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream via-background to-blush/20">
      {/* Header */}
      <header className="bg-card/95 backdrop-blur-sm border-b border-gold/20 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AppLogo size="lg" />
          <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap sm:justify-end">
            <Button
              variant={activeTab === 'browse' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('browse')}
            >
              <Search className="w-4 h-4 mr-2" />
              Browse
            </Button>
            <Button
              variant={activeTab === 'bookings' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('bookings')}
            >
              <Calendar className="w-4 h-4 mr-2" />
              My Bookings
            </Button>
            <Button
              variant={activeTab === 'payments' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('payments')}
            >
              <FileText className="w-4 h-4 mr-2" />
              Payments
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Browse Tab */}
        {activeTab === 'browse' && (
          <>
            {/* Search & Filters */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-gold to-maroon bg-clip-text text-transparent">
                Find Your Perfect Artist
              </h1>
              <p className="text-muted-foreground mb-6">Browse verified professionals for your event</p>
              
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    placeholder="Search by city..."
                    value={searchCity}
                    onChange={(e) => setSearchCity(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-10 border-border focus:border-gold"
                  />
                </div>
                
                <Select 
                  value={selectedProfession} 
                  onValueChange={(v) => setSelectedProfession(v as ProfessionType | 'all')}
                >
                  <SelectTrigger className="w-full md:w-[200px] border-border focus:border-gold">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {Object.entries(professionLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        <div className="flex items-center gap-2">
                          {professionIcons[value]}
                          {label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Button onClick={handleSearch} className="bg-gradient-gold hover:opacity-90">
                  Search
                </Button>
              </div>
            </div>

            {/* Results */}
            {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
          </div>
        ) : providers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">No providers found</p>
            <p className="text-sm text-muted-foreground mt-2">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {providers.map((provider) => (
              <ProviderCard key={provider.id} provider={provider} />
            ))}
          </div>
        )}
          </>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-gold to-maroon bg-clip-text text-transparent">
              Payment History
            </h1>
            <p className="text-muted-foreground mb-6">View your payment history and download invoices</p>

            {paymentHistory.length === 0 ? (
              <Card className="border-gold/20">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="w-16 h-16 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No payment history found</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {paymentHistory.map((payment) => (
                  <Card key={payment.id} className="border-gold/20">
                    <CardContent className="p-6">
                      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <Badge className={
                              payment.status === 'paid' ? 'bg-green-500/20 text-green-700 border-green-500/30' :
                              'bg-yellow-500/20 text-yellow-700 border-yellow-500/30'
                            }>
                              {payment.status}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {new Date(payment.generated_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="font-semibold">{payment.invoice_number}</p>
                          <p className="text-sm text-muted-foreground">
                            Total: ₹{payment.total_amount?.toLocaleString()}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadInvoice(payment)}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bookings Tab */}
        {activeTab === 'bookings' && (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-gold to-maroon bg-clip-text text-transparent">
              My Bookings
            </h1>
            <p className="text-muted-foreground mb-6">Manage your event bookings</p>
            <Link to="/my-bookings">
              <Button className="bg-gradient-gold hover:opacity-90">
                View All Bookings
              </Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
};

const ProviderCard = ({ provider }: { provider: Provider }) => {
  const navigate = useNavigate();
  
  return (
    <Card 
      className="overflow-hidden border-gold/20 hover:shadow-elegant transition-all cursor-pointer group"
      onClick={() => navigate(`/provider/${provider.id}`)}
    >
      <div className="h-48 bg-gradient-to-br from-gold/20 to-maroon/20 flex items-center justify-center">
        {provider.profile?.avatar_url ? (
          <img 
            src={provider.profile.avatar_url} 
            alt={provider.profile.full_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gradient-gold flex items-center justify-center">
            <User className="w-10 h-10 text-foreground" />
          </div>
        )}
      </div>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-semibold text-lg group-hover:text-gold transition-colors">
              {provider.profile?.full_name || 'Unknown'}
            </h3>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              {professionIcons[provider.profession]}
              <span>{professionLabels[provider.profession]}</span>
            </div>
          </div>
          {provider.is_verified && (
            <Badge className="bg-green-500/20 text-green-700 border-green-500/30">
              Verified
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
          {provider.profile?.city && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {provider.profile.city}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Star className="w-3 h-3 fill-gold text-gold" />
            {provider.average_rating?.toFixed(1) || '0.0'} ({provider.total_reviews || 0})
          </span>
        </div>
        
        {provider.experience_years && (
          <p className="text-sm text-muted-foreground mb-3">
            {provider.experience_years} years experience
          </p>
        )}
        
        <div className="flex items-center justify-between">
          <div className="text-gold font-semibold">
            {provider.price_min && provider.price_max ? (
              <>₹{provider.price_min.toLocaleString()} - ₹{provider.price_max.toLocaleString()}</>
            ) : (
              'Contact for price'
            )}
          </div>
          <Button size="sm" variant="outline" className="border-gold text-gold hover:bg-gold/10">
            View Profile
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CustomerDashboard;
