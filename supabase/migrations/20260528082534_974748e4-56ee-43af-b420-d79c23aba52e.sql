-- 1. Restrict calculator_uploads UPDATE to authenticated owners only
DROP POLICY IF EXISTS "Users update own calculator uploads" ON public.calculator_uploads;

CREATE POLICY "Authenticated users update own calculator uploads"
ON public.calculator_uploads
FOR UPDATE
TO authenticated
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

-- 2. Remove inquiry_messages from realtime publication to prevent broadcast of email contents
ALTER PUBLICATION supabase_realtime DROP TABLE public.inquiry_messages;