-- ============================================================
-- Fix messages table to support ALL category-specific booking tables
-- Previously: messages.booking_id FK referenced only 'bookings' table
-- Now: messages.booking_id is a generic UUID (no FK) that can reference
--       any booking table (singer_bookings, dancer_bookings, etc.)
-- RLS updated to check participant access across ALL booking tables
-- and enforce advance payment requirement for chat access.
-- ============================================================

-- Step 1: Drop the FK constraint on messages.booking_id
-- The constraint name may vary; drop all FK constraints on that column
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'messages'
      AND att.attname = 'booking_id'
      AND con.contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

-- Step 2: Drop old RLS policies
DROP POLICY IF EXISTS "Booking participants can view messages" ON public.messages;
DROP POLICY IF EXISTS "Booking participants can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can mark own received messages as read" ON public.messages;

-- Step 3: Create a helper function that checks if a user is a participant
-- in ANY booking table for a given booking_id AND if chat is eligible
-- (advance paid = status is 'in_progress' or 'completed')
CREATE OR REPLACE FUNCTION public.is_chat_participant(p_booking_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Check generic bookings table
  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = p_booking_id
    AND (b.customer_id = p_user_id OR EXISTS (
      SELECT 1 FROM public.provider_profiles pp WHERE pp.id = b.provider_id AND pp.user_id = p_user_id
    ))
  ) THEN RETURN TRUE; END IF;

  -- Check all category-specific booking tables
  IF EXISTS (SELECT 1 FROM public.singer_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.dancer_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.videography_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.drone_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.dj_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.decorator_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.makeup_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.mehendi_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.anchor_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.band_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.priest_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.water_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.rental_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.banquet_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.catering_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = provider_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.photography_package_bookings WHERE id = p_booking_id AND (customer_id = p_user_id OR EXISTS (SELECT 1 FROM public.provider_profiles pp WHERE pp.id = photographer_id AND pp.user_id = p_user_id))) THEN RETURN TRUE; END IF;

  RETURN FALSE;
END;
$$;

-- Step 4: Create a helper to check if chat is eligible (advance paid)
CREATE OR REPLACE FUNCTION public.is_chat_eligible(p_booking_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Generic bookings: status in_progress or completed
  IF EXISTS (SELECT 1 FROM public.bookings WHERE id = p_booking_id AND status IN ('in_progress', 'completed')) THEN RETURN TRUE; END IF;

  -- Category-specific: check status = 'in_progress' or 'confirmed' or 'completed'
  IF EXISTS (SELECT 1 FROM public.singer_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.dancer_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.videography_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.drone_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.dj_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.decorator_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.makeup_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.mehendi_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.anchor_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.band_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.priest_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.water_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.rental_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.banquet_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.catering_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.photography_package_bookings WHERE id = p_booking_id AND status IN ('in_progress', 'confirmed', 'completed')) THEN RETURN TRUE; END IF;

  RETURN FALSE;
END;
$$;

-- Step 5: New RLS policies using the helper functions

-- SELECT: participants can read messages for their bookings
CREATE POLICY "chat_select_participant" ON public.messages
FOR SELECT USING (
  public.is_chat_participant(booking_id, auth.uid())
);

-- INSERT: participants can send messages ONLY if chat is eligible (advance paid)
CREATE POLICY "chat_insert_eligible" ON public.messages
FOR INSERT WITH CHECK (
  auth.uid() = sender_id
  AND public.is_chat_participant(booking_id, auth.uid())
  AND public.is_chat_eligible(booking_id)
);

-- UPDATE: non-sender participants can mark messages as read
CREATE POLICY "chat_update_read" ON public.messages
FOR UPDATE USING (
  sender_id != auth.uid()
  AND public.is_chat_participant(booking_id, auth.uid())
);
