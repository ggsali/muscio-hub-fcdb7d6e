-- Entwickler-Bereich "Labor" (/labor): Protokoll der Testlaeufe.
-- Bewusst getrennt von orders, inquiries, customers: keine Fremdschluessel dorthin.
CREATE TABLE IF NOT EXISTS public.lab_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  kind text NOT NULL CHECK (kind IN ('slicer', 'kalkulator', 'spardose')),
  filename text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text
);

CREATE INDEX IF NOT EXISTS lab_jobs_created_idx ON public.lab_jobs (created_at DESC);

ALTER TABLE public.lab_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read lab_jobs" ON public.lab_jobs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert lab_jobs" ON public.lab_jobs
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update lab_jobs" ON public.lab_jobs
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete lab_jobs" ON public.lab_jobs
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

NOTIFY pgrst, 'reload schema';
