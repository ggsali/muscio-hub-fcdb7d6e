ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (status = ANY (ARRAY[
  'Offen','In Bearbeitung','Abgeschlossen','Storniert',
  'Anfrage','Offerte gesendet','Bezahlt','Im Druck','Qualitätsprüfung','Versandt','Geliefert'
]));