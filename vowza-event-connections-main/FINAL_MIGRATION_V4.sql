-- ============================================
-- VOWZA FINAL MIGRATION V4
-- Complete database setup for empty Supabase project
-- Idempotent - can be run multiple times safely
-- ============================================
-- CHANGES FROM V3:
--   FIX 1: PART 8  - Renamed PL/pgSQL variable `table_name` -> `v_table_name`
--                    to resolve 42702 ambiguity with information_schema column.
--   FIX 2: PART 13 - Renamed loop variable `table_name` -> `v_table_name`
--                    and replaced invalid `FOR ... IN VALUES` syntax with
--                    `FOREACH ... IN ARRAY` (correct PL/pgSQL syntax).
--   FIX 3: PART 6  - Moved `CREATE SEQUENCE invoice_seq` BEFORE the
--                    `generate_invoice_number()` function that references it.
--   FIX 4: PART 6  - Added SECURITY DEFINER + SET search_path = public to
--                    expire_featured_artists(), generate_invoice_number(),
--                    update_daily_analytics(), create_notification_settings(),
--                    log_audit_changes(), user_has_role(), get_user_roles().
-- ============================================
--
-- EXECUTION INSTRUCTIONS:
-- 1. Go to https://supabase.com/dashboard
-- 2. Select your project (vavfeataqwwbpjonknne)
-- 3. Go to SQL Editor
-- 4. Copy this entire script
-- 5. Paste and click "Run"
--
-- This script will execute successfully on a completely empty database
-- and can be re-run safely without errors.
-- ============================================

-- ============================================
-- PART 0: EXTENSIONS
-- ============================================

-- Enable required extensions for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- PART 1: ENUMS (with DROP IF EXISTS for idempotency)
-- ============================================

-- Drop and recreate enum for user roles
DROP TYPE IF EXISTS public.app_role CASCADE;
CREATE TYPE public.app_role AS ENUM ('customer', 'provider', 'admin');

-- Drop and recreate enum for provider professions (expanded with 30+ categories)
DROP TYPE IF EXISTS public.profession_type CASCADE;
CREATE TYPE public.profession_type AS ENUM (
  'music_band',
  'traditional_band',
  'maharashtra_band',
  'dj',
  'singer',
  'instrumental_artist',
  'classical_musician',
  'photographer',
  'videographer',
  'cinematographer',
  'drone_operator',
  'dancer',
  'choreographer',
  'kuchipudi_dancer',
  'classical_dancer',
  'western_dancer',
  'event_decorator',
  'wedding_decorator',
  'stage_decorator',
  'makeup_artist',
  'mehendi_artist',
  'anchor',
  'host',
  'magician',
  'stand_up_comedian',
  'celebrity_artist',
  'live_performer',
  'folk_artist',
  'lighting_services',
  'sound_services',
  'event_planner',
  'wedding_planner',
  'catering_services',
  'event_support'
);

-- Drop and recreate enum for booking status
DROP TYPE IF EXISTS public.booking_status CASCADE;
CREATE TYPE public.booking_status AS ENUM (
  'requested',
  'accepted',
  'in_progress',
  'completed',
  'cancelled',
  'rejected'
);

-- Drop and recreate enum for payment status
DROP TYPE IF EXISTS public.payment_status CASCADE;
CREATE TYPE public.payment_status AS ENUM (
  'pending',
  'paid',
  'refunded',
  'failed'
);

-- Drop and recreate worker verification status enum
DROP TYPE IF EXISTS public.verification_status CASCADE;
CREATE TYPE public.verification_status AS ENUM ('pending', 'under_review', 'approved', 'rejected');

-- ============================================
-- PART 2: CORE TABLES (with IF NOT EXISTS for idempotency)
-- ============================================

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  avatar_url TEXT,
  city TEXT,
  area TEXT,
  state TEXT,
  address TEXT,
  organization_name TEXT,
  phone_verified BOOLEAN DEFAULT FALSE,
  date_of_birth DATE,
  alternate_phone TEXT,
  whatsapp_enabled BOOLEAN DEFAULT true,
  email_notifications_enabled BOOLEAN DEFAULT TRUE,
  sms_notifications_enabled BOOLEAN DEFAULT TRUE,
  push_notifications_enabled BOOLEAN DEFAULT TRUE,
  profile_completion_percentage INTEGER DEFAULT 0,
  last_active_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT TRUE,
  account_verified_at TIMESTAMPTZ,
  preferences JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (separate for security)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'customer',
  UNIQUE (user_id, role)
);

-- Create provider_profiles table
CREATE TABLE IF NOT EXISTS public.provider_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  profession profession_type NOT NULL,
  experience_years INTEGER DEFAULT 0,
  price_min INTEGER,
  price_max INTEGER,
  bio TEXT,
  is_verified BOOLEAN DEFAULT false,
  is_available BOOLEAN DEFAULT true,
  average_rating NUMERIC(3,2) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  total_bookings INTEGER DEFAULT 0,
  specialties TEXT[],
  stage_name TEXT,
  cover_image_url TEXT,
  languages TEXT[] DEFAULT '{}',
  pricing_type TEXT DEFAULT 'per_event',
  category_details JSONB DEFAULT '{}',
  performance_type TEXT,
  onboarding_completed BOOLEAN DEFAULT false,
  instagram TEXT,
  facebook TEXT,
  youtube TEXT,
  website TEXT,
  gst_number TEXT,
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  verified_at TIMESTAMPTZ,
  travel_charges INTEGER DEFAULT 0,
  extra_charges INTEGER DEFAULT 0,
  cover_banner_url TEXT,
  available_dates DATE[],
  bank_account_holder TEXT,
  bank_account_number TEXT,
  bank_ifsc TEXT,
  bank_name TEXT,
  branch_name TEXT,
  is_bank_verified BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  featured_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create portfolio_items table
CREATE TABLE IF NOT EXISTS public.portfolio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  title TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create event_types table
CREATE TABLE IF NOT EXISTS public.event_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create bookings table
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  event_type_id UUID REFERENCES public.event_types(id),
  event_date DATE NOT NULL,
  event_time TIME,
  event_duration_hours INTEGER DEFAULT 4,
  venue_address TEXT NOT NULL,
  venue_city TEXT NOT NULL,
  venue_area TEXT,
  requirements TEXT,
  amount INTEGER NOT NULL,
  platform_fee INTEGER DEFAULT 0,
  status booking_status NOT NULL DEFAULT 'requested',
  customer_notes TEXT,
  provider_notes TEXT,
  invoice_number TEXT UNIQUE,
  invoice_generated_at TIMESTAMPTZ,
  invoice_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  platform_fee INTEGER DEFAULT 0,
  provider_amount INTEGER NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  transaction_id TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE UNIQUE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  reference_id UUID,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create provider_availability table
