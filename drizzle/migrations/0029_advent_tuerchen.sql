-- Adventskalender: Inhalte der Türchen. Nur Admins dürfen lesen/schreiben;
-- Besucher bekommen ein Türchen ausschliesslich über die Edge Function advent-tuerchen (am jeweiligen Tag).
CREATE TABLE IF NOT EXISTS public.advent_tuerchen (
  jahr int NOT NULL,
  tag int NOT NULL CHECK (tag BETWEEN 1 AND 24),
  titel text NOT NULL,
  text text,
  code text,
  typ text,
  wert numeric,
  PRIMARY KEY (jahr, tag)
);

ALTER TABLE public.advent_tuerchen ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.advent_tuerchen TO authenticated;
GRANT ALL ON public.advent_tuerchen TO service_role;

CREATE POLICY "Admin manage advent_tuerchen" ON public.advent_tuerchen
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
