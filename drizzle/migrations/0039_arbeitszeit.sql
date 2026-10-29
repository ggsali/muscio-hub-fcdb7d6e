CREATE TABLE IF NOT EXISTS public.arbeitszeit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  start_at timestamptz NOT NULL DEFAULT now(),
  ende_at timestamptz,
  notiz text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ende_at IS NULL OR ende_at >= start_at)
);
CREATE INDEX IF NOT EXISTS idx_arbeitszeit_start ON public.arbeitszeit (start_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arbeitszeit TO authenticated;
GRANT ALL ON public.arbeitszeit TO service_role;
ALTER TABLE public.arbeitszeit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage arbeitszeit" ON public.arbeitszeit
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_arbeitszeit_updated_at BEFORE UPDATE ON public.arbeitszeit
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();