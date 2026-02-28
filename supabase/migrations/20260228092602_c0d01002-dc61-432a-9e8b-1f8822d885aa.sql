
CREATE TABLE public.offer_positions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  bezeichnung text NOT NULL DEFAULT '',
  menge numeric NOT NULL DEFAULT 1,
  einheit text NOT NULL DEFAULT 'Stk.',
  preis_pro_einheit numeric NOT NULL DEFAULT 0,
  total numeric GENERATED ALWAYS AS (menge * preis_pro_einheit) STORED,
  notiz text,
  position_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.offer_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage offer_positions"
  ON public.offer_positions FOR ALL
  USING (true)
  WITH CHECK (true);
