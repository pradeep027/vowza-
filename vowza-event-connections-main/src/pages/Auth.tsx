import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Sparkles, Music, Camera, Palette, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPwd, setShowSignupPwd] = useState(false);
  const [signupFullName, setSignupFullName] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showResetForm, setShowResetForm] = useState(false);
  const [signupDone, setSignupDone] = useState(false);

  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isResetMode = searchParams.get('mode') === 'reset';

  // Show inactivity message if redirected here for that reason
  useEffect(() => {
    const wasInactive = localStorage.getItem('inactivityLogout');
    if (wasInactive === 'true') {
      localStorage.removeItem('inactivityLogout');
      toast.info('You were logged out due to inactivity.');
    }
  }, []);

  // Redirect authenticated users away from auth page
  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) return;
    setIsLoading(true);
    const { error } = await signIn(loginEmail.trim(), loginPassword);
    if (error) {
      if (error.message?.toLowerCase().includes('invalid login credentials') ||
          error.message?.toLowerCase().includes('invalid email or password')) {
        toast.error('Incorrect email or password. Please try again.');
      } else if (error.message?.toLowerCase().includes('email not confirmed')) {
        toast.error('Please check your email and confirm your account before logging in.');
      } else {
        toast.error(error.message ?? 'Login failed. Please try again.');
      }
    } else {
      toast.success('Welcome back! 🎉');
      navigate('/');
    }
    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupFullName.trim()) { toast.error('Please enter your full name'); return; }
    if (signupPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setIsLoading(true);
    const { error } = await signUp(signupEmail.trim(), signupPassword, signupFullName.trim(), signupPhone.trim() || undefined);
    if (error) {
      if (error.message?.toLowerCase().includes('already registered') ||
          error.message?.toLowerCase().includes('user already registered')) {
        toast.error('This email is already registered. Please log in instead.');
      } else {
        toast.error(error.message ?? 'Sign up failed. Please try again.');
      }
    } else {
      setSignupDone(true);
    }
    setIsLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) { toast.error('Please enter your email'); return; }
    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/auth?mode=reset`,
    });
    if (error) {
      toast.error(error.message ?? 'Failed to send reset email');
    } else {
      toast.success('Password reset link sent! Check your inbox.');
      setShowResetForm(false);
      setResetEmail('');
    }
    setIsLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error(error.message ?? 'Failed to update password');
    } else {
      toast.success('Password updated! You can now log in.');
      navigate('/auth');
    }
    setIsLoading(false);
  };

  // ── Email confirmed → direct to account type selection ───────────────────
  if (signupDone) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream via-background to-blush/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-elevated border-gold/20 bg-card/95 backdrop-blur-sm text-center">
          <CardHeader>
            <div className="w-16 h-16 rounded-full bg-gradient-gold flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-foreground" />
            </div>
            <CardTitle className="text-2xl">Check Your Email</CardTitle>
            <CardDescription className="text-base mt-2">
              We sent a confirmation link to <strong>{signupEmail}</strong>.
              Click the link to activate your account, then come back to log in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-6">
              Didn't receive it? Check your spam folder, or{' '}
              <button
                onClick={() => setSignupDone(false)}
                className="text-gold underline hover:text-gold-dark transition-colors"
              >
                try a different email
              </button>.
            </p>
            <Button
              className="w-full bg-gradient-gold hover:opacity-90"
              onClick={() => { setSignupDone(false); }}
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Reset password mode (after clicking email link) ───────────────────────
  if (isResetMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream via-background to-blush/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-elevated border-gold/20 bg-card/95 backdrop-blur-sm">
          <CardHeader className="text-center">
            <Link to="/" className="inline-flex items-center justify-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-full bg-gradient-gold flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-foreground" />
              </div>
              <span className="text-2xl font-display font-bold">Vowza</span>
            </Link>
            <CardTitle className="flex items-center justify-center gap-2">
              <Lock className="w-5 h-5 text-gold" />
              Set New Password
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showSignupPwd ? 'text' : 'password'}
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <button type="button" onClick={() => setShowSignupPwd(!showSignupPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showSignupPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full bg-gradient-gold hover:opacity-90" disabled={isLoading}>
                {isLoading ? 'Updating…' : 'Update Password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream via-background to-blush/20 flex items-center justify-center p-4">
      {/* Decorative floating icons */}
      <div className="absolute top-20 left-10 text-gold/20 animate-float pointer-events-none select-none">
        <Sparkles className="w-16 h-16" />
      </div>
      <div className="absolute bottom-20 right-10 text-maroon/20 animate-float pointer-events-none select-none" style={{ animationDelay: '1s' }}>
        <Music className="w-20 h-20" />
      </div>
      <div className="absolute top-1/3 right-20 text-royal/20 animate-float pointer-events-none select-none" style={{ animationDelay: '2s' }}>
        <Camera className="w-12 h-12" />
      </div>
      <div className="absolute bottom-1/3 left-20 text-gold/20 animate-float pointer-events-none select-none" style={{ animationDelay: '0.5s' }}>
        <Palette className="w-14 h-14" />
      </div>

      <Card className="w-full max-w-md shadow-elevated border-gold/20 bg-card/95 backdrop-blur-sm relative z-10">
        <CardHeader className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center justify-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-full bg-gradient-gold flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-foreground" />
            </div>
            <span className="text-2xl font-display font-bold">Vowza</span>
          </Link>
          <CardTitle className="text-xl font-semibold">Welcome</CardTitle>
          <CardDescription>Where Talent Meets Celebration</CardDescription>
        </CardHeader>

        <CardContent>
          {/* ── Forgot password form overlay ─────────────────────── */}
          {showResetForm ? (
            <div>
              <button onClick={() => setShowResetForm(false)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to login
              </button>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email Address</Label>
                  <Input id="reset-email" type="email" placeholder="your@email.com"
                    value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required />
                  <p className="text-xs text-muted-foreground">We'll send a password reset link to this email.</p>
                </div>
                <Button type="submit" className="w-full bg-gradient-gold hover:opacity-90" disabled={isLoading}>
                  {isLoading ? 'Sending…' : 'Send Reset Link'}
                </Button>
              </form>
            </div>
          ) : (
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Log In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              {/* ── Login tab ──────────────────────────────────── */}
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" type="email" placeholder="your@email.com"
                      value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password">Password</Label>
                      <button type="button" onClick={() => setShowResetForm(true)}
                        className="text-xs text-gold hover:text-gold-dark transition-colors">
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Input id="login-password" type={showLoginPwd ? 'text' : 'password'}
                        placeholder="••••••••" value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)} required />
                      <button type="button" onClick={() => setShowLoginPwd(!showLoginPwd)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showLoginPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-gradient-gold hover:opacity-90" disabled={isLoading}>
                    {isLoading ? 'Signing in…' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>

              {/* ── Sign-up tab ────────────────────────────────── */}
              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name *</Label>
                    <Input id="signup-name" type="text" placeholder="Your full name"
                      value={signupFullName} onChange={(e) => setSignupFullName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email *</Label>
                    <Input id="signup-email" type="email" placeholder="your@email.com"
                      value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-phone">Phone (optional)</Label>
                    <Input id="signup-phone" type="tel" placeholder="+91 98765 43210"
                      value={signupPhone} onChange={(e) => setSignupPhone(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password *</Label>
                    <div className="relative">
                      <Input id="signup-password" type={showSignupPwd ? 'text' : 'password'}
                        placeholder="Min. 6 characters" value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)} required minLength={6} />
                      <button type="button" onClick={() => setShowSignupPwd(!showSignupPwd)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showSignupPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-gradient-gold hover:opacity-90" disabled={isLoading}>
                    {isLoading ? 'Creating account…' : 'Create Account'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
