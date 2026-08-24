-- ============================================================
-- VOWZA V2 CATCH-UP MIGRATION
-- Upgrades original schema to V2. Idempotent — safe on fresh
-- project OR one with the original migration already applied.
-- Run in Supabase SQL Editor after FINAL_MIGRATION_V4.sql
-- OR as a standalone upgrade migration.
-- ============================================================
-- PART 1: EXTEND profession_type ENUM
-- Cannot ALTER ENUM in a transaction on Supabase easily,
-- so we recreate with IF NOT EXISTS guard using a DO block.
-- ============================================================
DO $$
BEGIN
  -- Add missing values one by one (safe if already exists)
  BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'music_band';         EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'traditional_band';   EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'maharashtra_band';   EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'singer';             EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'instrumental_artist';EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'classical_musician'; EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'photographer';       EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'videographer';       EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'cinematographer';    EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'drone_operator';     EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'dancer';             EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'choreographer';      EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'event_decorator';    EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'wedding_decorator';  EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'stage_decorator';    EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'makeup_artist';      EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'mehendi_artist';     EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'anchor';             EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'host';               EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'magician';           EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'stand_up_comedian';  EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'celebrity_artist';   EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'live_performer';     EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'folk_artist';        EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'lighting_services';  EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'sound_services';     EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'event_planner';      EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'wedding_planner';    EXCEPTION WHEN others THEN NULL; END;
  BEGIN ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'catering_services';  EXCEPTION WHEN others THEN NULL; END;
END $$;

-- ============================================================
-- PART 2: ADD MISSING COLUMNS TO EXISTING TABLES
-- ============================================================

-- profiles — add all V2 columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS state               TEXT,
  ADD COLUMN IF NOT EXISTS address             TEXT,
  ADD COLUMN IF NOT EXISTS organization_name   TEXT,
  ADD COLUMN IF NOT EXISTS phone_verified      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS date_of_birth       DATE,
  ADD COLUMN IF NOT EXISTS alternate_phone     TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_enabled    BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS email_notifications_enabled  BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sms_notifications_enabled    BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS push_notifications_enabled   BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS profile_completion_percentage INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_active_at      TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS is_active           BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS account_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS preferences         JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS metadata            JSONB DEFAULT '{}';

-- provider_profiles — add all V2 columns
ALTER TABLE public.provider_profiles
  ADD COLUMN IF NOT EXISTS stage_name          TEXT,
  ADD COLUMN IF NOT EXISTS cover_image_url     TEXT,
  ADD COLUMN IF NOT EXISTS cover_banner_url    TEXT,
  ADD COLUMN IF NOT EXISTS languages           TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pricing_type        TEXT DEFAULT 'per_event',
  ADD COLUMN IF NOT EXISTS category_details    JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS performance_type    TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS instagram           TEXT,
  ADD COLUMN IF NOT EXISTS facebook            TEXT,
  ADD COLUMN IF NOT EXISTS youtube             TEXT,
  ADD COLUMN IF NOT EXISTS website             TEXT,
  ADD COLUMN IF NOT EXISTS gst_number          TEXT,
  ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending'
    CHECK (verification_status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS rejection_reason    TEXT,
  ADD COLUMN IF NOT EXISTS verified_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS travel_charges      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_charges       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS available_dates     DATE[],
  ADD COLUMN IF NOT EXISTS bank_account_holder TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_ifsc           TEXT,
  ADD COLUMN IF NOT EXISTS bank_name           TEXT,
  ADD COLUMN IF NOT EXISTS branch_name         TEXT,
  ADD COLUMN IF NOT EXISTS is_bank_verified    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_featured         BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS featured_until      TIMESTAMPTZ;

-- bookings — add invoice columns
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS invoice_number       TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS invoice_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invoice_url          TEXT,
  ADD COLUMN IF NOT EXISTS customer_notes       TEXT,
  ADD COLUMN IF NOT EXISTS provider_notes       TEXT;

-- provider_availability — add extra columns
ALTER TABLE public.provider_availability
  ADD COLUMN IF NOT EXISTS time_slot_start TIME,
  ADD COLUMN IF NOT EXISTS time_slot_end   TIME,
  ADD COLUMN IF NOT EXISTS slot_type       TEXT DEFAULT 'unavailable'
    CHECK (slot_type IN ('available','unavailable','busy'));

-- ============================================================
-- PART 3: NEW TABLES (all IF NOT EXISTS)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  sender_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  is_read    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint  TEXT NOT NULL,
  p256dh    TEXT NOT NULL,
  auth      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);

