-- ============================================================
-- Vowza Booking Execution Lifecycle
-- Rapido/Swiggy-style: OTP Start Verification + Work Completion + Settlement
-- ============================================================

-- 1. Booking Start OTPs table
CREATE TABLE IF NOT EXISTS public.booking_start_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL,
  booking_table TEXT NOT NULL,
  vendor_id TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES auth.users(id),
  otp_hash TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'booking_start' CHECK (purpose = 'booking_start'),
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  resend_count INT NOT NULL DEFAULT 0,
  max_resends INT NOT NULL DEFAULT 3,
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  verified_by UUID,
  sms_sent BOOLEAN DEFAULT false,
  sms_sent_at TIMESTAMPTZ,
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  admin_notified BOOLEAN DEFAULT false,
  admin_notified_at TIMESTAMPTZ,
  invalidated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_otp_booking ON public.booking_start_otps(booking_id);
CREATE INDEX idx_booking_otp_customer ON public.booking_start_otps(customer_id);
CREATE INDEX idx_booking_otp_vendor ON public.booking_start_otps(vendor_id);
CREATE INDEX idx_booking_otp_active ON public.booking_start_otps(booking_id, verified, invalidated, expires_at);

ALTER TABLE public.booking_start_otps ENABLE ROW LEVEL SECURITY;

-- Vendor can see OTP records for their bookings (not the hash)
CREATE POLICY "vendor_select_own_otps" ON public.booking_start_otps
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id::text = vendor_id AND pp.user_id = auth.uid())
);

-- Customer can see OTP records for their bookings
CREATE POLICY "customer_select_own_otps" ON public.booking_start_otps
FOR SELECT USING (customer_id = auth.uid());

-- Admin can see all
CREATE POLICY "admin_select_all_otps" ON public.booking_start_otps
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin'))
);

-- System (authenticated) can insert OTPs
CREATE POLICY "authenticated_insert_otps" ON public.booking_start_otps
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- System can update OTPs (for verification attempts)
CREATE POLICY "authenticated_update_otps" ON public.booking_start_otps
FOR UPDATE USING (auth.uid() IS NOT NULL);

-- 2. Vendor Settlements table
CREATE TABLE IF NOT EXISTS public.vendor_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL,
  booking_table TEXT NOT NULL,
  vendor_id TEXT NOT NULL,
  vendor_user_id UUID NOT NULL REFERENCES auth.users(id),
  customer_id UUID NOT NULL REFERENCES auth.users(id),
  booking_amount NUMERIC(12,2) NOT NULL,
  platform_fee_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  platform_fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  vendor_earnings NUMERIC(12,2) NOT NULL DEFAULT 0,
  advance_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  remaining_due NUMERIC(12,2) NOT NULL DEFAULT 0,
  settlement_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (settlement_status IN ('pending', 'processing', 'settled', 'failed', 'disputed')),
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_settlement_booking ON public.vendor_settlements(booking_id);
CREATE INDEX idx_settlement_vendor ON public.vendor_settlements(vendor_id);
CREATE INDEX idx_settlement_status ON public.vendor_settlements(settlement_status);

ALTER TABLE public.vendor_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor_select_own_settlements" ON public.vendor_settlements
FOR SELECT USING (vendor_user_id = auth.uid());

CREATE POLICY "customer_select_own_settlements" ON public.vendor_settlements
FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "admin_select_all_settlements" ON public.vendor_settlements
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin'))
);

CREATE POLICY "authenticated_insert_settlements" ON public.vendor_settlements
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_update_settlements" ON public.vendor_settlements
FOR UPDATE USING (auth.uid() IS NOT NULL);

-- 3. Add execution lifecycle columns to all booking tables
-- These track the work-start and completion flow
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'bookings', 'singer_bookings', 'dancer_bookings', 'videography_bookings',
      'drone_bookings', 'dj_bookings', 'decorator_bookings', 'makeup_bookings',
      'mehendi_bookings', 'anchor_bookings', 'band_bookings', 'priest_bookings',
      'water_bookings', 'rental_bookings', 'banquet_bookings', 'catering_bookings',
      'photography_package_bookings'
    ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS start_requested_at TIMESTAMPTZ', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS otp_verified_at TIMESTAMPTZ', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS work_started_at TIMESTAMPTZ', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS work_completed_at TIMESTAMPTZ', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS settlement_status TEXT DEFAULT ''none''', tbl);
  END LOOP;
END $$;

-- 4. Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_start_otps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vendor_settlements;
