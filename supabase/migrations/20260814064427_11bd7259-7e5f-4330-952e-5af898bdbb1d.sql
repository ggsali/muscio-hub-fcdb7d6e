-- Public reviews view must respect the querying user's RLS
ALTER VIEW public.public_reviews SET (security_invoker = true);

-- Allow anon/authenticated to read only published, website-visible reviews (via the view)
DROP POLICY IF EXISTS "Public can read published reviews" ON public.reviews;
CREATE POLICY "Public can read published reviews"
ON public.reviews
FOR SELECT
TO anon, authenticated
USING (freigegeben = true AND sichtbar_auf_website = true);

-- Prevent direct table access for anonymous visitors (emails stay hidden); view access only
REVOKE ALL ON public.reviews FROM anon;
GRANT INSERT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;

GRANT SELECT ON public.public_reviews TO anon, authenticated;
