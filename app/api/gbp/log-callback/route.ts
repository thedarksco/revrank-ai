import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const log: any[] = []

  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    log.push({ step: 'params', code: !!code, state: !!state, error })

    if (error) {
      return NextResponse.json({ error: 'OAuth error', details: error, log })
    }

    if (!code || !state) {
      return NextResponse.json({ error: 'Missing params', code: !!code, state: !!state, log })
    }

    // Parse state
    let parsedState: any = {}
    try {
      parsedState = JSON.parse(state)
      log.push({ step: 'state_parsed', parsedState })
    } catch (e: any) {
      log.push({ step: 'state_parse_error', error: e.message, raw_state: state })
      return NextResponse.json({ error: 'State parse failed', log })
    }

    // Get userId from state
    const userId = parsedState.userId
    log.push({ step: 'userId_extracted', userId, has_userId: !!userId })

    if (!userId) {
      return NextResponse.json({ error: 'No userId in state', parsedState, log })
    }

    // Exchange code for tokens
    log.push({ step: 'exchanging_tokens' })

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: 'https://revrank-ai.vercel.app/api/gbp/log-callback',
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      log.push({ step: 'token_exchange_failed', error: errorData })
      return NextResponse.json({ error: 'Token exchange failed', details: errorData, log })
    }

    const tokens = await tokenResponse.json()
    log.push({ step: 'tokens_received', has_access_token: !!tokens.access_token })

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
      },
    })

    let userInfo = null
    if (userInfoResponse.ok) {
      userInfo = await userInfoResponse.json()
      log.push({ step: 'google_user_info', email: userInfo.email, id: userInfo.id })
    } else {
      log.push({ step: 'google_user_info_failed' })
    }

    // Database operations
    const supabase = await createClient()

    // Check profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()

    log.push({ step: 'profile_check', exists: !!profile, error: profileError?.message })

    // Prepare account data
    const accountData = {
      user_id: userId,
      google_account_id: String(userInfo?.id || 'unknown'),
      email: String(userInfo?.email || 'unknown@google.com'),
      name: String(userInfo?.name || 'Google User'),
      picture_url: userInfo?.picture || null,
      account_type: 'standard',
      hosted_domain: null,
      is_active: true,
      last_connected: new Date().toISOString()
    }

    log.push({ step: 'account_data_prepared', accountData })

    // Try to save
    const { data: googleAccount, error: accountError } = await supabase
      .from('google_accounts')
      .insert(accountData)
      .select()
      .single()

    log.push({
      step: 'save_attempt',
      success: !!googleAccount,
      error: accountError ? {
        message: accountError.message,
        code: accountError.code,
        details: accountError.details
      } : null
    })

    return NextResponse.json({
      success: !!googleAccount,
      account: googleAccount,
      log: log,
      final_message: googleAccount ? 'Account saved successfully!' : 'Failed to save account'
    })

  } catch (err: any) {
    log.push({ step: 'unexpected_error', error: err.message })
    return NextResponse.json({
      error: 'Unexpected error',
      message: err.message,
      log: log
    })
  }
}