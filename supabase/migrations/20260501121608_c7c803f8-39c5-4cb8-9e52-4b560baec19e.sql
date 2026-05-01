
-- Fix bills storage bucket: restrict to admins only
DROP POLICY IF EXISTS "Authenticated users can manage bills storage" ON storage.objects;

CREATE POLICY "Admins manage bills storage"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'bills' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'bills' AND public.has_role(auth.uid(), 'admin'));

-- Fix part-files storage: restrict to admins or owning customer
DROP POLICY IF EXISTS "Authenticated users can read part files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload part files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete part files" ON storage.objects;

-- Admins: full access to part-files
CREATE POLICY "Admins manage part-files storage"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'part-files' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'part-files' AND public.has_role(auth.uid(), 'admin'));

-- Customers: read only files belonging to their own parts
CREATE POLICY "Customers read own part-files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'part-files'
  AND EXISTS (
    SELECT 1
    FROM public.part_files pf
    JOIN public.customers c ON c.id = pf.customer_id
    WHERE pf.storage_path = storage.objects.name
      AND c.auth_user_id = auth.uid()
  )
);
