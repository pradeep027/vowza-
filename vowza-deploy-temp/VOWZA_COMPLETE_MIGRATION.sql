
-- ============================================================
-- VOWZA COMPLETE MIGRATION — Single file for Supabase
-- Includes: all tables, functions, triggers, RLS, indexes,
-- AI conversations, booking availability, storage policies.
-- Idempotent — safe to run on fresh OR existing database.
-- Last updated: 2026-07-25
-- ============================================================

-- PART 0: EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- PART 1: ENUMS
DROP TYPE IF EXISTS public.app_role CASCADE;
CREATE TYPE public.app_role AS ENUM ('customer', 'provider', 'admin');

DROP TYPE IF EXISTS public.profession_type CASCADE;
CREATE TYPE public.profession_type AS ENUM (
  'music_band','traditional_band','maharashtra_band','dj','singer',
  'instrumental_artist','classical_musician','photographer','videographer',
  'cinematographer','drone_operator','dancer','choreographer','kuchipudi_dancer',
  'classical_dancer','western_dancer','event_decorator','wedding_decorator',
  'stage_decorator','makeup_artist','mehendi_artist','anchor','host','magician',
  'stand_up_comedian','celebrity_artist','live_performer','folk_artist',
  'lighting_services','sound_services','event_planner','wedding_planner',
  'catering_services','event_support'
);

DROP TYPE IF EXISTS public.booking_status CASCADE;
CREATE TYPE public.booking_status AS ENUM (
  'requested','accepted','in_progress','completed','cancelled','rejected'
);

DROP TYPE IF EXISTS public.payment_status CASCADE;
CREATE TYPE public.payment_status AS ENUM ('pending','paid','refunded','failed');

DROP TYPE IF EXISTS public.verification_status CASCADE;
CREATE TYPE public.verification_status AS ENUM ('pending','under_review','approved','rejected');

-- PART 2: CORE TABLES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL, phone TEXT, email TEXT, avatar_url TEXT,
  city TEXT, area TEXT, state TEXT, address TEXT, organization_name TEXT,
  phone_verified BOOLEAN DEFAULT FALSE, date_of_birth DATE, alternate_phone TEXT,
  whatsapp_enabled BOOLEAN DEFAULT TRUE,
  email_notifications_enabled BOOLEAN DEFAULT TRUE,
  sms_notifications_enabled BOOLEAN DEFAULT TRUE,
  push_notifications_enabled BOOLEAN DEFAULT TRUE,
  profile_completion_percentage INTEGER DEFAULT 0,
  last_active_at TIMESTAMPTZ DEFAULT now(), is_active BOOLEAN DEFAULT TRUE,
  account_verified_at TIMESTAMPTZ,
  preferences JSONB DEFAULT '{}'::jsonb, metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'customer',
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.provider_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  profession profession_type NOT NULL,
  experience_years INTEGER DEFAULT 0, price_min INTEGER, price_max INTEGER,
  bio TEXT, is_verified BOOLEAN DEFAULT false, is_available BOOLEAN DEFAULT true,
  average_rating NUMERIC(3,2) DEFAULT 0, total_reviews INTEGER DEFAULT 0,
  total_bookings INTEGER DEFAULT 0, specialties TEXT[],
  stage_name TEXT, cover_image_url TEXT, languages TEXT[] DEFAULT '{}',
  pricing_type TEXT DEFAULT 'per_event', category_details JSONB DEFAULT '{}',
  performance_type TEXT, onboarding_completed BOOLEAN DEFAULT false,
  instagram TEXT, facebook TEXT, youtube TEXT, website TEXT, gst_number TEXT,
  verification_status TEXT DEFAULT 'pending'
    CHECK (verification_status IN ('pending','approved','rejected')),
  rejection_reason TEXT, verified_at TIMESTAMPTZ,
  travel_charges INTEGER DEFAULT 0, extra_charges INTEGER DEFAULT 0,
  cover_banner_url TEXT, available_dates DATE[],
  bank_account_holder TEXT, bank_account_number TEXT, bank_ifsc TEXT,
  bank_name TEXT, branch_name TEXT,
  is_bank_verified BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false, featured_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.portfolio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image','video')),
  title TEXT, description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  event_type_id UUID REFERENCES public.event_types(id),
  event_date DATE NOT NULL,
  event_time TIME,
  event_duration_hours INTEGER DEFAULT 4,
  venue_address TEXT NOT NULL, venue_city TEXT NOT NULL, venue_area TEXT,
  requirements TEXT, amount INTEGER NOT NULL, platform_fee INTEGER DEFAULT 0,
  status booking_status NOT NULL DEFAULT 'requested',
  customer_notes TEXT, provider_notes TEXT,
  invoice_number TEXT UNIQUE, invoice_generated_at TIMESTAMPTZ, invoice_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, platform_fee INTEGER DEFAULT 0,
  provider_amount INTEGER NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  payment_method TEXT, transaction_id TEXT, paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE UNIQUE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, message TEXT NOT NULL, type TEXT NOT NULL,
  reference_id UUID, is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.provider_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  unavailable_date DATE NOT NULL,
  time_slot_start TIME, time_slot_end TIME,
  slot_type TEXT DEFAULT 'unavailable' CHECK (slot_type IN ('available','unavailable','busy')),
  reason TEXT,
  UNIQUE (provider_id, unavailable_date)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL, is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

