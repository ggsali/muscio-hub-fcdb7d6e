-- Startwerte für die Rentabilität (ungefähre CHF-Beträge, im Admin unter Finanzen > Rentabilität anpassbar).
-- Nur einfügen, wenn die Tabelle noch leer ist.
INSERT INTO public.fixkosten (name, kategorie, betrag, intervall, gueltig_ab, gueltig_bis, notiz)
SELECT v.name, v.kategorie, v.betrag, v.intervall, v.gueltig_ab::date, v.gueltig_bis::date, v.notiz
FROM (VALUES
  ('Drucker-Abschreibung (CHF 5''042 über 3 Jahre)', 'Abschreibung', 140, 'monatlich', NULL, NULL, 'H2C 2600, K2 Plus 1123, A1 450, K1C 460, K1 409'),
  ('Lovable', 'Software/Abos', 23, 'monatlich', NULL, NULL, '25 EUR pro Monat'),
  ('SimplyPrint (mit 30 % Rabatt)', 'Software/Abos', 23, 'monatlich', NULL, '2027-01-11', '28.83 USD, Rabatt 3 Monate'),
  ('SimplyPrint (regulär)', 'Software/Abos', 33, 'monatlich', '2027-01-12', NULL, '41.19 USD nach Rabatt'),
  ('IONOS', 'Software/Abos', 6, 'monatlich', NULL, NULL, '6.36 EUR')
) AS v(name, kategorie, betrag, intervall, gueltig_ab, gueltig_bis, notiz)
WHERE NOT EXISTS (SELECT 1 FROM public.fixkosten);
