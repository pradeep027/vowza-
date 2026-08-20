-- ============================================================
-- Booking Availability & Calendar System
-- Run this AFTER VOWZA_PRODUCTION_MIGRATION.sql
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ─── Ensure required columns exist ───────────────────────────────────────────
ALTER TABLE public.provider_availability
  ADD COLUMN IF NOT EXISTS slot_type TEXT DEFAULT 'unavailable'
    CHECK (slot_type IN ('available', 'unavailable', 'busy')),
  ADD COLUMN IF NOT EXISTS time_slot_start TIME,
  ADD COLUMN IF NOT EXISTS time_slot_end   TIME,
  ADD COLUMN IF NOT EXISTS reason          TEXT;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS event_time          TIME,
  ADD COLUMN IF NOT EXISTS event_duration_hours INTEGER DEFAULT 4;

-- ─── Performance indexes ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bookings_provider_date
  ON public.bookings (provider_id, event_date);

CREATE INDEX IF NOT EXISTS idx_bookings_provider_date_status
  ON public.bookings (provider_id, event_date, status);

CREATE INDEX IF NOT EXISTS idx_provider_availability_lookup
  ON public.provider_availability (provider_id, unavailable_date, slot_type);

-- ─── AI Conversations tables ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT 'New Conversation',
  context_summary JSONB DEFAULT '{}',
  last_active_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  ai_response     JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_active
  ON public.ai_conversations (user_id, last_active_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conv_created
  ON public.ai_messages (conversation_id, created_at ASC);

-- RLS for AI tables
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_conversations_owner" ON public.ai_conversations;
CREATE POLICY "ai_conversations_owner" ON public.ai_conversations
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_messages_owner" ON public.ai_messages;
CREATE POLICY "ai_messages_owner" ON public.ai_messages
  FOR ALL USING (auth.uid() = user_id);

-- ─── Fix provider_availability RLS — add UPDATE + DELETE for providers ────────
DROP POLICY IF EXISTS "Providers can manage own availability" ON public.provider_availability;
CREATE POLICY "Providers can manage own availability"
  ON public.provider_availability
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.provider_profiles
      WHERE id = provider_id AND user_id = auth.uid()
    )
  );

-- Keep public read access
DROP POLICY IF EXISTS "Availability is viewable by everyone" ON public.provider_availability;
CREATE POLICY "Availability is viewable by everyone"
  ON public.provider_availability FOR SELECT USING (true);

-- ─── check_artist_availability function ───────────────────────────────────────
-- Uses advisory lock to safely handle concurrent booking requests.
-- Returns: { available: boolean, reason: text }

CREATE OR REPLACE FUNCTION public.check_artist_availability(
  p_provider_id    UUID,
  p_event_date     DATE,
  p_event_time     TIME    DEFAULT NULL,
  p_duration_hours INTEGER DEFAULT 4
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blocked INTEGER;
  v_count   INTEGER;
  v_conflict BOOLEAN := FALSE;
  v_lock    BIGINT;
BEGIN
  -- Acquire per-provider-per-date advisory lock (prevents concurrent double bookings)
  v_lock := ('x' || md5(p_provider_id::TEXT || p_event_date::TEXT))::BIT(64)::BIGINT;
  PERFORM pg_advisory_xact_lock(v_lock);

  -- 1. Past date check
  IF p_event_date < CURRENT_DATE THEN
    RETURN jsonb_build_object('available', FALSE, 'reason', 'This date is in the past');
  END IF;

  -- 2. Blocked date check
  SELECT COUNT(*) INTO v_blocked
  FROM public.provider_availability
  WHERE provider_id    = p_provider_id
    AND unavailable_date = p_event_date
    AND slot_type      = 'unavailable';

  IF v_blocked > 0 THEN
    RETURN jsonb_build_object('available', FALSE, 'reason', 'Artist has marked this date as unavailable');
  END IF;

  -- 3. Existing booking check
  IF p_event_time IS NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM public.bookings
    WHERE provider_id = p_provider_id
      AND event_date  = p_event_date
      AND status IN ('requested', 'accepted', 'in_progress');

    IF v_count > 0 THEN
      RETURN jsonb_build_object(
        'available', FALSE,
        'reason', 'Artist already has ' || v_count || ' booking(s) on this date. Please select another date.'
      );
    END IF;
  ELSE
    -- Time overlap check
    SELECT EXISTS (
      SELECT 1 FROM public.bookings
      WHERE provider_id = p_provider_id
        AND event_date  = p_event_date
        AND status IN ('requested', 'accepted', 'in_progress')
        AND event_time IS NOT NULL
        AND p_event_time < (event_time + (COALESCE(event_duration_hours, 4) * INTERVAL '1 hour'))
        AND (p_event_time + (p_duration_hours * INTERVAL '1 hour')) > event_time
    ) INTO v_conflict;

    IF v_conflict THEN
      RETURN jsonb_build_object(
        'available', FALSE,
        'reason', 'Artist is already booked during this time slot. Please choose a different time.'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('available', TRUE, 'reason', NULL);
END;
$$;

-- ─── get_nearest_available_dates function ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_nearest_available_dates(
  p_provider_id UUID,
  p_after_date  DATE,
  p_count       INTEGER DEFAULT 3
)
RETURNS DATE[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result DATE[] := '{}';
  v_check  DATE   := p_after_date + 1;
  v_avail  JSONB;
  v_iter   INTEGER := 0;
BEGIN
  WHILE array_length(v_result, 1) IS DISTINCT FROM p_count AND v_iter < 60 LOOP
    v_avail := public.check_artist_availability(p_provider_id, v_check);
    IF (v_avail->>'available')::BOOLEAN THEN
      v_result := array_append(v_result, v_check);
    END IF;
    v_check := v_check + 1;
    v_iter  := v_iter + 1;
  END LOOP;
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_artist_availability   TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_nearest_available_dates TO authenticated, anon;

-- ─── Verification ─────────────────────────────────────────────────────────────
SELECT 'check_artist_availability function created' AS status
WHERE EXISTS (
  SELECT 1 FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'check_artist_availability'
);
