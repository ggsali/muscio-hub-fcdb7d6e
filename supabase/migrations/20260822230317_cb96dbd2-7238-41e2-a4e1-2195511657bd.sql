GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT SELECT ON public.public_reviews TO anon, authenticated;

CREATE POLICY "Public can upload reference images"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'project-uploads' AND (storage.foldername(name))[1] = 'reference-images');