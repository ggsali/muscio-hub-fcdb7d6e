
-- Settings table
CREATE TABLE public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage settings" ON public.settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert default settings
INSERT INTO public.settings (key, value) VALUES
  ('setup_pauschale', '20.00'),
  ('material_verkauf_pro_g', '0.055'),
  ('maschinenzeit_pro_h', '3.00'),
  ('nachbearbeitung_pro_h', '50.00'),
  ('konstruktion_pro_h', '65.00'),
  ('material_einkauf_pro_kg', '25.00'),
  ('strom_verschleiss_pro_h', '0.80'),
  ('skalierungsziel', '1500.00'),
  ('investitions_fonds_prozent', '20');

-- Customers table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  firma TEXT,
  email TEXT,
  telefon TEXT,
  adresse TEXT,
  notizen TEXT,
  aktiv BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage customers" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  beschreibung TEXT,
  datum DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'Offen' CHECK (status IN ('Offen', 'In Bearbeitung', 'Abgeschlossen', 'Storniert')),
  umsatz_total NUMERIC(10,2) DEFAULT 0,
  kosten_total NUMERIC(10,2) DEFAULT 0,
  gewinn_total NUMERIC(10,2) DEFAULT 0,
  marge NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage orders" ON public.orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Parts table
CREATE TABLE public.parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  teilname TEXT NOT NULL,
  material TEXT DEFAULT 'PLA' CHECK (material IN ('PLA', 'PETG', 'TPU', 'Sonstige')),
  menge INTEGER DEFAULT 1,
  gewicht_g NUMERIC(10,3) DEFAULT 0,
  druckzeit_h NUMERIC(10,3) DEFAULT 0,
  nachbearbeitung_h NUMERIC(10,3) DEFAULT 0,
  konstruktion_h NUMERIC(10,3) DEFAULT 0,
  preis_pro_stueck NUMERIC(10,2) DEFAULT 0,
  preis_total NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'Ausstehend' CHECK (status IN ('Ausstehend', 'In Druck', 'Fertig', 'Geliefert')),
  notizen TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage parts" ON public.parts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger for updated_at on orders
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
