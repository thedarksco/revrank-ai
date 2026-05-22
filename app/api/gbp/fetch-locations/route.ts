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

    if (!googleAccounts || googleAccounts.length === 0) {
      return NextResponse.json({
        error: 'No Google accounts connected',
        accounts: []
      })
    }

    const allLocations = []

    // For each Google account, fetch the business locations
    for (const account of googleAccounts) {
      const tokenData = account.google_tokens?.[0]

      if (!tokenData?.access_token) {
        console.log(`No valid token for account ${account.email}`)
        continue
      }

      // Check if token needs refresh
      const now = new Date()
      const expiresAt = new Date(tokenData.token_expires_at || 0)
      let accessToken = tokenData.access_token

      if (expiresAt <= now && tokenData.refresh_token) {
        // Refresh the token
        try {
          console.log(`Refreshing expired token for ${account.email}`)
          const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID!,
              client_secret: process.env.GOOGLE_CLIENT_SECRET!,
              refresh_token: tokenData.refresh_token,
              grant_type: 'refresh_token'
            })
          })

          if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json()
            accessToken = refreshData.access_token

            // Update token in database
            await supabase
              .from('google_tokens')
              .update({
                access_token: refreshData.access_token,
                token_expires_at: new Date(Date.now() + (refreshData.expires_in * 1000)).toISOString()
              })
              .eq('google_account_id', account.id)

            console.log(`Token refreshed successfully for ${account.email}`)
          } else {
            console.error(`Failed to refresh token for ${account.email}:`, await refreshResponse.text())
            continue
          }
        } catch (refreshError) {
          console.error(`Error refreshing token for ${account.email}:`, refreshError)
          continue
        }
      }

      try {
        // CRITICAL FIX: Use both new and legacy APIs to find managed accounts
        console.log(`Fetching accounts for ${account.email}`)

        // Try the new Account Management API first
        const accountsResponse = await fetch(
          'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        )

        // Get managed accounts using the correct endpoint
        const managedAccountsResponse = await fetch(
          'https://mybusinessaccountmanagement.googleapis.com/v1/locations:search',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              pageSize: 100
            })
          }
        )

        let allAccounts: any[] = []

        // Process new API response
        if (accountsResponse.ok) {
          const accountsData = await accountsResponse.json()
          allAccounts = [...(accountsData.accounts || [])]
          console.log(`New API found ${allAccounts.length} accounts`)
        } else {
          const errorText = await accountsResponse.text()
          console.error(`New API failed for ${account.email}:`, {
            status: accountsResponse.status,
            error: errorText
          })
        }

        // Process managed locations directly
        if (managedAccountsResponse.ok) {
          const managedData = await managedAccountsResponse.json()
          const locations = managedData.locations || []
          console.log(`Found ${locations.length} managed locations for ${account.email}`)

          // Convert locations directly to our format
          for (const location of locations) {
            allLocations.push({
              google_account_id: account.id,
              google_account_email: account.email,
              account_name: location.name,
              location_name: location.locationName,
              place_id: location.metadata?.placeId,
              address: location.address,
              phone: location.phoneNumbers?.primaryPhone,
              website: location.websiteUrl,
              category: location.primaryCategory?.displayName,
              maps_url: location.metadata?.mapsUrl,
              verified: location.verificationState === 'VERIFIED',
              status: location.locationState?.isVerified ? 'VERIFIED' : 'UNVERIFIED'
            })
          }
        } else {
          const errorText = await managedAccountsResponse.text()
          console.error(`Managed locations API failed for ${account.email}:`, {
            status: managedAccountsResponse.status,
            error: errorText
          })
        }

        console.log(`Total accounts found for ${account.email}: ${allAccounts.length}`)

        // For each account, get the locations
        for (const gbpAccount of allAccounts) {
          console.log(`Fetching locations for account: ${gbpAccount.accountName || gbpAccount.name}`)
          const locationsResponse = await fetch(
            `https://mybusinessbusinessinformation.googleapis.com/v1/${gbpAccount.name}/locations`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            }
          )

          if (!locationsResponse.ok) {
            const errorText = await locationsResponse.text()
            console.error(`Failed to fetch locations for account ${gbpAccount.accountName || gbpAccount.name}:`, {
              status: locationsResponse.status,
              statusText: locationsResponse.statusText,
              error: errorText
            })
            continue
          }

          const locationsData = await locationsResponse.json()
          const locations = locationsData.locations || []

          console.log(`Found ${locations.length} locations for account ${gbpAccount.accountName || gbpAccount.name}`)

          // Add locations with account info
          for (const location of locations) {
            allLocations.push({
              google_account_email: account.email,
              google_account_id: account.id,
              account_name: gbpAccount.accountName,
              account_number: gbpAccount.accountNumber,
              location_name: location.title || location.name,
              store_code: location.storeCode,
              address: location.address,
              phone: location.phoneNumbers?.primary,
              category: location.categories?.primary,
              website: location.websiteUri,
              place_id: location.metadata?.placeId,
              maps_url: location.metadata?.mapsUri,
              status: location.openInfo?.status,
              verified: location.verificationState === 'VERIFIED'
            })
          }
        }
      } catch (error) {
        console.error(`Error fetching locations for ${account.email}:`, error)
      }
    }

    // Save locations to database for caching
    if (allLocations.length > 0) {
      const locationsToSave = allLocations.map(loc => ({
        user_id: user.id,
        google_account_id: loc.google_account_id,
        google_account_email: loc.google_account_email,
        account_name: loc.account_name,
        account_number: loc.account_number,
        location_name: loc.location_name,
        store_code: loc.store_code,
        place_id: loc.place_id,
        address: loc.address,
        formatted_address: loc.address ?
          `${loc.address.addressLines?.join(', ') || ''}${loc.address.locality ? `, ${loc.address.locality}` : ''}${loc.address.administrativeArea ? `, ${loc.address.administrativeArea}` : ''}${loc.address.postalCode ? ` ${loc.address.postalCode}` : ''}`.trim() : null,
        phone: loc.phone,
        website: loc.website,
        primary_category: loc.category,
        maps_url: loc.maps_url,
        status: loc.status,
        verified: loc.verified,
        last_synced: new Date().toISOString()
      }))

      const { error: saveError } = await supabase
        .from('gbp_locations')
        .upsert(
          locationsToSave,
          {
            onConflict: 'user_id,place_id',
            ignoreDuplicates: false
          }
        )

      if (saveError) {
        console.error('Error saving locations:', saveError)
      }
    }

    console.log('=== FETCH LOCATIONS SUMMARY ===')
    console.log(`Accounts checked: ${googleAccounts.length}`)
    console.log(`Total locations found: ${allLocations.length}`)
    console.log(`Locations saved: ${allLocations.length}`)

    return NextResponse.json({
      success: true,
      locations: allLocations,
      count: allLocations.length,
      accounts_checked: googleAccounts.length,
      debug: {
        accounts_with_tokens: googleAccounts.filter(acc => acc.google_tokens?.[0]?.access_token).length,
        locations_by_account: googleAccounts.map(acc => ({
          email: acc.email,
          has_token: !!acc.google_tokens?.[0]?.access_token,
          token_expires: acc.google_tokens?.[0]?.token_expires_at
        }))
      }
    })

  } catch (error: any) {
    console.error('Error in fetch-locations:', error)
    return NextResponse.json({
      error: 'Failed to fetch locations',
      message: error.message
    }, { status: 500 })
  }
}