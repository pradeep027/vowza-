-- Keep database ownership guards aligned with the Water Supplier UI category gate.
CREATE OR REPLACE FUNCTION public.is_water_supplier(p_provider_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.provider_profiles
    WHERE id = p_provider_id
      AND profession::text IN ('water_supplier', 'drinking_water_supplier')
  );
$$;

CREATE OR REPLACE FUNCTION public.owns_water_supplier(p_provider_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.provider_profiles
    WHERE id = p_provider_id
      AND user_id = auth.uid()
      AND profession::text IN ('water_supplier', 'drinking_water_supplier')
  );
$$;
