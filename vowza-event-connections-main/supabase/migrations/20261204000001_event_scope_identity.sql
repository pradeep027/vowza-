-- Event scope identity: one authenticated user's canonical state per stable event.
-- Existing rows become their own event scope; conversation_id remains the
-- conversation that last touched the event, not the event's identity.
ALTER TABLE public.event_states
  ADD COLUMN IF NOT EXISTS event_id UUID DEFAULT gen_random_uuid();

UPDATE public.event_states
SET event_id = gen_random_uuid()
WHERE event_id IS NULL;

ALTER TABLE public.event_states
  ALTER COLUMN event_id SET NOT NULL;

-- The old one-state-per-conversation constraint cannot represent two events in
-- one conversation and is not the canonical identity.
ALTER TABLE public.event_states
  DROP CONSTRAINT IF EXISTS event_states_conversation_id_key;
DROP INDEX IF EXISTS public.event_states_conversation_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_states_event_user
  ON public.event_states (event_id, user_id);
CREATE INDEX IF NOT EXISTS idx_event_states_user_event
  ON public.event_states (user_id, event_id);

ALTER TABLE public.event_state_versions
  ADD COLUMN IF NOT EXISTS event_id UUID;

UPDATE public.event_state_versions v
SET event_id = s.event_id
FROM public.event_states s
WHERE v.event_state_id = s.id
  AND v.event_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_event_state_versions_event
  ON public.event_state_versions (event_id, version DESC);
