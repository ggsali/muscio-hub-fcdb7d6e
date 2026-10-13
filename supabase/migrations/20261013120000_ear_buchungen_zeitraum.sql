-- Zeitraum, auf den eine EAR-Buchung (z. B. Miete, Versicherung) verteilt wird
ALTER TABLE public.ear_buchungen
  ADD COLUMN IF NOT EXISTS gilt_von date NULL,
  ADD COLUMN IF NOT EXISTS gilt_bis date NULL;
