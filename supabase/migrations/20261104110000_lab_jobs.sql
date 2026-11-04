-- Labor: gespeicherte Testläufe (nur Admin). Enthält keine Kundendaten; Testkunde ist reiner Freitext im Testlauf.
CREATE TABLE IF NOT EXISTS public.lab_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'slicer',
  dateiname text,
  einstellungen jsonb NOT NULL DEFAULT '{}'::jsonb,
  ergebnis jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'fertig',
  fehler text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Falls die Tabelle schon existiert: Check-Bedingung auf kind ersetzen (bestehende Werte bleiben, 'ablauf' kommt dazu)
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.lab_jobs'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%kind%'
  LOOP
    EXECUTE format('ALTER TABLE public.lab_jobs DROP CONSTRAINT %I', c.conname);
  END LOOP;
  ALTER TABLE public.lab_jobs
    ADD CONSTRAINT lab_jobs_kind_check CHECK (kind IN ('slicer', 'kalkulator', 'spardose', 'ablauf'));
END $$;

CREATE INDEX IF NOT EXISTS idx_lab_jobs_created ON public.lab_jobs (created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_jobs TO authenticated;
GRANT ALL ON public.lab_jobs TO service_role;

ALTER TABLE public.lab_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage lab_jobs" ON public.lab_jobs;
CREATE POLICY "Admins manage lab_jobs" ON public.lab_jobs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
