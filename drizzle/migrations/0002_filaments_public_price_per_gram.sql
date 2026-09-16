ALTER TABLE public.filaments
  ADD COLUMN IF NOT EXISTS public_preis_pro_g NUMERIC
  GENERATED ALWAYS AS (COALESCE(verkaufspreis_pro_g, (preis_pro_kg / 1000) * 2.5)) STORED;

GRANT SELECT (public_preis_pro_g) ON public.filaments TO anon;
GRANT SELECT (public_preis_pro_g) ON public.filaments TO authenticated;