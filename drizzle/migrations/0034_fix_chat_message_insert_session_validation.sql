CREATE OR REPLACE FUNCTION public.is_chat_session_writable(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_sessions s
    WHERE s.id = p_session_id
      AND s.status = 'active'
      AND s.created_at > now() - interval '7 days'
  );
$$;
REVOKE ALL ON FUNCTION public.is_chat_session_writable(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_chat_session_writable(uuid) TO anon, authenticated, service_role;
ALTER POLICY "Public can insert chat_messages" ON public.chat_messages
TO anon, authenticated
WITH CHECK (
  role IN ('user', 'assistant')
  AND char_length(content) BETWEEN 1 AND 4000
  AND public.is_chat_session_writable(session_id)
);
