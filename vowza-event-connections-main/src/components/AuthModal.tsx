/**
 * AuthModal — Beautiful authentication experience for protected actions
 * 
 * Shows when unauthenticated user attempts a protected action:
 * - Book Artist
 * - Add to Cart
 * - Save/Favorite
 * - Checkout
 * - Messages
 * - Reviews
 * 
 * Features:
 * - Split-screen design (promotional image + auth form)
 * - Email/password Sign In
 * - Create Account
 * - Continue with Google
 * - Forgot Password
 * - Promotional image (admin-controlled)
 * - Mobile responsive
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Eye, EyeOff, Mail, Lock, User, Phone, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { validateFullName, validateEmail, validateIndianPhone } from '@/utils/validation';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultTab?: 'signin' | 'signup';
}

// Loading skeleton for image
const ImageSkeleton = () => (
  <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-300 animate-pulse" />
);

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultTab = 'signin',
}) => {
  const { signIn, signUp } = useAuth();
  const [tab, setTab] = useState<'signin' | 'signup'>(defaultTab);
  const [isLoading, setIsLoading] = useState(false);

  // Promotional image state
  const [promoImageUrl, setPromoImageUrl] = useState<string>('');
  const [imageLoading, setImageLoading] = useState(true);
  const [overlayOpacity, setOverlayOpacity] = useState(0.3);

  // Sign In form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPwd, setShowLoginPwd] = useState(false);

  // Sign Up form
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPwd, setShowSignupPwd] = useState(false);

  // Forgot password
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  // Fetch promotional image on mount
  useEffect(() => {
    const fetchPromoImage = async () => {
      try {
        setImageLoading(true);
        const { data, error } = await supabase
          .from('auth_promotional_config')
          .select('current_image_url, overlay_opacity')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          setPromoImageUrl(data.current_image_url || '');
          setOverlayOpacity(data.overlay_opacity || 0.3);
        }
      } catch (err) {
        console.error('[AuthModal] Failed to fetch promo image:', err);
      } finally {
        setImageLoading(false);
      }
    };

    if (isOpen) {
      fetchPromoImage();
    }
  }, [isOpen]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) return;

    setIsLoading(true);
    const { error } = await signIn(loginEmail.trim(), loginPassword);

    if (error) {
      const msg = (error as any).message || '';
      if (msg.toLowerCase().includes('invalid login credentials') || msg.toLowerCase().includes('invalid email or password')) {
        toast.error('Incorrect email or password.');
      } else if (msg.toLowerCase().includes('email not confirmed')) {
        toast.error('Please verify your email before logging in.');
      } else {
        toast.error(msg || 'Login failed. Please try again.');
      }
      setIsLoading(false);
    } else {
      toast.success('Welcome back! 🎉');
      setLoginEmail('');
      setLoginPassword('');
      onClose();
      onSuccess?.();
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    const nameCheck = validateFullName(signupName);
    if (!nameCheck.valid) {
      toast.error(nameCheck.error!);
      return;
    }

    const emailCheck = validateEmail(signupEmail);
    if (!emailCheck.valid) {
      toast.error(emailCheck.error!);
      return;
    }

    const phoneCheck = validateIndianPhone(signupPhone);
    if (!phoneCheck.valid) {
      toast.error(phoneCheck.error!);
      return;
    }

    if (signupPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    const phoneDigits = signupPhone.replace(/[\s\-+()]/g, '').replace(/^91/, '').replace(/^0/, '');
    const normalizedPhone = '+91' + phoneDigits;

    const { data, error } = await signUp(signupEmail.trim(), signupPassword, signupName.trim(), normalizedPhone);

    if (error) {
      if ((error as any).message?.toLowerCase().includes('already registered')) {
        toast.error('This email is already registered. Please log in.');
      } else {
        toast.error((error as any).message ?? 'Sign up failed. Please try again.');
      }
      setIsLoading(false);
      return;
    }

    if (data?.user && data.user.identities && data.user.identities.length === 0) {
      toast.error('This email is already registered. Please log in or check your email for verification.');
      setIsLoading(false);
      return;
    }

    toast.success('Verification email sent! Check your inbox to confirm your account.');
    setSignupName('');
    setSignupEmail('');
    setSignupPhone('');
    setSignupPassword('');
    setTab('signin');
    setIsLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      toast.error('Google sign-in failed. Please try again.');
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      toast.error('Please enter your email');
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth?mode=reset`,
    });

    if (error) {
      toast.error(error.message || 'Failed to send reset email.');
    } else {
      toast.success('Reset link sent! Check your inbox and spam folder.');
      setResetEmail('');
      setShowResetForm(false);
    }
    setIsLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* LEFT: Promotional Image */}
        <div className="relative hidden md:block bg-slate-200 overflow-hidden">
          {imageLoading && <ImageSkeleton />}
          
          {promoImageUrl && (
            <img
              src={promoImageUrl}
              alt="Vowza Promotional"
              className="w-full h-full object-cover"
              onLoad={() => setImageLoading(false)}
            />
          )}
          
          {!promoImageUrl && !imageLoading && (
            <div className="w-full h-full bg-gradient-to-br from-purple-600 via-maroon-600 to-orange-600 flex flex-col items-center justify-center text-white p-8">
              <h2 className="text-4xl font-display font-bold mb-4 text-center">Vowza</h2>
              <p className="text-xl text-white/90 text-center mb-8">Where Talent Meets Celebration</p>
              <div className="text-sm text-white/80 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-white/60"></div>
                  <span>Trusted Event Professionals</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-white/60"></div>
                  <span>Multiple Event Categories</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-white/60"></div>
                  <span>Easy Booking</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-white/60"></div>
                  <span>Seamless Event Planning</span>
                </div>
              </div>
            </div>
          )}

          {/* Overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})` }}
          />
        </div>

        {/* RIGHT: Auth Form */}
        <div className="p-8 md:p-10 overflow-y-auto">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>

          {showResetForm ? (
            // Forgot Password Form
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-display font-bold mb-2">Forgot Password?</h2>
                <p className="text-muted-foreground text-sm">We'll send a reset link to your email.</p>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label htmlFor="reset-email" className="text-xs font-semibold text-foreground block mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                      id="reset-email"
                      type="email"
                      placeholder="your@email.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="input-premium pl-10 w-full"
                      autoComplete="email"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary w-full justify-center py-3"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      Send Reset Link
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <button
                type="button"
                onClick={() => setShowResetForm(false)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back to login
              </button>
            </div>
          ) : (
            // Main Auth Form
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-display font-bold mb-2">
                  {tab === 'signin' ? 'Welcome back' : 'Create your account'}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {tab === 'signin' ? 'Sign in to book your perfect event professional' : 'Join Vowza to discover and book trusted event professionals'}
                </p>
              </div>

              {/* Tab switcher */}
              <div className="flex gap-1 p-1 bg-secondary rounded-xl border border-border/50">
                <button
                  type="button"
                  onClick={() => {
                    setTab('signin');
                    setSignupName('');
                    setSignupEmail('');
                    setSignupPhone('');
                    setSignupPassword('');
                  }}
                  className={cn(
                    'flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all',
                    tab === 'signin'
                      ? 'bg-white dark:bg-gray-900 text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab('signup');
                    setLoginEmail('');
                    setLoginPassword('');
                  }}
                  className={cn(
                    'flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all',
                    tab === 'signup'
                      ? 'bg-white dark:bg-gray-900 text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Sign Up
                </button>
              </div>

              {/* Sign In Form */}
              {tab === 'signin' && (
                <form onSubmit={handleSignIn} className="space-y-4" noValidate>
                  <div>
                    <label htmlFor="login-email" className="text-xs font-semibold text-foreground block mb-2">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      <input
                        id="login-email"
                        type="email"
                        placeholder="your@email.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="input-premium pl-10 w-full"
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label htmlFor="login-password" className="text-xs font-semibold text-foreground">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowResetForm(true)}
                        className="text-xs text-maroon hover:opacity-75 transition-opacity"
                      >
                        Forgot?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      <input
                        id="login-password"
                        type={showLoginPwd ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="input-premium pl-10 pr-10 w-full"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowLoginPwd(!showLoginPwd)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showLoginPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button type="submit" disabled={isLoading} className="btn-primary w-full justify-center py-3">
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Signing in…
                      </>
                    ) : (
                      <>
                        Sign In
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Sign Up Form */}
              {tab === 'signup' && (
                <form onSubmit={handleSignUp} className="space-y-4" noValidate>
                  <div>
                    <label htmlFor="signup-name" className="text-xs font-semibold text-foreground block mb-2">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      <input
                        id="signup-name"
                        type="text"
                        placeholder="Your full name"
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        className="input-premium pl-10 w-full"
                        autoComplete="name"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="signup-email" className="text-xs font-semibold text-foreground block mb-2">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      <input
                        id="signup-email"
                        type="email"
                        placeholder="your@email.com"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        className="input-premium pl-10 w-full"
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="signup-phone" className="text-xs font-semibold text-foreground block mb-2">
                      Phone
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      <input
                        id="signup-phone"
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={signupPhone}
                        onChange={(e) => setSignupPhone(e.target.value)}
                        className="input-premium pl-10 w-full"
                        autoComplete="tel"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="signup-password" className="text-xs font-semibold text-foreground block mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      <input
                        id="signup-password"
                        type={showSignupPwd ? 'text' : 'password'}
                        placeholder="Min. 6 characters"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        className="input-premium pl-10 pr-10 w-full"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowSignupPwd(!showSignupPwd)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showSignupPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button type="submit" disabled={isLoading} className="btn-primary w-full justify-center py-3">
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating…
                      </>
                    ) : (
                      <>
                        Create Account
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Divider */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Google Sign In */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="btn-secondary w-full justify-center py-3 gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
