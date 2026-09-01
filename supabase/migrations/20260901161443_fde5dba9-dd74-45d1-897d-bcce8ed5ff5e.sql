-- 1) Admin-Policies rollenbasiert absichern
DROP POLICY IF EXISTS "Admin manage gutscheine" ON public.gutscheine;
CREATE POLICY "Admin manage gutscheine" ON public.gutscheine
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admin manage verwendungen" ON public.gutschein_verwendungen;
CREATE POLICY "Admin manage verwendungen" ON public.gutschein_verwendungen
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) Öffentliche Schreibrechte entfernen
DROP POLICY IF EXISTS "Public increment aktive" ON public.gutscheine;
DROP POLICY IF EXISTS "Public insert verwendungen" ON public.gutschein_verwendungen;

REVOKE UPDATE ON public.gutscheine FROM anon;
REVOKE INSERT ON public.gutschein_verwendungen FROM anon;

-- 3) Einlösung nur über geprüfte SECURITY DEFINER Funktion
CREATE OR REPLACE FUNCTION public.redeem_gutschein(
  p_gutschein_id uuid,
  p_rabatt_betrag numeric,
  p_customer_id uuid DEFAULT NULL,
  p_order_id uuid DEFAULT NULL,
  p_shop_order_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE g public.gutscheine;
BEGIN
  IF p_rabatt_betrag IS NULL OR p_rabatt_betrag < 0 OR p_rabatt_betrag > 100000 THEN
    RETURN false;
  END IF;

  SELECT * INTO g FROM public.gutscheine WHERE id = p_gutschein_id FOR UPDATE;
  IF g.id IS NULL OR COALESCE(g.aktiv, false) = false THEN
    RETURN false;
  END IF;
  IF g.gueltig_ab IS NOT NULL AND CURRENT_DATE < g.gueltig_ab THEN
    RETURN false;
  END IF;
  IF g.gueltig_bis IS NOT NULL AND CURRENT_DATE > g.gueltig_bis THEN
    RETURN false;
  END IF;
  IF g.max_verwendungen IS NOT NULL AND COALESCE(g.verwendungen, 0) >= g.max_verwendungen THEN
    RETURN false;
  END IF;

  INSERT INTO public.gutschein_verwendungen (gutschein_id, customer_id, order_id, shop_order_id, rabatt_betrag)
  VALUES (g.id, p_customer_id, p_order_id, p_shop_order_id, p_rabatt_betrag);

  UPDATE public.gutscheine
  SET verwendungen = COALESCE(verwendungen, 0) + 1
  WHERE id = g.id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_gutschein(uuid, numeric, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_gutschein(uuid, numeric, uuid, uuid, uuid) TO anon, authenticated, service_role;