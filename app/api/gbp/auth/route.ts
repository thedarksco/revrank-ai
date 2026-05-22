import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Google OAuth scopes needed for GBP management
// Using only valid, current scopes for Google Business Profile access
const GBP_SCOPES = [
  'https://www.googleapis.com/auth/business.manage',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email'
].join(' ')

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const clientId = searchParams.get('clientId')
  const accountSelection = searchParams.get('accountSelection') === 'true'
  const hostedDomain = searchParams.get('hd') // For G Suite domain accounts
  const debug = searchParams.get('debug') === 'true'

  // Verify user is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/auth', request.url))
  }

  // If clientId is provided, verify client belongs to user
  if (clientId) {
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('user_id', user.id)
      .single()

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }
  }

  // Build Google OAuth URL
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')

  // Force production URL to always be the same
  // Must match EXACTLY what's in Google Cloud Console
  const redirectUri = 'https://revrank-ai.vercel.app/api/gbp/callback'

  // Build params manually to ensure exact formatting
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GBP_SCOPES,
    access_type: 'offline'
  })

  // Set prompt based on account selection preference
  // Google OAuth only accepts a single prompt value, not space-separated
  if (accountSelection) {
    // Use select_account to force account picker (this also triggers consent when needed)
    params.set('prompt', 'select_account')
  } else {
    // Default to consent for refresh token
    params.set('prompt', 'consent')
  }

  // Enhanced state with account selection preference
  const state = {
    clientId,
    userId: user.id,
    userEmail: user.email, // Add user email to state for backup
    accountSelection,
    hostedDomain,
    debug
  }
  params.set('state', JSON.stringify(state))

  // Add hosted domain hint for G Suite accounts
  if (hostedDomain) {
    params.set('hd', hostedDomain)
  }

  // Construct final URL
  const finalUrl = `${authUrl.toString()}?${params.toString()}`
  console.log('Final OAuth URL:', finalUrl)
  console.log('Redirect URI in URL:', redirectUri)

  return NextResponse.redirect(finalUrl)
}