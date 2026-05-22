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
      const token = account.google_tokens?.[0]

      if (!token?.access_token) {
        console.log(`No valid token for account ${account.email}`)
        continue
      }

      try {
        // First, get the account list (organizations)
        const accountsResponse = await fetch(
          'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
          {
            headers: {
              'Authorization': `Bearer ${token.access_token}`,
              'Content-Type': 'application/json'
            }
          }
        )

        if (!accountsResponse.ok) {
          console.error('Failed to fetch accounts:', await accountsResponse.text())
          continue
        }

        const accountsData = await accountsResponse.json()
        const accounts = accountsData.accounts || []

        // For each account, get the locations
        for (const gbpAccount of accounts) {
          const locationsResponse = await fetch(
            `https://mybusinessbusinessinformation.googleapis.com/v1/${gbpAccount.name}/locations`,
            {
              headers: {
                'Authorization': `Bearer ${token.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          )

          if (!locationsResponse.ok) {
            console.error('Failed to fetch locations:', await locationsResponse.text())
            continue
          }

          const locationsData = await locationsResponse.json()
          const locations = locationsData.locations || []

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
            onConflict: 'place_id',
            ignoreDuplicates: false
          }
        )

      if (saveError) {
        console.error('Error saving locations:', saveError)
      }
    }

    return NextResponse.json({
      success: true,
      locations: allLocations,
      count: allLocations.length,
      accounts_checked: googleAccounts.length
    })

  } catch (error: any) {
    console.error('Error in fetch-locations:', error)
    return NextResponse.json({
      error: 'Failed to fetch locations',
      message: error.message
    }, { status: 500 })
  }
}