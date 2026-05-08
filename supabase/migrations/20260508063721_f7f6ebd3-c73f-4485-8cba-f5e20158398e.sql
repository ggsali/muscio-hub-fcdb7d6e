
CREATE TABLE public.equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  beschreibung text,
  specs jsonb DEFAULT '[]'::jsonb,
  modell_url text,
  vorschaubild_url text,
  sort_order integer NOT NULL DEFAULT 0,
  aktiv boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active equipment" ON public.equipment
  FOR SELECT TO anon, authenticated USING (aktiv = true);

CREATE POLICY "Admins manage equipment" ON public.equipment
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO storage.buckets (id, name, public) VALUES ('equipment-images', 'equipment-images', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('equipment-models', 'equipment-models', true) ON CONFLICT DO NOTHING;

CREATE POLICY "Public read equipment-images" ON storage.objects FOR SELECT USING (bucket_id = 'equipment-images');
CREATE POLICY "Admins manage equipment-images" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'equipment-images' AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'equipment-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public read equipment-models" ON storage.objects FOR SELECT USING (bucket_id = 'equipment-models');
CREATE POLICY "Admins manage equipment-models" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'equipment-models' AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'equipment-models' AND has_role(auth.uid(), 'admin'::app_role));
