-- ============================================
-- VOWZA FINAL MIGRATION
-- Complete database setup for empty Supabase project
-- ============================================
--
-- EXECUTION INSTRUCTIONS:
-- 1. Go to https://supabase.com/dashboard
-- 2. Select your project (vavfeataqwwbpjonknne)
-- 3. Go to SQL Editor
-- 4. Copy this entire script
-- 5. Paste and click "Run"
--
-- This script will execute successfully on a completely empty database.
-- ============================================

-- ============================================
-- PART 1: ENUMS
-- ============================================

-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('customer', 'provider', 'admin');

-- Create enum for provider professions (expanded with 30+ categories)
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

-- Create enum for booking status
CREATE TYPE public.booking_status AS ENUM (
  'requested',
  'accepted',
  'in_progress',
  'completed',
  'cancelled',
  'rejected'
);

-- Create enum for payment status
CREATE TYPE public.payment_status AS ENUM (
  'pending',
  'paid',
  'refunded',
  'failed'
);

-- Create worker verification status enum
CREATE TYPE public.verification_status AS ENUM ('pending', 'under_review', 'approved', 'rejected');

-- ============================================
-- PART 2: CORE TABLES
-- ============================================

-- Create profiles table
CREATE TABLE public.profiles (
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
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'customer',
  UNIQUE (user_id, role)
);

