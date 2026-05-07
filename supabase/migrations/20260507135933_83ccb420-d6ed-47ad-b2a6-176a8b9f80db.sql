-- Verbesserte Profile-Anlage: nimmt Google/Apple Metadaten korrekt entgegen
-- und blockiert Apple Private Relay Adressen
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_full_name text;
  v_given text;
  v_family text;
BEGIN
  -- Apple Private Relay E-Mails ablehnen
  IF NEW.email ILIKE '%@privaterelay.appleid.com' THEN
    RAISE EXCEPTION 'Apple Private Relay E-Mail-Adressen werden nicht unterstützt. Bitte deaktiviere "E-Mail verbergen" beim Apple-Login.';
  END IF;

  v_given := COALESCE(v_meta->>'given_name', v_meta->'name'->>'firstName', '');
  v_family := COALESCE(v_meta->>'family_name', v_meta->'name'->>'lastName', '');
  v_full_name := COALESCE(
    NULLIF(v_meta->>'full_name', ''),
    NULLIF(v_meta->>'name', ''),
    NULLIF(trim(v_given || ' ' || v_family), ''),
    ''
  );

  INSERT INTO public.profiles (user_id, full_name, phone, address, city, postal_code, country)
  VALUES (
    NEW.id,
    v_full_name,
    COALESCE(v_meta->>'phone', ''),
    COALESCE(v_meta->>'address', ''),
    COALESCE(v_meta->>'city', ''),
    COALESCE(v_meta->>'postal_code', ''),
    COALESCE(v_meta->>'country', 'Schweiz')
  )
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    phone = COALESCE(NULLIF(EXCLUDED.phone, ''), public.profiles.phone),
    address = COALESCE(NULLIF(EXCLUDED.address, ''), public.profiles.address),
    city = COALESCE(NULLIF(EXCLUDED.city, ''), public.profiles.city),
    postal_code = COALESCE(NULLIF(EXCLUDED.postal_code, ''), public.profiles.postal_code);
  RETURN NEW;
END;
$function$;