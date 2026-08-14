-- ============================================
-- VOWZA COMPLETE PRODUCTION SETUP
-- Comprehensive database and storage configuration
-- ============================================
--
-- EXECUTION INSTRUCTIONS:
-- 1. Go to https://supabase.com/dashboard
-- 2. Select your project
-- 3. Go to SQL Editor
-- 4. Copy this entire script
-- 5. Paste and click "Run"
-- 
-- This script will:
-- - Add missing columns to existing tables
-- - Create missing tables
-- - Create all required storage buckets
-- - Set up comprehensive RLS policies
-- - Create indexes for performance
-- ============================================

-- ============================================
-- PART 1: UPDATE EXISTING TABLES
-- ============================================

-- Update profiles table with missing columns
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS organization_name TEXT,
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS alternate_phone TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS sms_notifications_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS push_notifications_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS profile_completion_percentage INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS account_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Update provider_profiles table with missing columns
ALTER TABLE public.provider_profiles
ADD COLUMN IF NOT EXISTS gst_number TEXT,
ADD COLUMN IF NOT EXISTS instagram TEXT,
ADD COLUMN IF NOT EXISTS facebook TEXT,
ADD COLUMN IF NOT EXISTS youtube TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS cover_banner_url TEXT,
ADD COLUMN IF NOT EXISTS travel_charges INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_charges INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS available_dates DATE[],
ADD COLUMN IF NOT EXISTS bank_account_holder TEXT,
ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
ADD COLUMN IF NOT EXISTS bank_ifsc TEXT,
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS branch_name TEXT,
ADD COLUMN IF NOT EXISTS is_bank_verified BOOLEAN DEFAULT FALSE;

-- ============================================
-- PART 2: CREATE MISSING TABLES
-- ============================================

-- Create wallet table
CREATE TABLE IF NOT EXISTS public.wallet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC(10,2) DEFAULT 0.00,
  total_earned NUMERIC(10,2) DEFAULT 0.00,
  total_withdrawn NUMERIC(10,2) DEFAULT 0.00,
  currency TEXT DEFAULT 'INR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- Create withdrawals table
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected', 'failed')),
  bank_account_holder TEXT NOT NULL,
  bank_account_number TEXT NOT NULL,
  bank_ifsc TEXT NOT NULL,
  bank_name TEXT,
  branch_name TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  transaction_id TEXT
);

-- Create gallery table
CREATE TABLE IF NOT EXISTS public.gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  thumbnail_url TEXT,
  title TEXT,
  description TEXT,
  is_public BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create verification_requests table
CREATE TABLE IF NOT EXISTS public.verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('identity', 'profile', 'portfolio', 'bank')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')),
  documents JSONB DEFAULT '[]'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  notes TEXT
);

-- Create admin_logs table
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create chat table
CREATE TABLE IF NOT EXISTS public.chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  participant_1 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_2 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (booking_id)
);

-- Create booking_requests table (separate from bookings for request flow)
CREATE TABLE IF NOT EXISTS public.booking_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  event_time TEXT,
  event_duration_hours INTEGER,
  event_type TEXT,
  venue_address TEXT NOT NULL,
  venue_city TEXT NOT NULL,
  venue_area TEXT,
  requirements TEXT,
  proposed_amount NUMERIC(10,2),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'negotiating', 'expired')),
  customer_notes TEXT,
  provider_notes TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create services table
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  duration_hours INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create categories table (separate from event_types)
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- PART 3: CREATE INDEXES
-- ============================================

-- Profiles table indexes
CREATE INDEX IF NOT EXISTS idx_profiles_state ON public.profiles(state);
CREATE INDEX IF NOT EXISTS idx_profiles_city ON public.profiles(city);
CREATE INDEX IF NOT EXISTS idx_profiles_area ON public.profiles(area);
CREATE INDEX IF NOT EXISTS idx_profiles_phone_verified ON public.profiles(phone_verified);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON public.profiles(last_active_at DESC);

-- Provider profiles indexes
CREATE INDEX IF NOT EXISTS idx_provider_profession ON public.provider_profiles(profession);
CREATE INDEX IF NOT EXISTS idx_provider_is_verified ON public.provider_profiles(is_verified);
CREATE INDEX IF NOT EXISTS idx_provider_is_available ON public.provider_profiles(is_available);
CREATE INDEX IF NOT EXISTS idx_provider_price_range ON public.provider_profiles(price_min, price_max);

