CREATE TABLE public.stadtmodell_bestellungen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'offen',
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  kantenlaenge_m integer NOT NULL,
  massstab integer NOT NULL,
  sockel_mm numeric NOT NULL,
  material text NOT NULL,
  modell_mm numeric NOT NULL,
  preis numeric NOT NULL,
  kunde_name text,
  kunde_email text,
  stl_path text,
  stripe_session_id text,
  fehler text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.stadtmodell_bestellungen TO authenticated;
GRANT ALL ON public.stadtmodell_bestellungen TO service_role;
ALTER TABLE public.stadtmodell_bestellungen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins lesen Stadtmodelle" ON public.stadtmodell_bestellungen FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins ändern Stadtmodelle" ON public.stadtmodell_bestellungen FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins löschen Stadtmodelle" ON public.stadtmodell_bestellungen FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins lesen Stadtmodell-STL" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'stadtmodelle' AND public.has_role(auth.uid(), 'admin'));