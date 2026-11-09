CREATE TABLE public.ai_rate_events (
  id bigserial PRIMARY KEY,
  bucket text NOT NULL,
  key_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_rate_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.ai_rate_events_id_seq TO service_role;
REVOKE ALL ON public.ai_rate_events FROM anon, authenticated;
ALTER TABLE public.ai_rate_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX ai_rate_events_bucket_key_idx ON public.ai_rate_events (bucket, key_hash, created_at);
CREATE INDEX ai_rate_events_bucket_time_idx ON public.ai_rate_events (bucket, created_at);
CREATE INDEX ai_rate_events_time_idx ON public.ai_rate_events (created_at);

-- Zählt einen KI-Aufruf und prüft zwei Grenzen: pro Besucher (gehashte IP) und gesamthaft pro Funktion.
-- Rückgabe: 'ok', 'visitor' (Besucherlimit erreicht) oder 'global' (Tagesbudget erreicht).
CREATE OR REPLACE FUNCTION public.ai_rate_hit(
  p_bucket text,
  p_key_hash text,
  p_visitor_window_s integer,
  p_visitor_max integer,
  p_global_window_s integer,
  p_global_max integer
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n_visitor integer;
  n_global integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('ai_rate:' || p_bucket));

  DELETE FROM public.ai_rate_events WHERE created_at < now() - interval '3 days';

  SELECT count(*) INTO n_visitor FROM public.ai_rate_events
   WHERE bucket = p_bucket AND key_hash = p_key_hash
     AND created_at > now() - make_interval(secs => p_visitor_window_s);
  IF n_visitor >= p_visitor_max THEN RETURN 'visitor'; END IF;

  SELECT count(*) INTO n_global FROM public.ai_rate_events
   WHERE bucket = p_bucket
     AND created_at > now() - make_interval(secs => p_global_window_s);
  IF n_global >= p_global_max THEN RETURN 'global'; END IF;

  INSERT INTO public.ai_rate_events (bucket, key_hash) VALUES (p_bucket, p_key_hash);
  RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.ai_rate_hit(text, text, integer, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_rate_hit(text, text, integer, integer, integer, integer) TO service_role;