-- Bookings indexes
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON public.bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_provider_id ON public.bookings(provider_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_event_date ON public.bookings(event_date);

-- Wallet indexes
CREATE INDEX IF NOT EXISTS idx_wallet_user_id ON public.wallet(user_id);

-- Withdrawals indexes
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON public.withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals(status);

-- Gallery indexes
CREATE INDEX IF NOT EXISTS idx_gallery_user_id ON public.gallery(user_id);
CREATE INDEX IF NOT EXISTS idx_gallery_is_public ON public.gallery(is_public);

-- Chat indexes
CREATE INDEX IF NOT EXISTS idx_chat_participant_1 ON public.chat(participant_1);
CREATE INDEX IF NOT EXISTS idx_chat_participant_2 ON public.chat(participant_2);
CREATE INDEX IF NOT EXISTS idx_chat_booking_id ON public.chat(booking_id);

-- Booking requests indexes
CREATE INDEX IF NOT EXISTS idx_booking_requests_customer_id ON public.booking_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_booking_requests_provider_id ON public.booking_requests(provider_id);
CREATE INDEX IF NOT EXISTS idx_booking_requests_status ON public.booking_requests(status);

-- ============================================
-- PART 4: STORAGE BUCKETS SETUP
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

-- ============================================
-- PART 5: STORAGE POLICIES
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

-- ============================================
-- PART 6: RLS POLICIES FOR NEW TABLES
-- ============================================

-- Enable RLS on new tables
ALTER TABLE public.wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Wallet RLS policies
CREATE POLICY "Users can view their own wallet"
ON public.wallet FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own wallet"
ON public.wallet FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own wallet"
ON public.wallet FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Withdrawals RLS policies
CREATE POLICY "Users can view their own withdrawals"
ON public.withdrawals FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own withdrawals"
ON public.withdrawals FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all withdrawals"
ON public.withdrawals FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can update withdrawals"
ON public.withdrawals FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Gallery RLS policies
CREATE POLICY "Public can view public gallery items"
ON public.gallery FOR SELECT
TO public
USING (is_public = true);

CREATE POLICY "Users can view their own gallery"
ON public.gallery FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own gallery items"
ON public.gallery FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own gallery items"
ON public.gallery FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own gallery items"
ON public.gallery FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Verification requests RLS policies
CREATE POLICY "Users can view their own verification requests"
ON public.verification_requests FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own verification requests"
ON public.verification_requests FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all verification requests"
ON public.verification_requests FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can update verification requests"
ON public.verification_requests FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Admin logs RLS policies
CREATE POLICY "Admins can view admin logs"
ON public.admin_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can insert admin logs"
ON public.admin_logs FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Chat RLS policies
CREATE POLICY "Chat participants can view their chats"
ON public.chat FOR SELECT
TO authenticated
USING (
  participant_1 = auth.uid() OR
  participant_2 = auth.uid()
);

CREATE POLICY "Users can insert their own chats"
ON public.chat FOR INSERT
TO authenticated
WITH CHECK (
  participant_1 = auth.uid() OR
  participant_2 = auth.uid()
);

CREATE POLICY "Chat participants can update their chats"
ON public.chat FOR UPDATE
TO authenticated
USING (
  participant_1 = auth.uid() OR
  participant_2 = auth.uid()
);

-- Booking requests RLS policies
CREATE POLICY "Users can view their own booking requests"
ON public.booking_requests FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.provider_profiles
    WHERE id = provider_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Customers can insert booking requests"
ON public.booking_requests FOR INSERT
TO authenticated
WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Providers can update booking requests"
ON public.booking_requests FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.provider_profiles
    WHERE id = provider_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Customers can update their booking requests"
ON public.booking_requests FOR UPDATE
TO authenticated
USING (customer_id = auth.uid());

-- Services RLS policies
CREATE POLICY "Public can view active services"
ON public.services FOR SELECT
TO public
USING (is_active = true);

CREATE POLICY "Providers can view their own services"
ON public.services FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.provider_profiles
    WHERE id = provider_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Providers can insert their own services"
ON public.services FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.provider_profiles
    WHERE id = provider_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Providers can update their own services"
ON public.services FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.provider_profiles
    WHERE id = provider_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Providers can delete their own services"
ON public.services FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.provider_profiles
    WHERE id = provider_id AND user_id = auth.uid()
  )
);

-- Categories RLS policies
CREATE POLICY "Public can view active categories"
ON public.categories FOR SELECT
TO public
USING (is_active = true);

CREATE POLICY "Admins can view all categories"
ON public.categories FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can insert categories"
ON public.categories FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can update categories"
ON public.categories FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can delete categories"
ON public.categories FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- ============================================
-- PART 7: VERIFICATION QUERIES
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
