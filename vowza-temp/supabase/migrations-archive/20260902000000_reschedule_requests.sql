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
