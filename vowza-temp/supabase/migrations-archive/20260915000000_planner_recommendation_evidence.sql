-- Durable evidence and feedback for Vowza AI Planner recommendations.
-- Additive only. This file is intentionally NOT applied by this change.
-- It stores recommendation provenance without exposing provider contacts or
-- customer/private booking details.

CREATE TABLE IF NOT EXISTS public.planner_recommendation_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  message_id UUID REFERENCES public.ai_messages(id) ON DELETE SET NULL,
  intent TEXT NOT NULL,
  search_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  algorithm_version TEXT NOT NULL DEFAULT 'planner-ranking-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS public.planner_recommendation_candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES public.planner_recommendation_runs(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.provider_profiles(id) ON DELETE RESTRICT,
  rank_position INTEGER NOT NULL CHECK (rank_position > 0),
  match_score NUMERIC(6, 2) NOT NULL CHECK (match_score >= 0),
  reason_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  availability_status TEXT NOT NULL CHECK (availability_status IN ('not_checked', 'needs_confirmation', 'unavailable', 'confirmed')),
  availability_checked_at TIMESTAMPTZ,
  evidence_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE (run_id, provider_id),
  UNIQUE (run_id, rank_position)
);

CREATE TABLE IF NOT EXISTS public.ai_message_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.ai_messages(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL CHECK (reaction IN ('like', 'dislike')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE (user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_planner_recommendation_runs_user_created
  ON public.planner_recommendation_runs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_planner_recommendation_candidates_run_rank
  ON public.planner_recommendation_candidates (run_id, rank_position);
CREATE INDEX IF NOT EXISTS idx_ai_message_feedback_user_message
  ON public.ai_message_feedback (user_id, message_id);

ALTER TABLE public.planner_recommendation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planner_recommendation_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_message_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own planner recommendation runs"
  ON public.planner_recommendation_runs FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users read recommendation candidates from own runs"
  ON public.planner_recommendation_candidates FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.planner_recommendation_runs run
    WHERE run.id = run_id AND run.user_id = auth.uid()
  ));

CREATE POLICY "Users manage own AI message feedback"
  ON public.ai_message_feedback FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- A trusted Edge Function should create candidate evidence using the caller's
-- identity or a service role after it has validated provider/profile visibility.
-- Do not grant browser clients direct INSERT/UPDATE/DELETE on candidates.
