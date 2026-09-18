DROP POLICY IF EXISTS "Public read active filaments" ON public.filaments;

CREATE POLICY "Public read active filaments"
ON public.filaments FOR SELECT TO anon
USING (aktiv = true AND (nur_intern IS NULL OR nur_intern = false));