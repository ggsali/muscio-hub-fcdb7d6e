
CREATE POLICY "Anyone can upload inquiry attachments"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'project-uploads'
  AND (storage.foldername(name))[1] = 'inquiries'
);
