import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    console.log('=== GBP DIAGNOSIS START ===')

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // 1. Check environment variables
    const envCheck = {
      GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
      CLIENT_ID_ENDS_WITH: process.env.GOOGLE_CLIENT_ID?.slice(-10)
    }

    // 2. Check database tables exist
    const tableChecks = {}

    try {
      const { data: accountsData, error: accountsError } = await supabase
        .from('google_accounts')
        .select('count', { count: 'exact', head: true })

      tableChecks.google_accounts = {
        exists: !accountsError,
        error: accountsError?.message
      }
    } catch (e) {
      tableChecks.google_accounts = { exists: false, error: e.message }
    }

    try {
      const { data: tokensData, error: tokensError } = await supabase
        .from('google_tokens')
        .select('count', { count: 'exact', head: true })

      tableChecks.google_tokens = {
        exists: !tokensError,
        error: tokensError?.message
      }
    } catch (e) {
      tableChecks.google_tokens = { exists: false, error: e.message }
    }

    try {
      const { data: locationsData, error: locationsError } = await supabase
        .from('gbp_locations')
        .select('count', { count: 'exact', head: true })

      tableChecks.gbp_locations = {
        exists: !locationsError,
        error: locationsError?.message
      }
    } catch (e) {
      tableChecks.gbp_locations = { exists: false, error: e.message }
    }

    // 3. Check user's Google accounts
    const { data: googleAccounts, error: accountsError } = await supabase
      .from('google_accounts')
      .select('id, email, name, is_active, last_connected')
      .eq('user_id', user.id)

    const accountsInfo = {
      count: googleAccounts?.length || 0,
      accounts: googleAccounts?.map(acc => ({
        id: acc.id,
        email: acc.email,
        name: acc.name,
        is_active: acc.is_active,
        last_connected: acc.last_connected
      })) || [],
      error: accountsError?.message
    }

    // 4. Check tokens for each account
    const tokensInfo = []
    if (googleAccounts) {
      for (const account of googleAccounts) {
        const { data: tokens, error: tokenError } = await supabase
          .from('google_tokens')
          .select('access_token, refresh_token, token_expires_at, scope')
          .eq('google_account_id', account.id)
          .single()

        const tokenInfo = {
          account_email: account.email,
          has_access_token: !!tokens?.access_token,
          has_refresh_token: !!tokens?.refresh_token,
          token_expires_at: tokens?.token_expires_at,
          scopes: tokens?.scope,
          token_expired: tokens?.token_expires_at ? new Date(tokens.token_expires_at) < new Date() : null,
          error: tokenError?.message
        }

        // Test if we can refresh the token if it's expired
        if (tokenInfo.token_expired && tokens?.refresh_token) {
          try {
            const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                refresh_token: tokens.refresh_token,
                grant_type: 'refresh_token'
              })
            })

            if (refreshResponse.ok) {
              const refreshData = await refreshResponse.json()
              tokenInfo.refresh_test = 'SUCCESS'
              tokenInfo.new_token_received = !!refreshData.access_token
            } else {
              const errorText = await refreshResponse.text()
              tokenInfo.refresh_test = 'FAILED'
              tokenInfo.refresh_error = errorText
            }
          } catch (e) {
            tokenInfo.refresh_test = 'ERROR'
            tokenInfo.refresh_error = e.message
          }
        }

        tokensInfo.push(tokenInfo)
      }
    }

    // 5. Check existing locations
    const { data: existingLocations, error: locationsError } = await supabase
      .from('gbp_locations')
      .select('id, location_name, google_account_email, last_synced')
      .eq('user_id', user.id)
      .limit(5)

    const locationsInfo = {
      count: existingLocations?.length || 0,
      recent_locations: existingLocations || [],
      error: locationsError?.message
    }

    // 6. Test Google API directly with a valid token
    let apiTest = { status: 'SKIPPED', reason: 'No valid tokens' }
    const validToken = tokensInfo.find(t => t.has_access_token && !t.token_expired)

    if (validToken) {
      try {
        const { data: tokenData } = await supabase
          .from('google_tokens')
          .select('access_token')
          .eq('google_account_id', googleAccounts.find(acc => acc.email === validToken.account_email)?.id)
          .single()

        if (tokenData?.access_token) {
          // Test accounts API
          const accountsResponse = await fetch(
            'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
            {
              headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          )

          apiTest = {
            status: accountsResponse.ok ? 'SUCCESS' : 'FAILED',
            status_code: accountsResponse.status,
            response_preview: accountsResponse.ok
              ? 'API call successful'
              : await accountsResponse.text().then(text => text.substring(0, 200))
          }
        }
      } catch (e) {
        apiTest = { status: 'ERROR', error: e.message }
      }
    }

    const diagnosis = {
      user_id: user.id,
      user_email: user.email,
      timestamp: new Date().toISOString(),
      environment: envCheck,
      database_tables: tableChecks,
      google_accounts: accountsInfo,
      tokens: tokensInfo,
      existing_locations: locationsInfo,
      google_api_test: apiTest
    }

    console.log('=== DIAGNOSIS COMPLETE ===')
    console.log('Summary:', {
      accounts: accountsInfo.count,
      valid_tokens: tokensInfo.filter(t => t.has_access_token && !t.token_expired).length,
      existing_locations: locationsInfo.count,
      api_test: apiTest.status
    })

    return NextResponse.json({
      success: true,
      diagnosis
    })

  } catch (error: any) {
    console.error('Error in diagnosis:', error)
    return NextResponse.json({
      error: 'Diagnosis failed',
      message: error.message
    }, { status: 500 })
  }
}