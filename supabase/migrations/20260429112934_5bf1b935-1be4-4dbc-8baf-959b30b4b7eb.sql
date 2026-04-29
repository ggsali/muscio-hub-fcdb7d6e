-- 1. orders: source + interne Notizen
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS notes_internal TEXT;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_source_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_source_check CHECK (source IN ('manual','website'));

CREATE INDEX IF NOT EXISTS idx_orders_source ON public.orders(source);

-- 2. customers: Auth-Verknüpfung
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS auth_user_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email_lower
  ON public.customers (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_auth_user_id
  ON public.customers(auth_user_id);

-- 3. email_templates
CREATE TABLE IF NOT EXISTS public.email_templates (
  status_key TEXT PRIMARY KEY,
  betreff TEXT NOT NULL,
  nachricht TEXT NOT NULL,
  aktiv BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated manage email_templates" ON public.email_templates;
CREATE POLICY "Authenticated manage email_templates"
  ON public.email_templates FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.email_templates (status_key, betreff, nachricht) VALUES
  ('datei_erhalten',     'Wir haben deine Dateien erhalten – {{auftragsnummer}}',
   'Hallo {{vorname}},\n\nvielen Dank für deine Bestellung! Wir haben deine Dateien erhalten und prüfen sie nun.\n\nDu wirst informiert, sobald der Druck startet.\n\nBeste Grüsse\n3DMuscio'),
  ('im_druck',           'Dein Auftrag ist im Druck – {{auftragsnummer}}',
   'Hallo {{vorname}},\n\ndein Auftrag {{auftragsnummer}} befindet sich nun im Druck.\n\nWir melden uns, sobald die Qualitätsprüfung startet.\n\nBeste Grüsse\n3DMuscio'),
  ('qualitaetspruefung', 'Qualitätsprüfung läuft – {{auftragsnummer}}',
   'Hallo {{vorname}},\n\ndein Auftrag {{auftragsnummer}} wurde gedruckt und befindet sich jetzt in der Qualitätsprüfung.\n\nBeste Grüsse\n3DMuscio'),
  ('versandt',           'Deine Bestellung wurde versandt – {{auftragsnummer}}',
   'Hallo {{vorname}},\n\ndein Auftrag {{auftragsnummer}} wurde soeben versandt und sollte in den nächsten Tagen bei dir eintreffen.\n\nBeste Grüsse\n3DMuscio'),
  ('geliefert',          'Auftrag geliefert – {{auftragsnummer}}',
   'Hallo {{vorname}},\n\ndein Auftrag {{auftragsnummer}} wurde geliefert. Wir hoffen, du bist zufrieden!\n\nBei Fragen oder Feedback antworte gerne auf diese Mail.\n\nBeste Grüsse\n3DMuscio')
ON CONFLICT (status_key) DO NOTHING;

-- 4. website_settings
CREATE TABLE IF NOT EXISTS public.website_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read website_settings" ON public.website_settings;
CREATE POLICY "Public can read website_settings"
  ON public.website_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated manage website_settings" ON public.website_settings;
CREATE POLICY "Authenticated manage website_settings"
  ON public.website_settings FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.website_settings (key, value) VALUES
  ('wartungsmodus',   '{"aktiv": false, "nachricht": "Wir sind in Kürze wieder online."}'::jsonb),
  ('kontakt_info',    '{"email": "info@3dmuscio.com", "telefon": "", "adresse": ""}'::jsonb),
  ('faq',             '{"eintraege": []}'::jsonb),
  ('material_preise', '{"eintraege": []}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 5. updated_at Trigger
DROP TRIGGER IF EXISTS trg_email_templates_updated ON public.email_templates;
CREATE TRIGGER trg_email_templates_updated
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_website_settings_updated ON public.website_settings;
CREATE TRIGGER trg_website_settings_updated
  BEFORE UPDATE ON public.website_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();