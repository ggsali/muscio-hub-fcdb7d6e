-- 1) Filaments: keine internen Kostendaten für anonyme Besucher
REVOKE SELECT ON public.filaments FROM anon;
GRANT SELECT (id, name, material, farbe, farben, verkaufspreis_pro_g, dichte_g_cm3, aktiv) ON public.filaments TO anon;

-- 2) public_reviews: SECURITY INVOKER statt DEFINER + passende RLS/Spaltenrechte
ALTER VIEW public.public_reviews SET (security_invoker = true);

DROP POLICY IF EXISTS "Public can read approved reviews" ON public.reviews;
CREATE POLICY "Public can read approved reviews"
ON public.reviews FOR SELECT
TO anon, authenticated
USING (freigegeben = true AND sichtbar_auf_website = true);

REVOKE SELECT ON public.reviews FROM anon;
GRANT SELECT (id, customer_name, rating, kommentar, source, created_at) ON public.reviews TO anon;
GRANT SELECT ON public.public_reviews TO anon, authenticated;