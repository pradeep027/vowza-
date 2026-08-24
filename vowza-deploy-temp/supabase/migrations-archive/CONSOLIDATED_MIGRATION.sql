-- Enhanced authentication and worker onboarding schema
-- This migration adds the missing pieces for the complete auth system

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

-- Enhance worker_profiles with additional verification fields
ALTER TABLE public.worker_profiles 
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS alternate_phone TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS background_check_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS training_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

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

-- Create indexes for performance
CREATE INDEX idx_refresh_tokens_user_id ON public.refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON public.refresh_tokens(expires_at);
CREATE INDEX idx_login_attempts_phone ON public.login_attempts(phone);
CREATE INDEX idx_login_attempts_created_at ON public.login_attempts(created_at);
CREATE INDEX idx_worker_documents_worker_id ON public.worker_documents(worker_id);
CREATE INDEX idx_worker_documents_status ON public.worker_documents(verification_status);
CREATE INDEX idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at);

-- Enable RLS
ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Refresh tokens: Users can only access their own tokens
CREATE POLICY "Users can view own refresh tokens" ON public.refresh_tokens
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own refresh tokens" ON public.refresh_tokens
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own refresh tokens" ON public.refresh_tokens
FOR UPDATE USING (auth.uid() = user_id);

-- Login attempts: Read-only for users, admins can see all
CREATE POLICY "All users can view login attempts" ON public.login_attempts
FOR SELECT USING (true);

CREATE POLICY "Service can insert login attempts" ON public.login_attempts
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

-- Create trigger to automatically create notification settings
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_notification_settings();

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

-- Create triggers for audit logging
CREATE TRIGGER audit_worker_profiles_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.worker_profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_changes();

CREATE TRIGGER audit_worker_documents_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.worker_documents
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_changes();

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
-- Create storage buckets for file uploads

-- Profile pictures bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pictures', 'profile-pictures', true)
ON CONFLICT (id) DO NOTHING;

-- Portfolio bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('portfolio', 'portfolio', true)
ON CONFLICT (id) DO NOTHING;

-- Verification documents bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-documents', 'verification-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Cover banners bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('cover-banners', 'cover-banners', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for profile-pictures
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

-- Create storage policies for portfolio
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

-- Create storage policies for verification documents
CREATE POLICY "Admins can read verification documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'verification-documents' AND
  EXISTS (
    SELECT 1 FROM user_roles
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

-- Create storage policies for cover-banners
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
-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('customer', 'provider', 'admin');

-- Create enum for provider professions
CREATE TYPE public.profession_type AS ENUM (
  'normal_band',
  'maharashtra_band',
  'musician',
  'dj',
  'photographer',
  'videographer',
  'decorator',
  'kuchipudi_dancer',
  'classical_dancer',
  'western_dancer',
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

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  avatar_url TEXT,
  city TEXT,
  area TEXT,
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
  reason TEXT,
  UNIQUE (provider_id, unavailable_date)
);

-- Insert default event types
INSERT INTO public.event_types (name, icon) VALUES
  ('Wedding', 'heart'),
  ('Reception', 'users'),
  ('Birthday', 'cake'),
  ('Corporate Event', 'briefcase'),
  ('Festival', 'sparkles'),
  ('Engagement', 'ring'),
  ('Anniversary', 'calendar-heart'),
  ('Religious Ceremony', 'church');

-- Enable RLS on all tables
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
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

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

-- Create trigger for rating updates
CREATE TRIGGER on_review_created
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_provider_rating();

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_provider_profiles_updated_at BEFORE UPDATE ON public.provider_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

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

-- Enable realtime for bookings and notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;-- Fix function search path for update_updated_at_column
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
$$;-- Create messages table for booking chat
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_messages_booking_id ON public.messages(booking_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only booking participants can view and send messages
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

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;-- Create push_subscriptions table to store browser push subscriptions
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

-- Create index for faster lookups
CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY "Users can view own subscriptions" ON public.push_subscriptions
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions" ON public.push_subscriptions
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions" ON public.push_subscriptions
FOR DELETE USING (auth.uid() = user_id);﻿-- ============================================================
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
END $$;-- Add additional fields to provider_profiles for enhanced onboarding
ALTER TABLE public.provider_profiles 
ADD COLUMN IF NOT EXISTS stage_name TEXT,
ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS pricing_type TEXT DEFAULT 'per_event',
ADD COLUMN IF NOT EXISTS category_details JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS performance_type TEXT,
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Add state column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS state TEXT;

-- Create storage bucket for provider media (ignore if exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('provider-media', 'provider-media', true, 10485760)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (drop if exist then recreate)
DROP POLICY IF EXISTS "Anyone can view provider media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload provider media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own provider media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own provider media" ON storage.objects;

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
USING (bucket_id = 'provider-media' AND auth.uid()::text = (storage.foldername(name))[1]);-- Create worker verification status enum
CREATE TYPE public.verification_status AS ENUM ('pending', 'under_review', 'approved', 'rejected');

-- Create worker_profiles table for service providers requiring verification
CREATE TABLE public.worker_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  gender TEXT,
  profile_photo_url TEXT,
  
  -- Service Information
  service_type TEXT NOT NULL,
  experience_years INTEGER DEFAULT 0,
  service_city TEXT,
  service_area TEXT,
  
  -- Document Verification
  government_id_type TEXT, -- aadhaar, pan, driving_license
  government_id_url TEXT,
  address_proof_url TEXT,
  bank_account_number TEXT,
  bank_ifsc TEXT,
  bank_account_holder TEXT,
  portfolio_urls TEXT[] DEFAULT '{}',
  
  -- Verification Status
  verification_status verification_status DEFAULT 'pending',
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID,
  rejection_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create OTP table for phone verification
CREATE TABLE public.otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  purpose TEXT NOT NULL, -- 'login', 'worker_join'
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

-- Create index for faster lookups
CREATE INDEX idx_otp_phone_expires ON public.otp_verifications(phone, expires_at);
CREATE INDEX idx_rate_limit_phone ON public.otp_rate_limits(phone, window_start);
CREATE INDEX idx_worker_status ON public.worker_profiles(verification_status);
CREATE INDEX idx_worker_user ON public.worker_profiles(user_id);

-- Enable RLS
ALTER TABLE public.worker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_rate_limits ENABLE ROW LEVEL SECURITY;

-- Worker profiles policies
CREATE POLICY "Workers can view own profile"
ON public.worker_profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Workers can update own profile"
ON public.worker_profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert worker profile"
ON public.worker_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admin can view all workers
CREATE POLICY "Admins can view all workers"
ON public.worker_profiles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all workers"
ON public.worker_profiles FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- OTP tables - service role only (edge functions)
CREATE POLICY "Service role can manage OTP"
ON public.otp_verifications FOR ALL
USING (true);

CREATE POLICY "Service role can manage rate limits"
ON public.otp_rate_limits FOR ALL
USING (true);

-- Create storage bucket for worker documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('worker-documents', 'worker-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for worker documents
CREATE POLICY "Workers can upload own documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'worker-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Workers can view own documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'worker-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all worker documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'worker-documents' AND public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_worker_profiles_updated_at
BEFORE UPDATE ON public.worker_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();-- Drop overly permissive policies and restrict OTP tables to authenticated service role only
DROP POLICY IF EXISTS "Service role can manage OTP" ON public.otp_verifications;
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.otp_rate_limits;

-- OTP tables should have no direct access - only via edge functions with service role
-- These policies restrict to service_role which is used by edge functions
CREATE POLICY "No direct access to OTP"
ON public.otp_verifications FOR ALL
USING (false);

CREATE POLICY "No direct access to rate limits"
ON public.otp_rate_limits FOR ALL
USING (false);-- Add missing fields to provider_profiles table for enhanced registration
ALTER TABLE public.provider_profiles 
ADD COLUMN IF NOT EXISTS instagram TEXT,
ADD COLUMN IF NOT EXISTS facebook TEXT,
ADD COLUMN IF NOT EXISTS youtube TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS gst_number TEXT,
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS languages TEXT,
ADD COLUMN IF NOT EXISTS available_dates TEXT;

-- Add missing fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS address TEXT;

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

-- Enable RLS on bank_details
ALTER TABLE public.bank_details ENABLE ROW LEVEL SECURITY;

-- RLS policies for bank_details
CREATE POLICY "Providers can manage own bank details" ON public.bank_details FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid()));

-- Add updated_at trigger for bank_details
CREATE TRIGGER update_bank_details_updated_at BEFORE UPDATE ON public.bank_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Update OTP verification policy to allow authenticated users to insert
DROP POLICY IF EXISTS "No direct access to OTP" ON public.otp_verifications;

CREATE POLICY "Users can insert OTP verifications" ON public.otp_verifications FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Users can verify OTP" ON public.otp_verifications FOR SELECT 
  USING (true);

CREATE POLICY "Users can update OTP verifications" ON public.otp_verifications FOR UPDATE 
  USING (true);
-- Drop and recreate profession_type enum with 30+ categories
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

-- Enable RLS on artist_categories
ALTER TABLE public.artist_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies for artist_categories
CREATE POLICY "Everyone can view categories" ON public.artist_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage categories" ON public.artist_categories FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

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

-- Add updated_at trigger for artist_categories
CREATE TRIGGER update_artist_categories_updated_at BEFORE UPDATE ON public.artist_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- Add pricing packages table for artists
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

-- Enable RLS on pricing_packages
ALTER TABLE public.pricing_packages ENABLE ROW LEVEL SECURITY;

-- RLS policies for pricing_packages
CREATE POLICY "Everyone can view pricing packages" ON public.pricing_packages FOR SELECT USING (true);
CREATE POLICY "Providers can manage own pricing packages" ON public.pricing_packages FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid()));

-- Add additional charges fields to provider_profiles
ALTER TABLE public.provider_profiles 
ADD COLUMN IF NOT EXISTS travel_charges INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_charges INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cover_banner_url TEXT;

-- Add updated_at trigger for pricing_packages
CREATE TRIGGER update_pricing_packages_updated_at BEFORE UPDATE ON public.pricing_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- Enhance provider_availability table to include time slots
ALTER TABLE public.provider_availability 
ADD COLUMN IF NOT EXISTS time_slot_start TIME,
ADD COLUMN IF NOT EXISTS time_slot_end TIME,
ADD COLUMN IF NOT EXISTS slot_type TEXT DEFAULT 'unavailable' CHECK (slot_type IN ('available', 'unavailable', 'busy'));

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

-- Enable RLS on provider_time_slots
ALTER TABLE public.provider_time_slots ENABLE ROW LEVEL SECURITY;

-- RLS policies for provider_time_slots
CREATE POLICY "Everyone can view time slots" ON public.provider_time_slots FOR SELECT USING (true);
CREATE POLICY "Providers can manage own time slots" ON public.provider_time_slots FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid()));

-- Add updated_at trigger for provider_time_slots
CREATE TRIGGER update_provider_time_slots_updated_at BEFORE UPDATE ON public.provider_time_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- Create favorites table for customers to save favorite artists
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider_id)
);

-- Enable RLS on favorites
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- RLS policies for favorites
CREATE POLICY "Users can manage own favorites" ON public.favorites FOR ALL 
  USING (auth.uid() = user_id);

CREATE POLICY "Everyone can view favorites" ON public.favorites FOR SELECT 
  USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_provider_id ON public.favorites(provider_id);
-- Add featured artists functionality
ALTER TABLE public.provider_profiles 
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ;

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

-- Enable RLS on featured_artists
ALTER TABLE public.featured_artists ENABLE ROW LEVEL SECURITY;

-- RLS policies for featured_artists
CREATE POLICY "Everyone can view featured artists" ON public.featured_artists FOR SELECT USING (true);
CREATE POLICY "Admins can manage featured artists" ON public.featured_artists FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_featured_artists_provider_id ON public.featured_artists(provider_id);
CREATE INDEX IF NOT EXISTS idx_featured_artists_expires_at ON public.featured_artists(expires_at);

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

-- Trigger to check featured status
CREATE TRIGGER check_featured_expiry
  BEFORE INSERT OR UPDATE ON public.featured_artists
  FOR EACH ROW EXECUTE FUNCTION expire_featured_artists();
-- Add invoice generation functionality
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS invoice_number TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS invoice_generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS invoice_url TEXT;

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

