
ALTER TABLE public.equipment
  ADD COLUMN IF NOT EXISTS ist_drucker boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bauplatte_breite_mm numeric,
  ADD COLUMN IF NOT EXISTS bauplatte_tiefe_mm numeric;

ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS laenge_mm numeric,
  ADD COLUMN IF NOT EXISTS breite_mm numeric;
