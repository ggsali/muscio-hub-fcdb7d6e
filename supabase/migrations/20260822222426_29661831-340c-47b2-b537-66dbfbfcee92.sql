ALTER TABLE public.newsletter_empfaenger
  ADD COLUMN IF NOT EXISTS geoeffnet BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS geoeffnet_am TIMESTAMPTZ;

ALTER TABLE public.newsletters
  ADD COLUMN IF NOT EXISTS geoeffnet_anzahl INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ist_ab_test BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ab_variante TEXT,
  ADD COLUMN IF NOT EXISTS ab_gruppe_id UUID,
  ADD COLUMN IF NOT EXISTS automation_id UUID;

CREATE TABLE IF NOT EXISTS public.newsletter_klicks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  newsletter_empfaenger_id UUID REFERENCES public.newsletter_empfaenger(id) ON DELETE CASCADE,
  newsletter_id UUID REFERENCES public.newsletters(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  geklickt_am TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.newsletter_klicks TO authenticated;
GRANT ALL ON public.newsletter_klicks TO service_role;
ALTER TABLE public.newsletter_klicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view newsletter clicks" ON public.newsletter_klicks
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.newsletter_automationen (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  typ TEXT NOT NULL,
  aktiv BOOLEAN NOT NULL DEFAULT true,
  tage_verzoegerung INTEGER NOT NULL DEFAULT 90,
  betreff_vorlage TEXT,
  inhalt_vorlage TEXT,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.newsletter_automationen TO authenticated;
GRANT ALL ON public.newsletter_automationen TO service_role;
ALTER TABLE public.newsletter_automationen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage newsletter automations" ON public.newsletter_automationen
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.newsletter_automation_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id UUID REFERENCES public.newsletter_automationen(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  gesendet_am TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.newsletter_automation_log TO authenticated;
GRANT ALL ON public.newsletter_automation_log TO service_role;
ALTER TABLE public.newsletter_automation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view newsletter automation log" ON public.newsletter_automation_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.newsletter_segmente (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  filter_json JSONB NOT NULL,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.newsletter_segmente TO authenticated;
GRANT ALL ON public.newsletter_segmente TO service_role;
ALTER TABLE public.newsletter_segmente ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage newsletter segments" ON public.newsletter_segmente
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.newsletter_automationen (typ, aktiv, tage_verzoegerung, betreff_vorlage, inhalt_vorlage)
SELECT 'reaktivierung', false, 90, 'Zeit für Ihr nächstes 3D-Druck-Projekt?',
  E'Guten Tag [Kundenname],\n\nes ist eine Weile her seit Ihrem letzten Auftrag bei 3DMuscio. Falls Sie aktuell ein Bauteil, einen Prototyp oder ein Ersatzteil benötigen: Wir liefern in der Regel innerhalb von 48 Stunden aus Eschlikon TG.\n\nBerechnen Sie Ihren Preis in wenigen Sekunden online – einfach Datei hochladen und Sie sehen den Preis sofort.\n\nFreundliche Grüsse,\nJorim Moos\n3DMuscio'
WHERE NOT EXISTS (SELECT 1 FROM public.newsletter_automationen WHERE typ = 'reaktivierung');

INSERT INTO public.newsletter_automationen (typ, aktiv, tage_verzoegerung, betreff_vorlage, inhalt_vorlage)
SELECT 'nach_erstem_auftrag', false, 30, 'Wie war Ihre Erfahrung mit 3DMuscio?',
  E'Guten Tag [Kundenname],\n\nvor rund einem Monat haben wir Ihren ersten Auftrag bei 3DMuscio gefertigt. Wir würden gerne wissen: Wie war Ihre Erfahrung mit dem Ergebnis?\n\nFalls Sie bereits das nächste Projekt planen – Prototyp, Kleinserie oder Ersatzteil – berechnen Sie den Preis direkt online.\n\nFreundliche Grüsse,\nJorim Moos\n3DMuscio'
WHERE NOT EXISTS (SELECT 1 FROM public.newsletter_automationen WHERE typ = 'nach_erstem_auftrag');