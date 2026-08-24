# Supabase Authentication Settings Configuration

## Environment Variables (✅ Verified)

Current `.env` configuration:
```
VITE_SUPABASE_PROJECT_ID=vavfeataqwwbpjonknne
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_Kd62nZ1jG5OHiCZaBjmMuw_CcZFYUWI
VITE_SUPABASE_URL=https://vavfeataqwwbpjonknne.supabase.co
```

**Status:** ✅ Environment variables are correctly configured for local development.

## Required Supabase Dashboard Settings

### 1. Authentication Settings

Navigate to: **Project → Authentication → Providers → Email**

**Email Provider Settings:**
- [x] Enable Email provider: **ENABLED**
- [x] Confirm email: **ENABLED** (recommended for security)
- [x] Double opt-in: **ENABLED** (recommended)
- [x] Secure email change: **ENABLED**

**SMTP Configuration:**
- [x] Use custom SMTP: **DISABLED** (use Supabase default for development)
- [x] Sender email: Set to your domain email (e.g., `noreply@yourdomain.com`)
- [x] Sender name: Set to your app name (e.g., "Vowza")

### 2. Site URL and Redirect URLs

Navigate to: **Project → Authentication → URL Configuration**

**Site URL:**
```
http://localhost:8080
```

**Redirect URLs (Add all of these):**
```
http://localhost:8080/**
http://localhost:8080/auth
http://localhost:8080/auth?mode=reset
http://localhost:8080/auth?mode=signup
http://localhost:5173/**
http://localhost:5173/auth
http://localhost:5173/auth?mode=reset
http://localhost:5173/auth?mode=signup
```

**Production URLs (for Vercel deployment):**
```
https://your-domain.com/**
https://your-domain.com/auth
https://your-domain.com/auth?mode=reset
https://your-domain.com/auth?mode=signup
```

### 3. Password Recovery Settings

Navigate to: **Project → Authentication → Providers → Email → Password Recovery**

**Settings:**
- [x] Enable password recovery: **ENABLED**
- [x] Password recovery email template: Verify template is configured
- [x] Redirect URL: Should match one of the redirect URLs above

### 4. Email Confirmation Settings

Navigate to: **Project → Authentication → Providers → Email → Email Confirmation**

**Settings:**
- [x] Enable email confirmation: **ENABLED**
- [x] Confirmation email template: Verify template is configured
- [x] Redirect URL: Should be your site URL (`http://localhost:8080`)

### 5. User Management Settings

Navigate to: **Project → Authentication → Users**

**Settings:**
- [x] Allow new users to sign up: **ENABLED**
- [x] Require email confirmation: **ENABLED** (recommended)
- [x] Enable user deletion: **ENABLED** (optional)

### 6. Rate Limiting (Optional but Recommended)

Navigate to: **Project → Authentication → Rate Limiting**

**Settings:**
- [x] Enable rate limiting: **ENABLED**
- [x] Max requests per minute: Set to reasonable limit (e.g., 10-20)
- [x] Block duration: Set to reasonable duration (e.g., 15 minutes)

## Testing Checklist

### Login Flow
- [ ] Enter correct email and password → Should log in successfully
- [ ] Enter incorrect password → Should show "Incorrect email or password"
- [ ] Enter unregistered email → Should show "No account found with this email"
- [ ] Enter unconfirmed email → Should show "Please check your email and confirm your account"
- [ ] Check console for `[Auth] Login attempt` and `[Auth] Login successful/error` logs

### Signup Flow
- [ ] Enter valid details → Should send confirmation email
- [ ] Enter existing email → Should show "This email is already registered"
- [ ] Enter short password → Should show "Password must be at least 6 characters"
- [ ] Check console for `[Auth] Signup attempt` and `[Auth] Signup successful/error` logs

### Forgot Password Flow
- [ ] Enter email → Should show "Password reset link sent! Check your inbox"
- [ ] Should NOT redirect immediately after sending
- [ ] Check console for `[Auth] Password reset requested` and `[Auth] Password reset email sent` logs
- [ ] Check email inbox for reset link
- [ ] Click reset link → Should navigate to `/auth?mode=reset`
- [ ] Enter new password → Should show "Password updated! You can now log in"
- [ ] Should sign out and redirect to login
- [ ] Login with new password → Should work

### Reset Password Flow
- [ ] Navigate to `/auth?mode=reset` without valid session → Should show "Invalid or expired reset link"
- [ ] Navigate with valid session → Should show password form
- [ ] Enter short password → Should show "Password must be at least 6 characters"
- [ ] Enter valid password → Should update successfully
- [ ] Check console for `[Auth] Attempting to update password` and `[Auth] Password updated successfully` logs

## Common Issues and Solutions

### Issue: "Incorrect password" with correct credentials

**Possible Causes:**
1. Email case sensitivity - **FIXED**: Now normalizes to lowercase
2. User not confirmed - Check if email confirmation is enabled
3. Wrong password - Verify password in Supabase Dashboard

**Solution:**
- Check console logs for exact error message
- Verify user is confirmed in Supabase Dashboard
- Reset password via email if needed

### Issue: No password reset email received

**Possible Causes:**
1. Redirect URL not configured in Supabase Dashboard
2. SMTP not configured
3. Email in spam folder
4. Email confirmation required but not completed

**Solution:**
- Add redirect URLs in Supabase Dashboard
- Check spam folder
- Verify email is confirmed

### Issue: "Invalid or expired reset link"

**Possible Causes:**
1. Reset link expired (default 1 hour)
2. Session lost
3. Redirect URL mismatch

**Solution:**
- Request new password reset
- Verify redirect URLs match exactly
- Check console for session errors

### Issue: Email not confirmed after signup

**Possible Causes:**
1. Email confirmation disabled
2. Confirmation email not sent
3. Confirmation link expired

**Solution:**
- Enable email confirmation in Supabase Dashboard
- Check spam folder
- Request new confirmation email

## Debugging Commands

### Check Current Session
```javascript
// In browser console
supabase.auth.getSession()
```

### Check Current User
```javascript
// In browser console
supabase.auth.getUser()
```

### Sign Out
```javascript
// In browser console
supabase.auth.signOut()
```

### Reset Password Manually
```javascript
// In browser console (requires valid session)
supabase.auth.updateUser({ password: 'newpassword' })
```

## Production Deployment Checklist

Before deploying to Vercel:

- [ ] Update environment variables in Vercel dashboard
- [ ] Add production redirect URLs in Supabase Dashboard
- [ ] Update site URL in Supabase Dashboard
- [ ] Configure custom SMTP for production emails
- [ ] Enable email confirmation in production
- [ ] Test complete auth flow on production domain
- [ ] Set up email templates with your branding
- [ ] Configure rate limiting for production
- [ ] Enable audit logging
- [ ] Set up monitoring for auth failures

## Security Best Practices

1. **Always use HTTPS in production**
2. **Enable email confirmation** to prevent fake accounts
3. **Use strong password requirements** (minimum 8 characters, mixed case, numbers)
4. **Enable rate limiting** to prevent brute force attacks
5. **Monitor failed login attempts** in Supabase Dashboard
6. **Use custom SMTP** for production to avoid email deliverability issues
7. **Set up audit logging** to track suspicious activity
8. **Implement session timeout** (already done with inactivity logout)
9. **Never expose service role key** in client-side code
10. **Use environment variables** for all sensitive configuration
