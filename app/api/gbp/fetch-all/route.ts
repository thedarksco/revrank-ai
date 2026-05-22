import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' })
  }

  // Get accounts with tokens
  const { data: accounts, error: accountsError } = await supabase
    .from('google_accounts')
    .select('*, google_tokens(*)')
    .eq('user_id', user.id)

  if (accountsError || !accounts || accounts.length === 0) {
    return NextResponse.json({
      error: 'No Google accounts found',
      details: accountsError
    })
  }

  const allResults = []

  for (const account of accounts) {
    const token = account.google_tokens?.[0]?.access_token

    if (!token) {
      allResults.push({
        account_email: account.email,
        error: 'No token'
      })
      continue
    }

    try {
      // 1. First get the GMB accounts
      const accountsRes = await fetch(
        'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      )

      if (!accountsRes.ok) {
        allResults.push({
          account_email: account.email,
          error: `Accounts API failed: ${accountsRes.status}`,
          details: await accountsRes.text()
        })
        continue
      }

      const accountsData = await accountsRes.json()
      const gmbAccounts = accountsData.accounts || []

      // 2. For each GMB account, get locations
      for (const gmbAccount of gmbAccounts) {
        const locationsRes = await fetch(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${gmbAccount.name}/locations?pageSize=100`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        )

        if (!locationsRes.ok) {
          allResults.push({
            account_email: account.email,
            gmb_account: gmbAccount.name,
            error: `Locations API failed: ${locationsRes.status}`,
            details: await locationsRes.text()
          })
          continue
        }

        const locationsData = await locationsRes.json()

        allResults.push({
          account_email: account.email,
          gmb_account: gmbAccount.name,
          account_type: gmbAccount.type,
          locations_count: locationsData.locations?.length || 0,
          locations: locationsData.locations || []
        })

        // Save to database
        if (locationsData.locations?.length > 0) {
          for (const location of locationsData.locations) {
            await supabase
              .from('gbp_locations')
              .upsert({
                user_id: user.id,
                google_account_id: account.id,
                google_account_email: account.email,
                account_name: gmbAccount.name,
                location_name: location.title || location.name,
                place_id: location.name?.split('/').pop(),
                formatted_address: location.storefrontAddress?.addressLines?.join(', '),
                phone: location.phoneNumbers?.primaryPhone,
                website: location.websiteUri,
                primary_category: location.primaryCategory?.displayName,
                verified: location.verificationState === 'VERIFIED',
                last_synced: new Date().toISOString()
              }, {
                onConflict: 'user_id,place_id',
                ignoreDuplicates: false
              })
          }
        }
      }

      // 3. Also try the direct search endpoint for managed locations
      const searchRes = await fetch(
        'https://mybusinessaccountmanagement.googleapis.com/v1/locations:search',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            pageSize: 100,
            // Search for all locations this account can access
            query: {}
          })
        }
      )

      if (searchRes.ok) {
        const searchData = await searchRes.json()
        allResults.push({
          account_email: account.email,
          search_results: searchData.locations?.length || 0,
          search_data: searchData
        })
      }

    } catch (error: any) {
      allResults.push({
        account_email: account.email,
        error: error.message
      })
    }
  }

  return NextResponse.json({
    user_email: user.email,
    accounts_checked: accounts.length,
    results: allResults
  })
}