
-- Chat Sessions Tabelle
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name text,
  user_email text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users manage chat_sessions" ON public.chat_sessions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public can insert chat_sessions" ON public.chat_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can read own chat_sessions" ON public.chat_sessions
  FOR SELECT USING (true);

-- Chat Messages Tabelle
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user',
  content text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users manage chat_messages" ON public.chat_messages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public can insert chat_messages" ON public.chat_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can read chat_messages by session" ON public.chat_messages
  FOR SELECT USING (true);

-- Profiles Tabelle (für Website-Registrierungen)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  full_name text,
  phone text,
  address text,
  city text,
  postal_code text,
  country text DEFAULT 'Schweiz',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users manage profiles" ON public.profiles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (true);

-- Realtime für Chat aktivieren
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Trigger für updated_at
CREATE OR REPLACE FUNCTION public.update_chat_session_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_chat_session_updated_at();
