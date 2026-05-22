import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({
      error: 'Not authenticated',
      user: null,
      userError
    })
  }

  // Check google_accounts table
  const { data: accounts, error: accountsError } = await supabase
    .from('google_accounts')
    .select('*')
    .eq('user_id', user.id)

  // Check google_tokens table
  const { data: tokens, error: tokensError } = await supabase
    .from('google_tokens')
    .select('*')
    .eq('user_id', user.id)

  // Check gbp_locations table
  const { data: locations, error: locationsError } = await supabase
    .from('gbp_locations')
    .select('*')
    .eq('user_id', user.id)

  // Try fetching with token
  let apiTest = null
  if (tokens && tokens[0]) {
    try {
      const response = await fetch(
        'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
        {
          headers: {
            'Authorization': `Bearer ${tokens[0].access_token}`
          }
        }
      )
      apiTest = {
        status: response.status,
        ok: response.ok,
        body: await response.text()
      }
    } catch (e: any) {
      apiTest = { error: e.message }
    }
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email
    },
    database: {
      google_accounts: {
        count: accounts?.length || 0,
        data: accounts,
        error: accountsError
      },
      google_tokens: {
        count: tokens?.length || 0,
        data: tokens?.map(t => ({
          id: t.id,
          google_account_id: t.google_account_id,
          has_access_token: !!t.access_token,
          has_refresh_token: !!t.refresh_token,
          expires_at: t.token_expires_at,
          scope: t.scope
        })),
        error: tokensError
      },
      gbp_locations: {
        count: locations?.length || 0,
        data: locations,
        error: locationsError
      }
    },
    api_test: apiTest
  })
}