-- Public reads must go through the sanitized public_reviews view only.
DROP POLICY IF EXISTS "Public can read published reviews" ON public.reviews;
DROP POLICY IF EXISTS "Signed-in users can read published reviews" ON public.reviews;

REVOKE SELECT ON public.reviews FROM anon;

-- View runs with definer rights so it still works without a base-table policy.
ALTER VIEW public.public_reviews SET (security_invoker = false);
GRANT SELECT ON public.public_reviews TO anon, authenticated;