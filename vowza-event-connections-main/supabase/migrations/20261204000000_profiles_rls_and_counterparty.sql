-- §2 profile feature group: complete policies before RLS enablement.
-- Rollback order: (1) disable FORCE/RLS only with a reviewed replacement policy
-- set; (2) restore the prior policy set only after application rollback;
-- (3) revoke helper EXECUTE; (4) drop shares_booking_with last; (5) drop
-- has_role only if no remaining policy or application dependency references it.
-- This migration intentionally includes an admin DELETE policy because the
-- existing AdminCustomers path calls DELETE on public.profiles.

BEGIN;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.shares_booking_with(other_user uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL OR other_user IS NULL OR caller = other_user THEN
    RETURN FALSE;
  END IF;

  -- Generic bookings.
  IF EXISTS (
    SELECT 1
    FROM public.bookings b
    JOIN public.provider_profiles pp ON pp.id = b.provider_id
    WHERE (b.customer_id = caller AND pp.user_id = other_user)
       OR (b.customer_id = other_user AND pp.user_id = caller)
  ) THEN RETURN TRUE; END IF;

  -- Category-specific booking tables with customer_id/provider_id.
  IF EXISTS (SELECT 1 FROM public.catering_bookings b JOIN public.provider_profiles pp ON pp.id=b.provider_id WHERE (b.customer_id=caller AND pp.user_id=other_user) OR (b.customer_id=other_user AND pp.user_id=caller)) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.water_bookings b JOIN public.provider_profiles pp ON pp.id=b.provider_id WHERE (b.customer_id=caller AND pp.user_id=other_user) OR (b.customer_id=other_user AND pp.user_id=caller)) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.videography_bookings b JOIN public.provider_profiles pp ON pp.id=b.provider_id WHERE (b.customer_id=caller AND pp.user_id=other_user) OR (b.customer_id=other_user AND pp.user_id=caller)) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.singer_bookings b JOIN public.provider_profiles pp ON pp.id=b.provider_id WHERE (b.customer_id=caller AND pp.user_id=other_user) OR (b.customer_id=other_user AND pp.user_id=caller)) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.rental_bookings b JOIN public.provider_profiles pp ON pp.id=b.provider_id WHERE (b.customer_id=caller AND pp.user_id=other_user) OR (b.customer_id=other_user AND pp.user_id=caller)) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.priest_bookings b JOIN public.provider_profiles pp ON pp.id=b.provider_id WHERE (b.customer_id=caller AND pp.user_id=other_user) OR (b.customer_id=other_user AND pp.user_id=caller)) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.mehendi_bookings b JOIN public.provider_profiles pp ON pp.id=b.provider_id WHERE (b.customer_id=caller AND pp.user_id=other_user) OR (b.customer_id=other_user AND pp.user_id=caller)) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.makeup_bookings b JOIN public.provider_profiles pp ON pp.id=b.provider_id WHERE (b.customer_id=caller AND pp.user_id=other_user) OR (b.customer_id=other_user AND pp.user_id=caller)) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.drone_bookings b JOIN public.provider_profiles pp ON pp.id=b.provider_id WHERE (b.customer_id=caller AND pp.user_id=other_user) OR (b.customer_id=other_user AND pp.user_id=caller)) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.dj_bookings b JOIN public.provider_profiles pp ON pp.id=b.provider_id WHERE (b.customer_id=caller AND pp.user_id=other_user) OR (b.customer_id=other_user AND pp.user_id=caller)) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.decorator_bookings b JOIN public.provider_profiles pp ON pp.id=b.provider_id WHERE (b.customer_id=caller AND pp.user_id=other_user) OR (b.customer_id=other_user AND pp.user_id=caller)) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.dancer_bookings b JOIN public.provider_profiles pp ON pp.id=b.provider_id WHERE (b.customer_id=caller AND pp.user_id=other_user) OR (b.customer_id=other_user AND pp.user_id=caller)) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.banquet_bookings b JOIN public.provider_profiles pp ON pp.id=b.provider_id WHERE (b.customer_id=caller AND pp.user_id=other_user) OR (b.customer_id=other_user AND pp.user_id=caller)) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.band_bookings b JOIN public.provider_profiles pp ON pp.id=b.provider_id WHERE (b.customer_id=caller AND pp.user_id=other_user) OR (b.customer_id=other_user AND pp.user_id=caller)) THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM public.anchor_bookings b JOIN public.provider_profiles pp ON pp.id=b.provider_id WHERE (b.customer_id=caller AND pp.user_id=other_user) OR (b.customer_id=other_user AND pp.user_id=caller)) THEN RETURN TRUE; END IF;

  -- Photography uses photographer_id -> provider_profiles.id.
  IF EXISTS (
    SELECT 1
    FROM public.photography_package_bookings b
    JOIN public.provider_profiles pp ON pp.id = b.photographer_id
    WHERE (b.customer_id = caller AND pp.user_id = other_user)
       OR (b.customer_id = other_user AND pp.user_id = caller)
  ) THEN RETURN TRUE; END IF;

  -- event_bookings/admin_event_package_bookings have customer-only identity;
  -- booking_locations and booking_events have neither identity column, so none
  -- of these tables can independently prove a counterparty relationship.
  RETURN FALSE;
END;
$$;
REVOKE ALL ON FUNCTION public.shares_booking_with(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shares_booking_with(uuid) TO authenticated;

-- Replace any prior public/owner policies by name, then create the complete
-- policy set before enabling RLS.
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS profiles_public_catalog_read ON public.profiles;
DROP POLICY IF EXISTS profiles_owner_read ON public.profiles;
DROP POLICY IF EXISTS profiles_owner_update ON public.profiles;
DROP POLICY IF EXISTS profiles_admin_read ON public.profiles;
DROP POLICY IF EXISTS profiles_counterparty_read ON public.profiles;
DROP POLICY IF EXISTS profiles_admin_delete ON public.profiles;

CREATE POLICY profiles_public_catalog_read
  ON public.profiles
  FOR SELECT
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.provider_profiles AS pp
    WHERE pp.user_id = public.profiles.id
      AND pp.is_published = true
      AND pp.is_available = true
  ));

CREATE POLICY profiles_owner_read
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY profiles_owner_update
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_admin_read
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

CREATE POLICY profiles_counterparty_read
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.shares_booking_with(id));

CREATE POLICY profiles_admin_delete
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

COMMENT ON POLICY profiles_public_catalog_read ON public.profiles IS
  'Public and authenticated catalog display rows; private identity/account fields remain excluded from anon column grants.';
COMMENT ON POLICY profiles_counterparty_read ON public.profiles IS
  'Authenticated users may read the other participant profile only when a confirmed booking relationship is established by shares_booking_with.';
COMMENT ON POLICY profiles_admin_delete ON public.profiles IS
  'Admin customer deletion path; authenticated admin/super_admin only.';

-- The complete six-policy set now exists before RLS is turned on.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

COMMIT;
