-- Adventskalender: einzelne Kunden von der täglichen Türchen-Mail ausschliessen (im Admin umschaltbar).
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS advent_mail_aktiv boolean NOT NULL DEFAULT true;
