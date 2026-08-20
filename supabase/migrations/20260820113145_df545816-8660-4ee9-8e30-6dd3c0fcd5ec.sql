ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS herkunft TEXT;

DROP FUNCTION IF EXISTS public.set_inquiry_herkunft(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.set_inquiry_herkunft(
  p_inquiry_id UUID,
  p_herkunft TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.inquiries
  SET herkunft = p_herkunft
  WHERE id = p_inquiry_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_inquiry_herkunft TO anon, authenticated;