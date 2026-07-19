
CREATE POLICY "Users read own pet photos" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'pet-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users upload own pet photos" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'pet-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update own pet photos" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'pet-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own pet photos" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'pet-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
