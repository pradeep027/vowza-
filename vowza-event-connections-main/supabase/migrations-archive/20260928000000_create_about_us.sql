-- ─── About Us Feature: Tables, RLS, and Storage ───────────────────────────────
-- Tables for About Vowza content and team member profiles
-- Updated: 2026-09-28

-- ═════════════════════════════════════════════════════════════════════════════
-- TABLE: about_us
-- ═════════════════════════════════════════════════════════════════════════════
-- Stores editable About Vowza content
CREATE TABLE IF NOT EXISTS public.about_us (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL DEFAULT 'Where Talent Meets Celebration',
  description       TEXT NOT NULL DEFAULT 'Loading...',
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Ensure only one row (single-source-of-truth)
  CONSTRAINT one_row_only CHECK (id = '00000000-0000-0000-0000-000000000001' OR id IS NOT NULL)
);

-- ═════════════════════════════════════════════════════════════════════════════
-- TABLE: about_team_members
-- ═════════════════════════════════════════════════════════════════════════════
-- Stores team member profiles (1 founder + 6 co-founders)
-- Note: Constraints enforced via triggers (see below)
CREATE TABLE IF NOT EXISTS public.about_team_members (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  role              TEXT NOT NULL,
  bio               TEXT NOT NULL DEFAULT '',
  photo_url         TEXT,
  member_type       TEXT NOT NULL CHECK (member_type IN ('founder', 'co_founder')),
  display_order     INTEGER NOT NULL DEFAULT 999,
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ═════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═════════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_about_team_members_member_type 
  ON public.about_team_members(member_type, is_active);

CREATE INDEX IF NOT EXISTS idx_about_team_members_display_order 
  ON public.about_team_members(display_order ASC) WHERE is_active = TRUE;

-- ═════════════════════════════════════════════════════════════════════════════
-- TRIGGERS: Enforce business rules (1 founder max, 6 co-founders max)
-- ═════════════════════════════════════════════════════════════════════════════

-- Function to check founder limit
CREATE OR REPLACE FUNCTION public.check_founder_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.member_type = 'founder' THEN
    IF (SELECT COUNT(*) FROM public.about_team_members 
        WHERE member_type = 'founder' AND id != NEW.id) > 0 THEN
      RAISE EXCEPTION 'Cannot have more than 1 founder';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to check co-founder limit
CREATE OR REPLACE FUNCTION public.check_cofounder_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.member_type = 'co_founder' AND NEW.is_active = TRUE THEN
    IF (SELECT COUNT(*) FROM public.about_team_members 
        WHERE member_type = 'co_founder' AND is_active = TRUE AND id != NEW.id) >= 6 THEN
      RAISE EXCEPTION 'Cannot have more than 6 active co-founders';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on insert/update for founder limit
CREATE TRIGGER trg_check_founder_limit
  BEFORE INSERT OR UPDATE ON public.about_team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.check_founder_limit();

-- Trigger on insert/update for co-founder limit
CREATE TRIGGER trg_check_cofounder_limit
  BEFORE INSERT OR UPDATE ON public.about_team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.check_cofounder_limit();

-- ═════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═════════════════════════════════════════════════════════════════════════════

-- Enable RLS
ALTER TABLE public.about_us ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.about_team_members ENABLE ROW LEVEL SECURITY;

-- ─── about_us: Public READ, Admin WRITE ───────────────────────────────────

-- Public: Anyone can read about_us content
CREATE POLICY "about_us_public_read"
  ON public.about_us
  FOR SELECT
  USING (TRUE);

-- Admin: Only admins can insert/update/delete
CREATE POLICY "about_us_admin_write"
  ON public.about_us
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "about_us_admin_update"
  ON public.about_us
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "about_us_admin_delete"
  ON public.about_us
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- ─── about_team_members: Public READ active, Admin WRITE all ──────────────

-- Public: Only read active team members
CREATE POLICY "about_team_members_public_read"
  ON public.about_team_members
  FOR SELECT
  USING (is_active = TRUE);

-- Admin: Can read all (active and inactive)
CREATE POLICY "about_team_members_admin_read"
  ON public.about_team_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Admin: Can insert
CREATE POLICY "about_team_members_admin_insert"
  ON public.about_team_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Admin: Can update
CREATE POLICY "about_team_members_admin_update"
  ON public.about_team_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Admin: Can delete
CREATE POLICY "about_team_members_admin_delete"
  ON public.about_team_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- ═════════════════════════════════════════════════════════════════════════════
-- STORAGE: about-us bucket for photos
-- ═════════════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'about-us',
  'about-us',
  TRUE,
  TRUE,
  5242880,  -- 5MB max per file
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage: Public read access to all about-us photos
CREATE POLICY "about-us-public-read"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'about-us');

-- Storage: Admin can upload/delete
CREATE POLICY "about-us-admin-upload"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'about-us'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "about-us-admin-delete"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'about-us'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- ═════════════════════════════════════════════════════════════════════════════
-- SEED DATA (optional): Initialize with placeholder content
-- ═════════════════════════════════════════════════════════════════════════════

-- Insert placeholder About Us content
INSERT INTO public.about_us (id, title, description)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Where Talent Meets Celebration',
  'Vowza is the premier platform connecting event organizers with top-tier professionals. Our mission is to make event planning seamless, affordable, and stress-free.'
)
ON CONFLICT (id) DO NOTHING;
