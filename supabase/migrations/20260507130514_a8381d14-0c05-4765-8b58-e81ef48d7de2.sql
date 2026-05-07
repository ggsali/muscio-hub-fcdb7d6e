DROP POLICY IF EXISTS "Anyone can insert inquiries" ON public.inquiries;

CREATE POLICY "Anyone can insert inquiries"
ON public.inquiries FOR INSERT
TO anon, authenticated
WITH CHECK (true);