CREATE TABLE IF NOT EXISTS public.refresh_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  device_info  JSONB,
  ip_address   INET,
  expires_at   TIMESTAMPTZ NOT NULL,
  is_revoked   BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone          TEXT NOT NULL,
  ip_address     INET,
  user_agent     TEXT,
  attempt_type   TEXT NOT NULL CHECK (attempt_type IN ('otp_request','otp_verify','login')),
  success        BOOLEAN NOT NULL,
  failure_reason TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.otp_verifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      TEXT NOT NULL,
  otp_hash   TEXT NOT NULL,
  purpose    TEXT NOT NULL,
  attempts   INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  verified   BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.otp_rate_limits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         TEXT NOT NULL,
  ip_address    TEXT,
  request_count INTEGER DEFAULT 1,
  window_start  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notification_settings (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  sms_enabled              BOOLEAN DEFAULT TRUE,
  email_enabled            BOOLEAN DEFAULT TRUE,
  push_enabled             BOOLEAN DEFAULT TRUE,
  booking_notifications    BOOLEAN DEFAULT TRUE,
  payment_notifications    BOOLEAN DEFAULT TRUE,
  marketing_notifications  BOOLEAN DEFAULT FALSE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id),
  action     TEXT NOT NULL,
  table_name TEXT,
  record_id  UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.artist_categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL UNIQUE,
  profession_type profession_type NOT NULL UNIQUE,
  description     TEXT,
  icon            TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pricing_packages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  price       INTEGER NOT NULL,
  duration    TEXT,
  description TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.provider_time_slots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider_id, day_of_week, start_time, end_time)
);

CREATE TABLE IF NOT EXISTS public.favorites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provider_id)
);

