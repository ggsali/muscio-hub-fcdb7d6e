
-- Ensure the project-uploads bucket allows large files (update file size limit)
UPDATE storage.buckets 
SET file_size_limit = 5368709120, -- 5GB
    allowed_mime_types = NULL -- allow all types
WHERE id = 'project-uploads';

-- Make sure service role can insert into upload_link_files (already should work via service key)
-- Ensure anonymous users can insert upload_link_files records via the edge function (service role bypasses RLS anyway)
-- Add a policy to allow the edge function (service role) full access - service role already bypasses RLS
-- But let's also ensure the storage objects policy allows service role uploads
DO $$
BEGIN
  -- Drop existing policies if any and recreate
  DROP POLICY IF EXISTS "service_role_upload_project_files" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
