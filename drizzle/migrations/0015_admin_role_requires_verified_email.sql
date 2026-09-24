CREATE OR REPLACE FUNCTION public.handle_new_user_role()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  -- Admin-Rolle nur bei bereits bestätigter E-Mail; sonst immer Kunde
  IF NEW.email_confirmed_at IS NOT NULL AND public.is_admin_email(NEW.email) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_admin_allowlist()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users
  WHERE lower(email) = lower(NEW.email) AND email_confirmed_at IS NOT NULL LIMIT 1;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;