ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS express_kosten numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS express_label text;