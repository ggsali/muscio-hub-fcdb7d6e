-- Teilzahlungen (Akonto) pro Auftrag: zaehlen im Monat ihres Zahlungsdatums zum Umsatz
CREATE TABLE IF NOT EXISTS public.order_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  betrag numeric(12,2) NOT NULL CHECK (betrag > 0),
  datum date NOT NULL DEFAULT CURRENT_DATE,
  notiz text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_payments_order ON public.order_payments (order_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_datum ON public.order_payments (datum);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_payments TO authenticated;
GRANT ALL ON public.order_payments TO service_role;

ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage order_payments" ON public.order_payments;
CREATE POLICY "Admins manage order_payments" ON public.order_payments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));