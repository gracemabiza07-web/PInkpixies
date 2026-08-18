-- Migration to add Social Feed functionality

-- 1. Create the RPC function to increment/decrement likes (vibes)
CREATE OR REPLACE FUNCTION public.increment_vibe(post_id UUID, increment_val INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE public.posts
  SET likes_count = likes_count + increment_val
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Storage Setup (Manual instruction/Policy)
-- Note: You need to manually create the 'inspiration_posts' and 'pro-verifications' buckets in the Supabase Dashboard.
-- Below are the policies to allow public reading and authenticated uploading.

/*
-- Policies for 'inspiration_posts' bucket
-- Authenticated users can upload to gallery
CREATE POLICY "Technicians can upload post images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'inspiration_posts');

-- Everyone can view gallery images
CREATE POLICY "Gallery images are public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'inspiration_posts');


-- Policies for 'pro-verifications' bucket
-- Authenticated technicians can upload certifications
CREATE POLICY "Technicians can upload certifications"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'pro-verifications');

-- Only admins/authenticated can view? For now public view or restricted.
CREATE POLICY "Certifications are restricted"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'pro-verifications');
*/
