-- Generatoren (Stadtmodell) sind nicht oeffentlich, bis sie bewusst freigegeben werden.
INSERT INTO public.website_settings (key, value) VALUES ('stadtmodell_enabled', '{"aktiv": false}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = '{"aktiv": false}'::jsonb;
