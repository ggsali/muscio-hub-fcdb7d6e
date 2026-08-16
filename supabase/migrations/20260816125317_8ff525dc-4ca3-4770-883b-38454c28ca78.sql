CREATE TABLE public.calc_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT,
  event TEXT NOT NULL,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.calc_events TO anon, authenticated;
GRANT SELECT ON public.calc_events TO authenticated;
GRANT ALL ON public.calc_events TO service_role;

ALTER TABLE public.calc_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log calc events"
ON public.calc_events FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can read calc events"
ON public.calc_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_calc_events_created_at ON public.calc_events (created_at DESC);