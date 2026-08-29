CREATE TABLE public.abrechnungen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nummer text NOT NULL UNIQUE,
  typ text NOT NULL DEFAULT 'monatsabrechnung',
  zeitraum_von date NOT NULL,
  zeitraum_bis date NOT NULL,
  status text NOT NULL DEFAULT 'entwurf',
  einnahmen_total numeric NOT NULL DEFAULT 0,
  ausgaben_total numeric NOT NULL DEFAULT 0,
  gewinn_total numeric NOT NULL DEFAULT 0,
  mwst_betrag numeric NOT NULL DEFAULT 0,
  mwst_satz numeric NOT NULL DEFAULT 8.1,
  notizen text,
  pdf_path text,
  erstellt_am timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.abrechnungen TO authenticated;
GRANT ALL ON public.abrechnungen TO service_role;

ALTER TABLE public.abrechnungen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage abrechnungen" ON public.abrechnungen
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_abrechnungen_updated_at BEFORE UPDATE ON public.abrechnungen
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.abrechnung_positionen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  abrechnung_id uuid NOT NULL REFERENCES public.abrechnungen(id) ON DELETE CASCADE,
  typ text NOT NULL,
  datum date,
  beschreibung text,
  betrag numeric NOT NULL DEFAULT 0,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ausgabe_id uuid REFERENCES public.ausgaben(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_abrechnung_positionen_abrechnung ON public.abrechnung_positionen(abrechnung_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.abrechnung_positionen TO authenticated;
GRANT ALL ON public.abrechnung_positionen TO service_role;

ALTER TABLE public.abrechnung_positionen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage abrechnung_positionen" ON public.abrechnung_positionen
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));