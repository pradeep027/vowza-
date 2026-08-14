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
