CREATE TABLE public.timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jahr text NOT NULL,
  titel text NOT NULL,
  beschreibung text,
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  aktiv boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active timeline_events"
ON public.timeline_events FOR SELECT
TO anon, authenticated
USING (aktiv = true);

CREATE POLICY "Admins manage timeline_events"
ON public.timeline_events FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_timeline_events_updated_at
BEFORE UPDATE ON public.timeline_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.timeline_events (jahr, titel, beschreibung, icon, sort_order) VALUES
('2021', 'Der Anfang', 'Mit einem einzigen FDM-Drucker in der Garage starten wir 3DMuscio.', 'Sparkles', 1),
('2022', 'Erste Aufträge', 'Lokale Kunden entdecken uns – die Druckerflotte wächst auf 3 Geräte.', 'Rocket', 2),
('2023', 'SLA-Resin', 'Erweiterung um SLA-Drucker für hochpräzise Detailteile.', 'Layers', 3),
('2024', 'Online-Plattform', 'Eigener Konfigurator und Webshop gehen live.', 'Globe', 4),
('2025', 'Neue Werkstatt', 'Umzug in grössere Räumlichkeiten in Eschlikon TG.', 'Building2', 5);