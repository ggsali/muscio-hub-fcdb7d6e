
-- ============ STORAGE: company-assets (admin-only writes) ============
DROP POLICY IF EXISTS "Authenticated users can upload company assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update company assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete company assets" ON storage.objects;

CREATE POLICY "Admins upload company assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update company assets" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'company-assets' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'company-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete company assets" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'company-assets' AND public.has_role(auth.uid(), 'admin'));

-- ============ STORAGE: project-uploads (drop broad auth read) ============
DROP POLICY IF EXISTS "Authenticated users can read project-uploads" ON storage.objects;

-- ============ STORAGE: restrict listing on public buckets to admins ============
DROP POLICY IF EXISTS "Public read projekte bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public read shop-products bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public read partners bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public read team-photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read timeline-images" ON storage.objects;
DROP POLICY IF EXISTS "Public read equipment-images" ON storage.objects;
DROP POLICY IF EXISTS "Public read project-stls" ON storage.objects;
DROP POLICY IF EXISTS "Public read equipment-models" ON storage.objects;
DROP POLICY IF EXISTS "Company assets are publicly accessible" ON storage.objects;

CREATE POLICY "Admins list public buckets" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('projekte','shop-products','partners','team-photos','timeline-images','equipment-images','project-stls','equipment-models','company-assets')
    AND public.has_role(auth.uid(), 'admin')
  );

-- ============ RLS: tighten calculator_uploads UPDATE ============
DROP POLICY IF EXISTS "Users can update own calculator uploads by session" ON public.calculator_uploads;

CREATE POLICY "Users update own calculator uploads"
  ON public.calculator_uploads
  FOR UPDATE
  TO anon, authenticated
  USING (auth_user_id IS NULL OR auth_user_id = auth.uid())
  WITH CHECK (auth_user_id IS NULL OR auth_user_id = auth.uid());

-- ============ RLS: drop overly permissive referrals UPDATE ============
DROP POLICY IF EXISTS "Anyone update referred fields" ON public.referrals;

-- ============ FUNCTIONS: revoke EXECUTE on internal trigger/helper functions ============
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_admin_allowlist() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_admin_on_allowlist_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_profile_to_customer() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin_email(text) FROM PUBLIC, anon, authenticated;
