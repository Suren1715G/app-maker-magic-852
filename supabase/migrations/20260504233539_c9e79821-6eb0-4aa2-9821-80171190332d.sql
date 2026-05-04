REVOKE EXECUTE ON FUNCTION public.company_set_line_google(uuid, uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_line_google(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.company_set_line_google(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_line_google(uuid, uuid, text, text) TO authenticated;