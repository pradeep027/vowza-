REVOKE EXECUTE ON FUNCTION public.make_admin(uuid)              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.make_provider(uuid)           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_artist(uuid,uuid)     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_artist(uuid,uuid,text)  FROM PUBLIC, anon, authenticated;
