-- ============================================
-- IMPORTANT: RUN THIS IN SUPABASE SQL EDITOR
-- ============================================
-- This migration adds Google account multi-account support
--
-- Instructions:
-- 1. Go to your Supabase Dashboard
-- 2. Click on "SQL Editor" in the left sidebar
-- 3. Click "New Query"
-- 4. Copy and paste this ENTIRE file
-- 5. Click "Run" button
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 1: Create google_accounts table (stores multiple Google accounts per user)
CREATE TABLE IF NOT EXISTS public.google_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    google_account_id TEXT NOT NULL,
    email TEXT NOT NULL,
    name TEXT,
    picture_url TEXT,
    account_type TEXT DEFAULT 'standard',
    hosted_domain TEXT,
    is_manager BOOLEAN DEFAULT false,
    managed_accounts TEXT[],
    is_active BOOLEAN DEFAULT true,
    last_connected TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, google_account_id)
);

-- Step 2: Create gbp_managers table (stores manager relationships)
CREATE TABLE IF NOT EXISTS public.gbp_managers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    google_account_id UUID REFERENCES public.google_accounts(id) ON DELETE CASCADE,
    manager_account_name TEXT,
    manager_account_id TEXT NOT NULL,
    account_role TEXT,
    location_account_name TEXT,
    location_account_id TEXT NOT NULL,
    location_place_id TEXT,
    is_active BOOLEAN DEFAULT true,
    last_synced TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(google_account_id, manager_account_id, location_account_id)
);

-- Step 3: Add columns to existing tables (safe - won't error if they exist)
ALTER TABLE public.google_tokens
ADD COLUMN IF NOT EXISTS google_account_id UUID REFERENCES public.google_accounts(id) ON DELETE CASCADE;

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS google_account_id UUID REFERENCES public.google_accounts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS gbp_manager_id UUID REFERENCES public.gbp_managers(id) ON DELETE SET NULL;

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_google_accounts_user_id ON public.google_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_google_accounts_google_account_id ON public.google_accounts(google_account_id);
CREATE INDEX IF NOT EXISTS idx_google_accounts_email ON public.google_accounts(email);
CREATE INDEX IF NOT EXISTS idx_google_tokens_google_account_id ON public.google_tokens(google_account_id);
CREATE INDEX IF NOT EXISTS idx_gbp_managers_google_account_id ON public.gbp_managers(google_account_id);
CREATE INDEX IF NOT EXISTS idx_clients_google_account_id ON public.clients(google_account_id);

-- Step 5: Enable Row Level Security
ALTER TABLE public.google_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gbp_managers ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies (safe - won't error if they exist)
DO $$
BEGIN
    -- Google accounts policies
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'google_accounts'
        AND policyname = 'Users can view own google accounts'
    ) THEN
        CREATE POLICY "Users can view own google accounts" ON public.google_accounts
            FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'google_accounts'
        AND policyname = 'Users can create google accounts'
    ) THEN
        CREATE POLICY "Users can create google accounts" ON public.google_accounts
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'google_accounts'
        AND policyname = 'Users can update own google accounts'
    ) THEN
        CREATE POLICY "Users can update own google accounts" ON public.google_accounts
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'google_accounts'
        AND policyname = 'Users can delete own google accounts'
    ) THEN
        CREATE POLICY "Users can delete own google accounts" ON public.google_accounts
            FOR DELETE USING (auth.uid() = user_id);
    END IF;

    -- GBP managers policies
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'gbp_managers'
        AND policyname = 'Users can view own gbp managers'
    ) THEN
        CREATE POLICY "Users can view own gbp managers" ON public.gbp_managers
            FOR SELECT USING (
                auth.uid() = (
                    SELECT user_id FROM public.google_accounts
                    WHERE id = google_account_id
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'gbp_managers'
        AND policyname = 'Users can create gbp managers'
    ) THEN
        CREATE POLICY "Users can create gbp managers" ON public.gbp_managers
            FOR INSERT WITH CHECK (
                auth.uid() = (
                    SELECT user_id FROM public.google_accounts
                    WHERE id = google_account_id
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'gbp_managers'
        AND policyname = 'Users can update own gbp managers'
    ) THEN
        CREATE POLICY "Users can update own gbp managers" ON public.gbp_managers
            FOR UPDATE USING (
                auth.uid() = (
                    SELECT user_id FROM public.google_accounts
                    WHERE id = google_account_id
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'gbp_managers'
        AND policyname = 'Users can delete own gbp managers'
    ) THEN
        CREATE POLICY "Users can delete own gbp managers" ON public.gbp_managers
            FOR DELETE USING (
                auth.uid() = (
                    SELECT user_id FROM public.google_accounts
                    WHERE id = google_account_id
                )
            );
    END IF;
END $$;

-- Step 7: Create or replace the update trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Add update triggers (safe - won't error if they exist)
DROP TRIGGER IF EXISTS update_google_accounts_updated_at ON public.google_accounts;
CREATE TRIGGER update_google_accounts_updated_at
    BEFORE UPDATE ON public.google_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_gbp_managers_updated_at ON public.gbp_managers;
CREATE TRIGGER update_gbp_managers_updated_at
    BEFORE UPDATE ON public.gbp_managers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- MIGRATION COMPLETE!
-- ============================================
-- You should see "Success. No rows returned" message
-- Your database now supports multiple Google accounts
--
-- Next steps:
-- 1. Go back to https://revrank-ai.vercel.app/dashboard
-- 2. Click "Add Account" to connect your Google accounts
-- ============================================