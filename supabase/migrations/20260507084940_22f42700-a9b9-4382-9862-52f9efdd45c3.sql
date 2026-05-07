
CREATE POLICY "Public can read chat_sessions" ON public.chat_sessions FOR SELECT TO public USING (true);
CREATE POLICY "Public can read chat_messages" ON public.chat_messages FOR SELECT TO public USING (true);
