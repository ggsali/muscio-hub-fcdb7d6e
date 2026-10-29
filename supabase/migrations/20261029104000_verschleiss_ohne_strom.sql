-- Strom steckt jetzt in den Raumkosten (Fixkosten). "Strom & Verschleiss pro Stunde" deckt nur noch den Verschleiss ab (Schätzung CHF 0.15/h).
-- Betrifft nur interne Kosten (Gewinn/Rentabilität), keine Kundenpreise. Nur der Standardwert 0.80 wird ersetzt, eigene Werte bleiben.
UPDATE public.settings SET value = '0.15' WHERE key = 'strom_verschleiss_pro_h' AND value IN ('0.8', '0.80', '0.800');
UPDATE public.price_presets SET strom_verschleiss_pro_h = 0.15 WHERE strom_verschleiss_pro_h = 0.80;
