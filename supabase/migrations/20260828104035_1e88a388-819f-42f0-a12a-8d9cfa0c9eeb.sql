ALTER TABLE public.filaments ADD COLUMN IF NOT EXISTS farben jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.filaments
SET farben = jsonb_build_array(jsonb_build_object('name', farbe, 'hex', CASE WHEN farbe ~ '^#' THEN farbe ELSE '#888888' END))
WHERE farbe IS NOT NULL AND farbe <> '' AND (farben IS NULL OR farben = '[]'::jsonb);