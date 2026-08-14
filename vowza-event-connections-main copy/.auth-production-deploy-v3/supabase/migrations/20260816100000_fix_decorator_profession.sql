-- Fix decorator profession gate to include 'wedding_decorator'
CREATE OR REPLACE FUNCTION public.is_decorator(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND profession::text IN ('decorator','event_decorator','decoration_services','floral_decorator','wedding_decorator'));
$$;
CREATE OR REPLACE FUNCTION public.owns_decorator(p_provider_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.provider_profiles WHERE id=p_provider_id AND user_id=auth.uid() AND profession::text IN ('decorator','event_decorator','decoration_services','floral_decorator','wedding_decorator'));
$$;