-- Create provider_profiles table
CREATE TABLE public.provider_profiles (
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
CREATE TABLE public.portfolio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  title TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create event_types table
CREATE TABLE public.event_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create bookings table
CREATE TABLE public.bookings (
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
CREATE TABLE public.payments (
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
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE UNIQUE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create notifications table
CREATE TABLE public.notifications (
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
CREATE TABLE public.provider_availability (
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
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create push_subscriptions table
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

-- ============================================
-- PART 3: ENHANCED AUTH TABLES
-- ============================================

-- Create refresh tokens table for JWT rotation
CREATE TABLE public.refresh_tokens (
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
CREATE TABLE public.login_attempts (
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
CREATE TABLE public.worker_profiles (
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
CREATE TABLE public.otp_verifications (
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
CREATE TABLE public.otp_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  ip_address TEXT,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create worker_documents table for document management
CREATE TABLE public.worker_documents (
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
CREATE TABLE public.worker_bank_accounts (
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
CREATE TABLE public.audit_log (
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
CREATE TABLE public.notification_settings (
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
-- PART 4: ADDITIONAL TABLES
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
-- PART 5: INDEXES
-- ============================================

-- Core tables indexes
CREATE INDEX idx_profiles_state ON public.profiles(state);
CREATE INDEX idx_profiles_city ON public.profiles(city);
CREATE INDEX idx_profiles_area ON public.profiles(area);
CREATE INDEX idx_profiles_phone_verified ON public.profiles(phone_verified);
CREATE INDEX idx_profiles_is_active ON public.profiles(is_active);
CREATE INDEX idx_profiles_last_active ON public.profiles(last_active_at DESC);

CREATE INDEX idx_provider_profession ON public.provider_profiles(profession);
CREATE INDEX idx_provider_is_verified ON public.provider_profiles(is_verified);
CREATE INDEX idx_provider_is_available ON public.provider_profiles(is_available);
CREATE INDEX idx_provider_price_range ON public.provider_profiles(price_min, price_max);

CREATE INDEX idx_bookings_customer_id ON public.bookings(customer_id);
CREATE INDEX idx_bookings_provider_id ON public.bookings(provider_id);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_bookings_event_date ON public.bookings(event_date);

CREATE INDEX idx_messages_booking_id ON public.messages(booking_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);

CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

-- Auth tables indexes
CREATE INDEX idx_refresh_tokens_user_id ON public.refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON public.refresh_tokens(expires_at);
CREATE INDEX idx_login_attempts_phone ON public.login_attempts(phone);
CREATE INDEX idx_login_attempts_created_at ON public.login_attempts(created_at);
CREATE INDEX idx_otp_phone_expires ON public.otp_verifications(phone, expires_at);
CREATE INDEX idx_rate_limit_phone ON public.otp_rate_limits(phone, window_start);
CREATE INDEX idx_worker_status ON public.worker_profiles(verification_status);
CREATE INDEX idx_worker_user ON public.worker_profiles(user_id);
CREATE INDEX idx_worker_documents_worker_id ON public.worker_documents(worker_id);
CREATE INDEX idx_worker_documents_status ON public.worker_documents(verification_status);
CREATE INDEX idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at);

-- Additional tables indexes
CREATE INDEX idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX idx_favorites_provider_id ON public.favorites(provider_id);
CREATE INDEX idx_featured_artists_provider_id ON public.featured_artists(provider_id);
CREATE INDEX idx_featured_artists_expires_at ON public.featured_artists(expires_at);
CREATE INDEX idx_invoices_booking_id ON public.invoices(booking_id);
CREATE INDEX idx_invoices_customer_id ON public.invoices(customer_id);
CREATE INDEX idx_invoices_provider_id ON public.invoices(provider_id);
CREATE INDEX idx_invoices_invoice_number ON public.invoices(invoice_number);
CREATE INDEX idx_platform_analytics_date ON public.platform_analytics(date);
CREATE INDEX idx_commission_tracking_booking_id ON public.commission_tracking(booking_id);
CREATE INDEX idx_commission_tracking_provider_id ON public.commission_tracking(provider_id);
CREATE INDEX idx_commission_tracking_status ON public.commission_tracking(status);

-- ============================================
-- PART 6: FUNCTIONS
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
CREATE OR REPLACE FUNCTION public.create_notification_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notification_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to log changes
CREATE OR REPLACE FUNCTION public.log_audit_changes()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user has specific role
CREATE OR REPLACE FUNCTION public.user_has_role(p_user_id UUID, p_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = p_user_id AND ur.role = p_role::public.app_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user roles
CREATE OR REPLACE FUNCTION public.get_user_roles(p_user_id UUID)
RETURNS TEXT[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT ur.role::TEXT FROM public.user_roles ur 
    WHERE ur.user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to automatically expire featured status
CREATE OR REPLACE FUNCTION expire_featured_artists()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expires_at < NOW() THEN
    UPDATE public.provider_profiles SET is_featured = false WHERE id = NEW.provider_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  invoice_num TEXT;
BEGIN
  invoice_num := 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('invoice_seq')::TEXT, 6, '0');
  RETURN invoice_num;
END;
$$ LANGUAGE plpgsql;

-- Function to update daily analytics
CREATE OR REPLACE FUNCTION update_daily_analytics()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create sequence for invoice numbers
CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1;

-- ============================================
-- PART 7: TRIGGERS
-- ============================================

-- Create trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create trigger for rating updates
CREATE TRIGGER on_review_created
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_provider_rating();

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_provider_profiles_updated_at BEFORE UPDATE ON public.provider_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_worker_profiles_updated_at
BEFORE UPDATE ON public.worker_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_artist_categories_updated_at BEFORE UPDATE ON public.artist_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pricing_packages_updated_at BEFORE UPDATE ON public.pricing_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_provider_time_slots_updated_at BEFORE UPDATE ON public.provider_time_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bank_details_updated_at BEFORE UPDATE ON public.bank_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create triggers for audit logging
CREATE TRIGGER audit_worker_profiles_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.worker_profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_changes();

CREATE TRIGGER audit_worker_documents_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.worker_documents
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_changes();

-- Trigger to check featured status
CREATE TRIGGER check_featured_expiry
  BEFORE INSERT OR UPDATE ON public.featured_artists
  FOR EACH ROW EXECUTE FUNCTION expire_featured_artists();

-- Trigger to update analytics on booking creation
CREATE TRIGGER update_analytics_on_booking
  AFTER INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION update_daily_analytics();

-- ============================================
-- PART 8: ENABLE RLS
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artist_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_tracking ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PART 9: RLS POLICIES
-- ============================================

-- Profiles: Users can read all, update own
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- User roles: Users can read own roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Provider profiles: Public read, providers update own
CREATE POLICY "Provider profiles are viewable by everyone" ON public.provider_profiles FOR SELECT USING (true);
CREATE POLICY "Providers can insert own profile" ON public.provider_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Providers can update own profile" ON public.provider_profiles FOR UPDATE USING (auth.uid() = user_id);

-- Portfolio items: Public read, providers manage own
CREATE POLICY "Portfolio items are viewable by everyone" ON public.portfolio_items FOR SELECT USING (true);
CREATE POLICY "Providers can insert own portfolio" ON public.portfolio_items FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid()));
CREATE POLICY "Providers can delete own portfolio" ON public.portfolio_items FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid()));

-- Event types: Public read
CREATE POLICY "Event types are viewable by everyone" ON public.event_types FOR SELECT USING (true);

-- Bookings: Customers and providers can view their own
CREATE POLICY "Users can view own bookings" ON public.bookings FOR SELECT 
  USING (auth.uid() = customer_id OR EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid()));
CREATE POLICY "Customers can create bookings" ON public.bookings FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Booking parties can update" ON public.bookings FOR UPDATE 
  USING (auth.uid() = customer_id OR EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid()));

-- Payments: Booking parties can view
CREATE POLICY "Booking parties can view payments" ON public.payments FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.bookings b 
    WHERE b.id = booking_id 
    AND (b.customer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = b.provider_id AND user_id = auth.uid()))
  ));

-- Reviews: Public read, customers create for their bookings
CREATE POLICY "Reviews are viewable by everyone" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Customers can create reviews" ON public.reviews FOR INSERT 
  WITH CHECK (auth.uid() = customer_id AND EXISTS (SELECT 1 FROM public.bookings WHERE id = booking_id AND customer_id = auth.uid() AND status = 'completed'));

-- Notifications: Users can view own
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- Provider availability: Public read, providers manage own
CREATE POLICY "Availability is viewable by everyone" ON public.provider_availability FOR SELECT USING (true);
CREATE POLICY "Providers can manage own availability" ON public.provider_availability FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid()));
CREATE POLICY "Providers can delete own availability" ON public.provider_availability FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid()));

