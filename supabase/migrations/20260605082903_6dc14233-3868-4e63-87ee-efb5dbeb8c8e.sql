
CREATE TABLE public.page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL,
  referrer text,
  user_agent text,
  device text,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX page_views_created_at_idx ON public.page_views(created_at DESC);
CREATE INDEX page_views_path_idx ON public.page_views(path);
CREATE INDEX page_views_session_idx ON public.page_views(session_id);

GRANT INSERT ON public.page_views TO anon, authenticated;
GRANT SELECT, DELETE ON public.page_views TO authenticated;
GRANT ALL ON public.page_views TO service_role;

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert page_views"
  ON public.page_views FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins read page_views"
  ON public.page_views FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete page_views"
  ON public.page_views FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
