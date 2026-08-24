ALTER VIEW public.public_reviews SET (security_invoker = true);

GRANT SELECT (id, customer_name, rating, kommentar, source, created_at) ON public.reviews TO anon;

CREATE POLICY "Public can read published reviews"
ON public.reviews FOR SELECT
TO anon
USING (freigegeben = true AND sichtbar_auf_website = true);