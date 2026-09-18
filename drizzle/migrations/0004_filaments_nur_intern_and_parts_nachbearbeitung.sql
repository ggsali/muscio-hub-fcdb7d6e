ALTER TABLE public.filaments
  ADD COLUMN IF NOT EXISTS nur_intern BOOLEAN DEFAULT false;

ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS nachbearbeitungs_schritte JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS support_filament_id UUID REFERENCES public.filaments(id);

ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS support_gewicht_g NUMERIC DEFAULT 0;