CREATE TABLE IF NOT EXISTS public.provider_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  unavailable_date DATE NOT NULL,
  time_slot_start TIME,
  time_slot_end TIME,
  slot_type TEXT DEFAULT 'unavailable' CHECK (slot_type IN ('available', 'unavailable', 'busy')),
  reason TEXT,
  UNIQUE (provider_id, unavailable_date)
);

-- Create messages table for booking chat
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create push_subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

-- ============================================
-- PART 3: ENHANCED AUTH TABLES (with IF NOT EXISTS for idempotency)
-- ============================================

-- Create refresh tokens table for JWT rotation
CREATE TABLE IF NOT EXISTS public.refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  device_info JSONB,
  ip_address INET,
  expires_at TIMESTAMPTZ NOT NULL,
  is_revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ DEFAULT now()
);

-- Create login_attempts table for security monitoring
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  attempt_type TEXT NOT NULL CHECK (attempt_type IN ('otp_request', 'otp_verify', 'login')),
  success BOOLEAN NOT NULL,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create worker_profiles table for service providers requiring verification
CREATE TABLE IF NOT EXISTS public.worker_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  gender TEXT,
  profile_photo_url TEXT,
  service_type TEXT NOT NULL,
  experience_years INTEGER DEFAULT 0,
  service_city TEXT,
  service_area TEXT,
  government_id_type TEXT,
  government_id_url TEXT,
  address_proof_url TEXT,
  bank_account_number TEXT,
  bank_ifsc TEXT,
  bank_account_holder TEXT,
  portfolio_urls TEXT[] DEFAULT '{}',
  verification_status verification_status DEFAULT 'pending',
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID,
  rejection_reason TEXT,
  date_of_birth DATE,
  alternate_phone TEXT,
  whatsapp_enabled BOOLEAN DEFAULT true,
  background_check_completed BOOLEAN DEFAULT false,
  training_completed BOOLEAN DEFAULT false,
  onboarded_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create OTP table for phone verification
CREATE TABLE IF NOT EXISTS public.otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  purpose TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Rate limiting table for OTP
CREATE TABLE IF NOT EXISTS public.otp_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  ip_address TEXT,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create worker_documents table for document management
CREATE TABLE IF NOT EXISTS public.worker_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.worker_profiles(user_id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'government_id', 'address_proof', 'bank_details', 'portfolio', 'certification', 'photo'
  )),
  document_url TEXT NOT NULL,
  document_number TEXT,
  issued_date DATE,
  expiry_date DATE,
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  rejection_reason TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id)
);

-- Create worker_bank_accounts table for secure payout handling
CREATE TABLE IF NOT EXISTS public.worker_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.worker_profiles(user_id) ON DELETE CASCADE,
  account_holder_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  ifsc_code TEXT NOT NULL,
  branch_name TEXT,
  is_verified BOOLEAN DEFAULT false,
  verification_ref_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create audit_log table for compliance
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create notification_settings table
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  sms_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  booking_notifications BOOLEAN DEFAULT true,
  payment_notifications BOOLEAN DEFAULT true,
  marketing_notifications BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- PART 4: ADDITIONAL TABLES (already have IF NOT EXISTS)
-- ============================================

-- Create artist_categories table for dynamic category management
CREATE TABLE IF NOT EXISTS public.artist_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  profession_type profession_type NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create pricing packages table for artists
CREATE TABLE IF NOT EXISTS public.pricing_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  duration TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create provider_time_slots table for recurring availability
CREATE TABLE IF NOT EXISTS public.provider_time_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_id, day_of_week, start_time, end_time)
);

-- Create favorites table for customers to save favorite artists
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider_id)
);

-- Create featured_artists table for managing featured status
CREATE TABLE IF NOT EXISTS public.featured_artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  featured_by UUID REFERENCES auth.users(id),
  featured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create invoices table for invoice management
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES auth.users(id),
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id),
  amount INTEGER NOT NULL,
  platform_fee INTEGER NOT NULL,
  total_amount INTEGER NOT NULL,
  status TEXT DEFAULT 'paid' CHECK (status IN ('pending', 'paid', 'cancelled')),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  invoice_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create bank_details table for provider bank information
CREATE TABLE IF NOT EXISTS public.bank_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  ifsc_code TEXT NOT NULL,
  upi_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create analytics tracking tables
CREATE TABLE IF NOT EXISTS public.platform_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  total_bookings INTEGER DEFAULT 0,
  total_revenue INTEGER DEFAULT 0,
  total_commission INTEGER DEFAULT 0,
  active_providers INTEGER DEFAULT 0,
  active_customers INTEGER DEFAULT 0,
  new_registrations INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (date)
);

-- Create commission tracking table
CREATE TABLE IF NOT EXISTS public.commission_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id),
  booking_amount INTEGER NOT NULL,
  commission_rate INTEGER NOT NULL DEFAULT 5,
  commission_amount INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'collected', 'paid')),
  collected_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- PART 5: INDEXES (with IF NOT EXISTS for idempotency)
-- ============================================

-- Core tables indexes
CREATE INDEX IF NOT EXISTS idx_profiles_state ON public.profiles(state);
CREATE INDEX IF NOT EXISTS idx_profiles_city ON public.profiles(city);
CREATE INDEX IF NOT EXISTS idx_profiles_area ON public.profiles(area);
CREATE INDEX IF NOT EXISTS idx_profiles_phone_verified ON public.profiles(phone_verified);
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

CREATE INDEX IF NOT EXISTS idx_messages_booking_id ON public.messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

-- Auth tables indexes
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON public.refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON public.refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_phone ON public.login_attempts(phone);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON public.login_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_otp_phone_expires ON public.otp_verifications(phone, expires_at);
CREATE INDEX IF NOT EXISTS idx_rate_limit_phone ON public.otp_rate_limits(phone, window_start);
CREATE INDEX IF NOT EXISTS idx_worker_status ON public.worker_profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_worker_user ON public.worker_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_worker_documents_worker_id ON public.worker_documents(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_documents_status ON public.worker_documents(verification_status);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at);

