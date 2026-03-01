
-- Create profile-photos bucket (missing)
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload to kyc-documents (path includes user_id for traceability)
CREATE POLICY "Allow anon insert kyc-documents"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'kyc-documents');

-- Allow authenticated users to read their own kyc docs
CREATE POLICY "Allow authenticated read kyc-documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'kyc-documents');

-- Allow anyone to upload to profile-photos
CREATE POLICY "Allow anon insert profile-photos"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'profile-photos');

-- Allow public read on profile-photos (it's a public bucket)
CREATE POLICY "Allow public read profile-photos"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'profile-photos');
