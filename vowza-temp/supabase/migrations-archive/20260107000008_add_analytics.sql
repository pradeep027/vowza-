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