-- Additional tables indexes
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_provider_id ON public.favorites(provider_id);
CREATE INDEX IF NOT EXISTS idx_featured_artists_provider_id ON public.featured_artists(provider_id);
CREATE INDEX IF NOT EXISTS idx_featured_artists_expires_at ON public.featured_artists(expires_at);
CREATE INDEX IF NOT EXISTS idx_invoices_booking_id ON public.invoices(booking_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_provider_id ON public.invoices(provider_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_platform_analytics_date ON public.platform_analytics(date);
CREATE INDEX IF NOT EXISTS idx_commission_tracking_booking_id ON public.commission_tracking(booking_id);
CREATE INDEX IF NOT EXISTS idx_commission_tracking_provider_id ON public.commission_tracking(provider_id);
CREATE INDEX IF NOT EXISTS idx_commission_tracking_status ON public.commission_tracking(status);

-- ============================================
-- PART 6: FUNCTIONS (already using CREATE OR REPLACE)
-- ============================================

-- Fix function search path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', NEW.phone),
    NEW.email
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer');

  INSERT INTO public.notification_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Create function to update provider rating
CREATE OR REPLACE FUNCTION public.update_provider_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.provider_profiles
  SET
    average_rating = (
      SELECT COALESCE(AVG(rating), 0) FROM public.reviews WHERE provider_id = NEW.provider_id
    ),
    total_reviews = (
      SELECT COUNT(*) FROM public.reviews WHERE provider_id = NEW.provider_id
    )
  WHERE id = NEW.provider_id;

  RETURN NEW;
END;
$$;

-- Create function to automatically create notification settings for new users
-- FIX 4: Added SECURITY DEFINER + SET search_path = public
CREATE OR REPLACE FUNCTION public.create_notification_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Create function to log changes
-- FIX 4: Added SECURITY DEFINER + SET search_path = public
CREATE OR REPLACE FUNCTION public.log_audit_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (user_id, action, table_name, record_id, new_values)
    VALUES (auth.uid(), 'INSERT', TG_TABLE_NAME, NEW.id, row_to_json(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (user_id, action, table_name, record_id, old_values, new_values)
    VALUES (auth.uid(), 'UPDATE', TG_TABLE_NAME, NEW.id, row_to_json(OLD), row_to_json(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (user_id, action, table_name, record_id, old_values)
    VALUES (auth.uid(), 'DELETE', TG_TABLE_NAME, OLD.id, row_to_json(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Create function to check if user has specific role
-- FIX 4: Added SECURITY DEFINER + SET search_path = public
CREATE OR REPLACE FUNCTION public.user_has_role(p_user_id UUID, p_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p_user_id AND ur.role = p_role::public.app_role
  );
END;
$$;

-- Create function to get user roles
-- FIX 4: Added SECURITY DEFINER + SET search_path = public
CREATE OR REPLACE FUNCTION public.get_user_roles(p_user_id UUID)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN ARRAY(
    SELECT ur.role::TEXT FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
  );
END;
$$;

-- FIX 3: Create sequence BEFORE the function that references it
-- Create sequence for invoice numbers
CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1;

-- Function to generate invoice number
-- FIX 4: Added SECURITY DEFINER + SET search_path = public
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_num TEXT;
BEGIN
  v_invoice_num := 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('invoice_seq')::TEXT, 6, '0');
  RETURN v_invoice_num;
END;
$$;

-- Function to automatically expire featured status
-- FIX 4: Added SECURITY DEFINER + SET search_path = public
CREATE OR REPLACE FUNCTION public.expire_featured_artists()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.expires_at < NOW() THEN
    UPDATE public.provider_profiles SET is_featured = false WHERE id = NEW.provider_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Function to update daily analytics
-- FIX 4: Added SECURITY DEFINER + SET search_path = public
CREATE OR REPLACE FUNCTION public.update_daily_analytics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.platform_analytics (date, total_bookings, total_revenue, total_commission)
  VALUES (
    CURRENT_DATE,
    1,
    NEW.amount,
    ROUND(NEW.amount * 0.05)
  )
  ON CONFLICT (date)
  DO UPDATE SET
    total_bookings = platform_analytics.total_bookings + 1,
    total_revenue = platform_analytics.total_revenue + NEW.amount,
    total_commission = platform_analytics.total_commission + ROUND(NEW.amount * 0.05);

  RETURN NEW;
END;
$$;

-- ============================================
-- PART 7: TRIGGERS (with DROP IF EXISTS for idempotency)
-- ============================================

-- Create trigger for new user (may fail on auth.users due to Supabase permissions)
-- Wrapped in DO block to handle permission errors gracefully
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not create trigger on auth.users (may require additional permissions): %', SQLERRM;
END $$;

-- Create trigger for rating updates
DROP TRIGGER IF EXISTS on_review_created ON public.reviews;
CREATE TRIGGER on_review_created
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_provider_rating();

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_provider_profiles_updated_at ON public.provider_profiles;
CREATE TRIGGER update_provider_profiles_updated_at BEFORE UPDATE ON public.provider_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_bookings_updated_at ON public.bookings;
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_worker_profiles_updated_at ON public.worker_profiles;
CREATE TRIGGER update_worker_profiles_updated_at
BEFORE UPDATE ON public.worker_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_artist_categories_updated_at ON public.artist_categories;
CREATE TRIGGER update_artist_categories_updated_at BEFORE UPDATE ON public.artist_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_pricing_packages_updated_at ON public.pricing_packages;
CREATE TRIGGER update_pricing_packages_updated_at BEFORE UPDATE ON public.pricing_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_provider_time_slots_updated_at ON public.provider_time_slots;
CREATE TRIGGER update_provider_time_slots_updated_at BEFORE UPDATE ON public.provider_time_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_bank_details_updated_at ON public.bank_details;
CREATE TRIGGER update_bank_details_updated_at BEFORE UPDATE ON public.bank_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create triggers for audit logging
DROP TRIGGER IF EXISTS audit_worker_profiles_changes ON public.worker_profiles;
CREATE TRIGGER audit_worker_profiles_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.worker_profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_changes();

DROP TRIGGER IF EXISTS audit_worker_documents_changes ON public.worker_documents;
CREATE TRIGGER audit_worker_documents_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.worker_documents
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_changes();

-- Trigger to check featured status
DROP TRIGGER IF EXISTS check_featured_expiry ON public.featured_artists;
CREATE TRIGGER check_featured_expiry
  BEFORE INSERT OR UPDATE ON public.featured_artists
  FOR EACH ROW EXECUTE FUNCTION public.expire_featured_artists();

-- Trigger to update analytics on booking creation
DROP TRIGGER IF EXISTS update_analytics_on_booking ON public.bookings;
CREATE TRIGGER update_analytics_on_booking
  AFTER INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_daily_analytics();

-- ============================================
-- PART 8: ENABLE RLS (with idempotency check)
-- ============================================

-- Enable RLS only if not already enabled
-- FIX 1: Renamed loop variable `table_name` -> `v_table_name` to resolve
--        error 42702 "column reference table_name is ambiguous" caused by
--        the variable shadowing the `table_name` column in
--        information_schema.tables used in the FOR query.
DO $$
DECLARE
  v_table_name TEXT;
BEGIN
  FOR v_table_name IN
    SELECT t.table_name
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
    AND t.table_name NOT IN ('spatial_ref_sys')
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table_name);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not enable RLS on %: %', v_table_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================
-- PART 9: RLS POLICIES (with DROP IF EXISTS for idempotency)
-- ============================================

-- Profiles: Users can read all, update own
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- User roles: Users can read own roles
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Provider profiles: Public read, providers update own
DROP POLICY IF EXISTS "Provider profiles are viewable by everyone" ON public.provider_profiles;
CREATE POLICY "Provider profiles are viewable by everyone" ON public.provider_profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Providers can insert own profile" ON public.provider_profiles;
CREATE POLICY "Providers can insert own profile" ON public.provider_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Providers can update own profile" ON public.provider_profiles;
CREATE POLICY "Providers can update own profile" ON public.provider_profiles FOR UPDATE USING (auth.uid() = user_id);

-- Portfolio items: Public read, providers manage own
DROP POLICY IF EXISTS "Portfolio items are viewable by everyone" ON public.portfolio_items;
CREATE POLICY "Portfolio items are viewable by everyone" ON public.portfolio_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "Providers can insert own portfolio" ON public.portfolio_items;
CREATE POLICY "Providers can insert own portfolio" ON public.portfolio_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid()));
DROP POLICY IF EXISTS "Providers can delete own portfolio" ON public.portfolio_items;
CREATE POLICY "Providers can delete own portfolio" ON public.portfolio_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid()));

-- Event types: Public read
DROP POLICY IF EXISTS "Event types are viewable by everyone" ON public.event_types;
CREATE POLICY "Event types are viewable by everyone" ON public.event_types FOR SELECT USING (true);

-- Bookings: Customers and providers can view their own
DROP POLICY IF EXISTS "Users can view own bookings" ON public.bookings;
CREATE POLICY "Users can view own bookings" ON public.bookings FOR SELECT
  USING (auth.uid() = customer_id OR EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid()));
DROP POLICY IF EXISTS "Customers can create bookings" ON public.bookings;
CREATE POLICY "Customers can create bookings" ON public.bookings FOR INSERT WITH CHECK (auth.uid() = customer_id);
DROP POLICY IF EXISTS "Booking parties can update" ON public.bookings;
CREATE POLICY "Booking parties can update" ON public.bookings FOR UPDATE
  USING (auth.uid() = customer_id OR EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid()));