CREATE TABLE IF NOT EXISTS public.featured_artists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  featured_by UUID REFERENCES auth.users(id),
  featured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id     UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  customer_id    UUID NOT NULL REFERENCES auth.users(id),
  provider_id    UUID NOT NULL REFERENCES public.provider_profiles(id),
  amount         INTEGER NOT NULL,
  platform_fee   INTEGER NOT NULL,
  total_amount   INTEGER NOT NULL,
  status         TEXT DEFAULT 'paid' CHECK (status IN ('pending','paid','cancelled')),
  generated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at        TIMESTAMPTZ,
  invoice_url    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bank_details (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id  UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  bank_name    TEXT NOT NULL,
  account_number TEXT NOT NULL,
  ifsc_code    TEXT NOT NULL,
  upi_id       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.platform_analytics (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date               DATE NOT NULL,
  total_bookings     INTEGER DEFAULT 0,
  total_revenue      INTEGER DEFAULT 0,
  total_commission   INTEGER DEFAULT 0,
  active_providers   INTEGER DEFAULT 0,
  active_customers   INTEGER DEFAULT 0,
  new_registrations  INTEGER DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (date)
);

CREATE TABLE IF NOT EXISTS public.commission_tracking (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  provider_id      UUID NOT NULL REFERENCES public.provider_profiles(id),
  booking_amount   INTEGER NOT NULL,
  commission_rate  INTEGER NOT NULL DEFAULT 5,
  commission_amount INTEGER NOT NULL,
  status           TEXT DEFAULT 'pending' CHECK (status IN ('pending','collected','paid')),
  collected_at     TIMESTAMPTZ,
  paid_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.worker_profiles (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  phone                       TEXT NOT NULL,
  full_name                   TEXT NOT NULL,
  email                       TEXT,
  gender                      TEXT,
  profile_photo_url           TEXT,
  service_type                TEXT NOT NULL,
  experience_years            INTEGER DEFAULT 0,
  service_city                TEXT,
  service_area                TEXT,
  government_id_type          TEXT,
  government_id_url           TEXT,
  address_proof_url           TEXT,
  bank_account_number         TEXT,
  bank_ifsc                   TEXT,
  bank_account_holder         TEXT,
  portfolio_urls              TEXT[] DEFAULT '{}',
  verification_status         TEXT DEFAULT 'pending'
    CHECK (verification_status IN ('pending','under_review','approved','rejected')),
  verified_at                 TIMESTAMPTZ,
  verified_by                 UUID,
  rejection_reason            TEXT,
  date_of_birth               DATE,
  alternate_phone             TEXT,
  whatsapp_enabled            BOOLEAN DEFAULT TRUE,
  background_check_completed  BOOLEAN DEFAULT FALSE,
  training_completed          BOOLEAN DEFAULT FALSE,
  onboarded_at                TIMESTAMPTZ,
  rejected_at                 TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.worker_documents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id           UUID NOT NULL REFERENCES public.worker_profiles(user_id) ON DELETE CASCADE,
  document_type       TEXT NOT NULL CHECK (document_type IN
    ('government_id','address_proof','bank_details','portfolio','certification','photo')),
  document_url        TEXT NOT NULL,
  document_number     TEXT,
  issued_date         DATE,
  expiry_date         DATE,
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','rejected')),
  rejection_reason    TEXT,
  uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at         TIMESTAMPTZ,
  verified_by         UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.worker_bank_accounts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id            UUID NOT NULL REFERENCES public.worker_profiles(user_id) ON DELETE CASCADE,
  account_holder_name  TEXT NOT NULL,
  account_number       TEXT NOT NULL,
  bank_name            TEXT NOT NULL,
  ifsc_code            TEXT NOT NULL,
  branch_name          TEXT,
  is_verified          BOOLEAN DEFAULT FALSE,
  verification_ref_id  TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sequence for invoice numbers
CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1;

-- ============================================================
-- PART 4: INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_messages_booking_id   ON public.messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at   ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_favorites_user        ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_provider    ON public.favorites(provider_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer     ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_booking      ON public.invoices(booking_id);
CREATE INDEX IF NOT EXISTS idx_platform_analytics_date ON public.platform_analytics(date);
CREATE INDEX IF NOT EXISTS idx_commission_booking    ON public.commission_tracking(booking_id);
CREATE INDEX IF NOT EXISTS idx_commission_status     ON public.commission_tracking(status);
CREATE INDEX IF NOT EXISTS idx_worker_user           ON public.worker_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_worker_status         ON public.worker_profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_worker_docs_worker    ON public.worker_documents(worker_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user        ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created     ON public.audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_otp_phone_expires     ON public.otp_verifications(phone, expires_at);
CREATE INDEX IF NOT EXISTS idx_rate_limit_phone      ON public.otp_rate_limits(phone, window_start);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user   ON public.refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON public.refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_phone  ON public.login_attempts(phone);

-- ============================================================
-- PART 5: FUNCTIONS
-- ============================================================

-- update_updated_at_column (already exists — CREATE OR REPLACE is safe)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

-- generate_invoice_number
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_num TEXT;
BEGIN
  v_num := 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('invoice_seq')::TEXT, 6, '0');
  RETURN v_num;
END; $$;

-- update_daily_analytics
CREATE OR REPLACE FUNCTION public.update_daily_analytics()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.platform_analytics (date, total_bookings, total_revenue, total_commission)
  VALUES (CURRENT_DATE, 1, NEW.amount, ROUND(NEW.amount * 0.05))
  ON CONFLICT (date) DO UPDATE SET
    total_bookings  = platform_analytics.total_bookings  + 1,
    total_revenue   = platform_analytics.total_revenue   + NEW.amount,
    total_commission = platform_analytics.total_commission + ROUND(NEW.amount * 0.05);
  RETURN NEW;
END; $$;

-- ============================================================
-- PART 6: TRIGGERS (all idempotent via DROP IF EXISTS first)
-- ============================================================

DROP TRIGGER IF EXISTS update_notification_settings_updated_at ON public.notification_settings;
CREATE TRIGGER update_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_pricing_packages_updated_at ON public.pricing_packages;
CREATE TRIGGER update_pricing_packages_updated_at
  BEFORE UPDATE ON public.pricing_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_bank_details_updated_at ON public.bank_details;
CREATE TRIGGER update_bank_details_updated_at
  BEFORE UPDATE ON public.bank_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_worker_profiles_updated_at ON public.worker_profiles;
CREATE TRIGGER update_worker_profiles_updated_at
  BEFORE UPDATE ON public.worker_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_analytics_on_booking ON public.bookings;
CREATE TRIGGER update_analytics_on_booking
  AFTER INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_daily_analytics();

-- ============================================================
-- PART 7: ENABLE RLS ON ALL NEW TABLES
-- ============================================================
DO $$
DECLARE v_tbl TEXT;
BEGIN
  FOR v_tbl IN SELECT unnest(ARRAY[
    'messages','push_subscriptions','refresh_tokens','login_attempts',
    'otp_verifications','otp_rate_limits','notification_settings','audit_log',
    'worker_profiles','worker_documents','worker_bank_accounts',
    'artist_categories','pricing_packages','provider_time_slots',
    'favorites','featured_artists','invoices','bank_details',
    'platform_analytics','commission_tracking'
  ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_tbl);
  END LOOP;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================
-- PART 8: RLS POLICIES ON NEW TABLES
-- ============================================================

-- messages
DROP POLICY IF EXISTS "Booking participants can view messages" ON public.messages;
CREATE POLICY "Booking participants can view messages" ON public.messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id
    AND (b.customer_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.provider_profiles pp WHERE pp.id = b.provider_id AND pp.user_id = auth.uid())))
);
DROP POLICY IF EXISTS "Booking participants can send messages" ON public.messages;
CREATE POLICY "Booking participants can send messages" ON public.messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id
    AND (b.customer_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.provider_profiles pp WHERE pp.id = b.provider_id AND pp.user_id = auth.uid())))
);