-- Messages: Booking participants can view and send
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
CREATE POLICY "Users can view own subscriptions" ON public.push_subscriptions
FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscriptions" ON public.push_subscriptions
FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own subscriptions" ON public.push_subscriptions
FOR DELETE USING (auth.uid() = user_id);

-- Refresh tokens: Users can only access their own tokens
CREATE POLICY "Users can view own refresh tokens" ON public.refresh_tokens
FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own refresh tokens" ON public.refresh_tokens
FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own refresh tokens" ON public.refresh_tokens
FOR UPDATE USING (auth.uid() = user_id);

-- Login attempts: Read-only for users
CREATE POLICY "All users can view login attempts" ON public.login_attempts
FOR SELECT USING (true);
CREATE POLICY "Service can insert login attempts" ON public.login_attempts
FOR INSERT WITH CHECK (true);

-- Worker profiles: Workers can view/update own, admins can view all
CREATE POLICY "Workers can view own profile"
ON public.worker_profiles FOR SELECT
USING (auth.uid() = user_id);
CREATE POLICY "Workers can update own profile"
ON public.worker_profiles FOR UPDATE
USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can insert worker profile"
ON public.worker_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all workers"
ON public.worker_profiles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all workers"
ON public.worker_profiles FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- OTP tables: Allow authenticated users to manage
CREATE POLICY "Users can insert OTP verifications" ON public.otp_verifications FOR INSERT 
  WITH CHECK (true);
CREATE POLICY "Users can verify OTP" ON public.otp_verifications FOR SELECT 
  USING (true);
CREATE POLICY "Users can update OTP verifications" ON public.otp_verifications FOR UPDATE 
  USING (true);

CREATE POLICY "Service can insert rate limits" ON public.otp_rate_limits
FOR INSERT WITH CHECK (true);

