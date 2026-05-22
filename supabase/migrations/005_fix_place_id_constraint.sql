-- Fix place_id unique constraint to allow multiple users to have same business
-- This is needed when multiple people manage the same business locations

-- Drop the existing unique constraint on place_id
ALTER TABLE public.gbp_locations DROP CONSTRAINT IF EXISTS gbp_locations_place_id_key;

-- Add a new composite unique constraint that includes user_id
-- This allows the same place_id to exist for different users
ALTER TABLE public.gbp_locations
ADD CONSTRAINT gbp_locations_user_place_id_unique
UNIQUE (user_id, place_id);

-- Update the upsert logic to use the new constraint
-- Note: This will need to be updated in the fetch-locations route.ts as well