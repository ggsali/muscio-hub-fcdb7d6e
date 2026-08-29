CREATE TABLE public.ausgaben (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  datum date NOT NULL DEFAULT CURRENT_DATE,
  kategorie text NOT NULL DEFAULT 'Sonstiges',
  beschreibung text NOT NULL,
  betrag numeric NOT NULL DEFAULT 0,
  beleg_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ausgaben TO authenticated;
GRANT ALL ON public.ausgaben TO service_role;

ALTER TABLE public.ausgaben ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ausgaben" ON public.ausgaben
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_ausgaben_updated_at BEFORE UPDATE ON public.ausgaben
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();