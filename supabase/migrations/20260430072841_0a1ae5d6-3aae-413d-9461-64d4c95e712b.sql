
-- Reviews / Bewertungen
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  rating INTEGER NOT NULL DEFAULT 5,
  kommentar TEXT,
  freigegeben BOOLEAN NOT NULL DEFAULT false,
  sichtbar_auf_website BOOLEAN NOT NULL DEFAULT true,
  order_id UUID,
  token TEXT UNIQUE DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  source TEXT DEFAULT 'website',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read approved reviews"
  ON public.reviews FOR SELECT TO anon, authenticated
  USING (freigegeben = true AND sichtbar_auf_website = true);

CREATE POLICY "Admins manage reviews"
  ON public.reviews FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public can submit reviews via token"
  ON public.reviews FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Projekte (Showcase)
CREATE TABLE public.projekte (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kurzbeschreibung TEXT,
  beschreibung TEXT,
  kategorie TEXT,
  hero_image_path TEXT,
  gallery_paths TEXT[] DEFAULT '{}',
  featured BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  aktiv BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projekte ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active projekte"
  ON public.projekte FOR SELECT TO anon, authenticated
  USING (aktiv = true);

CREATE POLICY "Admins manage projekte"
  ON public.projekte FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_projekte_updated_at
  BEFORE UPDATE ON public.projekte
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Partners
CREATE TABLE public.partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  logo_path TEXT,
  website_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  aktiv BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active partners"
  ON public.partners FOR SELECT TO anon, authenticated
  USING (aktiv = true);

CREATE POLICY "Admins manage partners"
  ON public.partners FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Shop-Bestellungen mit Projekt-Manager Auftrag verknüpfen
ALTER TABLE public.shop_orders
  ADD COLUMN IF NOT EXISTS order_id UUID;

CREATE INDEX IF NOT EXISTS idx_shop_orders_order_id ON public.shop_orders(order_id);

-- Storage Buckets (öffentlich) für Projekte und Partner
INSERT INTO storage.buckets (id, name, public)
VALUES ('projekte', 'projekte', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('partners', 'partners', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read projekte bucket"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'projekte');

CREATE POLICY "Admins manage projekte bucket"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'projekte' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'projekte' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public read partners bucket"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'partners');

CREATE POLICY "Admins manage partners bucket"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'partners' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'partners' AND public.has_role(auth.uid(), 'admin'));
