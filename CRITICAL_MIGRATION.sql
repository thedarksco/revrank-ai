-- CRITICAL MIGRATION: Run this in Supabase SQL Editor to fix token_save_failed error
-- This creates the missing database tables for Google account storage

-- Step 1: Create google_accounts table
CREATE TABLE IF NOT EXISTS public.google_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,

    -- Account Info
    google_account_id TEXT NOT NULL,
    email TEXT NOT NULL,
    name TEXT,
    picture_url TEXT,
    account_type TEXT DEFAULT 'standard',
    hosted_domain TEXT,

    -- Manager Account Info
    is_manager BOOLEAN DEFAULT false,
    managed_accounts TEXT[],

    -- Connection Status
    is_active BOOLEAN DEFAULT true,
    last_connected TIMESTAMPTZ DEFAULT NOW(),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, google_account_id)
);

-- Step 2: Update google_tokens table
ALTER TABLE public.google_tokens
ADD COLUMN IF NOT EXISTS google_account_id UUID REFERENCES public.google_accounts(id) ON DELETE CASCADE;

-- Step 3: Create gbp_locations table for business profiles
CREATE TABLE IF NOT EXISTS public.gbp_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    google_account_id UUID REFERENCES public.google_accounts(id) ON DELETE CASCADE,

    -- Location Details
    google_account_email TEXT,
    account_name TEXT,
    account_number TEXT,
    location_name TEXT,
    store_code TEXT,
    place_id TEXT,

    -- Address
    address JSONB,
    formatted_address TEXT,
    phone TEXT,
    website TEXT,

    -- Business Info
    primary_category TEXT,
    maps_url TEXT,
    status TEXT,
    verified BOOLEAN DEFAULT false,

    -- Metadata
    last_synced TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, place_id)
);

-- Step 4: Enable RLS on all tables
ALTER TABLE public.google_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gbp_locations ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies
CREATE POLICY "Users can manage own google accounts" ON public.google_accounts
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own gbp locations" ON public.gbp_locations
    FOR ALL USING (auth.uid() = user_id);

-- Step 6: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_google_accounts_user_id ON public.google_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_google_accounts_google_id ON public.google_accounts(google_account_id);
CREATE INDEX IF NOT EXISTS idx_google_tokens_google_account_id ON public.google_tokens(google_account_id);
CREATE INDEX IF NOT EXISTS idx_gbp_locations_user_id ON public.gbp_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_gbp_locations_place_id ON public.gbp_locations(place_id);

-- Step 7: Create update triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_google_accounts_updated_at
    BEFORE UPDATE ON public.google_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_gbp_locations_updated_at
    BEFORE UPDATE ON public.gbp_locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();