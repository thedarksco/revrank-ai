-- This fixes the missing profile issue that's preventing Google accounts from saving
-- Run this in your Supabase SQL Editor

-- Create the missing profile for the authenticated user
INSERT INTO profiles (id, email, created_at, updated_at)
VALUES (
  '7f5f1d3e-615b-4b12-8a4a-301c8f2cf90c',
  'hello@revrank.ai',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE
SET updated_at = NOW();

-- Verify the profile was created
SELECT * FROM profiles WHERE id = '7f5f1d3e-615b-4b12-8a4a-301c8f2cf90c';

-- Also create a trigger to automatically create profiles for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at, updated_at)
  VALUES (new.id, new.email, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user signups
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();