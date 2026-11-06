-- Reaktions- und Fertigungszeit einheitlich "ab 24h": gespeicherte Website-/SEO-/Blog-/Newsletter-Texte angleichen.
-- Nur Inhaltstabellen, nur Spalten vom Typ text/varchar/json/jsonb. Idempotent (zweiter Lauf ändert nichts).
DO $$
DECLARE
  t text;
  c record;
  n bigint;
  tabellen text[] := ARRAY['website_settings','leistungen_seiten','lokale_seiten','blog_posts','newsletter_automationen','shop_products','shop_categories','timeline_events','team_members'];
  alt text := '(innerhalb von |innerhalb |in nur |bis zu |in )(48|24)( ?)(Stunden|h)\y';
BEGIN
  FOREACH t IN ARRAY tabellen LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    FOR c IN
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t
        AND data_type IN ('text','character varying','json','jsonb')
    LOOP
      IF c.data_type IN ('json','jsonb') THEN
        EXECUTE format(
          $f$UPDATE public.%I SET %I = (regexp_replace(regexp_replace(regexp_replace(regexp_replace(%I::text, %L, 'ab 24\3\4', 'g'), '\yab 48( ?)(Stunden|h)\y', 'ab 24\1\2', 'g'), '48h[- ]Lieferung', '24h-Lieferung', 'g'), '\| 48 Stunden \|', '| ab 24 Stunden |', 'g'))::%s
             WHERE %I::text ~ '(48|24) ?(Stunden|h)'$f$,
          t, c.column_name, c.column_name, alt, c.data_type, c.column_name);
      ELSE
        EXECUTE format(
          $f$UPDATE public.%I SET %I = regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(%I, %L, 'ab 24\3\4', 'g'), '\yab 48( ?)(Stunden|h)\y', 'ab 24\1\2', 'g'), '48h[- ]Lieferung', '24h-Lieferung', 'g'), '\| 48 Stunden \|', '| ab 24 Stunden |', 'g'), 'Standard 48 Stunden', 'Standard ab 24 Stunden', 'g')
             WHERE %I ~ '(48|24) ?(Stunden|h)'$f$,
          t, c.column_name, c.column_name, alt, c.column_name);
      END IF;
      GET DIAGNOSTICS n = ROW_COUNT;
      IF n > 0 THEN RAISE NOTICE '%.%: % Zeilen angepasst', t, c.column_name, n; END IF;
    END LOOP;
  END LOOP;
END $$;
