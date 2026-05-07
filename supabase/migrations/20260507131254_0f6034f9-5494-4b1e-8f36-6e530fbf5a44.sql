
-- Allowlist für Admin-E-Mails
CREATE TABLE public.admin_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  notiz text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_allowlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage admin_allowlist"
ON public.admin_allowlist FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Helper: prüft ob E-Mail (case-insensitive) auf der Allowlist ist
CREATE OR REPLACE FUNCTION public.is_admin_email(_email text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_allowlist
    WHERE lower(email) = lower(_email)
  )
$$;

-- handle_new_user_role erweitern: Admin-Rolle vergeben wenn E-Mail auf Allowlist
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF public.is_admin_email(NEW.email) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Bestehende Allowlist-Nutzer nachträglich zu Admin befördern (sobald Allowlist befüllt wird)
CREATE OR REPLACE FUNCTION public.sync_admin_allowlist()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(NEW.email) LIMIT 1;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_admin_allowlist ON public.admin_allowlist;
CREATE TRIGGER trg_sync_admin_allowlist
AFTER INSERT ON public.admin_allowlist
FOR EACH ROW EXECUTE FUNCTION public.sync_admin_allowlist();

-- Beim Entfernen aus der Allowlist: Admin-Rolle entziehen
CREATE OR REPLACE FUNCTION public.revoke_admin_on_allowlist_delete()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(OLD.email) LIMIT 1;
  IF v_uid IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = v_uid AND role = 'admin';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_revoke_admin_on_allowlist_delete ON public.admin_allowlist;
CREATE TRIGGER trg_revoke_admin_on_allowlist_delete
AFTER DELETE ON public.admin_allowlist
FOR EACH ROW EXECUTE FUNCTION public.revoke_admin_on_allowlist_delete();

-- Bestehende Admins in die Allowlist übernehmen, damit sie nicht aus Versehen ausgesperrt werden
INSERT INTO public.admin_allowlist (email, notiz)
SELECT DISTINCT lower(u.email), 'Initial import'
FROM auth.users u
JOIN public.user_roles r ON r.user_id = u.id
WHERE r.role = 'admin' AND u.email IS NOT NULL
ON CONFLICT (email) DO NOTHING;
