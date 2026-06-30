
CREATE TABLE public.print_plates (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  equipment_id uuid references public.equipment(id) on delete set null,
  name text not null default 'Druckplatte',
  status text not null default 'geplant',
  zip_path text,
  notiz text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.print_plates TO authenticated;
GRANT ALL ON public.print_plates TO service_role;
ALTER TABLE public.print_plates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage print_plates"
  ON public.print_plates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_print_plates_updated BEFORE UPDATE ON public.print_plates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.print_plate_parts (
  id uuid primary key default gen_random_uuid(),
  plate_id uuid not null references public.print_plates(id) on delete cascade,
  part_id uuid not null references public.parts(id) on delete cascade,
  menge integer not null default 1,
  pos_x_mm numeric,
  pos_y_mm numeric,
  rot_deg numeric not null default 0,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.print_plate_parts TO authenticated;
GRANT ALL ON public.print_plate_parts TO service_role;
ALTER TABLE public.print_plate_parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage print_plate_parts"
  ON public.print_plate_parts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_print_plate_parts_plate ON public.print_plate_parts(plate_id);
CREATE INDEX idx_print_plate_parts_part ON public.print_plate_parts(part_id);
