-- Admin sieht wieder alle Bewertungen.
-- Ursache: Die Migrationen vom 08.09./11.09. haben authenticated das SELECT auf public.reviews entzogen
-- (E-Mail-Adressen sollen nicht für eingeloggte Kunden lesbar sein). Dadurch lieferte die Admin-Abfrage nichts mehr.
-- Lösung: Admin liest über eine Funktion, die nur für Admins Daten liefert. Die Tabellenrechte bleiben streng.

CREATE OR REPLACE FUNCTION public.admin_list_reviews()
RETURNS SETOF public.reviews
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.*
  FROM public.reviews r
  WHERE public.has_role(auth.uid(), 'admin'::app_role)
  ORDER BY r.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_list_reviews() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_reviews() TO authenticated;

-- Für UPDATE/DELETE per id (WHERE id = ...) braucht authenticated Leserecht auf die id-Spalte.
GRANT SELECT (id) ON public.reviews TO authenticated;
