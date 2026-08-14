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
