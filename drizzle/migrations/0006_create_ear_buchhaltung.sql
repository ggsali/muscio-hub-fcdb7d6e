CREATE TABLE public.ear_buchungen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jahr integer NOT NULL DEFAULT 2025,
  datum date,
  text text,
  beleg text,
  einnahmen numeric(12,2) DEFAULT 0,
  ausgaben numeric(12,2) DEFAULT 0,
  kategorie text NOT NULL CHECK (kategorie IN (
    'einnahmen','div_aufwaende','personalaufwand',
    'raumaufwand','unterhalt','versicherungen','buero','abschreibungen'
  )),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ear_buchungen TO authenticated;
GRANT ALL ON public.ear_buchungen TO service_role;

ALTER TABLE public.ear_buchungen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ear_buchungen" ON public.ear_buchungen
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_ear_buchungen_jahr_kat ON public.ear_buchungen (jahr, kategorie);

CREATE TABLE public.ear_anlagevermoegen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jahr integer NOT NULL DEFAULT 2025,
  konto text NOT NULL,
  anfangsbestand numeric(12,2) DEFAULT 0,
  zugaenge numeric(12,2) DEFAULT 0,
  abgaenge numeric(12,2) DEFAULT 0,
  abschreibungen_chf numeric(12,2) DEFAULT 0,
  abschreibungen_pct numeric(5,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ear_anlagevermoegen TO authenticated;
GRANT ALL ON public.ear_anlagevermoegen TO service_role;

ALTER TABLE public.ear_anlagevermoegen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ear_anlagevermoegen" ON public.ear_anlagevermoegen
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));