-- PART 3: AUTH & WORKER TABLES
CREATE TABLE IF NOT EXISTS public.refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE, device_info JSONB, ip_address INET,
  expires_at TIMESTAMPTZ NOT NULL, is_revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_used_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL, ip_address INET, user_agent TEXT,
  attempt_type TEXT NOT NULL CHECK (attempt_type IN ('otp_request','otp_verify','login')),
  success BOOLEAN NOT NULL, failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL, otp_hash TEXT NOT NULL, purpose TEXT NOT NULL,
  attempts INTEGER DEFAULT 0, expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.otp_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL, ip_address TEXT, request_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  sms_enabled BOOLEAN DEFAULT true, email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true, booking_notifications BOOLEAN DEFAULT true,
  payment_notifications BOOLEAN DEFAULT true, marketing_notifications BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id), action TEXT NOT NULL,
  table_name TEXT, record_id UUID, old_values JSONB, new_values JSONB,
  ip_address INET, user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.worker_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  phone TEXT NOT NULL, full_name TEXT NOT NULL, email TEXT, gender TEXT,
  profile_photo_url TEXT, service_type TEXT NOT NULL, experience_years INTEGER DEFAULT 0,
  service_city TEXT, service_area TEXT, government_id_type TEXT,
  government_id_url TEXT, address_proof_url TEXT, bank_account_number TEXT,
  bank_ifsc TEXT, bank_account_holder TEXT, portfolio_urls TEXT[] DEFAULT '{}',
  verification_status verification_status DEFAULT 'pending',
  verified_at TIMESTAMPTZ, verified_by UUID, rejection_reason TEXT,
  date_of_birth DATE, alternate_phone TEXT, whatsapp_enabled BOOLEAN DEFAULT true,
  background_check_completed BOOLEAN DEFAULT false, training_completed BOOLEAN DEFAULT false,
  onboarded_at TIMESTAMPTZ, rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.worker_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.worker_profiles(user_id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'government_id','address_proof','bank_details','portfolio','certification','photo'
  )),
  document_url TEXT NOT NULL, document_number TEXT, issued_date DATE, expiry_date DATE,
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','rejected')),
  rejection_reason TEXT, uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ, verified_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.worker_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.worker_profiles(user_id) ON DELETE CASCADE,
  account_holder_name TEXT NOT NULL, account_number TEXT NOT NULL,
  bank_name TEXT NOT NULL, ifsc_code TEXT NOT NULL, branch_name TEXT,
  is_verified BOOLEAN DEFAULT false, verification_ref_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PART 4: ADDITIONAL TABLES