-- favorites
DROP POLICY IF EXISTS "Users can manage own favorites" ON public.favorites;
CREATE POLICY "Users can manage own favorites" ON public.favorites FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Everyone can view favorites" ON public.favorites;
CREATE POLICY "Everyone can view favorites" ON public.favorites FOR SELECT USING (true);

-- invoices
DROP POLICY IF EXISTS "Users can view own invoices" ON public.invoices;
CREATE POLICY "Users can view own invoices" ON public.invoices FOR SELECT USING (
  auth.uid() = customer_id OR EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid())
);

-- notification_settings
DROP POLICY IF EXISTS "Users manage own notification settings" ON public.notification_settings;
CREATE POLICY "Users manage own notification settings" ON public.notification_settings FOR ALL USING (auth.uid() = user_id);

-- pricing_packages
DROP POLICY IF EXISTS "Everyone can view pricing packages" ON public.pricing_packages;
CREATE POLICY "Everyone can view pricing packages" ON public.pricing_packages FOR SELECT USING (true);
DROP POLICY IF EXISTS "Providers manage own pricing packages" ON public.pricing_packages;
CREATE POLICY "Providers manage own pricing packages" ON public.pricing_packages FOR ALL USING (
  EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid())
);

-- provider_time_slots
DROP POLICY IF EXISTS "Everyone can view time slots" ON public.provider_time_slots;
CREATE POLICY "Everyone can view time slots" ON public.provider_time_slots FOR SELECT USING (true);
DROP POLICY IF EXISTS "Providers manage own time slots" ON public.provider_time_slots;
CREATE POLICY "Providers manage own time slots" ON public.provider_time_slots FOR ALL USING (
  EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid())
);

