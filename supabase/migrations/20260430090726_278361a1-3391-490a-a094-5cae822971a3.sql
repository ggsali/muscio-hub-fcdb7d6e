-- Update sync_profile_to_customer to also link auth_user_id
CREATE OR REPLACE FUNCTION public.sync_profile_to_customer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_existing_id uuid;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = NEW.user_id;
  IF v_email IS NULL THEN RETURN NEW; END IF;

  -- Link existing customer if email matches
  SELECT id INTO v_existing_id FROM public.customers WHERE email = v_email LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    UPDATE public.customers SET auth_user_id = NEW.user_id WHERE id = v_existing_id AND auth_user_id IS DISTINCT FROM NEW.user_id;
    RETURN NEW;
  END IF;

  -- Otherwise create new customer linked to auth user
  INSERT INTO public.customers (auth_user_id, name, vorname, strasse, plz, ort, land, telefon, email, notizen)
  VALUES (
    NEW.user_id,
    COALESCE(split_part(NEW.full_name, ' ', 2), NEW.full_name, ''),
    split_part(NEW.full_name, ' ', 1),
    NEW.address,
    NEW.postal_code,
    NEW.city,
    NEW.country,
    NEW.phone,
    v_email,
    'Automatisch von Website-Registrierung importiert'
  );
  RETURN NEW;
END;
$function$;

-- Backfill existing customers: link auth_user_id by email
UPDATE public.customers c
SET auth_user_id = u.id
FROM auth.users u
WHERE c.email = u.email
  AND c.auth_user_id IS NULL;

-- Allow customers to read their own inquiries
DROP POLICY IF EXISTS "Customers read own inquiries" ON public.inquiries;
CREATE POLICY "Customers read own inquiries"
ON public.inquiries
FOR SELECT
TO authenticated
USING (
  customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid())
  OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
);