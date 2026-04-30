-- Add additional spec fields to projekte
ALTER TABLE public.projekte 
  ADD COLUMN IF NOT EXISTS verfahren text,
  ADD COLUMN IF NOT EXISTS material text,
  ADD COLUMN IF NOT EXISTS toleranz text,
  ADD COLUMN IF NOT EXISTS lieferzeit text,
  ADD COLUMN IF NOT EXISTS bild_url text;

-- Trigger to keep updated_at fresh on projekte and reviews
DROP TRIGGER IF EXISTS trg_projekte_updated_at ON public.projekte;
CREATE TRIGGER trg_projekte_updated_at BEFORE UPDATE ON public.projekte
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS trg_reviews_updated_at ON public.reviews;
CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Realtime for chat
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.chat_sessions REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_sessions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;