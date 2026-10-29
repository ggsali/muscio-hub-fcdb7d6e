CREATE TABLE IF NOT EXISTS public.scan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  quelle text NOT NULL DEFAULT 'server',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scan_events_created ON public.scan_events (created_at DESC);
GRANT SELECT ON public.scan_events TO authenticated;
GRANT ALL ON public.scan_events TO service_role;
ALTER TABLE public.scan_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read scan_events" ON public.scan_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
ALTER PUBLICATION supabase_realtime ADD TABLE public.scan_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.arbeitszeit;