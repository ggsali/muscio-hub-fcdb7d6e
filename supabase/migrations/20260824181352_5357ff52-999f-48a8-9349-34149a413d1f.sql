DROP POLICY IF EXISTS "Public can read published reviews" ON public.reviews;

REVOKE SELECT ON public.reviews FROM anon;

ALTER VIEW public.public_reviews SET (security_invoker = false);
GRANT SELECT ON public.public_reviews TO anon, authenticated;

CREATE POLICY "Admins can read reviews"
ON public.reviews FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));