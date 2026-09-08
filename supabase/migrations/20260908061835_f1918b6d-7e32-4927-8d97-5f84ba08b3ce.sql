CREATE TABLE public.filament_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material text NOT NULL,
  farbe text NOT NULL,
  hersteller text,
  farbcode text,
  mindestbestand integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.filament_types TO authenticated;
GRANT ALL ON public.filament_types TO service_role;

ALTER TABLE public.filament_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage filament types"
ON public.filament_types FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.filament_spools (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  spool_code text NOT NULL UNIQUE,
  filament_type_id uuid NOT NULL REFERENCES public.filament_types(id) ON DELETE CASCADE,
  gewicht_g numeric NOT NULL DEFAULT 1000,
  status text NOT NULL DEFAULT 'voll',
  printed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  emptied_at timestamptz
);

CREATE INDEX idx_filament_spools_type ON public.filament_spools(filament_type_id);
CREATE INDEX idx_filament_spools_status ON public.filament_spools(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.filament_spools TO authenticated;
GRANT ALL ON public.filament_spools TO service_role;

ALTER TABLE public.filament_spools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage filament spools"
ON public.filament_spools FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));