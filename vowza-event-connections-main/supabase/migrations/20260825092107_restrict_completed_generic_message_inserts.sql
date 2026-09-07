-- 20260825092107_restrict_completed_generic_message_inserts.sql
--
-- RECOVERED FILE -- ALREADY APPLIED TO PRODUCTION. DO NOT EDIT THE VERSION.
--
-- Applied to production 2026-08-25 09:21:07 UTC via the Supabase MCP
-- apply_migration tool, which records a ledger row but writes no file. The
-- SQL below was recovered verbatim from supabase_migrations.schema_migrations
-- statements[] on 2026-08-27 and is reproduced so local and remote agree.
-- A version already in the remote ledger is skipped, so `supabase db push`
-- will NOT re-run this against production.
--
-- Do NOT reconcile with `migration repair --status reverted` -- that deletes
-- the row, which was the only copy of this SQL until this file existed.
--
-- What it does: closes the chat window once a booking is complete. The
-- previous chat_insert_eligible policy allowed a participant to keep posting
-- to a booking that had already reached status 'completed'.
--
-- The DROP was already present in the recovered statement, so this file is
-- replayable as-is against a fresh local database.
-- ===========================================================================

DROP POLICY IF EXISTS "chat_insert_eligible" ON public.messages;

CREATE POLICY "chat_insert_eligible"
ON public.messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND public.is_chat_participant(booking_id, auth.uid())
  AND public.is_chat_eligible(booking_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.bookings AS b
    WHERE b.id = booking_id AND b.status = 'completed'
  )
);
