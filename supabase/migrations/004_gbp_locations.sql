-- Migration for Google Business Profile Locations Storage
-- This migration creates the table to store fetched business profiles

-- Create gbp_locations table
CREATE TABLE IF NOT EXISTS public.gbp_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    google_account_id UUID REFERENCES public.google_accounts(id) ON DELETE CASCADE,

    -- Google Account Info
    google_account_email TEXT NOT NULL,

    -- GBP Account Info
    account_name TEXT,
    account_number TEXT,

    -- Location Details
    location_name TEXT NOT NULL,
    store_code TEXT,
    place_id TEXT UNIQUE,

    -- Address
    address JSONB,
    formatted_address TEXT,

    -- Contact Info
    phone TEXT,
    website TEXT,

    -- Category
    primary_category TEXT,
    additional_categories TEXT[],

    -- Maps Info
    maps_url TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),

    -- Business Info
    business_hours JSONB,
    special_hours JSONB,
    attributes JSONB,

    -- Status
    status TEXT, -- 'OPEN', 'CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY'
    verified BOOLEAN DEFAULT false,
    suspended BOOLEAN DEFAULT false,
    disabled BOOLEAN DEFAULT false,
    published BOOLEAN DEFAULT true,

    -- Metrics (cached)
    total_reviews INTEGER DEFAULT 0,
    average_rating DECIMAL(2, 1),
    response_rate DECIMAL(5, 2),

    -- Rankings (cached)
    ranking_keywords JSONB, -- Array of {keyword, position, last_checked}
    optimization_score INTEGER, -- 0-100

    -- Sync Info
    last_synced TIMESTAMPTZ DEFAULT NOW(),
    sync_error TEXT,

    -- Metadata
    raw_data JSONB, -- Store complete Google API response
    tags TEXT[], -- Custom tags for organization
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_gbp_locations_user_id ON public.gbp_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_gbp_locations_google_account_id ON public.gbp_locations(google_account_id);
CREATE INDEX IF NOT EXISTS idx_gbp_locations_place_id ON public.gbp_locations(place_id);
CREATE INDEX IF NOT EXISTS idx_gbp_locations_location_name ON public.gbp_locations(location_name);
CREATE INDEX IF NOT EXISTS idx_gbp_locations_verified ON public.gbp_locations(verified);
CREATE INDEX IF NOT EXISTS idx_gbp_locations_status ON public.gbp_locations(status);
CREATE INDEX IF NOT EXISTS idx_gbp_locations_tags ON public.gbp_locations USING GIN(tags);

-- Enable RLS
ALTER TABLE public.gbp_locations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own GBP locations" ON public.gbp_locations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create GBP locations" ON public.gbp_locations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own GBP locations" ON public.gbp_locations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own GBP locations" ON public.gbp_locations
    FOR DELETE USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_gbp_locations_updated_at BEFORE UPDATE ON public.gbp_locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Create view for easier access with account details
CREATE OR REPLACE VIEW public.gbp_locations_with_account AS
SELECT
    l.*,
    ga.email as account_email,
    ga.name as account_name,
    ga.picture_url as account_picture
FROM public.gbp_locations l
LEFT JOIN public.google_accounts ga ON l.google_account_id = ga.id;

-- Grant access to the view
GRANT SELECT ON public.gbp_locations_with_account TO authenticated;