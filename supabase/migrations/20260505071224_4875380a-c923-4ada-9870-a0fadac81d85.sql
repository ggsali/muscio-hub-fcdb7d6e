
-- Drop overly permissive anon SELECT on project-uploads (admins still manage; signed URLs for downloads)
DROP POLICY IF EXISTS "Anon can read own project-uploads" ON storage.objects;

-- Lock down upload_link_files: drop public SELECT and INSERT (use edge function instead)
DROP POLICY IF EXISTS "Public can read own upload_link_files" ON public.upload_link_files;
DROP POLICY IF EXISTS "Public can insert upload_link_files" ON public.upload_link_files;

-- Lock down upload_links: drop public enumeration policy (token validation now only via edge function)
DROP POLICY IF EXISTS "Public can read active upload_links by token" ON public.upload_links;

-- Hide review tokens from public reads (column-level)
REVOKE SELECT (token) ON public.reviews FROM anon, authenticated;

-- Remove chat tables from realtime publication (prevents arbitrary subscription)
ALTER PUBLICATION supabase_realtime DROP TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime DROP TABLE public.chat_sessions;

-- Restrict SECURITY DEFINER email queue helpers to service_role only
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
