-- Migration for Multi-Account Google Business Profile Support
-- This migration adds support for multiple Google accounts per user

-- Step 1: Create new google_accounts table
CREATE TABLE IF NOT EXISTS public.google_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,

    -- Account Info
    google_account_id TEXT NOT NULL,
    email TEXT NOT NULL,
    name TEXT,
    picture_url TEXT,
    account_type TEXT DEFAULT 'standard', -- 'standard', 'manager', 'gsuite'
    hosted_domain TEXT, -- For G Suite accounts

    -- Manager Account Info (if this is a manager account)
    is_manager BOOLEAN DEFAULT false,
    managed_accounts TEXT[], -- Array of managed account IDs

    -- Connection Status
    is_active BOOLEAN DEFAULT true,
    last_connected TIMESTAMPTZ DEFAULT NOW(),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, google_account_id)
);

-- Step 2: Create GBP manager relationships table
CREATE TABLE IF NOT EXISTS public.gbp_managers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    google_account_id UUID REFERENCES public.google_accounts(id) ON DELETE CASCADE,

    -- Manager Account Info
    manager_account_name TEXT,
    manager_account_id TEXT NOT NULL,
    account_role TEXT, -- 'OWNER', 'MANAGER', 'SITE_MANAGER'

    -- Location Info
    location_account_name TEXT,
    location_account_id TEXT NOT NULL,
    location_place_id TEXT,

    is_active BOOLEAN DEFAULT true,
    last_synced TIMESTAMPTZ DEFAULT NOW(),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(google_account_id, manager_account_id, location_account_id)
);

-- Step 3: Migrate existing google_tokens data
-- First, add the new google_account_id column to google_tokens
ALTER TABLE public.google_tokens
ADD COLUMN IF NOT EXISTS google_account_id UUID REFERENCES public.google_accounts(id) ON DELETE CASCADE;

-- Step 4: Add new columns to clients table
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS google_account_id UUID REFERENCES public.google_accounts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS gbp_manager_id UUID REFERENCES public.gbp_managers(id) ON DELETE SET NULL;

-- Step 5: Create migration function to move existing data
CREATE OR REPLACE FUNCTION migrate_existing_google_data()
RETURNS void AS $$
DECLARE
    token_record RECORD;
    new_account_id UUID;
BEGIN
    -- Loop through existing google_tokens that have client_id
    FOR token_record IN
        SELECT DISTINCT gt.user_id, gt.client_id, c.gbp_place_id, c.gbp_account_id, c.gbp_location_id
        FROM google_tokens gt
        JOIN clients c ON gt.client_id = c.id
        WHERE gt.google_account_id IS NULL
    LOOP
        -- Create a generic google account for this user if it doesn't exist
        INSERT INTO google_accounts (
            user_id,
            google_account_id,
            email,
            name,
            account_type,
            is_manager,
            is_active
        )
        VALUES (
            token_record.user_id,
            'migrated_' || token_record.user_id,
            (SELECT email FROM profiles WHERE id = token_record.user_id),
            'Migrated Google Account',
            'standard',
            false,
            true
        )
        ON CONFLICT (user_id, google_account_id) DO NOTHING
        RETURNING id INTO new_account_id;

        -- If the account already exists, get its ID
        IF new_account_id IS NULL THEN
            SELECT id INTO new_account_id
            FROM google_accounts
            WHERE user_id = token_record.user_id
            AND google_account_id = 'migrated_' || token_record.user_id;
        END IF;

        -- Update google_tokens with the account_id
        UPDATE google_tokens
        SET google_account_id = new_account_id
        WHERE user_id = token_record.user_id
        AND client_id = token_record.client_id
        AND google_account_id IS NULL;

        -- Update client with the google account association
        UPDATE clients
        SET google_account_id = new_account_id
        WHERE id = token_record.client_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Run the migration
SELECT migrate_existing_google_data();

-- Step 7: Remove the client_id column from google_tokens (after migration is complete)
-- Note: Uncomment this after verifying the migration worked correctly
-- ALTER TABLE public.google_tokens DROP COLUMN IF EXISTS client_id;

-- Step 8: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_google_accounts_user_id ON public.google_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_google_accounts_google_account_id ON public.google_accounts(google_account_id);
CREATE INDEX IF NOT EXISTS idx_google_accounts_email ON public.google_accounts(email);

CREATE INDEX IF NOT EXISTS idx_google_tokens_google_account_id ON public.google_tokens(google_account_id);

CREATE INDEX IF NOT EXISTS idx_gbp_managers_google_account_id ON public.gbp_managers(google_account_id);
CREATE INDEX IF NOT EXISTS idx_gbp_managers_manager_account_id ON public.gbp_managers(manager_account_id);
CREATE INDEX IF NOT EXISTS idx_gbp_managers_location_account_id ON public.gbp_managers(location_account_id);

CREATE INDEX IF NOT EXISTS idx_clients_google_account_id ON public.clients(google_account_id);

-- Step 9: Enable RLS on new tables
ALTER TABLE public.google_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gbp_managers ENABLE ROW LEVEL SECURITY;

-- Step 10: Create RLS policies
-- Google accounts policies
CREATE POLICY "Users can view own google accounts" ON public.google_accounts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create google accounts" ON public.google_accounts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own google accounts" ON public.google_accounts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own google accounts" ON public.google_accounts
    FOR DELETE USING (auth.uid() = user_id);

-- GBP managers policies
CREATE POLICY "Users can view own gbp managers" ON public.gbp_managers
    FOR SELECT USING (
        auth.uid() = (
            SELECT user_id FROM public.google_accounts
            WHERE id = google_account_id
        )
    );

CREATE POLICY "Users can create gbp managers" ON public.gbp_managers
    FOR INSERT WITH CHECK (
        auth.uid() = (
            SELECT user_id FROM public.google_accounts
            WHERE id = google_account_id
        )
    );

CREATE POLICY "Users can update own gbp managers" ON public.gbp_managers
    FOR UPDATE USING (
        auth.uid() = (
            SELECT user_id FROM public.google_accounts
            WHERE id = google_account_id
        )
    );

CREATE POLICY "Users can delete own gbp managers" ON public.gbp_managers
    FOR DELETE USING (
        auth.uid() = (
            SELECT user_id FROM public.google_accounts
            WHERE id = google_account_id
        )
    );

-- Step 11: Add triggers for updated_at timestamps
CREATE TRIGGER update_google_accounts_updated_at BEFORE UPDATE ON public.google_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_gbp_managers_updated_at BEFORE UPDATE ON public.gbp_managers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Step 12: Clean up the migration function
DROP FUNCTION IF EXISTS migrate_existing_google_data();