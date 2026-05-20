-- RevRank.ai Database Schema
-- Run this in your Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- =====================================================
-- USERS & AUTH
-- =====================================================

-- Profile table extends Supabase auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    company_name TEXT,
    role TEXT DEFAULT 'user', -- 'admin', 'user'
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- CLIENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,

    -- Basic Info
    business_name TEXT NOT NULL,
    business_address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    phone TEXT,
    website TEXT,

    -- GBP Info
    gbp_place_id TEXT UNIQUE,
    gbp_account_id TEXT,
    gbp_location_id TEXT,
    gbp_connected BOOLEAN DEFAULT false,
    gbp_connection_date TIMESTAMPTZ,
    gbp_last_sync TIMESTAMPTZ,

    -- Business Details
    business_category TEXT,
    business_hours JSONB,
    specialty TEXT[],
    target_keywords TEXT[],

    -- Settings
    status TEXT DEFAULT 'active', -- 'active', 'paused', 'archived'
    posting_schedule JSONB DEFAULT '{"posts_per_week": 3, "preferred_days": ["monday", "wednesday", "friday"]}',
    auto_publish BOOLEAN DEFAULT false,
    auto_respond_reviews BOOLEAN DEFAULT false,

    -- Content Settings
    content_tone TEXT DEFAULT 'professional',
    brand_guidelines TEXT,

    -- Stats
    avg_position DECIMAL(5,2),
    total_reviews INTEGER DEFAULT 0,
    avg_rating DECIMAL(2,1),
    posts_this_month INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- GOOGLE AUTH TOKENS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.google_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,

    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_expires_at TIMESTAMPTZ,
    scope TEXT[],

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- KEYWORDS & RANKING
-- =====================================================

CREATE TABLE IF NOT EXISTS public.keywords (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,

    keyword TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(client_id, keyword)
);

CREATE TABLE IF NOT EXISTS public.rank_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    keyword_id UUID REFERENCES public.keywords(id) ON DELETE CASCADE,

    check_date TIMESTAMPTZ DEFAULT NOW(),
    grid_type TEXT DEFAULT 'radial', -- 'radial', 'square'
    center_lat DECIMAL(10,7),
    center_lng DECIMAL(10,7),
    radius_miles DECIMAL(3,1) DEFAULT 2.0,

    -- Results
    positions JSONB, -- Array of {lat, lng, rank, place_id}
    avg_position DECIMAL(5,2),
    weighted_position DECIMAL(5,2),
    business_location_rank INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- CONTENT & POSTS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,

    -- Content
    title TEXT,
    content TEXT NOT NULL,
    image_url TEXT,
    cta_type TEXT, -- 'LEARN_MORE', 'BOOK', 'CALL', etc.
    cta_url TEXT,

    -- Status
    status TEXT DEFAULT 'draft', -- 'draft', 'scheduled', 'published', 'failed'
    scheduled_for TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    gbp_post_id TEXT,

    -- AI Generation
    ai_generated BOOLEAN DEFAULT false,
    ai_prompt TEXT,
    regeneration_count INTEGER DEFAULT 0,

    -- Performance
    views INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- REVIEWS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,

    gbp_review_id TEXT UNIQUE NOT NULL,
    reviewer_name TEXT,
    reviewer_avatar TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    review_date TIMESTAMPTZ,

    -- Response
    response_text TEXT,
    response_date TIMESTAMPTZ,
    response_status TEXT DEFAULT 'pending', -- 'pending', 'responded', 'ignored'
    ai_response_draft TEXT,
    ai_response_approved BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- COMPETITORS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.competitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,

    business_name TEXT NOT NULL,
    gbp_place_id TEXT,
    address TEXT,
    phone TEXT,
    website TEXT,

    -- Stats
    avg_rating DECIMAL(2,1),
    total_reviews INTEGER,
    review_velocity DECIMAL(5,2), -- reviews per month
    avg_position DECIMAL(5,2),
    posts_per_week DECIMAL(3,1),

    last_scraped TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.competitor_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competitor_id UUID REFERENCES public.competitors(id) ON DELETE CASCADE,

    snapshot_date TIMESTAMPTZ DEFAULT NOW(),

    -- Data snapshot
    rating DECIMAL(2,1),
    review_count INTEGER,
    posts_count INTEGER,
    rank_data JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- MEDIA LIBRARY
-- =====================================================

CREATE TABLE IF NOT EXISTS public.media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,

    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT, -- 'image', 'video'
    file_size INTEGER,

    alt_text TEXT,
    caption TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- REVIEW GENERATION (OUTREACH)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.review_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,

    email TEXT NOT NULL,
    name TEXT,
    phone TEXT,

    -- Sequence
    sequence_status TEXT DEFAULT 'pending', -- 'pending', 'active', 'completed', 'unsubscribed'
    current_step INTEGER DEFAULT 0,
    last_sent_at TIMESTAMPTZ,
    next_send_at TIMESTAMPTZ,

    -- Tracking
    emails_sent INTEGER DEFAULT 0,
    opened BOOLEAN DEFAULT false,
    clicked BOOLEAN DEFAULT false,
    reviewed BOOLEAN DEFAULT false,
    unsubscribed BOOLEAN DEFAULT false,
    bounced BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(client_id, email)
);

-- =====================================================
-- CRON JOBS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.cron_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    job_name TEXT UNIQUE NOT NULL,
    schedule TEXT NOT NULL, -- cron expression
    is_active BOOLEAN DEFAULT true,
    last_run TIMESTAMPTZ,
    next_run TIMESTAMPTZ,

    -- Stats
    total_runs INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    last_error TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cron_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES public.cron_jobs(id) ON DELETE CASCADE,

    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT, -- 'running', 'success', 'failed'
    details JSONB,
    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- AUDIT & ACTIVITY LOGS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,

    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    details JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX idx_clients_user_id ON public.clients(user_id);
CREATE INDEX idx_clients_status ON public.clients(status);
CREATE INDEX idx_clients_gbp_place_id ON public.clients(gbp_place_id);

CREATE INDEX idx_posts_client_id ON public.posts(client_id);
CREATE INDEX idx_posts_status ON public.posts(status);
CREATE INDEX idx_posts_scheduled_for ON public.posts(scheduled_for);

CREATE INDEX idx_reviews_client_id ON public.reviews(client_id);
CREATE INDEX idx_reviews_response_status ON public.reviews(response_status);

CREATE INDEX idx_keywords_client_id ON public.keywords(client_id);
CREATE INDEX idx_rank_checks_client_id ON public.rank_checks(client_id);
CREATE INDEX idx_rank_checks_keyword_id ON public.rank_checks(keyword_id);
CREATE INDEX idx_rank_checks_check_date ON public.rank_checks(check_date);

CREATE INDEX idx_competitors_client_id ON public.competitors(client_id);
CREATE INDEX idx_competitor_snapshots_competitor_id ON public.competitor_snapshots(competitor_id);

CREATE INDEX idx_review_contacts_client_id ON public.review_contacts(client_id);
CREATE INDEX idx_review_contacts_sequence_status ON public.review_contacts(sequence_status);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rank_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Clients policies
CREATE POLICY "Users can view own clients" ON public.clients
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create clients" ON public.clients
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own clients" ON public.clients
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own clients" ON public.clients
    FOR DELETE USING (auth.uid() = user_id);

-- Apply similar policies to other tables
-- (I'll add more specific policies as needed)

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON public.posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON public.reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();