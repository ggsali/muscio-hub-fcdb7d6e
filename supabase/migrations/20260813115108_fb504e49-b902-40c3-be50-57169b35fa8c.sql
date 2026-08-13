ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS slicer_druckzeit_sekunden integer,
  ADD COLUMN IF NOT EXISTS slicer_filament_gramm numeric,
  ADD COLUMN IF NOT EXISTS slicer_hat_supports boolean,
  ADD COLUMN IF NOT EXISTS slicer_layer_anzahl integer;

ALTER TABLE public.calculator_uploads
  ADD COLUMN IF NOT EXISTS slicer_druckzeit_sekunden integer,
  ADD COLUMN IF NOT EXISTS slicer_filament_gramm numeric,
  ADD COLUMN IF NOT EXISTS slicer_hat_supports boolean,
  ADD COLUMN IF NOT EXISTS slicer_layer_anzahl integer;