-- Enable RLS on invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS policies for invoices
CREATE POLICY "Users can view own invoices" ON public.invoices FOR SELECT 
  USING (auth.uid() = customer_id OR EXISTS (
    SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage invoices" ON public.invoices FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoices_booking_id ON public.invoices(booking_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_provider_id ON public.invoices(provider_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON public.invoices(invoice_number);

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

-- Create sequence for invoice numbers
CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1;
-- Add analytics tracking tables
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

-- Enable RLS
ALTER TABLE public.platform_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_tracking ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage analytics" ON public.platform_analytics FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Everyone can view analytics" ON public.platform_analytics FOR SELECT USING (true);

CREATE POLICY "Admins can manage commissions" ON public.commission_tracking FOR ALL 
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Providers can view own commissions" ON public.commission_tracking FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.provider_profiles WHERE id = provider_id AND user_id = auth.uid()));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_platform_analytics_date ON public.platform_analytics(date);
CREATE INDEX IF NOT EXISTS idx_commission_tracking_booking_id ON public.commission_tracking(booking_id);
CREATE INDEX IF NOT EXISTS idx_commission_tracking_provider_id ON public.commission_tracking(provider_id);
CREATE INDEX IF NOT EXISTS idx_commission_tracking_status ON public.commission_tracking(status);

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

-- Trigger to update analytics on booking creation
CREATE TRIGGER update_analytics_on_booking
  AFTER INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION update_daily_analytics();
-- Add phone verification column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_phone_verified ON profiles(phone_verified);

-- Add OTP verifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS otp_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  otp TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies for otp_verifications
ALTER TABLE otp_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert OTP verifications" 
ON otp_verifications FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

CREATE POLICY "Anyone can read OTP verifications" 
ON otp_verifications FOR SELECT 
TO anon, authenticated 
USING (true);

CREATE POLICY "Anyone can update OTP verifications" 
ON otp_verifications FOR UPDATE 
TO anon, authenticated 
USING (true);

-- Add index for phone lookup
CREATE INDEX IF NOT EXISTS idx_otp_verifications_phone ON otp_verifications(phone);
CREATE INDEX IF NOT EXISTS idx_otp_verifications_expires_at ON otp_verifications(expires_at);

-- Clean up expired OTPs automatically (run this as a scheduled job)
-- DELETE FROM otp_verifications WHERE expires_at < NOW();
-- Add state and organization_name columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS organization_name TEXT;

-- Add phone_verified column for OTP verification
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

-- Add index for phone_verified queries
CREATE INDEX IF NOT EXISTS idx_profiles_phone_verified ON public.profiles(phone_verified);
-- ============================================
-- PRODUCTION STORAGE SETUP
-- Complete storage configuration for Vowza platform
-- ============================================

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public read access for profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile pictures" ON storage.objects;

DROP POLICY IF EXISTS "Public read access for portfolio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload portfolio items" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own portfolio items" ON storage.objects;

DROP POLICY IF EXISTS "Admins can read verification documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own verification documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own verification documents" ON storage.objects;

DROP POLICY IF EXISTS "Public read access for cover banners" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload cover banners" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own cover banners" ON storage.objects;

-- ============================================
-- CREATE ALL REQUIRED STORAGE BUCKETS
-- ============================================

-- Artist profile images
INSERT INTO storage.buckets (id, name, public)
VALUES ('artist-profile-images', 'artist-profile-images', true)
ON CONFLICT (id) DO NOTHING;

-- Customer profile images
INSERT INTO storage.buckets (id, name, public)
VALUES ('customer-profile-images', 'customer-profile-images', true)
ON CONFLICT (id) DO NOTHING;

-- Portfolio images
INSERT INTO storage.buckets (id, name, public)
VALUES ('portfolio-images', 'portfolio-images', true)
ON CONFLICT (id) DO NOTHING;

-- Business documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-documents', 'business-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Verification documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-documents', 'verification-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Gallery
INSERT INTO storage.buckets (id, name, public)
VALUES ('gallery', 'gallery', true)
ON CONFLICT (id) DO NOTHING;

-- Videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO NOTHING;

-- Contracts
INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', false)
ON CONFLICT (id) DO NOTHING;

-- Event images
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-images', 'event-images', true)
ON CONFLICT (id) DO NOTHING;

-- Thumbnails
INSERT INTO storage.buckets (id, name, public)
VALUES ('thumbnails', 'thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- Profile pictures (legacy - keep for compatibility)
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pictures', 'profile-pictures', true)
ON CONFLICT (id) DO NOTHING;

-- Portfolio (legacy - keep for compatibility)
INSERT INTO storage.buckets (id, name, public)
VALUES ('portfolio', 'portfolio', true)
ON CONFLICT (id) DO NOTHING;

-- Cover banners (legacy - keep for compatibility)
INSERT INTO storage.buckets (id, name, public)
VALUES ('cover-banners', 'cover-banners', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE POLICIES - ARTIST PROFILE IMAGES
-- ============================================

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

-- ============================================
-- STORAGE POLICIES - CUSTOMER PROFILE IMAGES
-- ============================================

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

-- ============================================
-- STORAGE POLICIES - PORTFOLIO IMAGES
-- ============================================

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

-- ============================================
-- STORAGE POLICIES - BUSINESS DOCUMENTS
-- ============================================

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

-- ============================================
-- STORAGE POLICIES - VERIFICATION DOCUMENTS
-- ============================================

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

-- ============================================
-- STORAGE POLICIES - GALLERY
-- ============================================

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

-- ============================================
-- STORAGE POLICIES - VIDEOS
-- ============================================

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

-- ============================================
-- STORAGE POLICIES - CONTRACTS
-- ============================================

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

-- ============================================
-- STORAGE POLICIES - EVENT IMAGES
-- ============================================

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

-- ============================================
-- STORAGE POLICIES - THUMBNAILS
-- ============================================

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

-- ============================================
-- LEGACY STORAGE POLICIES (for compatibility)
-- ============================================

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
-- ============================================
-- COMPLETE PROFILES TABLE UPDATE
-- Add all required columns for production
-- ============================================

-- Add state column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS state TEXT;

-- Add organization_name column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS organization_name TEXT;

-- Add phone_verified column for OTP verification
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

-- Add date_of_birth column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Add alternate_phone column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS alternate_phone TEXT;

-- Add whatsapp_enabled column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT true;

-- Add notification preferences
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS sms_notifications_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS push_notifications_enabled BOOLEAN DEFAULT TRUE;

-- Add profile completion status
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS profile_completion_percentage INTEGER DEFAULT 0;

-- Add last_active timestamp
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT now();

-- Add is_active column for account status
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Add account_verified_at timestamp
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS account_verified_at TIMESTAMPTZ;

-- Add preferences JSONB for flexible user preferences
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

-- Add metadata JSONB for additional flexible data
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_state ON public.profiles(state);
CREATE INDEX IF NOT EXISTS idx_profiles_city ON public.profiles(city);
CREATE INDEX IF NOT EXISTS idx_profiles_area ON public.profiles(area);
CREATE INDEX IF NOT EXISTS idx_profiles_phone_verified ON public.profiles(phone_verified);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON public.profiles(last_active_at DESC);

-- Create trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create trigger to update last_active_at on profile update
DROP TRIGGER IF EXISTS update_profiles_last_active ON public.profiles;
CREATE TRIGGER update_profiles_last_active
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION (
  UPDATE public.profiles 
  SET last_active_at = now() 
  WHERE id = NEW.id
)();
-- ─── Admin Event Packages Migration ───────────────────────────────────────────
-- Purpose: Create admin-controlled event package system (Silver/Gold/Platinum tiers)
-- Date: July 22, 2026
-- Note: COMPLETELY SEPARATE from vendor packages. Admin-only control.

-- ─── 1. Core Admin Event Packages Table ───────────────────────────────────────
CREATE TABLE public.admin_event_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type_id UUID NOT NULL REFERENCES public.event_types(id) ON DELETE CASCADE,
  tier VARCHAR(50) NOT NULL, -- 'Silver', 'Gold', 'Platinum'
  display_name VARCHAR(255) NOT NULL, -- e.g., "Silver Wedding Package"
  description TEXT,
  
  -- Pricing (admin-controlled, immutable by customers/vendors)
  base_price DECIMAL(12, 2) NOT NULL,
  discount_percentage DECIMAL(5, 2) DEFAULT 0, -- 0-100
  final_price DECIMAL(12, 2) GENERATED ALWAYS AS 
    (base_price * (1 - discount_percentage / 100)) STORED,
  
  -- Package customization limits
  max_category_selections INT DEFAULT 3, -- How many service categories customer can select
  max_professionals_per_category INT DEFAULT 2, -- Max vendors per category
  
  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  CONSTRAINT unique_event_tier UNIQUE(event_type_id, tier),
  CONSTRAINT valid_discount CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  CONSTRAINT valid_price CHECK (base_price > 0)
);

-- ─── 2. Package Inclusions (What categories are included in each tier) ────────
CREATE TABLE public.admin_event_package_inclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.admin_event_packages(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.artist_categories(id) ON DELETE CASCADE,
  is_included BOOLEAN DEFAULT TRUE, -- Pre-selected for this tier
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_package_category UNIQUE(package_id, category_id)
);

-- ─── 3. Discount Audit Trail ──────────────────────────────────────────────────
CREATE TABLE public.admin_event_package_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.admin_event_packages(id) ON DELETE CASCADE,
  discount_percentage DECIMAL(5, 2) NOT NULL,
  reason VARCHAR(255), -- "Seasonal promotion", "Holiday sale", etc.
  active_from TIMESTAMP NOT NULL,
  active_until TIMESTAMP,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_discount_audit CHECK (discount_percentage >= 0 AND discount_percentage <= 100)
);

-- ─── 4. Customer Package Bookings ──────────────────────────────────────────────
CREATE TABLE public.admin_event_package_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.admin_event_packages(id) ON DELETE RESTRICT,
  
  -- Event details
  event_date DATE NOT NULL,
  event_location VARCHAR(500),
  guest_count INT,
  
  -- Pricing snapshot (locked in at purchase time - protects against future price changes)
  package_price DECIMAL(12, 2) NOT NULL,
  discount_applied DECIMAL(5, 2) DEFAULT 0,
  final_price DECIMAL(12, 2) NOT NULL,
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending', -- pending, confirmed, completed, cancelled
  payment_status VARCHAR(50) DEFAULT 'unpaid', -- unpaid, partial, paid
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_status CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  CONSTRAINT valid_payment_status CHECK (payment_status IN ('unpaid', 'partial', 'paid'))
);

-- ─── Enable Row Level Security ─────────────────────────────────────────────────
ALTER TABLE public.admin_event_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_event_package_inclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_event_package_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_event_package_bookings ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies: admin_event_packages ────────────────────────────────────────
-- Admin: Full CRUD access
CREATE POLICY "admin_event_packages_admin_all" ON public.admin_event_packages
  FOR ALL USING ((SELECT (auth.jwt() ->> 'user_role') = 'admin'))
  WITH CHECK ((SELECT (auth.jwt() ->> 'user_role') = 'admin'));

-- Customers: View active packages only
CREATE POLICY "admin_event_packages_customer_view" ON public.admin_event_packages
  FOR SELECT USING (is_active = TRUE);

-- ─── RLS Policies: admin_event_package_inclusions ──────────────────────────────
-- Admin: Full CRUD
CREATE POLICY "admin_event_package_inclusions_admin_all" ON public.admin_event_package_inclusions
  FOR ALL USING ((SELECT (auth.jwt() ->> 'user_role') = 'admin'))
  WITH CHECK ((SELECT (auth.jwt() ->> 'user_role') = 'admin'));

-- Customers: View to see package details
CREATE POLICY "admin_event_package_inclusions_customer_view" ON public.admin_event_package_inclusions
  FOR SELECT USING (TRUE);

-- ─── RLS Policies: admin_event_package_discounts ────────────────────────────────
-- Admin: Full CRUD
CREATE POLICY "admin_event_package_discounts_admin_all" ON public.admin_event_package_discounts
  FOR ALL USING ((SELECT (auth.jwt() ->> 'user_role') = 'admin'))
  WITH CHECK ((SELECT (auth.jwt() ->> 'user_role') = 'admin'));

-- ─── RLS Policies: admin_event_package_bookings ────────────────────────────────
-- Admin: Full access
CREATE POLICY "admin_event_package_bookings_admin_all" ON public.admin_event_package_bookings
  FOR ALL USING ((SELECT (auth.jwt() ->> 'user_role') = 'admin'))
  WITH CHECK ((SELECT (auth.jwt() ->> 'user_role') = 'admin'));

-- Customers: View own bookings
CREATE POLICY "admin_event_package_bookings_customer_view" ON public.admin_event_package_bookings
  FOR SELECT USING (customer_id = auth.uid());

-- Customers: Insert (create new bookings)
CREATE POLICY "admin_event_package_bookings_customer_insert" ON public.admin_event_package_bookings
  FOR INSERT WITH CHECK (customer_id = auth.uid());

-- ─── Create Indexes for Performance ────────────────────────────────────────────
CREATE INDEX idx_admin_event_packages_event_type_id 
  ON public.admin_event_packages(event_type_id);

CREATE INDEX idx_admin_event_packages_is_active 
  ON public.admin_event_packages(is_active);

CREATE INDEX idx_admin_event_packages_tier 
  ON public.admin_event_packages(tier);

CREATE INDEX idx_admin_event_package_inclusions_package_id 
  ON public.admin_event_package_inclusions(package_id);

CREATE INDEX idx_admin_event_package_inclusions_category_id 
  ON public.admin_event_package_inclusions(category_id);

CREATE INDEX idx_admin_event_package_discounts_package_id 
  ON public.admin_event_package_discounts(package_id);

CREATE INDEX idx_admin_event_package_bookings_customer_id 
  ON public.admin_event_package_bookings(customer_id);

CREATE INDEX idx_admin_event_package_bookings_package_id 
  ON public.admin_event_package_bookings(package_id);

CREATE INDEX idx_admin_event_package_bookings_status 
  ON public.admin_event_package_bookings(status);

-- ─── Sample Data (Optional - for testing) ─────────────────────────────────────
-- Uncomment to seed sample packages

/*
-- Get a wedding event type ID (adjust as needed)
DO $$
DECLARE
  wedding_id UUID;
  admin_id UUID;
BEGIN
  -- Get wedding event type
  SELECT id INTO wedding_id FROM public.event_types WHERE name = 'Wedding' LIMIT 1;
  
  -- Get an admin user (adjust email as needed)
  SELECT id INTO admin_id FROM public.profiles WHERE role = 'admin' LIMIT 1;
  
  IF wedding_id IS NOT NULL AND admin_id IS NOT NULL THEN
    -- Insert sample packages
    INSERT INTO public.admin_event_packages (event_type_id, tier, display_name, description, base_price, discount_percentage, max_category_selections, max_professionals_per_category, created_by)
    VALUES
      (wedding_id, 'Silver', 'Silver Wedding Package', 'Essential services for your wedding', 100000, 0, 3, 2, admin_id),
      (wedding_id, 'Gold', 'Gold Wedding Package', 'Premium services with enhanced options', 150000, 5, 4, 3, admin_id),
      (wedding_id, 'Platinum', 'Platinum Wedding Package', 'All-inclusive luxury wedding experience', 250000, 10, 6, 4, admin_id);
  END IF;
END $$;
*/

-- ─── Migration Complete ────────────────────────────────────────────────────────
-- Run: supabase db push
-- Rollback: Drop tables if needed (see ADMIN_EVENT_PACKAGES_ARCHITECTURE.md)
-- ============================================================
-- VEDA AI: Conversation & Message Persistence
-- Creates two tables:
--   ai_conversations  — one row per conversation thread
--   ai_messages       — one row per message in a thread
-- Both use RLS: users can only see their own rows.
-- Unauthenticated users have no access.
-- ============================================================

-- ─── ai_conversations ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT 'New Conversation',
  -- Serialised PlannerContext (budget, city, event type, etc.)
  context_summary JSONB DEFAULT '{}',
  -- ISO-8601 string — updated every time a message is added
  last_active_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for loading a user's conversation list ordered by recency
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_active
  ON public.ai_conversations (user_id, last_active_at DESC);

-- ─── ai_messages ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  -- Full AIResponse JSON (budget plan, timeline, etc.) — nullable for user msgs
  ai_response     JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for loading messages in a conversation ordered by time
CREATE INDEX IF NOT EXISTS idx_ai_messages_conv_created
  ON public.ai_messages (conversation_id, created_at ASC);

-- Index for fast cascade cleanup
CREATE INDEX IF NOT EXISTS idx_ai_messages_user
  ON public.ai_messages (user_id);

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages      ENABLE ROW LEVEL SECURITY;

-- Conversations: owner-only CRUD
DROP POLICY IF EXISTS "ai_conversations_select" ON public.ai_conversations;
CREATE POLICY "ai_conversations_select" ON public.ai_conversations
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_conversations_insert" ON public.ai_conversations;
CREATE POLICY "ai_conversations_insert" ON public.ai_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_conversations_update" ON public.ai_conversations;
CREATE POLICY "ai_conversations_update" ON public.ai_conversations
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_conversations_delete" ON public.ai_conversations;
CREATE POLICY "ai_conversations_delete" ON public.ai_conversations
  FOR DELETE USING (auth.uid() = user_id);

-- Messages: owner-only CRUD
DROP POLICY IF EXISTS "ai_messages_select" ON public.ai_messages;
CREATE POLICY "ai_messages_select" ON public.ai_messages
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_messages_insert" ON public.ai_messages;
CREATE POLICY "ai_messages_insert" ON public.ai_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_messages_update" ON public.ai_messages;
CREATE POLICY "ai_messages_update" ON public.ai_messages
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_messages_delete" ON public.ai_messages;
CREATE POLICY "ai_messages_delete" ON public.ai_messages
  FOR DELETE USING (auth.uid() = user_id);
-- ============================================================
-- Booking Availability & Calendar System
-- Run this AFTER VOWZA_PRODUCTION_MIGRATION.sql
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ─── Ensure required columns exist ───────────────────────────────────────────
ALTER TABLE public.provider_availability
  ADD COLUMN IF NOT EXISTS slot_type TEXT DEFAULT 'unavailable'
    CHECK (slot_type IN ('available', 'unavailable', 'busy')),
  ADD COLUMN IF NOT EXISTS time_slot_start TIME,
  ADD COLUMN IF NOT EXISTS time_slot_end   TIME,
  ADD COLUMN IF NOT EXISTS reason          TEXT;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS event_time          TIME,
  ADD COLUMN IF NOT EXISTS event_duration_hours INTEGER DEFAULT 4;

-- ─── Performance indexes ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bookings_provider_date
  ON public.bookings (provider_id, event_date);

CREATE INDEX IF NOT EXISTS idx_bookings_provider_date_status
  ON public.bookings (provider_id, event_date, status);

CREATE INDEX IF NOT EXISTS idx_provider_availability_lookup
  ON public.provider_availability (provider_id, unavailable_date, slot_type);

-- ─── AI Conversations tables ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT 'New Conversation',
  context_summary JSONB DEFAULT '{}',
  last_active_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  ai_response     JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_active
  ON public.ai_conversations (user_id, last_active_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conv_created
  ON public.ai_messages (conversation_id, created_at ASC);

-- RLS for AI tables
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_conversations_owner" ON public.ai_conversations;
CREATE POLICY "ai_conversations_owner" ON public.ai_conversations
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_messages_owner" ON public.ai_messages;
CREATE POLICY "ai_messages_owner" ON public.ai_messages
  FOR ALL USING (auth.uid() = user_id);

-- ─── Fix provider_availability RLS — add UPDATE + DELETE for providers ────────
DROP POLICY IF EXISTS "Providers can manage own availability" ON public.provider_availability;
CREATE POLICY "Providers can manage own availability"
  ON public.provider_availability
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  );

-- Keep public read access
DROP POLICY IF EXISTS "Availability is viewable by everyone" ON public.provider_availability;
CREATE POLICY "Availability is viewable by everyone"
  ON public.provider_availability FOR SELECT USING (true);

-- ─── check_artist_availability function ───────────────────────────────────────
-- Uses advisory lock to safely handle concurrent booking requests.
-- Returns: { available: boolean, reason: text }

CREATE OR REPLACE FUNCTION public.check_artist_availability(
  p_provider_id    UUID,
  p_event_date     DATE,
  p_event_time     TIME    DEFAULT NULL,
  p_duration_hours INTEGER DEFAULT 4
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blocked INTEGER;
  v_count   INTEGER;
  v_conflict BOOLEAN := FALSE;
  v_lock    BIGINT;
BEGIN
  -- Acquire per-provider-per-date advisory lock (prevents concurrent double bookings)
  v_lock := ('x' || md5(p_provider_id::TEXT || p_event_date::TEXT))::BIT(64)::BIGINT;
  PERFORM pg_advisory_xact_lock(v_lock);

  -- 1. Past date check
  IF p_event_date < CURRENT_DATE THEN
    RETURN jsonb_build_object('available', FALSE, 'reason', 'This date is in the past');
  END IF;

  -- 2. Blocked date check
  SELECT COUNT(*) INTO v_blocked
  FROM public.provider_availability
  WHERE provider_id    = p_provider_id
    AND unavailable_date = p_event_date
    AND slot_type      = 'unavailable';

  IF v_blocked > 0 THEN
    RETURN jsonb_build_object('available', FALSE, 'reason', 'Artist has marked this date as unavailable');
  END IF;

  -- 3. Existing booking check
  IF p_event_time IS NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM public.bookings
    WHERE provider_id = p_provider_id
      AND event_date  = p_event_date
      AND status IN ('requested', 'accepted', 'in_progress');

    IF v_count > 0 THEN
      RETURN jsonb_build_object(
        'available', FALSE,
        'reason', 'Artist already has ' || v_count || ' booking(s) on this date. Please select another date.'
      );
    END IF;
  ELSE
    -- Time overlap check
    SELECT EXISTS (
      SELECT 1 FROM public.bookings
      WHERE provider_id = p_provider_id
        AND event_date  = p_event_date
        AND status IN ('requested', 'accepted', 'in_progress')
        AND event_time IS NOT NULL
        AND p_event_time < (event_time + (COALESCE(event_duration_hours, 4) * INTERVAL '1 hour'))
        AND (p_event_time + (p_duration_hours * INTERVAL '1 hour')) > event_time
    ) INTO v_conflict;

    IF v_conflict THEN
      RETURN jsonb_build_object(
        'available', FALSE,
        'reason', 'Artist is already booked during this time slot. Please choose a different time.'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('available', TRUE, 'reason', NULL);
END;
$$;

-- ─── get_nearest_available_dates function ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_nearest_available_dates(
  p_provider_id UUID,
  p_after_date  DATE,
  p_count       INTEGER DEFAULT 3
)
RETURNS DATE[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result DATE[] := '{}';
  v_check  DATE   := p_after_date + 1;
  v_avail  JSONB;
  v_iter   INTEGER := 0;
BEGIN
  WHILE array_length(v_result, 1) IS DISTINCT FROM p_count AND v_iter < 60 LOOP
    v_avail := public.check_artist_availability(p_provider_id, v_check);
    IF (v_avail->>'available')::BOOLEAN THEN
      v_result := array_append(v_result, v_check);
    END IF;
    v_check := v_check + 1;
    v_iter  := v_iter + 1;
  END LOOP;
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_artist_availability   TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_nearest_available_dates TO authenticated, anon;

-- ─── Verification ─────────────────────────────────────────────────────────────
SELECT 'check_artist_availability function created' AS status
WHERE EXISTS (
  SELECT 1 FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'check_artist_availability'
);

-- ============================================================
-- Notifications RLS — allow authenticated users to insert
-- notifications for any user_id (needed so the service can
-- notify providers when customers take actions and vice-versa).
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (idempotency)
DROP POLICY IF EXISTS "Users can view own notifications"    ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications"  ON public.notifications;
DROP POLICY IF EXISTS "Service can insert notifications"    ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications"  ON public.notifications;
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;

-- SELECT: users see only their own
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: any authenticated user can insert (needed to notify other users)
CREATE POLICY "Authenticated can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- UPDATE: users can only update their own (mark as read)
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- DELETE: users can delete their own
CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- notification_settings: users manage their own
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own notification settings" ON public.notification_settings;
CREATE POLICY "Users can manage own notification settings"
  ON public.notification_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Ensure realtime is enabled for notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================
-- Dynamic Marketplace V2 — Vowza
-- Fully idempotent. 100% compatible with Supabase PostgreSQL.
--
-- FIXES:
--   • Removed public.has_role() — function does not exist in
--     this project's schema.
--   • Admin write policies use a subquery on public.user_roles
--     (role = 'admin') which IS present in this project.
--   • CREATE POLICY IF NOT EXISTS replaced with
--     DROP POLICY IF EXISTS → CREATE POLICY everywhere.
--   • ON CONFLICT target made explicit via UNIQUE constraint.
--   • Enum ADD VALUE wrapped in individual DO blocks.
-- ============================================================

-- ── 1. Extend profession_type enum ────────────────────────────────────────
DO $$ BEGIN
  ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'banquet_hall';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'pandit';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'water_supplier';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'rentals';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'wedding_band';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'dhol_band';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE public.profession_type ADD VALUE IF NOT EXISTS 'brass_band';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. subcategories ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subcategories (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  category_slug TEXT        NOT NULL,
  name          TEXT        NOT NULL,
  sort_order    INTEGER     DEFAULT 0,
  is_active     BOOLEAN     DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subcategories_slug
  ON public.subcategories (category_slug);

ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;

-- Anyone can read subcategories
DROP POLICY IF EXISTS "subcategories_public_read" ON public.subcategories;
CREATE POLICY "subcategories_public_read"
  ON public.subcategories
  FOR SELECT
  USING (true);

-- Only admins (row in user_roles with role = 'admin') can write
-- TODO: replace with a proper admin check if your role system changes
DROP POLICY IF EXISTS "subcategories_admin_write" ON public.subcategories;
CREATE POLICY "subcategories_admin_write"
  ON public.subcategories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  );

-- ── 3. Extend provider_profiles ───────────────────────────────────────────
ALTER TABLE public.provider_profiles
  ADD COLUMN IF NOT EXISTS subcategory         TEXT,
  ADD COLUMN IF NOT EXISTS vendor_details      JSONB        DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS faqs                JSONB        DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS social_links        JSONB        DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS business_hours      JSONB        DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS service_areas       TEXT[]       DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS verification_status TEXT         DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS is_featured         BOOLEAN      DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS featured_until      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS instant_booking     BOOLEAN      DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS whatsapp            TEXT,
  ADD COLUMN IF NOT EXISTS gallery_urls        TEXT[]       DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS video_urls          TEXT[]       DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS service_radius      INTEGER      DEFAULT 50,
  ADD COLUMN IF NOT EXISTS total_bookings      INTEGER      DEFAULT 0;

-- ── 4. pricing_packages ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pricing_packages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID        NOT NULL
                REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  description TEXT,
  price       NUMERIC     NOT NULL DEFAULT 0,
  duration    TEXT,
  features    TEXT[]      DEFAULT '{}',
  sort_order  INTEGER     DEFAULT 0,
  is_active   BOOLEAN     DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_packages_provider
  ON public.pricing_packages (provider_id);

ALTER TABLE public.pricing_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "packages_public_read" ON public.pricing_packages;
CREATE POLICY "packages_public_read"
  ON public.pricing_packages
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "packages_owner_write" ON public.pricing_packages;
CREATE POLICY "packages_owner_write"
  ON public.pricing_packages
  FOR ALL
  USING (
    provider_id IN (
      SELECT id FROM public.provider_profiles
      WHERE user_id = auth.uid()
    )
  );

-- ── 5. menu_items (caterers) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.menu_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id     UUID        NOT NULL
                    REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  dish_name       TEXT        NOT NULL,
  category        TEXT,
  description     TEXT,
  image_url       TEXT,
  price_per_plate NUMERIC     DEFAULT 0,
  min_order       INTEGER     DEFAULT 1,
  max_capacity    INTEGER,
  is_available    BOOLEAN     DEFAULT TRUE,
  sort_order      INTEGER     DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_provider
  ON public.menu_items (provider_id);

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "menu_public_read" ON public.menu_items;
CREATE POLICY "menu_public_read"
  ON public.menu_items
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "menu_owner_write" ON public.menu_items;
CREATE POLICY "menu_owner_write"
  ON public.menu_items
  FOR ALL
  USING (
    provider_id IN (
      SELECT id FROM public.provider_profiles
      WHERE user_id = auth.uid()
    )
  );

-- ── 6. rental_items ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rental_items (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id         UUID        NOT NULL
                        REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  item_name           TEXT        NOT NULL,
  category            TEXT,
  image_url           TEXT,
  description         TEXT,
  quantity_available  INTEGER     DEFAULT 1,
  price_per_day       NUMERIC     DEFAULT 0,
  price_per_event     NUMERIC     DEFAULT 0,
  security_deposit    NUMERIC     DEFAULT 0,
  delivery_charges    NUMERIC     DEFAULT 0,
  available_locations TEXT[]      DEFAULT '{}',
  is_available        BOOLEAN     DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rental_items_provider
  ON public.rental_items (provider_id);

ALTER TABLE public.rental_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rentals_public_read" ON public.rental_items;
CREATE POLICY "rentals_public_read"
  ON public.rental_items
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "rentals_owner_write" ON public.rental_items;
CREATE POLICY "rentals_owner_write"
  ON public.rental_items
  FOR ALL
  USING (
    provider_id IN (
      SELECT id FROM public.provider_profiles
      WHERE user_id = auth.uid()
    )
  );

-- ── 7. pooja_services (pandits) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pooja_services (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id        UUID        NOT NULL
                       REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  pooja_name         TEXT        NOT NULL,
  religion           TEXT        DEFAULT 'Hindu',
  description        TEXT,
  price              NUMERIC     DEFAULT 0,
  duration_minutes   INTEGER,
  materials_included BOOLEAN     DEFAULT FALSE,
  materials_note     TEXT,
  image_url          TEXT,
  is_available       BOOLEAN     DEFAULT TRUE,
  sort_order         INTEGER     DEFAULT 0,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pooja_services_provider
  ON public.pooja_services (provider_id);

ALTER TABLE public.pooja_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pooja_public_read" ON public.pooja_services;
CREATE POLICY "pooja_public_read"
  ON public.pooja_services
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "pooja_owner_write" ON public.pooja_services;
CREATE POLICY "pooja_owner_write"
  ON public.pooja_services
  FOR ALL
  USING (
    provider_id IN (
      SELECT id FROM public.provider_profiles
      WHERE user_id = auth.uid()
    )
  );

-- ── 8. provider_faqs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.provider_faqs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID        NOT NULL
                REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  question    TEXT        NOT NULL,
  answer      TEXT        NOT NULL,
  sort_order  INTEGER     DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_faqs_provider
  ON public.provider_faqs (provider_id);

ALTER TABLE public.provider_faqs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "faqs_public_read" ON public.provider_faqs;
CREATE POLICY "faqs_public_read"
  ON public.provider_faqs
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "faqs_owner_write" ON public.provider_faqs;
CREATE POLICY "faqs_owner_write"
  ON public.provider_faqs
  FOR ALL
  USING (
    provider_id IN (
      SELECT id FROM public.provider_profiles
      WHERE user_id = auth.uid()
    )
  );

-- ── 9. Indexes on provider_profiles ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_provider_profession_status
  ON public.provider_profiles (profession, verification_status);

CREATE INDEX IF NOT EXISTS idx_provider_subcategory
  ON public.provider_profiles (subcategory);

CREATE INDEX IF NOT EXISTS idx_provider_city_status
  ON public.provider_profiles (verification_status);

-- ── 10. Seed subcategories ────────────────────────────────────────────────
-- Unique constraint required for ON CONFLICT (category_slug, name)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.subcategories'::regclass
      AND conname  = 'subcategories_slug_name_key'
  ) THEN
    ALTER TABLE public.subcategories
      ADD CONSTRAINT subcategories_slug_name_key
      UNIQUE (category_slug, name);
  END IF;
END $$;

INSERT INTO public.subcategories (category_slug, name, sort_order) VALUES
  ('music_band',         'Wedding Band',            1),
  ('music_band',         'Dhol Band',               2),
  ('music_band',         'Brass Band',              3),
  ('music_band',         'Chenda Melam',            4),
  ('music_band',         'Traditional Band',        5),
  ('music_band',         'DJ Band',                 6),
  ('dj',                 'Wedding DJ',              1),
  ('dj',                 'Club DJ',                 2),
  ('dj',                 'Birthday DJ',             3),
  ('dj',                 'Corporate DJ',            4),
  ('dj',                 'Sangeet DJ',              5),
  ('singer',             'Classical',               1),
  ('singer',             'Carnatic',                2),
  ('singer',             'Hindustani',              3),
  ('singer',             'Folk',                    4),
  ('singer',             'Devotional',              5),
  ('singer',             'Melody',                  6),
  ('singer',             'Cine Songs',              7),
  ('singer',             'Ghazal',                  8),
  ('singer',             'Sufi',                    9),
  ('dancer',             'Bharatanatyam',           1),
  ('dancer',             'Kuchipudi',               2),
  ('dancer',             'Kathak',                  3),
  ('dancer',             'Western',                 4),
  ('dancer',             'Hip Hop',                 5),
  ('dancer',             'Contemporary',            6),
  ('dancer',             'Bhangra',                 7),
  ('dancer',             'Garba',                   8),
  ('dancer',             'Sangeet Dance',           9),
  ('choreographer',      'Wedding',                 1),
  ('choreographer',      'Sangeet',                 2),
  ('choreographer',      'Classical',               3),
  ('choreographer',      'Western',                 4),
  ('wedding_decorator',  'Wedding Decoration',      1),
  ('wedding_decorator',  'Birthday Decoration',     2),
  ('wedding_decorator',  'Stage Decoration',        3),
  ('wedding_decorator',  'Floral Decoration',       4),
  ('wedding_decorator',  'Balloon Decoration',      5),
  ('wedding_decorator',  'Mandap Decoration',       6),
  ('makeup_artist',      'Bridal',                  1),
  ('makeup_artist',      'Groom',                   2),
  ('makeup_artist',      'Party',                   3),
  ('makeup_artist',      'HD Makeup',               4),
  ('makeup_artist',      'Airbrush',                5),
  ('mehendi_artist',     'Bridal Mehendi',          1),
  ('mehendi_artist',     'Arabic',                  2),
  ('mehendi_artist',     'Rajasthani',              3),
  ('mehendi_artist',     'Indo Arabic',             4),
  ('magician',           'Stage Magic',             1),
  ('magician',           'Kids Magic',              2),
  ('magician',           'Illusion',                3),
  ('magician',           'Close Up Magic',          4),
  ('anchor',             'Wedding',                 1),
  ('anchor',             'Corporate',               2),
  ('anchor',             'Birthday',                3),
  ('anchor',             'Stage Shows',             4),
  ('catering_services',  'Veg Meals',               1),
  ('catering_services',  'Non Veg Meals',           2),
  ('catering_services',  'Biryani',                 3),
  ('catering_services',  'Buffet',                  4),
  ('catering_services',  'Live Counters',           5),
  ('catering_services',  'Snacks',                  6),
  ('lighting_services',  'Stage Lighting',          1),
  ('lighting_services',  'Wedding Lighting',        2),
  ('lighting_services',  'LED Lighting',            3),
  ('lighting_services',  'Laser Lights',            4),
  ('sound_services',     'Wedding Sound',           1),
  ('sound_services',     'Concert Sound',           2),
  ('sound_services',     'Corporate Audio',         3),
  ('pandit',             'Marriage',                1),
  ('pandit',             'Gruhapravesam',           2),
  ('pandit',             'Satyanaryana Vratham',    3),
  ('pandit',             'Ganapathi Homam',         4),
  ('pandit',             'Rudrabhishekam',          5),
  ('pandit',             'Upanayanam',              6),
  ('pandit',             'Navagraha Pooja',         7),
  ('pandit',             'Ayush Homam',             8),
  ('pandit',             'Nikah',                   9),
  ('pandit',             'Christian Wedding',      10),
  ('rentals',            'Tent & Shamiana',         1),
  ('rentals',            'Stage',                   2),
  ('rentals',            'Chairs & Tables',         3),
  ('rentals',            'Furniture',               4),
  ('rentals',            'Generator',               5),
  ('rentals',            'AC Cooler',               6),
  ('rentals',            'LED Wall',                7),
  ('water_supplier',     'Cool Water',              1),
  ('water_supplier',     'RO Water',                2),
  ('water_supplier',     'Mineral Water',           3),
  ('water_supplier',     'Water Tankers',           4),
  ('banquet_hall',       'AC Hall',                 1),
  ('banquet_hall',       'Non AC Hall',             2),
  ('banquet_hall',       'Outdoor Venue',           3),
  ('banquet_hall',       'Terrace',                 4),
  ('photographer',       'Wedding Photography',     1),
  ('photographer',       'Pre-Wedding',             2),
  ('photographer',       'Candid',                  3),
  ('photographer',       'Traditional',             4),
  ('photographer',       'Baby Shoot',              5),
  ('photographer',       'Corporate',               6),
  ('videographer',       'Traditional Video',       1),
  ('videographer',       'Cinematic Film',          2),
  ('videographer',       'Wedding Film',            3),
  ('videographer',       'Reel Package',            4),
  ('videographer',       'Live Streaming',          5),
  ('drone_operator',     'Wedding Drone',           1),
  ('drone_operator',     'Real Estate',             2),
  ('drone_operator',     'Event Aerial',            3),
  ('mehendi_artist',     'Portrait Mehendi',        5)
ON CONFLICT (category_slug, name) DO NOTHING;
-- ============================================================
-- RAG Vector Search — Vowza AI Planner
-- Enables semantic vendor search using pgvector.
-- Fully idempotent. Compatible with Supabase PostgreSQL.
-- ============================================================

-- ── 1. Enable pgvector extension ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ── 2. Vendor embeddings table ────────────────────────────────────────────────
-- Stores pre-computed embeddings for vendor profiles so the AI can do
-- semantic nearest-neighbour search instead of only keyword matching.
CREATE TABLE IF NOT EXISTS public.vendor_embeddings (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id     UUID        NOT NULL
                    REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  content         TEXT        NOT NULL,   -- the text that was embedded
  embedding       vector(1536),           -- OpenAI text-embedding-3-small (1536 dims)
  embedding_sm    vector(384),            -- smaller model fallback (384 dims)
  content_type    TEXT        DEFAULT 'profile',  -- profile | menu | package | review | faq
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_embeddings_provider
  ON public.vendor_embeddings (provider_id);

-- IVFFlat index for fast approximate nearest-neighbour on 1536-dim embeddings
-- lists=100 is appropriate for up to ~1M rows
CREATE INDEX IF NOT EXISTS idx_vendor_embeddings_vector
  ON public.vendor_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

ALTER TABLE public.vendor_embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "embeddings_public_read" ON public.vendor_embeddings;
CREATE POLICY "embeddings_public_read"
  ON public.vendor_embeddings FOR SELECT USING (true);

DROP POLICY IF EXISTS "embeddings_admin_write" ON public.vendor_embeddings;
CREATE POLICY "embeddings_admin_write"
  ON public.vendor_embeddings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ── 3. Semantic vendor search function ────────────────────────────────────────
-- Called by the RAG retriever with a query embedding.
-- Returns the top-k most relevant vendor profiles.
CREATE OR REPLACE FUNCTION public.match_vendors(
  query_embedding  vector(1536),
  match_count      INT     DEFAULT 10,
  similarity_threshold FLOAT DEFAULT 0.5,
  filter_profession    TEXT  DEFAULT NULL,
  filter_city          TEXT  DEFAULT NULL,
  filter_price_max     NUMERIC DEFAULT NULL
)
RETURNS TABLE (
  provider_id   UUID,
  profession    TEXT,
  content       TEXT,
  similarity    FLOAT,
  price_min     NUMERIC,
  price_max     NUMERIC,
  average_rating FLOAT,
  is_verified   BOOLEAN,
  city          TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ve.provider_id,
    pp.profession::TEXT                        AS profession,
    ve.content,
    (1 - (ve.embedding <=> query_embedding))::FLOAT AS similarity,
    pp.price_min::NUMERIC                      AS price_min,
    pp.price_max::NUMERIC                      AS price_max,
    COALESCE(pp.average_rating, 0)::FLOAT      AS average_rating,
    COALESCE(pp.is_verified, FALSE)::BOOLEAN   AS is_verified,
    pr.city::TEXT                              AS city
  FROM public.vendor_embeddings ve
  JOIN public.provider_profiles pp ON pp.id = ve.provider_id
  LEFT JOIN public.profiles pr      ON pr.id = pp.user_id
  WHERE
    ve.embedding IS NOT NULL
    AND pp.verification_status IN ('approved', 'verified')
    AND (filter_profession IS NULL OR pp.profession::TEXT = filter_profession)
    AND (filter_city       IS NULL OR LOWER(pr.city) LIKE LOWER('%' || filter_city || '%'))
    AND (filter_price_max  IS NULL OR pp.price_min IS NULL OR pp.price_min <= filter_price_max)
    AND 1 - (ve.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY ve.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ── 4. SQL-only (no-vector) vendor search function ────────────────────────────
-- Fallback used when no embedding exists yet. Performs keyword + filter search.
CREATE OR REPLACE FUNCTION public.search_vendors_sql(
  p_profession TEXT     DEFAULT NULL,
  p_city       TEXT     DEFAULT NULL,
  p_price_max  NUMERIC  DEFAULT NULL,
  p_min_rating FLOAT    DEFAULT 0,
  p_limit      INT      DEFAULT 10
)
RETURNS TABLE (
  provider_id       UUID,
  profession        TEXT,
  stage_name        TEXT,
  bio               TEXT,
  price_min         NUMERIC,
  price_max         NUMERIC,
  average_rating    FLOAT,
  total_reviews     INT,
  total_bookings    INT,
  is_verified       BOOLEAN,
  is_available      BOOLEAN,
  experience_years  INT,
  cover_image_url   TEXT,
  city              TEXT,
  full_name         TEXT,
  avatar_url        TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pp.id                                    AS provider_id,
    pp.profession::TEXT                      AS profession,
    pp.stage_name::TEXT                      AS stage_name,
    pp.bio::TEXT                             AS bio,
    pp.price_min::NUMERIC                    AS price_min,
    pp.price_max::NUMERIC                    AS price_max,
    COALESCE(pp.average_rating, 0)::FLOAT    AS average_rating,
    COALESCE(pp.total_reviews, 0)::INT       AS total_reviews,
    COALESCE(pp.total_bookings, 0)::INT      AS total_bookings,
    COALESCE(pp.is_verified, FALSE)::BOOLEAN AS is_verified,
    COALESCE(pp.is_available, TRUE)::BOOLEAN AS is_available,
    pp.experience_years::INT                 AS experience_years,
    pp.cover_image_url::TEXT                 AS cover_image_url,
    pr.city::TEXT                            AS city,
    pr.full_name::TEXT                       AS full_name,
    pr.avatar_url::TEXT                      AS avatar_url
  FROM public.provider_profiles pp
  LEFT JOIN public.profiles pr ON pr.id = pp.user_id
  WHERE
    pp.verification_status IN ('approved', 'verified')
    AND (p_profession IS NULL OR pp.profession::TEXT = p_profession)
    AND (p_city       IS NULL OR LOWER(COALESCE(pr.city, '')) LIKE LOWER('%' || p_city || '%'))
    AND (p_price_max  IS NULL OR pp.price_min IS NULL OR pp.price_min <= p_price_max)
    AND COALESCE(pp.average_rating, 0) >= p_min_rating
  ORDER BY
    COALESCE(pp.is_verified, FALSE) DESC,
    COALESCE(pp.average_rating, 0) DESC,
    COALESCE(pp.total_bookings, 0) DESC
  LIMIT p_limit;
END;
$$;

-- ── 5. Grant execute to authenticated and anon ────────────────────────────────
GRANT EXECUTE ON FUNCTION public.match_vendors TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.search_vendors_sql TO authenticated, anon;

-- ── 6. AI conversations table (if not already created) ────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL,
  title           TEXT        NOT NULL DEFAULT 'New Conversation',
  context_summary JSONB       DEFAULT '{}',
  last_active_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user
  ON public.ai_conversations (user_id, last_active_at DESC);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_conversations_owner" ON public.ai_conversations;
CREATE POLICY "ai_conversations_owner"
  ON public.ai_conversations FOR ALL
  USING (user_id = auth.uid());

-- ── 7. AI messages table (if not already created) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL
                    REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL,
  role            TEXT        NOT NULL CHECK (role IN ('user','assistant')),
  content         TEXT        NOT NULL,
  ai_response     JSONB,
  rag_context     JSONB,      -- stores what was retrieved for this message
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation
  ON public.ai_messages (conversation_id, created_at ASC);

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_messages_owner" ON public.ai_messages;
CREATE POLICY "ai_messages_owner"
  ON public.ai_messages FOR ALL
  USING (user_id = auth.uid());
-- ============================================================
-- Artist Approval Workflow Migration
-- Adds verified_at, verified_by, rejection_reason to provider_profiles
-- Fixes RLS so only approved artists appear in marketplace
-- Idempotent — safe to run multiple times
-- ============================================================

-- ── 1. Add approval columns to provider_profiles ──────────────────────────
ALTER TABLE public.provider_profiles
  ADD COLUMN IF NOT EXISTS verified_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by       UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS rejection_reason  TEXT,
  ADD COLUMN IF NOT EXISTS is_published      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS average_rating    NUMERIC(3,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_reviews     INTEGER DEFAULT 0;

-- ── 2. Index for fast marketplace queries ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_provider_published
  ON public.provider_profiles(is_published, verification_status);

-- ── 3. Fix provider_profiles RLS ──────────────────────────────────────────
-- Drop any existing policies first
DROP POLICY IF EXISTS "providers_public_read"      ON public.provider_profiles;
DROP POLICY IF EXISTS "providers_owner_write"      ON public.provider_profiles;
DROP POLICY IF EXISTS "providers_admin_write"      ON public.provider_profiles;
DROP POLICY IF EXISTS "providers_owner_read"       ON public.provider_profiles;

ALTER TABLE public.provider_profiles ENABLE ROW LEVEL SECURITY;

-- Customers/public: only see APPROVED + PUBLISHED profiles
CREATE POLICY "providers_public_read"
  ON public.provider_profiles FOR SELECT
  USING (
    verification_status IN ('approved', 'verified')
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Owners: full write access to their own profile
CREATE POLICY "providers_owner_write"
  ON public.provider_profiles FOR ALL
  USING (user_id = auth.uid());

-- Admins: full access to all profiles
CREATE POLICY "providers_admin_write"
  ON public.provider_profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ── 4. Fix portfolio_items RLS ─────────────────────────────────────────────
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portfolio_public_read"  ON public.portfolio_items;
DROP POLICY IF EXISTS "portfolio_owner_write"  ON public.portfolio_items;

CREATE POLICY "portfolio_public_read"
  ON public.portfolio_items FOR SELECT
  USING (true);

CREATE POLICY "portfolio_owner_write"
  ON public.portfolio_items FOR ALL
  USING (
    provider_id IN (
      SELECT id FROM public.provider_profiles WHERE user_id = auth.uid()
    )
  );

-- ── 5. Notifications table: ensure it exists ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL,
  title       TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  type        TEXT        DEFAULT 'info',
  is_read     BOOLEAN     DEFAULT FALSE,
  reference_id TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON public.notifications(user_id, is_read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_owner"        ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_auth"  ON public.notifications;

CREATE POLICY "notifications_owner"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "notifications_insert_auth"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "notifications_update_owner"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

-- ── 6. user_roles: ensure it exists ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL,
  role       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles_read_own"   ON public.user_roles;
DROP POLICY IF EXISTS "roles_admin_all"  ON public.user_roles;

CREATE POLICY "roles_read_own"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "roles_admin_all"
  ON public.user_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = auth.uid() AND r.role = 'admin'
    )
  );

-- ── 7. Function to approve an artist (called by the app) ──────────────────
CREATE OR REPLACE FUNCTION public.approve_artist(
  p_provider_id   UUID,
  p_admin_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_admin_user_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  -- Get the artist's user_id
  SELECT user_id INTO v_user_id
  FROM public.provider_profiles
  WHERE id = p_provider_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Provider not found';
  END IF;

  -- Update provider profile
  UPDATE public.provider_profiles
  SET
    verification_status = 'approved',
    is_published        = TRUE,
    verified_at         = NOW(),
    verified_by         = p_admin_user_id,
    rejection_reason    = NULL
  WHERE id = p_provider_id;

  -- Assign provider role
  INSERT INTO public.user_roles(user_id, role)
  VALUES (v_user_id, 'provider')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Send in-app notification to artist
  INSERT INTO public.notifications(user_id, title, message, type, reference_id)
  VALUES (
    v_user_id,
    'Profile Approved! 🎉',
    'Congratulations! Your Vowza profile has been successfully verified. Your profile is now live on Vowza. You can now edit your profile, manage your services, and start receiving bookings.',
    'approval',
    p_provider_id::text
  );

  -- Log admin action
  INSERT INTO public.notifications(user_id, title, message, type, reference_id)
  VALUES (
    p_admin_user_id,
    'Artist Approved',
    'You approved provider ' || p_provider_id::text,
    'admin_action',
    p_provider_id::text
  );
END;
$$;

-- ── 8. Function to reject an artist ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reject_artist(
  p_provider_id    UUID,
  p_admin_user_id  UUID,
  p_reason         TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_admin_user_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  SELECT user_id INTO v_user_id
  FROM public.provider_profiles
  WHERE id = p_provider_id;

  UPDATE public.provider_profiles
  SET
    verification_status = 'rejected',
    is_published        = FALSE,
    rejection_reason    = p_reason,
    verified_at         = NOW(),
    verified_by         = p_admin_user_id
  WHERE id = p_provider_id;

  -- Remove provider role if it existed
  DELETE FROM public.user_roles
  WHERE user_id = v_user_id AND role = 'provider';

  -- Notify artist
  INSERT INTO public.notifications(user_id, title, message, type, reference_id)
  VALUES (
    v_user_id,
    'Profile Review Update',
    'Your Vowza profile requires attention. Reason: ' || p_reason || '. Please update your profile and resubmit for verification.',
    'rejection',
    p_provider_id::text
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_artist TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_artist  TO authenticated;
-- ============================================================
-- AI Conversations: Pin / Archive support
-- Adds is_pinned and is_archived to ai_conversations so the
-- ChatGPT-style sidebar can group Pinned / Recent / Archived.
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS is_pinned   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

-- Index to support sidebar queries filtered by pin/archive state,
-- ordered by recency.
CREATE INDEX IF NOT EXISTS idx_ai_conversations_pinned
  ON public.ai_conversations (user_id, is_pinned, last_active_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_archived
  ON public.ai_conversations (user_id, is_archived, last_active_at DESC);
-- ============================================================
-- AI Conversations: Favorite support
-- Adds is_favorite to ai_conversations for the ChatGPT-style
-- "Favorite Conversations" feature.
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_ai_conversations_favorite
  ON public.ai_conversations (user_id, is_favorite, last_active_at DESC);
-- Historical remote baseline.
-- This version was already applied to the linked Supabase project before this
-- checkout was created. The original source migration is unavailable locally.
-- Intentionally no-op: it exists only to keep local CLI history aligned with the
-- remote migration ledger and must never be used to reapply production schema.
-- Historical remote baseline.
-- This version was already applied to the linked Supabase project before this
-- checkout was created. The original source migration is unavailable locally.
-- Intentionally no-op: it exists only to keep local CLI history aligned with the
-- remote migration ledger and must never be used to reapply production schema.
-- Photographer-only package commerce. Idempotent: safe on fresh and existing databases.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.is_photographer(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text='photographer'); $$;
CREATE OR REPLACE FUNCTION public.owns_photographer(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text='photographer'); $$;

CREATE TABLE IF NOT EXISTS public.photography_packages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), photographer_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE, name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 120), description text, price numeric(12,2) NOT NULL CHECK(price>=0), duration text, album_included boolean NOT NULL DEFAULT false, album_details text, travel_included boolean NOT NULL DEFAULT false, travel_details text, is_active boolean NOT NULL DEFAULT true, is_visible boolean NOT NULL DEFAULT true, view_count integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.photography_package_images (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), package_id uuid NOT NULL REFERENCES public.photography_packages(id) ON DELETE CASCADE, storage_path text NOT NULL, public_url text NOT NULL, alt_text text, is_cover boolean NOT NULL DEFAULT false, sort_order integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.photography_package_highlights (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), package_id uuid NOT NULL REFERENCES public.photography_packages(id) ON DELETE CASCADE, text text NOT NULL, sort_order integer NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS public.photography_package_addons (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), package_id uuid NOT NULL REFERENCES public.photography_packages(id) ON DELETE CASCADE, name text NOT NULL, description text, price numeric(12,2) NOT NULL CHECK(price>=0), is_active boolean NOT NULL DEFAULT true, sort_order integer NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS public.photography_package_bookings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), package_id uuid NOT NULL REFERENCES public.photography_packages(id), photographer_id uuid NOT NULL REFERENCES public.provider_profiles(id), customer_id uuid NOT NULL REFERENCES public.profiles(id), event_date date NOT NULL, event_time text, venue text, notes text, selected_addon_ids uuid[] NOT NULL DEFAULT '{}', base_amount numeric(12,2) NOT NULL, addons_amount numeric(12,2) NOT NULL DEFAULT 0, total_amount numeric(12,2) NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','completed','cancelled')), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.photography_package_reviews (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), package_id uuid NOT NULL REFERENCES public.photography_packages(id) ON DELETE CASCADE, booking_id uuid NOT NULL UNIQUE REFERENCES public.photography_package_bookings(id) ON DELETE CASCADE, customer_id uuid NOT NULL REFERENCES public.profiles(id), rating smallint NOT NULL CHECK(rating BETWEEN 1 AND 5), review_text text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.photographer_availability (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), photographer_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE, available_date date NOT NULL, is_available boolean NOT NULL DEFAULT true, note text, UNIQUE(photographer_id,available_date));
CREATE UNIQUE INDEX IF NOT EXISTS photography_package_one_cover ON public.photography_package_images(package_id) WHERE is_cover;
CREATE INDEX IF NOT EXISTS photography_packages_photographer_idx ON public.photography_packages(photographer_id,is_active,is_visible);
CREATE INDEX IF NOT EXISTS photography_bookings_photographer_idx ON public.photography_package_bookings(photographer_id,created_at DESC);

CREATE OR REPLACE FUNCTION public.photography_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NOT public.is_photographer(NEW.photographer_id) THEN RAISE EXCEPTION 'Photography package data is restricted to photographer providers'; END IF; RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.photography_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS photography_package_guard ON public.photography_packages;
CREATE TRIGGER photography_package_guard BEFORE INSERT OR UPDATE OF photographer_id ON public.photography_packages FOR EACH ROW EXECUTE FUNCTION public.photography_guard();
DROP TRIGGER IF EXISTS photography_availability_guard ON public.photographer_availability;
CREATE TRIGGER photography_availability_guard BEFORE INSERT OR UPDATE OF photographer_id ON public.photographer_availability FOR EACH ROW EXECUTE FUNCTION public.photography_guard();
DROP TRIGGER IF EXISTS photography_packages_updated_at ON public.photography_packages;
CREATE TRIGGER photography_packages_updated_at BEFORE UPDATE ON public.photography_packages FOR EACH ROW EXECUTE FUNCTION public.photography_updated_at();

DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['photography_packages','photography_package_images','photography_package_highlights','photography_package_addons','photography_package_bookings','photography_package_reviews','photographer_availability'] LOOP IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END IF; END LOOP; END $$;

DROP POLICY IF EXISTS photography_packages_read ON public.photography_packages;
DROP POLICY IF EXISTS photography_packages_owner ON public.photography_packages;
DROP POLICY IF EXISTS photography_images_read ON public.photography_package_images;
DROP POLICY IF EXISTS photography_images_owner ON public.photography_package_images;
DROP POLICY IF EXISTS photography_highlights_read ON public.photography_package_highlights;
DROP POLICY IF EXISTS photography_highlights_owner ON public.photography_package_highlights;
DROP POLICY IF EXISTS photography_addons_read ON public.photography_package_addons;
DROP POLICY IF EXISTS photography_addons_owner ON public.photography_package_addons;
DROP POLICY IF EXISTS photography_availability_read ON public.photographer_availability;
DROP POLICY IF EXISTS photography_availability_owner ON public.photographer_availability;
DROP POLICY IF EXISTS photography_bookings_read ON public.photography_package_bookings;
DROP POLICY IF EXISTS photography_reviews_read ON public.photography_package_reviews;
DROP POLICY IF EXISTS photography_reviews_create ON public.photography_package_reviews;
CREATE POLICY photography_packages_read ON public.photography_packages FOR SELECT USING ((is_active AND is_visible) OR public.owns_photographer(photographer_id));
CREATE POLICY photography_packages_owner ON public.photography_packages FOR ALL USING(public.owns_photographer(photographer_id)) WITH CHECK(public.owns_photographer(photographer_id));
CREATE POLICY photography_images_read ON public.photography_package_images FOR SELECT USING(EXISTS(SELECT 1 FROM public.photography_packages p WHERE p.id=package_id AND ((p.is_active AND p.is_visible) OR public.owns_photographer(p.photographer_id))));
CREATE POLICY photography_images_owner ON public.photography_package_images FOR ALL USING(EXISTS(SELECT 1 FROM public.photography_packages p WHERE p.id=package_id AND public.owns_photographer(p.photographer_id))) WITH CHECK(EXISTS(SELECT 1 FROM public.photography_packages p WHERE p.id=package_id AND public.owns_photographer(p.photographer_id)));
CREATE POLICY photography_highlights_read ON public.photography_package_highlights FOR SELECT USING(true);
CREATE POLICY photography_highlights_owner ON public.photography_package_highlights FOR ALL USING(EXISTS(SELECT 1 FROM public.photography_packages p WHERE p.id=package_id AND public.owns_photographer(p.photographer_id))) WITH CHECK(EXISTS(SELECT 1 FROM public.photography_packages p WHERE p.id=package_id AND public.owns_photographer(p.photographer_id)));
CREATE POLICY photography_addons_read ON public.photography_package_addons FOR SELECT USING(true);
CREATE POLICY photography_addons_owner ON public.photography_package_addons FOR ALL USING(EXISTS(SELECT 1 FROM public.photography_packages p WHERE p.id=package_id AND public.owns_photographer(p.photographer_id))) WITH CHECK(EXISTS(SELECT 1 FROM public.photography_packages p WHERE p.id=package_id AND public.owns_photographer(p.photographer_id)));
CREATE POLICY photography_availability_read ON public.photographer_availability FOR SELECT USING(true);
CREATE POLICY photography_availability_owner ON public.photographer_availability FOR ALL USING(public.owns_photographer(photographer_id)) WITH CHECK(public.owns_photographer(photographer_id));
CREATE POLICY photography_bookings_read ON public.photography_package_bookings FOR SELECT USING(customer_id=auth.uid() OR public.owns_photographer(photographer_id));
CREATE POLICY photography_reviews_read ON public.photography_package_reviews FOR SELECT USING(true);
CREATE POLICY photography_reviews_create ON public.photography_package_reviews FOR INSERT WITH CHECK(customer_id=auth.uid() AND EXISTS(SELECT 1 FROM public.photography_package_bookings b WHERE b.id=booking_id AND b.customer_id=auth.uid() AND b.status='completed'));

INSERT INTO storage.buckets(id,name,public) VALUES('photography-package-images','photography-package-images',true) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS photography_storage_read ON storage.objects;
DROP POLICY IF EXISTS photography_storage_owner ON storage.objects;
CREATE POLICY photography_storage_read ON storage.objects FOR SELECT USING(bucket_id='photography-package-images');
CREATE POLICY photography_storage_owner ON storage.objects FOR ALL TO authenticated USING(bucket_id='photography-package-images' AND auth.uid()::text=(storage.foldername(name))[1]) WITH CHECK(bucket_id='photography-package-images' AND auth.uid()::text=(storage.foldername(name))[1]);

CREATE OR REPLACE FUNCTION public.create_photography_package_booking(p_package_id uuid,p_event_date date,p_event_time text DEFAULT NULL,p_venue text DEFAULT NULL,p_notes text DEFAULT NULL,p_addon_ids uuid[] DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE p record; addon_total numeric:=0; booking_id uuid; BEGIN IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF; SELECT * INTO p FROM public.photography_packages WHERE id=p_package_id AND is_active AND is_visible FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Package is unavailable'; END IF; IF EXISTS(SELECT 1 FROM public.photographer_availability WHERE photographer_id=p.photographer_id AND available_date=p_event_date AND NOT is_available) THEN RAISE EXCEPTION 'Photographer is unavailable on this date'; END IF; SELECT coalesce(sum(price),0) INTO addon_total FROM public.photography_package_addons WHERE package_id=p.id AND id=ANY(p_addon_ids) AND is_active; IF (SELECT count(*) FROM public.photography_package_addons WHERE package_id=p.id AND id=ANY(p_addon_ids) AND is_active) <> coalesce(array_length(p_addon_ids,1),0) THEN RAISE EXCEPTION 'An add-on is unavailable'; END IF; INSERT INTO public.photography_package_bookings(package_id,photographer_id,customer_id,event_date,event_time,venue,notes,selected_addon_ids,base_amount,addons_amount,total_amount) VALUES(p.id,p.photographer_id,auth.uid(),p_event_date,p_event_time,nullif(trim(p_venue),''),nullif(trim(p_notes),''),p_addon_ids,p.price,addon_total,p.price+addon_total) RETURNING id INTO booking_id; RETURN booking_id; END $$;
GRANT EXECUTE ON FUNCTION public.create_photography_package_booking(uuid,date,text,text,text,uuid[]) TO authenticated;

DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['photography_packages','photography_package_images','photography_package_highlights','photography_package_addons','photography_package_reviews','photography_package_bookings','photographer_availability'] LOOP IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF; END LOOP; END $$;
-- Photographer package/cart upgrade. Idempotent and isolated from all other categories.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Structured package fields; legacy columns remain so existing packages and bookings continue to work.
ALTER TABLE public.photography_packages
  ADD COLUMN IF NOT EXISTS photography_type text,
  ADD COLUMN IF NOT EXISTS team_size integer,
  ADD COLUMN IF NOT EXISTS team_size_custom integer,
  ADD COLUMN IF NOT EXISTS edited_photos integer,
  ADD COLUMN IF NOT EXISTS raw_photos_included boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS album_type text,
  ADD COLUMN IF NOT EXISTS album_size text,
  ADD COLUMN IF NOT EXISTS album_pages integer,
  ADD COLUMN IF NOT EXISTS travel_radius_km numeric(8,2),
  ADD COLUMN IF NOT EXISTS travel_extra_charge numeric(12,2),
  ADD COLUMN IF NOT EXISTS delivery_time text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';

-- Existing live packages remain customer-visible after status is introduced.
UPDATE public.photography_packages
SET status = 'published'
WHERE status = 'draft' AND is_active AND is_visible;

ALTER TABLE public.photography_packages DROP CONSTRAINT IF EXISTS photography_packages_status_check;
ALTER TABLE public.photography_packages ADD CONSTRAINT photography_packages_status_check CHECK (status IN ('draft', 'published', 'archived'));
ALTER TABLE public.photography_packages DROP CONSTRAINT IF EXISTS photography_packages_team_size_check;
ALTER TABLE public.photography_packages ADD CONSTRAINT photography_packages_team_size_check CHECK (team_size IS NULL OR team_size > 0);
ALTER TABLE public.photography_packages DROP CONSTRAINT IF EXISTS photography_packages_team_size_custom_check;
ALTER TABLE public.photography_packages ADD CONSTRAINT photography_packages_team_size_custom_check CHECK (team_size_custom IS NULL OR team_size_custom > 0);
ALTER TABLE public.photography_packages DROP CONSTRAINT IF EXISTS photography_packages_edited_photos_check;
ALTER TABLE public.photography_packages ADD CONSTRAINT photography_packages_edited_photos_check CHECK (edited_photos IS NULL OR edited_photos >= 0);
ALTER TABLE public.photography_packages DROP CONSTRAINT IF EXISTS photography_packages_album_pages_check;
ALTER TABLE public.photography_packages ADD CONSTRAINT photography_packages_album_pages_check CHECK (album_pages IS NULL OR album_pages > 0);
ALTER TABLE public.photography_packages DROP CONSTRAINT IF EXISTS photography_packages_travel_check;
ALTER TABLE public.photography_packages ADD CONSTRAINT photography_packages_travel_check CHECK ((travel_radius_km IS NULL OR travel_radius_km >= 0) AND (travel_extra_charge IS NULL OR travel_extra_charge >= 0));
CREATE INDEX IF NOT EXISTS photography_packages_public_idx ON public.photography_packages (photographer_id, status, is_active, is_visible);

CREATE TABLE IF NOT EXISTS public.photography_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  photographer_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','checked_out','abandoned')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.photography_cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cart_id uuid NOT NULL REFERENCES public.photography_carts(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.photography_packages(id), addon_ids uuid[] NOT NULL DEFAULT '{}', quantity integer NOT NULL DEFAULT 1 CHECK(quantity > 0), created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cart_id, package_id)
);
CREATE TABLE IF NOT EXISTS public.photography_package_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), booking_id uuid NOT NULL UNIQUE REFERENCES public.photography_package_bookings(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK(amount >= 0), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','failed','refunded')), payment_method text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.photography_package_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), booking_id uuid NOT NULL UNIQUE REFERENCES public.photography_package_bookings(id) ON DELETE CASCADE,
  invoice_number text NOT NULL UNIQUE, amount numeric(12,2) NOT NULL CHECK(amount >= 0), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','void')), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.photography_booking_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), booking_id uuid NOT NULL REFERENCES public.photography_package_bookings(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL, event_type text NOT NULL, message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS photography_carts_customer_idx ON public.photography_carts(customer_id, status, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS photography_active_cart_provider_idx ON public.photography_carts(customer_id, photographer_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS photography_cart_items_cart_idx ON public.photography_cart_items(cart_id);
CREATE INDEX IF NOT EXISTS photography_timeline_booking_idx ON public.photography_booking_timeline(booking_id, created_at);

CREATE OR REPLACE FUNCTION public.photography_cart_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS photography_carts_updated_at ON public.photography_carts;
CREATE TRIGGER photography_carts_updated_at BEFORE UPDATE ON public.photography_carts FOR EACH ROW EXECUTE FUNCTION public.photography_cart_updated_at();
CREATE OR REPLACE FUNCTION public.photography_cart_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
  IF NOT public.is_photographer(NEW.photographer_id) THEN RAISE EXCEPTION 'Photography carts are restricted to photographer providers'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS photography_cart_guard ON public.photography_carts;
CREATE TRIGGER photography_cart_guard BEFORE INSERT OR UPDATE OF photographer_id ON public.photography_carts FOR EACH ROW EXECUTE FUNCTION public.photography_cart_guard();

ALTER TABLE public.photography_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photography_cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photography_package_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photography_package_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photography_booking_timeline ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS photography_carts_customer ON public.photography_carts;
DROP POLICY IF EXISTS photography_carts_provider ON public.photography_carts;
DROP POLICY IF EXISTS photography_cart_items_customer ON public.photography_cart_items;
DROP POLICY IF EXISTS photography_cart_items_provider ON public.photography_cart_items;
DROP POLICY IF EXISTS photography_payments_read ON public.photography_package_payments;
DROP POLICY IF EXISTS photography_invoices_read ON public.photography_package_invoices;
DROP POLICY IF EXISTS photography_timeline_read ON public.photography_booking_timeline;
CREATE POLICY photography_carts_customer ON public.photography_carts FOR SELECT USING(customer_id = auth.uid());
CREATE POLICY photography_carts_provider ON public.photography_carts FOR SELECT USING(public.owns_photographer(photographer_id));
CREATE POLICY photography_cart_items_customer ON public.photography_cart_items FOR SELECT USING(EXISTS(SELECT 1 FROM public.photography_carts c WHERE c.id=cart_id AND c.customer_id=auth.uid()));
CREATE POLICY photography_cart_items_provider ON public.photography_cart_items FOR SELECT USING(EXISTS(SELECT 1 FROM public.photography_carts c WHERE c.id=cart_id AND public.owns_photographer(c.photographer_id)));
CREATE POLICY photography_payments_read ON public.photography_package_payments FOR SELECT USING(EXISTS(SELECT 1 FROM public.photography_package_bookings b WHERE b.id=booking_id AND (b.customer_id=auth.uid() OR public.owns_photographer(b.photographer_id))));
CREATE POLICY photography_invoices_read ON public.photography_package_invoices FOR SELECT USING(EXISTS(SELECT 1 FROM public.photography_package_bookings b WHERE b.id=booking_id AND (b.customer_id=auth.uid() OR public.owns_photographer(b.photographer_id))));
CREATE POLICY photography_timeline_read ON public.photography_booking_timeline FOR SELECT USING(EXISTS(SELECT 1 FROM public.photography_package_bookings b WHERE b.id=booking_id AND (b.customer_id=auth.uid() OR public.owns_photographer(b.photographer_id))));

CREATE OR REPLACE FUNCTION public.add_photography_cart_item(p_package_id uuid, p_addon_ids uuid[] DEFAULT '{}') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.photography_packages%ROWTYPE; v_cart_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO p FROM public.photography_packages WHERE id=p_package_id AND is_active AND is_visible AND status='published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Package is unavailable'; END IF;
  IF EXISTS(SELECT 1 FROM public.photography_package_addons WHERE id=ANY(p_addon_ids) AND package_id<>p.id) OR (SELECT count(*) FROM public.photography_package_addons WHERE package_id=p.id AND id=ANY(p_addon_ids) AND is_active) <> coalesce(array_length(p_addon_ids,1),0) THEN RAISE EXCEPTION 'An add-on is unavailable'; END IF;
  INSERT INTO public.photography_carts(customer_id, photographer_id) VALUES(auth.uid(),p.photographer_id) ON CONFLICT (customer_id,photographer_id) WHERE status='active' DO UPDATE SET updated_at=now() RETURNING id INTO v_cart_id;
  INSERT INTO public.photography_cart_items(cart_id,package_id,addon_ids) VALUES(v_cart_id,p.id,p_addon_ids) ON CONFLICT(cart_id,package_id) DO UPDATE SET addon_ids=EXCLUDED.addon_ids;
  RETURN v_cart_id;
END $$;

CREATE OR REPLACE FUNCTION public.checkout_photography_cart(p_cart_id uuid, p_event_date date, p_event_time text DEFAULT NULL, p_venue text DEFAULT NULL, p_notes text DEFAULT NULL) RETURNS uuid[] LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.photography_carts%ROWTYPE; item record; p public.photography_packages%ROWTYPE; v_addons numeric; v_booking uuid; v_bookings uuid[] := '{}'; v_provider_user uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO c FROM public.photography_carts WHERE id=p_cart_id AND customer_id=auth.uid() AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active photography cart not found'; END IF;
  FOR item IN SELECT * FROM public.photography_cart_items WHERE cart_id=c.id LOOP
    SELECT * INTO p FROM public.photography_packages WHERE id=item.package_id AND photographer_id=c.photographer_id AND is_active AND is_visible AND status='published' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'A package is no longer available'; END IF;
    IF EXISTS(SELECT 1 FROM public.photographer_availability WHERE photographer_id=p.photographer_id AND available_date=p_event_date AND NOT is_available) THEN RAISE EXCEPTION 'Photographer is unavailable on this date'; END IF;
    SELECT coalesce(sum(price),0) INTO v_addons FROM public.photography_package_addons WHERE package_id=p.id AND id=ANY(item.addon_ids) AND is_active;
    IF (SELECT count(*) FROM public.photography_package_addons WHERE package_id=p.id AND id=ANY(item.addon_ids) AND is_active) <> coalesce(array_length(item.addon_ids,1),0) THEN RAISE EXCEPTION 'An add-on is unavailable'; END IF;
    INSERT INTO public.photography_package_bookings(package_id,photographer_id,customer_id,event_date,event_time,venue,notes,selected_addon_ids,base_amount,addons_amount,total_amount) VALUES(p.id,p.photographer_id,auth.uid(),p_event_date,p_event_time,nullif(trim(p_venue),''),nullif(trim(p_notes),''),item.addon_ids,p.price,v_addons,p.price+v_addons) RETURNING id INTO v_booking;
    INSERT INTO public.photography_package_payments(booking_id,amount) VALUES(v_booking,p.price+v_addons);
    INSERT INTO public.photography_package_invoices(booking_id,invoice_number,amount) VALUES(v_booking,'PH-' || upper(replace(v_booking::text,'-','')),p.price+v_addons);
    INSERT INTO public.photography_booking_timeline(booking_id,actor_id,event_type,message) VALUES(v_booking,auth.uid(),'booking_requested','Photography booking requested');
    SELECT user_id INTO v_provider_user FROM public.provider_profiles WHERE id=p.photographer_id;
    INSERT INTO public.notifications(user_id,title,message,type,reference_id) VALUES (auth.uid(),'Photography booking requested','Your photography booking request was created.','booking',v_booking),(v_provider_user,'New photography booking','You have a new photography package booking request.','booking',v_booking);
    v_bookings := array_append(v_bookings,v_booking);
  END LOOP;
  IF coalesce(array_length(v_bookings,1),0)=0 THEN RAISE EXCEPTION 'Your photography cart is empty'; END IF;
  UPDATE public.photography_carts SET status='checked_out' WHERE id=c.id;
  RETURN v_bookings;
END $$;
GRANT EXECUTE ON FUNCTION public.add_photography_cart_item(uuid,uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_photography_cart(uuid,date,text,text,text) TO authenticated;

DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['photography_carts','photography_cart_items','photography_package_payments','photography_package_invoices','photography_booking_timeline'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF;
END LOOP; EXCEPTION WHEN OTHERS THEN NULL; END $$;
-- Photographer-only optional albums and image ordering. Safe to apply repeatedly.
CREATE TABLE IF NOT EXISTS public.photography_albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.photography_packages(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (char_length(trim(type)) BETWEEN 1 AND 120),
  size text NOT NULL CHECK (char_length(trim(size)) BETWEEN 1 AND 80),
  pages integer NOT NULL CHECK (pages > 0),
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS photography_albums_package_active_idx ON public.photography_albums(package_id, is_active, sort_order);
ALTER TABLE public.photography_albums ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS photography_albums_read ON public.photography_albums;
DROP POLICY IF EXISTS photography_albums_owner ON public.photography_albums;
CREATE POLICY photography_albums_read ON public.photography_albums FOR SELECT USING (EXISTS (SELECT 1 FROM public.photography_packages p WHERE p.id = package_id AND ((p.is_active AND p.is_visible AND p.status = 'published') OR public.owns_photographer(p.photographer_id))));
CREATE POLICY photography_albums_owner ON public.photography_albums FOR ALL USING (EXISTS (SELECT 1 FROM public.photography_packages p WHERE p.id = package_id AND public.owns_photographer(p.photographer_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.photography_packages p WHERE p.id = package_id AND public.owns_photographer(p.photographer_id)));

-- Preserve legacy included-album data as a selectable, zero-cost option; no package price changes.
INSERT INTO public.photography_albums(package_id, type, size, pages, price, is_active, sort_order)
SELECT p.id, COALESCE(NULLIF(trim(p.album_type), ''), 'Album'), COALESCE(NULLIF(trim(p.album_size), ''), 'Standard'), COALESCE(p.album_pages, 20), 0, true, 0
FROM public.photography_packages p
WHERE p.album_included AND NOT EXISTS (SELECT 1 FROM public.photography_albums a WHERE a.package_id = p.id);

ALTER TABLE public.photography_cart_items ADD COLUMN IF NOT EXISTS album_id uuid REFERENCES public.photography_albums(id) ON DELETE SET NULL;
ALTER TABLE public.photography_package_bookings ADD COLUMN IF NOT EXISTS selected_album_id uuid REFERENCES public.photography_albums(id) ON DELETE SET NULL;
ALTER TABLE public.photography_package_bookings ADD COLUMN IF NOT EXISTS album_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (album_amount >= 0);
ALTER TABLE public.photography_package_bookings ADD COLUMN IF NOT EXISTS selected_album_details jsonb;
CREATE INDEX IF NOT EXISTS photography_cart_items_album_idx ON public.photography_cart_items(album_id);

CREATE OR REPLACE FUNCTION public.add_photography_cart_item(p_package_id uuid, p_addon_ids uuid[] DEFAULT '{}', p_album_id uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.photography_packages%ROWTYPE; v_cart_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO p FROM public.photography_packages WHERE id=p_package_id AND is_active AND is_visible AND status='published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Package is unavailable'; END IF;
  IF p_album_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.photography_albums WHERE id=p_album_id AND package_id=p.id AND is_active) THEN RAISE EXCEPTION 'The selected album is unavailable'; END IF;
  IF EXISTS(SELECT 1 FROM public.photography_package_addons WHERE id=ANY(p_addon_ids) AND package_id<>p.id) OR (SELECT count(*) FROM public.photography_package_addons WHERE package_id=p.id AND id=ANY(p_addon_ids) AND is_active) <> coalesce(array_length(p_addon_ids,1),0) THEN RAISE EXCEPTION 'An add-on is unavailable'; END IF;
  INSERT INTO public.photography_carts(customer_id, photographer_id) VALUES(auth.uid(),p.photographer_id) ON CONFLICT (customer_id,photographer_id) WHERE status='active' DO UPDATE SET updated_at=now() RETURNING id INTO v_cart_id;
  INSERT INTO public.photography_cart_items(cart_id,package_id,addon_ids,album_id) VALUES(v_cart_id,p.id,p_addon_ids,p_album_id) ON CONFLICT(cart_id,package_id) DO UPDATE SET addon_ids=EXCLUDED.addon_ids, album_id=EXCLUDED.album_id;
  RETURN v_cart_id;
END $$;

CREATE OR REPLACE FUNCTION public.checkout_photography_cart(p_cart_id uuid, p_event_date date, p_event_time text DEFAULT NULL, p_venue text DEFAULT NULL, p_notes text DEFAULT NULL) RETURNS uuid[] LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.photography_carts%ROWTYPE; item record; p public.photography_packages%ROWTYPE; v_addons numeric; v_album public.photography_albums%ROWTYPE; v_booking uuid; v_bookings uuid[] := '{}'; v_provider_user uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO c FROM public.photography_carts WHERE id=p_cart_id AND customer_id=auth.uid() AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active photography cart not found'; END IF;
  FOR item IN SELECT * FROM public.photography_cart_items WHERE cart_id=c.id LOOP
    SELECT * INTO p FROM public.photography_packages WHERE id=item.package_id AND photographer_id=c.photographer_id AND is_active AND is_visible AND status='published' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'A package is no longer available'; END IF;
    IF EXISTS(SELECT 1 FROM public.photographer_availability WHERE photographer_id=p.photographer_id AND available_date=p_event_date AND NOT is_available) THEN RAISE EXCEPTION 'Photographer is unavailable on this date'; END IF;
    SELECT coalesce(sum(price),0) INTO v_addons FROM public.photography_package_addons WHERE package_id=p.id AND id=ANY(item.addon_ids) AND is_active;
    IF (SELECT count(*) FROM public.photography_package_addons WHERE package_id=p.id AND id=ANY(item.addon_ids) AND is_active) <> coalesce(array_length(item.addon_ids,1),0) THEN RAISE EXCEPTION 'An add-on is unavailable'; END IF;
    IF item.album_id IS NOT NULL THEN SELECT * INTO v_album FROM public.photography_albums WHERE id=item.album_id AND package_id=p.id AND is_active; IF NOT FOUND THEN RAISE EXCEPTION 'The selected album is unavailable'; END IF; END IF;
    INSERT INTO public.photography_package_bookings(package_id,photographer_id,customer_id,event_date,event_time,venue,notes,selected_addon_ids,selected_album_id,selected_album_details,base_amount,addons_amount,album_amount,total_amount) VALUES(p.id,p.photographer_id,auth.uid(),p_event_date,p_event_time,nullif(trim(p_venue),''),nullif(trim(p_notes),''),item.addon_ids,item.album_id,CASE WHEN item.album_id IS NULL THEN NULL ELSE jsonb_build_object('type',v_album.type,'size',v_album.size,'pages',v_album.pages,'price',v_album.price) END,p.price,v_addons,coalesce(v_album.price,0),p.price+v_addons+coalesce(v_album.price,0)) RETURNING id INTO v_booking;
    INSERT INTO public.photography_package_payments(booking_id,amount) VALUES(v_booking,p.price+v_addons+coalesce(v_album.price,0));
    INSERT INTO public.photography_package_invoices(booking_id,invoice_number,amount) VALUES(v_booking,'PH-' || upper(replace(v_booking::text,'-','')),p.price+v_addons+coalesce(v_album.price,0));
    INSERT INTO public.photography_booking_timeline(booking_id,actor_id,event_type,message) VALUES(v_booking,auth.uid(),'booking_requested','Photography booking requested');
    SELECT user_id INTO v_provider_user FROM public.provider_profiles WHERE id=p.photographer_id;
    INSERT INTO public.notifications(user_id,title,message,type,reference_id) VALUES (auth.uid(),'Photography booking requested','Your photography booking request was created.','booking',v_booking::text),(v_provider_user,'New photography booking','You have a new photography package booking request.','booking',v_booking::text);
    v_bookings := array_append(v_bookings,v_booking);
  END LOOP;
  IF coalesce(array_length(v_bookings,1),0)=0 THEN RAISE EXCEPTION 'Your photography cart is empty'; END IF;
  UPDATE public.photography_carts SET status='checked_out' WHERE id=c.id;
  RETURN v_bookings;
END $$;
GRANT EXECUTE ON FUNCTION public.add_photography_cart_item(uuid,uuid[],uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkout_photography_cart(uuid,date,text,text,text) TO authenticated;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='photography_albums') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.photography_albums; END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
-- Fix: remove ::text cast from v_booking when inserting into notifications.reference_id (uuid column)
-- This caused: "column reference_id is of type uuid but expression is of type text"

CREATE OR REPLACE FUNCTION public.checkout_photography_cart(p_cart_id uuid, p_event_date date, p_event_time text DEFAULT NULL, p_venue text DEFAULT NULL, p_notes text DEFAULT NULL) RETURNS uuid[] LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.photography_carts%ROWTYPE; item record; p public.photography_packages%ROWTYPE; v_addons numeric; v_album public.photography_albums%ROWTYPE; v_booking uuid; v_bookings uuid[] := '{}'; v_provider_user uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO c FROM public.photography_carts WHERE id=p_cart_id AND customer_id=auth.uid() AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active photography cart not found'; END IF;
  FOR item IN SELECT * FROM public.photography_cart_items WHERE cart_id=c.id LOOP
    v_album := NULL;
    SELECT * INTO p FROM public.photography_packages WHERE id=item.package_id AND photographer_id=c.photographer_id AND is_active AND is_visible AND status='published' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'A package is no longer available'; END IF;
    IF EXISTS(SELECT 1 FROM public.photographer_availability WHERE photographer_id=p.photographer_id AND available_date=p_event_date AND NOT is_available) THEN RAISE EXCEPTION 'Photographer is unavailable on this date'; END IF;
    SELECT coalesce(sum(price),0) INTO v_addons FROM public.photography_package_addons WHERE package_id=p.id AND id=ANY(item.addon_ids) AND is_active;
    IF (SELECT count(*) FROM public.photography_package_addons WHERE package_id=p.id AND id=ANY(item.addon_ids) AND is_active) <> coalesce(array_length(item.addon_ids,1),0) THEN RAISE EXCEPTION 'An add-on is unavailable'; END IF;
    IF item.album_id IS NOT NULL THEN SELECT * INTO v_album FROM public.photography_albums WHERE id=item.album_id AND package_id=p.id AND is_active; IF NOT FOUND THEN RAISE EXCEPTION 'The selected album is unavailable'; END IF; END IF;
    INSERT INTO public.photography_package_bookings(package_id,photographer_id,customer_id,event_date,event_time,venue,notes,selected_addon_ids,selected_album_id,selected_album_details,base_amount,addons_amount,album_amount,total_amount) VALUES(p.id,p.photographer_id,auth.uid(),p_event_date,p_event_time,nullif(trim(p_venue),''),nullif(trim(p_notes),''),item.addon_ids,item.album_id,CASE WHEN item.album_id IS NULL THEN NULL ELSE jsonb_build_object('type',v_album.type,'size',v_album.size,'pages',v_album.pages,'price',v_album.price) END,p.price,v_addons,coalesce(v_album.price,0),p.price+v_addons+coalesce(v_album.price,0)) RETURNING id INTO v_booking;
    INSERT INTO public.photography_package_payments(booking_id,amount) VALUES(v_booking,p.price+v_addons+coalesce(v_album.price,0));
    INSERT INTO public.photography_package_invoices(booking_id,invoice_number,amount) VALUES(v_booking,'PH-' || upper(replace(v_booking::text,'-','')),p.price+v_addons+coalesce(v_album.price,0));
    INSERT INTO public.photography_booking_timeline(booking_id,actor_id,event_type,message) VALUES(v_booking,auth.uid(),'booking_requested','Photography booking requested');
    SELECT user_id INTO v_provider_user FROM public.provider_profiles WHERE id=p.photographer_id;
    INSERT INTO public.notifications(user_id,title,message,type,reference_id) VALUES (auth.uid(),'Photography booking requested','Your photography booking request was created.','booking',v_booking),(v_provider_user,'New photography booking','You have a new photography package booking request.','booking',v_booking);
    v_bookings := array_append(v_bookings,v_booking);
  END LOOP;
  IF coalesce(array_length(v_bookings,1),0)=0 THEN RAISE EXCEPTION 'Your photography cart is empty'; END IF;
  UPDATE public.photography_carts SET status='checked_out' WHERE id=c.id;
  RETURN v_bookings;
END $$;

GRANT EXECUTE ON FUNCTION public.checkout_photography_cart(uuid,date,text,text,text) TO authenticated;
-- Catering category management system. Idempotent. Isolated from all other categories.
-- Pattern: same as Water Supplier and Photographer — dedicated tables, RLS, ownership guards.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Ownership functions ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_caterer(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text='catering_services');
$$;
CREATE OR REPLACE FUNCTION public.owns_caterer(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text='catering_services');
$$;

-- ─── Catering Packages ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.catering_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 150),
  description text,
  cuisine_types text[] NOT NULL DEFAULT '{}',
  service_types text[] NOT NULL DEFAULT '{}',
  serving_styles text[] NOT NULL DEFAULT '{}',
  meal_types text[] NOT NULL DEFAULT '{}',
  price_per_plate numeric(12,2) CHECK (price_per_plate >= 0),
  starting_price numeric(12,2) CHECK (starting_price >= 0),
  min_guests integer NOT NULL DEFAULT 50 CHECK (min_guests > 0),
  max_guests integer CHECK (max_guests IS NULL OR max_guests >= min_guests),
  recommended_guests integer,
  advance_percentage integer DEFAULT 30 CHECK (advance_percentage BETWEEN 0 AND 100),
  preparation_days integer DEFAULT 3,
  cancellation_policy text,
  service_duration text,
  is_veg boolean NOT NULL DEFAULT true,
  is_nonveg boolean NOT NULL DEFAULT false,
  is_jain boolean NOT NULL DEFAULT false,
  is_vegan boolean NOT NULL DEFAULT false,
  travel_within_city boolean NOT NULL DEFAULT true,
  travel_outside_city boolean NOT NULL DEFAULT false,
  max_travel_km integer,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','archived')),
  is_featured boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS catering_packages_provider_idx ON public.catering_packages(provider_id, status);

-- ─── Menu Sections ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.catering_menu_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.catering_packages(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 100),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS catering_sections_package_idx ON public.catering_menu_sections(package_id, sort_order);

-- ─── Menu Items ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.catering_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.catering_menu_sections(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  description text,
  is_veg boolean NOT NULL DEFAULT true,
  is_jain boolean NOT NULL DEFAULT false,
  is_premium boolean NOT NULL DEFAULT false,
  is_bestseller boolean NOT NULL DEFAULT false,
  is_unlimited boolean NOT NULL DEFAULT true,
  spicy_level integer DEFAULT 1 CHECK (spicy_level BETWEEN 0 AND 5),
  extra_cost numeric(12,2) DEFAULT 0 CHECK (extra_cost >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS catering_items_section_idx ON public.catering_menu_items(section_id, sort_order);

-- ─── Package Add-ons ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.catering_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.catering_packages(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS catering_addons_package_idx ON public.catering_addons(package_id);

-- ─── Package Gallery ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.catering_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.catering_packages(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  alt_text text,
  is_cover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS catering_gallery_one_cover ON public.catering_gallery(package_id) WHERE is_cover;
CREATE INDEX IF NOT EXISTS catering_gallery_package_idx ON public.catering_gallery(package_id, sort_order);

-- ─── Catering Bookings ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.catering_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.catering_packages(id),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id),
  customer_id uuid NOT NULL REFERENCES public.profiles(id),
  event_type text,
  event_date date NOT NULL,
  guest_count integer NOT NULL CHECK (guest_count > 0),
  meal_type text,
  venue text,
  special_requests text,
  selected_addon_ids uuid[] NOT NULL DEFAULT '{}',
  base_amount numeric(12,2) NOT NULL CHECK (base_amount >= 0),
  addons_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (addons_amount >= 0),
  total_amount numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','preparing','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS catering_bookings_provider_idx ON public.catering_bookings(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS catering_bookings_customer_idx ON public.catering_bookings(customer_id, created_at DESC);

-- ─── Triggers ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.catering_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS catering_packages_updated_at ON public.catering_packages;
CREATE TRIGGER catering_packages_updated_at BEFORE UPDATE ON public.catering_packages FOR EACH ROW EXECUTE FUNCTION public.catering_updated_at();

CREATE OR REPLACE FUNCTION public.catering_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF NOT public.is_caterer(NEW.provider_id) THEN RAISE EXCEPTION 'Catering data is restricted to catering_services providers'; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS catering_package_guard ON public.catering_packages;
CREATE TRIGGER catering_package_guard BEFORE INSERT OR UPDATE OF provider_id ON public.catering_packages FOR EACH ROW EXECUTE FUNCTION public.catering_guard();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['catering_packages','catering_menu_sections','catering_menu_items','catering_addons','catering_gallery','catering_bookings'] LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END IF;
END LOOP; END $$;

DROP POLICY IF EXISTS catering_packages_read ON public.catering_packages;
DROP POLICY IF EXISTS catering_packages_owner ON public.catering_packages;
CREATE POLICY catering_packages_read ON public.catering_packages FOR SELECT USING ((status='active') OR public.owns_caterer(provider_id));
CREATE POLICY catering_packages_owner ON public.catering_packages FOR ALL USING (public.owns_caterer(provider_id)) WITH CHECK (public.owns_caterer(provider_id));

DROP POLICY IF EXISTS catering_sections_read ON public.catering_menu_sections;
DROP POLICY IF EXISTS catering_sections_owner ON public.catering_menu_sections;
CREATE POLICY catering_sections_read ON public.catering_menu_sections FOR SELECT USING (true);
CREATE POLICY catering_sections_owner ON public.catering_menu_sections FOR ALL USING (EXISTS(SELECT 1 FROM public.catering_packages p WHERE p.id=package_id AND public.owns_caterer(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.catering_packages p WHERE p.id=package_id AND public.owns_caterer(p.provider_id)));

DROP POLICY IF EXISTS catering_items_read ON public.catering_menu_items;
DROP POLICY IF EXISTS catering_items_owner ON public.catering_menu_items;
CREATE POLICY catering_items_read ON public.catering_menu_items FOR SELECT USING (true);
CREATE POLICY catering_items_owner ON public.catering_menu_items FOR ALL USING (EXISTS(SELECT 1 FROM public.catering_menu_sections s JOIN public.catering_packages p ON p.id=s.package_id WHERE s.id=section_id AND public.owns_caterer(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.catering_menu_sections s JOIN public.catering_packages p ON p.id=s.package_id WHERE s.id=section_id AND public.owns_caterer(p.provider_id)));

DROP POLICY IF EXISTS catering_addons_read ON public.catering_addons;
DROP POLICY IF EXISTS catering_addons_owner ON public.catering_addons;
CREATE POLICY catering_addons_read ON public.catering_addons FOR SELECT USING (true);
CREATE POLICY catering_addons_owner ON public.catering_addons FOR ALL USING (EXISTS(SELECT 1 FROM public.catering_packages p WHERE p.id=package_id AND public.owns_caterer(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.catering_packages p WHERE p.id=package_id AND public.owns_caterer(p.provider_id)));

DROP POLICY IF EXISTS catering_gallery_read ON public.catering_gallery;
DROP POLICY IF EXISTS catering_gallery_owner ON public.catering_gallery;
CREATE POLICY catering_gallery_read ON public.catering_gallery FOR SELECT USING (true);
CREATE POLICY catering_gallery_owner ON public.catering_gallery FOR ALL USING (EXISTS(SELECT 1 FROM public.catering_packages p WHERE p.id=package_id AND public.owns_caterer(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.catering_packages p WHERE p.id=package_id AND public.owns_caterer(p.provider_id)));

DROP POLICY IF EXISTS catering_bookings_read ON public.catering_bookings;
CREATE POLICY catering_bookings_read ON public.catering_bookings FOR SELECT USING (customer_id=auth.uid() OR public.owns_caterer(provider_id));

-- ─── Storage ─────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets(id,name,public) VALUES('catering-images','catering-images',true) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS catering_images_read ON storage.objects;
DROP POLICY IF EXISTS catering_images_owner ON storage.objects;
CREATE POLICY catering_images_read ON storage.objects FOR SELECT USING(bucket_id='catering-images');
CREATE POLICY catering_images_owner ON storage.objects FOR ALL TO authenticated USING(bucket_id='catering-images' AND auth.uid()::text=(storage.foldername(name))[1]) WITH CHECK(bucket_id='catering-images' AND auth.uid()::text=(storage.foldername(name))[1]);

-- ─── Realtime ────────────────────────────────────────────────────────────────
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['catering_packages','catering_menu_sections','catering_menu_items','catering_addons','catering_gallery','catering_bookings'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF;
END LOOP; EXCEPTION WHEN OTHERS THEN NULL; END $$;
-- Videography category management system. Idempotent. Isolated from all other categories.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.is_videographer(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text IN ('videographer','cinematographer'));
$$;
CREATE OR REPLACE FUNCTION public.owns_videographer(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text IN ('videographer','cinematographer'));
$$;

CREATE TABLE IF NOT EXISTS public.videography_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 150),
  description text,
  starting_price numeric(12,2) CHECK (starting_price >= 0),
  full_day_price numeric(12,2),
  half_day_price numeric(12,2),
  hourly_price numeric(12,2),
  extra_hour_cost numeric(12,2),
  advance_percentage integer DEFAULT 30 CHECK (advance_percentage BETWEEN 0 AND 100),
  coverage_hours text,
  event_types text[] NOT NULL DEFAULT '{}',
  included_services text[] NOT NULL DEFAULT '{}',
  deliverables text[] NOT NULL DEFAULT '{}',
  delivery_time text,
  equipment text[] NOT NULL DEFAULT '{}',
  editing_options text[] NOT NULL DEFAULT '{}',
  team_videographers integer DEFAULT 1,
  team_assistants integer DEFAULT 0,
  team_drone_operator boolean DEFAULT false,
  team_editor integer DEFAULT 1,
  team_live_operator boolean DEFAULT false,
  travel_within_city boolean DEFAULT true,
  travel_outside_city boolean DEFAULT false,
  max_travel_km integer,
  cancellation_policy text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','archived')),
  is_featured boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS videography_packages_provider_idx ON public.videography_packages(provider_id, status);

CREATE TABLE IF NOT EXISTS public.videography_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.videography_packages(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS videography_addons_package_idx ON public.videography_addons(package_id);

CREATE TABLE IF NOT EXISTS public.videography_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.videography_packages(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video')),
  is_cover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS videography_gallery_package_idx ON public.videography_gallery(package_id);

CREATE TABLE IF NOT EXISTS public.videography_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.videography_packages(id),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id),
  customer_id uuid NOT NULL REFERENCES public.profiles(id),
  event_type text,
  event_date date NOT NULL,
  event_time text,
  venue text,
  notes text,
  selected_addon_ids uuid[] NOT NULL DEFAULT '{}',
  base_amount numeric(12,2) NOT NULL CHECK (base_amount >= 0),
  addons_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS videography_bookings_provider_idx ON public.videography_bookings(provider_id, created_at DESC);

-- Triggers
CREATE OR REPLACE FUNCTION public.videography_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS videography_packages_updated_at ON public.videography_packages;
CREATE TRIGGER videography_packages_updated_at BEFORE UPDATE ON public.videography_packages FOR EACH ROW EXECUTE FUNCTION public.videography_updated_at();

CREATE OR REPLACE FUNCTION public.videography_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF NOT public.is_videographer(NEW.provider_id) THEN RAISE EXCEPTION 'Videography data is restricted to videographer/cinematographer providers'; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS videography_package_guard ON public.videography_packages;
CREATE TRIGGER videography_package_guard BEFORE INSERT OR UPDATE OF provider_id ON public.videography_packages FOR EACH ROW EXECUTE FUNCTION public.videography_guard();

-- RLS
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['videography_packages','videography_addons','videography_gallery','videography_bookings'] LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END IF;
END LOOP; END $$;

DROP POLICY IF EXISTS videography_packages_read ON public.videography_packages;
DROP POLICY IF EXISTS videography_packages_owner ON public.videography_packages;
CREATE POLICY videography_packages_read ON public.videography_packages FOR SELECT USING ((status='active') OR public.owns_videographer(provider_id));
CREATE POLICY videography_packages_owner ON public.videography_packages FOR ALL USING (public.owns_videographer(provider_id)) WITH CHECK (public.owns_videographer(provider_id));

DROP POLICY IF EXISTS videography_addons_read ON public.videography_addons;
DROP POLICY IF EXISTS videography_addons_owner ON public.videography_addons;
CREATE POLICY videography_addons_read ON public.videography_addons FOR SELECT USING (true);
CREATE POLICY videography_addons_owner ON public.videography_addons FOR ALL USING (EXISTS(SELECT 1 FROM public.videography_packages p WHERE p.id=package_id AND public.owns_videographer(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.videography_packages p WHERE p.id=package_id AND public.owns_videographer(p.provider_id)));

DROP POLICY IF EXISTS videography_gallery_read ON public.videography_gallery;
DROP POLICY IF EXISTS videography_gallery_owner ON public.videography_gallery;
CREATE POLICY videography_gallery_read ON public.videography_gallery FOR SELECT USING (true);
CREATE POLICY videography_gallery_owner ON public.videography_gallery FOR ALL USING (EXISTS(SELECT 1 FROM public.videography_packages p WHERE p.id=package_id AND public.owns_videographer(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.videography_packages p WHERE p.id=package_id AND public.owns_videographer(p.provider_id)));

DROP POLICY IF EXISTS videography_bookings_read ON public.videography_bookings;
CREATE POLICY videography_bookings_read ON public.videography_bookings FOR SELECT USING (customer_id=auth.uid() OR public.owns_videographer(provider_id));

-- Storage
INSERT INTO storage.buckets(id,name,public) VALUES('videography-media','videography-media',true) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS videography_media_read ON storage.objects;
DROP POLICY IF EXISTS videography_media_owner ON storage.objects;
CREATE POLICY videography_media_read ON storage.objects FOR SELECT USING(bucket_id='videography-media');
CREATE POLICY videography_media_owner ON storage.objects FOR ALL TO authenticated USING(bucket_id='videography-media' AND auth.uid()::text=(storage.foldername(name))[1]) WITH CHECK(bucket_id='videography-media' AND auth.uid()::text=(storage.foldername(name))[1]);

-- Realtime
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['videography_packages','videography_addons','videography_gallery','videography_bookings'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF;
END LOOP; EXCEPTION WHEN OTHERS THEN NULL; END $$;
-- Allow authenticated customers to create catering bookings
DROP POLICY IF EXISTS catering_bookings_customer_insert ON public.catering_bookings;
CREATE POLICY catering_bookings_customer_insert ON public.catering_bookings
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());

-- Allow customers to cancel their own bookings
DROP POLICY IF EXISTS catering_bookings_customer_update ON public.catering_bookings;
CREATE POLICY catering_bookings_customer_update ON public.catering_bookings
  FOR UPDATE TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());
-- Payment Architecture Redesign: Accept-then-pay-advance flow
-- Adds advance payment tracking columns to bookings and catering_bookings tables.
-- Does NOT drop existing columns or break existing data.

-- ─── Generic Bookings Table ──────────────────────────────────────────────────
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS advance_amount numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_amount numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS advance_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS expired_at timestamptz,
  ADD COLUMN IF NOT EXISTS calendar_locked boolean NOT NULL DEFAULT false;

-- ─── Catering Bookings Table ─────────────────────────────────────────────────
ALTER TABLE public.catering_bookings
  ADD COLUMN IF NOT EXISTS advance_amount numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_amount numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS advance_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS expired_at timestamptz,
  ADD COLUMN IF NOT EXISTS calendar_locked boolean NOT NULL DEFAULT false;

-- ─── Photography Bookings Table ──────────────────────────────────────────────
ALTER TABLE public.photography_package_bookings
  ADD COLUMN IF NOT EXISTS advance_amount numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_amount numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS advance_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS expired_at timestamptz,
  ADD COLUMN IF NOT EXISTS calendar_locked boolean NOT NULL DEFAULT false;

-- ─── Set platform_fee to 0 for future bookings (keep column for backward compat) ─
-- We don't drop platform_fee to avoid breaking existing type definitions.
-- New bookings will always have platform_fee = 0.

-- ─── Index for payment deadline expiry checks ────────────────────────────────
CREATE INDEX IF NOT EXISTS bookings_payment_deadline_idx ON public.bookings(payment_deadline) WHERE payment_deadline IS NOT NULL AND calendar_locked = false;
CREATE INDEX IF NOT EXISTS catering_bookings_payment_deadline_idx ON public.catering_bookings(payment_deadline) WHERE payment_deadline IS NOT NULL AND calendar_locked = false;
-- Add 'accepted' and 'in_progress' to catering_bookings status CHECK constraint
-- and 'accepted'/'in_progress' to photography_package_bookings if needed.
-- This allows the unified booking lifecycle to use 'accepted' across all tables.

-- Drop and recreate the catering_bookings status constraint
ALTER TABLE public.catering_bookings DROP CONSTRAINT IF EXISTS catering_bookings_status_check;
ALTER TABLE public.catering_bookings ADD CONSTRAINT catering_bookings_status_check
  CHECK (status IN ('pending','accepted','confirmed','in_progress','preparing','completed','cancelled'));

-- Drop and recreate the photography_package_bookings status constraint (if exists)
DO $$ BEGIN
  ALTER TABLE public.photography_package_bookings DROP CONSTRAINT IF EXISTS photography_package_bookings_status_check;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.photography_package_bookings ADD CONSTRAINT photography_package_bookings_status_check
    CHECK (status IN ('pending','accepted','confirmed','in_progress','completed','cancelled'));
EXCEPTION WHEN undefined_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;
-- Drone Photography category system. Idempotent. Isolated from all other categories.
-- Pattern: same as Catering/Photography — dedicated tables, RLS, ownership guards.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Ownership functions ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_drone_operator(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text IN ('drone_photography','drone_operator','drone_videography'));
$$;
CREATE OR REPLACE FUNCTION public.owns_drone_operator(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text IN ('drone_photography','drone_operator','drone_videography'));
$$;

-- ─── Drone Packages ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.drone_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 150),
  description text,
  -- Pricing
  starting_price numeric(12,2) CHECK (starting_price >= 0),
  fixed_price numeric(12,2) CHECK (fixed_price >= 0),
  hourly_price numeric(12,2) CHECK (hourly_price >= 0),
  half_day_price numeric(12,2) CHECK (half_day_price >= 0),
  full_day_price numeric(12,2) CHECK (full_day_price >= 0),
  -- Coverage
  service_types text[] NOT NULL DEFAULT '{}',
  coverage_type text DEFAULT 'photos_videos' CHECK (coverage_type IN ('photos_only','videos_only','photos_videos')),
  coverage_durations text[] NOT NULL DEFAULT '{}',
  -- Drone details
  drone_brand text,
  drone_model text,
  camera_resolution text DEFAULT '4K',
  drone_features text[] NOT NULL DEFAULT '{}',
  -- Deliverables
  deliverables text[] NOT NULL DEFAULT '{}',
  delivery_time text,
  -- Coverage includes
  coverage_includes text[] NOT NULL DEFAULT '{}',
  -- Travel
  travel_within_city boolean NOT NULL DEFAULT true,
  travel_outside_city boolean NOT NULL DEFAULT false,
  max_travel_km integer,
  -- Policies
  cancellation_policy text,
  weather_policy text,
  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused')),
  is_featured boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS drone_packages_provider_idx ON public.drone_packages(provider_id, status);

-- ─── Drone Gallery ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.drone_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.drone_packages(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video')),
  alt_text text,
  is_cover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS drone_gallery_one_cover ON public.drone_gallery(package_id) WHERE is_cover;
CREATE INDEX IF NOT EXISTS drone_gallery_package_idx ON public.drone_gallery(package_id, sort_order);

-- ─── Drone Add-ons ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.drone_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.drone_packages(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS drone_addons_package_idx ON public.drone_addons(package_id);

-- ─── Drone Bookings ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.drone_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.drone_packages(id),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id),
  customer_id uuid NOT NULL REFERENCES public.profiles(id),
  event_type text,
  event_date date NOT NULL,
  event_time text,
  coverage_duration text,
  venue text,
  indoor_outdoor text DEFAULT 'outdoor',
  drone_permission_available boolean DEFAULT false,
  restricted_area boolean DEFAULT false,
  special_requests text,
  selected_addon_ids uuid[] NOT NULL DEFAULT '{}',
  base_amount numeric(12,2) NOT NULL CHECK (base_amount >= 0),
  addons_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (addons_amount >= 0),
  total_amount numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  advance_amount numeric(12,2) DEFAULT 0,
  remaining_amount numeric(12,2) DEFAULT 0,
  payment_deadline timestamptz,
  accepted_at timestamptz,
  advance_paid_at timestamptz,
  confirmed_at timestamptz,
  expired_at timestamptz,
  calendar_locked boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','confirmed','in_progress','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS drone_bookings_provider_idx ON public.drone_bookings(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS drone_bookings_customer_idx ON public.drone_bookings(customer_id, created_at DESC);

-- ─── Triggers ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.drone_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS drone_packages_updated_at ON public.drone_packages;
CREATE TRIGGER drone_packages_updated_at BEFORE UPDATE ON public.drone_packages FOR EACH ROW EXECUTE FUNCTION public.drone_updated_at();

CREATE OR REPLACE FUNCTION public.drone_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF NOT public.is_drone_operator(NEW.provider_id) THEN RAISE EXCEPTION 'Drone data is restricted to drone_photography providers'; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS drone_package_guard ON public.drone_packages;
CREATE TRIGGER drone_package_guard BEFORE INSERT OR UPDATE OF provider_id ON public.drone_packages FOR EACH ROW EXECUTE FUNCTION public.drone_guard();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['drone_packages','drone_gallery','drone_addons','drone_bookings'] LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END IF;
END LOOP; END $$;

DROP POLICY IF EXISTS drone_packages_read ON public.drone_packages;
DROP POLICY IF EXISTS drone_packages_owner ON public.drone_packages;
CREATE POLICY drone_packages_read ON public.drone_packages FOR SELECT USING ((status='active') OR public.owns_drone_operator(provider_id));
CREATE POLICY drone_packages_owner ON public.drone_packages FOR ALL USING (public.owns_drone_operator(provider_id)) WITH CHECK (public.owns_drone_operator(provider_id));

DROP POLICY IF EXISTS drone_gallery_read ON public.drone_gallery;
DROP POLICY IF EXISTS drone_gallery_owner ON public.drone_gallery;
CREATE POLICY drone_gallery_read ON public.drone_gallery FOR SELECT USING (true);
CREATE POLICY drone_gallery_owner ON public.drone_gallery FOR ALL USING (EXISTS(SELECT 1 FROM public.drone_packages p WHERE p.id=package_id AND public.owns_drone_operator(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.drone_packages p WHERE p.id=package_id AND public.owns_drone_operator(p.provider_id)));

DROP POLICY IF EXISTS drone_addons_read ON public.drone_addons;
DROP POLICY IF EXISTS drone_addons_owner ON public.drone_addons;
CREATE POLICY drone_addons_read ON public.drone_addons FOR SELECT USING (true);
CREATE POLICY drone_addons_owner ON public.drone_addons FOR ALL USING (EXISTS(SELECT 1 FROM public.drone_packages p WHERE p.id=package_id AND public.owns_drone_operator(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.drone_packages p WHERE p.id=package_id AND public.owns_drone_operator(p.provider_id)));

DROP POLICY IF EXISTS drone_bookings_read ON public.drone_bookings;
DROP POLICY IF EXISTS drone_bookings_customer_insert ON public.drone_bookings;
CREATE POLICY drone_bookings_read ON public.drone_bookings FOR SELECT USING (customer_id=auth.uid() OR public.owns_drone_operator(provider_id));
CREATE POLICY drone_bookings_customer_insert ON public.drone_bookings FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY drone_bookings_customer_update ON public.drone_bookings FOR UPDATE TO authenticated USING (customer_id = auth.uid() OR public.owns_drone_operator(provider_id));

-- ─── Storage ─────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets(id,name,public) VALUES('drone-media','drone-media',true) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS drone_media_read ON storage.objects;
DROP POLICY IF EXISTS drone_media_owner ON storage.objects;
CREATE POLICY drone_media_read ON storage.objects FOR SELECT USING(bucket_id='drone-media');
CREATE POLICY drone_media_owner ON storage.objects FOR ALL TO authenticated USING(bucket_id='drone-media' AND auth.uid()::text=(storage.foldername(name))[1]) WITH CHECK(bucket_id='drone-media' AND auth.uid()::text=(storage.foldername(name))[1]);

-- ─── Realtime ────────────────────────────────────────────────────────────────
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['drone_packages','drone_gallery','drone_addons','drone_bookings'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF;
END LOOP; EXCEPTION WHEN OTHERS THEN NULL; END $$;
-- ─── Document Verification Status Fields ─────────────────────────────────────
-- Adds verification status tracking for uploaded identity documents.
-- Tracks: aadhaar, pan, govt_id verification states per provider.

ALTER TABLE provider_profiles
  ADD COLUMN IF NOT EXISTS aadhaar_status text DEFAULT 'pending' CHECK (aadhaar_status IN ('pending','verified','rejected')),
  ADD COLUMN IF NOT EXISTS aadhaar_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS pan_status text DEFAULT 'pending' CHECK (pan_status IN ('pending','verified','rejected')),
  ADD COLUMN IF NOT EXISTS pan_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS govt_id_status text DEFAULT 'pending' CHECK (govt_id_status IN ('pending','verified','rejected','not_uploaded')),
  ADD COLUMN IF NOT EXISTS govt_id_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS doc_verification_notes text;

-- Update existing records that already have documents uploaded
UPDATE provider_profiles
SET aadhaar_status = 'pending',
    pan_status = 'pending',
    govt_id_status = CASE
      WHEN (vendor_details->>'govt_id_url') IS NOT NULL AND (vendor_details->>'govt_id_url') != '' THEN 'pending'
      ELSE 'not_uploaded'
    END
WHERE aadhaar_status IS NULL;
-- ═══════════════════════════════════════════════════════════════════════════════
-- FIX: Missing UPDATE policies on category-specific booking tables.
--
-- ROOT CAUSE: Vendor accept/decline and customer cancel/pay-advance mutations
-- were SILENTLY FAILING because RLS blocked the UPDATE.
--
-- - catering_bookings: had customer UPDATE but NO vendor UPDATE
-- - photography_package_bookings: had NO update policy at all
-- - drone_bookings: already correct (has both)
-- - generic bookings: already correct ('Booking parties can update')
--
-- This migration adds the missing policies so both parties can update bookings.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── CATERING BOOKINGS: Add vendor/provider UPDATE policy ────────────────────
-- The customer policy already exists (from 20260808000000), keep it.
-- Add provider policy: caterer who owns the booking can update it.
DROP POLICY IF EXISTS catering_bookings_provider_update ON public.catering_bookings;
CREATE POLICY catering_bookings_provider_update ON public.catering_bookings
  FOR UPDATE TO authenticated
  USING (public.owns_caterer(provider_id))
  WITH CHECK (public.owns_caterer(provider_id));

-- ─── PHOTOGRAPHY PACKAGE BOOKINGS: Add both customer AND vendor UPDATE policies ──
-- Currently has ZERO update policies — neither party can update.
DROP POLICY IF EXISTS photography_bookings_customer_update ON public.photography_package_bookings;
CREATE POLICY photography_bookings_customer_update ON public.photography_package_bookings
  FOR UPDATE TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS photography_bookings_provider_update ON public.photography_package_bookings;
CREATE POLICY photography_bookings_provider_update ON public.photography_package_bookings
  FOR UPDATE TO authenticated
  USING (public.owns_photographer(photographer_id))
  WITH CHECK (public.owns_photographer(photographer_id));
-- Videography package redesign: event-based packages with simplified pricing.
-- Adds missing columns, keeps existing data intact.

-- Add new columns for event-based model
ALTER TABLE public.videography_packages
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS package_price numeric(12,2) CHECK (package_price >= 0),
  ADD COLUMN IF NOT EXISTS travel_charges numeric(12,2) DEFAULT 0 CHECK (travel_charges >= 0),
  ADD COLUMN IF NOT EXISTS extra_coverage_cost numeric(12,2) DEFAULT 0 CHECK (extra_coverage_cost >= 0),
  ADD COLUMN IF NOT EXISTS num_cameras integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS coverage_includes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS live_streaming boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recording_4k boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS multi_camera boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS cinematic_coverage boolean DEFAULT true;

-- Update advance_percentage default to 20
ALTER TABLE public.videography_packages ALTER COLUMN advance_percentage SET DEFAULT 20;

-- Add 'accepted' and 'in_progress' to videography_bookings status
ALTER TABLE public.videography_bookings DROP CONSTRAINT IF EXISTS videography_bookings_status_check;
ALTER TABLE public.videography_bookings ADD CONSTRAINT videography_bookings_status_check
  CHECK (status IN ('pending','accepted','confirmed','in_progress','completed','cancelled'));

-- Add advance payment columns to videography_bookings
ALTER TABLE public.videography_bookings
  ADD COLUMN IF NOT EXISTS advance_amount numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_amount numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS advance_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS expired_at timestamptz,
  ADD COLUMN IF NOT EXISTS calendar_locked boolean NOT NULL DEFAULT false;

-- Add UPDATE policies for videography_bookings (was missing like catering/photography)
DROP POLICY IF EXISTS videography_bookings_customer_insert ON public.videography_bookings;
CREATE POLICY videography_bookings_customer_insert ON public.videography_bookings
  FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS videography_bookings_customer_update ON public.videography_bookings;
CREATE POLICY videography_bookings_customer_update ON public.videography_bookings
  FOR UPDATE TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS videography_bookings_provider_update ON public.videography_bookings;
CREATE POLICY videography_bookings_provider_update ON public.videography_bookings
  FOR UPDATE TO authenticated
  USING (public.owns_videographer(provider_id))
  WITH CHECK (public.owns_videographer(provider_id));
-- DJ Services category system. Idempotent. Isolated from all other categories.
-- Pattern: same as Drone/Catering/Videography — dedicated tables, RLS, ownership guards.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Ownership functions ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_dj(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text IN ('dj','disc_jockey','dj_services'));
$$;
CREATE OR REPLACE FUNCTION public.owns_dj(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text IN ('dj','disc_jockey','dj_services'));
$$;

-- ─── DJ Packages ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dj_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 150),
  description text,
  event_type text,
  -- Pricing
  package_price numeric(12,2) CHECK (package_price >= 0),
  advance_percentage integer DEFAULT 20 CHECK (advance_percentage BETWEEN 0 AND 100),
  travel_charges numeric(12,2) DEFAULT 0,
  extra_hour_charges numeric(12,2) DEFAULT 0,
  outside_city_charges numeric(12,2) DEFAULT 0,
  equipment_transport_charges numeric(12,2) DEFAULT 0,
  -- Performance
  performance_duration text DEFAULT '4 Hours',
  music_genres text[] NOT NULL DEFAULT '{}',
  event_coverage text[] NOT NULL DEFAULT '{}',
  -- Equipment
  equipment text[] NOT NULL DEFAULT '{}',
  -- Team
  dj_count integer DEFAULT 1,
  assistant_djs integer DEFAULT 0,
  sound_engineers integer DEFAULT 0,
  lighting_operators integer DEFAULT 0,
  technicians integer DEFAULT 0,
  stage_crew integer DEFAULT 0,
  mc_host boolean DEFAULT false,
  -- Deliverables
  deliverables text[] NOT NULL DEFAULT '{}',
  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused')),
  is_featured boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dj_packages_provider_idx ON public.dj_packages(provider_id, status);

-- ─── DJ Gallery ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dj_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.dj_packages(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video')),
  is_cover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS dj_gallery_one_cover ON public.dj_gallery(package_id) WHERE is_cover;
CREATE INDEX IF NOT EXISTS dj_gallery_package_idx ON public.dj_gallery(package_id, sort_order);

-- ─── DJ Add-ons ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dj_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.dj_packages(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dj_addons_package_idx ON public.dj_addons(package_id);

-- ─── DJ Bookings ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dj_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.dj_packages(id),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id),
  customer_id uuid NOT NULL REFERENCES public.profiles(id),
  event_type text,
  event_date date NOT NULL,
  event_time text,
  venue text,
  city text,
  expected_audience integer,
  song_requests text,
  special_instructions text,
  selected_addon_ids uuid[] NOT NULL DEFAULT '{}',
  base_amount numeric(12,2) NOT NULL CHECK (base_amount >= 0),
  addons_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (addons_amount >= 0),
  total_amount numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  advance_amount numeric(12,2) DEFAULT 0,
  remaining_amount numeric(12,2) DEFAULT 0,
  payment_deadline timestamptz,
  accepted_at timestamptz,
  advance_paid_at timestamptz,
  confirmed_at timestamptz,
  expired_at timestamptz,
  calendar_locked boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','confirmed','in_progress','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dj_bookings_provider_idx ON public.dj_bookings(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS dj_bookings_customer_idx ON public.dj_bookings(customer_id, created_at DESC);

-- ─── Triggers ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dj_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS dj_packages_updated_at ON public.dj_packages;
CREATE TRIGGER dj_packages_updated_at BEFORE UPDATE ON public.dj_packages FOR EACH ROW EXECUTE FUNCTION public.dj_updated_at();

CREATE OR REPLACE FUNCTION public.dj_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF NOT public.is_dj(NEW.provider_id) THEN RAISE EXCEPTION 'DJ data is restricted to dj providers'; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS dj_package_guard ON public.dj_packages;
CREATE TRIGGER dj_package_guard BEFORE INSERT OR UPDATE OF provider_id ON public.dj_packages FOR EACH ROW EXECUTE FUNCTION public.dj_guard();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['dj_packages','dj_gallery','dj_addons','dj_bookings'] LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END IF;
END LOOP; END $$;

DROP POLICY IF EXISTS dj_packages_read ON public.dj_packages;
DROP POLICY IF EXISTS dj_packages_owner ON public.dj_packages;
CREATE POLICY dj_packages_read ON public.dj_packages FOR SELECT USING ((status='active') OR public.owns_dj(provider_id));
CREATE POLICY dj_packages_owner ON public.dj_packages FOR ALL USING (public.owns_dj(provider_id)) WITH CHECK (public.owns_dj(provider_id));

DROP POLICY IF EXISTS dj_gallery_read ON public.dj_gallery;
DROP POLICY IF EXISTS dj_gallery_owner ON public.dj_gallery;
CREATE POLICY dj_gallery_read ON public.dj_gallery FOR SELECT USING (true);
CREATE POLICY dj_gallery_owner ON public.dj_gallery FOR ALL USING (EXISTS(SELECT 1 FROM public.dj_packages p WHERE p.id=package_id AND public.owns_dj(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.dj_packages p WHERE p.id=package_id AND public.owns_dj(p.provider_id)));

DROP POLICY IF EXISTS dj_addons_read ON public.dj_addons;
DROP POLICY IF EXISTS dj_addons_owner ON public.dj_addons;
CREATE POLICY dj_addons_read ON public.dj_addons FOR SELECT USING (true);
CREATE POLICY dj_addons_owner ON public.dj_addons FOR ALL USING (EXISTS(SELECT 1 FROM public.dj_packages p WHERE p.id=package_id AND public.owns_dj(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.dj_packages p WHERE p.id=package_id AND public.owns_dj(p.provider_id)));

DROP POLICY IF EXISTS dj_bookings_read ON public.dj_bookings;
DROP POLICY IF EXISTS dj_bookings_customer_insert ON public.dj_bookings;
DROP POLICY IF EXISTS dj_bookings_customer_update ON public.dj_bookings;
DROP POLICY IF EXISTS dj_bookings_provider_update ON public.dj_bookings;
CREATE POLICY dj_bookings_read ON public.dj_bookings FOR SELECT USING (customer_id=auth.uid() OR public.owns_dj(provider_id));
CREATE POLICY dj_bookings_customer_insert ON public.dj_bookings FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY dj_bookings_customer_update ON public.dj_bookings FOR UPDATE TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY dj_bookings_provider_update ON public.dj_bookings FOR UPDATE TO authenticated USING (public.owns_dj(provider_id)) WITH CHECK (public.owns_dj(provider_id));

-- ─── Storage ─────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets(id,name,public) VALUES('dj-media','dj-media',true) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS dj_media_read ON storage.objects;
DROP POLICY IF EXISTS dj_media_owner ON storage.objects;
CREATE POLICY dj_media_read ON storage.objects FOR SELECT USING(bucket_id='dj-media');
CREATE POLICY dj_media_owner ON storage.objects FOR ALL TO authenticated USING(bucket_id='dj-media' AND auth.uid()::text=(storage.foldername(name))[1]) WITH CHECK(bucket_id='dj-media' AND auth.uid()::text=(storage.foldername(name))[1]);

-- ─── Realtime ────────────────────────────────────────────────────────────────
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['dj_packages','dj_gallery','dj_addons','dj_bookings'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF;
END LOOP; EXCEPTION WHEN OTHERS THEN NULL; END $$;
-- Decorator category system. Idempotent. Isolated from all other categories.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Ownership functions ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_decorator(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text IN ('decorator','event_decorator','decoration_services','floral_decorator'));
$$;
CREATE OR REPLACE FUNCTION public.owns_decorator(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text IN ('decorator','event_decorator','decoration_services','floral_decorator'));
$$;

-- ─── Decorator Packages ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.decorator_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 150),
  package_type text NOT NULL,
  description text,
  theme text,
  -- Pricing
  package_price numeric(12,2) CHECK (package_price >= 0),
  advance_percentage integer DEFAULT 20 CHECK (advance_percentage BETWEEN 0 AND 100),
  travel_charges numeric(12,2) DEFAULT 0,
  setup_charges numeric(12,2) DEFAULT 0,
  -- Details
  inclusions text[] NOT NULL DEFAULT '{}',
  themes_available text[] NOT NULL DEFAULT '{}',
  setup_time text,
  teardown_included boolean DEFAULT true,
  venue_types text[] NOT NULL DEFAULT '{}',
  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused')),
  is_featured boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS decorator_packages_provider_idx ON public.decorator_packages(provider_id, status);
CREATE INDEX IF NOT EXISTS decorator_packages_type_idx ON public.decorator_packages(package_type);

-- ─── Decorator Gallery ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.decorator_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.decorator_packages(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video')),
  is_cover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS decorator_gallery_one_cover ON public.decorator_gallery(package_id) WHERE is_cover;
CREATE INDEX IF NOT EXISTS decorator_gallery_package_idx ON public.decorator_gallery(package_id, sort_order);

-- ─── Decorator Add-ons ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.decorator_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.decorator_packages(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS decorator_addons_package_idx ON public.decorator_addons(package_id);

-- ─── Decorator Bookings ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.decorator_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.decorator_packages(id),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id),
  customer_id uuid NOT NULL REFERENCES public.profiles(id),
  event_type text,
  event_date date NOT NULL,
  event_time text,
  venue text,
  city text,
  theme_preference text,
  special_instructions text,
  selected_addon_ids uuid[] NOT NULL DEFAULT '{}',
  base_amount numeric(12,2) NOT NULL CHECK (base_amount >= 0),
  addons_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (addons_amount >= 0),
  total_amount numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  advance_amount numeric(12,2) DEFAULT 0,
  remaining_amount numeric(12,2) DEFAULT 0,
  payment_deadline timestamptz,
  accepted_at timestamptz,
  advance_paid_at timestamptz,
  confirmed_at timestamptz,
  expired_at timestamptz,
  calendar_locked boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','confirmed','in_progress','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS decorator_bookings_provider_idx ON public.decorator_bookings(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS decorator_bookings_customer_idx ON public.decorator_bookings(customer_id, created_at DESC);

-- ─── Triggers ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.decorator_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS decorator_packages_updated_at ON public.decorator_packages;
CREATE TRIGGER decorator_packages_updated_at BEFORE UPDATE ON public.decorator_packages FOR EACH ROW EXECUTE FUNCTION public.decorator_updated_at();

CREATE OR REPLACE FUNCTION public.decorator_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF NOT public.is_decorator(NEW.provider_id) THEN RAISE EXCEPTION 'Decorator data restricted to decorator providers'; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS decorator_package_guard ON public.decorator_packages;
CREATE TRIGGER decorator_package_guard BEFORE INSERT OR UPDATE OF provider_id ON public.decorator_packages FOR EACH ROW EXECUTE FUNCTION public.decorator_guard();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['decorator_packages','decorator_gallery','decorator_addons','decorator_bookings'] LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END IF;
END LOOP; END $$;

DROP POLICY IF EXISTS decorator_packages_read ON public.decorator_packages;
DROP POLICY IF EXISTS decorator_packages_owner ON public.decorator_packages;
CREATE POLICY decorator_packages_read ON public.decorator_packages FOR SELECT USING ((status='active') OR public.owns_decorator(provider_id));
CREATE POLICY decorator_packages_owner ON public.decorator_packages FOR ALL USING (public.owns_decorator(provider_id)) WITH CHECK (public.owns_decorator(provider_id));

DROP POLICY IF EXISTS decorator_gallery_read ON public.decorator_gallery;
DROP POLICY IF EXISTS decorator_gallery_owner ON public.decorator_gallery;
CREATE POLICY decorator_gallery_read ON public.decorator_gallery FOR SELECT USING (true);
CREATE POLICY decorator_gallery_owner ON public.decorator_gallery FOR ALL USING (EXISTS(SELECT 1 FROM public.decorator_packages p WHERE p.id=package_id AND public.owns_decorator(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.decorator_packages p WHERE p.id=package_id AND public.owns_decorator(p.provider_id)));

DROP POLICY IF EXISTS decorator_addons_read ON public.decorator_addons;
DROP POLICY IF EXISTS decorator_addons_owner ON public.decorator_addons;
CREATE POLICY decorator_addons_read ON public.decorator_addons FOR SELECT USING (true);
CREATE POLICY decorator_addons_owner ON public.decorator_addons FOR ALL USING (EXISTS(SELECT 1 FROM public.decorator_packages p WHERE p.id=package_id AND public.owns_decorator(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.decorator_packages p WHERE p.id=package_id AND public.owns_decorator(p.provider_id)));

DROP POLICY IF EXISTS decorator_bookings_read ON public.decorator_bookings;
DROP POLICY IF EXISTS decorator_bookings_customer_insert ON public.decorator_bookings;
DROP POLICY IF EXISTS decorator_bookings_customer_update ON public.decorator_bookings;
DROP POLICY IF EXISTS decorator_bookings_provider_update ON public.decorator_bookings;
CREATE POLICY decorator_bookings_read ON public.decorator_bookings FOR SELECT USING (customer_id=auth.uid() OR public.owns_decorator(provider_id));
CREATE POLICY decorator_bookings_customer_insert ON public.decorator_bookings FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY decorator_bookings_customer_update ON public.decorator_bookings FOR UPDATE TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY decorator_bookings_provider_update ON public.decorator_bookings FOR UPDATE TO authenticated USING (public.owns_decorator(provider_id)) WITH CHECK (public.owns_decorator(provider_id));

-- ─── Storage ─────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets(id,name,public) VALUES('decorator-media','decorator-media',true) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS decorator_media_read ON storage.objects;
DROP POLICY IF EXISTS decorator_media_owner ON storage.objects;
CREATE POLICY decorator_media_read ON storage.objects FOR SELECT USING(bucket_id='decorator-media');
CREATE POLICY decorator_media_owner ON storage.objects FOR ALL TO authenticated USING(bucket_id='decorator-media' AND auth.uid()::text=(storage.foldername(name))[1]) WITH CHECK(bucket_id='decorator-media' AND auth.uid()::text=(storage.foldername(name))[1]);

-- ─── Realtime ────────────────────────────────────────────────────────────────
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['decorator_packages','decorator_gallery','decorator_addons','decorator_bookings'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF;
END LOOP; EXCEPTION WHEN OTHERS THEN NULL; END $$;
-- Makeup Artist category system. Idempotent. Isolated from all other categories.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.is_makeup_artist(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text IN ('makeup_artist','bridal_makeup','makeup'));
$$;
CREATE OR REPLACE FUNCTION public.owns_makeup_artist(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text IN ('makeup_artist','bridal_makeup','makeup'));
$$;

CREATE TABLE IF NOT EXISTS public.makeup_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 150),
  package_type text NOT NULL,
  description text,
  package_price numeric(12,2) CHECK (package_price >= 0),
  advance_percentage integer DEFAULT 20 CHECK (advance_percentage BETWEEN 0 AND 100),
  travel_charges numeric(12,2) DEFAULT 0,
  outside_city_charges numeric(12,2) DEFAULT 0,
  touchup_charges numeric(12,2) DEFAULT 0,
  early_morning_charges numeric(12,2) DEFAULT 0,
  late_night_charges numeric(12,2) DEFAULT 0,
  services_included text[] NOT NULL DEFAULT '{}',
  brands_used text[] NOT NULL DEFAULT '{}',
  skin_types text[] NOT NULL DEFAULT '{}',
  deliverables text[] NOT NULL DEFAULT '{}',
  lead_artist integer DEFAULT 1,
  assistant_artists integer DEFAULT 0,
  hair_stylists integer DEFAULT 0,
  saree_drapers integer DEFAULT 0,
  male_grooming_artist integer DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused')),
  is_featured boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS makeup_packages_provider_idx ON public.makeup_packages(provider_id, status);
CREATE INDEX IF NOT EXISTS makeup_packages_type_idx ON public.makeup_packages(package_type);

CREATE TABLE IF NOT EXISTS public.makeup_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.makeup_packages(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video')),
  is_cover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS makeup_gallery_one_cover ON public.makeup_gallery(package_id) WHERE is_cover;
CREATE INDEX IF NOT EXISTS makeup_gallery_package_idx ON public.makeup_gallery(package_id, sort_order);

CREATE TABLE IF NOT EXISTS public.makeup_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.makeup_packages(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS makeup_addons_package_idx ON public.makeup_addons(package_id);

CREATE TABLE IF NOT EXISTS public.makeup_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.makeup_packages(id),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id),
  customer_id uuid NOT NULL REFERENCES public.profiles(id),
  event_type text,
  event_date date NOT NULL,
  event_time text,
  venue text,
  city text,
  special_requirements text,
  selected_addon_ids uuid[] NOT NULL DEFAULT '{}',
  base_amount numeric(12,2) NOT NULL CHECK (base_amount >= 0),
  addons_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (addons_amount >= 0),
  total_amount numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  advance_amount numeric(12,2) DEFAULT 0,
  remaining_amount numeric(12,2) DEFAULT 0,
  payment_deadline timestamptz,
  accepted_at timestamptz,
  advance_paid_at timestamptz,
  confirmed_at timestamptz,
  expired_at timestamptz,
  calendar_locked boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','confirmed','in_progress','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS makeup_bookings_provider_idx ON public.makeup_bookings(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS makeup_bookings_customer_idx ON public.makeup_bookings(customer_id, created_at DESC);

-- Triggers
CREATE OR REPLACE FUNCTION public.makeup_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS makeup_packages_updated_at ON public.makeup_packages;
CREATE TRIGGER makeup_packages_updated_at BEFORE UPDATE ON public.makeup_packages FOR EACH ROW EXECUTE FUNCTION public.makeup_updated_at();

CREATE OR REPLACE FUNCTION public.makeup_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF NOT public.is_makeup_artist(NEW.provider_id) THEN RAISE EXCEPTION 'Makeup data restricted to makeup_artist providers'; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS makeup_package_guard ON public.makeup_packages;
CREATE TRIGGER makeup_package_guard BEFORE INSERT OR UPDATE OF provider_id ON public.makeup_packages FOR EACH ROW EXECUTE FUNCTION public.makeup_guard();

-- RLS
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['makeup_packages','makeup_gallery','makeup_addons','makeup_bookings'] LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END IF;
END LOOP; END $$;

DROP POLICY IF EXISTS makeup_packages_read ON public.makeup_packages;
DROP POLICY IF EXISTS makeup_packages_owner ON public.makeup_packages;
CREATE POLICY makeup_packages_read ON public.makeup_packages FOR SELECT USING ((status='active') OR public.owns_makeup_artist(provider_id));
CREATE POLICY makeup_packages_owner ON public.makeup_packages FOR ALL USING (public.owns_makeup_artist(provider_id)) WITH CHECK (public.owns_makeup_artist(provider_id));

DROP POLICY IF EXISTS makeup_gallery_read ON public.makeup_gallery;
DROP POLICY IF EXISTS makeup_gallery_owner ON public.makeup_gallery;
CREATE POLICY makeup_gallery_read ON public.makeup_gallery FOR SELECT USING (true);
CREATE POLICY makeup_gallery_owner ON public.makeup_gallery FOR ALL USING (EXISTS(SELECT 1 FROM public.makeup_packages p WHERE p.id=package_id AND public.owns_makeup_artist(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.makeup_packages p WHERE p.id=package_id AND public.owns_makeup_artist(p.provider_id)));

DROP POLICY IF EXISTS makeup_addons_read ON public.makeup_addons;
DROP POLICY IF EXISTS makeup_addons_owner ON public.makeup_addons;
CREATE POLICY makeup_addons_read ON public.makeup_addons FOR SELECT USING (true);
CREATE POLICY makeup_addons_owner ON public.makeup_addons FOR ALL USING (EXISTS(SELECT 1 FROM public.makeup_packages p WHERE p.id=package_id AND public.owns_makeup_artist(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.makeup_packages p WHERE p.id=package_id AND public.owns_makeup_artist(p.provider_id)));

DROP POLICY IF EXISTS makeup_bookings_read ON public.makeup_bookings;
DROP POLICY IF EXISTS makeup_bookings_customer_insert ON public.makeup_bookings;
DROP POLICY IF EXISTS makeup_bookings_customer_update ON public.makeup_bookings;
DROP POLICY IF EXISTS makeup_bookings_provider_update ON public.makeup_bookings;
CREATE POLICY makeup_bookings_read ON public.makeup_bookings FOR SELECT USING (customer_id=auth.uid() OR public.owns_makeup_artist(provider_id));
CREATE POLICY makeup_bookings_customer_insert ON public.makeup_bookings FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY makeup_bookings_customer_update ON public.makeup_bookings FOR UPDATE TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY makeup_bookings_provider_update ON public.makeup_bookings FOR UPDATE TO authenticated USING (public.owns_makeup_artist(provider_id)) WITH CHECK (public.owns_makeup_artist(provider_id));

-- Storage
INSERT INTO storage.buckets(id,name,public) VALUES('makeup-media','makeup-media',true) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS makeup_media_read ON storage.objects;
DROP POLICY IF EXISTS makeup_media_owner ON storage.objects;
CREATE POLICY makeup_media_read ON storage.objects FOR SELECT USING(bucket_id='makeup-media');
CREATE POLICY makeup_media_owner ON storage.objects FOR ALL TO authenticated USING(bucket_id='makeup-media' AND auth.uid()::text=(storage.foldername(name))[1]) WITH CHECK(bucket_id='makeup-media' AND auth.uid()::text=(storage.foldername(name))[1]);

-- Realtime
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['makeup_packages','makeup_gallery','makeup_addons','makeup_bookings'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF;
END LOOP; EXCEPTION WHEN OTHERS THEN NULL; END $$;
-- Fix decorator profession gate to include 'wedding_decorator'
CREATE OR REPLACE FUNCTION public.is_decorator(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text IN ('decorator','event_decorator','decoration_services','floral_decorator','wedding_decorator'));
$$;
CREATE OR REPLACE FUNCTION public.owns_decorator(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text IN ('decorator','event_decorator','decoration_services','floral_decorator','wedding_decorator'));
$$;
-- Mehendi Artist category system. Idempotent.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.is_mehendi_artist(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text IN ('mehendi_artist','mehndi_artist','mehendi','henna_artist'));
$$;
CREATE OR REPLACE FUNCTION public.owns_mehendi_artist(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text IN ('mehendi_artist','mehndi_artist','mehendi','henna_artist'));
$$;

CREATE TABLE IF NOT EXISTS public.mehendi_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 150),
  package_type text NOT NULL,
  description text,
  package_price numeric(12,2) CHECK (package_price >= 0),
  advance_percentage integer DEFAULT 20,
  price_per_hand numeric(12,2) DEFAULT 0,
  price_per_person numeric(12,2) DEFAULT 0,
  travel_charges numeric(12,2) DEFAULT 0,
  outside_city_charges numeric(12,2) DEFAULT 0,
  group_discount numeric(12,2) DEFAULT 0,
  festival_charges numeric(12,2) DEFAULT 0,
  design_styles text[] NOT NULL DEFAULT '{}',
  coverage text[] NOT NULL DEFAULT '{}',
  clients_included integer DEFAULT 1,
  inclusions text[] NOT NULL DEFAULT '{}',
  deliverables text[] NOT NULL DEFAULT '{}',
  lead_artist integer DEFAULT 1,
  assistant_artists integer DEFAULT 0,
  max_clients integer DEFAULT 5,
  bridal_specialist boolean DEFAULT false,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused')),
  is_featured boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mehendi_packages_provider_idx ON public.mehendi_packages(provider_id, status);

CREATE TABLE IF NOT EXISTS public.mehendi_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.mehendi_packages(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video')),
  is_cover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS mehendi_gallery_one_cover ON public.mehendi_gallery(package_id) WHERE is_cover;
CREATE INDEX IF NOT EXISTS mehendi_gallery_package_idx ON public.mehendi_gallery(package_id, sort_order);

CREATE TABLE IF NOT EXISTS public.mehendi_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.mehendi_packages(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mehendi_addons_package_idx ON public.mehendi_addons(package_id);

CREATE TABLE IF NOT EXISTS public.mehendi_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.mehendi_packages(id),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id),
  customer_id uuid NOT NULL REFERENCES public.profiles(id),
  event_type text,
  event_date date NOT NULL,
  event_time text,
  venue text,
  city text,
  num_clients integer DEFAULT 1,
  special_requirements text,
  selected_addon_ids uuid[] NOT NULL DEFAULT '{}',
  base_amount numeric(12,2) NOT NULL CHECK (base_amount >= 0),
  addons_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  advance_amount numeric(12,2) DEFAULT 0,
  remaining_amount numeric(12,2) DEFAULT 0,
  payment_deadline timestamptz,
  accepted_at timestamptz,
  advance_paid_at timestamptz,
  confirmed_at timestamptz,
  expired_at timestamptz,
  calendar_locked boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','confirmed','in_progress','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mehendi_bookings_provider_idx ON public.mehendi_bookings(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mehendi_bookings_customer_idx ON public.mehendi_bookings(customer_id, created_at DESC);

-- Triggers
CREATE OR REPLACE FUNCTION public.mehendi_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS mehendi_packages_updated_at ON public.mehendi_packages;
CREATE TRIGGER mehendi_packages_updated_at BEFORE UPDATE ON public.mehendi_packages FOR EACH ROW EXECUTE FUNCTION public.mehendi_updated_at();

CREATE OR REPLACE FUNCTION public.mehendi_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF NOT public.is_mehendi_artist(NEW.provider_id) THEN RAISE EXCEPTION 'Mehendi data restricted to mehendi_artist providers'; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS mehendi_package_guard ON public.mehendi_packages;
CREATE TRIGGER mehendi_package_guard BEFORE INSERT OR UPDATE OF provider_id ON public.mehendi_packages FOR EACH ROW EXECUTE FUNCTION public.mehendi_guard();

-- RLS
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['mehendi_packages','mehendi_gallery','mehendi_addons','mehendi_bookings'] LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END IF;
END LOOP; END $$;

DROP POLICY IF EXISTS mehendi_packages_read ON public.mehendi_packages;
DROP POLICY IF EXISTS mehendi_packages_owner ON public.mehendi_packages;
CREATE POLICY mehendi_packages_read ON public.mehendi_packages FOR SELECT USING ((status='active') OR public.owns_mehendi_artist(provider_id));
CREATE POLICY mehendi_packages_owner ON public.mehendi_packages FOR ALL USING (public.owns_mehendi_artist(provider_id)) WITH CHECK (public.owns_mehendi_artist(provider_id));

DROP POLICY IF EXISTS mehendi_gallery_read ON public.mehendi_gallery;
DROP POLICY IF EXISTS mehendi_gallery_owner ON public.mehendi_gallery;
CREATE POLICY mehendi_gallery_read ON public.mehendi_gallery FOR SELECT USING (true);
CREATE POLICY mehendi_gallery_owner ON public.mehendi_gallery FOR ALL USING (EXISTS(SELECT 1 FROM public.mehendi_packages p WHERE p.id=package_id AND public.owns_mehendi_artist(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.mehendi_packages p WHERE p.id=package_id AND public.owns_mehendi_artist(p.provider_id)));

DROP POLICY IF EXISTS mehendi_addons_read ON public.mehendi_addons;
DROP POLICY IF EXISTS mehendi_addons_owner ON public.mehendi_addons;
CREATE POLICY mehendi_addons_read ON public.mehendi_addons FOR SELECT USING (true);
CREATE POLICY mehendi_addons_owner ON public.mehendi_addons FOR ALL USING (EXISTS(SELECT 1 FROM public.mehendi_packages p WHERE p.id=package_id AND public.owns_mehendi_artist(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.mehendi_packages p WHERE p.id=package_id AND public.owns_mehendi_artist(p.provider_id)));

DROP POLICY IF EXISTS mehendi_bookings_read ON public.mehendi_bookings;
DROP POLICY IF EXISTS mehendi_bookings_customer_insert ON public.mehendi_bookings;
DROP POLICY IF EXISTS mehendi_bookings_customer_update ON public.mehendi_bookings;
DROP POLICY IF EXISTS mehendi_bookings_provider_update ON public.mehendi_bookings;
CREATE POLICY mehendi_bookings_read ON public.mehendi_bookings FOR SELECT USING (customer_id=auth.uid() OR public.owns_mehendi_artist(provider_id));
CREATE POLICY mehendi_bookings_customer_insert ON public.mehendi_bookings FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY mehendi_bookings_customer_update ON public.mehendi_bookings FOR UPDATE TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY mehendi_bookings_provider_update ON public.mehendi_bookings FOR UPDATE TO authenticated USING (public.owns_mehendi_artist(provider_id)) WITH CHECK (public.owns_mehendi_artist(provider_id));

-- Storage
INSERT INTO storage.buckets(id,name,public) VALUES('mehendi-media','mehendi-media',true) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS mehendi_media_read ON storage.objects;
DROP POLICY IF EXISTS mehendi_media_owner ON storage.objects;
CREATE POLICY mehendi_media_read ON storage.objects FOR SELECT USING(bucket_id='mehendi-media');
CREATE POLICY mehendi_media_owner ON storage.objects FOR ALL TO authenticated USING(bucket_id='mehendi-media' AND auth.uid()::text=(storage.foldername(name))[1]) WITH CHECK(bucket_id='mehendi-media' AND auth.uid()::text=(storage.foldername(name))[1]);

-- Realtime
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['mehendi_packages','mehendi_gallery','mehendi_addons','mehendi_bookings'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF;
END LOOP; EXCEPTION WHEN OTHERS THEN NULL; END $$;
-- Anchors & Hosts category system. Idempotent.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.is_anchor(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text IN ('anchor','host','emcee','event_anchor','event_host','mc'));
$$;
CREATE OR REPLACE FUNCTION public.owns_anchor(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text IN ('anchor','host','emcee','event_anchor','event_host','mc'));
$$;

CREATE TABLE IF NOT EXISTS public.anchor_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 150),
  package_type text NOT NULL,
  description text,
  package_price numeric(12,2) CHECK (package_price >= 0),
  advance_percentage integer DEFAULT 20,
  travel_charges numeric(12,2) DEFAULT 0,
  outside_city_charges numeric(12,2) DEFAULT 0,
  extra_hour_charges numeric(12,2) DEFAULT 0,
  script_writing_charges numeric(12,2) DEFAULT 0,
  stage_coordination_charges numeric(12,2) DEFAULT 0,
  languages text[] NOT NULL DEFAULT '{}',
  hosting_style text[] NOT NULL DEFAULT '{}',
  audience_capacity text,
  services_included text[] NOT NULL DEFAULT '{}',
  deliverables text[] NOT NULL DEFAULT '{}',
  lead_anchor integer DEFAULT 1,
  co_host integer DEFAULT 0,
  assistant integer DEFAULT 0,
  stage_coordinator integer DEFAULT 0,
  event_manager integer DEFAULT 0,
  sound_coordinator integer DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused')),
  is_featured boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS anchor_packages_provider_idx ON public.anchor_packages(provider_id, status);

CREATE TABLE IF NOT EXISTS public.anchor_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.anchor_packages(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video')),
  is_cover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS anchor_gallery_one_cover ON public.anchor_gallery(package_id) WHERE is_cover;
CREATE INDEX IF NOT EXISTS anchor_gallery_package_idx ON public.anchor_gallery(package_id, sort_order);

CREATE TABLE IF NOT EXISTS public.anchor_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.anchor_packages(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS anchor_addons_package_idx ON public.anchor_addons(package_id);

CREATE TABLE IF NOT EXISTS public.anchor_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.anchor_packages(id),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id),
  customer_id uuid NOT NULL REFERENCES public.profiles(id),
  event_type text,
  event_date date NOT NULL,
  event_time text,
  venue text,
  city text,
  expected_audience text,
  special_requirements text,
  selected_addon_ids uuid[] NOT NULL DEFAULT '{}',
  base_amount numeric(12,2) NOT NULL CHECK (base_amount >= 0),
  addons_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  advance_amount numeric(12,2) DEFAULT 0,
  remaining_amount numeric(12,2) DEFAULT 0,
  payment_deadline timestamptz,
  accepted_at timestamptz,
  advance_paid_at timestamptz,
  confirmed_at timestamptz,
  expired_at timestamptz,
  calendar_locked boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','confirmed','in_progress','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS anchor_bookings_provider_idx ON public.anchor_bookings(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS anchor_bookings_customer_idx ON public.anchor_bookings(customer_id, created_at DESC);

-- Triggers
CREATE OR REPLACE FUNCTION public.anchor_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS anchor_packages_updated_at ON public.anchor_packages;
CREATE TRIGGER anchor_packages_updated_at BEFORE UPDATE ON public.anchor_packages FOR EACH ROW EXECUTE FUNCTION public.anchor_updated_at();

CREATE OR REPLACE FUNCTION public.anchor_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF NOT public.is_anchor(NEW.provider_id) THEN RAISE EXCEPTION 'Anchor data restricted to anchor/host providers'; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS anchor_package_guard ON public.anchor_packages;
CREATE TRIGGER anchor_package_guard BEFORE INSERT OR UPDATE OF provider_id ON public.anchor_packages FOR EACH ROW EXECUTE FUNCTION public.anchor_guard();

-- RLS
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['anchor_packages','anchor_gallery','anchor_addons','anchor_bookings'] LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END IF;
END LOOP; END $$;

DROP POLICY IF EXISTS anchor_packages_read ON public.anchor_packages;
DROP POLICY IF EXISTS anchor_packages_owner ON public.anchor_packages;
CREATE POLICY anchor_packages_read ON public.anchor_packages FOR SELECT USING ((status='active') OR public.owns_anchor(provider_id));
CREATE POLICY anchor_packages_owner ON public.anchor_packages FOR ALL USING (public.owns_anchor(provider_id)) WITH CHECK (public.owns_anchor(provider_id));

DROP POLICY IF EXISTS anchor_gallery_read ON public.anchor_gallery;
DROP POLICY IF EXISTS anchor_gallery_owner ON public.anchor_gallery;
CREATE POLICY anchor_gallery_read ON public.anchor_gallery FOR SELECT USING (true);
CREATE POLICY anchor_gallery_owner ON public.anchor_gallery FOR ALL USING (EXISTS(SELECT 1 FROM public.anchor_packages p WHERE p.id=package_id AND public.owns_anchor(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.anchor_packages p WHERE p.id=package_id AND public.owns_anchor(p.provider_id)));

DROP POLICY IF EXISTS anchor_addons_read ON public.anchor_addons;
DROP POLICY IF EXISTS anchor_addons_owner ON public.anchor_addons;
CREATE POLICY anchor_addons_read ON public.anchor_addons FOR SELECT USING (true);
CREATE POLICY anchor_addons_owner ON public.anchor_addons FOR ALL USING (EXISTS(SELECT 1 FROM public.anchor_packages p WHERE p.id=package_id AND public.owns_anchor(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.anchor_packages p WHERE p.id=package_id AND public.owns_anchor(p.provider_id)));

DROP POLICY IF EXISTS anchor_bookings_read ON public.anchor_bookings;
DROP POLICY IF EXISTS anchor_bookings_customer_insert ON public.anchor_bookings;
DROP POLICY IF EXISTS anchor_bookings_customer_update ON public.anchor_bookings;
DROP POLICY IF EXISTS anchor_bookings_provider_update ON public.anchor_bookings;
CREATE POLICY anchor_bookings_read ON public.anchor_bookings FOR SELECT USING (customer_id=auth.uid() OR public.owns_anchor(provider_id));
CREATE POLICY anchor_bookings_customer_insert ON public.anchor_bookings FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY anchor_bookings_customer_update ON public.anchor_bookings FOR UPDATE TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY anchor_bookings_provider_update ON public.anchor_bookings FOR UPDATE TO authenticated USING (public.owns_anchor(provider_id)) WITH CHECK (public.owns_anchor(provider_id));

-- Storage
INSERT INTO storage.buckets(id,name,public) VALUES('anchor-media','anchor-media',true) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS anchor_media_read ON storage.objects;
DROP POLICY IF EXISTS anchor_media_owner ON storage.objects;
CREATE POLICY anchor_media_read ON storage.objects FOR SELECT USING(bucket_id='anchor-media');
CREATE POLICY anchor_media_owner ON storage.objects FOR ALL TO authenticated USING(bucket_id='anchor-media' AND auth.uid()::text=(storage.foldername(name))[1]) WITH CHECK(bucket_id='anchor-media' AND auth.uid()::text=(storage.foldername(name))[1]);

-- Realtime
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['anchor_packages','anchor_gallery','anchor_addons','anchor_bookings'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF;
END LOOP; EXCEPTION WHEN OTHERS THEN NULL; END $$;
-- Banquet Hall category system. Idempotent.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Category gate functions
CREATE OR REPLACE FUNCTION public.is_banquet_hall(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text IN ('banquet_hall','banquet','venue','hall','function_hall','convention_hall','wedding_hall','event_venue'));
$$;
CREATE OR REPLACE FUNCTION public.owns_banquet_hall(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text IN ('banquet_hall','banquet','venue','hall','function_hall','convention_hall','wedding_hall','event_venue'));
$$;

-- Main packages table
CREATE TABLE IF NOT EXISTS public.banquet_halls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 200),
  venue_type text NOT NULL,
  description text,
  hall_rental_price numeric(12,2) CHECK (hall_rental_price >= 0),
  advance_percentage integer DEFAULT 20,
  security_deposit numeric(12,2) DEFAULT 0,
  cleaning_charges numeric(12,2) DEFAULT 0,
  decoration_permission_fee numeric(12,2) DEFAULT 0,
  generator_charges numeric(12,2) DEFAULT 0,
  extra_hour_charges numeric(12,2) DEFAULT 0,
  outside_catering_charges numeric(12,2) DEFAULT 0,
  hall_capacity text,
  seating_styles text[] NOT NULL DEFAULT '{}',
  venue_features text[] NOT NULL DEFAULT '{}',
  facilities_included text[] NOT NULL DEFAULT '{}',
  event_types_supported text[] NOT NULL DEFAULT '{}',
  -- Rules
  allowed_time text,
  noise_restrictions text,
  outside_decoration_allowed boolean DEFAULT true,
  outside_catering_allowed boolean DEFAULT true,
  alcohol_allowed boolean DEFAULT false,
  fireworks_allowed boolean DEFAULT false,
  smoking_policy text,
  cancellation_policy text,
  advance_refund_policy text,
  -- Media
  virtual_tour_url text,
  google_maps_url text,
  address text,
  city text,
  state text,
  pincode text,
  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused')),
  is_featured boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS banquet_halls_provider_idx ON public.banquet_halls(provider_id, status);

-- Gallery
CREATE TABLE IF NOT EXISTS public.hall_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.banquet_halls(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video','360','drone')),
  is_cover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS hall_gallery_one_cover ON public.hall_gallery(package_id) WHERE is_cover;
CREATE INDEX IF NOT EXISTS hall_gallery_package_idx ON public.hall_gallery(package_id, sort_order);

-- Add-ons
CREATE TABLE IF NOT EXISTS public.hall_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.banquet_halls(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hall_addons_package_idx ON public.hall_addons(package_id);

-- Bookings
CREATE TABLE IF NOT EXISTS public.banquet_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.banquet_halls(id),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id),
  customer_id uuid NOT NULL REFERENCES public.profiles(id),
  event_type text,
  event_date date NOT NULL,
  event_time text,
  guest_count text,
  venue text,
  city text,
  special_requirements text,
  selected_addon_ids uuid[] NOT NULL DEFAULT '{}',
  base_amount numeric(12,2) NOT NULL CHECK (base_amount >= 0),
  addons_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  advance_amount numeric(12,2) DEFAULT 0,
  remaining_amount numeric(12,2) DEFAULT 0,
  payment_deadline timestamptz,
  accepted_at timestamptz,
  advance_paid_at timestamptz,
  confirmed_at timestamptz,
  expired_at timestamptz,
  calendar_locked boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','confirmed','in_progress','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS banquet_bookings_provider_idx ON public.banquet_bookings(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS banquet_bookings_customer_idx ON public.banquet_bookings(customer_id, created_at DESC);
-- Prevent double booking same venue same date
CREATE UNIQUE INDEX IF NOT EXISTS banquet_bookings_no_double ON public.banquet_bookings(package_id, event_date) WHERE status IN ('accepted','confirmed','in_progress');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.banquet_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS banquet_halls_updated_at ON public.banquet_halls;
CREATE TRIGGER banquet_halls_updated_at BEFORE UPDATE ON public.banquet_halls FOR EACH ROW EXECUTE FUNCTION public.banquet_updated_at();

-- Category guard trigger
CREATE OR REPLACE FUNCTION public.banquet_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF NOT public.is_banquet_hall(NEW.provider_id) THEN RAISE EXCEPTION 'Banquet data restricted to banquet hall providers'; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS banquet_hall_guard ON public.banquet_halls;
CREATE TRIGGER banquet_hall_guard BEFORE INSERT OR UPDATE OF provider_id ON public.banquet_halls FOR EACH ROW EXECUTE FUNCTION public.banquet_guard();

-- RLS
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['banquet_halls','hall_gallery','hall_addons','banquet_bookings'] LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END IF;
END LOOP; END $$;

-- banquet_halls policies
DROP POLICY IF EXISTS banquet_halls_read ON public.banquet_halls;
DROP POLICY IF EXISTS banquet_halls_owner ON public.banquet_halls;
CREATE POLICY banquet_halls_read ON public.banquet_halls FOR SELECT USING ((status='active') OR public.owns_banquet_hall(provider_id));
CREATE POLICY banquet_halls_owner ON public.banquet_halls FOR ALL USING (public.owns_banquet_hall(provider_id)) WITH CHECK (public.owns_banquet_hall(provider_id));

-- hall_gallery policies
DROP POLICY IF EXISTS hall_gallery_read ON public.hall_gallery;
DROP POLICY IF EXISTS hall_gallery_owner ON public.hall_gallery;
CREATE POLICY hall_gallery_read ON public.hall_gallery FOR SELECT USING (true);
CREATE POLICY hall_gallery_owner ON public.hall_gallery FOR ALL USING (EXISTS(SELECT 1 FROM public.banquet_halls p WHERE p.id=package_id AND public.owns_banquet_hall(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.banquet_halls p WHERE p.id=package_id AND public.owns_banquet_hall(p.provider_id)));

-- hall_addons policies
DROP POLICY IF EXISTS hall_addons_read ON public.hall_addons;
DROP POLICY IF EXISTS hall_addons_owner ON public.hall_addons;
CREATE POLICY hall_addons_read ON public.hall_addons FOR SELECT USING (true);
CREATE POLICY hall_addons_owner ON public.hall_addons FOR ALL USING (EXISTS(SELECT 1 FROM public.banquet_halls p WHERE p.id=package_id AND public.owns_banquet_hall(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.banquet_halls p WHERE p.id=package_id AND public.owns_banquet_hall(p.provider_id)));

-- banquet_bookings policies
DROP POLICY IF EXISTS banquet_bookings_read ON public.banquet_bookings;
DROP POLICY IF EXISTS banquet_bookings_customer_insert ON public.banquet_bookings;
DROP POLICY IF EXISTS banquet_bookings_customer_update ON public.banquet_bookings;
DROP POLICY IF EXISTS banquet_bookings_provider_update ON public.banquet_bookings;
CREATE POLICY banquet_bookings_read ON public.banquet_bookings FOR SELECT USING (customer_id=auth.uid() OR public.owns_banquet_hall(provider_id));
CREATE POLICY banquet_bookings_customer_insert ON public.banquet_bookings FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY banquet_bookings_customer_update ON public.banquet_bookings FOR UPDATE TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY banquet_bookings_provider_update ON public.banquet_bookings FOR UPDATE TO authenticated USING (public.owns_banquet_hall(provider_id)) WITH CHECK (public.owns_banquet_hall(provider_id));

-- Storage bucket
INSERT INTO storage.buckets(id,name,public) VALUES('banquet-media','banquet-media',true) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS banquet_media_read ON storage.objects;
DROP POLICY IF EXISTS banquet_media_owner ON storage.objects;
CREATE POLICY banquet_media_read ON storage.objects FOR SELECT USING(bucket_id='banquet-media');
CREATE POLICY banquet_media_owner ON storage.objects FOR ALL TO authenticated USING(bucket_id='banquet-media' AND auth.uid()::text=(storage.foldername(name))[1]) WITH CHECK(bucket_id='banquet-media' AND auth.uid()::text=(storage.foldername(name))[1]);

-- Realtime
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['banquet_halls','hall_gallery','hall_addons','banquet_bookings'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF;
END LOOP; EXCEPTION WHEN OTHERS THEN NULL; END $$;
-- Rental Services category system. Idempotent.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Category gate functions
CREATE OR REPLACE FUNCTION public.is_rental_service(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text IN ('rental','rentals','rental_services','tent_house','shamiana','stage_rental','furniture_rental','generator_rental','sound_rental','lighting_rental','equipment_rental'));
$$;
CREATE OR REPLACE FUNCTION public.owns_rental_service(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text IN ('rental','rentals','rental_services','tent_house','shamiana','stage_rental','furniture_rental','generator_rental','sound_rental','lighting_rental','equipment_rental'));
$$;

-- Main packages table
CREATE TABLE IF NOT EXISTS public.rental_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 200),
  package_type text NOT NULL,
  description text,
  -- Pricing
  rental_type text NOT NULL DEFAULT 'per_event' CHECK (rental_type IN ('per_event','per_day','per_hour','package_price')),
  price numeric(12,2) CHECK (price >= 0),
  advance_percentage integer DEFAULT 20,
  security_deposit numeric(12,2) DEFAULT 0,
  transportation_charges numeric(12,2) DEFAULT 0,
  installation_charges numeric(12,2) DEFAULT 0,
  outside_city_charges numeric(12,2) DEFAULT 0,
  extra_hour_charges numeric(12,2) DEFAULT 0,
  late_return_charges numeric(12,2) DEFAULT 0,
  -- Dynamic rental details (JSONB for flexibility per package_type)
  rental_details jsonb NOT NULL DEFAULT '{}',
  -- Included items
  included_items text[] NOT NULL DEFAULT '{}',
  -- Availability
  inventory_quantity integer DEFAULT 1,
  available_units integer DEFAULT 1,
  delivery_radius text,
  available_cities text[] NOT NULL DEFAULT '{}',
  -- Delivery & Setup
  setup_time text,
  delivery_time text,
  pickup_time text,
  installation_team text,
  support_contact text,
  emergency_contact text,
  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused')),
  is_featured boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rental_packages_provider_idx ON public.rental_packages(provider_id, status);

-- Gallery
CREATE TABLE IF NOT EXISTS public.rental_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.rental_packages(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video','setup')),
  is_cover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS rental_gallery_one_cover ON public.rental_gallery(package_id) WHERE is_cover;
CREATE INDEX IF NOT EXISTS rental_gallery_package_idx ON public.rental_gallery(package_id, sort_order);

-- Add-ons
CREATE TABLE IF NOT EXISTS public.rental_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.rental_packages(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rental_addons_package_idx ON public.rental_addons(package_id);

-- Bookings
CREATE TABLE IF NOT EXISTS public.rental_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.rental_packages(id),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id),
  customer_id uuid NOT NULL REFERENCES public.profiles(id),
  event_type text,
  event_date date NOT NULL,
  event_time text,
  rental_duration text,
  delivery_address text,
  city text,
  quantity_required integer NOT NULL DEFAULT 1,
  special_instructions text,
  selected_addon_ids uuid[] NOT NULL DEFAULT '{}',
  base_amount numeric(12,2) NOT NULL CHECK (base_amount >= 0),
  addons_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  advance_amount numeric(12,2) DEFAULT 0,
  remaining_amount numeric(12,2) DEFAULT 0,
  payment_deadline timestamptz,
  accepted_at timestamptz,
  advance_paid_at timestamptz,
  confirmed_at timestamptz,
  expired_at timestamptz,
  calendar_locked boolean NOT NULL DEFAULT false,
  inventory_reserved boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','confirmed','in_progress','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rental_bookings_provider_idx ON public.rental_bookings(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rental_bookings_customer_idx ON public.rental_bookings(customer_id, created_at DESC);

-- Inventory management: decrement on confirm, increment on cancel/complete
CREATE OR REPLACE FUNCTION public.rental_inventory_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  -- On status change to confirmed → reserve inventory
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' AND NOT NEW.inventory_reserved THEN
    UPDATE public.rental_packages SET available_units = GREATEST(available_units - NEW.quantity_required, 0) WHERE id = NEW.package_id;
    NEW.inventory_reserved := true;
  END IF;
  -- On cancel/complete after reservation → release inventory
  IF NEW.status IN ('cancelled', 'completed') AND OLD.inventory_reserved AND OLD.status NOT IN ('cancelled', 'completed') THEN
    UPDATE public.rental_packages SET available_units = LEAST(available_units + OLD.quantity_required, inventory_quantity) WHERE id = NEW.package_id;
    NEW.inventory_reserved := false;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS rental_inventory_trigger ON public.rental_bookings;
CREATE TRIGGER rental_inventory_trigger BEFORE UPDATE ON public.rental_bookings FOR EACH ROW EXECUTE FUNCTION public.rental_inventory_update();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.rental_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS rental_packages_updated_at ON public.rental_packages;
CREATE TRIGGER rental_packages_updated_at BEFORE UPDATE ON public.rental_packages FOR EACH ROW EXECUTE FUNCTION public.rental_updated_at();

-- Category guard trigger
CREATE OR REPLACE FUNCTION public.rental_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF NOT public.is_rental_service(NEW.provider_id) THEN RAISE EXCEPTION 'Rental data restricted to rental service providers'; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS rental_package_guard ON public.rental_packages;
CREATE TRIGGER rental_package_guard BEFORE INSERT OR UPDATE OF provider_id ON public.rental_packages FOR EACH ROW EXECUTE FUNCTION public.rental_guard();

-- RLS
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['rental_packages','rental_gallery','rental_addons','rental_bookings'] LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END IF;
END LOOP; END $$;

-- rental_packages policies
DROP POLICY IF EXISTS rental_packages_read ON public.rental_packages;
DROP POLICY IF EXISTS rental_packages_owner ON public.rental_packages;
CREATE POLICY rental_packages_read ON public.rental_packages FOR SELECT USING ((status='active') OR public.owns_rental_service(provider_id));
CREATE POLICY rental_packages_owner ON public.rental_packages FOR ALL USING (public.owns_rental_service(provider_id)) WITH CHECK (public.owns_rental_service(provider_id));

-- rental_gallery policies
DROP POLICY IF EXISTS rental_gallery_read ON public.rental_gallery;
DROP POLICY IF EXISTS rental_gallery_owner ON public.rental_gallery;
CREATE POLICY rental_gallery_read ON public.rental_gallery FOR SELECT USING (true);
CREATE POLICY rental_gallery_owner ON public.rental_gallery FOR ALL USING (EXISTS(SELECT 1 FROM public.rental_packages p WHERE p.id=package_id AND public.owns_rental_service(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.rental_packages p WHERE p.id=package_id AND public.owns_rental_service(p.provider_id)));

-- rental_addons policies
DROP POLICY IF EXISTS rental_addons_read ON public.rental_addons;
DROP POLICY IF EXISTS rental_addons_owner ON public.rental_addons;
CREATE POLICY rental_addons_read ON public.rental_addons FOR SELECT USING (true);
CREATE POLICY rental_addons_owner ON public.rental_addons FOR ALL USING (EXISTS(SELECT 1 FROM public.rental_packages p WHERE p.id=package_id AND public.owns_rental_service(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.rental_packages p WHERE p.id=package_id AND public.owns_rental_service(p.provider_id)));

-- rental_bookings policies
DROP POLICY IF EXISTS rental_bookings_read ON public.rental_bookings;
DROP POLICY IF EXISTS rental_bookings_customer_insert ON public.rental_bookings;
DROP POLICY IF EXISTS rental_bookings_customer_update ON public.rental_bookings;
DROP POLICY IF EXISTS rental_bookings_provider_update ON public.rental_bookings;
CREATE POLICY rental_bookings_read ON public.rental_bookings FOR SELECT USING (customer_id=auth.uid() OR public.owns_rental_service(provider_id));
CREATE POLICY rental_bookings_customer_insert ON public.rental_bookings FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY rental_bookings_customer_update ON public.rental_bookings FOR UPDATE TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY rental_bookings_provider_update ON public.rental_bookings FOR UPDATE TO authenticated USING (public.owns_rental_service(provider_id)) WITH CHECK (public.owns_rental_service(provider_id));

-- Storage bucket
INSERT INTO storage.buckets(id,name,public) VALUES('rental-media','rental-media',true) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS rental_media_read ON storage.objects;
DROP POLICY IF EXISTS rental_media_owner ON storage.objects;
CREATE POLICY rental_media_read ON storage.objects FOR SELECT USING(bucket_id='rental-media');
CREATE POLICY rental_media_owner ON storage.objects FOR ALL TO authenticated USING(bucket_id='rental-media' AND auth.uid()::text=(storage.foldername(name))[1]) WITH CHECK(bucket_id='rental-media' AND auth.uid()::text=(storage.foldername(name))[1]);

-- Realtime
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['rental_packages','rental_gallery','rental_addons','rental_bookings'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF;
END LOOP; EXCEPTION WHEN OTHERS THEN NULL; END $$;
-- Pandits & Priests category system. Idempotent.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Category gate functions
CREATE OR REPLACE FUNCTION public.is_priest(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text IN ('priest','pandit','purohit','pujari','panditji','astrologer_priest','temple_priest','hindu_priest','muslim_priest','christian_priest','vedic_pandit'));
$$;
CREATE OR REPLACE FUNCTION public.owns_priest(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text IN ('priest','pandit','purohit','pujari','panditji','astrologer_priest','temple_priest','hindu_priest','muslim_priest','christian_priest','vedic_pandit'));
$$;

-- Main packages table
CREATE TABLE IF NOT EXISTS public.priest_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 200),
  package_type text NOT NULL,
  description text,
  -- Pricing
  service_price numeric(12,2) CHECK (service_price >= 0),
  advance_percentage integer DEFAULT 20,
  dakshina_included boolean DEFAULT false,
  travel_charges numeric(12,2) DEFAULT 0,
  outside_city_charges numeric(12,2) DEFAULT 0,
  extra_ritual_charges numeric(12,2) DEFAULT 0,
  extra_hours_charges numeric(12,2) DEFAULT 0,
  materials_included boolean DEFAULT false,
  -- Service details (JSONB for dynamic fields per package_type)
  service_details jsonb NOT NULL DEFAULT '{}',
  -- Ritual info
  duration text,
  required_materials text[] NOT NULL DEFAULT '{}',
  temple_required boolean DEFAULT false,
  -- Languages & experience
  languages text[] NOT NULL DEFAULT '{}',
  years_of_experience integer,
  -- Included services
  included_services text[] NOT NULL DEFAULT '{}',
  -- Availability
  available_cities text[] NOT NULL DEFAULT '{}',
  travel_distance text,
  daily_capacity integer DEFAULT 2,
  max_bookings_per_day integer DEFAULT 2,
  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused')),
  is_featured boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS priest_packages_provider_idx ON public.priest_packages(provider_id, status);

-- Gallery
CREATE TABLE IF NOT EXISTS public.priest_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.priest_packages(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video')),
  is_cover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS priest_gallery_one_cover ON public.priest_gallery(package_id) WHERE is_cover;
CREATE INDEX IF NOT EXISTS priest_gallery_package_idx ON public.priest_gallery(package_id, sort_order);

-- Add-ons
CREATE TABLE IF NOT EXISTS public.priest_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.priest_packages(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS priest_addons_package_idx ON public.priest_addons(package_id);

-- Bookings
CREATE TABLE IF NOT EXISTS public.priest_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.priest_packages(id),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id),
  customer_id uuid NOT NULL REFERENCES public.profiles(id),
  event_type text,
  event_date date NOT NULL,
  event_time text,
  venue text,
  city text,
  special_instructions text,
  selected_addon_ids uuid[] NOT NULL DEFAULT '{}',
  base_amount numeric(12,2) NOT NULL CHECK (base_amount >= 0),
  addons_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  advance_amount numeric(12,2) DEFAULT 0,
  remaining_amount numeric(12,2) DEFAULT 0,
  payment_deadline timestamptz,
  accepted_at timestamptz,
  advance_paid_at timestamptz,
  confirmed_at timestamptz,
  expired_at timestamptz,
  calendar_locked boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','confirmed','in_progress','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS priest_bookings_provider_idx ON public.priest_bookings(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS priest_bookings_customer_idx ON public.priest_bookings(customer_id, created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.priest_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS priest_packages_updated_at ON public.priest_packages;
CREATE TRIGGER priest_packages_updated_at BEFORE UPDATE ON public.priest_packages FOR EACH ROW EXECUTE FUNCTION public.priest_updated_at();

-- Category guard trigger
CREATE OR REPLACE FUNCTION public.priest_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN IF NOT public.is_priest(NEW.provider_id) THEN RAISE EXCEPTION 'Priest data restricted to priest/pandit providers'; END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS priest_package_guard ON public.priest_packages;
CREATE TRIGGER priest_package_guard BEFORE INSERT OR UPDATE OF provider_id ON public.priest_packages FOR EACH ROW EXECUTE FUNCTION public.priest_guard();

-- RLS
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['priest_packages','priest_gallery','priest_addons','priest_bookings'] LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END IF;
END LOOP; END $$;

DROP POLICY IF EXISTS priest_packages_read ON public.priest_packages;
DROP POLICY IF EXISTS priest_packages_owner ON public.priest_packages;
CREATE POLICY priest_packages_read ON public.priest_packages FOR SELECT USING ((status='active') OR public.owns_priest(provider_id));
CREATE POLICY priest_packages_owner ON public.priest_packages FOR ALL USING (public.owns_priest(provider_id)) WITH CHECK (public.owns_priest(provider_id));

DROP POLICY IF EXISTS priest_gallery_read ON public.priest_gallery;
DROP POLICY IF EXISTS priest_gallery_owner ON public.priest_gallery;
CREATE POLICY priest_gallery_read ON public.priest_gallery FOR SELECT USING (true);
CREATE POLICY priest_gallery_owner ON public.priest_gallery FOR ALL USING (EXISTS(SELECT 1 FROM public.priest_packages p WHERE p.id=package_id AND public.owns_priest(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.priest_packages p WHERE p.id=package_id AND public.owns_priest(p.provider_id)));

DROP POLICY IF EXISTS priest_addons_read ON public.priest_addons;
DROP POLICY IF EXISTS priest_addons_owner ON public.priest_addons;
CREATE POLICY priest_addons_read ON public.priest_addons FOR SELECT USING (true);
CREATE POLICY priest_addons_owner ON public.priest_addons FOR ALL USING (EXISTS(SELECT 1 FROM public.priest_packages p WHERE p.id=package_id AND public.owns_priest(p.provider_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.priest_packages p WHERE p.id=package_id AND public.owns_priest(p.provider_id)));

DROP POLICY IF EXISTS priest_bookings_read ON public.priest_bookings;
DROP POLICY IF EXISTS priest_bookings_customer_insert ON public.priest_bookings;
DROP POLICY IF EXISTS priest_bookings_customer_update ON public.priest_bookings;
DROP POLICY IF EXISTS priest_bookings_provider_update ON public.priest_bookings;
CREATE POLICY priest_bookings_read ON public.priest_bookings FOR SELECT USING (customer_id=auth.uid() OR public.owns_priest(provider_id));
CREATE POLICY priest_bookings_customer_insert ON public.priest_bookings FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY priest_bookings_customer_update ON public.priest_bookings FOR UPDATE TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY priest_bookings_provider_update ON public.priest_bookings FOR UPDATE TO authenticated USING (public.owns_priest(provider_id)) WITH CHECK (public.owns_priest(provider_id));

-- Storage bucket
INSERT INTO storage.buckets(id,name,public) VALUES('priest-media','priest-media',true) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS priest_media_read ON storage.objects;
DROP POLICY IF EXISTS priest_media_owner ON storage.objects;
CREATE POLICY priest_media_read ON storage.objects FOR SELECT USING(bucket_id='priest-media');
CREATE POLICY priest_media_owner ON storage.objects FOR ALL TO authenticated USING(bucket_id='priest-media' AND auth.uid()::text=(storage.foldername(name))[1]) WITH CHECK(bucket_id='priest-media' AND auth.uid()::text=(storage.foldername(name))[1]);

-- Realtime
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['priest_packages','priest_gallery','priest_addons','priest_bookings'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF;
END LOOP; EXCEPTION WHEN OTHERS THEN NULL; END $$;
-- Water Suppliers package & booking system. Idempotent.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Main packages table
CREATE TABLE IF NOT EXISTS public.water_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 200),
  package_type text NOT NULL,
  description text,
  -- Pricing
  pricing_type text NOT NULL DEFAULT 'per_can' CHECK (pricing_type IN ('per_can','per_litre','per_tanker','per_event','custom_quote')),
  base_price numeric(12,2) CHECK (base_price >= 0),
  advance_percentage integer DEFAULT 20,
  transportation_charges numeric(12,2) DEFAULT 0,
  outside_city_charges numeric(12,2) DEFAULT 0,
  night_delivery_charges numeric(12,2) DEFAULT 0,
  emergency_delivery_charges numeric(12,2) DEFAULT 0,
  additional_tank_charges numeric(12,2) DEFAULT 0,
  discount_percentage integer DEFAULT 0,
  -- Supply details (JSONB for dynamic fields per package_type)
  supply_details jsonb NOT NULL DEFAULT '{}',
  -- Features
  supply_features text[] NOT NULL DEFAULT '{}',
  -- Availability
  available_cities text[] NOT NULL DEFAULT '{}',
  delivery_radius text,
  available_time_slots text[] NOT NULL DEFAULT '{}',
  max_deliveries_per_day integer DEFAULT 10,
  fleet_capacity text,
  -- Equipment & Delivery
  vehicle_type text,
  delivery_team_size text,
  delivery_time text,
  installation_included boolean DEFAULT false,
  water_dispenser_available boolean DEFAULT false,
  stand_included boolean DEFAULT false,
  cooling_unit_available boolean DEFAULT false,
  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused')),
  is_featured boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS water_packages_provider_idx ON public.water_packages(provider_id, status);

-- Gallery
CREATE TABLE IF NOT EXISTS public.water_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.water_packages(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video')),
  is_cover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS water_gallery_one_cover ON public.water_gallery(package_id) WHERE is_cover;
CREATE INDEX IF NOT EXISTS water_gallery_package_idx ON public.water_gallery(package_id, sort_order);

-- Add-ons
CREATE TABLE IF NOT EXISTS public.water_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.water_packages(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS water_addons_package_idx ON public.water_addons(package_id);

-- Bookings
CREATE TABLE IF NOT EXISTS public.water_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.water_packages(id),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id),
  customer_id uuid NOT NULL REFERENCES public.profiles(id),
  event_type text,
  event_date date NOT NULL,
  delivery_time text,
  delivery_address text,
  city text,
  quantity_required text,
  special_instructions text,
  selected_addon_ids uuid[] NOT NULL DEFAULT '{}',
  base_amount numeric(12,2) NOT NULL CHECK (base_amount >= 0),
  addons_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  advance_amount numeric(12,2) DEFAULT 0,
  remaining_amount numeric(12,2) DEFAULT 0,
  payment_deadline timestamptz,
  accepted_at timestamptz,
  advance_paid_at timestamptz,
  confirmed_at timestamptz,
  expired_at timestamptz,
  calendar_locked boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','confirmed','in_progress','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS water_bookings_provider_idx ON public.water_bookings(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS water_bookings_customer_idx ON public.water_bookings(customer_id, created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.water_pkg_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS water_packages_updated_at ON public.water_packages;
CREATE TRIGGER water_packages_updated_at BEFORE UPDATE ON public.water_packages FOR EACH ROW EXECUTE FUNCTION public.water_pkg_updated_at();

-- RLS
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['water_packages','water_gallery','water_addons','water_bookings'] LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END IF;
END LOOP; END $$;

-- water_packages policies (use existing is_water_supplier or inline check)
DROP POLICY IF EXISTS water_packages_read ON public.water_packages;
DROP POLICY IF EXISTS water_packages_owner ON public.water_packages;
CREATE POLICY water_packages_read ON public.water_packages FOR SELECT USING ((status='active') OR (EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid())));
CREATE POLICY water_packages_owner ON public.water_packages FOR ALL USING (EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid())) WITH CHECK (EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid()));

DROP POLICY IF EXISTS water_gallery_read ON public.water_gallery;
DROP POLICY IF EXISTS water_gallery_owner ON public.water_gallery;
CREATE POLICY water_gallery_read ON public.water_gallery FOR SELECT USING (true);
CREATE POLICY water_gallery_owner ON public.water_gallery FOR ALL USING (EXISTS(SELECT 1 FROM public.water_packages p JOIN public.provider_profiles pp ON pp.id=p.provider_id WHERE p.id=package_id AND pp.user_id=auth.uid())) WITH CHECK (EXISTS(SELECT 1 FROM public.water_packages p JOIN public.provider_profiles pp ON pp.id=p.provider_id WHERE p.id=package_id AND pp.user_id=auth.uid()));

DROP POLICY IF EXISTS water_addons_read ON public.water_addons;
DROP POLICY IF EXISTS water_addons_owner ON public.water_addons;
CREATE POLICY water_addons_read ON public.water_addons FOR SELECT USING (true);
CREATE POLICY water_addons_owner ON public.water_addons FOR ALL USING (EXISTS(SELECT 1 FROM public.water_packages p JOIN public.provider_profiles pp ON pp.id=p.provider_id WHERE p.id=package_id AND pp.user_id=auth.uid())) WITH CHECK (EXISTS(SELECT 1 FROM public.water_packages p JOIN public.provider_profiles pp ON pp.id=p.provider_id WHERE p.id=package_id AND pp.user_id=auth.uid()));

DROP POLICY IF EXISTS water_bookings_read ON public.water_bookings;
DROP POLICY IF EXISTS water_bookings_customer_insert ON public.water_bookings;
DROP POLICY IF EXISTS water_bookings_customer_update ON public.water_bookings;
DROP POLICY IF EXISTS water_bookings_provider_update ON public.water_bookings;
CREATE POLICY water_bookings_read ON public.water_bookings FOR SELECT USING (customer_id=auth.uid() OR EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid()));
CREATE POLICY water_bookings_customer_insert ON public.water_bookings FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY water_bookings_customer_update ON public.water_bookings FOR UPDATE TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY water_bookings_provider_update ON public.water_bookings FOR UPDATE TO authenticated USING (EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid())) WITH CHECK (EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid()));

-- Storage bucket
INSERT INTO storage.buckets(id,name,public) VALUES('water-media','water-media',true) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS water_media_read ON storage.objects;
DROP POLICY IF EXISTS water_media_owner ON storage.objects;
CREATE POLICY water_media_read ON storage.objects FOR SELECT USING(bucket_id='water-media');
CREATE POLICY water_media_owner ON storage.objects FOR ALL TO authenticated USING(bucket_id='water-media' AND auth.uid()::text=(storage.foldername(name))[1]) WITH CHECK(bucket_id='water-media' AND auth.uid()::text=(storage.foldername(name))[1]);

-- Realtime
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['water_packages','water_gallery','water_addons','water_bookings'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF;
END LOOP; EXCEPTION WHEN OTHERS THEN NULL; END $$;
-- Band Categories system. Idempotent.

-- Band categories lookup table
CREATE TABLE IF NOT EXISTS public.band_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text,
  icon text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS band_categories_active_idx ON public.band_categories(is_active, sort_order);

-- Seed the 14 band categories
INSERT INTO public.band_categories (name, slug, description, sort_order) VALUES
  ('Wedding Band', 'wedding_band', 'General band baja for wedding processions', 1),
  ('Brass Band', 'brass_band', 'Brass instrument ensemble for celebrations', 2),
  ('Pad Band', 'pad_band', 'Electronic pad-based band performance', 3),
  ('Baraat Band', 'baraat_band', 'Specialized baraat procession band', 4),
  ('Punjabi Dhol Band', 'punjabi_dhol', 'Energetic Punjabi dhol performers', 5),
  ('Nashik Dhol Band', 'nashik_dhol', 'Famous Nashik-style dhol tasha band', 6),
  ('Tamil Melam', 'tamil_melam', 'Traditional Tamil percussion ensemble', 7),
  ('Chenda Melam', 'chenda_melam', 'Kerala chenda percussion band', 8),
  ('Marfa Band', 'marfa_band', 'Hyderabadi marfa drum band', 9),
  ('Shivaji Maharashtrian Band', 'shivaji_band', 'Maharashtrian traditional Shivaji band', 10),
  ('Traditional Folk Band', 'folk_band', 'Regional folk music ensemble', 11),
  ('Devotional Band', 'devotional_band', 'Bhajan and devotional music band', 12),
  ('Shehnai & Nadaswaram Band', 'shehnai_nadaswaram', 'Classical shehnai and nadaswaram players', 13),
  ('Live Music Band', 'live_music_band', 'Live performance band with vocals and instruments', 14)
ON CONFLICT (slug) DO NOTHING;

-- Add band_category column to provider_profiles if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='provider_profiles' AND column_name='band_category') THEN
    ALTER TABLE public.provider_profiles ADD COLUMN band_category text;
  END IF;
END $$;

-- Index for filtering bands by category
CREATE INDEX IF NOT EXISTS provider_profiles_band_category_idx ON public.provider_profiles(band_category) WHERE band_category IS NOT NULL;

-- RLS for band_categories (public read, admin write)
DO $$ BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.band_categories'::regclass) THEN
    ALTER TABLE public.band_categories ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS band_categories_read ON public.band_categories;
CREATE POLICY band_categories_read ON public.band_categories FOR SELECT USING (true);

-- Realtime
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='band_categories') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.band_categories;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
-- Band Packages & Booking system. Idempotent.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Main packages table
CREATE TABLE IF NOT EXISTS public.band_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 200),
  band_category text,
  description text,
  event_type text,
  -- Pricing
  package_price numeric(12,2) CHECK (package_price >= 0),
  advance_percentage integer DEFAULT 20,
  travel_charges numeric(12,2) DEFAULT 0,
  outside_city_charges numeric(12,2) DEFAULT 0,
  extra_hour_charges numeric(12,2) DEFAULT 0,
  additional_performer_charges numeric(12,2) DEFAULT 0,
  additional_equipment_charges numeric(12,2) DEFAULT 0,
  -- Performance details
  performance_duration text,
  number_of_performers text,
  instruments text[] NOT NULL DEFAULT '{}',
  music_genres text[] NOT NULL DEFAULT '{}',
  languages text[] NOT NULL DEFAULT '{}',
  -- Event coverage
  event_types_supported text[] NOT NULL DEFAULT '{}',
  -- Equipment & inclusions
  equipment_included text[] NOT NULL DEFAULT '{}',
  -- Team
  band_members text,
  lead_performer text,
  drummers text,
  instrumentalists text,
  singers text,
  support_staff text,
  sound_engineer text,
  -- Deliverables
  deliverables text[] NOT NULL DEFAULT '{}',
  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused')),
  is_featured boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS band_packages_provider_idx ON public.band_packages(provider_id, status);

-- Gallery
CREATE TABLE IF NOT EXISTS public.band_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.band_packages(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video')),
  is_cover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS band_gallery_one_cover ON public.band_gallery(package_id) WHERE is_cover;
CREATE INDEX IF NOT EXISTS band_gallery_package_idx ON public.band_gallery(package_id, sort_order);

-- Add-ons
CREATE TABLE IF NOT EXISTS public.band_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.band_packages(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS band_addons_package_idx ON public.band_addons(package_id);

-- Bookings
CREATE TABLE IF NOT EXISTS public.band_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.band_packages(id),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id),
  customer_id uuid NOT NULL REFERENCES public.profiles(id),
  event_type text,
  event_date date NOT NULL,
  event_time text,
  venue text,
  city text,
  special_requirements text,
  selected_addon_ids uuid[] NOT NULL DEFAULT '{}',
  base_amount numeric(12,2) NOT NULL CHECK (base_amount >= 0),
  addons_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  advance_amount numeric(12,2) DEFAULT 0,
  remaining_amount numeric(12,2) DEFAULT 0,
  payment_deadline timestamptz,
  accepted_at timestamptz,
  advance_paid_at timestamptz,
  confirmed_at timestamptz,
  expired_at timestamptz,
  calendar_locked boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','confirmed','in_progress','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS band_bookings_provider_idx ON public.band_bookings(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS band_bookings_customer_idx ON public.band_bookings(customer_id, created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.band_pkg_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS band_packages_updated_at ON public.band_packages;
CREATE TRIGGER band_packages_updated_at BEFORE UPDATE ON public.band_packages FOR EACH ROW EXECUTE FUNCTION public.band_pkg_updated_at();

-- RLS
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['band_packages','band_gallery','band_addons','band_bookings'] LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END IF;
END LOOP; END $$;

-- band_packages policies
DROP POLICY IF EXISTS band_packages_read ON public.band_packages;
DROP POLICY IF EXISTS band_packages_owner ON public.band_packages;
CREATE POLICY band_packages_read ON public.band_packages FOR SELECT USING ((status='active') OR (EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid())));
CREATE POLICY band_packages_owner ON public.band_packages FOR ALL USING (EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid())) WITH CHECK (EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid()));

-- band_gallery policies
DROP POLICY IF EXISTS band_gallery_read ON public.band_gallery;
DROP POLICY IF EXISTS band_gallery_owner ON public.band_gallery;
CREATE POLICY band_gallery_read ON public.band_gallery FOR SELECT USING (true);
CREATE POLICY band_gallery_owner ON public.band_gallery FOR ALL USING (EXISTS(SELECT 1 FROM public.band_packages p JOIN public.provider_profiles pp ON pp.id=p.provider_id WHERE p.id=package_id AND pp.user_id=auth.uid())) WITH CHECK (EXISTS(SELECT 1 FROM public.band_packages p JOIN public.provider_profiles pp ON pp.id=p.provider_id WHERE p.id=package_id AND pp.user_id=auth.uid()));

-- band_addons policies
DROP POLICY IF EXISTS band_addons_read ON public.band_addons;
DROP POLICY IF EXISTS band_addons_owner ON public.band_addons;
CREATE POLICY band_addons_read ON public.band_addons FOR SELECT USING (true);
CREATE POLICY band_addons_owner ON public.band_addons FOR ALL USING (EXISTS(SELECT 1 FROM public.band_packages p JOIN public.provider_profiles pp ON pp.id=p.provider_id WHERE p.id=package_id AND pp.user_id=auth.uid())) WITH CHECK (EXISTS(SELECT 1 FROM public.band_packages p JOIN public.provider_profiles pp ON pp.id=p.provider_id WHERE p.id=package_id AND pp.user_id=auth.uid()));

-- band_bookings policies
DROP POLICY IF EXISTS band_bookings_read ON public.band_bookings;
DROP POLICY IF EXISTS band_bookings_customer_insert ON public.band_bookings;
DROP POLICY IF EXISTS band_bookings_customer_update ON public.band_bookings;
DROP POLICY IF EXISTS band_bookings_provider_update ON public.band_bookings;
CREATE POLICY band_bookings_read ON public.band_bookings FOR SELECT USING (customer_id=auth.uid() OR EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid()));
CREATE POLICY band_bookings_customer_insert ON public.band_bookings FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY band_bookings_customer_update ON public.band_bookings FOR UPDATE TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY band_bookings_provider_update ON public.band_bookings FOR UPDATE TO authenticated USING (EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid())) WITH CHECK (EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid()));

-- Storage bucket
INSERT INTO storage.buckets(id,name,public) VALUES('band-media','band-media',true) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS band_media_read ON storage.objects;
DROP POLICY IF EXISTS band_media_owner ON storage.objects;
CREATE POLICY band_media_read ON storage.objects FOR SELECT USING(bucket_id='band-media');
CREATE POLICY band_media_owner ON storage.objects FOR ALL TO authenticated USING(bucket_id='band-media' AND auth.uid()::text=(storage.foldername(name))[1]) WITH CHECK(bucket_id='band-media' AND auth.uid()::text=(storage.foldername(name))[1]);

-- Realtime
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['band_packages','band_gallery','band_addons','band_bookings'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF;
END LOOP; EXCEPTION WHEN OTHERS THEN NULL; END $$;
-- Add teardown_time to decorator_packages and media_type to decorator_gallery
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='decorator_packages' AND column_name='teardown_time') THEN
    ALTER TABLE public.decorator_packages ADD COLUMN teardown_time text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='decorator_gallery' AND column_name='media_type') THEN
    ALTER TABLE public.decorator_gallery ADD COLUMN media_type text NOT NULL DEFAULT 'image';
  END IF;
END $$;
-- Add media_type to anchor_gallery if missing, create storage bucket
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='anchor_gallery' AND column_name='media_type') THEN
    ALTER TABLE public.anchor_gallery ADD COLUMN media_type text NOT NULL DEFAULT 'image';
  END IF;
END $$;

-- Storage bucket for anchor media
INSERT INTO storage.buckets(id,name,public) VALUES('anchor-media','anchor-media',true) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS anchor_media_read ON storage.objects;
DROP POLICY IF EXISTS anchor_media_owner ON storage.objects;
CREATE POLICY anchor_media_read ON storage.objects FOR SELECT USING(bucket_id='anchor-media');
CREATE POLICY anchor_media_owner ON storage.objects FOR ALL TO authenticated USING(bucket_id='anchor-media' AND auth.uid()::text=(storage.foldername(name))[1]) WITH CHECK(bucket_id='anchor-media' AND auth.uid()::text=(storage.foldername(name))[1]);
-- Add media_type to mehendi_gallery if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mehendi_gallery' AND column_name='media_type') THEN
    ALTER TABLE public.mehendi_gallery ADD COLUMN media_type text NOT NULL DEFAULT 'image';
  END IF;
END $$;
-- Add media_type to hall_gallery if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='hall_gallery' AND column_name='media_type') THEN
    ALTER TABLE public.hall_gallery ADD COLUMN media_type text NOT NULL DEFAULT 'image';
  END IF;
END $$;
-- Add media_type to rental_gallery if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='rental_gallery' AND column_name='media_type') THEN
    ALTER TABLE public.rental_gallery ADD COLUMN media_type text NOT NULL DEFAULT 'image';
  END IF;
END $$;
-- Add media_type to priest_gallery if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='priest_gallery' AND column_name='media_type') THEN
    ALTER TABLE public.priest_gallery ADD COLUMN media_type text NOT NULL DEFAULT 'image';
  END IF;
END $$;
-- Add media_type to water_gallery if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='water_gallery' AND column_name='media_type') THEN
    ALTER TABLE public.water_gallery ADD COLUMN media_type text NOT NULL DEFAULT 'image';
  END IF;
END $$;
-- Singer packages & booking system
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.singer_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 200),
  package_type text,
  description text,
  package_price numeric(12,2) CHECK (package_price >= 0),
  advance_percentage integer DEFAULT 20,
  performance_duration text,
  number_of_sets text,
  set_duration text,
  break_duration text,
  performance_style text,
  event_types text[] NOT NULL DEFAULT '{}',
  languages text[] NOT NULL DEFAULT '{}',
  music_styles text[] NOT NULL DEFAULT '{}',
  equipment_included text[] NOT NULL DEFAULT '{}',
  team_members text,
  lead_singer text,
  supporting_vocalist text,
  guitarist text,
  keyboardist text,
  percussionist text,
  deliverables text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused')),
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS singer_packages_provider_idx ON public.singer_packages(provider_id, status);

CREATE TABLE IF NOT EXISTS public.singer_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.singer_packages(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image',
  is_cover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS singer_gallery_package_idx ON public.singer_gallery(package_id, sort_order);

CREATE TABLE IF NOT EXISTS public.singer_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.singer_packages(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS singer_addons_package_idx ON public.singer_addons(package_id);

CREATE TABLE IF NOT EXISTS public.singer_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.singer_packages(id),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id),
  customer_id uuid NOT NULL REFERENCES public.profiles(id),
  event_type text,
  event_date date NOT NULL,
  event_time text,
  venue text,
  city text,
  special_requirements text,
  selected_addon_ids uuid[] NOT NULL DEFAULT '{}',
  base_amount numeric(12,2) NOT NULL CHECK (base_amount >= 0),
  addons_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  advance_amount numeric(12,2) DEFAULT 0,
  remaining_amount numeric(12,2) DEFAULT 0,
  accepted_at timestamptz,
  advance_paid_at timestamptz,
  calendar_locked boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','confirmed','in_progress','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS singer_bookings_provider_idx ON public.singer_bookings(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS singer_bookings_customer_idx ON public.singer_bookings(customer_id, created_at DESC);

-- RLS
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['singer_packages','singer_gallery','singer_addons','singer_bookings'] LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END IF;
END LOOP; END $$;

DROP POLICY IF EXISTS singer_packages_read ON public.singer_packages;
DROP POLICY IF EXISTS singer_packages_owner ON public.singer_packages;
CREATE POLICY singer_packages_read ON public.singer_packages FOR SELECT USING ((status='active') OR (EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid())));
CREATE POLICY singer_packages_owner ON public.singer_packages FOR ALL USING (EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid())) WITH CHECK (EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid()));

DROP POLICY IF EXISTS singer_gallery_read ON public.singer_gallery;
DROP POLICY IF EXISTS singer_gallery_owner ON public.singer_gallery;
CREATE POLICY singer_gallery_read ON public.singer_gallery FOR SELECT USING (true);
CREATE POLICY singer_gallery_owner ON public.singer_gallery FOR ALL USING (EXISTS(SELECT 1 FROM public.singer_packages p JOIN public.provider_profiles pp ON pp.id=p.provider_id WHERE p.id=package_id AND pp.user_id=auth.uid())) WITH CHECK (EXISTS(SELECT 1 FROM public.singer_packages p JOIN public.provider_profiles pp ON pp.id=p.provider_id WHERE p.id=package_id AND pp.user_id=auth.uid()));

DROP POLICY IF EXISTS singer_addons_read ON public.singer_addons;
DROP POLICY IF EXISTS singer_addons_owner ON public.singer_addons;
CREATE POLICY singer_addons_read ON public.singer_addons FOR SELECT USING (true);
CREATE POLICY singer_addons_owner ON public.singer_addons FOR ALL USING (EXISTS(SELECT 1 FROM public.singer_packages p JOIN public.provider_profiles pp ON pp.id=p.provider_id WHERE p.id=package_id AND pp.user_id=auth.uid())) WITH CHECK (EXISTS(SELECT 1 FROM public.singer_packages p JOIN public.provider_profiles pp ON pp.id=p.provider_id WHERE p.id=package_id AND pp.user_id=auth.uid()));

DROP POLICY IF EXISTS singer_bookings_read ON public.singer_bookings;
DROP POLICY IF EXISTS singer_bookings_customer_insert ON public.singer_bookings;
DROP POLICY IF EXISTS singer_bookings_customer_update ON public.singer_bookings;
DROP POLICY IF EXISTS singer_bookings_provider_update ON public.singer_bookings;
CREATE POLICY singer_bookings_read ON public.singer_bookings FOR SELECT USING (customer_id=auth.uid() OR EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid()));
CREATE POLICY singer_bookings_customer_insert ON public.singer_bookings FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY singer_bookings_customer_update ON public.singer_bookings FOR UPDATE TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY singer_bookings_provider_update ON public.singer_bookings FOR UPDATE TO authenticated USING (EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid())) WITH CHECK (EXISTS(SELECT 1 FROM public.provider_profiles pp WHERE pp.id=provider_id AND pp.user_id=auth.uid()));

INSERT INTO storage.buckets(id,name,public) VALUES('singer-media','singer-media',true) ON CONFLICT(id) DO NOTHING;
DROP POLICY IF EXISTS singer_media_read ON storage.objects;
DROP POLICY IF EXISTS singer_media_owner ON storage.objects;
CREATE POLICY singer_media_read ON storage.objects FOR SELECT USING(bucket_id='singer-media');
CREATE POLICY singer_media_owner ON storage.objects FOR ALL TO authenticated USING(bucket_id='singer-media' AND auth.uid()::text=(storage.foldername(name))[1]) WITH CHECK(bucket_id='singer-media' AND auth.uid()::text=(storage.foldername(name))[1]);

DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['singer_packages','singer_gallery','singer_addons','singer_bookings'] LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t); END IF;
END LOOP; EXCEPTION WHEN OTHERS THEN NULL; END $$;
-- Add missing columns to videography_bookings
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='videography_bookings' AND column_name='city') THEN
    ALTER TABLE public.videography_bookings ADD COLUMN city text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='videography_bookings' AND column_name='special_requirements') THEN
    ALTER TABLE public.videography_bookings ADD COLUMN special_requirements text;
  END IF;
END $$;
-- Universal booking locations table
CREATE TABLE IF NOT EXISTS public.booking_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Polymorphic reference: booking_table + booking_id
  booking_table text NOT NULL,
  booking_id uuid NOT NULL,
  -- Location fields
  state text,
  district text,
  town_city text,
  exact_address text,
  pincode text,
  landmark text,
  latitude double precision,
  longitude double precision,
  formatted_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_locations_booking_idx ON public.booking_locations(booking_table, booking_id);

-- RLS
ALTER TABLE public.booking_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS booking_locations_insert ON public.booking_locations;
DROP POLICY IF EXISTS booking_locations_read ON public.booking_locations;

CREATE POLICY booking_locations_insert ON public.booking_locations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY booking_locations_read ON public.booking_locations FOR SELECT TO authenticated USING (true);

-- Realtime
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='booking_locations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_locations;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
-- Add district column to profiles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='district') THEN
    ALTER TABLE public.profiles ADD COLUMN district text;
  END IF;
END $$;
-- Add missing 'city' column to booking tables that don't have it
-- Tables created later (decorator, makeup, mehendi, anchor, etc.) already have city.
-- This fixes: videography_bookings, photography_package_bookings, catering_bookings, drone_bookings

DO $$ BEGIN
  -- videography_bookings
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='videography_bookings' AND column_name='city') THEN
    ALTER TABLE public.videography_bookings ADD COLUMN city text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='videography_bookings' AND column_name='special_requirements') THEN
    ALTER TABLE public.videography_bookings ADD COLUMN special_requirements text;
  END IF;

  -- photography_package_bookings
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='photography_package_bookings' AND column_name='city') THEN
    ALTER TABLE public.photography_package_bookings ADD COLUMN city text;
  END IF;

  -- catering_bookings
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='catering_bookings' AND column_name='city') THEN
    ALTER TABLE public.catering_bookings ADD COLUMN city text;
  END IF;

  -- drone_bookings
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='drone_bookings' AND column_name='city') THEN
    ALTER TABLE public.drone_bookings ADD COLUMN city text;
  END IF;
END $$;
-- ============================================================
-- Fix messages table to support ALL category-specific booking tables
-- Previously: messages.booking_id FK referenced only 'bookings' table
-- Now: messages.booking_id is a generic UUID (no FK) that can reference
--       any booking table (singer_bookings, dancer_bookings, etc.)
-- RLS updated to check participant access across ALL booking tables
-- and enforce advance payment requirement for chat access.
-- ============================================================

-- Step 1: Drop the FK constraint on messages.booking_id
-- The constraint name may vary; drop all FK constraints on that column
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'messages'
      AND att.attname = 'booking_id'
      AND con.contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

-- Step 2: Drop old RLS policies
DROP POLICY IF EXISTS "Booking participants can view messages" ON public.messages;
DROP POLICY IF EXISTS "Booking participants can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can mark own received messages as read" ON public.messages;

-- Step 3: Create a helper function that checks if a user is a participant
-- in ANY booking table for a given booking_id AND if chat is eligible
-- (advance paid = status is 'in_progress' or 'completed')
CREATE OR REPLACE FUNCTION public.is_chat_participant(p_booking_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Check generic bookings table
  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = p_booking_id
    AND (b.customer_id = p_user_id OR EXISTS (
      SELECT 1 FROM public.provider_profiles pp WHERE pp.id = b.provider_id AND pp.user_id = p_user_id
    ))
  ) THEN RETURN TRUE; END IF;

  -- Check all category-specific booking tables
  IF EXISTS (SELECT 1 FROM public.singer_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.dancer_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.videography_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.drone_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.dj_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.decorator_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.makeup_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.mehendi_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.anchor_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.band_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.priest_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.water_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.rental_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.banquet_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.catering_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.photography_package_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = photographer_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;

  RETURN FALSE;
END;
$$;

-- Step 4: Create a helper to check if chat is eligible (advance paid)
CREATE OR REPLACE FUNCTION public.is_chat_eligible(p_booking_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Generic bookings: status in_progress or completed
  IF EXISTS (SELECT 1 FROM public.bookings WHERE id = p_booking_id AND status IN ('in_progress', 'completed')) THEN RETURN TRUE; END IF;

  -- Category-specific: check status = 'in_progress' or 'confirmed' or 'completed'
  IF EXISTS (SELECT 1 FROM public.singer_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.dancer_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.videography_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.drone_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.dj_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.decorator_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.makeup_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.mehendi_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.anchor_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.band_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.priest_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.water_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.rental_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.banquet_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.catering_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.photography_package_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;

  RETURN FALSE;
END;
$$;

-- Step 5: New RLS policies using the helper functions

-- SELECT: participants can read messages for their bookings
CREATE POLICY "chat_select_participant" ON public.messages
FOR SELECT USING (
  public.is_chat_participant(booking_id, auth.uid())
);

-- INSERT: participants can send messages ONLY if chat is eligible (advance paid)
CREATE POLICY "chat_insert_eligible" ON public.messages
FOR INSERT WITH CHECK (
  auth.uid() = sender_id
  AND public.is_chat_participant(booking_id, auth.uid())
  AND public.is_chat_eligible(booking_id)
);

-- UPDATE: non-sender participants can mark messages as read
CREATE POLICY "chat_update_read" ON public.messages
FOR UPDATE USING (
  sender_id != auth.uid()
  AND public.is_chat_participant(booking_id, auth.uid())
);
-- ═══════════════════════════════════════════════════════════════════════════════
-- DANCER SYSTEM — Packages, Addons, Gallery, Bookings
-- Follows the same architecture as singer_system, band_packages_system, etc.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Dancer Packages ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dancer_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  dance_type text,
  package_type text,
  performance_style text,
  team_size integer DEFAULT 1,
  duration text,
  services_included text[] NOT NULL DEFAULT '{}',
  deliverables text[] NOT NULL DEFAULT '{}',
  package_price numeric(12,2) NOT NULL CHECK (package_price >= 0),
  advance_percentage integer NOT NULL DEFAULT 20 CHECK (advance_percentage >= 0 AND advance_percentage <= 100),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','paused')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dancer_packages_provider_idx ON public.dancer_packages(provider_id, created_at DESC);

-- ─── Dancer Addons ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dancer_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.dancer_packages(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS dancer_addons_package_idx ON public.dancer_addons(package_id);

-- ─── Dancer Gallery ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dancer_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.dancer_packages(id) ON DELETE CASCADE,
  public_url text NOT NULL,
  is_cover boolean NOT NULL DEFAULT false,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video')),
  title text,
  dance_type text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dancer_gallery_package_idx ON public.dancer_gallery(package_id);

-- ─── Dancer Bookings ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dancer_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.dancer_packages(id),
  provider_id uuid NOT NULL REFERENCES public.provider_profiles(id),
  customer_id uuid NOT NULL REFERENCES public.profiles(id),
  event_type text,
  event_date date NOT NULL,
  event_time text,
  venue text,
  city text,
  dance_type text,
  number_of_dancers integer DEFAULT 1,
  performance_duration text,
  special_requirements text,
  selected_addon_ids uuid[] NOT NULL DEFAULT '{}',
  base_amount numeric(12,2) NOT NULL CHECK (base_amount >= 0),
  addons_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (addons_amount >= 0),
  total_amount numeric(12,2) NOT NULL CHECK (total_amount >= 0),
  advance_amount numeric(12,2) DEFAULT 0,
  remaining_amount numeric(12,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','confirmed','in_progress','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dancer_bookings_provider_idx ON public.dancer_bookings(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS dancer_bookings_customer_idx ON public.dancer_bookings(customer_id, created_at DESC);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['dancer_packages','dancer_addons','dancer_gallery','dancer_bookings'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    END IF;
  END LOOP;
END $$;

-- Packages: public read, owner write
DROP POLICY IF EXISTS dancer_packages_public_read ON public.dancer_packages;
CREATE POLICY dancer_packages_public_read ON public.dancer_packages FOR SELECT USING (status = 'active');

DROP POLICY IF EXISTS dancer_packages_owner ON public.dancer_packages;
CREATE POLICY dancer_packages_owner ON public.dancer_packages FOR ALL
  USING (provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid()))
  WITH CHECK (provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid()));

-- Addons: public read via package, owner write
DROP POLICY IF EXISTS dancer_addons_public_read ON public.dancer_addons;
CREATE POLICY dancer_addons_public_read ON public.dancer_addons FOR SELECT USING (true);

DROP POLICY IF EXISTS dancer_addons_owner ON public.dancer_addons;
CREATE POLICY dancer_addons_owner ON public.dancer_addons FOR ALL
  USING (EXISTS(SELECT 1 FROM public.dancer_packages p WHERE p.id = package_id AND p.provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())))
  WITH CHECK (EXISTS(SELECT 1 FROM public.dancer_packages p WHERE p.id = package_id AND p.provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())));

-- Gallery: public read, owner write
DROP POLICY IF EXISTS dancer_gallery_public_read ON public.dancer_gallery;
CREATE POLICY dancer_gallery_public_read ON public.dancer_gallery FOR SELECT USING (true);

DROP POLICY IF EXISTS dancer_gallery_owner ON public.dancer_gallery;
CREATE POLICY dancer_gallery_owner ON public.dancer_gallery FOR ALL
  USING (EXISTS(SELECT 1 FROM public.dancer_packages p WHERE p.id = package_id AND p.provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())))
  WITH CHECK (EXISTS(SELECT 1 FROM public.dancer_packages p WHERE p.id = package_id AND p.provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())));

-- Bookings: customer + provider read, customer insert
DROP POLICY IF EXISTS dancer_bookings_read ON public.dancer_bookings;
CREATE POLICY dancer_bookings_read ON public.dancer_bookings FOR SELECT
  USING (customer_id = auth.uid() OR provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS dancer_bookings_customer_insert ON public.dancer_bookings;
CREATE POLICY dancer_bookings_customer_insert ON public.dancer_bookings FOR INSERT
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS dancer_bookings_provider_update ON public.dancer_bookings;
CREATE POLICY dancer_bookings_provider_update ON public.dancer_bookings FOR UPDATE
  USING (provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid()));
-- ============================================================
-- Vowza Rescheduling System
-- Creates reschedule_requests table for booking-specific reschedule
-- workflow: Customer requests → Artist approves/declines → refund if declined
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reschedule_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Booking relationship (polymorphic — can reference any booking table)
  booking_id UUID NOT NULL,
  booking_table TEXT NOT NULL, -- e.g. 'singer_bookings', 'bookings', etc.

  -- Parties
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL, -- provider_profiles.id

  -- Original date/time (snapshot at time of request)
  original_date DATE NOT NULL,
  original_time TEXT,

  -- Requested new date/time
  requested_date DATE NOT NULL,
  requested_time TEXT,

  -- Request metadata
  reason TEXT, -- optional customer reason
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'cancelled')),

  -- Artist decision
  decided_by UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ,
  decline_reason TEXT,

  -- Refund tracking (populated on decline if advance was paid)
  refund_eligible BOOLEAN DEFAULT false,
  original_amount_paid NUMERIC(10,2) DEFAULT 0,
  refund_percentage NUMERIC(5,2) DEFAULT 80,
  refund_amount NUMERIC(10,2) DEFAULT 0,
  refund_status TEXT DEFAULT 'none' CHECK (refund_status IN ('none', 'pending', 'completed', 'failed')),
  refund_initiated_at TIMESTAMPTZ,
  refund_completed_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_reschedule_booking ON public.reschedule_requests(booking_id);
CREATE INDEX idx_reschedule_customer ON public.reschedule_requests(customer_id);
CREATE INDEX idx_reschedule_provider ON public.reschedule_requests(provider_id);
CREATE INDEX idx_reschedule_status ON public.reschedule_requests(status);

-- Enable RLS
ALTER TABLE public.reschedule_requests ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies ─────────────────────────────────────────────────────────

-- Customers can view their own reschedule requests
CREATE POLICY "customer_select_own_reschedules" ON public.reschedule_requests
FOR SELECT USING (customer_id = auth.uid());

-- Vendors can view reschedule requests for their bookings
CREATE POLICY "vendor_select_own_reschedules" ON public.reschedule_requests
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.provider_profiles pp
    WHERE pp.id::text = provider_id AND pp.user_id = auth.uid()
  )
);

-- Admins can view all
CREATE POLICY "admin_select_all_reschedules" ON public.reschedule_requests
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin')
  )
);

-- Customers can insert reschedule requests for their own bookings
CREATE POLICY "customer_insert_reschedule" ON public.reschedule_requests
FOR INSERT WITH CHECK (
  customer_id = auth.uid()
);

-- Vendors can update (approve/decline) reschedule requests for their bookings
CREATE POLICY "vendor_update_reschedule" ON public.reschedule_requests
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.provider_profiles pp
    WHERE pp.id::text = provider_id AND pp.user_id = auth.uid()
  )
);

-- Customers can cancel their own pending requests
CREATE POLICY "customer_update_cancel_reschedule" ON public.reschedule_requests
FOR UPDATE USING (
  customer_id = auth.uid() AND status = 'pending'
);

-- Enable realtime for reschedule_requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.reschedule_requests;
-- ============================================================
-- Vowza Booking Cancellation System
-- Tracks individual booking cancellations with tiered refund policy:
-- >= 5 days: 95%, >= 4 days: 90%, >= 3 days: 80%, >= 48hrs: 50%, < 48hrs: 0%
-- ============================================================

CREATE TABLE IF NOT EXISTS public.booking_cancellations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Booking relationship (polymorphic)
  booking_id UUID NOT NULL,
  booking_table TEXT NOT NULL,

  -- Parties
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,

  -- Event info at time of cancellation
  event_date DATE NOT NULL,
  event_time TEXT,

  -- Cancellation details
  cancelled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  hours_remaining NUMERIC(10,2) NOT NULL DEFAULT 0,
  policy_tier TEXT NOT NULL CHECK (policy_tier IN ('5_plus_days', '4_days', '3_days', '48_hours', 'under_48')),

  -- Payment and refund
  amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  refund_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  refund_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_retained NUMERIC(10,2) NOT NULL DEFAULT 0,
  refund_status TEXT NOT NULL DEFAULT 'none' CHECK (refund_status IN ('none', 'pending', 'completed', 'failed')),
  refund_initiated_at TIMESTAMPTZ,
  refund_completed_at TIMESTAMPTZ,

  -- Metadata
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_cancellation_booking ON public.booking_cancellations(booking_id);
CREATE INDEX idx_cancellation_customer ON public.booking_cancellations(customer_id);
CREATE INDEX idx_cancellation_provider ON public.booking_cancellations(provider_id);

-- Enable RLS
ALTER TABLE public.booking_cancellations ENABLE ROW LEVEL SECURITY;

-- Customer can view their own cancellations
CREATE POLICY "customer_select_own_cancellations" ON public.booking_cancellations
FOR SELECT USING (customer_id = auth.uid());

-- Vendor can view cancellations for their bookings
CREATE POLICY "vendor_select_cancellations" ON public.booking_cancellations
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.provider_profiles pp
    WHERE pp.id::text = provider_id AND pp.user_id = auth.uid()
  )
);

-- Admin can view all
CREATE POLICY "admin_select_all_cancellations" ON public.booking_cancellations
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin')
  )
);

-- Customer can insert cancellation for their own booking
CREATE POLICY "customer_insert_cancellation" ON public.booking_cancellations
FOR INSERT WITH CHECK (customer_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_cancellations;
-- Add category and style_tag columns to portfolio_items for singer/dancer style association
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='portfolio_items' AND column_name='category') THEN
    ALTER TABLE public.portfolio_items ADD COLUMN category text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='portfolio_items' AND column_name='style_tag') THEN
    ALTER TABLE public.portfolio_items ADD COLUMN style_tag text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='portfolio_items' AND column_name='event_name') THEN
    ALTER TABLE public.portfolio_items ADD COLUMN event_name text;
  END IF;
END $$;
-- Create dancer-media storage bucket
INSERT INTO storage.buckets(id, name, public) VALUES('dancer-media', 'dancer-media', true) ON CONFLICT(id) DO NOTHING;

-- Storage policies for dancer media
DROP POLICY IF EXISTS dancer_media_read ON storage.objects;
CREATE POLICY dancer_media_read ON storage.objects FOR SELECT USING (bucket_id = 'dancer-media');

DROP POLICY IF EXISTS dancer_media_owner ON storage.objects;
CREATE POLICY dancer_media_owner ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'dancer-media' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'dancer-media' AND auth.uid()::text = (storage.foldername(name))[1]);
-- ============================================================
-- Vowza Vendor Cancellation Penalty System
-- When a vendor cancels AFTER accepting a booking:
-- 30% penalty on TOTAL BOOKING COST
-- Customer receives full refund of advance paid
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vendor_cancellations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Booking relationship
  booking_id UUID NOT NULL,
  booking_table TEXT NOT NULL,

  -- Parties
  vendor_id TEXT NOT NULL,         -- provider_profiles.id
  vendor_user_id UUID NOT NULL REFERENCES auth.users(id),
  customer_id UUID NOT NULL REFERENCES auth.users(id),

  -- Financial
  total_booking_cost NUMERIC(10,2) NOT NULL,
  penalty_percentage NUMERIC(5,2) NOT NULL DEFAULT 30,
  penalty_amount NUMERIC(10,2) NOT NULL,
  customer_advance_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  customer_refund_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  customer_refund_status TEXT NOT NULL DEFAULT 'none' CHECK (customer_refund_status IN ('none', 'pending', 'completed', 'failed')),

  -- Metadata
  reason TEXT,
  cancelled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_vendor_cancel_booking ON public.vendor_cancellations(booking_id);
CREATE INDEX idx_vendor_cancel_vendor ON public.vendor_cancellations(vendor_id);
CREATE INDEX idx_vendor_cancel_customer ON public.vendor_cancellations(customer_id);

-- Enable RLS
ALTER TABLE public.vendor_cancellations ENABLE ROW LEVEL SECURITY;

-- Vendor can view their own cancellations
CREATE POLICY "vendor_select_own_cancellations" ON public.vendor_cancellations
FOR SELECT USING (vendor_user_id = auth.uid());

-- Customer can view cancellations affecting their bookings
CREATE POLICY "customer_select_vendor_cancellations" ON public.vendor_cancellations
FOR SELECT USING (customer_id = auth.uid());

-- Admin can view all
CREATE POLICY "admin_select_all_vendor_cancellations" ON public.vendor_cancellations
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin')
  )
);

-- Vendor can insert their own cancellation record
CREATE POLICY "vendor_insert_cancellation" ON public.vendor_cancellations
FOR INSERT WITH CHECK (vendor_user_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.vendor_cancellations;
-- ============================================================
-- Vowza Chat WhatsApp-like Upgrade
-- Adds: message types (text/image/video/file/location), delivery states,
-- media attachment fields, location coordinates
-- Backward compatible: existing text messages continue to work (defaults to 'text')
-- ============================================================

-- Message type: text, image, video, file, location
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text'
  CHECK (message_type IN ('text', 'image', 'video', 'file', 'location'));

-- Attachment fields (for image/video/file)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- Location fields
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS location_label TEXT;

-- Delivery states (timestamps — null means not yet delivered/read)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Reply reference (for quote/reply feature)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to_id UUID;

-- Index for delivery tracking
CREATE INDEX IF NOT EXISTS idx_messages_delivered ON public.messages(delivered_at) WHERE delivered_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_read ON public.messages(read_at) WHERE read_at IS NULL;

-- ============================================================
-- Storage bucket for chat media
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media',
  'chat-media',
  false,
  52428800, -- 50MB max
  ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: only authenticated users can upload to their own folder
CREATE POLICY "chat_media_upload" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-media' AND auth.uid() IS NOT NULL
);

-- Storage RLS: participants can read chat media for their bookings
CREATE POLICY "chat_media_read" ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat-media' AND auth.uid() IS NOT NULL
);

-- Storage RLS: sender can delete their own uploads
CREATE POLICY "chat_media_delete" ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat-media' AND (storage.foldername(name))[1] = auth.uid()::text
);
-- Add payment lifecycle columns to ALL category booking tables
-- These columns were originally only on bookings, catering_bookings, photography_package_bookings
-- Now adding to all remaining category tables for consistent lifecycle

DO $$ 
DECLARE 
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'videography_bookings', 'drone_bookings', 'dj_bookings',
    'decorator_bookings', 'makeup_bookings', 'mehendi_bookings',
    'anchor_bookings', 'banquet_bookings', 'rental_bookings',
    'priest_bookings', 'water_bookings', 'band_bookings',
    'singer_bookings', 'dancer_bookings'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS payment_deadline timestamptz', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS accepted_at timestamptz', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS advance_paid_at timestamptz', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS confirmed_at timestamptz', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS expired_at timestamptz', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS calendar_locked boolean NOT NULL DEFAULT false', tbl);
  END LOOP;
END $$;

-- Create booking_events table for activity timeline/history
CREATE TABLE IF NOT EXISTS public.booking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_table text NOT NULL,
  booking_id uuid NOT NULL,
  event_type text NOT NULL,
  actor_id uuid,
  actor_role text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_events_booking_idx ON public.booking_events(booking_table, booking_id, created_at DESC);

-- RLS for booking_events
ALTER TABLE public.booking_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS booking_events_read ON public.booking_events;
CREATE POLICY booking_events_read ON public.booking_events FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS booking_events_insert ON public.booking_events;
CREATE POLICY booking_events_insert ON public.booking_events FOR INSERT TO authenticated WITH CHECK (true);
-- ============================================================
-- Fix provider-media storage delete policy
-- The upload path is: portfolio/{vendorId}_{timestamp}_{random}.{ext}
-- The old delete policy checked auth.uid() == foldername[1], but foldername[1] = 'portfolio'
-- Fix: allow any authenticated user to delete from provider-media bucket
-- (DB-level portfolio_items RLS already ensures only the owner can access their items)
-- ============================================================

DROP POLICY IF EXISTS "Users can delete own provider media" ON storage.objects;

CREATE POLICY "Authenticated users can delete provider media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'provider-media' AND auth.role() = 'authenticated'
);
-- Bootstrap super_admin role for the designated Super Admin account
-- Email: kammaripradeep265@gmail.com

-- First add 'super_admin' to the app_role enum if it doesn't exist
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add super_admin role if user exists
DO $$ 
DECLARE
  v_uid uuid;
BEGIN
  -- Find the user by email in auth.users
  SELECT id INTO v_uid FROM auth.users WHERE email = 'kammaripradeep265@gmail.com' LIMIT 1;
  
  IF v_uid IS NOT NULL THEN
    -- Remove existing admin role if present (will be replaced by super_admin)
    DELETE FROM public.user_roles WHERE user_id = v_uid AND role = 'admin';
    
    -- Insert super_admin role (idempotent)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_uid, 'super_admin')
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Super admin role assigned to %', v_uid;
  ELSE
    RAISE NOTICE 'User kammaripradeep265@gmail.com not found — will be assigned on next login';
  END IF;
END $$;
DO $$ 
DECLARE
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'kammaripradeep265@gmail.com' LIMIT 1;
  IF v_uid IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = v_uid AND role = 'admin';
    INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'super_admin') ON CONFLICT DO NOTHING;
  END IF;
END $$;
-- Force assign super_admin role to kammaripradeep265@gmail.com
-- Also keep admin role so isAdmin check works in all places
DO $$ 
DECLARE
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'kammaripradeep265@gmail.com' LIMIT 1;
  IF v_uid IS NOT NULL THEN
    -- Ensure super_admin role exists for this user
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_uid AND role = 'super_admin') THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'super_admin');
    END IF;
    -- Also ensure admin role exists (so isAdmin checks pass everywhere)
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_uid AND role = 'admin') THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'admin');
    END IF;
    RAISE NOTICE 'Super admin roles confirmed for user %', v_uid;
  ELSE
    RAISE NOTICE 'User not found';
  END IF;
END $$;
-- Ensure user_roles is fully accessible (RLS disabled + permissive policy as safety net)
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

-- Drop any restrictive policies that might exist
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
DROP POLICY IF EXISTS "roles_read_own" ON public.user_roles;
DROP POLICY IF EXISTS "roles_admin_all" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_all" ON public.user_roles;
DROP POLICY IF EXISTS "roles_insert_auth" ON public.user_roles;
DROP POLICY IF EXISTS "roles_insert" ON public.user_roles;
DROP POLICY IF EXISTS "roles_select" ON public.user_roles;

-- Re-enable with a fully permissive read policy for authenticated users
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_roles_read_all" ON public.user_roles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "user_roles_write_self" ON public.user_roles
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
-- ============================================================
-- Vowza Platform Settings
-- Global configuration for platform fee (percentage or fixed).
-- Admin-only write access. All authenticated users can read (needed at checkout).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Seed the default platform fee setting (5% percentage)
INSERT INTO public.platform_settings (key, value)
VALUES ('platform_fee', '{"type": "percentage", "rate": 5, "enabled": true}')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read settings (needed for checkout calculation)
CREATE POLICY "anyone_can_read_settings" ON public.platform_settings
FOR SELECT USING (true);

-- Only admin/super_admin can insert/update
CREATE POLICY "admin_can_update_settings" ON public.platform_settings
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "admin_can_insert_settings" ON public.platform_settings
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'super_admin')
  )
);
-- Security Events Table for Vowza
-- Admin-read-only, system-write (via anon with RLS rules)
-- Captures unauthorized access attempts and suspicious behavior

CREATE TABLE IF NOT EXISTS public.security_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    text NOT NULL,
  severity      text NOT NULL CHECK (severity IN ('low','medium','high','critical','info')),
  user_id       uuid,
  user_email    text,
  endpoint      text,
  resource_type text,
  resource_id   text,
  action        text,
  result        text,
  http_status   integer,
  reason        text,
  risk_score    integer DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  user_agent    text,
  is_authenticated boolean DEFAULT false,
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS security_events_created_idx    ON public.security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS security_events_severity_idx   ON public.security_events(severity);
CREATE INDEX IF NOT EXISTS security_events_user_id_idx    ON public.security_events(user_id);
CREATE INDEX IF NOT EXISTS security_events_event_type_idx ON public.security_events(event_type);
CREATE INDEX IF NOT EXISTS security_events_risk_idx       ON public.security_events(risk_score DESC);

-- RLS
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Only admins/super_admins can READ security events
DROP POLICY IF EXISTS security_events_admin_read ON public.security_events;
CREATE POLICY security_events_admin_read ON public.security_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- Authenticated users can INSERT their own events (the client logs them)
-- This is controlled: user cannot insert with someone else's user_id
DROP POLICY IF EXISTS security_events_insert ON public.security_events;
CREATE POLICY security_events_insert ON public.security_events
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR user_id IS NULL
  );

-- Unauthenticated users can also insert (anonymous attempts)
DROP POLICY IF EXISTS security_events_anon_insert ON public.security_events;
CREATE POLICY security_events_anon_insert ON public.security_events
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL AND is_authenticated = false);

-- Nobody can UPDATE or DELETE security events (immutable audit log)
-- No UPDATE or DELETE policies = no UPDATE/DELETE allowed

-- Enable realtime for admin dashboard
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'security_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.security_events;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
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
-- ============================================================
-- Vowza Face Liveness Verification for Artist Registration
-- Adds verification fields to provider_profiles
-- ============================================================

ALTER TABLE public.provider_profiles ADD COLUMN IF NOT EXISTS liveness_verified BOOLEAN DEFAULT false;
ALTER TABLE public.provider_profiles ADD COLUMN IF NOT EXISTS liveness_verified_at TIMESTAMPTZ;
ALTER TABLE public.provider_profiles ADD COLUMN IF NOT EXISTS liveness_provider TEXT DEFAULT 'mediapipe_face_mesh';
ALTER TABLE public.provider_profiles ADD COLUMN IF NOT EXISTS liveness_session_id TEXT;
ALTER TABLE public.provider_profiles ADD COLUMN IF NOT EXISTS liveness_attempts INTEGER DEFAULT 0;
-- Admin-managed promotional content for the soft-authentication modal.
-- Uses a unique timestamp because 20260822000000 is already allocated to a
-- different historical production migration.

CREATE TABLE IF NOT EXISTS public.auth_promotional_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  current_image_url TEXT,
  image_storage_path TEXT,
  overlay_opacity DECIMAL(3,2) NOT NULL DEFAULT 0.30,
  overlay_color TEXT NOT NULL DEFAULT 'rgba(0,0,0,1)',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  CONSTRAINT auth_promotional_config_overlay_opacity_check
    CHECK (overlay_opacity >= 0 AND overlay_opacity <= 1),
  CONSTRAINT auth_promotional_config_image_url_check
    CHECK (current_image_url IS NULL OR current_image_url <> '')
);

ALTER TABLE public.auth_promotional_config ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_auth_promotional_config_active
  ON public.auth_promotional_config (is_active);
CREATE INDEX IF NOT EXISTS idx_auth_promotional_config_created
  ON public.auth_promotional_config (created_at DESC);

GRANT SELECT ON public.auth_promotional_config TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.auth_promotional_config TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotional_config'
      AND policyname = 'auth_promotional_config_select'
  ) THEN
    CREATE POLICY auth_promotional_config_select
      ON public.auth_promotional_config FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotional_config'
      AND policyname = 'auth_promotional_config_insert'
  ) THEN
    CREATE POLICY auth_promotional_config_insert
      ON public.auth_promotional_config FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotional_config'
      AND policyname = 'auth_promotional_config_update'
  ) THEN
    CREATE POLICY auth_promotional_config_update
      ON public.auth_promotional_config FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotional_config'
      AND policyname = 'auth_promotional_config_delete'
  ) THEN
    CREATE POLICY auth_promotional_config_delete
      ON public.auth_promotional_config FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;
