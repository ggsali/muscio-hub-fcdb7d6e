DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Bills bucket access') THEN
    CREATE POLICY "Bills bucket access" ON storage.objects
      FOR ALL
      USING (bucket_id = 'bills')
      WITH CHECK (bucket_id = 'bills');
  END IF;
END $$;