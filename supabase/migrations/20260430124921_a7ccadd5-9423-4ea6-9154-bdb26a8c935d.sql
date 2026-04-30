
-- ============================================================
-- 1. PROFILES: each user only their own; admins all
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Admins manage all profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 2. CHAT SESSIONS / MESSAGES: scope public reads
-- ============================================================
DROP POLICY IF EXISTS "Public can read own chat_sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Authenticated users manage chat_sessions" ON public.chat_sessions;

CREATE POLICY "Admins manage chat_sessions" ON public.chat_sessions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
-- Public can still INSERT (existing policy preserved). Reads now require admin.

DROP POLICY IF EXISTS "Public can read chat_messages by session" ON public.chat_messages;
DROP POLICY IF EXISTS "Authenticated users manage chat_messages" ON public.chat_messages;

CREATE POLICY "Admins manage chat_messages" ON public.chat_messages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
-- Public INSERT preserved. Reads now require admin (chat widget reloads from server context).

-- ============================================================
-- 3. CUSTOMERS: admin only + own record
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage customers" ON public.customers;

CREATE POLICY "Admins manage customers" ON public.customers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Customers read own record" ON public.customers
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

-- ============================================================
-- 4. ORDERS: admin only + own orders
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage orders" ON public.orders;

CREATE POLICY "Admins manage orders" ON public.orders
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Customers read own orders" ON public.orders
  FOR SELECT TO authenticated
  USING (customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid()));

-- ============================================================
-- 5. BILLS: admin only + customer reads bills of own orders
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage bills" ON public.bills;

CREATE POLICY "Admins manage bills" ON public.bills
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Customers read own bills" ON public.bills
  FOR SELECT TO authenticated
  USING (order_id IN (
    SELECT o.id FROM public.orders o
    JOIN public.customers c ON c.id = o.customer_id
    WHERE c.auth_user_id = auth.uid()
  ));

-- ============================================================
-- 6. PARTS: admin only + customer reads parts of own orders
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage parts" ON public.parts;

CREATE POLICY "Admins manage parts" ON public.parts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Customers read own parts" ON public.parts
  FOR SELECT TO authenticated
  USING (order_id IN (
    SELECT o.id FROM public.orders o
    JOIN public.customers c ON c.id = o.customer_id
    WHERE c.auth_user_id = auth.uid()
  ));

-- ============================================================
-- 7. OFFER_POSITIONS: admin only
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage offer_positions" ON public.offer_positions;

CREATE POLICY "Admins manage offer_positions" ON public.offer_positions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 8. ORDER_STATUS_LOG: admin only + customer reads own
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage order_status_log" ON public.order_status_log;

CREATE POLICY "Admins manage order_status_log" ON public.order_status_log
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Customers read own order_status_log" ON public.order_status_log
  FOR SELECT TO authenticated
  USING (order_id IN (
    SELECT o.id FROM public.orders o
    JOIN public.customers c ON c.id = o.customer_id
    WHERE c.auth_user_id = auth.uid()
  ));

-- ============================================================
-- 9. TIME_ENTRIES: admin only
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage time_entries" ON public.time_entries;

CREATE POLICY "Admins manage time_entries" ON public.time_entries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 10. PART_FILES: admin only
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage part_files" ON public.part_files;

CREATE POLICY "Admins manage part_files" ON public.part_files
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 11. SETTINGS / COMPANY_SETTINGS / WEBSITE_SETTINGS / EMAIL_TEMPLATES
--     admin only (website_settings keeps public read for site)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage settings" ON public.settings;
CREATE POLICY "Admins manage settings" ON public.settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated users can manage company_settings" ON public.company_settings;
CREATE POLICY "Admins manage company_settings" ON public.company_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
-- Allow public read of company_settings so customer-facing pages (footer, contact info) work.
CREATE POLICY "Public read company_settings" ON public.company_settings
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated manage website_settings" ON public.website_settings;
CREATE POLICY "Admins manage website_settings" ON public.website_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
-- Existing "Public can read website_settings" stays.

DROP POLICY IF EXISTS "Authenticated manage email_templates" ON public.email_templates;
CREATE POLICY "Admins manage email_templates" ON public.email_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 12. FILAMENTS / PRICE_PRESETS: admin only
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage filaments" ON public.filaments;
CREATE POLICY "Admins manage filaments" ON public.filaments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated users can manage price_presets" ON public.price_presets;
CREATE POLICY "Admins manage price_presets" ON public.price_presets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 13. UPLOAD_LINKS / UPLOAD_LINK_FILES: admin manages,
--     anon read for active token + insert preserved
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users manage upload_links" ON public.upload_links;
CREATE POLICY "Admins manage upload_links" ON public.upload_links
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated users manage upload_link_files" ON public.upload_link_files;
CREATE POLICY "Admins manage upload_link_files" ON public.upload_link_files
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 14. INQUIRIES: admin manages; existing "Customers read own"
--     and anon insert policies stay
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can manage inquiries" ON public.inquiries;
CREATE POLICY "Admins manage inquiries" ON public.inquiries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 15. Fix function search_path warnings
-- ============================================================
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
