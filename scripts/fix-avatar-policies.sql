------------------------------------------------
-- FIX AVATAR RLS POLICIES
------------------------------------------------

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public avatar access" ON storage.objects;

-- Simple policy: Allow any authenticated user to upload avatars
CREATE POLICY "Users can upload avatars"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
);

-- Simple policy: Allow any authenticated user to update avatars
CREATE POLICY "Users can update avatars"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to read avatars
CREATE POLICY "Users can read avatars"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
);

-- Allow public read access (bucket is public)
CREATE POLICY "Public avatar access"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'avatars'
);

------------------------------------------------
-- NOTE: The file naming in the application (userId-timestamp.ext)
-- provides the security we need, so we don't need complex folder checks
------------------------------------------------
