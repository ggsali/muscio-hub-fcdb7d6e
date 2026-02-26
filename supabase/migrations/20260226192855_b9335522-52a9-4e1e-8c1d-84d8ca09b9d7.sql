CREATE TABLE public.order_status_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  notiz text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.order_status_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage order_status_log"
  ON public.order_status_log
  FOR ALL
  USING (true)
  WITH CHECK (true);