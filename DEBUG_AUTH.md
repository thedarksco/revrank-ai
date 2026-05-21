# Authentication Debug Guide

## The Problem
After Google OAuth, you're being redirected to localhost:3000 instead of https://revrank-ai.vercel.app

## Root Cause
This happens when Supabase's **Site URL** is set to localhost instead of your production URL.

## CRITICAL FIX REQUIRED

### Step 1: Update Supabase Site URL (THIS IS THE KEY!)

1. Go to: https://supabase.com/dashboard/project/pofwmancpflmmsosqzxi/auth/url-configuration
2. Find the **Site URL** field
3. Change it from `http://localhost:3000` to `https://revrank-ai.vercel.app`
4. Click Save

### Step 2: Add Redirect URLs in Supabase

In the same page, under **Redirect URLs**, make sure you have:
- `https://revrank-ai.vercel.app/**`
- `http://localhost:3000/**` (for local development)

### Step 3: Verify Google Cloud Console

Ensure these URLs are in your OAuth client's Authorized redirect URIs:
- `https://pofwmancpflmmsosqzxi.supabase.co/auth/v1/callback`
- `https://revrank-ai.vercel.app/auth/callback`
- `http://localhost:3000/auth/callback`

## Why This Happens

When you sign in with Google:
1. Google redirects to Supabase: `https://pofwmancpflmmsosqzxi.supabase.co/auth/v1/callback`
2. Supabase then redirects to your app using the **Site URL** setting
3. If Site URL is set to localhost, that's where you end up!

## Testing After Fix

1. Clear all cookies for revrank-ai.vercel.app and pofwmancpflmmsosqzxi.supabase.co
2. Use incognito/private window
3. Go to https://revrank-ai.vercel.app/auth
4. Sign in with Google
5. You should land at https://revrank-ai.vercel.app/dashboard

## Alternative Manual Fix

If you can't access Supabase dashboard, you can manually redirect after landing on localhost:
- When you see the localhost error, copy the URL
- Replace `localhost:3000` with `revrank-ai.vercel.app`
- Navigate to the modified URL