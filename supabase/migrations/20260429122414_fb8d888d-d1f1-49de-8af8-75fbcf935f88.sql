-- Categories
CREATE TABLE public.shop_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  beschreibung TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  aktiv BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.shop_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read shop_categories" ON public.shop_categories FOR SELECT USING (true);
CREATE POLICY "Admins manage shop_categories" ON public.shop_categories FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Products
CREATE TABLE public.shop_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  kurzbeschreibung TEXT,
  beschreibung TEXT,
  preis NUMERIC(10,2) NOT NULL DEFAULT 0,
  vergleichspreis NUMERIC(10,2),
  material TEXT,
  lagerbestand INTEGER NOT NULL DEFAULT 0,
  unendlich_bestand BOOLEAN NOT NULL DEFAULT false,
  featured BOOLEAN NOT NULL DEFAULT false,
  aktiv BOOLEAN NOT NULL DEFAULT true,
  tags TEXT[],
  sort_order INTEGER NOT NULL DEFAULT 0,
  kategorie_id UUID REFERENCES public.shop_categories(id) ON DELETE SET NULL,
  stripe_price_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.shop_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read shop_products" ON public.shop_products FOR SELECT USING (true);
CREATE POLICY "Admins manage shop_products" ON public.shop_products FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_shop_products_updated BEFORE UPDATE ON public.shop_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Product images
CREATE TABLE public.shop_product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.shop_products(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.shop_product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read shop_product_images" ON public.shop_product_images FOR SELECT USING (true);
CREATE POLICY "Admins manage shop_product_images" ON public.shop_product_images FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Orders
CREATE TABLE public.shop_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  shipping_address TEXT NOT NULL,
  shipping_city TEXT NOT NULL,
  shipping_postal_code TEXT NOT NULL,
  shipping_country TEXT NOT NULL DEFAULT 'Schweiz',
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  shipping NUMERIC(10,2) NOT NULL DEFAULT 0,
  mwst NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  stripe_session_id TEXT UNIQUE,
  paid_at TIMESTAMPTZ,
  notiz TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own shop_orders" ON public.shop_orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins manage shop_orders" ON public.shop_orders FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_shop_orders_updated BEFORE UPDATE ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Order items
CREATE TABLE public.shop_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.shop_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_slug TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.shop_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own shop_order_items" ON public.shop_order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shop_orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
CREATE POLICY "Admins manage shop_order_items" ON public.shop_order_items FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Storage bucket for product images
INSERT INTO storage.buckets (id, name, public) VALUES ('shop-products', 'shop-products', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read shop-products bucket" ON storage.objects FOR SELECT
  USING (bucket_id = 'shop-products');
CREATE POLICY "Admins write shop-products bucket" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'shop-products' AND has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update shop-products bucket" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'shop-products' AND has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete shop-products bucket" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'shop-products' AND has_role(auth.uid(), 'admin'));

-- Seed Kategorien
INSERT INTO public.shop_categories (name, slug, sort_order) VALUES
  ('Alle', 'alle', 0),
  ('Deko', 'deko', 1),
  ('Werkzeug', 'werkzeug', 2),
  ('Geschenke', 'geschenke', 3),
  ('Zubehör', 'zubehoer', 4)
ON CONFLICT (slug) DO NOTHING;