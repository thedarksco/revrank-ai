import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get the current user
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get the user's Google accounts with tokens
    const { data: googleAccounts } = await supabase
      .from('google_accounts')
      .select('*, google_tokens(*)')
      .eq('user_id', user.id)
      .eq('is_active', true)

    console.log('Found Google accounts:', googleAccounts?.length)

    if (!googleAccounts || googleAccounts.length === 0) {
      return NextResponse.json({
        error: 'No Google accounts connected',
        step: 'no_accounts'
      })
    }

    const results = []

    // For each Google account, test the API call
    for (const account of googleAccounts) {
      const token = account.google_tokens?.[0]

      if (!token?.access_token) {
        results.push({
          account: account.email,
          error: 'No access token found',
          step: 'no_token'
        })
        continue
      }

      try {
        // Test: Get the account list (organizations)
        const accountsResponse = await fetch(
          'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
          {
            headers: {
              'Authorization': `Bearer ${token.access_token}`,
              'Content-Type': 'application/json'
            }
          }
        )

        console.log(`Accounts API response status for ${account.email}:`, accountsResponse.status)

        if (!accountsResponse.ok) {
          const errorText = await accountsResponse.text()
          results.push({
            account: account.email,
            error: `Accounts API failed: ${accountsResponse.status}`,
            details: errorText,
            step: 'accounts_api_failed'
          })
          continue
        }

        const accountsData = await accountsResponse.json()
        const accounts = accountsData.accounts || []

        results.push({
          account: account.email,
          success: true,
          accounts_found: accounts.length,
          accounts: accounts,
          step: 'success'
        })

        // Test locations for each account
        for (const gbpAccount of accounts) {
          try {
            const locationsResponse = await fetch(
              `https://mybusinessbusinessinformation.googleapis.com/v1/${gbpAccount.name}/locations`,
              {
                headers: {
                  'Authorization': `Bearer ${token.access_token}`,
                  'Content-Type': 'application/json'
                }
              }
            )

            if (locationsResponse.ok) {
              const locationsData = await locationsResponse.json()
              results.push({
                account: account.email,
                gbp_account: gbpAccount.name,
                locations_found: locationsData.locations?.length || 0,
                locations: locationsData.locations || [],
                step: 'locations_success'
              })
            } else {
              const errorText = await locationsResponse.text()
              results.push({
                account: account.email,
                gbp_account: gbpAccount.name,
                error: `Locations API failed: ${locationsResponse.status}`,
                details: errorText,
                step: 'locations_api_failed'
              })
            }
          } catch (locError: any) {
            results.push({
              account: account.email,
              gbp_account: gbpAccount.name,
              error: 'Locations fetch error',
              details: locError.message,
              step: 'locations_fetch_error'
            })
          }
        }

      } catch (error: any) {
        results.push({
          account: account.email,
          error: 'Accounts fetch error',
          details: error.message,
          step: 'accounts_fetch_error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      user_id: user.id,
      google_accounts_count: googleAccounts.length,
      results: results
    })

  } catch (error: any) {
    console.error('Error in test-fetch:', error)
    return NextResponse.json({
      error: 'Failed to test fetch',
      message: error.message,
      step: 'general_error'
    }, { status: 500 })
  }
}