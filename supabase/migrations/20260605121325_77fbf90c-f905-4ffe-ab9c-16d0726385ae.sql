
-- 1. Remove publicly accessible bills bucket policy
DROP POLICY IF EXISTS "Bills bucket access" ON storage.objects;

-- Customer SELECT for own bill files (path = bills.file_path, joined to orders.customer_id)
CREATE POLICY "Customers read own bill files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'bills'
  AND EXISTS (
    SELECT 1 FROM public.bills b
    JOIN public.orders o ON o.id = b.order_id
    JOIN public.customers c ON c.id = o.customer_id
    WHERE b.file_path = storage.objects.name
      AND c.auth_user_id = auth.uid()
  )
);

-- 2. Remove unrestricted project-uploads INSERT policy
DROP POLICY IF EXISTS "Anyone can upload to project-uploads" ON storage.objects;

-- 3. Tighten reviews INSERT — require valid bewertungs_token match
DROP POLICY IF EXISTS "Public can submit reviews via token" ON public.reviews;

CREATE POLICY "Public can submit reviews via valid token"
ON public.reviews FOR INSERT
TO anon, authenticated
WITH CHECK (
  token IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.bewertungs_token::text = reviews.token
  )
  AND freigegeben = false
);
