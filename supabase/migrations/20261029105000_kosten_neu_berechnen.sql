-- Auftragskosten bestehender Aufträge mit den aktuellen Einstellungen neu berechnen
-- (Material zum Einkaufspreis + Druckzeit x Strom/Verschleiss, x Menge – wie beim Speichern im Auftrag).
-- Der Umsatz ohne Versand (= Gewinn + Kosten) bleibt gleich; nur Kosten, Gewinn und Marge werden angepasst.
WITH s AS (
  SELECT
    COALESCE((SELECT NULLIF(value, '')::numeric FROM public.settings WHERE key = 'material_einkauf_pro_kg'), 25) AS einkauf_kg,
    COALESCE((SELECT NULLIF(value, '')::numeric FROM public.settings WHERE key = 'strom_verschleiss_pro_h'), 0.15) AS strom_h
), neu AS (
  SELECT
    p.order_id,
    SUM(
      ( COALESCE(p.gewicht_g, 0) / 1000.0 * COALESCE(p.filament_einkauf_pro_kg, s.einkauf_kg)
        + COALESCE(p.druckzeit_h, 0) * s.strom_h
      ) * COALESCE(p.menge, 1)
    ) AS kosten
  FROM public.parts p CROSS JOIN s
  WHERE p.order_id IS NOT NULL
  GROUP BY p.order_id
)
UPDATE public.orders o
SET
  kosten_total = ROUND(neu.kosten::numeric, 2),
  gewinn_total = ROUND((COALESCE(o.gewinn_total, 0) + COALESCE(o.kosten_total, 0) - neu.kosten)::numeric, 2),
  marge = CASE
    WHEN COALESCE(o.gewinn_total, 0) + COALESCE(o.kosten_total, 0) > 0
    THEN ROUND(((COALESCE(o.gewinn_total, 0) + COALESCE(o.kosten_total, 0) - neu.kosten)
         / (COALESCE(o.gewinn_total, 0) + COALESCE(o.kosten_total, 0)) * 100)::numeric, 2)
    ELSE o.marge
  END
FROM neu
WHERE o.id = neu.order_id
  AND o.kosten_total IS NOT NULL;
