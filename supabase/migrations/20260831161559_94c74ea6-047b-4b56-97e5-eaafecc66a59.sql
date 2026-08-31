CREATE TABLE IF NOT EXISTS public.gutscheine (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  typ TEXT NOT NULL DEFAULT 'prozent',
  wert NUMERIC NOT NULL DEFAULT 10,
  mindestbestellwert NUMERIC DEFAULT 0,
  max_verwendungen INTEGER DEFAULT 1,
  verwendungen INTEGER DEFAULT 0,
  gueltig_ab DATE DEFAULT CURRENT_DATE,
  gueltig_bis DATE,
  aktiv BOOLEAN DEFAULT true,
  kunde_id UUID REFERENCES public.customers(id),
  grund TEXT,
  notiz TEXT,
  erstellt_am TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gutschein_verwendungen (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gutschein_id UUID REFERENCES public.gutscheine(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  shop_order_id UUID REFERENCES public.shop_orders(id) ON DELETE SET NULL,
  rabatt_betrag NUMERIC NOT NULL,
  verwendet_am TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gutscheine TO authenticated;
GRANT SELECT, UPDATE ON public.gutscheine TO anon;
GRANT ALL ON public.gutscheine TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gutschein_verwendungen TO authenticated;
GRANT INSERT ON public.gutschein_verwendungen TO anon;
GRANT ALL ON public.gutschein_verwendungen TO service_role;

ALTER TABLE public.gutscheine ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gutschein_verwendungen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage gutscheine" ON public.gutscheine FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public read aktive" ON public.gutscheine FOR SELECT TO anon USING (aktiv = true);
CREATE POLICY "Public increment aktive" ON public.gutscheine FOR UPDATE TO anon USING (aktiv = true) WITH CHECK (aktiv = true);
CREATE POLICY "Admin manage verwendungen" ON public.gutschein_verwendungen FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public insert verwendungen" ON public.gutschein_verwendungen FOR INSERT TO anon WITH CHECK (true);