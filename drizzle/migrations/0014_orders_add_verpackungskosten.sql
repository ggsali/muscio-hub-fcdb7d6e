ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS verpackungskosten numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS verpackungs_beschreibung text;