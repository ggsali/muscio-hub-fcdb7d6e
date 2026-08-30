CREATE TABLE IF NOT EXISTS public.shop_product_optionen (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.shop_products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  typ TEXT NOT NULL DEFAULT 'chips',
  pflichtfeld BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shop_produkt_option_werte (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  option_id UUID REFERENCES public.shop_product_optionen(id) ON DELETE CASCADE,
  wert TEXT NOT NULL,
  hex_code TEXT,
  preis_aufschlag NUMERIC NOT NULL DEFAULT 0,
  lagerbestand INTEGER,
  aktiv BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_product_optionen_product ON public.shop_product_optionen(product_id);
CREATE INDEX IF NOT EXISTS idx_shop_produkt_option_werte_option ON public.shop_produkt_option_werte(option_id);

GRANT SELECT ON public.shop_product_optionen TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_product_optionen TO authenticated;
GRANT ALL ON public.shop_product_optionen TO service_role;

GRANT SELECT ON public.shop_produkt_option_werte TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_produkt_option_werte TO authenticated;
GRANT ALL ON public.shop_produkt_option_werte TO service_role;

ALTER TABLE public.shop_product_optionen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_produkt_option_werte ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read optionen" ON public.shop_product_optionen FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage optionen" ON public.shop_product_optionen FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public read option werte" ON public.shop_produkt_option_werte FOR SELECT TO anon, authenticated USING (aktiv = true);
CREATE POLICY "Admins manage option werte" ON public.shop_produkt_option_werte FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));