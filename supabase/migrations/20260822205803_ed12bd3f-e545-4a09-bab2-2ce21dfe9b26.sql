CREATE TABLE public.newsletters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  betreff TEXT NOT NULL,
  inhalt_text TEXT NOT NULL,
  inhalt_html TEXT,
  bild_url TEXT,
  blog_link_url TEXT,
  blog_link_titel TEXT,
  status TEXT NOT NULL DEFAULT 'entwurf',
  empfaenger_anzahl INTEGER NOT NULL DEFAULT 0,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
  gesendet_am TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.newsletters TO authenticated;
GRANT ALL ON public.newsletters TO service_role;
ALTER TABLE public.newsletters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage newsletters" ON public.newsletters FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.newsletter_empfaenger (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  newsletter_id UUID REFERENCES public.newsletters(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id),
  email TEXT NOT NULL,
  name TEXT,
  gesendet BOOLEAN NOT NULL DEFAULT false,
  gesendet_am TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.newsletter_empfaenger TO authenticated;
GRANT ALL ON public.newsletter_empfaenger TO service_role;
ALTER TABLE public.newsletter_empfaenger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage newsletter recipients" ON public.newsletter_empfaenger FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_newsletter_empfaenger_newsletter ON public.newsletter_empfaenger(newsletter_id);

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS newsletter_aktiv BOOLEAN NOT NULL DEFAULT true;