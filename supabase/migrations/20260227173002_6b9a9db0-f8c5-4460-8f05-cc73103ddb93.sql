
CREATE TABLE public.time_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  part_id uuid NULL REFERENCES public.parts(id) ON DELETE SET NULL,
  kategorie text NOT NULL, -- 'Druck', 'Nachbearbeitung', 'Konstruktion', 'Sonstiges'
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  stopped_at timestamp with time zone NULL,
  dauer_sekunden integer NULL, -- berechnete Dauer in Sekunden
  notiz text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage time_entries"
ON public.time_entries
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
