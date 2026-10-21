DROP POLICY IF EXISTS "Public can read website_settings" ON public.website_settings;
CREATE POLICY "Public can read website_settings" ON public.website_settings FOR SELECT TO anon, authenticated
USING (key = ANY (ARRAY['karussel','material_preise','kontakt_info','faq','wartungsmodus','nav_links','whatsapp','resin_enabled','stadtmodell_enabled','weihnachtsmodus']));