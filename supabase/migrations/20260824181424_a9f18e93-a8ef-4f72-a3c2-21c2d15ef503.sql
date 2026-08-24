GRANT SELECT (id, customer_name, rating, kommentar, source, created_at) ON public.reviews TO authenticated;

CREATE POLICY "Signed-in users can read published reviews"
ON public.reviews FOR SELECT
TO authenticated
USING (freigegeben = true AND sichtbar_auf_website = true);