
CREATE TABLE public.upload_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Projektdaten hochladen',
  beschreibung text,
  expires_at timestamp with time zone,
  max_files integer DEFAULT 50,
  aktiv boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.upload_link_files (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_link_id uuid NOT NULL REFERENCES public.upload_links(id) ON DELETE CASCADE,
  filename text NOT NULL,
  storage_path text NOT NULL,
  file_type text,
  file_size_bytes bigint,
  nas_path text,
  nas_synced boolean DEFAULT false,
  uploader_name text,
  uploader_email text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.upload_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_link_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users manage upload_links"
ON public.upload_links FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public can read active upload_links by token"
ON public.upload_links FOR SELECT TO anon USING (aktiv = true AND (expires_at IS NULL OR expires_at > now()));

CREATE POLICY "Authenticated users manage upload_link_files"
ON public.upload_link_files FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public can insert upload_link_files"
ON public.upload_link_files FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Public can read own upload_link_files"
ON public.upload_link_files FOR SELECT TO anon USING (true);

-- Storage bucket for large project uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('project-uploads', 'project-uploads', false, 5368709120)
ON CONFLICT (id) DO UPDATE SET file_size_limit = 5368709120;

CREATE POLICY "Anyone can upload to project-uploads"
ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'project-uploads');

CREATE POLICY "Authenticated users can read project-uploads"
ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'project-uploads');

CREATE POLICY "Anon can read own project-uploads"
ON storage.objects FOR SELECT TO anon USING (bucket_id = 'project-uploads');
