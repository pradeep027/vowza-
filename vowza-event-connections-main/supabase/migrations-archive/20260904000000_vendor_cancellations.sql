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
