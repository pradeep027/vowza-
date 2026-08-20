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
