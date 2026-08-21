-- ─── About Us Feature Upgrade: LinkedIn URLs and Co-Founder Limit Increase ──
-- Adds linkedin_url column and increases co-founder limit from 6 to 8
-- Date: 2026-08-21

-- ═════════════════════════════════════════════════════════════════════════════
-- ADD LINKEDIN_URL COLUMN TO about_team_members
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.about_team_members 
ADD COLUMN IF NOT EXISTS linkedin_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.about_team_members.linkedin_url IS 'Optional LinkedIn profile URL (e.g., https://www.linkedin.com/in/username)';

-- ═════════════════════════════════════════════════════════════════════════════
-- ADD MISSION AND VISION COLUMNS TO about_us (if not already present)
-- ═════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.about_us 
ADD COLUMN IF NOT EXISTS mission TEXT DEFAULT 'To revolutionize event planning through AI-powered, smart, and seamless solutions.';

ALTER TABLE public.about_us 
ADD COLUMN IF NOT EXISTS vision TEXT DEFAULT 'To become India''s most trusted AI-powered event planning ecosystem.';

-- ═════════════════════════════════════════════════════════════════════════════
-- UPDATE CO-FOUNDER LIMIT TRIGGER: 6 → 8
-- ═════════════════════════════════════════════════════════════════════════════

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trg_check_cofounder_limit ON public.about_team_members;
DROP FUNCTION IF EXISTS public.check_cofounder_limit();

-- Create new function with increased limit
CREATE OR REPLACE FUNCTION public.check_cofounder_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.member_type = 'co_founder' AND NEW.is_active = TRUE THEN
    IF (SELECT COUNT(*) FROM public.about_team_members 
        WHERE member_type = 'co_founder' AND is_active = TRUE AND id != NEW.id) >= 8 THEN
      RAISE EXCEPTION 'Cannot have more than 8 active co-founders';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER trg_check_cofounder_limit
  BEFORE INSERT OR UPDATE ON public.about_team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.check_cofounder_limit();

-- ═════════════════════════════════════════════════════════════════════════════
-- VERIFICATION: Log that migration completed
-- ═════════════════════════════════════════════════════════════════════════════

-- No direct logging in migration, but this ensures the change is applied
-- Migration Status: ✓ linkedin_url column added
--                    ✓ mission and vision columns ensured in about_us
--                    ✓ co-founder limit increased to 8
