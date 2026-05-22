import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Get the current user
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({
        error: "Not authenticated",
        message: "You need to be logged into RevRank.ai to check tokens"
      })
    }

    // Check if user has Google accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('google_accounts')
      .select('*')
      .eq('user_id', user.id)

    if (accountsError) {
      return NextResponse.json({
        error: "Database error checking accounts",
        details: accountsError
      })
    }

    // Check if user has tokens for each account
    const accountsWithTokens = []

    for (const account of accounts || []) {
      const { data: tokens, error: tokensError } = await supabase
        .from('google_tokens')
        .select('access_token, refresh_token, token_expires_at, scope')
        .eq('google_account_id', account.id)
        .single()

      accountsWithTokens.push({
        account: {
          id: account.id,
          email: account.email,
          name: account.name,
          google_account_id: account.google_account_id,
          is_active: account.is_active
        },
        tokens: tokens ? {
          has_access_token: !!tokens.access_token,
          has_refresh_token: !!tokens.refresh_token,
          expires_at: tokens.token_expires_at,
          scopes: tokens.scope,
          is_expired: tokens.token_expires_at ? new Date(tokens.token_expires_at) < new Date() : true
        } : null,
        tokens_error: tokensError
      })
    }

    return NextResponse.json({
      user_id: user.id,
      user_email: user.email,
      total_accounts: accounts?.length || 0,
      accounts: accountsWithTokens,
      debug_info: {
        timestamp: new Date().toISOString(),
        next_steps: accounts?.length === 0
          ? "No Google accounts found - you need to connect a Google account"
          : accountsWithTokens.every(a => !a.tokens)
          ? "Accounts found but no tokens - OAuth callback failed to save tokens"
          : "Accounts and tokens found - check if tokens are expired or have wrong scopes"
      }
    })

  } catch (error: any) {
    console.error('Debug tokens error:', error)
    return NextResponse.json({
      error: "Unexpected error",
      message: error.message
    }, { status: 500 })
  }
}