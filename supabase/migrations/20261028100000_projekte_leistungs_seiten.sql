-- Projekte können auf Leistungsseiten (z. B. architekturmodelle, miniaturmaschinen) angezeigt werden
ALTER TABLE public.projekte ADD COLUMN IF NOT EXISTS leistungs_seiten text[] NOT NULL DEFAULT '{}';
UPDATE public.projekte SET leistungs_seiten = ARRAY['miniaturmaschinen'] WHERE slug = 'buehler-druckgussmaschine' AND NOT ('miniaturmaschinen' = ANY(leistungs_seiten));
