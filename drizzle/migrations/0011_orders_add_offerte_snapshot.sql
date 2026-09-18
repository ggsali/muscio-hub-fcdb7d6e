ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS offerte_snapshot JSONB;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS offerte_snapshot_at TIMESTAMPTZ;