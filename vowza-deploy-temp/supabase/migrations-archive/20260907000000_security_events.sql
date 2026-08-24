-- Security Events Table for Vowza
-- Admin-read-only, system-write (via anon with RLS rules)
-- Captures unauthorized access attempts and suspicious behavior

CREATE TABLE IF NOT EXISTS public.security_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    text NOT NULL,
  severity      text NOT NULL CHECK (severity IN ('low','medium','high','critical','info')),
  user_id       uuid,
  user_email    text,
  endpoint      text,
  resource_type text,
  resource_id   text,
  action        text,
  result        text,
  http_status   integer,
  reason        text,
  risk_score    integer DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  user_agent    text,
  is_authenticated boolean DEFAULT false,
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS security_events_created_idx    ON public.security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS security_events_severity_idx   ON public.security_events(severity);
CREATE INDEX IF NOT EXISTS security_events_user_id_idx    ON public.security_events(user_id);
CREATE INDEX IF NOT EXISTS security_events_event_type_idx ON public.security_events(event_type);
CREATE INDEX IF NOT EXISTS security_events_risk_idx       ON public.security_events(risk_score DESC);

-- RLS
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Only admins/super_admins can READ security events
DROP POLICY IF EXISTS security_events_admin_read ON public.security_events;
CREATE POLICY security_events_admin_read ON public.security_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- Authenticated users can INSERT their own events (the client logs them)
-- This is controlled: user cannot insert with someone else's user_id
DROP POLICY IF EXISTS security_events_insert ON public.security_events;
CREATE POLICY security_events_insert ON public.security_events
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR user_id IS NULL
  );

-- Unauthenticated users can also insert (anonymous attempts)
DROP POLICY IF EXISTS security_events_anon_insert ON public.security_events;
CREATE POLICY security_events_anon_insert ON public.security_events
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL AND is_authenticated = false);

-- Nobody can UPDATE or DELETE security events (immutable audit log)
-- No UPDATE or DELETE policies = no UPDATE/DELETE allowed

-- Enable realtime for admin dashboard
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'security_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.security_events;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