-- Worker documents: Workers can view their own, admins can view all
CREATE POLICY "Workers can view own documents" ON public.worker_documents
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.worker_profiles wp 
    WHERE wp.user_id = auth.uid() AND wp.user_id = worker_id
  )
);
CREATE POLICY "Workers can insert own documents" ON public.worker_documents
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.worker_profiles wp 
    WHERE wp.user_id = auth.uid() AND wp.user_id = worker_id
  )
);
CREATE POLICY "Admins can manage all worker documents" ON public.worker_documents
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);

-- Worker bank accounts: Workers can view own, admins can view all
CREATE POLICY "Workers can view own bank accounts" ON public.worker_bank_accounts
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.worker_profiles wp 
    WHERE wp.user_id = auth.uid() AND wp.user_id = worker_id
  )
);
CREATE POLICY "Workers can insert own bank accounts" ON public.worker_bank_accounts
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.worker_profiles wp 
    WHERE wp.user_id = auth.uid() AND wp.user_id = worker_id
  )
);
CREATE POLICY "Admins can manage all worker bank accounts" ON public.worker_bank_accounts
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);

-- Audit log: Read-only for users, admins can see all
CREATE POLICY "Users can view own audit logs" ON public.audit_log
FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all audit logs" ON public.audit_log
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);

-- Notification settings: Users can manage own settings
CREATE POLICY "Users can manage own notification settings" ON public.notification_settings
FOR ALL USING (auth.uid() = user_id);

-- Artist categories: Everyone can view, admins can manage
CREATE POLICY "Everyone can view categories" ON public.artist_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage categories" ON public.artist_categories FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Pricing packages: Everyone can view, providers manage own
CREATE POLICY "Everyone can view pricing packages" ON public.pricing_packages FOR SELECT USING (true);
CREATE POLICY "Providers can manage own pricing packages" ON public.pricing_packages FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid()));

-- Provider time slots: Everyone can view, providers manage own
CREATE POLICY "Everyone can view time slots" ON public.provider_time_slots FOR SELECT USING (true);
CREATE POLICY "Providers can manage own time slots" ON public.provider_time_slots FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid()));

-- Favorites: Users can manage own, everyone can view
CREATE POLICY "Users can manage own favorites" ON public.favorites FOR ALL 
  USING (auth.uid() = user_id);
CREATE POLICY "Everyone can view favorites" ON public.favorites FOR SELECT 
  USING (true);

-- Featured artists: Everyone can view, admins can manage
CREATE POLICY "Everyone can view featured artists" ON public.featured_artists FOR SELECT USING (true);
CREATE POLICY "Admins can manage featured artists" ON public.featured_artists FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Invoices: Users can view own, admins can manage
CREATE POLICY "Users can view own invoices" ON public.invoices FOR SELECT 
  USING (auth.uid() = customer_id OR EXISTS (
    SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid()
  ));
CREATE POLICY "Admins can manage invoices" ON public.invoices FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Bank details: Providers can manage own
CREATE POLICY "Providers can manage own bank details" ON public.bank_details FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid()));

-- Analytics: Admins can manage, everyone can view
CREATE POLICY "Admins can manage analytics" ON public.platform_analytics FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Everyone can view analytics" ON public.platform_analytics FOR SELECT USING (true);

-- Commission tracking: Admins can manage, providers can view own
CREATE POLICY "Admins can manage commissions" ON public.commission_tracking FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Providers can view own commissions" ON public.commission_tracking FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid()));

-- ============================================
-- PART 10: STORAGE BUCKETS
-- ============================================

