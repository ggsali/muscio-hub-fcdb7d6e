
ALTER TABLE public.customers 
  ADD COLUMN IF NOT EXISTS vorname text,
  ADD COLUMN IF NOT EXISTS strasse text,
  ADD COLUMN IF NOT EXISTS hausnummer text,
  ADD COLUMN IF NOT EXISTS plz text,
  ADD COLUMN IF NOT EXISTS ort text,
  ADD COLUMN IF NOT EXISTS land text DEFAULT 'Schweiz';

-- Migrate existing 'name' to vorname/name split where possible
-- 'adresse' stays for backward compat but new fields are preferred
