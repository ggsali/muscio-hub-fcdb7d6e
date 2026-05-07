-- Feature 1: Bewertungs-Token in orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS bewertungs_token uuid;
CREATE INDEX IF NOT EXISTS idx_orders_bewertungs_token ON public.orders(bewertungs_token);

-- Feature 3: STL-URL für Projekte + Storage Bucket
ALTER TABLE public.projekte ADD COLUMN IF NOT EXISTS stl_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('project-stls', 'project-stls', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read project-stls" ON storage.objects;
CREATE POLICY "Public read project-stls"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-stls');

DROP POLICY IF EXISTS "Admins manage project-stls" ON storage.objects;
CREATE POLICY "Admins manage project-stls"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'project-stls' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'project-stls' AND public.has_role(auth.uid(), 'admin'));

-- Feature 4: Blog-Tabelle
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titel text NOT NULL,
  slug text NOT NULL UNIQUE,
  inhalt text NOT NULL DEFAULT '',
  zusammenfassung text,
  titelbild_url text,
  autor text NOT NULL DEFAULT '3DMuscio Team',
  veroeffentlicht boolean NOT NULL DEFAULT false,
  veroeffentlicht_am timestamptz,
  tags text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read published blog_posts" ON public.blog_posts;
CREATE POLICY "Public read published blog_posts"
ON public.blog_posts FOR SELECT
USING (veroeffentlicht = true);

DROP POLICY IF EXISTS "Admins manage blog_posts" ON public.blog_posts;
CREATE POLICY "Admins manage blog_posts"
ON public.blog_posts FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER blog_posts_updated_at
BEFORE UPDATE ON public.blog_posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Feature 5: Referrals
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  referred_email text,
  referred_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'ausstehend',
  rabatt_code text NOT NULL UNIQUE,
  rabatt_prozent integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_customer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON public.referrals(rabatt_code);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage referrals" ON public.referrals;
CREATE POLICY "Admins manage referrals"
ON public.referrals FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Customers read own referrals" ON public.referrals;
CREATE POLICY "Customers read own referrals"
ON public.referrals FOR SELECT TO authenticated
USING (referrer_customer_id IN (
  SELECT id FROM public.customers WHERE auth_user_id = auth.uid()
));

DROP POLICY IF EXISTS "Public read referral by code" ON public.referrals;
CREATE POLICY "Public read referral by code"
ON public.referrals FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated insert referrals" ON public.referrals;
CREATE POLICY "Authenticated insert referrals"
ON public.referrals FOR INSERT TO authenticated
WITH CHECK (referrer_customer_id IN (
  SELECT id FROM public.customers WHERE auth_user_id = auth.uid()
));

DROP POLICY IF EXISTS "Anyone update referred fields" ON public.referrals;
CREATE POLICY "Anyone update referred fields"
ON public.referrals FOR UPDATE TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Seed 3 Blog Posts
INSERT INTO public.blog_posts (titel, slug, zusammenfassung, inhalt, veroeffentlicht, veroeffentlicht_am, tags) VALUES
('PLA vs PETG — Welches Material für dein Projekt?',
 'pla-vs-petg',
 'Die wichtigsten Unterschiede zwischen PLA und PETG — und wann du welches Material wählen solltest.',
 E'# PLA vs PETG\n\nPLA und PETG sind die zwei beliebtesten Materialien im FDM-Druck. Beide haben ihre Stärken — die Wahl hängt vom Einsatzzweck ab.\n\n## PLA — der Allrounder\n\n- Einfach zu drucken\n- Hohe Detailtreue\n- Geringe Schrumpfung\n- Nicht für Hitze geeignet (ab ~60°C weich)\n\n## PETG — der Robuste\n\n- Schlagfest und elastisch\n- Hitzebeständig bis ca. 80°C\n- Lebensmittelecht\n- Etwas anspruchsvoller im Druck\n\n## Fazit\n\nFür Deko, Prototypen und Modelle → **PLA**. Für funktionale Bauteile, Outdoor-Einsatz oder Hitze → **PETG**.',
 true, now(), ARRAY['Material', 'PLA', 'PETG']),
('Wie funktioniert 3D-Druck? Ein Überblick',
 'wie-funktioniert-3d-druck',
 'Vom 3D-Modell zum fertigen Objekt — so läuft der 3D-Druck Schritt für Schritt ab.',
 E'# Wie funktioniert 3D-Druck?\n\n3D-Druck (additive Fertigung) baut Objekte Schicht für Schicht aus geschmolzenem Kunststoff auf.\n\n## Die Schritte\n\n1. **3D-Modell** — Du gestaltest oder lädst eine STL-Datei\n2. **Slicing** — Spezielle Software zerlegt das Modell in dünne Schichten\n3. **Drucken** — Der Druckkopf trägt das Material schichtweise auf\n4. **Nachbearbeitung** — Stützstrukturen entfernen, schleifen, lackieren\n\n## Vorteile\n\n- Komplexe Geometrien ohne teure Werkzeuge\n- Schnelle Prototypen\n- Individuelle Einzelstücke\n\nMehr Fragen? [Kontaktiere uns](https://3dmuscio.com/kontakt).',
 true, now(), ARRAY['Grundlagen', '3D-Druck']),
('Tipps für perfekte 3D-Drucke — Infill und Wandstärke erklärt',
 'tipps-infill-wandstaerke',
 'Wie viel Infill brauchst du wirklich? Und wann lohnt sich eine dickere Wand?',
 E'# Infill und Wandstärke\n\nZwei Parameter entscheiden über Stabilität, Druckzeit und Kosten: **Infill** und **Wandstärke**.\n\n## Infill\n\nDie innere Füllung des Druckteils — meist 15–30 % reichen.\n\n- 10–20 %: Deko & Modelle\n- 20–40 %: Funktionale Teile\n- 50 %+: Hohe Belastung\n\n## Wandstärke\n\nMehr Wände = mehr Stabilität:\n\n- 2 Wände: Standard\n- 3–4 Wände: Belastbare Teile\n- 5+ Wände: Maximale Festigkeit\n\n## Tipp\n\nMehr Wände bringen mehr Stabilität als hoher Infill — bei weniger Materialverbrauch.',
 true, now(), ARRAY['Tipps', 'Druckqualität'])
ON CONFLICT (slug) DO NOTHING;