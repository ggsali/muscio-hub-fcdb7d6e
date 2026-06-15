
-- Customers can read their own upload links (linked via customer_id or order's customer)
CREATE POLICY "Customers read own upload_links"
ON public.upload_links FOR SELECT
USING (
  customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid())
  OR order_id IN (
    SELECT o.id FROM public.orders o
    JOIN public.customers c ON c.id = o.customer_id
    WHERE c.auth_user_id = auth.uid()
  )
);

-- Customers can read files uploaded to their own links
CREATE POLICY "Customers read own upload_link_files"
ON public.upload_link_files FOR SELECT
USING (
  upload_link_id IN (
    SELECT id FROM public.upload_links
    WHERE customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid())
       OR order_id IN (
         SELECT o.id FROM public.orders o
         JOIN public.customers c ON c.id = o.customer_id
         WHERE c.auth_user_id = auth.uid()
       )
  )
);

-- Customers can read part_files attached to their own orders' parts
CREATE POLICY "Customers read own part_files"
ON public.part_files FOR SELECT
USING (
  part_id IN (
    SELECT p.id FROM public.parts p
    JOIN public.orders o ON o.id = p.order_id
    JOIN public.customers c ON c.id = o.customer_id
    WHERE c.auth_user_id = auth.uid()
  )
);

-- Storage: customers can read files in project-uploads/part-files belonging to them
-- (admins already have full access via existing policies, assumed)
CREATE POLICY "Customers read own project-uploads"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'project-uploads'
  AND (
    -- file under upload-link folder owned by customer
    EXISTS (
      SELECT 1 FROM public.upload_link_files ulf
      JOIN public.upload_links ul ON ul.id = ulf.upload_link_id
      WHERE ulf.storage_path = storage.objects.name
        AND (
          ul.customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid())
          OR ul.order_id IN (
            SELECT o.id FROM public.orders o
            JOIN public.customers c ON c.id = o.customer_id
            WHERE c.auth_user_id = auth.uid()
          )
        )
    )
    -- file linked to an inquiry from this customer (attachments column is jsonb)
    OR EXISTS (
      SELECT 1 FROM public.inquiries i
      JOIN public.customers c ON c.id = i.customer_id
      WHERE c.auth_user_id = auth.uid()
        AND i.attachments::text LIKE '%' || storage.objects.name || '%'
    )
  )
);

CREATE POLICY "Customers read own part-files storage"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'part-files'
  AND EXISTS (
    SELECT 1 FROM public.part_files pf
    JOIN public.parts p ON p.id = pf.part_id
    JOIN public.orders o ON o.id = p.order_id
    JOIN public.customers c ON c.id = o.customer_id
    WHERE pf.storage_path = storage.objects.name
      AND c.auth_user_id = auth.uid()
  )
);
