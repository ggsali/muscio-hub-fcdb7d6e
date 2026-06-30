
DROP POLICY IF EXISTS "Public read approved reviews" ON public.reviews;

DROP VIEW IF EXISTS public.public_reviews;
CREATE VIEW public.public_reviews
WITH (security_invoker = false) AS
SELECT
  id,
  customer_name,
  rating,
  kommentar,
  source,
  created_at
FROM public.reviews
WHERE freigegeben = true
  AND sichtbar_auf_website = true;

GRANT SELECT ON public.public_reviews TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can insert calculator uploads" ON public.calculator_uploads;
CREATE POLICY "Anyone can insert calculator uploads"
ON public.calculator_uploads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (auth_user_id IS NULL OR auth_user_id = auth.uid())
  AND estimated_price IS NULL
  AND status IN ('neu', 'pending')
  AND char_length(coalesce(customer_email, '')) <= 255
  AND char_length(coalesce(customer_name,  '')) <= 200
  AND char_length(coalesce(customer_phone, '')) <= 50
  AND char_length(coalesce(file_name,      '')) <= 500
  AND char_length(coalesce(notes,          '')) <= 2000
  AND char_length(coalesce(storage_path,   '')) <= 1000
  AND (customer_email IS NULL OR customer_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

CREATE POLICY "Users read shop_orders by matching email"
ON public.shop_orders
FOR SELECT
TO authenticated
USING (
  user_id IS NULL
  AND customer_email IS NOT NULL
  AND lower(customer_email) = lower(public.current_user_email())
);
