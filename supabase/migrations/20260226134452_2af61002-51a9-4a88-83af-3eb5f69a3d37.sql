
-- Filament library table
CREATE TABLE public.filaments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  material text NOT NULL DEFAULT 'PLA',
  farbe text,
  hersteller text,
  preis_pro_kg numeric NOT NULL DEFAULT 25,
  dichte_g_cm3 numeric DEFAULT 1.24,
  notizen text,
  aktiv boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.filaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage filaments" ON public.filaments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Part files table
CREATE TABLE public.part_files (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  part_id uuid REFERENCES public.parts(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  filename text NOT NULL,
  storage_path text NOT NULL,
  file_type text,
  file_size_bytes bigint,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.part_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage part_files" ON public.part_files FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage bucket for part files
INSERT INTO storage.buckets (id, name, public) VALUES ('part-files', 'part-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload part files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'part-files');

CREATE POLICY "Authenticated users can read part files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'part-files');

CREATE POLICY "Authenticated users can delete part files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'part-files');
