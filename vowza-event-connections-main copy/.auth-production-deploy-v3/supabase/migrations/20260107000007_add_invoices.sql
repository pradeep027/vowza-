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
