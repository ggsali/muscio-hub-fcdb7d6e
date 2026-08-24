GRANT SELECT ON public.filaments TO anon;

DROP POLICY IF EXISTS "Public read active filaments" ON public.filaments;
CREATE POLICY "Public read active filaments"
ON public.filaments
FOR SELECT
TO anon
USING (aktiv = true);