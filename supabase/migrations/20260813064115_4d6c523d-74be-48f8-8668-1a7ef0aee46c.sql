ALTER TABLE public.projekte
ADD COLUMN IF NOT EXISTS seo_title text,
ADD COLUMN IF NOT EXISTS seo_description text,
ADD COLUMN IF NOT EXISTS tags text[],
ADD COLUMN IF NOT EXISTS json_ld jsonb;

UPDATE public.projekte
SET
  seo_title = '3D Druck Druckgussmaschinen-Modell für Bühler AG – 3DMuscio',
  seo_description = '3DMuscio hat für die Bühler AG ein massstabsgetreues 3D-gedrucktes Modell einer Druckgussmaschine gefertigt. FDM-Druck, PLA, Mehrfarbig. 3D Druckservice Schweiz.',
  tags = ARRAY['FDM Druck', 'PLA', 'Massstabsmodell', 'Industriemodell', 'Druckgussmaschine', 'Bühler AG', '3D Druck Schweiz'],
  json_ld = '{"@context":"https://schema.org","@type":"CreativeWork","name":"Massstabsmodell Druckgussmaschine – Bühler AG","creator":{"@type":"Organization","name":"3DMuscio"},"description":"Massstabsgetreues 3D-gedrucktes Modell einer Druckgussmaschine für die Bühler AG, gefertigt mit FDM-Technologie.","material":"PLA","locationCreated":{"@type":"Place","name":"Eschlikon, Thurgau, Schweiz"}}'::jsonb,
  beschreibung = 'Die Bühler AG beauftragte 3DMuscio mit der Fertigung eines massstabsgetreuen Modells einer Druckgussmaschine. Ziel war es, Kunden und Interessenten ein haptisches, detailgetreues Demonstrationsobjekt zu präsentieren, das die komplexe Geometrie und Funktionsweise der Maschine anschaulich macht. Auf Basis von CAD-Daten und Referenzbildern erstellten wir ein optimiertes Druckmodell, das alle wesentlichen Bauteile, Bedienelemente und charakteristischen Konturen der Druckgussmaschine abbildet.

Für das Projekt setzten wir auf das bewährte FDM-Druckverfahren (Fused Deposition Modeling), das eine kosteneffiziente und stabile Fertigung grösserer Bauteile ermöglicht. Als Material wählten wir PLA in mehreren Farben, um die verschiedenen Baugruppen und Funktionsbereiche der Maschine visuell voneinander abzugrenzen. Dank präziser Schichtaufbauten und sorgfältiger Nachbearbeitung erreichten wir eine hohe Oberflächenqualität und ein sauberes Erscheinungsbild.

Besonderheit des Modells ist die Kombination aus mechanischen Details und farblich abgestuften Komponenten, die das industrielle Original auf einen Blick erkennbar macht. Innerhalb von zwei Wochen fertigten wir das Mehrfarbmodell in 0.2 mm Toleranz und lieferten es betriebsbereit an die Bühler AG aus. Das Ergebnis überzeugt durch Präzision, Detailtreue und eine hohe Wiedererkennung – ideal für Messen, Präsentationen und Kundengespräche.'
WHERE slug = 'buehler-druckgussmaschine';