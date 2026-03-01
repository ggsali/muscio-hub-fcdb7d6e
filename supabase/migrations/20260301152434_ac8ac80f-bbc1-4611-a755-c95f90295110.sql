
INSERT INTO storage.buckets (id, name, public) VALUES ('bills', 'bills', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can manage bills storage"
ON storage.objects FOR ALL
USING (bucket_id = 'bills')
WITH CHECK (bucket_id = 'bills');