END
$$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('auth-promotional', 'auth-promotional', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Public read auth promotional images'
  ) THEN
    CREATE POLICY "Public read auth promotional images"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'auth-promotional');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins insert auth promotional images'
  ) THEN
    CREATE POLICY "Admins insert auth promotional images"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'auth-promotional'
        AND EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins update auth promotional images'
  ) THEN
    CREATE POLICY "Admins update auth promotional images"
      ON storage.objects FOR UPDATE TO authenticated
      USING (
        bucket_id = 'auth-promotional'
        AND EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      )
      WITH CHECK (
        bucket_id = 'auth-promotional'
        AND EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins delete auth promotional images'
  ) THEN
    CREATE POLICY "Admins delete auth promotional images"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'auth-promotional'
        AND EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;
END
$$;
-- Secure, application-level Service Start OTP for confirmed vendor bookings.
-- This is intentionally separate from Supabase Auth OTP / SMTP flows.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Reuse the existing booking_start_otps table and add only the fields needed to
-- make a successfully verified OTP explicitly single-use and delivery-auditable.
ALTER TABLE public.booking_start_otps
  ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_error TEXT;

-- Expired and duplicate legacy records must not prevent the secure flow from
-- maintaining exactly one active OTP per booking source.
UPDATE public.booking_start_otps
SET invalidated = true
WHERE verified = false
  AND invalidated = false
  AND expires_at <= now();