-- Create all required storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('artist-profile-images', 'artist-profile-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('customer-profile-images', 'customer-profile-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('portfolio-images', 'portfolio-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('business-documents', 'business-documents', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-documents', 'verification-documents', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('gallery', 'gallery', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('event-images', 'event-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('thumbnails', 'thumbnails', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-files', 'chat-files', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('verification', 'verification', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pictures', 'profile-pictures', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('portfolio', 'portfolio', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('cover-banners', 'cover-banners', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('provider-media', 'provider-media', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('worker-documents', 'worker-documents', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- PART 11: STORAGE POLICIES
-- ============================================

-- Artist profile images policies
CREATE POLICY "Public read access for artist profile images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'artist-profile-images');

CREATE POLICY "Authenticated artists can upload profile images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'artist-profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Artists can update their own profile images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'artist-profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Artists can delete their own profile images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'artist-profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Customer profile images policies
CREATE POLICY "Public read access for customer profile images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'customer-profile-images');

CREATE POLICY "Authenticated customers can upload profile images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'customer-profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Customers can update their own profile images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'customer-profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Customers can delete their own profile images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'customer-profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Portfolio images policies
CREATE POLICY "Public read access for portfolio images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'portfolio-images');

CREATE POLICY "Authenticated artists can upload portfolio images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'portfolio-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Artists can update their own portfolio images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'portfolio-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Artists can delete their own portfolio images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'portfolio-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Business documents policies
CREATE POLICY "Admins can read business documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'business-documents' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Users can upload their own business documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'business-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own business documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'business-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own business documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'business-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Verification documents policies
CREATE POLICY "Admins can read verification documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-documents' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Users can upload their own verification documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'verification-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own verification documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'verification-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own verification documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'verification-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Gallery policies
CREATE POLICY "Public read access for gallery"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'gallery');

CREATE POLICY "Authenticated artists can upload to gallery"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'gallery' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Artists can update their own gallery items"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'gallery' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Artists can delete their own gallery items"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'gallery' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Videos policies
CREATE POLICY "Public read access for videos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'videos');

CREATE POLICY "Authenticated artists can upload videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Artists can update their own videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Artists can delete their own videos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Contracts policies
CREATE POLICY "Admins can read contracts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'contracts' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Users can read their own contracts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'contracts' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can upload contracts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'contracts' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Event images policies
CREATE POLICY "Public read access for event images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'event-images');

CREATE POLICY "Authenticated users can upload event images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'event-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own event images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'event-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own event images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'event-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Thumbnails policies
CREATE POLICY "Public read access for thumbnails"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'thumbnails');

CREATE POLICY "Authenticated users can upload thumbnails"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own thumbnails"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own thumbnails"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'thumbnails' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Chat files policies
CREATE POLICY "Participants can read chat files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-files' AND
  (
    auth.uid()::text = (storage.foldername(name))[1] OR
    auth.uid()::text = (storage.foldername(name))[2]
  )
);

CREATE POLICY "Chat participants can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-files' AND
  (
    auth.uid()::text = (storage.foldername(name))[1] OR
    auth.uid()::text = (storage.foldername(name))[2]
  )
);

-- Payment proofs policies
CREATE POLICY "Admins can read payment proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-proofs' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Users can upload their own payment proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-proofs' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can read their own payment proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-proofs' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Documents policies (generic)
CREATE POLICY "Admins can read documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Verification bucket policies (generic)
CREATE POLICY "Admins can read verification"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Users can upload their own verification"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'verification' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own verification"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'verification' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Legacy policies (for compatibility)
CREATE POLICY "Public read access for profile pictures"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-pictures');

CREATE POLICY "Authenticated users can upload profile pictures"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own profile pictures"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'profile-pictures' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public read access for portfolio"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'portfolio');

CREATE POLICY "Authenticated users can upload portfolio items"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'portfolio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own portfolio items"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'portfolio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public read access for cover banners"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'cover-banners');

CREATE POLICY "Authenticated users can upload cover banners"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'cover-banners' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own cover banners"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'cover-banners' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Provider media policies
CREATE POLICY "Anyone can view provider media"
ON storage.objects FOR SELECT
USING (bucket_id = 'provider-media');

CREATE POLICY "Authenticated users can upload provider media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'provider-media' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update own provider media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'provider-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own provider media"
ON storage.objects FOR DELETE
USING (bucket_id = 'provider-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Worker documents policies
CREATE POLICY "Workers can upload own documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'worker-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Workers can view own documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'worker-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all worker documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'worker-documents' AND public.has_role(auth.uid(), 'admin'));

-- ============================================
-- PART 12: SEED DATA
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
-- PART 13: ENABLE REALTIME
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- ============================================
-- PART 14: VERIFICATION QUERIES
-- ============================================

-- Check profiles table has new columns
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

-- Check new tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check indexes exist
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
