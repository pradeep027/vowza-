-- ─── Add Mission and Vision columns to about_us table ───────────────────────
-- Extends the About Us feature to include Mission and Vision sections
-- Date: 2026-09-29

-- Add mission and vision columns to about_us table
ALTER TABLE public.about_us
  ADD COLUMN IF NOT EXISTS mission TEXT NOT NULL DEFAULT 'Our mission is to make event planning simple and accessible for everyone.',
  ADD COLUMN IF NOT EXISTS vision TEXT NOT NULL DEFAULT 'To become the most trusted event services platform in India.';

-- Note: Existing rows will receive the default values
-- Admin can edit these via the AboutVowzaEditor component
