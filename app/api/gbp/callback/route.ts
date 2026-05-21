import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    console.error('GBP OAuth error:', error)
    return NextResponse.redirect(new URL('/dashboard?error=gbp_auth_failed', request.url))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/dashboard?error=missing_params', request.url))
  }

  let parsedState: any = {}
  try {
    // Parse state to get clientId, userId, and account selection preferences
    parsedState = JSON.parse(state)

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
        redirect_uri: 'https://revrank-ai.vercel.app/api/gbp/callback',
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error('Token exchange failed:', errorData)
      const redirectUrl = parsedState.clientId ? `/clients/${parsedState.clientId}?error=token_exchange_failed` : '/dashboard?error=token_exchange_failed'
      return NextResponse.redirect(new URL(redirectUrl, request.url))
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

    // If parsedState.clientId is provided, verify user owns this client
    if (parsedState.clientId) {
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('id', parsedState.clientId)
        .eq('user_id', parsedState.userId)
        .single()

      if (!client) {
        return NextResponse.redirect(new URL('/clients?error=unauthorized', request.url))
      }
    }

    let googleAccountId = null

    // Store or update Google account info
    if (userInfo) {
      console.log('Attempting to save Google account with userInfo:', userInfo)
      console.log('Parsed state:', parsedState)

      const accountData = {
        user_id: parsedState.userId,
        google_account_id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name || userInfo.given_name || 'Google User',
        picture_url: userInfo.picture,
        account_type: parsedState.hostedDomain ? 'gsuite' : 'standard',
        hosted_domain: parsedState.hostedDomain,
        is_active: true,
        last_connected: new Date().toISOString()
      }

      console.log('Account data to save:', accountData)

      const { data: googleAccount, error: accountError } = await supabase
        .from('google_accounts')
        .upsert(accountData, {
          onConflict: 'user_id, google_account_id'
        })
        .select()
        .single()

      if (accountError) {
        console.error('Failed to save Google account:', accountError)
        console.error('Account save error details:', {
          code: accountError.code,
          message: accountError.message,
          details: accountError.details,
          hint: accountError.hint,
          userId: parsedState.userId,
          googleAccountId: userInfo.id,
          userInfo: userInfo
        })

        // Check specific error types
        if (accountError.message?.includes('relation') && accountError.message?.includes('does not exist')) {
          const redirectUrl = parsedState.clientId
            ? `/clients/${parsedState.clientId}?error=tables_not_found`
            : '/dashboard?error=tables_not_found'
          return NextResponse.redirect(new URL(redirectUrl, request.url))
        }

        if (accountError.message?.includes('violates foreign key constraint')) {
          const redirectUrl = parsedState.clientId
            ? `/clients/${parsedState.clientId}?error=user_not_found`
            : '/dashboard?error=user_not_found'
          return NextResponse.redirect(new URL(redirectUrl, request.url))
        }

        if (accountError.message?.includes('duplicate key')) {
          // Try to get existing account
          const { data: existingAccount } = await supabase
            .from('google_accounts')
            .select('id')
            .eq('user_id', parsedState.userId)
            .eq('google_account_id', userInfo.id)
            .single()

          if (existingAccount) {
            googleAccountId = existingAccount.id
            console.log('Using existing Google account:', googleAccountId)
          } else {
            const redirectUrl = parsedState.clientId
              ? `/clients/${parsedState.clientId}?error=duplicate_account`
              : '/dashboard?error=duplicate_account'
            return NextResponse.redirect(new URL(redirectUrl, request.url))
          }
        } else {
          // Generic error
          const redirectUrl = parsedState.clientId
            ? `/clients/${parsedState.clientId}?error=save_failed`
            : '/dashboard?error=save_failed'
          return NextResponse.redirect(new URL(redirectUrl, request.url))
        }
      } else if (googleAccount) {
        googleAccountId = googleAccount.id
        console.log('Google account saved successfully:', {
          id: googleAccountId,
          email: userInfo.email
        })
      }
    }

    // Store or update Google tokens
    const { error: tokenError } = await supabase
      .from('google_tokens')
      .upsert({
        google_account_id: googleAccountId,
        user_id: parsedState.userId,
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
      const redirectUrl = parsedState.clientId ? `/clients/${parsedState.clientId}?error=save_failed` : '/dashboard?error=save_failed'
      return NextResponse.redirect(new URL(redirectUrl, request.url))
    }

    // Update client with Google account association and GBP connection status (if parsedState.clientId provided)
    if (parsedState.clientId) {
      const { error: updateError } = await supabase
        .from('clients')
        .update({
          google_account_id: googleAccountId,
          gbp_connected: true,
          gbp_connection_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', parsedState.clientId)

      if (updateError) {
        console.error('Failed to update client:', updateError)
      }

      // Redirect to client page with success message
      return NextResponse.redirect(new URL(`/clients/${parsedState.clientId}?success=gbp_connected`, request.url))
    } else {
      // Redirect to dashboard with success message
      return NextResponse.redirect(new URL('/dashboard?success=account_connected', request.url))
    }

  } catch (err) {
    console.error('GBP callback error:', err)
    const redirectUrl = parsedState.clientId ? `/clients/${parsedState.clientId}?error=unexpected_error` : '/dashboard?error=unexpected_error'
    return NextResponse.redirect(new URL(redirectUrl, request.url))
  }
}