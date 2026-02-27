ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS filament_id uuid NULL;
ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS filament_einkauf_pro_kg numeric NULL;