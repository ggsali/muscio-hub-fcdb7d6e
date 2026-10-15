-- Gutschein aus Kalkulator-Anfragen in Aufträge übernehmen (eigener Abschnitt, eigene Zeile auf Offerte/Rechnung)
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS gutschein jsonb;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS gutschein_code text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS gutschein_typ text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS gutschein_wert numeric NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS gutschein_betrag numeric NOT NULL DEFAULT 0;

NOTIFY pgrst, 'reload schema';
