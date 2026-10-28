-- Aktivitätsverlauf: gesendete Dokumente (Rechnung, Offerte, ...) als PDF verlinken
ALTER TABLE public.order_status_log ADD COLUMN IF NOT EXISTS file_path text;
ALTER TABLE public.order_status_log ADD COLUMN IF NOT EXISTS filename text;