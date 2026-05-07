-- Cron-Job entfernen (falls vorhanden)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname IN ('process-email-queue', 'process_email_queue');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- pgmq Queues löschen
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgmq') THEN
    BEGIN PERFORM pgmq.drop_queue('auth_emails'); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN PERFORM pgmq.drop_queue('transactional_emails'); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN PERFORM pgmq.drop_queue('auth_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN PERFORM pgmq.drop_queue('transactional_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
END $$;

-- Hilfsfunktionen entfernen
DROP FUNCTION IF EXISTS public.enqueue_email(text, jsonb);
DROP FUNCTION IF EXISTS public.delete_email(text, bigint);
DROP FUNCTION IF EXISTS public.move_to_dlq(text, text, bigint, jsonb);
DROP FUNCTION IF EXISTS public.read_email_batch(text, integer, integer);

-- Tabellen löschen
DROP TABLE IF EXISTS public.email_send_log CASCADE;
DROP TABLE IF EXISTS public.email_send_state CASCADE;
DROP TABLE IF EXISTS public.suppressed_emails CASCADE;
DROP TABLE IF EXISTS public.email_unsubscribe_tokens CASCADE;
DROP TABLE IF EXISTS public.email_templates CASCADE;