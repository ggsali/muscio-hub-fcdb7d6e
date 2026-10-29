-- Raumkosten als Fixkosten (nur einfügen, wenn es noch keine Position "Raumkosten" gibt)
INSERT INTO public.fixkosten (name, kategorie, betrag, intervall, notiz)
SELECT 'Raumkosten', 'Raum/Strom', 320.70, 'monatlich', 'Miete Raum'
WHERE NOT EXISTS (SELECT 1 FROM public.fixkosten WHERE name = 'Raumkosten');
