-- Farbe pro Teil (aus der Filamentbibliothek, wird im Auftrag gewählt bzw. aus der Kalkulator-Anfrage übernommen)
ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS farbe text;
