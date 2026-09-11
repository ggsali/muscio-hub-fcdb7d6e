-- Column-level read access for public reviews (no customer_email exposure)
GRANT SELECT (id, customer_name, kommentar, rating, freigegeben, sichtbar_auf_website, source, created_at, order_id)
  ON public.reviews TO anon, authenticated;

GRANT SELECT ON public.public_reviews TO anon, authenticated;