-- Drop overly permissive policies and restrict OTP tables to authenticated service role only
DROP POLICY IF EXISTS "Service role can manage OTP" ON public.otp_verifications;
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.otp_rate_limits;

-- OTP tables should have no direct access - only via edge functions with service role
-- These policies restrict to service_role which is used by edge functions
CREATE POLICY "No direct access to OTP"
ON public.otp_verifications FOR ALL
USING (false);

CREATE POLICY "No direct access to rate limits"
ON public.otp_rate_limits FOR ALL
USING (false);