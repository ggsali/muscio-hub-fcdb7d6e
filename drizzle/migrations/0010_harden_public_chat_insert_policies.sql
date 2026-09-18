-- Öffentliche Chat-Inserts validieren (bisher WITH CHECK (true)).
DROP POLICY IF EXISTS "Public can insert chat_sessions" ON public.chat_sessions;
CREATE POLICY "Public can insert chat_sessions"
ON public.chat_sessions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'active'
  AND (user_name IS NULL OR char_length(user_name) <= 100)
  AND (user_email IS NULL OR (char_length(user_email) <= 255 AND user_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'))
);

DROP POLICY IF EXISTS "Public can insert chat_messages" ON public.chat_messages;
CREATE POLICY "Public can insert chat_messages"
ON public.chat_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (
  role IN ('user', 'assistant')
  AND char_length(content) BETWEEN 1 AND 4000
  AND EXISTS (
    SELECT 1 FROM public.chat_sessions s
    WHERE s.id = session_id
      AND s.status = 'active'
      AND s.created_at > now() - interval '7 days'
  )
);