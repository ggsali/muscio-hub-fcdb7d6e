
-- Sichere Helferfunktion: aktuelle E-Mail des eingeloggten Users
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid()
$$;

-- Alte Policy ersetzen, die direkt auf auth.users zugriff
DROP POLICY IF EXISTS "Customers read own inquiries" ON public.inquiries;

CREATE POLICY "Customers read own inquiries"
ON public.inquiries FOR SELECT TO authenticated
USING (
  customer_id IN (
    SELECT id FROM public.customers WHERE auth_user_id = auth.uid()
  )
  OR email = public.current_user_email()
);
