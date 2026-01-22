-- Create avatars storage bucket
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

------------------------------------------------
-- RLS POLICIES
------------------------------------------------

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public avatar access" ON storage.objects;

-- Allow users to upload their own avatar
CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own avatar
CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
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
-- PROFILES TABLE
------------------------------------------------

-- Add avatar_url column if missing
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_avatar_url
ON profiles (avatar_url);