-- artist_categories
DROP POLICY IF EXISTS "Everyone can view artist categories" ON public.artist_categories;
CREATE POLICY "Everyone can view artist categories" ON public.artist_categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage artist categories" ON public.artist_categories;
CREATE POLICY "Admins manage artist categories" ON public.artist_categories FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- bank_details
DROP POLICY IF EXISTS "Providers manage own bank details" ON public.bank_details;
CREATE POLICY "Providers manage own bank details" ON public.bank_details FOR ALL USING (
  EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid())
);

-- worker_profiles
DROP POLICY IF EXISTS "Workers view own profile" ON public.worker_profiles;
CREATE POLICY "Workers view own profile" ON public.worker_profiles FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Workers update own profile" ON public.worker_profiles;
CREATE POLICY "Workers update own profile" ON public.worker_profiles FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Workers insert own profile" ON public.worker_profiles;
CREATE POLICY "Workers insert own profile" ON public.worker_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins view all workers" ON public.worker_profiles;
CREATE POLICY "Admins view all workers" ON public.worker_profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- push_subscriptions
DROP POLICY IF EXISTS "Users manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users manage own push subscriptions" ON public.push_subscriptions FOR ALL USING (auth.uid() = user_id);

-- login_attempts / otp_verifications / otp_rate_limits
DROP POLICY IF EXISTS "Service can insert login attempts" ON public.login_attempts;
CREATE POLICY "Service can insert login attempts" ON public.login_attempts FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users insert OTP" ON public.otp_verifications;
CREATE POLICY "Users insert OTP" ON public.otp_verifications FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users select OTP" ON public.otp_verifications;
CREATE POLICY "Users select OTP" ON public.otp_verifications FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users update OTP" ON public.otp_verifications;
CREATE POLICY "Users update OTP" ON public.otp_verifications FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Service insert rate limits" ON public.otp_rate_limits;
CREATE POLICY "Service insert rate limits" ON public.otp_rate_limits FOR INSERT WITH CHECK (true);

-- platform_analytics / commission_tracking
DROP POLICY IF EXISTS "Everyone can view analytics" ON public.platform_analytics;
CREATE POLICY "Everyone can view analytics" ON public.platform_analytics FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage analytics" ON public.platform_analytics;
CREATE POLICY "Admins manage analytics" ON public.platform_analytics FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "Admins manage commissions" ON public.commission_tracking;
CREATE POLICY "Admins manage commissions" ON public.commission_tracking FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
DROP POLICY IF EXISTS "Providers view own commissions" ON public.commission_tracking;
CREATE POLICY "Providers view own commissions" ON public.commission_tracking FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid())
);

-- ============================================================
-- PART 9: SEED DATA
-- ============================================================

-- Extra event types (original 8 already seeded by V1 migration)
INSERT INTO public.event_types (name, icon) VALUES
  ('Haldi Ceremony',    'sun'),
  ('Mehendi Night',     'sparkles'),
  ('Sangeet Night',     'music'),
  ('Engagement',        'ring'),
  ('House Warming',     'home'),
  ('Baby Shower',       'baby'),
  ('College Fest',      'graduation-cap'),
  ('Concert',           'mic'),
  ('DJ Night',          'disc-3'),
  ('Private Party',     'party-popper'),
  ('Temple Event',      'sparkles'),
  ('Charity Event',     'heart-handshake'),
  ('Product Launch',    'rocket'),
  ('Fashion Show',      'sparkles')
