CREATE TABLE public.calculator_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  file_name text NOT NULL,
  storage_path text NOT NULL,
  size_bytes bigint,
  bucket text NOT NULL DEFAULT 'project-uploads',
  material_id uuid,
  material_name text,
  color text,
  infill integer,
  quantity integer DEFAULT 1,
  estimated_weight numeric,
  estimated_price numeric,
  customer_email text,
  customer_name text,
  customer_phone text,
  auth_user_id uuid,
  session_id text,
  status text NOT NULL DEFAULT 'neu',
  notes text
);

CREATE INDEX idx_calculator_uploads_created_at ON public.calculator_uploads(created_at DESC);
CREATE INDEX idx_calculator_uploads_session ON public.calculator_uploads(session_id);

ALTER TABLE public.calculator_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert calculator uploads"
ON public.calculator_uploads FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can view all calculator uploads"
ON public.calculator_uploads FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update calculator uploads"
ON public.calculator_uploads FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete calculator uploads"
ON public.calculator_uploads FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own calculator uploads by session"
ON public.calculator_uploads FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE TRIGGER trg_calc_uploads_updated_at
BEFORE UPDATE ON public.calculator_uploads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Allow anonymous uploads to project-uploads/kalkulator/* path
CREATE POLICY "Public can upload to kalkulator folder"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'project-uploads' AND (storage.foldername(name))[1] = 'kalkulator');