import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Mic2, Sparkles } from 'lucide-react';

const AccountTypeSelection = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  const handleSelectType = async (type: 'customer' | 'provider') => {
    setLoading(true);
    try {
      // The role will be set during registration flow
      // For now, redirect to appropriate page
      if (type === 'provider') {
        navigate('/provider/register');
      } else {
        navigate('/');
      }
    } catch (error) {
      console.error('Error selecting account type:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream via-background to-blush/20 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
            Choose Your Account Type
          </h1>
          <p className="text-muted-foreground text-lg">
            Select how you want to use Vowza
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Customer Card */}
          <Card 
            className="group cursor-pointer hover:shadow-elevated transition-all duration-300 border-border/50 hover:border-gold/50 animate-fade-in"
            onClick={() => !loading && handleSelectType('customer')}
          >
            <CardHeader className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-gold flex items-center justify-center text-foreground shadow-gold group-hover:scale-110 transition-transform">
                <User className="w-10 h-10" />
              </div>
              <CardTitle className="text-2xl">Customer</CardTitle>
              <CardDescription>
                Discover and book amazing artists for your events
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <ul className="text-left space-y-2 mb-6 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-gold" />
                  Browse verified artists
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-gold" />
                  Compare prices and packages
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-gold" />
                  Book multiple artists at once
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-gold" />
                  Secure payments
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-gold" />
                  Track bookings in real-time
                </li>
              </ul>
              <Button 
                className="w-full bg-gradient-gold hover:opacity-90"
                disabled={loading}
              >
                Continue as Customer
              </Button>
            </CardContent>
          </Card>

          {/* Artist Card */}
          <Card 
            className="group cursor-pointer hover:shadow-elevated transition-all duration-300 border-border/50 hover:border-gold/50 animate-fade-in"
            style={{ animationDelay: '0.2s' }}
            onClick={() => !loading && handleSelectType('provider')}
          >
            <CardHeader className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-maroon flex items-center justify-center text-white shadow-maroon group-hover:scale-110 transition-transform">
                <Mic2 className="w-10 h-10" />
              </div>
              <CardTitle className="text-2xl">Artist</CardTitle>
              <CardDescription>
                Showcase your talent and grow your business
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <ul className="text-left space-y-2 mb-6 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-maroon" />
                  Create professional portfolio
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-maroon" />
                  Set your own pricing packages
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-maroon" />
                  Manage availability
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-maroon" />
                  Receive booking notifications
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-maroon" />
                  Track earnings and reviews
                </li>
              </ul>
              <Button 
                className="w-full bg-gradient-maroon hover:opacity-90"
                disabled={loading}
              >
                Continue as Artist
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AccountTypeSelection;