ON CONFLICT (name) DO NOTHING;

-- Artist categories
INSERT INTO public.artist_categories (name, profession_type, description, icon, sort_order) VALUES
  ('Music Bands',         'music_band',           'Live bands for weddings and events',          'music',      1),
  ('Traditional Bands',   'traditional_band',     'Traditional Indian bands',                    'music',      2),
  ('Maharashtra Bands',   'maharashtra_band',     'Regional Maharashtra bands',                  'music',      3),
  ('DJs',                 'dj',                   'Professional DJs for all events',             'disc3',      4),
  ('Singers',             'singer',               'Vocal artists and singers',                   'mic2',       5),
  ('Instrumental Artists','instrumental_artist',  'Musicians playing instruments',               'music',      6),
  ('Classical Musicians', 'classical_musician',   'Traditional classical artists',               'music',      7),
  ('Photographers',       'photographer',         'Professional photography services',           'camera',     8),
  ('Videographers',       'videographer',         'Video recording and editing',                 'video',      9),
  ('Cinematographers',    'cinematographer',      'Cinematic video production',                  'video',     10),
  ('Drone Operators',     'drone_operator',       'Aerial photography and videography',          'plane',     11),
  ('Dancers',             'dancer',               'Professional dance performers',               'users',     12),
  ('Choreographers',      'choreographer',        'Dance choreography services',                 'users',     13),
  ('Kuchipudi Dancers',   'kuchipudi_dancer',     'Traditional Kuchipudi dance',                 'users',     14),
  ('Classical Dancers',   'classical_dancer',     'Classical dance forms',                       'users',     15),
  ('Western Dancers',     'western_dancer',       'Western dance styles',                        'users',     16),
  ('Event Decorators',    'event_decorator',      'Event decoration services',                   'palette',   17),
  ('Wedding Decorators',  'wedding_decorator',    'Wedding decoration specialists',              'palette',   18),
  ('Stage Decorators',    'stage_decorator',      'Stage and set decoration',                    'palette',   19),
  ('Makeup Artists',      'makeup_artist',        'Professional makeup services',                'sparkles',  20),
  ('Mehendi Artists',     'mehendi_artist',       'Mehendi design specialists',                  'sparkles',  21),
  ('Anchors',             'anchor',               'Event anchors and emcees',                    'mic2',      22),
  ('Hosts',               'host',                 'Event hosts and presenters',                  'mic2',      23),
  ('Magicians',           'magician',             'Magic show performers',                       'sparkles',  24),
  ('Stand-up Comedians',  'stand_up_comedian',    'Comedy entertainers',                         'mic2',      25),
  ('Celebrity Artists',   'celebrity_artist',     'Celebrity performers',                        'star',      26),
  ('Live Performers',     'live_performer',       'Various live performances',                   'music',     27),
  ('Folk Artists',        'folk_artist',          'Traditional folk performers',                 'music',     28),
  ('Lighting Services',   'lighting_services',    'Event lighting and effects',                  'lightbulb', 29),
  ('Sound Services',      'sound_services',       'Sound system and audio services',             'volume2',   30),
  ('Event Planners',      'event_planner',        'Complete event planning',                     'calendar',  31),
  ('Wedding Planners',    'wedding_planner',      'Wedding planning services',                   'heart',     32),
  ('Catering Services',   'catering_services',    'Food and catering services',                  'utensils',  33),
  ('Event Support',       'event_support',        'General event support staff',                 'users',     34)
ON CONFLICT (profession_type) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  icon        = EXCLUDED.icon,
  sort_order  = EXCLUDED.sort_order;

-- ============================================================
-- PART 10: REALTIME
-- ============================================================
DO $$
DECLARE v_tbl TEXT;
BEGIN
  FOR v_tbl IN SELECT unnest(ARRAY['bookings','notifications','messages'])
  LOOP
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = v_tbl)
      THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_tbl);
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;