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

    // Get Google accounts
    const { data: googleAccounts } = await supabase
      .from('google_accounts')
      .select('*, google_tokens(*)')
      .eq('user_id', user.id)

    console.log('=== FETCH DEBUG START ===')
    console.log(`User ID: ${user.id}`)
    console.log(`Google accounts found: ${googleAccounts?.length || 0}`)

    if (!googleAccounts || googleAccounts.length === 0) {
      return NextResponse.json({
        error: 'No Google accounts found',
        user_id: user.id,
        accounts: [],
        debug: 'No google_accounts records found for this user'
      })
    }

    const results = []

    for (const account of googleAccounts) {
      console.log(`\n=== TESTING ACCOUNT: ${account.email} ===`)

      const result = {
        account: {
          email: account.email,
          name: account.name,
          google_account_id: account.google_account_id,
          is_active: account.is_active
        },
        tokens: null,
        api_test: null,
        error: null
      }

      // Check tokens
      const tokenData = account.google_tokens?.[0]
      if (!tokenData?.access_token) {
        result.error = 'No access token found'
        console.log(`❌ No access token for ${account.email}`)
        results.push(result)
        continue
      }

      result.tokens = {
        has_access_token: !!tokenData.access_token,
        has_refresh_token: !!tokenData.refresh_token,
        expires_at: tokenData.token_expires_at,
        scope: tokenData.scope
      }

      // Test API access
      console.log(`Testing API access for ${account.email}...`)
      try {
        const response = await fetch(
          'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
          {
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'Content-Type': 'application/json'
            }
          }
        )

        console.log(`API Response Status: ${response.status}`)

        if (response.ok) {
          const data = await response.json()
          result.api_test = {
            success: true,
            accounts_found: data.accounts?.length || 0,
            accounts: data.accounts?.map((acc: any) => ({
              name: acc.name,
              accountName: acc.accountName,
              accountNumber: acc.accountNumber,
              type: acc.type
            })) || []
          }
          console.log(`✅ Found ${data.accounts?.length || 0} business accounts`)
        } else {
          const errorText = await response.text()
          result.api_test = {
            success: false,
            status: response.status,
            error: errorText
          }
          console.log(`❌ API Error: ${response.status} - ${errorText}`)
        }
      } catch (apiError: any) {
        result.api_test = {
          success: false,
          error: apiError.message
        }
        console.log(`❌ API Exception: ${apiError.message}`)
      }

      results.push(result)
    }

    const summary = {
      total_accounts: googleAccounts.length,
      accounts_with_tokens: results.filter(r => r.tokens?.has_access_token).length,
      successful_api_calls: results.filter(r => r.api_test?.success).length,
      total_business_accounts: results.reduce((sum, r) => sum + (r.api_test?.accounts_found || 0), 0)
    }

    console.log(`\n=== SUMMARY ===`)
    console.log(`Total Google accounts: ${summary.total_accounts}`)
    console.log(`With valid tokens: ${summary.accounts_with_tokens}`)
    console.log(`Successful API calls: ${summary.successful_api_calls}`)
    console.log(`Business accounts found: ${summary.total_business_accounts}`)

    return NextResponse.json({
      user_id: user.id,
      summary,
      detailed_results: results,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Error in test-fetch-debug:', error)
    return NextResponse.json({
      error: 'Failed to test fetch',
      message: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}