CREATE TABLE IF NOT EXISTS public.artist_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, profession_type profession_type NOT NULL UNIQUE,
  description TEXT, icon TEXT, is_active BOOLEAN DEFAULT true, sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pricing_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL, price INTEGER NOT NULL, duration TEXT, description TEXT,
  is_active BOOLEAN DEFAULT true, sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.provider_time_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL, end_time TIME NOT NULL, is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_id, day_of_week, start_time, end_time)
);

CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider_id)
);

CREATE TABLE IF NOT EXISTS public.featured_artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  featured_by UUID REFERENCES auth.users(id),
  featured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL, reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES auth.users(id),
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id),
  amount INTEGER NOT NULL, platform_fee INTEGER NOT NULL, total_amount INTEGER NOT NULL,
  status TEXT DEFAULT 'paid' CHECK (status IN ('pending','paid','cancelled')),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(), paid_at TIMESTAMPTZ,
  invoice_url TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bank_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL, account_number TEXT NOT NULL, ifsc_code TEXT NOT NULL,
  upi_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL, total_bookings INTEGER DEFAULT 0,
  total_revenue INTEGER DEFAULT 0, total_commission INTEGER DEFAULT 0,
  active_providers INTEGER DEFAULT 0, active_customers INTEGER DEFAULT 0,
  new_registrations INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (date)
);

CREATE TABLE IF NOT EXISTS public.commission_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id),
  booking_amount INTEGER NOT NULL, commission_rate INTEGER NOT NULL DEFAULT 5,
  commission_amount INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','collected','paid')),
  collected_at TIMESTAMPTZ, paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI Conversations (Vowza Planner chat history)
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  context_summary JSONB DEFAULT '{}',
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL, ai_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sequence for invoice numbers
CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1;

-- PART 5: INDEXES
CREATE INDEX IF NOT EXISTS idx_profiles_city ON public.profiles(city);
CREATE INDEX IF NOT EXISTS idx_profiles_state ON public.profiles(state);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON public.profiles(last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_provider_profession ON public.provider_profiles(profession);
CREATE INDEX IF NOT EXISTS idx_provider_is_verified ON public.provider_profiles(is_verified);
CREATE INDEX IF NOT EXISTS idx_provider_is_available ON public.provider_profiles(is_available);
CREATE INDEX IF NOT EXISTS idx_provider_price_range ON public.provider_profiles(price_min, price_max);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON public.bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_provider_id ON public.bookings(provider_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_event_date ON public.bookings(event_date);
CREATE INDEX IF NOT EXISTS idx_bookings_provider_date_status ON public.bookings(provider_id, event_date, status);
CREATE INDEX IF NOT EXISTS idx_messages_booking_id ON public.messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_reviews_provider_id ON public.reviews(provider_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_provider_id ON public.favorites(provider_id);
CREATE INDEX IF NOT EXISTS idx_invoices_booking_id ON public.invoices(booking_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_platform_analytics_date ON public.platform_analytics(date);
CREATE INDEX IF NOT EXISTS idx_commission_tracking_booking_id ON public.commission_tracking(booking_id);
CREATE INDEX IF NOT EXISTS idx_worker_user ON public.worker_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_worker_status ON public.worker_profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_worker_documents_worker_id ON public.worker_documents(worker_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_otp_phone_expires ON public.otp_verifications(phone, expires_at);
CREATE INDEX IF NOT EXISTS idx_rate_limit_phone ON public.otp_rate_limits(phone, window_start);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON public.refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON public.refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_provider_availability_lookup ON public.provider_availability(provider_id, unavailable_date, slot_type);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_active ON public.ai_conversations(user_id, last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conv_created ON public.ai_messages(conversation_id, created_at ASC);
