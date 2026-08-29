-- Back to invoker view, but restrict anon/authenticated to non-sensitive columns.
ALTER VIEW public.public_reviews SET (security_invoker = true);

REVOKE SELECT ON public.reviews FROM anon;
GRANT SELECT (id, customer_name, rating, kommentar, source, created_at, freigegeben, sichtbar_auf_website)
  ON public.reviews TO anon;

CREATE POLICY "Public can read published reviews"
  ON public.reviews FOR SELECT TO anon
  USING (freigegeben = true AND sichtbar_auf_website = true);

CREATE POLICY "Signed-in users can read published reviews"
  ON public.reviews FOR SELECT TO authenticated
  USING (freigegeben = true AND sichtbar_auf_website = true);