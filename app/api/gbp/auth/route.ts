import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Google OAuth scopes needed for GBP management
const GBP_SCOPES = [
  'https://www.googleapis.com/auth/business.manage',
  'https://www.googleapis.com/auth/businesscommunications',
  'https://www.googleapis.com/auth/plus.business.manage'
].join(' ')

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const clientId = searchParams.get('clientId')
  const accountSelection = searchParams.get('accountSelection') === 'true'
  const hostedDomain = searchParams.get('hd') // For G Suite domain accounts

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
  authUrl.searchParams.append('client_id', process.env.GOOGLE_CLIENT_ID!)

  // Force production URL to always be the same
  // Must match EXACTLY what's in Google Cloud Console
  const redirectUri = 'https://revrank-ai.vercel.app/api/gbp/callback'

  // Log for debugging
  console.log('OAuth redirect URI being used:', redirectUri)
  console.log('Environment:', process.env.NODE_ENV)
  authUrl.searchParams.append('redirect_uri', redirectUri)
  authUrl.searchParams.append('response_type', 'code')
  authUrl.searchParams.append('scope', GBP_SCOPES)
  authUrl.searchParams.append('access_type', 'offline')

  // Set prompt based on account selection preference
  // Google OAuth only accepts a single prompt value, not space-separated
  if (accountSelection) {
    // Use select_account to force account picker (this also triggers consent when needed)
    authUrl.searchParams.append('prompt', 'select_account')
  } else {
    // Default to consent for refresh token
    authUrl.searchParams.append('prompt', 'consent')
  }

  // Enhanced state with account selection preference
  const state = {
    clientId,
    userId: user.id,
    accountSelection,
    hostedDomain
  }
  authUrl.searchParams.append('state', JSON.stringify(state))

  // Add hosted domain hint for G Suite accounts
  if (hostedDomain) {
    authUrl.searchParams.append('hd', hostedDomain)
  }

  return NextResponse.redirect(authUrl.toString())
}