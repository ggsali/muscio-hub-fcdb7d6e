-- Website-Kalkulator: Stundensatz Nachbearbeitung aus dem Admin (Einstellungen → Stundensätze) für Besucher lesbar machen.
-- "settings" bleibt admin-only; Besucher lesen nur diese drei Keys über die Funktion.
CREATE OR REPLACE FUNCTION public.get_website_calc_preise()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb)
  FROM public.settings
  WHERE key IN ('website_maschinenzeit_pro_h', 'website_setup_pauschale', 'nachbearbeitung_pro_h');
$$;

REVOKE ALL ON FUNCTION public.get_website_calc_preise() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_website_calc_preise() TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
