-- Admin: persönliche To-Do-Liste
CREATE TABLE IF NOT EXISTS public.admin_todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titel text NOT NULL,
  notiz text,
  prioritaet text NOT NULL DEFAULT 'normal' CHECK (prioritaet IN ('hoch', 'normal', 'niedrig')),
  faellig_am date,
  erledigt boolean NOT NULL DEFAULT false,
  erledigt_am timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_todos ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_todos TO authenticated;
GRANT ALL ON public.admin_todos TO service_role;

CREATE POLICY "Admin manage admin_todos" ON public.admin_todos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
