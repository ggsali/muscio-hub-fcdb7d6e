CREATE OR REPLACE FUNCTION public.set_inquiry_herkunft(p_inquiry_id uuid, p_herkunft text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_herkunft IS NULL OR p_herkunft NOT IN ('Google','Empfehlung','LinkedIn','Instagram','KI / ChatGPT','Anderes') THEN
    RETURN FALSE;
  END IF;

  UPDATE public.inquiries
  SET herkunft = p_herkunft
  WHERE id = p_inquiry_id
    AND herkunft IS NULL
    AND created_at > now() - interval '24 hours';

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.set_inquiry_herkunft(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_inquiry_herkunft(uuid, text) TO anon, authenticated, service_role;