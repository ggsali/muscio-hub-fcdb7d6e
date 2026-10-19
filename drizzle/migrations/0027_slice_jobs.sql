-- Automatisches Slicen von Anfragen auf dem NAS: ein Eintrag pro Modelldatei.
-- Freigabe/Ablehnung geschieht im Admin (Seite /admin/slice-freigabe).
CREATE TABLE IF NOT EXISTS public.slice_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id uuid REFERENCES public.inquiries(id) ON DELETE CASCADE,
  filename text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  material text,
  farbe text,
  layer_height numeric,
  infill integer,
  nas_job_id text,
  printer text,
  stats jsonb,
  assessment jsonb,
  status text NOT NULL DEFAULT 'slicing'
    CHECK (status IN ('slicing', 'pending', 'approved', 'rejected', 'failed')),
  error text,
  simplyprint jsonb,
  decided_at timestamptz,
  decided_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS slice_jobs_inquiry_idx ON public.slice_jobs (inquiry_id);
CREATE INDEX IF NOT EXISTS slice_jobs_status_idx ON public.slice_jobs (status, created_at DESC);

ALTER TABLE public.slice_jobs ENABLE ROW LEVEL SECURITY;

-- Nur Admins lesen; geschrieben wird ausschliesslich von Edge Functions (Service Role).
CREATE POLICY "Admins read slice_jobs" ON public.slice_jobs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

NOTIFY pgrst, 'reload schema';
