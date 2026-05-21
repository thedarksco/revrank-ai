# 🚨 URGENT: Database Migration Required

Your Google OAuth is working correctly, but the accounts cannot be saved because the database tables don't exist yet.

## Quick Fix (2 minutes)

### Step 1: Open Supabase SQL Editor
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your RevRank project
3. Click **"SQL Editor"** in the left sidebar

### Step 2: Run the Migration
1. Click **"New Query"** button
2. Copy the ENTIRE contents of: `supabase/RUN_THIS_MIGRATION.sql`
3. Paste into the SQL Editor
4. Click **"Run"** button
5. You should see: `"Success. No rows returned"`

### Step 3: Test the Connection
1. Go back to [RevRank Dashboard](https://revrank-ai.vercel.app/dashboard)
2. Click **"Add Account"**
3. Select your Google account
4. Your account should now be saved and displayed!

## What This Migration Does

Creates two new tables:
- **google_accounts**: Stores multiple Google accounts per user
- **gbp_managers**: Stores Google Business Profile manager relationships

Adds security features:
- Row Level Security (RLS) policies
- Proper indexes for performance
- Update triggers for timestamps

## Troubleshooting

### If you see an error in SQL Editor:
- Make sure you copied the ENTIRE file contents
- Check that you're in the correct project
- Try running it again (it's safe to run multiple times)

### To verify tables were created:
1. In Supabase Dashboard, go to **"Table Editor"**
2. Look for:
   - `google_accounts` table
   - `gbp_managers` table
3. Both should be visible in the list

### Debug endpoint:
Visit: https://revrank-ai.vercel.app/api/auth/debug
- Check `database.tables.google_accounts_error`
- Should be `null` after migration

## Need Help?
If the migration doesn't work:
1. Check the error message in Supabase SQL Editor
2. Make sure you're using the correct Supabase project
3. Verify your user has admin permissions