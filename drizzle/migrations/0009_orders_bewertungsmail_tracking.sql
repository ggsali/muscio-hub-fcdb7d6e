ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS bewertungsmail_gesendet_at timestamptz,
  ADD COLUMN IF NOT EXISTS bewertungsmail_geoeffnet_at timestamptz,
  ADD COLUMN IF NOT EXISTS bewertungslink_geklickt_at timestamptz;