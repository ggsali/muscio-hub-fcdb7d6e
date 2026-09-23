DROP POLICY IF EXISTS "Public read company_settings" ON public.company_settings;
CREATE POLICY "Public read company_settings" ON public.company_settings FOR SELECT TO anon, authenticated
USING (key IN ('firmenname','slogan','telefon','email','website','primary_color','logo_url'));

DROP POLICY IF EXISTS "Public can read website_settings" ON public.website_settings;
CREATE POLICY "Public can read website_settings" ON public.website_settings FOR SELECT TO anon, authenticated
USING (key IN ('karussel','material_preise','kontakt_info','faq','wartungsmodus','nav_links','whatsapp'));

DROP POLICY IF EXISTS "Public read materials" ON public.materials;
CREATE POLICY "Public read materials" ON public.materials FOR SELECT TO anon, authenticated
USING (aktiv = true);

DROP POLICY IF EXISTS "Public read shop_categories" ON public.shop_categories;
CREATE POLICY "Public read shop_categories" ON public.shop_categories FOR SELECT TO anon, authenticated
USING (aktiv = true);