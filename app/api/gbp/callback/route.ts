import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  console.log('=== OAUTH CALLBACK START ===')
  console.log('Code received:', !!code)
  console.log('Error:', error)

  if (error) {
    console.error('OAuth error:', error)
    return NextResponse.redirect(new URL('/dashboard?error=oauth_error', request.url))
  }

  if (!code) {
    console.error('No OAuth code received')
    return NextResponse.redirect(new URL('/dashboard?error=no_code', request.url))
  }

  try {
    // Get current user
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      console.error('No authenticated user')
      return NextResponse.redirect(new URL('/auth?error=not_authenticated', request.url))
    }

    console.log('Authenticated user ID:', user.id)

    // Exchange code for tokens
    console.log('Exchanging code for tokens...')
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: 'https://revrank-ai.vercel.app/api/gbp/callback',
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error('Token exchange failed:', errorData)
      return NextResponse.redirect(new URL('/dashboard?error=token_failed', request.url))
    }

    const tokens = await tokenResponse.json()
    console.log('Tokens received:', {
      has_access: !!tokens.access_token,
      has_refresh: !!tokens.refresh_token,
      scopes: tokens.scope
    })

    // Get user info from Google
    console.log('Getting user info from Google...')
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    })

    if (!userInfoResponse.ok) {
      console.error('Failed to get user info from Google')
      return NextResponse.redirect(new URL('/dashboard?error=userinfo_failed', request.url))
    }

    const googleUser = await userInfoResponse.json()
    console.log('Google user info:', { id: googleUser.id, email: googleUser.email, name: googleUser.name })

    // STEP 1: Create/update Google account
    console.log('Step 1: Creating/updating Google account...')

    // Delete any existing account for this Google ID and user
    await supabase
      .from('google_accounts')
      .delete()
      .eq('user_id', user.id)
      .eq('google_account_id', googleUser.id)

    // Insert new Google account
    const { data: googleAccount, error: accountError } = await supabase
      .from('google_accounts')
      .insert({
        user_id: user.id,
        google_account_id: googleUser.id,
        email: googleUser.email,
        name: googleUser.name,
        picture_url: googleUser.picture,
        account_type: 'standard',
        is_active: true,
        last_connected: new Date().toISOString()
      })
      .select()
      .single()

    if (accountError || !googleAccount) {
      console.error('Failed to save Google account:', accountError)
      return NextResponse.redirect(new URL('/dashboard?error=account_save_failed', request.url))
    }

    console.log('Google account saved with ID:', googleAccount.id)

    // STEP 2: Save tokens
    console.log('Step 2: Saving tokens...')

    // Delete any existing tokens for this account
    await supabase
      .from('google_tokens')
      .delete()
      .eq('google_account_id', googleAccount.id)

    // Insert new tokens
    const { error: tokenError } = await supabase
      .from('google_tokens')
      .insert({
        google_account_id: googleAccount.id,
        user_id: user.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
        scope: tokens.scope ? tokens.scope.split(' ') : []
      })

    if (tokenError) {
      console.error('Failed to save tokens:', tokenError)
      return NextResponse.redirect(new URL('/dashboard?error=token_save_failed', request.url))
    }

    console.log('Tokens saved successfully!')
    console.log('=== OAUTH CALLBACK SUCCESS ===')

    // Success! Redirect to dashboard
    return NextResponse.redirect(new URL('/dashboard?success=connected', request.url))

  } catch (err: any) {
    console.error('=== OAUTH CALLBACK ERROR ===')
    console.error('Error:', err)
    return NextResponse.redirect(new URL('/dashboard?error=unexpected', request.url))
  }
}