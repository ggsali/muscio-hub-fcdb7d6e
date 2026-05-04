-- Anhänge an Anfragen
ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;

-- Storage-Policies für Kalkulator-Uploads (Bucket project-uploads ist privat)
DO $$ BEGIN
  CREATE POLICY "Public can upload calculator files"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'project-uploads'
    AND (storage.foldername(name))[1] = 'kalkulator'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins read project-uploads"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-uploads'
    AND has_role(auth.uid(), 'admin'::app_role)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins manage project-uploads"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'project-uploads' AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'project-uploads' AND has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;