-- Payments: Booking parties can view
DROP POLICY IF EXISTS "Booking parties can view payments" ON public.payments;
CREATE POLICY "Booking parties can view payments" ON public.payments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = booking_id
    AND (b.customer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = b.provider_id AND user_id = auth.uid()))
  ));

-- Reviews: Public read, customers create for their bookings
DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON public.reviews;
CREATE POLICY "Reviews are viewable by everyone" ON public.reviews FOR SELECT USING (true);
DROP POLICY IF EXISTS "Customers can create reviews" ON public.reviews;
CREATE POLICY "Customers can create reviews" ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = customer_id AND EXISTS (SELECT 1 FROM public.bookings WHERE id = booking_id AND customer_id = auth.uid() AND status = 'completed'));

-- Notifications: Users can view own
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- Provider availability: Public read, providers manage own
DROP POLICY IF EXISTS "Availability is viewable by everyone" ON public.provider_availability;
CREATE POLICY "Availability is viewable by everyone" ON public.provider_availability FOR SELECT USING (true);
DROP POLICY IF EXISTS "Providers can manage own availability" ON public.provider_availability;
CREATE POLICY "Providers can manage own availability" ON public.provider_availability FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid()));
DROP POLICY IF EXISTS "Providers can delete own availability" ON public.provider_availability;
CREATE POLICY "Providers can delete own availability" ON public.provider_availability FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid()));

-- Messages: Booking participants can view and send
DROP POLICY IF EXISTS "Booking participants can view messages" ON public.messages;
CREATE POLICY "Booking participants can view messages" ON public.messages
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = booking_id
    AND (
      b.customer_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.provider_profiles pp
        WHERE pp.id = b.provider_id AND pp.user_id = auth.uid()
      )
    )
  )
);

DROP POLICY IF EXISTS "Booking participants can send messages" ON public.messages;
CREATE POLICY "Booking participants can send messages" ON public.messages
FOR INSERT WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = booking_id
    AND (
      b.customer_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.provider_profiles pp
        WHERE pp.id = b.provider_id AND pp.user_id = auth.uid()
      )
    )
  )
);

DROP POLICY IF EXISTS "Users can mark own received messages as read" ON public.messages;
CREATE POLICY "Users can mark own received messages as read" ON public.messages
FOR UPDATE USING (
  sender_id != auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = booking_id
    AND (
      b.customer_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.provider_profiles pp
        WHERE pp.id = b.provider_id AND pp.user_id = auth.uid()
      )
    )
  )
);

-- Push subscriptions: Users can manage their own
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can view own subscriptions" ON public.push_subscriptions
FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can insert own subscriptions" ON public.push_subscriptions
FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can delete own subscriptions" ON public.push_subscriptions
FOR DELETE USING (auth.uid() = user_id);

-- Refresh tokens: Users can only access their own tokens
DROP POLICY IF EXISTS "Users can view own refresh tokens" ON public.refresh_tokens;
CREATE POLICY "Users can view own refresh tokens" ON public.refresh_tokens
FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own refresh tokens" ON public.refresh_tokens;
CREATE POLICY "Users can insert own refresh tokens" ON public.refresh_tokens
FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own refresh tokens" ON public.refresh_tokens;
CREATE POLICY "Users can update own refresh tokens" ON public.refresh_tokens
FOR UPDATE USING (auth.uid() = user_id);

-- Login attempts: Read-only for users
DROP POLICY IF EXISTS "All users can view login attempts" ON public.login_attempts;
CREATE POLICY "All users can view login attempts" ON public.login_attempts
FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service can insert login attempts" ON public.login_attempts;
CREATE POLICY "Service can insert login attempts" ON public.login_attempts
FOR INSERT WITH CHECK (true);

-- Worker profiles: Workers can view/update own, admins can view all
DROP POLICY IF EXISTS "Workers can view own profile" ON public.worker_profiles;
CREATE POLICY "Workers can view own profile"
ON public.worker_profiles FOR SELECT
USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Workers can update own profile" ON public.worker_profiles;
CREATE POLICY "Workers can update own profile"
ON public.worker_profiles FOR UPDATE
USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Authenticated users can insert worker profile" ON public.worker_profiles;
CREATE POLICY "Authenticated users can insert worker profile"
ON public.worker_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view all workers" ON public.worker_profiles;
CREATE POLICY "Admins can view all workers"
ON public.worker_profiles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can update all workers" ON public.worker_profiles;
CREATE POLICY "Admins can update all workers"
ON public.worker_profiles FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- OTP tables: Allow authenticated users to manage
DROP POLICY IF EXISTS "Users can insert OTP verifications" ON public.otp_verifications;
CREATE POLICY "Users can insert OTP verifications" ON public.otp_verifications FOR INSERT
  WITH CHECK (true);
