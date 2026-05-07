
CREATE TABLE public.inquiry_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id uuid NOT NULL,
  direction text NOT NULL CHECK (direction IN ('in','out')),
  from_email text NOT NULL,
  from_name text,
  to_email text NOT NULL,
  subject text,
  body text NOT NULL,
  body_html text,
  message_id text,
  in_reply_to text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inquiry_messages_inquiry ON public.inquiry_messages(inquiry_id, created_at);

ALTER TABLE public.inquiry_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage inquiry_messages"
ON public.inquiry_messages FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.inquiry_messages;
ALTER TABLE public.inquiry_messages REPLICA IDENTITY FULL;
