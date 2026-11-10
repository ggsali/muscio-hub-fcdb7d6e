CREATE OR REPLACE FUNCTION public.link_auth_user_to_customer(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_confirmed timestamptz;
  v_existing_id uuid;
  v_existing_owner uuid;
  v_vorname text;
  v_nachname text;
  v_parts text[];
  p public.profiles;
BEGIN
  SELECT email, email_confirmed_at INTO v_email, v_confirmed FROM auth.users WHERE id = p_user_id;
  -- Nur bestätigte E-Mail-Adressen dürfen mit einem Kunden verknüpft werden
  IF v_email IS NULL OR v_confirmed IS NULL THEN RETURN; END IF;

  -- Bereits verknüpft? Dann nichts tun
  IF EXISTS (SELECT 1 FROM public.customers WHERE auth_user_id = p_user_id) THEN RETURN; END IF;

  SELECT * INTO p FROM public.profiles WHERE user_id = p_user_id LIMIT 1;

  v_parts := regexp_split_to_array(trim(COALESCE(p.full_name, '')), '\s+');
  IF array_length(v_parts, 1) IS NULL OR v_parts[1] = '' THEN
    v_vorname := ''; v_nachname := '';
  ELSIF array_length(v_parts, 1) = 1 THEN
    v_vorname := v_parts[1]; v_nachname := '';
  ELSE
    v_vorname := v_parts[1];
    v_nachname := array_to_string(v_parts[2:array_length(v_parts, 1)], ' ');
  END IF;

  SELECT id, auth_user_id INTO v_existing_id, v_existing_owner
  FROM public.customers WHERE lower(email) = lower(v_email)
  ORDER BY (auth_user_id IS NULL) DESC, created_at ASC LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Nie einen bereits mit einem anderen Konto verknüpften Kunden übernehmen
    IF v_existing_owner IS NULL THEN
      UPDATE public.customers
      SET auth_user_id = p_user_id,
          vorname = COALESCE(NULLIF(vorname, ''), v_vorname),
          name = COALESCE(NULLIF(name, ''), v_nachname)
      WHERE id = v_existing_id;
    END IF;
    RETURN;
  END IF;

  INSERT INTO public.customers (auth_user_id, name, vorname, strasse, plz, ort, land, telefon, email, notizen)
  VALUES (
    p_user_id, v_nachname, v_vorname,
    COALESCE(p.address, ''), COALESCE(p.postal_code, ''), COALESCE(p.city, ''),
    COALESCE(p.country, 'Schweiz'), COALESCE(p.phone, ''), v_email,
    'Automatisch von Website-Registrierung importiert'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.link_auth_user_to_customer(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_profile_to_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.link_auth_user_to_customer(NEW.user_id);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.link_customer_on_email_confirm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    PERFORM public.link_auth_user_to_customer(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed_link_customer ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed_link_customer
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.link_customer_on_email_confirm();