
ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS rechnungsnummer text,
  ADD COLUMN IF NOT EXISTS rechnungs_datum date,
  ADD COLUMN IF NOT EXISTS empfaenger_name text,
  ADD COLUMN IF NOT EXISTS empfaenger_firma text,
  ADD COLUMN IF NOT EXISTS empfaenger_adresse text,
  ADD COLUMN IF NOT EXISTS empfaenger_email text,
  ADD COLUMN IF NOT EXISTS betreff text,
  ADD COLUMN IF NOT EXISTS mwst_prozent numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.bill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  beschreibung text NOT NULL DEFAULT '',
  menge numeric NOT NULL DEFAULT 1,
  einheit text NOT NULL DEFAULT 'Stk',
  einzelpreis_chf numeric NOT NULL DEFAULT 0,
  gesamtpreis_chf numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bill_items_bill_id_idx ON public.bill_items(bill_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bill_items TO authenticated;
GRANT ALL ON public.bill_items TO service_role;

ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage bill_items"
  ON public.bill_items FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Customers read own bill_items"
  ON public.bill_items FOR SELECT
  TO authenticated
  USING (
    bill_id IN (
      SELECT b.id FROM public.bills b
      JOIN public.orders o ON o.id = b.order_id
      JOIN public.customers c ON c.id = o.customer_id
      WHERE c.auth_user_id = auth.uid()
    )
  );
