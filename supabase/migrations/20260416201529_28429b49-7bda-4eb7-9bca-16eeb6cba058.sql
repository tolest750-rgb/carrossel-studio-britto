-- Storage bucket for saved generations
INSERT INTO storage.buckets (id, name, public) VALUES ('generations', 'generations', true)
ON CONFLICT (id) DO NOTHING;

-- Policies: users manage their own files (path prefix = user_id)
CREATE POLICY "Public read generations"
ON storage.objects FOR SELECT
USING (bucket_id = 'generations');

CREATE POLICY "Users upload own generations"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'generations' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own generations"
ON storage.objects FOR DELETE
USING (bucket_id = 'generations' AND auth.uid()::text = (storage.foldername(name))[1]);