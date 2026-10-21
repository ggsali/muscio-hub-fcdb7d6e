-- Adventskalender: Versandprotokoll (verhindert Doppelversand) und Gutschein-Gültigkeit nach Schweizer Datum.
CREATE TABLE IF NOT EXISTS public.advent_versand_log (
  jahr int NOT NULL,
  tag int NOT NULL,
  email text NOT NULL,
  art text NOT NULL CHECK (art IN ('code', 'daily')),
  gesendet_am timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (jahr, tag, email, art)
);
ALTER TABLE public.advent_versand_log ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.advent_versand_log TO service_role;
GRANT SELECT ON public.advent_versand_log TO authenticated;
CREATE POLICY "Admin read advent_versand_log" ON public.advent_versand_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Gutschein-Prüfung: Datum in Schweizer Zeit (Türchen-Codes gelten genau am Tag, ab 00:00 Uhr Zürich)
CREATE OR REPLACE FUNCTION public.validate_gutschein(p_code text, p_subtotal numeric)
RETURNS TABLE(
  ok boolean,
  error text,
  id uuid,
  typ text,
  wert numeric,
  mindestbestellwert numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g public.gutscheine;
  v_code text := upper(trim(coalesce(p_code, '')));
  v_sub numeric := coalesce(p_subtotal, 0);
  v_heute date := (now() AT TIME ZONE 'Europe/Zurich')::date;
BEGIN
  IF v_code = '' OR length(v_code) > 64 THEN
    RETURN QUERY SELECT false, 'Bitte Code eingeben.', NULL::uuid, NULL::text, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  SELECT * INTO g FROM public.gutscheine WHERE upper(code) = v_code LIMIT 1;

  IF g.id IS NULL THEN
    RETURN QUERY SELECT false, 'Dieser Code existiert nicht.', NULL::uuid, NULL::text, NULL::numeric, NULL::numeric;
  ELSIF COALESCE(g.aktiv, false) = false THEN
    RETURN QUERY SELECT false, 'Dieser Code ist nicht mehr aktiv.', NULL::uuid, NULL::text, NULL::numeric, NULL::numeric;
  ELSIF g.gueltig_ab IS NOT NULL AND v_heute < g.gueltig_ab THEN
    RETURN QUERY SELECT false, 'Dieser Code ist noch nicht gültig.', NULL::uuid, NULL::text, NULL::numeric, NULL::numeric;
  ELSIF g.gueltig_bis IS NOT NULL AND v_heute > g.gueltig_bis THEN
    RETURN QUERY SELECT false, 'Dieser Code ist abgelaufen.', NULL::uuid, NULL::text, NULL::numeric, NULL::numeric;
  ELSIF g.max_verwendungen IS NOT NULL AND COALESCE(g.verwendungen, 0) >= g.max_verwendungen THEN
    RETURN QUERY SELECT false, 'Dieser Code wurde bereits vollständig eingelöst.', NULL::uuid, NULL::text, NULL::numeric, NULL::numeric;
  ELSIF COALESCE(g.mindestbestellwert, 0) > v_sub THEN
    RETURN QUERY SELECT false,
      'Mindestbestellwert CHF ' || to_char(g.mindestbestellwert, 'FM999999990.00') || ' nicht erreicht.',
      NULL::uuid, NULL::text, NULL::numeric, NULL::numeric;
  ELSE
    RETURN QUERY SELECT true, NULL::text, g.id, g.typ, g.wert, g.mindestbestellwert;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_gutschein(text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_gutschein(text, numeric) TO anon, authenticated, service_role;
