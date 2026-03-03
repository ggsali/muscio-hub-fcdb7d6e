
-- Trigger function: auto-insert profile into customers
CREATE OR REPLACE FUNCTION public.sync_profile_to_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only insert if no customer with same user email exists yet
  INSERT INTO public.customers (name, vorname, strasse, plz, ort, land, telefon, email, notizen)
  SELECT
    COALESCE(split_part(NEW.full_name, ' ', 2), NEW.full_name, ''),
    split_part(NEW.full_name, ' ', 1),
    NEW.address,
    NEW.postal_code,
    NEW.city,
    NEW.country,
    NEW.phone,
    u.email,
    'Automatisch von Website-Registrierung importiert'
  FROM auth.users u
  WHERE u.id = NEW.user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.customers c WHERE c.email = u.email
    );
  RETURN NEW;
END;
$$;

-- Trigger on profiles insert
CREATE TRIGGER trg_sync_profile_to_customer
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_to_customer();
