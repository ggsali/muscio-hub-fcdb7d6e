ALTER TABLE public.ear_buchungen
  ADD COLUMN IF NOT EXISTS beleg_url text,
  ADD COLUMN IF NOT EXISTS beleg_storage_path text;

CREATE POLICY "Admins read belege" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'belege' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins upload belege" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'belege' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update belege" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'belege' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete belege" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'belege' AND public.has_role(auth.uid(), 'admin'));