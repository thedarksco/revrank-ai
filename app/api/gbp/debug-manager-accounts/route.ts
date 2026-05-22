import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
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

    if (!googleAccounts || googleAccounts.length === 0) {
      return NextResponse.json({
        error: 'No Google accounts connected',
        accounts: [],
        step: 'no_accounts'
      })
    }

    console.log('=== MANAGER ACCOUNTS DEBUG ===')
    console.log(`Found ${googleAccounts.length} Google accounts`)

    const results = []

    // For each Google account, check what it can access
    for (const account of googleAccounts) {
      const result = {
        account_email: account.email,
        account_name: account.name,
        step: 'starting',
        has_token: false,
        token_expired: false,
        api_calls: []
      }

      const tokenData = account.google_tokens?.[0]

      if (!tokenData?.access_token) {
        result.step = 'no_token'
        results.push(result)
        continue
      }

      result.has_token = true

      // Check if token needs refresh
      const now = new Date()
      const expiresAt = new Date(tokenData.token_expires_at || 0)
      let accessToken = tokenData.access_token

      if (expiresAt <= now) {
        result.token_expired = true
        result.step = 'token_expired'
        results.push(result)
        continue
      }

      result.step = 'testing_apis'

      // 1. Test Account Management API
      console.log(`Testing Account Management API for ${account.email}`)
      try {
        const accountsResponse = await fetch(
          'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        )

        const accountsResult = {
          api: 'Account Management',
          status: accountsResponse.status,
          success: accountsResponse.ok,
          accounts: []
        }

        if (accountsResponse.ok) {
          const accountsData = await accountsResponse.json()
          accountsResult.accounts = (accountsData.accounts || []).map((acc: any) => ({
            name: acc.name,
            accountName: acc.accountName,
            accountNumber: acc.accountNumber,
            type: acc.type,
            role: acc.role,
            state: acc.state
          }))
          console.log(`Found ${accountsResult.accounts.length} accounts for ${account.email}`)
        } else {
          const errorText = await accountsResponse.text()
          accountsResult.error = errorText
          console.error(`Account Management API failed for ${account.email}:`, errorText)
        }

        result.api_calls.push(accountsResult)

        // 2. For each account, test Business Information API
        if (accountsResponse.ok) {
          const accountsData = await accountsResponse.json()
          const accounts = accountsData.accounts || []

          for (const gbpAccount of accounts.slice(0, 3)) { // Test first 3 to avoid timeout
            console.log(`Testing Business Information API for account: ${gbpAccount.name}`)

            try {
              const locationsResponse = await fetch(
                `https://mybusinessbusinessinformation.googleapis.com/v1/${gbpAccount.name}/locations`,
                {
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                  }
                }
              )

              const locationsResult = {
                api: 'Business Information',
                account_name: gbpAccount.accountName,
                account_number: gbpAccount.accountNumber,
                status: locationsResponse.status,
                success: locationsResponse.ok,
                locations: []
              }

              if (locationsResponse.ok) {
                const locationsData = await locationsResponse.json()
                locationsResult.locations = (locationsData.locations || []).map((loc: any) => ({
                  name: loc.name,
                  title: loc.title,
                  storeCode: loc.storeCode,
                  placeId: loc.metadata?.placeId,
                  verified: loc.verificationState === 'VERIFIED',
                  category: loc.categories?.primary?.displayName,
                  address: loc.address?.administrativeArea || 'No address'
                }))
                console.log(`Found ${locationsResult.locations.length} locations for ${gbpAccount.accountName}`)
              } else {
                const errorText = await locationsResponse.text()
                locationsResult.error = errorText
                console.error(`Business Information API failed for account ${gbpAccount.accountName}:`, errorText)
              }

              result.api_calls.push(locationsResult)
            } catch (locError: any) {
              result.api_calls.push({
                api: 'Business Information',
                account_name: gbpAccount.accountName,
                error: locError.message,
                success: false
              })
            }
          }
        }

      } catch (error: any) {
        result.step = 'api_error'
        result.api_calls.push({
          api: 'Account Management',
          error: error.message,
          success: false
        })
      }

      results.push(result)
    }

    const summary = {
      total_accounts: googleAccounts.length,
      accounts_with_tokens: results.filter(r => r.has_token).length,
      successful_api_calls: results.flatMap(r => r.api_calls.filter(call => call.success)).length,
      failed_api_calls: results.flatMap(r => r.api_calls.filter(call => !call.success)).length,
      total_business_accounts_found: results.flatMap(r =>
        r.api_calls.filter(call => call.api === 'Account Management' && call.success)
          .flatMap(call => call.accounts || [])
      ).length,
      total_locations_found: results.flatMap(r =>
        r.api_calls.filter(call => call.api === 'Business Information' && call.success)
          .flatMap(call => call.locations || [])
      ).length
    }

    console.log('=== SUMMARY ===')
    console.log(`Business accounts found: ${summary.total_business_accounts_found}`)
    console.log(`Locations found: ${summary.total_locations_found}`)

    return NextResponse.json({
      success: true,
      summary,
      detailed_results: results,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Error in debug-manager-accounts:', error)
    return NextResponse.json({
      error: 'Failed to debug manager accounts',
      message: error.message
    }, { status: 500 })
  }
}