
CREATE OR REPLACE FUNCTION public.sync_profile_to_customer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_existing_id uuid;
  v_vorname text;
  v_nachname text;
  v_parts text[];
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = NEW.user_id;
  IF v_email IS NULL THEN RETURN NEW; END IF;

  -- Split full_name in Vorname (erstes Wort) und Nachname (Rest)
  v_parts := regexp_split_to_array(trim(COALESCE(NEW.full_name, '')), '\s+');
  IF array_length(v_parts, 1) IS NULL OR v_parts[1] = '' THEN
    v_vorname := '';
    v_nachname := '';
  ELSIF array_length(v_parts, 1) = 1 THEN
    v_vorname := v_parts[1];
    v_nachname := '';
  ELSE
    v_vorname := v_parts[1];
    v_nachname := array_to_string(v_parts[2:array_length(v_parts, 1)], ' ');
  END IF;

  -- Vorhandenen Kunden mit gleicher E-Mail verknüpfen + Namen aktualisieren falls leer
  SELECT id INTO v_existing_id FROM public.customers WHERE email = v_email LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    UPDATE public.customers
    SET auth_user_id = NEW.user_id,
        vorname = COALESCE(NULLIF(vorname, ''), v_vorname),
        name = COALESCE(NULLIF(name, ''), v_nachname)
    WHERE id = v_existing_id;
    RETURN NEW;
  END IF;

  -- Sonst neuen Kunden anlegen
  INSERT INTO public.customers (auth_user_id, name, vorname, strasse, plz, ort, land, telefon, email, notizen)
  VALUES (
    NEW.user_id,
    v_nachname,
    v_vorname,
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
