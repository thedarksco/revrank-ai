import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.json({
      error: 'OAuth error',
      details: error
    })
  }

  if (!code || !state) {
    return NextResponse.json({
      error: 'Missing params',
      code: !!code,
      state: !!state
    })
  }

  let parsedState: any = {}
  try {
    parsedState = JSON.parse(state)
  } catch (e) {
    return NextResponse.json({
      error: 'Invalid state',
      state: state
    })
  }

  try {
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
        redirect_uri: 'https://revrank-ai.vercel.app/api/gbp/debug-callback',
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      return NextResponse.json({
        error: 'Token exchange failed',
        details: errorData
      })
    }

    const tokens = await tokenResponse.json()

    // Get user info
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
      },
    })

    let userInfo = null
    if (userInfoResponse.ok) {
      userInfo = await userInfoResponse.json()
    }

    // Get current user from Supabase
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Try to save to database
    let saveResult = null
    let saveError = null

    if (user && userInfo) {
      const { data, error } = await supabase
        .from('google_accounts')
        .insert({
          user_id: user.id,
          google_account_id: String(userInfo.id),
          email: String(userInfo.email),
          name: String(userInfo.name || userInfo.given_name || 'Google User'),
          picture_url: userInfo.picture || null,
          account_type: 'standard',
          is_active: true
        })
        .select()
        .single()

      saveResult = data
      saveError = error
    }

    // Return all debug info
    return NextResponse.json({
      success: !saveError,
      debug_info: {
        google_user_info: userInfo,
        parsed_state: parsedState,
        supabase_user: user ? { id: user.id, email: user.email } : null,
        token_info: {
          has_access_token: !!tokens.access_token,
          has_refresh_token: !!tokens.refresh_token,
          expires_in: tokens.expires_in,
          scope: tokens.scope
        },
        save_attempt: {
          result: saveResult,
          error: saveError ? {
            message: saveError.message,
            code: saveError.code,
            details: saveError.details,
            hint: saveError.hint
          } : null
        }
      }
    })

  } catch (err: any) {
    return NextResponse.json({
      error: 'Unexpected error',
      message: err.message,
      stack: err.stack
    })
  }
}