DROP POLICY IF EXISTS "Users can verify OTP" ON public.otp_verifications;
CREATE POLICY "Users can verify OTP" ON public.otp_verifications FOR SELECT
  USING (true);
DROP POLICY IF EXISTS "Users can update OTP verifications" ON public.otp_verifications;
CREATE POLICY "Users can update OTP verifications" ON public.otp_verifications FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Service can insert rate limits" ON public.otp_rate_limits;
CREATE POLICY "Service can insert rate limits" ON public.otp_rate_limits
FOR INSERT WITH CHECK (true);

-- Worker documents: Workers can view their own, admins can view all
DROP POLICY IF EXISTS "Workers can view own documents" ON public.worker_documents;
CREATE POLICY "Workers can view own documents" ON public.worker_documents
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.worker_profiles wp
    WHERE wp.user_id = auth.uid() AND wp.user_id = worker_id
  )
);
DROP POLICY IF EXISTS "Workers can insert own documents" ON public.worker_documents;
CREATE POLICY "Workers can insert own documents" ON public.worker_documents
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.worker_profiles wp
    WHERE wp.user_id = auth.uid() AND wp.user_id = worker_id
  )
);
DROP POLICY IF EXISTS "Admins can manage all worker documents" ON public.worker_documents;
CREATE POLICY "Admins can manage all worker documents" ON public.worker_documents
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);

-- Worker bank accounts: Workers can view own, admins can view all
DROP POLICY IF EXISTS "Workers can view own bank accounts" ON public.worker_bank_accounts;
CREATE POLICY "Workers can view own bank accounts" ON public.worker_bank_accounts
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.worker_profiles wp
    WHERE wp.user_id = auth.uid() AND wp.user_id = worker_id
  )
);
DROP POLICY IF EXISTS "Workers can insert own bank accounts" ON public.worker_bank_accounts;
CREATE POLICY "Workers can insert own bank accounts" ON public.worker_bank_accounts
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.worker_profiles wp
    WHERE wp.user_id = auth.uid() AND wp.user_id = worker_id
  )
);
DROP POLICY IF EXISTS "Admins can manage all worker bank accounts" ON public.worker_bank_accounts;
CREATE POLICY "Admins can manage all worker bank accounts" ON public.worker_bank_accounts
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);

-- Audit log: Read-only for users, admins can see all
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.audit_log;
CREATE POLICY "Users can view own audit logs" ON public.audit_log
FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_log;
CREATE POLICY "Admins can view all audit logs" ON public.audit_log
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);

-- Notification settings: Users can manage own settings
DROP POLICY IF EXISTS "Users can manage own notification settings" ON public.notification_settings;
CREATE POLICY "Users can manage own notification settings" ON public.notification_settings
FOR ALL USING (auth.uid() = user_id);

-- Artist categories: Everyone can view, admins can manage
DROP POLICY IF EXISTS "Everyone can view categories" ON public.artist_categories;
CREATE POLICY "Everyone can view categories" ON public.artist_categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage categories" ON public.artist_categories;
CREATE POLICY "Admins can manage categories" ON public.artist_categories FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Pricing packages: Everyone can view, providers manage own
DROP POLICY IF EXISTS "Everyone can view pricing packages" ON public.pricing_packages;
CREATE POLICY "Everyone can view pricing packages" ON public.pricing_packages FOR SELECT USING (true);
DROP POLICY IF EXISTS "Providers can manage own pricing packages" ON public.pricing_packages;
CREATE POLICY "Providers can manage own pricing packages" ON public.pricing_packages FOR ALL
  USING (EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid()));

-- Provider time slots: Everyone can view, providers manage own
DROP POLICY IF EXISTS "Everyone can view time slots" ON public.provider_time_slots;
CREATE POLICY "Everyone can view time slots" ON public.provider_time_slots FOR SELECT USING (true);
DROP POLICY IF EXISTS "Providers can manage own time slots" ON public.provider_time_slots;
CREATE POLICY "Providers can manage own time slots" ON public.provider_time_slots FOR ALL
  USING (EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid()));

-- Favorites: Users can manage own, everyone can view
DROP POLICY IF EXISTS "Users can manage own favorites" ON public.favorites;
CREATE POLICY "Users can manage own favorites" ON public.favorites FOR ALL
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Everyone can view favorites" ON public.favorites;
CREATE POLICY "Everyone can view favorites" ON public.favorites FOR SELECT
  USING (true);

-- Featured artists: Everyone can view, admins can manage
DROP POLICY IF EXISTS "Everyone can view featured artists" ON public.featured_artists;
CREATE POLICY "Everyone can view featured artists" ON public.featured_artists FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage featured artists" ON public.featured_artists;
CREATE POLICY "Admins can manage featured artists" ON public.featured_artists FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Invoices: Users can view own, admins can manage
DROP POLICY IF EXISTS "Users can view own invoices" ON public.invoices;
CREATE POLICY "Users can view own invoices" ON public.invoices FOR SELECT
  USING (auth.uid() = customer_id OR EXISTS (
    SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "Admins can manage invoices" ON public.invoices;
CREATE POLICY "Admins can manage invoices" ON public.invoices FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Bank details: Providers can manage own
DROP POLICY IF EXISTS "Providers can manage own bank details" ON public.bank_details;
CREATE POLICY "Providers can manage own bank details" ON public.bank_details FOR ALL
  USING (EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid()));

-- Analytics: Admins can manage, everyone can view
DROP POLICY IF EXISTS "Admins can manage analytics" ON public.platform_analytics;
CREATE POLICY "Admins can manage analytics" ON public.platform_analytics FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "Everyone can view analytics" ON public.platform_analytics;
CREATE POLICY "Everyone can view analytics" ON public.platform_analytics FOR SELECT USING (true);

-- Commission tracking: Admins can manage, providers can view own
DROP POLICY IF EXISTS "Admins can manage commissions" ON public.commission_tracking;
CREATE POLICY "Admins can manage commissions" ON public.commission_tracking FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "Providers can view own commissions" ON public.commission_tracking;
CREATE POLICY "Providers can view own commissions" ON public.commission_tracking FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid()));

-- ============================================
-- PART 10: STORAGE BUCKETS (with ON CONFLICT for idempotency)
-- ============================================

