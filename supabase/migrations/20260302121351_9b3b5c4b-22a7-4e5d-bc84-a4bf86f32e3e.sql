ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS geplant_von date,
ADD COLUMN IF NOT EXISTS geplant_bis date;