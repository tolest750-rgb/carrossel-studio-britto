DROP POLICY IF EXISTS "Public read generations" ON storage.objects;

-- Allow public read of individual objects, block listing
CREATE POLICY "Public read generations by name"
ON storage.objects FOR SELECT
USING (bucket_id = 'generations' AND name IS NOT NULL);