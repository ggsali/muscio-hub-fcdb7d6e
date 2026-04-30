
CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text,
  bio text,
  photo_path text,
  sort_order integer NOT NULL DEFAULT 0,
  aktiv boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active team_members" ON public.team_members
  FOR SELECT TO anon, authenticated USING (aktiv = true);

CREATE POLICY "Admins manage team_members" ON public.team_members
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- team-photos bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-photos', 'team-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read team-photos" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'team-photos');

CREATE POLICY "Admins manage team-photos" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'team-photos' AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'team-photos' AND public.has_role(auth.uid(), 'admin'::app_role));
