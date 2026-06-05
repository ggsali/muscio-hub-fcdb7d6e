alter table public.profiles add column if not exists vorname text;
alter table public.profiles add column if not exists nachname text;
alter table public.profiles add column if not exists strasse text;
alter table public.profiles add column if not exists plz text;
alter table public.profiles add column if not exists ort text;
alter table public.profiles add column if not exists land text default 'Schweiz';