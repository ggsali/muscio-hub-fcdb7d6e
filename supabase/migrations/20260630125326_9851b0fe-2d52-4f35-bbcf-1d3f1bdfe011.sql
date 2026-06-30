
CREATE POLICY "Admins read print-plates" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'print-plates' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins write print-plates" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'print-plates' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update print-plates" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'print-plates' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete print-plates" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'print-plates' AND public.has_role(auth.uid(), 'admin'));
