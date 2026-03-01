
CREATE TABLE public.bills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  titel TEXT NOT NULL DEFAULT '',
  betrag NUMERIC NOT NULL DEFAULT 0,
  faellig_am DATE,
  bezahlt_am DATE,
  bezahlt BOOLEAN NOT NULL DEFAULT false,
  notiz TEXT,
  file_path TEXT,
  filename TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage bills"
ON public.bills
FOR ALL
USING (true)
WITH CHECK (true);
