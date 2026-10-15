-- Öffentliche Preisparameter des Website-Kalkulators (nur diese Keys, sonst bleibt "settings" admin-only).
-- Kunden sehen damit exakt dieselben Werte wie der Admin (Maschinenstunde, Setup-Pauschale, Qualitätsstufen, Support, Mindestpreis).
CREATE OR REPLACE FUNCTION public.get_public_calc_settings()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb)
  FROM public.settings
  WHERE key IN ('maschinenzeit_pro_h', 'setup_pauschale', 'quality_presets', 'calc_params');
$$;

REVOKE ALL ON FUNCTION public.get_public_calc_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_calc_settings() TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
