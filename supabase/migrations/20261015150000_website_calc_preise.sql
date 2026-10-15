-- Nur für den Website-Kalkulator: eigene Preise für Maschinenstunde und Setup-Pauschale.
-- Admin, Aufträge, Offerten und Rechnungen bleiben unberührt (eigene Keys, nicht die Verrechnungssätze).
-- "settings" bleibt admin-only; Besucher lesen ausschliesslich diese zwei Keys über die Funktion.
DROP FUNCTION IF EXISTS public.get_public_calc_settings();

CREATE OR REPLACE FUNCTION public.get_website_calc_preise()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb)
  FROM public.settings
  WHERE key IN ('website_maschinenzeit_pro_h', 'website_setup_pauschale');
$$;

REVOKE ALL ON FUNCTION public.get_website_calc_preise() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_website_calc_preise() TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