-- Create all required storage buckets
-- Wrapped in DO block for error handling
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public) VALUES ('artist-profile-images', 'artist-profile-images', true) ON CONFLICT (id) DO NOTHING;
  INSERT INTO storage.buckets (id, name, public) VALUES ('customer-profile-images', 'customer-profile-images', true) ON CONFLICT (id) DO NOTHING;
  INSERT INTO storage.buckets (id, name, public) VALUES ('portfolio-images', 'portfolio-images', true) ON CONFLICT (id) DO NOTHING;
  INSERT INTO storage.buckets (id, name, public) VALUES ('business-documents', 'business-documents', false) ON CONFLICT (id) DO NOTHING;
  INSERT INTO storage.buckets (id, name, public) VALUES ('verification-documents', 'verification-documents', false) ON CONFLICT (id) DO NOTHING;
  INSERT INTO storage.buckets (id, name, public) VALUES ('gallery', 'gallery', true) ON CONFLICT (id) DO NOTHING;
  INSERT INTO storage.buckets (id, name, public) VALUES ('videos', 'videos', true) ON CONFLICT (id) DO NOTHING;
  INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', false) ON CONFLICT (id) DO NOTHING;
  INSERT INTO storage.buckets (id, name, public) VALUES ('event-images', 'event-images', true) ON CONFLICT (id) DO NOTHING;
  INSERT INTO storage.buckets (id, name, public) VALUES ('thumbnails', 'thumbnails', true) ON CONFLICT (id) DO NOTHING;
  INSERT INTO storage.buckets (id, name, public) VALUES ('chat-files', 'chat-files', true) ON CONFLICT (id) DO NOTHING;
  INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', false) ON CONFLICT (id) DO NOTHING;
  INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false) ON CONFLICT (id) DO NOTHING;
  INSERT INTO storage.buckets (id, name, public) VALUES ('verification', 'verification', false) ON CONFLICT (id) DO NOTHING;
  INSERT INTO storage.buckets (id, name, public) VALUES ('profile-pictures', 'profile-pictures', true) ON CONFLICT (id) DO NOTHING;
  INSERT INTO storage.buckets (id, name, public) VALUES ('portfolio', 'portfolio', true) ON CONFLICT (id) DO NOTHING;
  INSERT INTO storage.buckets (id, name, public) VALUES ('cover-banners', 'cover-banners', true) ON CONFLICT (id) DO NOTHING;
  INSERT INTO storage.buckets (id, name, public) VALUES ('provider-media', 'provider-media', true) ON CONFLICT (id) DO NOTHING;
  INSERT INTO storage.buckets (id, name, public) VALUES ('worker-documents', 'worker-documents', false) ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not create storage buckets (may need to be created via Supabase Dashboard): %', SQLERRM;
END $$;

-- ============================================
-- PART 11: STORAGE POLICIES (with DROP IF EXISTS for idempotency)
-- ============================================

