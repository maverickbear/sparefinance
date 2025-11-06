-- ============================================
-- Create Avatar Storage Bucket and Policies
-- ============================================
-- This migration creates the avatar bucket and configures RLS policies
-- to allow authenticated users to upload avatars to their own folder

-- Create the avatar bucket if it doesn't exist
-- Note: Buckets are created via Supabase Dashboard or API, but we can check
-- and create policies for it. The bucket should be created manually first.

-- Enable RLS on storage.objects
-- Note: RLS is enabled by default on storage.objects in Supabase

-- ============================================
-- Storage Policies for Avatar Bucket
-- ============================================

-- Policy: Allow authenticated users to upload files to their own folder
-- Users can only upload files to paths that start with their user ID
CREATE POLICY "Users can upload own avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatar' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to update their own avatars
CREATE POLICY "Users can update own avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatar' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to delete their own avatars
CREATE POLICY "Users can delete own avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatar' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow public read access to avatars (so images can be displayed)
CREATE POLICY "Public can view avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatar');

-- Policy: Allow authenticated users to view their own avatars
-- (This is redundant with public policy, but good for clarity)
CREATE POLICY "Users can view own avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatar' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

