-- Schalter "Resin-Druck anzeigen" für öffentliche Leser freigeben:
-- ohne diesen Schlüssel sieht die öffentliche Website nie den gespeicherten Wert
-- und zeigt Resin/SLA deshalb immer an.
DROP POLICY IF EXISTS "Public can read website_settings" ON public.website_settings;
CREATE POLICY "Public can read website_settings"
ON public.website_settings FOR SELECT
TO anon, authenticated
USING (key = ANY (ARRAY[
  'karussel'::text,
  'material_preise'::text,
  'kontakt_info'::text,
  'faq'::text,
  'wartungsmodus'::text,
  'nav_links'::text,
  'whatsapp'::text,
  'resin_enabled'::text
]));