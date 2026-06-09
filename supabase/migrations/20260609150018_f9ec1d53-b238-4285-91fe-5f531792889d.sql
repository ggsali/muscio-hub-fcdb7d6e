
CREATE TABLE public.customer_profile_completion_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.customer_profile_completion_tokens TO service_role;

ALTER TABLE public.customer_profile_completion_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage profile completion tokens"
ON public.customer_profile_completion_tokens
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_cust_profile_tokens_token ON public.customer_profile_completion_tokens(token);
CREATE INDEX idx_cust_profile_tokens_customer ON public.customer_profile_completion_tokens(customer_id);
