REVOKE EXECUTE ON FUNCTION public.make_admin(uuid)             FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.make_provider(uuid)          FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_artist(uuid,uuid)    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_artist(uuid,uuid,text) FROM anon, authenticated;
