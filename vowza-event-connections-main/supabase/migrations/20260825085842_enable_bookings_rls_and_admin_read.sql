-- 20260825085842_enable_bookings_rls_and_admin_read.sql
--
-- RECOVERED FILE -- ALREADY APPLIED TO PRODUCTION. DO NOT EDIT THE VERSION.
--
-- This migration was applied to production on 2026-08-25 08:58:42 UTC through
-- the Supabase MCP apply_migration tool, which writes a row to
-- supabase_migrations.schema_migrations but leaves no file in the repository.
-- The result was ledger drift: `supabase migration list` showed version
-- 20260825085842 under Remote with nothing under Local.
--
-- The SQL below was recovered verbatim from that ledger row's statements[]
-- column on 2026-08-27. It is reproduced here so that local and remote agree.
-- Because a version already present in the remote ledger is treated as applied
-- and skipped, `supabase db push` will NOT re-run this against production.
--
-- Do NOT attempt to reconcile this with `migration repair --status reverted`.
-- That DELETES the ledger row, and until this file existed that row was the
-- only surviving copy of the SQL.
--
-- One deliberate difference from what actually executed: DROP POLICY IF EXISTS
-- has been added before CREATE POLICY so the file is replayable against a
-- fresh local database. Production skips this version entirely, so the added
-- line cannot affect it.
--
-- What it does: bookings was one of eleven tables carrying RLS policies while
-- RLS itself was never enabled, which left all three of its policies inert
-- while anon held GRANT ALL. This migration enabled RLS on bookings and added
-- admin read access. It is the reason bookings is the only one of the eleven
-- that was already remediated before 20261201000005.
--
-- Note for later cleanup: the policy below has no TO clause, so it applies to
-- PUBLIC, and it inlines EXISTS (SELECT 1 FROM public.user_roles ...) rather
-- than calling has_role(). It is therefore the 41st policy across 24 tables
-- that pins anon's SELECT privilege on user_roles in place -- all 41 must move
-- onto has_role() before that privilege can be revoked.
-- ===========================================================================

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all bookings" ON public.bookings;

CREATE POLICY "Admins can view all bookings"
ON public.bookings
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles AS ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = ANY (ARRAY['admin'::public.app_role, 'super_admin'::public.app_role])
  )
);
