ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

GRANT ALL ON public.parts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parts TO authenticated;