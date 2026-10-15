-- Nur bestätigte E-Mail-Adressen dürfen für den Abgleich (z. B. Anfragen lesen) verwendet werden.
CREATE OR REPLACE FUNCTION public.current_user_email()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT email FROM auth.users WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL
$function$;