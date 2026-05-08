ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS farben text[] NOT NULL DEFAULT '{}';
ALTER PUBLICATION supabase_realtime ADD TABLE public.materials;
ALTER TABLE public.materials REPLICA IDENTITY FULL;