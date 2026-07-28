ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS bot_enabled boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.get_chat_bot_enabled(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT bot_enabled FROM public.chat_sessions WHERE id = p_session_id), true)
$$;

GRANT EXECUTE ON FUNCTION public.get_chat_bot_enabled(uuid) TO anon, authenticated;