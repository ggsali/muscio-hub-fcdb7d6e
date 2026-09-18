ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_status text,
  ADD COLUMN IF NOT EXISTS tracking_status_detail text,
  ADD COLUMN IF NOT EXISTS tracking_zuletzt_geprueft timestamptz,
  ADD COLUMN IF NOT EXISTS tracking_zugestellt boolean DEFAULT false;