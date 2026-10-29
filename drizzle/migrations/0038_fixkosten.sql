CREATE TABLE IF NOT EXISTS public.fixkosten (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kategorie text NOT NULL DEFAULT 'Sonstiges',
  betrag numeric NOT NULL DEFAULT 0,
  intervall text NOT NULL DEFAULT 'monatlich' CHECK (intervall IN ('monatlich', 'jaehrlich')),
  gueltig_ab date,
  gueltig_bis date,
  notiz text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fixkosten TO authenticated;
GRANT ALL ON public.fixkosten TO service_role;
ALTER TABLE public.fixkosten ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage fixkosten" ON public.fixkosten
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_fixkosten_updated_at BEFORE UPDATE ON public.fixkosten
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();