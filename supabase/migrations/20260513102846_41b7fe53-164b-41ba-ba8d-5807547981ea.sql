
-- 1) CHAT: drop blanket public SELECT, expose via SECURITY DEFINER RPC scoped by session id
DROP POLICY IF EXISTS "Public can read chat_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Public can read chat_sessions" ON public.chat_sessions;

CREATE OR REPLACE FUNCTION public.get_chat_messages(p_session_id uuid)
RETURNS TABLE (
  id uuid,
  session_id uuid,
  role text,
  content text,
  created_at timestamptz,
  is_read boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, session_id, role, content, created_at, is_read
  FROM public.chat_messages
  WHERE session_id = p_session_id
  ORDER BY created_at ASC
$$;
REVOKE ALL ON FUNCTION public.get_chat_messages(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_chat_messages(uuid) TO anon, authenticated;

-- 2) REVIEWS: hide submission token from public/auth SELECTs (admins still see it via ALL policy)
REVOKE SELECT ON public.reviews FROM anon, authenticated;
GRANT SELECT (
  id, customer_name, customer_email, kommentar, rating,
  freigegeben, sichtbar_auf_website, source, order_id,
  created_at, updated_at
) ON public.reviews TO anon, authenticated;

-- 3) REFERRALS: drop blanket public SELECT, expose code-scoped lookup via RPC
DROP POLICY IF EXISTS "Public read referral by code" ON public.referrals;

CREATE OR REPLACE FUNCTION public.get_referral_by_code(p_code text)
RETURNS TABLE (
  id uuid,
  rabatt_code text,
  rabatt_prozent integer,
  status text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, rabatt_code, rabatt_prozent, status, created_at
  FROM public.referrals
  WHERE rabatt_code = p_code
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_referral_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_referral_by_code(text) TO anon, authenticated;

-- 4) inquiry_messages realtime: keep RLS-scoped (admin-only ALL policy already covers SELECT
-- and Realtime postgres_changes enforces row-level RLS). No publication change required.
