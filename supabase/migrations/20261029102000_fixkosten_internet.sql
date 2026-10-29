-- Internetabo als Fixkosten (nur einfügen, wenn es noch keine Position "Internet" gibt)
INSERT INTO public.fixkosten (name, kategorie, betrag, intervall, notiz)
SELECT 'Internet', 'Raum/Strom', 9.90, 'monatlich', 'Internetabo'
WHERE NOT EXISTS (SELECT 1 FROM public.fixkosten WHERE name = 'Internet');
