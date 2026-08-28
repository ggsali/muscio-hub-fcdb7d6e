CREATE TABLE IF NOT EXISTS public.leistungen_seiten (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  titel TEXT NOT NULL,
  meta_title TEXT,
  meta_description TEXT,
  h1 TEXT,
  intro TEXT,
  inhalt TEXT,
  faq JSONB,
  aktiv BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lokale_seiten (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  region_name TEXT NOT NULL,
  meta_title TEXT,
  meta_description TEXT,
  aktiv BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT ON public.leistungen_seiten TO anon, authenticated;
GRANT ALL ON public.leistungen_seiten TO service_role;
GRANT SELECT ON public.lokale_seiten TO anon, authenticated;
GRANT ALL ON public.lokale_seiten TO service_role;

ALTER TABLE public.leistungen_seiten ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lokale_seiten ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read leistungen_seiten" ON public.leistungen_seiten;
CREATE POLICY "Public read leistungen_seiten" ON public.leistungen_seiten
  FOR SELECT TO anon, authenticated USING (aktiv = true);

DROP POLICY IF EXISTS "Public read lokale_seiten" ON public.lokale_seiten;
CREATE POLICY "Public read lokale_seiten" ON public.lokale_seiten
  FOR SELECT TO anon, authenticated USING (aktiv = true);

INSERT INTO public.leistungen_seiten (slug, titel, meta_title, meta_description, h1, intro, inhalt, faq) VALUES
('fdm-3d-druck','FDM 3D-Druck',
 'FDM 3D-Druck Schweiz – Prototypen & Funktionsteile | 3DMuscio',
 'FDM 3D-Druck für Prototypen, Funktionsteile und Kleinserien. PLA, PETG, ABS, ASA, TPU. Schnell gefertigt in Eschlikon TG, Schweiz.',
 'FDM 3D-Druck in der Schweiz',
 'FDM (Fused Deposition Modeling) ist das weitverbreitetste 3D-Druckverfahren. Schicht für Schicht wird Kunststofffilament aufgeschmolzen und zu Ihrem Bauteil aufgebaut. Bei 3DMuscio setzen wir FDM für Prototypen, Funktionsteile, Ersatzteile und Kleinserien ein.',
 $md$## Was ist FDM?

FDM steht für Fused Deposition Modeling. Ein Druckkopf erhitzt Kunststofffilament und trägt es präzise Schicht für Schicht auf. So entsteht Ihr Bauteil direkt aus Ihren 3D-Daten.

## Vorteile FDM

- Kostengünstig für Prototypen und kleine Stückzahlen
- Breite Materialauswahl ([PLA](/materialien/pla), [PETG](/materialien/petg), [ABS](/materialien/abs), [ASA](/materialien/asa), [TPU](/materialien/tpu))
- Grosse Bauteile möglich (bis 330 × 320 × 325 mm)
- Schnelle Lieferung in 48 Stunden
- Keine Mindestbestellmenge

## Typische Anwendungen

- Funktionsteile und Vorrichtungen
- Gehäuse und Abdeckungen
- [Prototypen](/leistungen/3d-druck-prototypen) für Designvalidierung
- [Ersatzteile](/leistungen/3d-druck-ersatzteile) die nicht mehr erhältlich sind
- Halterungen, Adapter, Clips

## Materialien

[PLA](/materialien/pla), [PETG](/materialien/petg), [ABS](/materialien/abs), [ASA](/materialien/asa), [TPU](/materialien/tpu) – je nach Anforderung an Temperatur, UV-Beständigkeit und Flexibilität.

## Toleranzen

Typische Massgenauigkeit: ±0.2 mm bei FDM-Teilen.

## Oberflächen

FDM-Teile zeigen Schichtlinien. Diese können durch Nachbearbeitung (Schleifen) reduziert werden. Für glatte Sichtflächen ist [SLA Resin](/leistungen/sla-3d-druck) besser geeignet.$md$,
 $j$[
  {"frage": "Welche Materialien bietet 3DMuscio für FDM an?", "antwort": "PLA, PETG, ABS, ASA und TPU. Jedes Material hat eigene Eigenschaften für verschiedene Anwendungen."},
  {"frage": "Wie gross können FDM-Teile sein?", "antwort": "Bis 330 × 320 × 325 mm auf dem Bambu Lab H2C."},
  {"frage": "Wie genau ist FDM?", "antwort": "Typische Massgenauigkeit ±0.2 mm."},
  {"frage": "Wie lange dauert FDM-Druck?", "antwort": "Lieferung in 48 Stunden nach Auftragsbestätigung."}
]$j$::jsonb),
('sla-3d-druck','SLA Resin 3D-Druck',
 'SLA Resin 3D-Druck Schweiz – Hochauflösend & präzise | 3DMuscio',
 'SLA Resin 3D-Druck für hochauflösende Bauteile. Glatte Oberflächen, feine Details. Schnell gefertigt in Eschlikon TG, Schweiz.',
 'SLA Resin 3D-Druck in der Schweiz',
 'SLA (Stereolithografie) verwendet UV-Licht um flüssiges Resin auszuhärten. Das Ergebnis sind hochauflösende Bauteile mit glatten Oberflächen und feinen Details – ideal für anspruchsvolle Sichtteile und präzise Modelle.',
 $md$## Was ist SLA?

SLA steht für Stereolithografie. Ein UV-Laser oder eine UV-Lichtquelle härtet flüssiges Kunstharz (Resin) schichtweise aus. So entstehen Bauteile mit sehr hoher Detailgenauigkeit und glatten Oberflächen.

## Vorteile SLA

- Sehr hohe Auflösung und Detailgenauigkeit
- Glatte Oberflächen ohne sichtbare Schichtlinien
- Ideal für Sichtteile und Modelle
- Feine Strukturen möglich

## Typische Anwendungen

- Architekturmodelle und Präsentationsmodelle
- Schmuck und Designobjekte
- Medizinische Anschauungsmodelle
- Kleine Funktionsteile mit hoher Präzision
- [Produktprototypen](/leistungen/3d-druck-prototypen) für Kundenpräsentationen

## Grenzen

- Kleinere Bauteile als [FDM](/leistungen/fdm-3d-druck)
- Resin ist empfindlicher als thermoplastische Kunststoffe
- Nachbearbeitung (Waschen, UV-Aushärten) notwendig

## Wann SLA wählen?

Wenn Oberflächenqualität und Detailgenauigkeit wichtiger sind als Materialfestigkeit. Direkter Vergleich: [FDM vs SLA](/vergleich/fdm-vs-sla).$md$,
 $j$[
  {"frage": "Was ist der Unterschied zwischen FDM und SLA?", "antwort": "FDM ist günstiger und eignet sich für Funktionsteile. SLA liefert glattere Oberflächen und höhere Detailgenauigkeit."},
  {"frage": "Für welche Teile empfiehlt sich SLA?", "antwort": "Sichtteile, Modelle, feine Details, Schmuck, Architekturmodelle."},
  {"frage": "Wie glatt sind SLA-Oberflächen?", "antwort": "Sehr glatt – die Schichtlinien sind kaum sichtbar."}
]$j$::jsonb),
('3d-druck-prototypen','Rapid Prototyping',
 'Prototyp drucken lassen Schweiz – Rapid Prototyping | 3DMuscio',
 'Prototypen in 48h gefertigt. Von der Idee zum physischen Prototyp. FDM und SLA in Eschlikon TG, Schweiz.',
 'Rapid Prototyping – Prototypen in 48 Stunden',
 'Von der Idee zum physischen Prototyp in kürzester Zeit. 3DMuscio fertigt Prototypen für Designvalidierung, Funktionsprüfung und Präsentationen – ohne Mindestmenge, direkt aus Ihren 3D-Daten.',
 $md$## Was ist Rapid Prototyping?

Rapid Prototyping bezeichnet die schnelle Herstellung von Prototypen direkt aus 3D-Daten. Ohne teure Werkzeuge oder Formen kann Ihr Bauteil innerhalb von Stunden physisch vorliegen.

## Vorteile bei 3DMuscio

- Lieferung in 48 Stunden
- Ab 1 Stück, keine Mindestmenge
- [FDM](/leistungen/fdm-3d-druck) und [SLA](/leistungen/sla-3d-druck) je nach Anforderung
- Mehrere Iterationen günstig möglich
- Direkte Kommunikation

## Typische Projektabläufe

1. STL oder STEP Datei hochladen
2. Material und Qualität wählen
3. Sofortpreis erhalten
4. Produktion startet nach Auftragsbestätigung
5. Lieferung schweizweit in 48h

## Kostenfaktoren

- Bauteilvolumen und Gewicht
- Gewähltes [Material](/materialien)
- Qualitätsstufe (Schichthöhe)
- Menge – siehe [Kleinserien](/leistungen/3d-druck-kleinserien)$md$,
 $j$[
  {"frage": "Wie schnell bekomme ich meinen Prototyp?", "antwort": "In der Regel innerhalb von 48 Stunden nach Auftragsbestätigung."},
  {"frage": "Ab welcher Stückzahl kann ich bestellen?", "antwort": "Ab 1 Stück. Keine Mindestbestellmenge."},
  {"frage": "Welche Dateiformate werden akzeptiert?", "antwort": "STL, STEP, 3MF und OBJ."}
]$j$::jsonb),
('3d-druck-ersatzteile','Ersatzteile drucken lassen',
 'Ersatzteile drucken lassen Schweiz – 3DMuscio',
 'Ersatzteile die es nicht mehr gibt nachdrucken lassen. Nach STL, STEP oder Zeichnung. Schnell in Eschlikon TG, Schweiz.',
 'Ersatzteile drucken lassen – wenn es das Teil nicht mehr gibt',
 'Alte Maschinen, abgekündigte Produkte, Sonderteile – bei 3DMuscio lassen sich Ersatzteile nach Ihren 3D-Daten oder Zeichnungen schnell und günstig nachfertigen. Ab 1 Stück, schweizweit geliefert.',
 $md$## Wann lohnt sich 3D-Druck für Ersatzteile?

- Das Originalteil ist nicht mehr erhältlich
- Kleine Stückzahlen werden benötigt
- Lieferzeiten des Originalherstellers sind zu lang
- Das Teil soll aus einem robusteren Material gefertigt werden

## Geeignete Materialien für Ersatzteile

- [PETG](/materialien/petg): feuchtigkeitsbeständig, lebensmittelecht
- [ABS](/materialien/abs): hitzebeständig bis 100°C, schlagfest
- [ASA](/materialien/asa): UV-beständig, für den Aussenbereich
- [TPU](/materialien/tpu): flexibel, schlagabsorbierend

## Typische Einsatzfälle

- Gehäuseteile und Abdeckungen
- Clips, Halterungen, Adapter
- Zahnräder aus Kunststoff
- Knöpfe, Griffe, Bedienelemente
- Dichtungen und Puffer

Gedruckt wird meist im [FDM-Verfahren](/leistungen/fdm-3d-druck).$md$,
 $j$[
  {"frage": "Kann 3DMuscio Ersatzteile nach Fotos fertigen?", "antwort": "Wir benötigen 3D-Daten (STL, STEP). Aus Fotos allein können wir keine Teile fertigen."},
  {"frage": "Welches Material ist für Ersatzteile am besten?", "antwort": "Abhängig von den Anforderungen. PETG für allgemeine Anwendungen, ABS für Hitze, ASA für Aussenbereich, TPU für flexible Teile."},
  {"frage": "Wie viele Ersatzteile kann ich bestellen?", "antwort": "Ab 1 Stück. Grössere Mengen sind mit Mengenrabatt erhältlich."}
]$j$::jsonb),
('3d-druck-kleinserien','Kleinserienfertigung',
 '3D-Druck Kleinserien Schweiz – Ab 1 Stück | 3DMuscio',
 'Kleinserien ab 1 Stück. Kein Spritzguss, keine Mindestmenge. Schnell gefertigt in Eschlikon TG, Schweiz.',
 'Kleinserienfertigung mit 3D-Druck',
 'Kleine Stückzahlen wirtschaftlich fertigen – ohne teure Spritzgussformen. 3DMuscio produziert Kleinserien ab 1 Stück in gleichbleibender Qualität.',
 $md$## Wann ist 3D-Druck für Kleinserien sinnvoll?

- Stückzahlen zwischen 1 und einigen hundert Teilen
- Wenn Spritzgussformen zu teuer sind
- Für Produkttests und Marktvalidierung
- Wenn Geometrie zu komplex für klassische Fertigung

## Vorteile gegenüber Spritzguss

- Keine Werkzeugkosten (Spritzgussform: CHF 5.000–50.000)
- Ab 1 Stück bestellbar
- Geometriefreiheit
- Schnelle Designänderungen möglich

Details im Vergleich: [3D-Druck vs Spritzguss](/vergleich/3d-druck-vs-spritzguss).

## Qualitätskontrolle

Alle Teile werden vor dem Versand visuell geprüft.

## Skalierung

Bei steigendem Bedarf prüfen wir gemeinsam, ab wann alternative Fertigungsverfahren sinnvoll werden.$md$,
 $j$[
  {"frage": "Wie viele Teile kann ich als Kleinserie bestellen?", "antwort": "Ab 1 Stück. Für grössere Mengen erhalten Sie Mengenrabatte."},
  {"frage": "Wann lohnt sich 3D-Druck gegenüber Spritzguss?", "antwort": "Bis ca. 100-500 Stück je nach Teilgrösse. Danach wird Spritzguss günstiger."},
  {"frage": "Gibt es Mengenrabatte?", "antwort": "Ja. Ab 5 Stück 10% Rabatt, ab 10 Stück 15% Rabatt."}
]$j$::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  titel = EXCLUDED.titel, meta_title = EXCLUDED.meta_title, meta_description = EXCLUDED.meta_description,
  h1 = EXCLUDED.h1, intro = EXCLUDED.intro, inhalt = EXCLUDED.inhalt, faq = EXCLUDED.faq;

INSERT INTO public.lokale_seiten (slug, region_name, meta_title, meta_description) VALUES
('3d-druck-zuerich','Zürich','3D-Druck Zürich – Lieferung in 48h | 3DMuscio','3D-Druck Service für Zürich. FDM und SLA aus Eschlikon TG, schweizweit geliefert in 48h.'),
('3d-druck-winterthur','Winterthur','3D-Druck Winterthur – 3DMuscio','3D-Druckservice für Winterthur und Umgebung. Lieferung in 48h.'),
('3d-druck-st-gallen','St. Gallen','3D-Druck St. Gallen – 3DMuscio','3D-Druckservice für St. Gallen und Ostschweiz. Lieferung in 48h.'),
('3d-druck-ostschweiz','Ostschweiz','3D-Druck Ostschweiz – 3DMuscio','Ihr 3D-Druckservice in der Ostschweiz. Standort Eschlikon TG.'),
('3d-druck-bern','Bern','3D-Druck Bern – 3DMuscio','3D-Druck für Bern. FDM und SLA, Lieferung schweizweit in 48h.')
ON CONFLICT (slug) DO UPDATE SET
  region_name = EXCLUDED.region_name, meta_title = EXCLUDED.meta_title, meta_description = EXCLUDED.meta_description;