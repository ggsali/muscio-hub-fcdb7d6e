-- 1) Reviews: no direct table reads for anon/authenticated; public site uses the sanitized view
DROP POLICY IF EXISTS "Public can read published reviews" ON public.reviews;
DROP POLICY IF EXISTS "Signed-in users can read published reviews" ON public.reviews;

REVOKE SELECT ON public.reviews FROM anon;
REVOKE SELECT ON public.reviews FROM authenticated;

-- View runs with owner rights so it stays readable without base-table SELECT
ALTER VIEW public.public_reviews SET (security_invoker = false);
GRANT SELECT ON public.public_reviews TO anon, authenticated;

-- keep review submission via token working
GRANT INSERT ON public.reviews TO anon, authenticated;

-- 2) Gutscheine: anonymous visitors may no longer enumerate codes
DROP POLICY IF EXISTS "Public read aktive" ON public.gutscheine;
DROP POLICY IF EXISTS "Public increment aktive" ON public.gutscheine;
REVOKE SELECT, UPDATE ON public.gutscheine FROM anon;

-- validation happens server-side; only non-sensitive result fields are returned
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
  ELSIF g.gueltig_ab IS NOT NULL AND CURRENT_DATE < g.gueltig_ab THEN
    RETURN QUERY SELECT false, 'Dieser Code ist noch nicht gültig.', NULL::uuid, NULL::text, NULL::numeric, NULL::numeric;
  ELSIF g.gueltig_bis IS NOT NULL AND CURRENT_DATE > g.gueltig_bis THEN
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