-- Zahlungsdatum pro Auftrag: Umsatz zählt in dem Monat, in dem der Auftrag bezahlt wurde (nicht im Auftragsmonat)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS bezahlt_am date;

-- Bestehende Aufträge: Datum des ersten Verlaufs-Eintrags ab "Bezahlt" (Zeitzone Schweiz)
UPDATE public.orders o
SET bezahlt_am = sub.d
FROM (
  SELECT l.order_id, (min(l.created_at) AT TIME ZONE 'Europe/Zurich')::date AS d
  FROM public.order_status_log l
  WHERE l.status IN ('Bezahlt', 'Im Druck', 'In Bearbeitung', 'Qualitätsprüfung', 'Versandt', 'Geliefert', 'Abgeschlossen')
  GROUP BY l.order_id
) sub
WHERE sub.order_id = o.id
  AND o.bezahlt_am IS NULL
  AND o.status IN ('Bezahlt', 'Im Druck', 'In Bearbeitung', 'Qualitätsprüfung', 'Versandt', 'Geliefert', 'Abgeschlossen');