-- Wrap storage policies in DO block for error handling
DO $$
BEGIN
  -- Artist profile images policies
  DROP POLICY IF EXISTS "Public read access for artist profile images" ON storage.objects;
  CREATE POLICY "Public read access for artist profile images"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'artist-profile-images');

  DROP POLICY IF EXISTS "Authenticated artists can upload profile images" ON storage.objects;
  CREATE POLICY "Authenticated artists can upload profile images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'artist-profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

  DROP POLICY IF EXISTS "Artists can update their own profile images" ON storage.objects;
  CREATE POLICY "Artists can update their own profile images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'artist-profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

  DROP POLICY IF EXISTS "Artists can delete their own profile images" ON storage.objects;
  CREATE POLICY "Artists can delete their own profile images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'artist-profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

  -- Customer profile images policies
  DROP POLICY IF EXISTS "Public read access for customer profile images" ON storage.objects;
  CREATE POLICY "Public read access for customer profile images"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'customer-profile-images');

  DROP POLICY IF EXISTS "Authenticated customers can upload profile images" ON storage.objects;
  CREATE POLICY "Authenticated customers can upload profile images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'customer-profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

  DROP POLICY IF EXISTS "Customers can update their own profile images" ON storage.objects;
  CREATE POLICY "Customers can update their own profile images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'customer-profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

  DROP POLICY IF EXISTS "Customers can delete their own profile images" ON storage.objects;
  CREATE POLICY "Customers can delete their own profile images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'customer-profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

  -- Portfolio images policies
  DROP POLICY IF EXISTS "Public read access for portfolio images" ON storage.objects;
  CREATE POLICY "Public read access for portfolio images"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'portfolio-images');

  DROP POLICY IF EXISTS "Authenticated artists can upload portfolio images" ON storage.objects;
  CREATE POLICY "Authenticated artists can upload portfolio images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'portfolio-images' AND auth.uid()::text = (storage.foldername(name))[1]);

  DROP POLICY IF EXISTS "Artists can update their own portfolio images" ON storage.objects;
  CREATE POLICY "Artists can update their own portfolio images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'portfolio-images' AND auth.uid()::text = (storage.foldername(name))[1]);

  DROP POLICY IF EXISTS "Artists can delete their own portfolio images" ON storage.objects;
  CREATE POLICY "Artists can delete their own portfolio images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'portfolio-images' AND auth.uid()::text = (storage.foldername(name))[1]);

  -- Business documents policies
  DROP POLICY IF EXISTS "Admins can read business documents" ON storage.objects;
  CREATE POLICY "Admins can read business documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'business-documents' AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ));

  DROP POLICY IF EXISTS "Users can upload their own business documents" ON storage.objects;
  CREATE POLICY "Users can upload their own business documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'business-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

  DROP POLICY IF EXISTS "Users can update their own business documents" ON storage.objects;
  CREATE POLICY "Users can update their own business documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'business-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

  DROP POLICY IF EXISTS "Users can delete their own business documents" ON storage.objects;
  CREATE POLICY "Users can delete their own business documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'business-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

  -- Verification documents policies
  DROP POLICY IF EXISTS "Admins can read verification documents" ON storage.objects;
  CREATE POLICY "Admins can read verification documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'verification-documents' AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ));

  DROP POLICY IF EXISTS "Users can upload their own verification documents" ON storage.objects;
  CREATE POLICY "Users can upload their own verification documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'verification-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

  DROP POLICY IF EXISTS "Users can update their own verification documents" ON storage.objects;
  CREATE POLICY "Users can update their own verification documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'verification-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

  DROP POLICY IF EXISTS "Users can delete their own verification documents" ON storage.objects;
  CREATE POLICY "Users can delete their own verification documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'verification-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

  -- Gallery policies
  DROP POLICY IF EXISTS "Public read access for gallery" ON storage.objects;
  CREATE POLICY "Public read access for gallery"
  ON storage.objects FOR SELECT TO public USING (bucket_id = 'gallery');

  DROP POLICY IF EXISTS "Authenticated artists can upload to gallery" ON storage.objects;
  CREATE POLICY "Authenticated artists can upload to gallery"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gallery' AND auth.uid()::text = (storage.foldername(name))[1]);

  DROP POLICY IF EXISTS "Artists can update their own gallery items" ON storage.objects;
  CREATE POLICY "Artists can update their own gallery items"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'gallery' AND auth.uid()::text = (storage.foldername(name))[1]);

  DROP POLICY IF EXISTS "Artists can delete their own gallery items" ON storage.objects;
  CREATE POLICY "Artists can delete their own gallery items"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'gallery' AND auth.uid()::text = (storage.foldername(name))[1]);

  -- Videos policies
  DROP POLICY IF EXISTS "Public read access for videos" ON storage.objects;
  CREATE POLICY "Public read access for videos"
  ON storage.objects FOR SELECT TO public USING (bucket_id = 'videos');

  DROP POLICY IF EXISTS "Authenticated artists can upload videos" ON storage.objects;
  CREATE POLICY "Authenticated artists can upload videos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

  DROP POLICY IF EXISTS "Artists can update their own videos" ON storage.objects;
  CREATE POLICY "Artists can update their own videos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

  DROP POLICY IF EXISTS "Artists can delete their own videos" ON storage.objects;
  CREATE POLICY "Artists can delete their own videos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

  -- Contracts policies
  DROP POLICY IF EXISTS "Admins can read contracts" ON storage.objects;
  CREATE POLICY "Admins can read contracts"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contracts' AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ));

  DROP POLICY IF EXISTS "Users can read their own contracts" ON storage.objects;
  CREATE POLICY "Users can read their own contracts"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contracts' AND auth.uid()::text = (storage.foldername(name))[1]);

  DROP POLICY IF EXISTS "Admins can upload contracts" ON storage.objects;
  CREATE POLICY "Admins can upload contracts"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contracts' AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ));

  -- Event images policies
  DROP POLICY IF EXISTS "Public read access for event images" ON storage.objects;
  CREATE POLICY "Public read access for event images"
  ON storage.objects FOR SELECT TO public USING (bucket_id = 'event-images');

  DROP POLICY IF EXISTS "Authenticated users can upload event images" ON storage.objects;
  CREATE POLICY "Authenticated users can upload event images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'event-images' AND auth.uid()::text = (storage.foldername(name))[1]);

  DROP POLICY IF EXISTS "Users can update their own event images" ON storage.objects;
  CREATE POLICY "Users can update their own event images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'event-images' AND auth.uid()::text = (storage.foldername(name))[1]);

  DROP POLICY IF EXISTS "Users can delete their own event images" ON storage.objects;
  CREATE POLICY "Users can delete their own event images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'event-images' AND auth.uid()::text = (storage.foldername(name))[1]);

  -- Thumbnails policies
  DROP POLICY IF EXISTS "Public read access for thumbnails" ON storage.objects;
  CREATE POLICY "Public read access for thumbnails"
  ON storage.objects FOR SELECT TO public USING (bucket_id = 'thumbnails');

  DROP POLICY IF EXISTS "Authenticated users can upload thumbnails" ON storage.objects;
  CREATE POLICY "Authenticated users can upload thumbnails"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);

  DROP POLICY IF EXISTS "Users can update their own thumbnails" ON storage.objects;
  CREATE POLICY "Users can update their own thumbnails"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);

  DROP POLICY IF EXISTS "Users can delete their own thumbnails" ON storage.objects;
  CREATE POLICY "Users can delete their own thumbnails"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);

  -- Chat files policies
  DROP POLICY IF EXISTS "Participants can read chat files" ON storage.objects;
  CREATE POLICY "Participants can read chat files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-files' AND (
    auth.uid()::text = (storage.foldername(name))[1] OR
    auth.uid()::text = (storage.foldername(name))[2]
  ));

  DROP POLICY IF EXISTS "Chat participants can upload files" ON storage.objects;
  CREATE POLICY "Chat participants can upload files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-files' AND (
    auth.uid()::text = (storage.foldername(name))[1] OR
    auth.uid()::text = (storage.foldername(name))[2]
  ));

  -- Payment proofs policies
  DROP POLICY IF EXISTS "Admins can read payment proofs" ON storage.objects;
  CREATE POLICY "Admins can read payment proofs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs' AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ));

  DROP POLICY IF EXISTS "Users can upload their own payment proofs" ON storage.objects;
  CREATE POLICY "Users can upload their own payment proofs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

  DROP POLICY IF EXISTS "Users can read their own payment proofs" ON storage.objects;
  CREATE POLICY "Users can read their own payment proofs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

  -- Documents policies (generic)
  DROP POLICY IF EXISTS "Admins can read documents" ON storage.objects;
  CREATE POLICY "Admins can read documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ));

  DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
  CREATE POLICY "Users can upload their own documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

  DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;
  CREATE POLICY "Users can update their own documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

  -- Verification bucket policies
  DROP POLICY IF EXISTS "Admins can read verification" ON storage.objects;
  CREATE POLICY "Admins can read verification"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'verification' AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
  ));

  DROP POLICY IF EXISTS "Users can upload their own verification" ON storage.objects;
  CREATE POLICY "Users can upload their own verification"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'verification' AND auth.uid()::text = (storage.foldername(name))[1]);

  DROP POLICY IF EXISTS "Users can update their own verification" ON storage.objects;
  CREATE POLICY "Users can update their own verification"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'verification' AND auth.uid()::text = (storage.foldername(name))[1]);

  -- Legacy / profile-pictures
  DROP POLICY IF EXISTS "Public read access for profile pictures" ON storage.objects;
  CREATE POLICY "Public read access for profile pictures"
  ON storage.objects FOR SELECT TO public USING (bucket_id = 'profile-pictures');

  DROP POLICY IF EXISTS "Authenticated users can upload profile pictures" ON storage.objects;
  CREATE POLICY "Authenticated users can upload profile pictures"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]);

  DROP POLICY IF EXISTS "Users can update their own profile pictures" ON storage.objects;
  CREATE POLICY "Users can update their own profile pictures"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]);

  -- Portfolio bucket (legacy)
  DROP POLICY IF EXISTS "Public read access for portfolio" ON storage.objects;
  CREATE POLICY "Public read access for portfolio"
  ON storage.objects FOR SELECT TO public USING (bucket_id = 'portfolio');

  DROP POLICY IF EXISTS "Authenticated users can upload portfolio items" ON storage.objects;
  CREATE POLICY "Authenticated users can upload portfolio items"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'portfolio' AND auth.uid()::text = (storage.foldername(name))[1]);

  DROP POLICY IF EXISTS "Users can update their own portfolio items" ON storage.objects;
  CREATE POLICY "Users can update their own portfolio items"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'portfolio' AND auth.uid()::text = (storage.foldername(name))[1]);

  -- Cover banners
  DROP POLICY IF EXISTS "Public read access for cover banners" ON storage.objects;
  CREATE POLICY "Public read access for cover banners"
  ON storage.objects FOR SELECT TO public USING (bucket_id = 'cover-banners');

  DROP POLICY IF EXISTS "Authenticated users can upload cover banners" ON storage.objects;
  CREATE POLICY "Authenticated users can upload cover banners"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cover-banners' AND auth.uid()::text = (storage.foldername(name))[1]);

  DROP POLICY IF EXISTS "Users can update their own cover banners" ON storage.objects;
  CREATE POLICY "Users can update their own cover banners"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'cover-banners' AND auth.uid()::text = (storage.foldername(name))[1]);

  -- Provider media policies
  DROP POLICY IF EXISTS "Anyone can view provider media" ON storage.objects;
  CREATE POLICY "Anyone can view provider media"
  ON storage.objects FOR SELECT USING (bucket_id = 'provider-media');

  DROP POLICY IF EXISTS "Authenticated users can upload provider media" ON storage.objects;
  CREATE POLICY "Authenticated users can upload provider media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'provider-media' AND auth.role() = 'authenticated');

  DROP POLICY IF EXISTS "Users can update own provider media" ON storage.objects;
  CREATE POLICY "Users can update own provider media"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'provider-media' AND auth.uid()::text = (storage.foldername(name))[1]);

  DROP POLICY IF EXISTS "Users can delete own provider media" ON storage.objects;
  CREATE POLICY "Users can delete own provider media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'provider-media' AND auth.uid()::text = (storage.foldername(name))[1]);

  -- Worker documents storage policies
  DROP POLICY IF EXISTS "Workers can upload own documents" ON storage.objects;
  CREATE POLICY "Workers can upload own documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'worker-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

  DROP POLICY IF EXISTS "Workers can view own documents" ON storage.objects;
  CREATE POLICY "Workers can view own documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'worker-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

  DROP POLICY IF EXISTS "Admins can view all worker documents" ON storage.objects;
  CREATE POLICY "Admins can view all worker documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'worker-documents' AND public.has_role(auth.uid(), 'admin'));

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not create storage policies (buckets may not exist): %', SQLERRM;
END $$;

