CREATE TABLE public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tag text NOT NULL,
  price_per_gram numeric NOT NULL,
  density numeric NOT NULL DEFAULT 1.24,
  description text,
  aktiv boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read materials" ON public.materials
  FOR SELECT USING (true);

CREATE POLICY "Admins manage materials" ON public.materials
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_materials_updated_at
  BEFORE UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.materials (name, tag, price_per_gram, density, description, sort_order) VALUES
  ('PLA', 'FDM', 0.055, 1.24, 'Bio-abbaubar, ideal für Prototypen', 1),
  ('PETG', 'FDM', 0.065, 1.27, 'Schlagzäh, chemisch beständig', 2),
  ('ABS/ASA', 'FDM', 0.075, 1.04, 'Hitzebeständig, UV-stabil', 3),
  ('TPU', 'FDM', 0.090, 1.21, 'Flexibel, gummiartig', 4),
  ('Nylon', 'FDM', 0.120, 1.14, 'Sehr fest, abriebfest', 5),
  ('Resin', 'SLA', 0.120, 1.10, 'Höchste Detailgenauigkeit', 6);