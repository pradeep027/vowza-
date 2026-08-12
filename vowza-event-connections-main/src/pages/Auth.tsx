// ─── Auth — Fixed: no focus loss, no re-render on keystroke ─────────────────
//
// ROOT CAUSE OF BUG:  `Layout` was defined INSIDE the `Auth` function body.
// Every state change (keystroke) caused Auth to re-render, which created a
// brand-new `Layout` function reference, causing React to unmount+remount the
// entire subtree, destroying focus on every character typed.
//
// FIX: `Layout` is now defined at MODULE scope — it never changes reference,
// so React reuses the existing DOM nodes and focus is preserved.

import { useState, useEffect, memo } from 'react';
import VowzaIcon from '@/components/VowzaIcon';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import AppLogo from '@/components/AppLogo';
import {
  Lock, Eye, EyeOff, ArrowLeft, Mail,
  User, Phone, CheckCircle, ArrowRight
} from 'lucide-react';
import { validateFullName, validateEmail, validateIndianPhone } from '@/utils/validation';

// ── Layout shell — MODULE scope (never re-created on parent re-render) ────────
const AuthLayout = memo(({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-[#09090f] flex">
    {/* Left panel — branding (desktop only) */}
    <div className="hidden lg:flex flex-col justify-between w-[420px] xl:w-[480px] flex-shrink-0 p-12 relative overflow-hidden">
      {/* Background glow orbs */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full opacity-20 blur-[100px]"
        style={{ background: 'radial-gradient(circle, hsl(345 72% 36%), transparent 70%)' }} />
      <div className="absolute bottom-1/4 right-0 w-[300px] h-[300px] rounded-full opacity-15 blur-[80px]"
        style={{ background: 'radial-gradient(circle, hsl(40 95% 52%), transparent 70%)' }} />

      {/* Logo */}
      <AppLogo theme="dark" size="lg" className="relative z-10" />

      {/* Brand copy */}
      <div className="relative z-10">
        <h2 className="text-3xl xl:text-4xl font-display font-bold text-white leading-tight mb-4">
          Where Talent<br />Meets{' '}
          <span style={{ background: 'linear-gradient(135deg,hsl(40 95% 65%),hsl(36 85% 44%))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Celebration
          </span>
        </h2>
        <p className="text-white/50 text-sm leading-relaxed mb-8">
          India's premier event marketplace. Book verified photographers, DJs, bands, makeup artists, and 50+ more categories.
        </p>
        <div className="space-y-3">
          {['1,500+ Verified Artists', '10,000+ Events Completed', '4.9★ Average Rating', '50+ Cities Covered'].map(s => (
            <div key={s} className="flex items-center gap-2.5 text-sm text-white/60">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              {s}
            </div>
          ))}
        </div>
      </div>

      <p className="text-white/25 text-xs relative z-10">© {new Date().getFullYear()} Vowza Technologies Pvt. Ltd.</p>
    </div>

    {/* Right panel — form */}
    <div className="flex-1 flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md">
        {/* Mobile logo */}
        <AppLogo size="md" className="mb-8 lg:hidden" />
        {children}
      </div>
    </div>
  </div>
));
AuthLayout.displayName = 'AuthLayout';

// ── Main Auth component ───────────────────────────────────────────────────────
const Auth = () => {
  const [tab,            setTab]            = useState<'login' | 'signup'>('login');
  const [isLoading,      setIsLoading]      = useState(false);
  const [loginEmail,     setLoginEmail]     = useState('');
  const [loginPassword,  setLoginPassword]  = useState('');
  const [showLoginPwd,   setShowLoginPwd]   = useState(false);
  const [signupEmail,    setSignupEmail]    = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPwd,  setShowSignupPwd]  = useState(false);
  const [signupName,     setSignupName]     = useState('');
  const [signupPhone,    setSignupPhone]    = useState('');
  const [resetEmail,     setResetEmail]     = useState('');
  const [newPassword,    setNewPassword]    = useState('');
  const [showLoginNewPwd,setShowLoginNewPwd]= useState(false);
  const [showResetForm,  setShowResetForm]  = useState(false);
  const [signupDone,     setSignupDone]     = useState(false);

  const { signIn, signUp, user, roles, rolesLoaded } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isResetMode = searchParams.get('mode') === 'reset';

  // Show inactivity toast once
  useEffect(() => {
    const wasInactive = localStorage.getItem('inactivityLogout');
    if (wasInactive === 'true') {
      localStorage.removeItem('inactivityLogout');
      toast.info('You were logged out due to inactivity.');
    }
  }, []);

  // Role-based redirect — admin → /admin/dashboard, provider → /provider/dashboard, else → /
  useEffect(() => {
    if (user && rolesLoaded) {
      if (roles.includes('admin'))    { navigate('/admin/dashboard', { replace: true }); return; }
      if (roles.includes('provider')) { navigate('/vendor/dashboard', { replace: true }); return; }
      navigate('/', { replace: true });
    }
  }, [user, roles, rolesLoaded, navigate]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) return;
    setIsLoading(true);
    const { error } = await signIn(loginEmail.trim(), loginPassword);
    if (error) {
      // Log full diagnostic info — check browser DevTools console to see the
      // real reason Supabase rejected the login (status code, error code, message).
      console.error('[Auth] Sign-in failed:', {
        message: (error as any).message,
        status:  (error as any).status,
        code:    (error as any).code,
        name:    (error as any).name,
      });
      const msg = error.message || '';
      if (msg.toLowerCase().includes('invalid login credentials') || msg.toLowerCase().includes('invalid email or password'))
        toast.error('Incorrect email or password.');
      else if (msg.toLowerCase().includes('email not confirmed'))
        toast.error('Please verify your email before logging in — check your inbox for the confirmation link.');
      else if (msg.toLowerCase().includes('user not found'))
        toast.error('No account found with this email.');
      else toast.error(msg || 'Login failed. Please try again.');
    } else {
      toast.success('Welcome back! 🎉');
      // Role-based redirect happens automatically via the useEffect above
      // when rolesLoaded becomes true after AuthContext fetches roles
    }
    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate name
    const nameCheck = validateFullName(signupName);
    if (!nameCheck.valid) { toast.error(nameCheck.error!); return; }
    // Validate email
    const emailCheck = validateEmail(signupEmail);
    if (!emailCheck.valid) { toast.error(emailCheck.error!); return; }
    // Phone validation — required, must be valid Indian number
    const phoneCheck = validateIndianPhone(signupPhone);
    if (!phoneCheck.valid) { toast.error(phoneCheck.error!); return; }
    const phoneClean = signupPhone.trim().replace(/[\s\-()]/g, '');
    const phoneDigits = phoneClean.replace(/^\+91/, '').replace(/^91/, '').replace(/^0/, '');
    if (signupPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setIsLoading(true);
    const normalizedPhone = '+91' + phoneDigits;
    const { data, error } = await signUp(signupEmail.trim(), signupPassword, signupName.trim(), normalizedPhone);
    if (error) {
      console.error('[Auth] signUp error:', error.message, error);
      if (error.message?.toLowerCase().includes('already registered'))
        toast.error('This email is already registered. Please log in.');
      else toast.error(error.message ?? 'Sign up failed. Please try again.');
      setIsLoading(false);
      return;
    }

    // Check if user was actually created (identities = 0 means email already exists but unconfirmed)
    if (data?.user && data.user.identities && data.user.identities.length === 0) {
      toast.error('This email is already registered. Please log in or check your email for verification.');
      setIsLoading(false);
      return;
    }

    console.log('[Auth] Signup completed, confirmation email should be sent by Supabase via Brevo SMTP');
    console.log('[Auth] User created:', data?.user?.id, '| Email:', signupEmail.trim());
    console.log('[Auth] Session:', data?.session ? 'exists (will be unconfirmed)' : 'none (email confirmation required)');

    // Do NOT sign out — with "Confirm email" enabled, no active session is created
    // Supabase handles sending the confirmation email via configured SMTP (Brevo)
    setSignupDone(true);
    setIsLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) { toast.error('Please enter your email'); return; }
    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth?mode=reset`,
    });
    if (error) toast.error(error.message || 'Failed to send reset email.');
    else {
      toast.success('Reset link sent! Check your inbox and spam folder.', { duration: 8000 });
      setResetEmail('');
      setShowResetForm(false);
    }
    setIsLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setIsLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Invalid or expired reset link. Please request a new one.');
      navigate('/auth');
      setIsLoading(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) toast.error(error.message ?? 'Failed to update password');
    else {
      toast.success('Password updated! Please log in.');
      await supabase.auth.signOut();
      navigate('/auth');
    }
    setIsLoading(false);
  };

  // ── OTP verification state ───────────────────────────────────────────────────
  const [otpCode, setOtpCode] = useState('');
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpResending, setOtpResending] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  // Cooldown timer
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setTimeout(() => setOtpCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCooldown]);

  // ── Verify signup OTP ───────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) { toast.error('Please enter the 6-digit verification code'); return; }
    setOtpVerifying(true);
    const email = signupEmail.trim().toLowerCase();
    console.log('[Auth] Verifying OTP for:', email, '| Code length:', otpCode.length);

    // Try 'email' type first (standard for email OTP in Supabase v2)
    let result = await supabase.auth.verifyOtp({
      email,
      token: otpCode.trim(),
      type: 'email',
    });

    // If 'email' type fails, try 'signup' type as fallback
    if (result.error) {
      console.log('[Auth] verifyOtp type=email failed:', result.error.message, '| Trying type=signup...');
      result = await supabase.auth.verifyOtp({
        email,
        token: otpCode.trim(),
        type: 'signup',
      });
    }

    if (result.error) {
      console.error('[Auth] verifyOtp failed:', result.error.message, result.error);
      toast.error(result.error.message || 'Invalid or expired code. Please try again.');
    } else {
      console.log('[Auth] OTP verified successfully! Session:', !!result.data.session);
      toast.success('Email verified! Welcome to Vowza! 🎉');
      // User is now logged in — redirect will happen via useEffect
    }
    setOtpVerifying(false);
  };

  // ── Resend signup OTP ───────────────────────────────────────────────────────
  const handleResendOtp = async () => {
    if (otpCooldown > 0) return;
    setOtpResending(true);
    const email = signupEmail.trim().toLowerCase();
    console.log('[Auth] Resending confirmation email to:', email);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) {
      console.error('[Auth] Resend failed:', error.message, error);
      toast.error(error.message || 'Failed to resend code. Please try again.');
    } else {
      console.log('[Auth] Resend successful');
      toast.success('New verification code sent! Check your email.');
      setOtpCooldown(60);
    }
    setOtpResending(false);
  };

  // ── Render: signup OTP verification ─────────────────────────────────────────
  if (signupDone) return (
    <AuthLayout>
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto mb-5">
          <Mail className="w-8 h-8 text-gold-dark" />
        </div>
        <h2 className="text-2xl font-display font-bold text-foreground mb-2">Verify Your Email</h2>
        <p className="text-muted-foreground text-sm mb-1">Enter the 6-digit code sent to</p>
        <p className="font-semibold text-foreground text-sm mb-6">{signupEmail}</p>

        <div className="mb-5">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otpCode}
            onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="• • • • • •"
            className="w-full text-center text-3xl font-bold tracking-[0.5em] py-4 rounded-xl border-2 border-border focus:border-gold focus:ring-2 focus:ring-gold/20 outline-none transition"
            autoFocus
          />
        </div>

        <button
          onClick={handleVerifyOtp}
          disabled={otpCode.length !== 6 || otpVerifying}
          className="btn-primary w-full justify-center py-3 mb-4"
        >
          {otpVerifying ? 'Verifying...' : 'Verify & Continue'}
        </button>

        <button
          onClick={handleResendOtp}
          disabled={otpCooldown > 0 || otpResending}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {otpCooldown > 0 ? `Resend code in ${otpCooldown}s` : otpResending ? 'Sending...' : "Didn't receive the code? Resend"}
        </button>

        <p className="text-xs text-muted-foreground mt-4">Check your spam folder if you don't see the email.</p>

        <button onClick={() => { setSignupDone(false); setOtpCode(''); }} className="text-xs text-muted-foreground hover:text-foreground mt-4 block mx-auto underline">
          Use a different email
        </button>
      </div>
    </AuthLayout>
  );

  // ── Render: reset password (email link mode) ────────────────────────────────
  if (isResetMode) return (
    <AuthLayout>
      <div>
        <div className="w-12 h-12 rounded-2xl bg-maroon/8 flex items-center justify-center mb-5">
          <Lock className="w-6 h-6 text-maroon" />
        </div>
        <h2 className="text-2xl font-display font-bold text-foreground mb-1">Set New Password</h2>
        <p className="text-muted-foreground text-sm mb-7">Enter your new password below.</p>
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label htmlFor="new-password" className="text-xs font-semibold text-foreground block mb-1.5">New Password</label>
            <div className="relative">
              <input
                id="new-password"
                type={showLoginNewPwd ? 'text' : 'password'}
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="input-premium pr-10 w-full"
                autoComplete="new-password"
              />
              <button type="button" tabIndex={-1} onClick={() => setShowLoginNewPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showLoginNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={isLoading} className="btn-primary w-full justify-center py-3">
            {isLoading ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </AuthLayout>
  );

  // ── Render: main auth (login / signup / forgot) ─────────────────────────────
  return (
    <AuthLayout>
      {showResetForm ? (
        /* ── Forgot password ── */
        <div>
          <button
            type="button"
            onClick={() => setShowResetForm(false)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to login
          </button>
          <div className="w-12 h-12 rounded-2xl bg-gold/10 flex items-center justify-center mb-5">
            <Mail className="w-6 h-6 text-gold-dark" />
          </div>
          <h2 className="text-2xl font-display font-bold text-foreground mb-1">Forgot Password?</h2>
          <p className="text-muted-foreground text-sm mb-7">We'll send a reset link to your email.</p>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label htmlFor="reset-email" className="text-xs font-semibold text-foreground block mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="reset-email"
                  type="email"
                  placeholder="your@email.com"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  required
                  className="input-premium pl-10 w-full"
                  autoComplete="email"
                />
              </div>
            </div>
            <button type="submit" disabled={isLoading} className="btn-primary w-full justify-center py-3">
              {isLoading ? 'Sending…' : 'Send Reset Link'} {!isLoading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </div>
      ) : (
        /* ── Login / Signup tabs ── */
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground mb-1">
            {tab === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-muted-foreground text-sm mb-7">
            {tab === 'login' ? 'Sign in to your Vowza account' : 'Join 10,000+ event planners on Vowza'}
          </p>

          {/* Tab switcher */}
          <div className="flex gap-1 p-1 bg-secondary rounded-xl border border-border/50 mb-7">
            <button
              type="button"
              onClick={() => setTab('login')}
              className={cn('flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all',
                tab === 'login' ? 'bg-white dark:bg-gray-900 text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground')}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setTab('signup')}
              className={cn('flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all',
                tab === 'signup' ? 'bg-white dark:bg-gray-900 text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground')}
            >
              Sign Up
            </button>
          </div>

          {/* ── Login form ── */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4" noValidate>
              <div>
                <label htmlFor="login-email" className="text-xs font-semibold text-foreground block mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    id="login-email"
                    type="email"
                    placeholder="your@email.com"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="input-premium pl-10 w-full"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="login-password" className="text-xs font-semibold text-foreground">Password</label>
                  <button
                    type="button"
                    onClick={() => setShowResetForm(true)}
                    className="text-xs font-medium text-maroon hover:opacity-75 transition-opacity"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    id="login-password"
                    type={showLoginPwd ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="input-premium pl-10 pr-10 w-full"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowLoginPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showLoginPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full justify-center py-3 mt-2"
              >
                {isLoading ? 'Signing in…' : 'Sign In'}
                {!isLoading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          )}

          {/* ── Signup form ── */}
          {tab === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4" noValidate>
              <div>
                <label htmlFor="signup-name" className="text-xs font-semibold text-foreground block mb-1.5">Full Name *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    id="signup-name"
                    type="text"
                    placeholder="Your full name"
                    value={signupName}
                    onChange={e => setSignupName(e.target.value)}
                    required
                    autoComplete="name"
                    className="input-premium pl-10 w-full"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="signup-email" className="text-xs font-semibold text-foreground block mb-1.5">Email *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    id="signup-email"
                    type="email"
                    placeholder="your@email.com"
                    value={signupEmail}
                    onChange={e => setSignupEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="input-premium pl-10 w-full"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="signup-phone" className="text-xs font-semibold text-foreground block mb-1.5">
                  Phone *
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    id="signup-phone"
                    type="tel"
                    placeholder="+91 87123 XXXXX"
                    value={signupPhone}
                    onChange={e => setSignupPhone(e.target.value)}
                    required
                    autoComplete="tel"
                    className="input-premium pl-10 w-full"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="signup-password" className="text-xs font-semibold text-foreground block mb-1.5">Password *</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    id="signup-password"
                    type={showSignupPwd ? 'text' : 'password'}
                    placeholder="Min. 6 characters"
                    value={signupPassword}
                    onChange={e => setSignupPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="input-premium pl-10 pr-10 w-full"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowSignupPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSignupPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full justify-center py-3 mt-2"
              >
                {isLoading ? 'Creating account…' : 'Create Account'}
                {!isLoading && <ArrowRight className="w-4 h-4" />}
              </button>

              <p className="text-[11px] text-muted-foreground text-center">
                By signing up you agree to our{' '}
                <Link to="/terms" state={{ from: '/auth', fromLabel: 'Sign Up' }} className="underline hover:text-foreground">Terms of Service</Link> and{' '}
                <Link to="/privacy" state={{ from: '/auth', fromLabel: 'Sign Up' }} className="underline hover:text-foreground">Privacy Policy</Link>.
              </p>
            </form>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Join as artist CTA */}
          <div className="p-4 rounded-2xl bg-surface-2 border border-border/60">
            <p className="text-xs text-muted-foreground mb-2.5">Want to offer your services?</p>
            <Link to="/provider/register" className="flex items-center justify-between gap-2 text-sm font-semibold text-foreground hover:text-maroon transition-colors">
              <span>Join as an Artist — Free</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </AuthLayout>
  );
};

export default Auth;