-- ============================================
-- PART 12: SEED DATA (with ON CONFLICT for idempotency)
-- ============================================

-- Insert default event types
INSERT INTO public.event_types (name, icon) VALUES
  ('Wedding', 'heart'),
  ('Reception', 'users'),
  ('Birthday', 'cake'),
  ('Corporate Event', 'briefcase'),
  ('Festival', 'sparkles'),
  ('Engagement', 'ring'),
  ('Anniversary', 'calendar-heart'),
  ('Religious Ceremony', 'church')
ON CONFLICT (name) DO NOTHING;

-- Insert default categories
INSERT INTO public.artist_categories (name, profession_type, description, icon, sort_order) VALUES
('Music Bands', 'music_band', 'Live bands for weddings and events', 'music', 1),
('Traditional Bands', 'traditional_band', 'Traditional Indian bands', 'music', 2),
('Maharashtra Bands', 'maharashtra_band', 'Regional Maharashtra bands', 'music', 3),
('DJs', 'dj', 'Professional DJs for all events', 'disc3', 4),
('Singers', 'singer', 'Vocal artists and singers', 'mic2', 5),
('Instrumental Artists', 'instrumental_artist', 'Musicians playing instruments', 'music', 6),
('Classical Musicians', 'classical_musician', 'Traditional classical artists', 'music', 7),
('Photographers', 'photographer', 'Professional photography services', 'camera', 8),
('Videographers', 'videographer', 'Video recording and editing', 'video', 9),
('Cinematographers', 'cinematographer', 'Cinematic video production', 'video', 10),
('Drone Operators', 'drone_operator', 'Aerial photography and videography', 'plane', 11),
('Dancers', 'dancer', 'Professional dance performers', 'users', 12),
('Choreographers', 'choreographer', 'Dance choreography services', 'users', 13),
('Kuchipudi Dancers', 'kuchipudi_dancer', 'Traditional Kuchipudi dance', 'users', 14),
('Classical Dancers', 'classical_dancer', 'Classical dance forms', 'users', 15),
('Western Dancers', 'western_dancer', 'Western dance styles', 'users', 16),
('Event Decorators', 'event_decorator', 'Event decoration services', 'palette', 17),
('Wedding Decorators', 'wedding_decorator', 'Wedding decoration specialists', 'palette', 18),
('Stage Decorators', 'stage_decorator', 'Stage and set decoration', 'palette', 19),
('Makeup Artists', 'makeup_artist', 'Professional makeup services', 'sparkles', 20),
('Mehendi Artists', 'mehendi_artist', 'Mehendi design specialists', 'sparkles', 21),
('Anchors', 'anchor', 'Event anchors and emcees', 'mic2', 22),
('Hosts', 'host', 'Event hosts and presenters', 'mic2', 23),
('Magicians', 'magician', 'Magic show performers', 'sparkles', 24),
('Stand-up Comedians', 'stand_up_comedian', 'Comedy entertainers', 'mic2', 25),
('Celebrity Artists', 'celebrity_artist', 'Celebrity performers', 'star', 26),
('Live Performers', 'live_performer', 'Various live performances', 'music', 27),
('Folk Artists', 'folk_artist', 'Traditional folk performers', 'music', 28),
('Lighting Services', 'lighting_services', 'Event lighting and effects', 'lightbulb', 29),
('Sound Services', 'sound_services', 'Sound system and audio services', 'volume2', 30),
('Event Planners', 'event_planner', 'Complete event planning', 'calendar', 31),
('Wedding Planners', 'wedding_planner', 'Wedding planning services', 'heart', 32),
('Catering Services', 'catering_services', 'Food and catering services', 'utensils', 33),
('Event Support', 'event_support', 'General event support staff', 'users', 34)
ON CONFLICT (profession_type) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order;

-- ============================================
-- PART 13: ENABLE REALTIME (with idempotency check)
-- ============================================

-- Add tables to realtime publication only if not already added
-- FIX 2: Renamed loop variable `table_name` -> `v_table_name` to avoid
--        ambiguity with pg_publication_tables.tablename column.
--        Also replaced invalid `FOR ... IN VALUES (...)` syntax with
--        `FOREACH ... IN ARRAY`, which is the correct PL/pgSQL syntax
--        for iterating over a literal list of values.
DO $$
DECLARE
  v_table_name TEXT;
BEGIN
  FOREACH v_table_name IN ARRAY ARRAY['bookings', 'notifications', 'messages']
  LOOP
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = v_table_name
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table_name);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not add table % to realtime publication: %', v_table_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================
-- PART 14: VERIFICATION QUERIES
-- ============================================

-- Check profiles table columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check storage buckets exist
SELECT id, name, public
FROM storage.buckets;

-- Check storage policies exist
SELECT policyname, tablename
FROM pg_policies
WHERE schemaname = 'storage';

-- Check all public tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check indexes exist
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
