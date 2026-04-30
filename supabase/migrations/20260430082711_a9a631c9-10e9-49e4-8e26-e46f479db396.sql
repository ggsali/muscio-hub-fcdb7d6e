ALTER TABLE public.timeline_events ADD COLUMN IF NOT EXISTS image_path text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('timeline-images', 'timeline-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read timeline-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'timeline-images');

CREATE POLICY "Admins upload timeline-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'timeline-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update timeline-images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'timeline-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete timeline-images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'timeline-images' AND has_role(auth.uid(), 'admin'::app_role));