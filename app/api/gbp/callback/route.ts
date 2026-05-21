import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    console.error('GBP OAuth error:', error)
    return NextResponse.redirect(new URL('/clients?error=gbp_auth_failed', request.url))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/clients?error=missing_params', request.url))
  }

  try {
    // Parse state to get clientId, userId, and account selection preferences
    const { clientId, userId, accountSelection, hostedDomain } = JSON.parse(state)

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || 'https://revrank-ai.vercel.app'}/api/gbp/callback`,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error('Token exchange failed:', errorData)
      return NextResponse.redirect(new URL(`/clients/${clientId}?error=token_exchange_failed`, request.url))
    }

    const tokens = await tokenResponse.json()

    // Get user info from Google to identify the specific account
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
      },
    })

    let userInfo = null
    if (userInfoResponse.ok) {
      userInfo = await userInfoResponse.json()
    }

    // Save tokens to database
    const supabase = await createClient()

    // Verify user owns this client
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('user_id', userId)
      .single()

    if (!client) {
      return NextResponse.redirect(new URL('/clients?error=unauthorized', request.url))
    }

    let googleAccountId = null

    // Store or update Google account info
    if (userInfo) {
      const { data: googleAccount, error: accountError } = await supabase
        .from('google_accounts')
        .upsert({
          user_id: userId,
          google_account_id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name,
          picture_url: userInfo.picture,
          account_type: hostedDomain ? 'gsuite' : 'standard',
          hosted_domain: hostedDomain,
          is_active: true,
          last_connected: new Date().toISOString()
        }, {
          onConflict: 'user_id, google_account_id'
        })
        .select()
        .single()

      if (accountError) {
        console.error('Failed to save Google account:', accountError)
      } else {
        googleAccountId = googleAccount.id
      }
    }

    // Store or update Google tokens
    const { error: tokenError } = await supabase
      .from('google_tokens')
      .upsert({
        google_account_id: googleAccountId,
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        scope: tokens.scope ? tokens.scope.split(' ') : [],
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'google_account_id'
      })

    if (tokenError) {
      console.error('Failed to save tokens:', tokenError)
      return NextResponse.redirect(new URL(`/clients/${clientId}?error=save_failed`, request.url))
    }

    // Update client with Google account association and GBP connection status
    const { error: updateError } = await supabase
      .from('clients')
      .update({
        google_account_id: googleAccountId,
        gbp_connected: true,
        gbp_connection_date: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', clientId)

    if (updateError) {
      console.error('Failed to update client:', updateError)
    }

    // Redirect to client page with success message
    return NextResponse.redirect(new URL(`/clients/${clientId}?success=gbp_connected`, request.url))

  } catch (err) {
    console.error('GBP callback error:', err)
    return NextResponse.redirect(new URL('/clients?error=unexpected_error', request.url))
  }
}