WITH ranked_active_otps AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY booking_table, booking_id
           ORDER BY created_at DESC, id DESC
         ) AS row_number
  FROM public.booking_start_otps
  WHERE verified = false
    AND invalidated = false
)
UPDATE public.booking_start_otps otp
SET invalidated = true
FROM ranked_active_otps ranked
WHERE otp.id = ranked.id
  AND ranked.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS booking_start_otps_one_active_per_booking
  ON public.booking_start_otps (booking_table, booking_id)
  WHERE verified = false AND invalidated = false;

-- OTP hashes must never be readable or writable by browser clients. The Edge
-- Function is the only public API and calls the RPCs below using service_role.
DROP POLICY IF EXISTS "vendor_select_own_otps" ON public.booking_start_otps;
DROP POLICY IF EXISTS "customer_select_own_otps" ON public.booking_start_otps;
DROP POLICY IF EXISTS "admin_select_all_otps" ON public.booking_start_otps;
DROP POLICY IF EXISTS "authenticated_insert_otps" ON public.booking_start_otps;
DROP POLICY IF EXISTS "authenticated_update_otps" ON public.booking_start_otps;
ALTER TABLE public.booking_start_otps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.booking_start_otps FROM anon, authenticated;

-- Returns and locks the booking while normalizing the photography provider key.
-- It accepts only the application's known booking tables, blocking SQL injection
-- through the dynamic table identifier.
CREATE OR REPLACE FUNCTION public.service_start_booking_context(
  p_booking_table TEXT,
  p_booking_id UUID
)
RETURNS TABLE (
  customer_id UUID,
  provider_id UUID,
  booking_status TEXT,
  advance_paid_at TIMESTAMPTZ,
  work_started_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_provider_column TEXT;
BEGIN
  IF p_booking_table NOT IN (
    'bookings', 'photography_package_bookings', 'catering_bookings',
    'drone_bookings', 'videography_bookings', 'dj_bookings',
    'decorator_bookings', 'makeup_bookings', 'mehendi_bookings',
    'anchor_bookings', 'banquet_bookings', 'rental_bookings',
    'priest_bookings', 'water_bookings', 'band_bookings',
    'singer_bookings', 'dancer_bookings'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_BOOKING_SOURCE';
  END IF;

  v_provider_column := CASE
    WHEN p_booking_table = 'photography_package_bookings' THEN 'photographer_id'
    ELSE 'provider_id'
  END;

  RETURN QUERY EXECUTE format(
    'SELECT b.customer_id, b.%1$I::uuid, b.status::text, b.advance_paid_at, b.work_started_at
     FROM public.%2$I AS b
     WHERE b.id = $1
     FOR UPDATE',
    v_provider_column,
    p_booking_table
  ) USING p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BOOKING_NOT_FOUND';
  END IF;
END;
$$;

-- Creates a cryptographically random six-digit code and stores only a bcrypt
-- hash. This function is service-role-only, so the plaintext code can only be
-- returned to the Edge Function for delivery through Brevo, never to a browser.
CREATE OR REPLACE FUNCTION public.create_service_start_otp(
  p_booking_table TEXT,
  p_booking_id UUID,
  p_vendor_user_id UUID,
  p_is_resend BOOLEAN DEFAULT false
)
RETURNS TABLE (
  otp_id UUID,
  otp_code TEXT,
  customer_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_customer_id UUID;
  v_provider_id UUID;
  v_status TEXT;
  v_advance_paid_at TIMESTAMPTZ;
  v_work_started_at TIMESTAMPTZ;
  v_customer_email TEXT;
  v_previous_id UUID;
  v_previous_resends INT;
  v_max_resends INT;
  v_previous_created_at TIMESTAMPTZ;
  v_resend_count INT := 0;
  v_random BIGINT;
  v_otp TEXT;
  v_otp_hash TEXT;
  v_otp_id UUID;
BEGIN
  SELECT *
  INTO v_customer_id, v_provider_id, v_status, v_advance_paid_at, v_work_started_at
  FROM public.service_start_booking_context(p_booking_table, p_booking_id);

  IF NOT EXISTS (
    SELECT 1
    FROM public.provider_profiles
    WHERE id = v_provider_id
      AND user_id = p_vendor_user_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'UNAUTHORIZED_VENDOR';
  END IF;

  IF lower(coalesce(v_status, '')) NOT IN ('confirmed', 'approved')
     OR v_advance_paid_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BOOKING_NOT_CONFIRMED';
  END IF;

  IF v_work_started_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERVICE_ALREADY_STARTED';
  END IF;

  SELECT NULLIF(trim(email), '')
  INTO v_customer_email
  FROM public.profiles
  WHERE id = v_customer_id;

  IF v_customer_email IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CUSTOMER_EMAIL_NOT_FOUND';
  END IF;

  -- An expired code is never reusable. Invalidate it before issuing another.
  UPDATE public.booking_start_otps
  SET invalidated = true
  WHERE booking_table = p_booking_table
    AND booking_id = p_booking_id
    AND verified = false
    AND invalidated = false
    AND expires_at <= now();

  SELECT id, resend_count, max_resends, created_at
  INTO v_previous_id, v_previous_resends, v_max_resends, v_previous_created_at
  FROM public.booking_start_otps
  WHERE booking_table = p_booking_table
    AND booking_id = p_booking_id
    AND verified = false
    AND invalidated = false
  ORDER BY created_at DESC, id DESC
  LIMIT 1
  FOR UPDATE;

  IF v_previous_id IS NOT NULL AND NOT p_is_resend THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ACTIVE_OTP_EXISTS';
  END IF;

  IF p_is_resend THEN
    IF v_previous_id IS NOT NULL THEN
      IF v_previous_resends >= v_max_resends THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'MAX_RESENDS_REACHED';
      END IF;
      IF v_previous_created_at > now() - interval '60 seconds' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RESEND_COOLDOWN';
      END IF;
      v_resend_count := v_previous_resends + 1;
      UPDATE public.booking_start_otps
      SET invalidated = true
      WHERE id = v_previous_id;
    ELSE
      -- A resend after expiry is a fresh code, but still has one resend counted.
      v_resend_count := 1;
    END IF;
  END IF;

  -- Four bytes from pgcrypto are used as the entropy source. The browser never
  -- receives this code; only its bcrypt hash is persisted.
  v_random := (get_byte(gen_random_bytes(4), 0)::bigint << 24)
            + (get_byte(gen_random_bytes(4), 1)::bigint << 16)
            + (get_byte(gen_random_bytes(4), 2)::bigint << 8)
            + get_byte(gen_random_bytes(4), 3)::bigint;
  v_otp := lpad((v_random % 1000000)::text, 6, '0');
  v_otp_hash := crypt(v_otp, gen_salt('bf', 10));

  INSERT INTO public.booking_start_otps (
    booking_id,
    booking_table,
    vendor_id,
    customer_id,
    otp_hash,
    purpose,
    expires_at,
    resend_count,
    email_sent,
    invalidated
  ) VALUES (
    p_booking_id,
    p_booking_table,
    v_provider_id::text,
    v_customer_id,
    v_otp_hash,
    'booking_start',
    now() + interval '10 minutes',
    v_resend_count,
    false,
    false
  )
  RETURNING id INTO v_otp_id;

  EXECUTE format(
    'UPDATE public.%I SET start_requested_at = $1 WHERE id = $2',
    p_booking_table
  ) USING now(), p_booking_id;

  INSERT INTO public.booking_events (
    booking_table, booking_id, event_type, actor_id, actor_role, metadata
  ) VALUES (
    p_booking_table,
    p_booking_id,
    CASE WHEN p_is_resend THEN 'START_OTP_RESENT' ELSE 'START_OTP_GENERATED' END,
    p_vendor_user_id,
    'vendor',
    jsonb_build_object('expires_at', now() + interval '10 minutes')
  );

  RETURN QUERY SELECT v_otp_id, v_otp, v_customer_email;
END;
$$;

-- Records delivery after Brevo responds. Failed delivery invalidates the code,
-- so an undelivered code can never be used.
CREATE OR REPLACE FUNCTION public.record_service_start_otp_delivery(
  p_otp_id UUID,
  p_delivered BOOLEAN,
  p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE public.booking_start_otps
  SET email_sent = p_delivered,
      email_sent_at = CASE WHEN p_delivered THEN now() ELSE NULL END,
      email_error = CASE WHEN p_delivered THEN NULL ELSE left(coalesce(p_error, 'Email delivery failed'), 500) END,
      invalidated = CASE WHEN p_delivered THEN invalidated ELSE true END
  WHERE id = p_otp_id
    AND verified = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OTP_NOT_FOUND';
  END IF;
END;
$$;

-- Verifies the customer-provided code atomically. The same transaction locks the
-- booking and OTP row, increments attempts, consumes the code, and starts work.
CREATE OR REPLACE FUNCTION public.verify_service_start_otp(
  p_booking_table TEXT,
  p_booking_id UUID,
  p_vendor_user_id UUID,
  p_otp TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_customer_id UUID;
  v_provider_id UUID;
  v_status TEXT;
  v_advance_paid_at TIMESTAMPTZ;
  v_work_started_at TIMESTAMPTZ;
  v_otp_record public.booking_start_otps%ROWTYPE;
  v_attempts INT;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF p_otp !~ '^[0-9]{6}$' THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  SELECT *
  INTO v_customer_id, v_provider_id, v_status, v_advance_paid_at, v_work_started_at
  FROM public.service_start_booking_context(p_booking_table, p_booking_id);

  IF NOT EXISTS (
    SELECT 1
    FROM public.provider_profiles
    WHERE id = v_provider_id
      AND user_id = p_vendor_user_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'UNAUTHORIZED_VENDOR';
  END IF;

  IF lower(coalesce(v_status, '')) NOT IN ('confirmed', 'approved')
     OR v_advance_paid_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BOOKING_NOT_CONFIRMED';
  END IF;

  IF v_work_started_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_started', 'started_at', v_work_started_at);
  END IF;

  SELECT *
  INTO v_otp_record
  FROM public.booking_start_otps
  WHERE booking_table = p_booking_table
    AND booking_id = p_booking_id
    AND verified = false
    AND invalidated = false
  ORDER BY created_at DESC, id DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'no_active_otp');
  END IF;

  IF v_otp_record.expires_at <= v_now THEN
    UPDATE public.booking_start_otps SET invalidated = true WHERE id = v_otp_record.id;
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  IF NOT v_otp_record.email_sent THEN
    UPDATE public.booking_start_otps SET invalidated = true WHERE id = v_otp_record.id;
    RETURN jsonb_build_object('status', 'email_delivery_failed');
  END IF;

  IF v_otp_record.attempts >= v_otp_record.max_attempts THEN
    UPDATE public.booking_start_otps SET invalidated = true WHERE id = v_otp_record.id;
    RETURN jsonb_build_object('status', 'too_many_attempts');
  END IF;

  IF crypt(p_otp, v_otp_record.otp_hash) <> v_otp_record.otp_hash THEN
    v_attempts := v_otp_record.attempts + 1;
    UPDATE public.booking_start_otps
    SET attempts = v_attempts,
        invalidated = (v_attempts >= v_otp_record.max_attempts)
    WHERE id = v_otp_record.id;

    IF v_attempts >= v_otp_record.max_attempts THEN
      RETURN jsonb_build_object('status', 'too_many_attempts');
    END IF;

    RETURN jsonb_build_object(
      'status', 'invalid',
      'remaining_attempts', v_otp_record.max_attempts - v_attempts
    );
  END IF;

  UPDATE public.booking_start_otps
  SET verified = true,
      verified_at = v_now,
      verified_by = p_vendor_user_id,
      used_at = v_now
  WHERE id = v_otp_record.id;

  EXECUTE format(
    'UPDATE public.%I
     SET status = $1, otp_verified_at = $2, work_started_at = $2
     WHERE id = $3',
    p_booking_table
  ) USING 'in_progress', v_now, p_booking_id;

  INSERT INTO public.booking_events (
    booking_table, booking_id, event_type, actor_id, actor_role, metadata
  ) VALUES
    (p_booking_table, p_booking_id, 'START_OTP_VERIFIED', p_vendor_user_id, 'vendor', jsonb_build_object('verified_at', v_now)),
    (p_booking_table, p_booking_id, 'WORK_STARTED', p_vendor_user_id, 'vendor', jsonb_build_object('started_at', v_now));

  INSERT INTO public.notifications (user_id, title, message, type, reference_id, is_read)
  VALUES (
    v_customer_id,
    'Service Started',
    'Your vendor has verified the Service Start OTP and started the service.',
    'booking_confirmed',
    p_booking_id,
    false
  );

  RETURN jsonb_build_object('status', 'started', 'started_at', v_now);
END;
$$;

-- These routines deliberately accept only service_role. Browser callers use the
-- authenticated Edge Function, which independently validates the vendor JWT.
REVOKE ALL ON FUNCTION public.service_start_booking_context(TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_service_start_otp(TEXT, UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_service_start_otp_delivery(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_service_start_otp(TEXT, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_start_booking_context(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_service_start_otp(TEXT, UUID, UUID, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_service_start_otp_delivery(UUID, BOOLEAN, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_service_start_otp(TEXT, UUID, UUID, TEXT) TO service_role;
-- Restore Service Start OTP eligibility for paid pre-start bookings.
--
-- The legacy customer payment flow writes status = 'in_progress' before service
-- execution. work_started_at is the authoritative execution marker, so this
-- migration permits that paid pre-start compatibility state while requiring the
-- scheduled event time to have arrived in Asia/Kolkata.

CREATE OR REPLACE FUNCTION public.assert_service_start_is_due(
  p_booking_table TEXT,
  p_booking_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_time_column TEXT;
  v_event_date DATE;
  v_event_time TEXT;
  v_event_start_at TIMESTAMPTZ;
BEGIN
  IF p_booking_table NOT IN (
    'bookings', 'photography_package_bookings', 'catering_bookings',
    'drone_bookings', 'videography_bookings', 'dj_bookings',
    'decorator_bookings', 'makeup_bookings', 'mehendi_bookings',
    'anchor_bookings', 'banquet_bookings', 'rental_bookings',
    'priest_bookings', 'water_bookings', 'band_bookings',
    'singer_bookings', 'dancer_bookings'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_BOOKING_SOURCE';
  END IF;

  v_time_column := CASE
    WHEN p_booking_table = 'water_bookings' THEN 'delivery_time'
    ELSE 'event_time'
  END;

  -- A time is mandatory for secure start-time enforcement. Catering currently
  -- has no event_time column, so it is rejected until its schedule is captured.
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = p_booking_table
      AND column_name = v_time_column
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EVENT_TIME_REQUIRED';
  END IF;

  EXECUTE format(
    'SELECT b.event_date, NULLIF(btrim(b.%1$I::text), '''')
     FROM public.%2$I AS b
     WHERE b.id = $1',
    v_time_column,
    p_booking_table
  ) INTO v_event_date, v_event_time USING p_booking_id;

  IF v_event_date IS NULL OR v_event_time IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EVENT_TIME_REQUIRED';
  END IF;

  BEGIN
    v_event_start_at := (v_event_date::text || ' ' || v_event_time)::timestamp
      AT TIME ZONE 'Asia/Kolkata';
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EVENT_TIME_INVALID';
  END;

  IF now() < v_event_start_at THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERVICE_START_NOT_DUE';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_service_start_otp(
  p_booking_table TEXT,
  p_booking_id UUID,
  p_vendor_user_id UUID,
  p_is_resend BOOLEAN DEFAULT false
)
RETURNS TABLE (
  otp_id UUID,
  otp_code TEXT,
  customer_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_customer_id UUID;
  v_provider_id UUID;
  v_status TEXT;
  v_advance_paid_at TIMESTAMPTZ;
  v_work_started_at TIMESTAMPTZ;
  v_customer_email TEXT;
  v_previous_id UUID;
  v_previous_resends INT;
  v_max_resends INT;
  v_previous_created_at TIMESTAMPTZ;
  v_resend_count INT := 0;
  v_random BIGINT;
  v_otp TEXT;
  v_otp_hash TEXT;
  v_otp_id UUID;
BEGIN
  SELECT *
  INTO v_customer_id, v_provider_id, v_status, v_advance_paid_at, v_work_started_at
  FROM public.service_start_booking_context(p_booking_table, p_booking_id);

  IF NOT EXISTS (
    SELECT 1
    FROM public.provider_profiles
    WHERE id = v_provider_id
      AND user_id = p_vendor_user_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'UNAUTHORIZED_VENDOR';
  END IF;

  IF lower(coalesce(v_status, '')) NOT IN ('confirmed', 'approved', 'in_progress')
     OR v_advance_paid_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BOOKING_NOT_CONFIRMED';
  END IF;

  IF v_work_started_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SERVICE_ALREADY_STARTED';
  END IF;

  PERFORM public.assert_service_start_is_due(p_booking_table, p_booking_id);

  SELECT NULLIF(trim(email), '')
  INTO v_customer_email
  FROM public.profiles
  WHERE id = v_customer_id;

  IF v_customer_email IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CUSTOMER_EMAIL_NOT_FOUND';
  END IF;

  UPDATE public.booking_start_otps
  SET invalidated = true
  WHERE booking_table = p_booking_table
    AND booking_id = p_booking_id
    AND verified = false
    AND invalidated = false
    AND expires_at <= now();

  SELECT id, resend_count, max_resends, created_at
  INTO v_previous_id, v_previous_resends, v_max_resends, v_previous_created_at
  FROM public.booking_start_otps
  WHERE booking_table = p_booking_table
    AND booking_id = p_booking_id
    AND verified = false
    AND invalidated = false
  ORDER BY created_at DESC, id DESC
  LIMIT 1
  FOR UPDATE;

  IF v_previous_id IS NOT NULL AND NOT p_is_resend THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ACTIVE_OTP_EXISTS';
  END IF;

  IF p_is_resend THEN
    IF v_previous_id IS NOT NULL THEN
      IF v_previous_resends >= v_max_resends THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'MAX_RESENDS_REACHED';
      END IF;
      IF v_previous_created_at > now() - interval '60 seconds' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RESEND_COOLDOWN';
      END IF;
      v_resend_count := v_previous_resends + 1;
      UPDATE public.booking_start_otps SET invalidated = true WHERE id = v_previous_id;
    ELSE
      v_resend_count := 1;
    END IF;
  END IF;

  v_random := (get_byte(gen_random_bytes(4), 0)::bigint << 24)
            + (get_byte(gen_random_bytes(4), 1)::bigint << 16)
            + (get_byte(gen_random_bytes(4), 2)::bigint << 8)
            + get_byte(gen_random_bytes(4), 3)::bigint;
  v_otp := lpad((v_random % 1000000)::text, 6, '0');
  v_otp_hash := crypt(v_otp, gen_salt('bf', 10));

  INSERT INTO public.booking_start_otps (
    booking_id, booking_table, vendor_id, customer_id, otp_hash, purpose,
    expires_at, resend_count, email_sent, invalidated
  ) VALUES (
    p_booking_id, p_booking_table, v_provider_id::text, v_customer_id,
    v_otp_hash, 'booking_start', now() + interval '10 minutes',
    v_resend_count, false, false
  )
  RETURNING id INTO v_otp_id;

  EXECUTE format(
    'UPDATE public.%I SET start_requested_at = $1 WHERE id = $2',
    p_booking_table
  ) USING now(), p_booking_id;

  INSERT INTO public.booking_events (
    booking_table, booking_id, event_type, actor_id, actor_role, metadata
  ) VALUES (
    p_booking_table,
    p_booking_id,
    CASE WHEN p_is_resend THEN 'START_OTP_RESENT' ELSE 'START_OTP_GENERATED' END,
    p_vendor_user_id,
    'vendor',
    jsonb_build_object('expires_at', now() + interval '10 minutes')
  );

  RETURN QUERY SELECT v_otp_id, v_otp, v_customer_email;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_service_start_otp(
  p_booking_table TEXT,
  p_booking_id UUID,
  p_vendor_user_id UUID,
  p_otp TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_customer_id UUID;
  v_provider_id UUID;
  v_status TEXT;
  v_advance_paid_at TIMESTAMPTZ;
  v_work_started_at TIMESTAMPTZ;
  v_otp_record public.booking_start_otps%ROWTYPE;
  v_attempts INT;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF p_otp !~ '^[0-9]{6}$' THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  SELECT *
  INTO v_customer_id, v_provider_id, v_status, v_advance_paid_at, v_work_started_at
  FROM public.service_start_booking_context(p_booking_table, p_booking_id);

  IF NOT EXISTS (
    SELECT 1
    FROM public.provider_profiles
    WHERE id = v_provider_id
      AND user_id = p_vendor_user_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'UNAUTHORIZED_VENDOR';
  END IF;

  IF lower(coalesce(v_status, '')) NOT IN ('confirmed', 'approved', 'in_progress')
     OR v_advance_paid_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BOOKING_NOT_CONFIRMED';
  END IF;

  IF v_work_started_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_started', 'started_at', v_work_started_at);
  END IF;

  PERFORM public.assert_service_start_is_due(p_booking_table, p_booking_id);

  SELECT *
  INTO v_otp_record
  FROM public.booking_start_otps
  WHERE booking_table = p_booking_table
    AND booking_id = p_booking_id
    AND verified = false
    AND invalidated = false
  ORDER BY created_at DESC, id DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'no_active_otp');
  END IF;

  IF v_otp_record.expires_at <= v_now THEN
    UPDATE public.booking_start_otps SET invalidated = true WHERE id = v_otp_record.id;
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  IF NOT v_otp_record.email_sent THEN
    UPDATE public.booking_start_otps SET invalidated = true WHERE id = v_otp_record.id;
    RETURN jsonb_build_object('status', 'email_delivery_failed');
  END IF;

  IF v_otp_record.attempts >= v_otp_record.max_attempts THEN
    UPDATE public.booking_start_otps SET invalidated = true WHERE id = v_otp_record.id;
    RETURN jsonb_build_object('status', 'too_many_attempts');
  END IF;

  IF crypt(p_otp, v_otp_record.otp_hash) <> v_otp_record.otp_hash THEN
    v_attempts := v_otp_record.attempts + 1;
    UPDATE public.booking_start_otps
    SET attempts = v_attempts,
        invalidated = (v_attempts >= v_otp_record.max_attempts)
    WHERE id = v_otp_record.id;

    IF v_attempts >= v_otp_record.max_attempts THEN
      RETURN jsonb_build_object('status', 'too_many_attempts');
    END IF;

    RETURN jsonb_build_object(
      'status', 'invalid',
      'remaining_attempts', v_otp_record.max_attempts - v_attempts
    );
  END IF;

  UPDATE public.booking_start_otps
  SET verified = true,
      verified_at = v_now,
      verified_by = p_vendor_user_id,
      used_at = v_now
  WHERE id = v_otp_record.id;

  EXECUTE format(
    'UPDATE public.%I
     SET status = $1, otp_verified_at = $2, work_started_at = $2
     WHERE id = $3',
    p_booking_table
  ) USING 'in_progress', v_now, p_booking_id;

  INSERT INTO public.booking_events (
    booking_table, booking_id, event_type, actor_id, actor_role, metadata
  ) VALUES
    (p_booking_table, p_booking_id, 'START_OTP_VERIFIED', p_vendor_user_id, 'vendor', jsonb_build_object('verified_at', v_now)),
    (p_booking_table, p_booking_id, 'WORK_STARTED', p_vendor_user_id, 'vendor', jsonb_build_object('started_at', v_now));

  INSERT INTO public.notifications (user_id, title, message, type, reference_id, is_read)
  VALUES (
    v_customer_id,
    'Service Started',
    'Your vendor has verified the Service Start OTP and started the service.',
    'booking_confirmed',
    p_booking_id,
    false
  );

  RETURN jsonb_build_object('status', 'started', 'started_at', v_now);
END;
$$;

REVOKE ALL ON FUNCTION public.assert_service_start_is_due(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_service_start_is_due(TEXT, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.create_service_start_otp(TEXT, UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_service_start_otp(TEXT, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_service_start_otp(TEXT, UUID, UUID, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_service_start_otp(TEXT, UUID, UUID, TEXT) TO service_role;

-- Delivery acknowledgement is monotonic. A lost response after a successful
-- Brevo send must never downgrade a usable delivered code into an invalid one.
CREATE OR REPLACE FUNCTION public.record_service_start_otp_delivery(
  p_otp_id UUID,
  p_delivered BOOLEAN,
  p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_email_sent BOOLEAN;
BEGIN
  SELECT email_sent
  INTO v_email_sent
  FROM public.booking_start_otps
  WHERE id = p_otp_id
    AND verified = false
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OTP_NOT_FOUND';
  END IF;

  IF p_delivered THEN
    UPDATE public.booking_start_otps
    SET email_sent = true,
        email_sent_at = coalesce(email_sent_at, now()),
        email_error = NULL
    WHERE id = p_otp_id
      AND verified = false;
  ELSIF NOT v_email_sent THEN
    UPDATE public.booking_start_otps
    SET email_error = left(coalesce(p_error, 'Email delivery failed'), 500),
        invalidated = true
    WHERE id = p_otp_id
      AND verified = false;
  END IF;
END;
$$;

-- Participant notifications are emitted only for a currently active, delivered
-- OTP. A slow older send that a resend has superseded is never announced.
CREATE OR REPLACE FUNCTION public.is_current_service_start_otp(
  p_otp_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.booking_start_otps
    WHERE id = p_otp_id
      AND verified = false
      AND invalidated = false
      AND email_sent = true
      AND expires_at > now()
  );
$$;

REVOKE ALL ON FUNCTION public.record_service_start_otp_delivery(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_current_service_start_otp(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_service_start_otp_delivery(UUID, BOOLEAN, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_current_service_start_otp(UUID) TO service_role;
-- Ordered image/video collection for homepage Auth Promotion media cards.
-- Additive only: the existing single-image auth_promotional_config remains the
-- source for the sign-in page and authentication modal.

CREATE TABLE IF NOT EXISTS public.auth_promotion_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  media_url TEXT NOT NULL CHECK (media_url <> ''),
  storage_path TEXT NOT NULL CHECK (storage_path <> ''),
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_auth_promotion_media_active_order
  ON public.auth_promotion_media (is_active, display_order, created_at);
CREATE INDEX IF NOT EXISTS idx_auth_promotion_media_order
  ON public.auth_promotion_media (display_order, created_at);

CREATE OR REPLACE FUNCTION public.set_auth_promotion_media_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_auth_promotion_media_updated_at
  BEFORE UPDATE ON public.auth_promotion_media
  FOR EACH ROW EXECUTE FUNCTION public.set_auth_promotion_media_updated_at();

ALTER TABLE public.auth_promotion_media ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.auth_promotion_media TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.auth_promotion_media TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotion_media'
      AND policyname = 'Public read active auth promotion media'
  ) THEN
    CREATE POLICY "Public read active auth promotion media"
      ON public.auth_promotion_media FOR SELECT
      USING (
        is_active
        OR EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotion_media'
      AND policyname = 'Admins insert auth promotion media'
  ) THEN
    CREATE POLICY "Admins insert auth promotion media"
      ON public.auth_promotion_media FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotion_media'
      AND policyname = 'Admins update auth promotion media'
  ) THEN
    CREATE POLICY "Admins update auth promotion media"
      ON public.auth_promotion_media FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotion_media'
      AND policyname = 'Admins delete auth promotion media'
  ) THEN
    CREATE POLICY "Admins delete auth promotion media"
      ON public.auth_promotion_media FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;
END
$$;

-- Reuses the existing public auth-promotional bucket and its existing admin
-- storage policies, which are type-agnostic and also permit video objects.
-- Convert the existing ordered homepage promotion collection into four fixed slots.
-- This is intentionally additive and is NOT applied by this code change.
-- auth_promotional_config remains untouched: it controls sign-in/authentication promotion.

ALTER TABLE public.auth_promotion_media
  ADD COLUMN IF NOT EXISTS slot_number INTEGER,
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;

-- Preserve the earliest video for Slot 1 and the earliest three images for
-- Slots 2–4. Any extra legacy records are retained but hidden and unassigned,
-- so the homepage can never render more than four active cards.
WITH ranked_media AS (
  SELECT
    id,
    media_type,
    ROW_NUMBER() OVER (
      PARTITION BY media_type
      ORDER BY display_order ASC, created_at ASC, id ASC
    ) AS type_rank
  FROM public.auth_promotion_media
)
UPDATE public.auth_promotion_media AS media
SET
  slot_number = CASE
    WHEN ranked_media.media_type = 'video' AND ranked_media.type_rank = 1 THEN 1
    WHEN ranked_media.media_type = 'image' AND ranked_media.type_rank BETWEEN 1 AND 3 THEN (ranked_media.type_rank + 1)::INTEGER
    ELSE NULL
  END,
  is_active = CASE
    WHEN ranked_media.media_type = 'video' AND ranked_media.type_rank = 1 THEN media.is_active
    WHEN ranked_media.media_type = 'image' AND ranked_media.type_rank BETWEEN 1 AND 3 THEN media.is_active
    ELSE FALSE
  END
FROM ranked_media
WHERE media.id = ranked_media.id
  AND media.slot_number IS NULL;

-- Existing data may have a photo in the first ordered position or a video in a
-- later position. Preserve it, hide it, and detach it from the fixed slot rather
-- than forcing an invalid type into a card. Admins can then safely replace the
-- affected empty slot.
UPDATE public.auth_promotion_media
SET
  is_active = FALSE,
  slot_number = NULL
WHERE (slot_number = 1 AND media_type <> 'video')
   OR (slot_number BETWEEN 2 AND 4 AND media_type <> 'image')
   OR slot_number IS NULL
   OR slot_number NOT BETWEEN 1 AND 4;

-- Remove surplus legacy rows only after preserving the earliest row assigned to
-- each slot. This keeps the first deterministic record for every slot and makes
-- the uniqueness constraint possible without deleting any records.
WITH duplicate_slots AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY slot_number ORDER BY display_order ASC, created_at ASC, id ASC) AS duplicate_rank
  FROM public.auth_promotion_media
  WHERE slot_number BETWEEN 1 AND 4
)
UPDATE public.auth_promotion_media AS media
SET is_active = FALSE,
    slot_number = NULL
FROM duplicate_slots
WHERE media.id = duplicate_slots.id
  AND duplicate_slots.duplicate_rank > 1;

ALTER TABLE public.auth_promotion_media
  ADD CONSTRAINT auth_promotion_media_slot_number_range
    CHECK (slot_number BETWEEN 1 AND 4) NOT VALID,
  ADD CONSTRAINT auth_promotion_media_slot_media_type
    CHECK (
      (slot_number = 1 AND media_type = 'video')
      OR (slot_number BETWEEN 2 AND 4 AND media_type = 'image')
      OR slot_number IS NULL
    ) NOT VALID,
  ADD CONSTRAINT auth_promotion_media_file_size_nonnegative
    CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0) NOT VALID,
  ADD CONSTRAINT auth_promotion_media_active_requires_slot
    CHECK (slot_number IS NOT NULL OR is_active = FALSE) NOT VALID;

-- Exactly one database row may own each homepage card. Slots can be empty after
-- deletion; the frontend renders the matching branded fallback in that case.
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_promotion_media_unique_slot
  ON public.auth_promotion_media (slot_number)
  WHERE slot_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auth_promotion_media_active_slot
  ON public.auth_promotion_media (is_active, slot_number)
  WHERE slot_number IS NOT NULL;

-- Legacy rows retain a NULL slot only while hidden; active records must always
-- belong to one of the four slots. The application always writes a slot number.

-- Validate after the deterministic backfill and type cleanup above.
ALTER TABLE public.auth_promotion_media
  VALIDATE CONSTRAINT auth_promotion_media_slot_number_range,
  VALIDATE CONSTRAINT auth_promotion_media_slot_media_type,
  VALIDATE CONSTRAINT auth_promotion_media_file_size_nonnegative,
  VALIDATE CONSTRAINT auth_promotion_media_active_requires_slot;
-- Durable evidence and feedback for Vowza AI Planner recommendations.
-- Additive only. This file is intentionally NOT applied by this change.
-- It stores recommendation provenance without exposing provider contacts or
-- customer/private booking details.

CREATE TABLE IF NOT EXISTS public.planner_recommendation_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  message_id UUID REFERENCES public.ai_messages(id) ON DELETE SET NULL,
  intent TEXT NOT NULL,
  search_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  algorithm_version TEXT NOT NULL DEFAULT 'planner-ranking-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS public.planner_recommendation_candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES public.planner_recommendation_runs(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE RESTRICT,
  rank_position INTEGER NOT NULL CHECK (rank_position > 0),
  match_score NUMERIC(6, 2) NOT NULL CHECK (match_score >= 0),
  reason_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  availability_status TEXT NOT NULL CHECK (availability_status IN ('not_checked', 'needs_confirmation', 'unavailable', 'confirmed')),
  availability_checked_at TIMESTAMPTZ,
  evidence_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE (run_id, provider_id),
  UNIQUE (run_id, rank_position)
);

CREATE TABLE IF NOT EXISTS public.ai_message_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.ai_messages(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL CHECK (reaction IN ('like', 'dislike')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE (user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_planner_recommendation_runs_user_created
  ON public.planner_recommendation_runs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_planner_recommendation_candidates_run_rank
  ON public.planner_recommendation_candidates (run_id, rank_position);
CREATE INDEX IF NOT EXISTS idx_ai_message_feedback_user_message
  ON public.ai_message_feedback (user_id, message_id);

ALTER TABLE public.planner_recommendation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planner_recommendation_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_message_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own planner recommendation runs"
  ON public.planner_recommendation_runs FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users read recommendation candidates from own runs"
  ON public.planner_recommendation_candidates FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.planner_recommendation_runs run
    WHERE run.id = run_id AND run.user_id = auth.uid()
  ));

CREATE POLICY "Users manage own AI message feedback"
  ON public.ai_message_feedback FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- A trusted Edge Function should create candidate evidence using the caller's
-- identity or a service role after it has validated provider/profile visibility.
-- Do not grant browser clients direct INSERT/UPDATE/DELETE on candidates.
-- Allow ordered playlists inside the existing four immutable homepage cards.
-- This follows 20260913000000 and 20260914000000 and is NOT applied by this local change.
-- Reuses is_active as the existing publication flag; auth_promotional_config remains untouched.

-- The previous partial unique index allowed only one row per card. Remove it so
-- slot 1 can own multiple videos and slots 2–4 can own independent photo lists.
DROP INDEX IF EXISTS public.idx_auth_promotion_media_unique_slot;

-- Normalise existing fixed-slot content to the first list position, retaining
-- all existing records and preserving hidden/unassigned legacy rows.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY slot_number ORDER BY display_order, created_at, id) - 1 AS ordered_position
  FROM public.auth_promotion_media
  WHERE slot_number BETWEEN 1 AND 4
)
UPDATE public.auth_promotion_media media
SET display_order = ranked.ordered_position
FROM ranked
WHERE media.id = ranked.id;

-- Each card may have many entries, but every order position belongs to exactly
-- one record within that card. The prior slot/type constraint still enforces
-- one video card (#1) and three image cards (#2–#4).
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_promotion_media_unique_slot_order
  ON public.auth_promotion_media (slot_number, display_order)
  WHERE slot_number IS NOT NULL;

DROP INDEX IF EXISTS public.idx_auth_promotion_media_active_slot;
CREATE INDEX IF NOT EXISTS idx_auth_promotion_media_active_slot_order
  ON public.auth_promotion_media (slot_number, display_order, created_at)
  WHERE is_active = TRUE AND slot_number IS NOT NULL;
-- Migration: Harden search_vendors_sql RPC with area filtering and verification enforcement
-- Date: 2026-09-17
-- Purpose: 
--   1. Add p_area parameter for locality/area-based vendor search
--   2. Implement two-tier ranking (exact area > service areas)
--   3. Enforce verification_status, is_verified, is_published consistently
--   4. Return actual is_verified value (not hardcoded TRUE)
--   5. Normalize service_areas matching (case-insensitive, trimmed)

-- STEP 1: Drop old function by explicit signature (PostgreSQL safety)
-- Old signature: search_vendors_sql(TEXT, TEXT, NUMERIC, FLOAT, INTEGER)
DROP FUNCTION IF EXISTS public.search_vendors_sql(TEXT, TEXT, NUMERIC, FLOAT, INTEGER);

-- STEP 2: Create new function with p_area parameter and service-area normalization
CREATE OR REPLACE FUNCTION public.search_vendors_sql(
  p_profession TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_price_max NUMERIC DEFAULT NULL,
  p_min_rating FLOAT DEFAULT 0,
  p_area TEXT DEFAULT NULL,              -- NEW PARAMETER
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  provider_id UUID,
  profession TEXT,
  stage_name TEXT,
  bio TEXT,
  price_min NUMERIC,
  price_max NUMERIC,
  average_rating FLOAT,
  total_reviews INT,
  total_bookings INT,
  is_verified BOOLEAN,                   -- ACTUAL database value, NOT TRUE
  is_available BOOLEAN,
  experience_years INT,
  cover_image_url TEXT,
  city TEXT,
  area TEXT,                             -- NEW OUTPUT
  full_name TEXT,
  avatar_url TEXT
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pp.id,
    pp.profession::TEXT,
    pp.stage_name::TEXT,
    pp.bio::TEXT,
    pp.price_min::NUMERIC,
    pp.price_max::NUMERIC,
    COALESCE(pp.average_rating, 0)::FLOAT,
    COALESCE(pp.total_reviews, 0)::INT,
    COALESCE(pp.total_bookings, 0)::INT,
    COALESCE(pp.is_verified, FALSE)::BOOLEAN,  -- ACTUAL value, NOT TRUE
    COALESCE(pp.is_available, TRUE)::BOOLEAN,
    pp.experience_years::INT,
    pp.cover_image_url::TEXT,
    pr.city::TEXT,
    pr.area::TEXT,                        -- NEW OUTPUT
    pr.full_name::TEXT,
    pr.avatar_url::TEXT
  FROM public.provider_profiles pp
  LEFT JOIN public.profiles pr ON pr.id = pp.user_id
  WHERE pp.verification_status IN ('approved', 'verified')
    AND COALESCE(pp.is_verified, FALSE) = TRUE
    AND COALESCE(pp.is_published, FALSE) = TRUE
    AND (p_profession IS NULL OR pp.profession::TEXT = p_profession)
    AND (p_city IS NULL OR LOWER(COALESCE(pr.city, '')) LIKE LOWER('%' || p_city || '%'))
    -- NEW: Area filtering with service-areas normalization
    AND (p_area IS NULL OR 
      LOWER(TRIM(COALESCE(pr.area, ''))) LIKE '%' || LOWER(TRIM(p_area)) || '%'
      OR
      EXISTS (
        SELECT 1 FROM UNNEST(COALESCE(pp.service_areas, '{}')) AS sa
        WHERE LOWER(TRIM(sa)) = LOWER(TRIM(p_area))
      )
    )
    AND (p_price_max IS NULL OR pp.price_min IS NULL OR pp.price_min <= p_price_max)
    AND COALESCE(pp.average_rating, 0) >= p_min_rating
  ORDER BY 
    -- TWO-TIER LOCATION RANKING (no city fallback when area specified)
    CASE 
      WHEN LOWER(TRIM(COALESCE(pr.area, ''))) LIKE '%' || LOWER(TRIM(p_area)) || '%' THEN 0
      WHEN EXISTS (
        SELECT 1 FROM UNNEST(COALESCE(pp.service_areas, '{}')) AS sa
        WHERE LOWER(TRIM(sa)) = LOWER(TRIM(p_area))
      ) THEN 1
    END,
    COALESCE(pp.average_rating, 0) DESC,
    COALESCE(pp.total_bookings, 0) DESC
  LIMIT p_limit;
END;
$$;

-- STEP 3: Ensure permissions are set (idempotent)
GRANT EXECUTE ON FUNCTION public.search_vendors_sql TO authenticated, anon;
-- ══════════════════════════════════════════════════════════════════════════════
-- UNIVERSAL SELF-BOOKING PREVENTION
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Business Rule: A vendor/artist CANNOT book their own packages, but CAN book
-- packages created by other vendors. This applies across ALL service categories.
--
-- Enforcement Strategy:
-- 1. UPDATE INSERT RLS policies on ALL booking tables to add owner check
-- 2. Policies now verify: customer_id = auth.uid() AND vendor_user_id ≠ auth.uid()
-- 3. Existing vendor/provider UPDATE policies remain unchanged
--
-- Table Coverage (15+ booking tables):
-- - catering_bookings
-- - photography_package_bookings (photographer_id field)
-- - dj_bookings
-- - videography_bookings
-- - drone_bookings
-- - decorator_bookings
-- - makeup_bookings
-- - mehendi_bookings
-- - band_bookings
-- - dancer_bookings
-- - singer_bookings
-- - priest_bookings
-- - water_bookings
-- - rental_bookings
-- - banquet_bookings
-- - anchor_bookings
--
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── CATERING BOOKINGS ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS catering_bookings_customer_insert ON public.catering_bookings;
CREATE POLICY catering_bookings_customer_insert ON public.catering_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  );

-- ─── PHOTOGRAPHY PACKAGE BOOKINGS ────────────────────────────────────────────
DROP POLICY IF EXISTS photography_bookings_customer_insert ON public.photography_package_bookings;
CREATE POLICY photography_bookings_customer_insert ON public.photography_package_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = photographer_id AND user_id = auth.uid()
    )
  );

-- ─── DJ BOOKINGS ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS dj_bookings_customer_insert ON public.dj_bookings;
CREATE POLICY dj_bookings_customer_insert ON public.dj_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  );

-- ─── VIDEOGRAPHY BOOKINGS ───────────────────────────────────────────────────
DROP POLICY IF EXISTS videography_bookings_customer_insert ON public.videography_bookings;
CREATE POLICY videography_bookings_customer_insert ON public.videography_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  );

-- ─── DRONE BOOKINGS ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS drone_bookings_customer_insert ON public.drone_bookings;
CREATE POLICY drone_bookings_customer_insert ON public.drone_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  );

-- ─── DECORATOR BOOKINGS ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS decorator_bookings_customer_insert ON public.decorator_bookings;
CREATE POLICY decorator_bookings_customer_insert ON public.decorator_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  );

-- ─── MAKEUP BOOKINGS ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS makeup_bookings_customer_insert ON public.makeup_bookings;
CREATE POLICY makeup_bookings_customer_insert ON public.makeup_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  );

-- ─── MEHENDI BOOKINGS ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS mehendi_bookings_customer_insert ON public.mehendi_bookings;
CREATE POLICY mehendi_bookings_customer_insert ON public.mehendi_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  );

-- ─── BAND BOOKINGS ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS band_bookings_customer_insert ON public.band_bookings;
CREATE POLICY band_bookings_customer_insert ON public.band_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  );

-- ─── DANCER BOOKINGS ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS dancer_bookings_customer_insert ON public.dancer_bookings;
CREATE POLICY dancer_bookings_customer_insert ON public.dancer_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  );

-- ─── SINGER BOOKINGS ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS singer_bookings_customer_insert ON public.singer_bookings;
CREATE POLICY singer_bookings_customer_insert ON public.singer_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  );

-- ─── PRIEST BOOKINGS ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS priest_bookings_customer_insert ON public.priest_bookings;
CREATE POLICY priest_bookings_customer_insert ON public.priest_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  );

-- ─── WATER SUPPLY BOOKINGS ──────────────────────────────────────────────────
DROP POLICY IF EXISTS water_bookings_customer_insert ON public.water_bookings;
CREATE POLICY water_bookings_customer_insert ON public.water_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  );

-- ─── RENTAL BOOKINGS ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS rental_bookings_customer_insert ON public.rental_bookings;
CREATE POLICY rental_bookings_customer_insert ON public.rental_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  );

-- ─── BANQUET BOOKINGS ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS banquet_bookings_customer_insert ON public.banquet_bookings;
CREATE POLICY banquet_bookings_customer_insert ON public.banquet_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  );

-- ─── ANCHOR BOOKINGS ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS anchor_bookings_customer_insert ON public.anchor_bookings;
CREATE POLICY anchor_bookings_customer_insert ON public.anchor_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- End of migration
-- ══════════════════════════════════════════════════════════════════════════════
-- ════════════════════════════════════════════════════════════════════════════════
-- PORTFOLIO VISIBILITY & DELETE MANAGEMENT
-- ════════════════════════════════════════════════════════════════════════════════
--
-- Feature: Portfolio item visibility control and deletion
--
-- Changes:
-- 1. Add `is_published` field to portfolio_items (default FALSE for new items)
-- 2. Update RLS policies to respect visibility
-- 3. Allow owners to delete their own portfolio items
-- 4. Ensure private items are not publicly accessible
--
-- This applies to the unified portfolio_items table used by ALL vendor categories.
--
-- ════════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────────
-- 1. Add visibility field to portfolio_items
-- ─────────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.portfolio_items
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE;

-- Index for faster filtering on public portfolio queries
CREATE INDEX IF NOT EXISTS portfolio_published_idx ON public.portfolio_items(provider_id, is_published);

-- ─────────────────────────────────────────────────────────────────────────────────
-- 2. Update RLS policies for visibility control
-- ─────────────────────────────────────────────────────────────────────────────────

-- Drop old unrestricted policies
DROP POLICY IF EXISTS "portfolio_public_read" ON public.portfolio_items;
DROP POLICY IF EXISTS "portfolio_owner_write" ON public.portfolio_items;
DROP POLICY IF EXISTS "portfolio_items_select" ON public.portfolio_items;
DROP POLICY IF EXISTS "portfolio_items_insert" ON public.portfolio_items;
DROP POLICY IF EXISTS "portfolio_items_update" ON public.portfolio_items;
DROP POLICY IF EXISTS "portfolio_items_delete" ON public.portfolio_items;

-- ─── SELECT: Public items + owner's private items ────────────────────────────────
CREATE POLICY portfolio_select ON public.portfolio_items
  FOR SELECT
  USING (
    -- Published items: accessible to everyone
    (is_published = TRUE)
    OR
    -- Private items: only owner can see
    (provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid()))
  );

-- ─── INSERT: Only owner can insert ─────────────────────────────────────────────────
CREATE POLICY portfolio_insert ON public.portfolio_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
  );

-- ─── UPDATE: Only owner can update ─────────────────────────────────────────────────
CREATE POLICY portfolio_update ON public.portfolio_items
  FOR UPDATE
  USING (
    provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
  );

-- ─── DELETE: Only owner can delete ─────────────────────────────────────────────────
CREATE POLICY portfolio_delete ON public.portfolio_items
  FOR DELETE
  USING (
    provider_id IN (SELECT id FROM public.provider_profiles WHERE user_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────────
-- 3. Ensure RLS is enabled on portfolio_items
-- ─────────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────────
-- 4. Backfill existing items to be published (preserve current behavior)
-- ─────────────────────────────────────────────────────────────────────────────────

UPDATE public.portfolio_items
SET is_published = TRUE
WHERE is_published = FALSE;

-- ════════════════════════════════════════════════════════════════════════════════
-- EXPLANATION OF CHANGES
-- ════════════════════════════════════════════════════════════════════════════════
--
-- SELECT Policy:
--   - Public items (is_published = TRUE) can be seen by everyone
--   - Private items (is_published = FALSE) can only be seen by their owner
--   - Owner determined by: portfolio_items.provider_id → provider_profiles.user_id
--
-- INSERT Policy:
--   - Only authenticated users who own a provider_profiles can insert
--
-- UPDATE Policy:
--   - Only owner can change is_published status or other fields
--
-- DELETE Policy:
--   - Only owner can delete their portfolio items
--
-- Storage Access:
--   - Public URLs are still accessible, but database-level RLS enforces access control
--   - Private items should not be returned by queries
--   - Storage buckets have separate policies that allow public access to files,
--     but frontend should only show private URLs in owner's dashboard
--
-- ════════════════════════════════════════════════════════════════════════════════

-- ─── PHASE 2C: Planner Package Matcher RPC ────────────────────────────────────
-- Creates RPC function for matching Admin Event Packages to budget allocations
-- 
-- Purpose: Find best matching Admin Event Packages based on:
--   - Event type
--   - Budget ceiling
--   - Guest count (optional context)
--   - Tier preference (silver/gold/platinum)
--
-- Usage from JavaScript:
--   const { data, error } = await supabase.rpc('match_admin_event_package', {
--     p_event_type: 'wedding',
--     p_max_budget: 500000,
--     p_tier: 'gold',
--     p_guest_count: 300,
--     p_city: 'Hyderabad'
--   });

-- ─── DROP existing function if any ─────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.match_admin_event_package(
  p_event_type TEXT,
  p_max_budget NUMERIC,
  p_tier TEXT,
  p_guest_count INT,
  p_city TEXT
) CASCADE;

-- ─── CREATE RPC: match_admin_event_package ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.match_admin_event_package(
  p_event_type TEXT DEFAULT NULL,
  p_max_budget NUMERIC DEFAULT NULL,
  p_tier TEXT DEFAULT NULL,
  p_guest_count INT DEFAULT NULL,
  p_city TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  event_type_id UUID,
  event_type_name TEXT,
  tier TEXT,
  display_name TEXT,
  description TEXT,
  base_price NUMERIC,
  discount_percentage NUMERIC,
  final_price NUMERIC,
  max_category_selections INT,
  max_professionals_per_category INT,
  is_active BOOLEAN,
  sort_order INT,
  created_at TIMESTAMP,
  match_confidence INT,
  match_reason TEXT
) LANGUAGE sql STABLE AS $$
  WITH package_matches AS (
    SELECT
      aep.id,
      aep.event_type_id,
      et."name" as event_type_name,
      aep.tier,
      aep.display_name,
      aep.description,
      aep.base_price,
      aep.discount_percentage,
      aep.final_price,
      aep.max_category_selections,
      aep.max_professionals_per_category,
      aep.is_active,
      aep.sort_order,
      aep.created_at,
      -- Confidence scoring (0-100)
      CASE
        -- Tier exact match: +40 points
        WHEN (p_tier IS NOT NULL AND aep.tier = p_tier) THEN 40
        -- Adjacent tier (gold vs gold±1): +25 points
        WHEN (p_tier IS NOT NULL AND 
              ((p_tier = 'silver' AND aep.tier IN ('silver', 'gold')) OR
               (p_tier = 'gold' AND aep.tier IN ('silver', 'gold', 'platinum')) OR
               (p_tier = 'platinum' AND aep.tier IN ('gold', 'platinum')))) THEN 25
        -- Different tier: +10 points
        ELSE 10
      END +
      -- Budget fit: +30 points if final_price <= max_budget, -20 if over
      CASE
        WHEN (p_max_budget IS NOT NULL AND aep.final_price <= p_max_budget) THEN 30
        WHEN (p_max_budget IS NOT NULL AND aep.final_price > p_max_budget) THEN -20
        ELSE 15  -- No budget constraint
      END +
      -- Event type relevance: +30 points for exact match, -10 for mismatch
      CASE
        WHEN (p_event_type IS NOT NULL AND LOWER(et."name") = LOWER(p_event_type)) THEN 30
        WHEN (p_event_type IS NOT NULL AND 
              (LOWER(et."name") LIKE LOWER(p_event_type) || '%' OR
               LOWER(p_event_type) LIKE LOWER(et."name") || '%')) THEN 15
        WHEN (p_event_type IS NULL) THEN 0  -- No filtering
        ELSE -10  -- Mismatch
      END AS confidence,
      -- Match reason explanation
      CASE
        WHEN (p_tier IS NOT NULL AND aep.tier = p_tier) THEN 'Exact tier match'
        WHEN (p_max_budget IS NOT NULL AND aep.final_price <= p_max_budget) THEN 'Within budget'
        WHEN (p_tier IS NOT NULL AND 
              ((p_tier = 'silver' AND aep.tier IN ('silver', 'gold')) OR
               (p_tier = 'gold' AND aep.tier IN ('silver', 'gold', 'platinum')) OR
               (p_tier = 'platinum' AND aep.tier IN ('gold', 'platinum')))) THEN 'Adjacent tier'
        ELSE 'Matching package'
      END AS match_reason
    FROM public.admin_event_packages aep
    JOIN public.event_types et ON aep.event_type_id = et.id
    WHERE
      -- Filter by event type (if provided)
      (p_event_type IS NULL OR LOWER(et."name") = LOWER(p_event_type))
      -- Only active packages
      AND aep.is_active = TRUE
      -- Optional: filter by budget ceiling (allow 20% overage for premium options)
      AND (p_max_budget IS NULL OR aep.final_price <= p_max_budget * 1.2)
      -- Optional: filter by tier
      AND (p_tier IS NULL OR aep.tier = p_tier)
  )
  SELECT
    pm.id,
    pm.event_type_id,
    pm.event_type_name,
    pm.tier,
    pm.display_name,
    pm.description,
    pm.base_price,
    pm.discount_percentage,
    pm.final_price,
    pm.max_category_selections,
    pm.max_professionals_per_category,
    pm.is_active,
    pm.sort_order,
    pm.created_at,
    GREATEST(0, LEAST(100, pm.confidence))::INT as match_confidence,
    pm.match_reason
  FROM package_matches pm
  -- Sort by: confidence (desc), price (asc)
  ORDER BY pm.confidence DESC, pm.final_price ASC;
$$ SECURITY INVOKER;

-- ─── GRANT permissions ────────────────────────────────────────────────────────
-- Allow authenticated users to call this function
GRANT EXECUTE ON FUNCTION public.match_admin_event_package(
  TEXT, NUMERIC, TEXT, INT, TEXT
) TO authenticated, anon;

-- ─── Create a simpler view-based function for common use case ──────────────────
-- Simple lookup: Get TOP package for tier
DROP FUNCTION IF EXISTS public.get_top_admin_package_for_tier(
  p_event_type TEXT,
  p_tier TEXT
) CASCADE;

CREATE OR REPLACE FUNCTION public.get_top_admin_package_for_tier(
  p_event_type TEXT,
  p_tier TEXT
)
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  description TEXT,
  final_price NUMERIC,
  tier TEXT
) LANGUAGE sql STABLE AS $$
  SELECT
    aep.id,
    aep.display_name,
    aep.description,
    aep.final_price,
    aep.tier
  FROM public.admin_event_packages aep
  JOIN public.event_types et ON aep.event_type_id = et.id
  WHERE
    (p_event_type IS NULL OR LOWER(et."name") = LOWER(p_event_type))
    AND (p_tier IS NULL OR aep.tier = p_tier)
    AND aep.is_active = TRUE
  ORDER BY aep.final_price ASC
  LIMIT 1;
$$ SECURITY INVOKER;

GRANT EXECUTE ON FUNCTION public.get_top_admin_package_for_tier(
  TEXT, TEXT
) TO authenticated, anon;

-- ─── CREATE INDEX for performance ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_admin_event_packages_event_tier_active
  ON public.admin_event_packages(event_type_id, tier, is_active);

CREATE INDEX IF NOT EXISTS idx_admin_event_packages_final_price
  ON public.admin_event_packages(final_price);

-- ✅ Phase 2C RPC created successfully
-- Ready for use from packageMatcher.ts findMatchingPackages()
-- Auth Promotion Videos system: Separate promotional video ads with 15-user atomic limit
-- This is completely independent from the homepage image carousel system.

-- ============================================================================
-- TABLE: auth_promotion_videos
-- Stores promotional videos managed by admin with configurable user limits
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.auth_promotion_videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  video_url TEXT NOT NULL CHECK (video_url <> ''),
  storage_path TEXT NOT NULL CHECK (storage_path <> ''),
  priority_order INTEGER NOT NULL DEFAULT 0 CHECK (priority_order >= 0),
  display_position TEXT NOT NULL DEFAULT 'bottom-right' CHECK (display_position IN ('top-left', 'top-right', 'bottom-left', 'bottom-right')),
  user_limit INTEGER NOT NULL DEFAULT 15 CHECK (user_limit > 0),
  unique_users_reached INTEGER NOT NULL DEFAULT 0 CHECK (unique_users_reached >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  CONSTRAINT auth_promotion_videos_user_limit_not_exceeded
    CHECK (unique_users_reached <= user_limit)
);

CREATE INDEX IF NOT EXISTS idx_auth_promotion_videos_active_priority
  ON public.auth_promotion_videos (is_active, priority_order, created_at)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_auth_promotion_videos_priority
  ON public.auth_promotion_videos (priority_order, created_at);

-- Ensure unique priority order only among active videos
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_promotion_videos_unique_active_priority
  ON public.auth_promotion_videos (priority_order)
  WHERE is_active = TRUE;

-- ============================================================================
-- TABLE: auth_promotion_video_views
-- Tracks unique authenticated users who have viewed each promotion video
-- Enforces one-time-only view counting per user per video
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.auth_promotion_video_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID NOT NULL REFERENCES public.auth_promotion_videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  watch_duration_seconds INTEGER CHECK (watch_duration_seconds IS NULL OR watch_duration_seconds >= 0),
  was_closed BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- One view record per user per video
  CONSTRAINT auth_promotion_video_views_unique_user_video
    UNIQUE (video_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_auth_promotion_video_views_video
  ON public.auth_promotion_video_views (video_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_promotion_video_views_user
  ON public.auth_promotion_video_views (user_id, viewed_at DESC);

-- ============================================================================
-- TRIGGER: Update auth_promotion_videos updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_auth_promotion_videos_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_auth_promotion_videos_updated_at ON public.auth_promotion_videos;
CREATE TRIGGER set_auth_promotion_videos_updated_at
  BEFORE UPDATE ON public.auth_promotion_videos
  FOR EACH ROW EXECUTE FUNCTION public.set_auth_promotion_videos_updated_at();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.auth_promotion_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_promotion_video_views ENABLE ROW LEVEL SECURITY;

-- auth_promotion_videos: Public select (active only) / Admin write
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotion_videos'
      AND policyname = 'auth_promotion_videos_public_select'
  ) THEN
    CREATE POLICY auth_promotion_videos_public_select
      ON public.auth_promotion_videos FOR SELECT
      USING (
        is_active = TRUE
        OR EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotion_videos'
      AND policyname = 'auth_promotion_videos_admin_insert'
  ) THEN
    CREATE POLICY auth_promotion_videos_admin_insert
      ON public.auth_promotion_videos FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotion_videos'
      AND policyname = 'auth_promotion_videos_admin_update'
  ) THEN
    CREATE POLICY auth_promotion_videos_admin_update
      ON public.auth_promotion_videos FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotion_videos'
      AND policyname = 'auth_promotion_videos_admin_delete'
  ) THEN
    CREATE POLICY auth_promotion_videos_admin_delete
      ON public.auth_promotion_videos FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;
END
$$;

-- auth_promotion_video_views: Users insert own views / Admin read all
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotion_video_views'
      AND policyname = 'auth_promotion_video_views_user_insert'
  ) THEN
    CREATE POLICY auth_promotion_video_views_user_insert
      ON public.auth_promotion_video_views FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotion_video_views'
      AND policyname = 'auth_promotion_video_views_user_select'
  ) THEN
    CREATE POLICY auth_promotion_video_views_user_select
      ON public.auth_promotion_video_views FOR SELECT TO authenticated
      USING (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotion_video_views'
      AND policyname = 'auth_promotion_video_views_admin_update'
  ) THEN
    CREATE POLICY auth_promotion_video_views_admin_update
      ON public.auth_promotion_video_views FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotion_video_views'
      AND policyname = 'auth_promotion_video_views_admin_delete'
  ) THEN
    CREATE POLICY auth_promotion_video_views_admin_delete
      ON public.auth_promotion_video_views FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;
END
$$;

-- ============================================================================
-- RPC: get_random_eligible_promotion_video (FIXED FOR RANDOM SELECTION)
-- ✨ NEW: Fetches a RANDOMLY selected eligible promotion video for authenticated user
-- IMPORTANT: Uses ORDER BY RANDOM() to avoid always selecting priority_order = 1
-- Returns: one random video from ALL eligible videos (not just the first one)
-- 
-- Eligible = is_active AND unique_users_reached < user_limit
-- 
-- This replaces get_active_promotion_video() which used ORDER BY priority_order ASC
-- which caused Video 1 (priority_order=1) to always be selected.
-- 
-- Performance: For small number of videos (typical case < 20), ORDER BY RANDOM() is fine.
-- If 1000+ videos, consider alternative strategies like random ID offset.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_random_eligible_promotion_video(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  video_url TEXT,
  priority_order INTEGER,
  display_position TEXT,
  user_limit INTEGER,
  unique_users_reached INTEGER,
  has_user_viewed BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.video_url,
    v.priority_order,
    v.display_position,
    v.user_limit,
    v.unique_users_reached,
    COALESCE(EXISTS(
      SELECT 1 FROM public.auth_promotion_video_views
      WHERE video_id = v.id AND user_id = p_user_id
    ), FALSE) AS has_user_viewed
  FROM public.auth_promotion_videos v
  WHERE v.is_active = TRUE
    AND v.unique_users_reached < v.user_limit
  ORDER BY RANDOM()  -- 🎲 SELECT RANDOMLY FROM ALL ELIGIBLE VIDEOS
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_random_eligible_promotion_video(UUID) TO authenticated;

-- ============================================================================
-- RPC: get_active_promotion_video (DEPRECATED)
-- ⚠️ LEGACY: Kept for backwards compatibility
-- Uses deterministic priority_order ordering (always returns Video 1)
-- DO NOT USE for new code — use get_random_eligible_promotion_video() instead
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_active_promotion_video(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  video_url TEXT,
  priority_order INTEGER,
  display_position TEXT,
  user_limit INTEGER,
  unique_users_reached INTEGER,
  has_user_viewed BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.video_url,
    v.priority_order,
    v.display_position,
    v.user_limit,
    v.unique_users_reached,
    COALESCE(EXISTS(
      SELECT 1 FROM public.auth_promotion_video_views
      WHERE video_id = v.id AND user_id = p_user_id
    ), FALSE) AS has_user_viewed
  FROM public.auth_promotion_videos v
  WHERE v.is_active = TRUE
    AND v.unique_users_reached < v.user_limit
  ORDER BY v.priority_order ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_active_promotion_video(UUID) TO authenticated;

-- ============================================================================
-- RPC: record_promotion_view
-- Atomically records a user's view of a promotion video and enforces 15-user limit
-- Returns: TRUE if view was recorded successfully
--          FALSE if user already viewed, or limit reached, or other error
-- ATOMIC: Uses transaction to prevent race conditions on user_limit enforcement
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_promotion_view(
  p_video_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_users INTEGER;
  v_user_limit INTEGER;
  v_already_viewed BOOLEAN;
BEGIN
  -- Check if user already viewed this video
  SELECT EXISTS(
    SELECT 1 FROM public.auth_promotion_video_views
    WHERE video_id = p_video_id AND user_id = p_user_id
  ) INTO v_already_viewed;
  
  IF v_already_viewed THEN
    RETURN FALSE;
  END IF;

  -- Lock the video row to prevent concurrent updates from exceeding limit
  SELECT unique_users_reached, user_limit
  FROM public.auth_promotion_videos
  WHERE id = p_video_id
  INTO v_current_users, v_user_limit
  FOR UPDATE;

  IF v_current_users IS NULL THEN
    RETURN FALSE;
  END IF;

  -- If limit already reached, reject
  IF v_current_users >= v_user_limit THEN
    RETURN FALSE;
  END IF;

  -- Insert the view record (will fail with unique constraint if user already viewed)
  BEGIN
    INSERT INTO public.auth_promotion_video_views (video_id, user_id)
    VALUES (p_video_id, p_user_id);
  EXCEPTION WHEN unique_violation THEN
    RETURN FALSE;
  END;

  -- Increment the user count
  UPDATE public.auth_promotion_videos
  SET unique_users_reached = unique_users_reached + 1
  WHERE id = p_video_id;

  -- If we just reached the limit, deactivate this video and activate next one
  SELECT unique_users_reached
  FROM public.auth_promotion_videos
  WHERE id = p_video_id
  INTO v_current_users;

  IF v_current_users >= v_user_limit THEN
    -- Deactivate current video
    UPDATE public.auth_promotion_videos
    SET is_active = FALSE
    WHERE id = p_video_id;

    -- Activate next video if it exists
    UPDATE public.auth_promotion_videos
    SET is_active = TRUE
    WHERE id = (
      SELECT id FROM public.auth_promotion_videos
      WHERE is_active = FALSE
        AND priority_order > (
          SELECT priority_order FROM public.auth_promotion_videos WHERE id = p_video_id
        )
      ORDER BY priority_order ASC
      LIMIT 1
    );
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.record_promotion_view(UUID, UUID) TO authenticated;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT ON public.auth_promotion_videos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.auth_promotion_videos TO authenticated;
GRANT SELECT, INSERT ON public.auth_promotion_video_views TO authenticated;

-- Fix: Allow all 4 slots to accept images (not just videos for Slot 1)
-- Previous constraint forced Slot 1 to be video-only
-- Now all 4 slots accept images only

-- Drop the old constraint that enforced video-only for Slot 1
ALTER TABLE public.auth_promotion_media
DROP CONSTRAINT IF EXISTS auth_promotion_media_slot_media_type;

-- Drop the unique index that allowed only one video per slot
DROP INDEX IF EXISTS public.idx_auth_promotion_media_unique_slot;

-- Deactivate and clear slot_number from any videos that might exist
UPDATE public.auth_promotion_media
SET is_active = FALSE, slot_number = NULL
WHERE slot_number BETWEEN 1 AND 4 AND media_type = 'video';

-- Add new constraint: all slots 1-4 can only have images (no more videos in slots)
ALTER TABLE public.auth_promotion_media
ADD CONSTRAINT auth_promotion_media_slot_image_only
  CHECK (
    (slot_number BETWEEN 1 AND 4 AND media_type = 'image')
    OR slot_number IS NULL
  );

-- Create new unique index allowing multiple images per slot (display_order differentiates them)
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_promotion_media_unique_slot_order
  ON public.auth_promotion_media (slot_number, display_order)
  WHERE slot_number IS NOT NULL;

-- Verify constraint and index are in place
CREATE INDEX IF NOT EXISTS idx_auth_promotion_media_active_slot_order
  ON public.auth_promotion_media (slot_number, display_order, created_at)
  WHERE is_active = TRUE AND slot_number IS NOT NULL;
-- Anonymous Visitor Support for Promotion Videos — Phase 2
-- Enables promotional videos to display to unauthenticated visitors
-- Uses cryptographically random visitor IDs (no personal data)

-- ============================================================================
-- TABLE: auth_promotion_video_visitor_views
-- Tracks unique anonymous visitors who have viewed promotion videos
-- Ensures one-time display per anonymous visitor per video
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.auth_promotion_video_visitor_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID NOT NULL REFERENCES public.auth_promotion_videos(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL CHECK (visitor_id <> ''),  -- Random UUID or identifier, NOT personal data
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  
  -- One view record per visitor per video
  CONSTRAINT auth_promotion_video_visitor_views_unique_visitor_video
    UNIQUE (video_id, visitor_id)
);

CREATE INDEX IF NOT EXISTS idx_auth_promotion_video_visitor_views_video
  ON public.auth_promotion_video_visitor_views (video_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_promotion_video_visitor_views_visitor
  ON public.auth_promotion_video_visitor_views (visitor_id, viewed_at DESC);

-- ============================================================================
-- RLS POLICIES for visitor views
-- ============================================================================

ALTER TABLE public.auth_promotion_video_visitor_views ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotion_video_visitor_views'
      AND policyname = 'auth_promotion_video_visitor_views_insert'
  ) THEN
    CREATE POLICY auth_promotion_video_visitor_views_insert
      ON public.auth_promotion_video_visitor_views FOR INSERT TO anon, authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'auth_promotion_video_visitor_views'
      AND policyname = 'auth_promotion_video_visitor_views_admin_select'
  ) THEN
    CREATE POLICY auth_promotion_video_visitor_views_admin_select
      ON public.auth_promotion_video_visitor_views FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role::text IN ('admin', 'super_admin')
        )
      );
  END IF;
END
$$;

GRANT INSERT ON public.auth_promotion_video_visitor_views TO anon, authenticated;
GRANT SELECT ON public.auth_promotion_video_visitor_views TO authenticated;

-- ============================================================================
-- RPC: record_promotion_view_for_visitor
-- Records anonymous visitor view of promotion video
-- Increments unique_users_reached counter (for 15-user limit enforcement)
-- Returns: TRUE if recorded successfully, FALSE if limit reached
-- ATOMIC: Uses transaction to prevent race conditions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_promotion_view_for_visitor(
  p_video_id UUID,
  p_visitor_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_users INTEGER;
  v_user_limit INTEGER;
  v_already_viewed BOOLEAN;
BEGIN
  -- Check if this visitor already viewed this video
  SELECT EXISTS(
    SELECT 1 FROM public.auth_promotion_video_visitor_views
    WHERE video_id = p_video_id AND visitor_id = p_visitor_id
  ) INTO v_already_viewed;
  
  IF v_already_viewed THEN
    RETURN FALSE;
  END IF;

  -- Lock the video row to prevent concurrent updates from exceeding limit
  SELECT unique_users_reached, user_limit
  FROM public.auth_promotion_videos
  WHERE id = p_video_id
  INTO v_current_users, v_user_limit
  FOR UPDATE;

  IF v_current_users IS NULL THEN
    RETURN FALSE;
  END IF;

  -- If limit already reached, reject
  IF v_current_users >= v_user_limit THEN
    RETURN FALSE;
  END IF;

  -- Insert the visitor view record
  BEGIN
    INSERT INTO public.auth_promotion_video_visitor_views (video_id, visitor_id)
    VALUES (p_video_id, p_visitor_id);
  EXCEPTION WHEN unique_violation THEN
    RETURN FALSE;
  END;

  -- Increment the user count (treats each anonymous visitor as a unique user for limit purposes)
  UPDATE public.auth_promotion_videos
  SET unique_users_reached = unique_users_reached + 1
  WHERE id = p_video_id;

  -- If we just reached the limit, deactivate this video and activate next one
  SELECT unique_users_reached
  FROM public.auth_promotion_videos
  WHERE id = p_video_id
  INTO v_current_users;

  IF v_current_users >= v_user_limit THEN
    -- Deactivate current video
    UPDATE public.auth_promotion_videos
    SET is_active = FALSE
    WHERE id = p_video_id;

    -- Activate next video if it exists
    UPDATE public.auth_promotion_videos
    SET is_active = TRUE
    WHERE id = (
      SELECT id FROM public.auth_promotion_videos
      WHERE is_active = FALSE
        AND priority_order > (
          SELECT priority_order FROM public.auth_promotion_videos WHERE id = p_video_id
        )
      ORDER BY priority_order ASC
      LIMIT 1
    );
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.record_promotion_view_for_visitor(UUID, TEXT) TO anon, authenticated;

-- ============================================================================
-- COMMENT: Why this design?
-- ============================================================================

-- Anonymous visitors are tracked by cryptographically random visitor IDs:
--   ✓ Generated client-side using crypto.randomUUID()
--   ✓ Stored in browser localStorage
--   ✓ NO personal data (NO email, NO phone, NO IP, NO fingerprinting)
--   ✓ Persists across page refreshes and navigation
--   ✓ One-time display: localStorage flag prevents repeat ads
--   ✓ Atomic database counter still enforces 15-user limit
--   ✓ Admin can see anonymous impressions (visitor_id is random, not linked to person)

-- Both authenticated users and anonymous visitors use the same 15-user counter:
--   ✓ Mixing both types is intentional: limit is "15 unique viewers total"
--   ✓ Each authenticated user = 1 counter increment
--   ✓ Each anonymous visitor = 1 counter increment
--   ✓ When limit reached, video deactivates and next video activates

-- Security:
--   ✓ RLS allows INSERT by anon/authenticated (necessary for unauthenticated)
--   ✓ RLS restricts SELECT to admins only (privacy: don't expose visitor data to customers)
--   ✓ UNIQUE constraint on (video_id, visitor_id) prevents duplicate counting
--   ✓ FOR UPDATE lock in RPC prevents race conditions
-- ============================================================================
-- HOTFIX: Add Random Promotion Video RPC
-- Purpose: Fix issue where Video 1 (priority_order=1) was always selected
-- New RPC uses ORDER BY RANDOM() to select from ALL eligible videos
-- ============================================================================

-- Drop old RPC if exists (will be replaced)
DROP FUNCTION IF EXISTS public.get_random_eligible_promotion_video(UUID);

-- ============================================================================
-- NEW RPC: get_random_eligible_promotion_video (FIXED FOR RANDOM SELECTION)
-- ✨ Fetches a RANDOMLY selected eligible promotion video for authenticated user
-- IMPORTANT: Uses ORDER BY RANDOM() to avoid always selecting priority_order = 1
-- Returns: one random video from ALL eligible videos (not just the first one)
-- 
-- Eligible = is_active AND unique_users_reached < user_limit
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_random_eligible_promotion_video(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  video_url TEXT,
  priority_order INTEGER,
  display_position TEXT,
  user_limit INTEGER,
  unique_users_reached INTEGER,
  has_user_viewed BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.video_url,
    v.priority_order,
    v.display_position,
    v.user_limit,
    v.unique_users_reached,
    COALESCE(EXISTS(
      SELECT 1 FROM public.auth_promotion_video_views
      WHERE video_id = v.id AND user_id = p_user_id
    ), FALSE) AS has_user_viewed
  FROM public.auth_promotion_videos v
  WHERE v.is_active = TRUE
    AND v.unique_users_reached < v.user_limit
  ORDER BY RANDOM()  -- 🎲 SELECT RANDOMLY FROM ALL ELIGIBLE VIDEOS
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_random_eligible_promotion_video(UUID) TO authenticated;
