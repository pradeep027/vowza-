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
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;