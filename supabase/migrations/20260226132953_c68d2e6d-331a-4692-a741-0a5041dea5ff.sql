
-- Price presets table
CREATE TABLE public.price_presets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  beschreibung text,
  is_default boolean DEFAULT false,
  setup_pauschale numeric DEFAULT 20,
  material_verkauf_pro_g numeric DEFAULT 0.055,
  maschinenzeit_pro_h numeric DEFAULT 3.00,
  nachbearbeitung_pro_h numeric DEFAULT 50.00,
  konstruktion_pro_h numeric DEFAULT 65.00,
  material_einkauf_pro_kg numeric DEFAULT 25.00,
  strom_verschleiss_pro_h numeric DEFAULT 0.80,
  rabatt_prozent numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.price_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage price_presets" ON public.price_presets FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Company settings table (for PDF branding)
CREATE TABLE public.company_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text,
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage company_settings" ON public.company_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage bucket for logo
INSERT INTO storage.buckets (id, name, public) VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload company assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'company-assets');

CREATE POLICY "Company assets are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-assets');

CREATE POLICY "Authenticated users can update company assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'company-assets');

CREATE POLICY "Authenticated users can delete company assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'company-assets');
