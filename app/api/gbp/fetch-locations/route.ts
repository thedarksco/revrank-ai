import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
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

    for (const account of googleAccounts) {
      const tokenData = account.google_tokens?.[0]
      if (!tokenData?.access_token) continue

      const token = tokenData.access_token

      // CRITICAL FIX: For MANAGER accounts like hello@revrank.ai,
      // we need to use the locations:batchGet endpoint with SPECIFIC location names
      // The API won't return managed locations through the accounts endpoint

      // Step 1: Try to get locations this account has been granted access to
      // This is done through the My Business Account Management API
      const accessRes = await fetch(
        'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      )

      if (accessRes.ok) {
        const accessData = await accessRes.json()

        // These are accounts we can see, but we need to find the ACTUAL owner accounts
        // that have granted us access to their locations

        // Step 2: Use the locations search to find ALL accessible locations
        // This includes locations we manage but don't own
        const searchBody = {
          pageSize: 100,
          filter: {
            // Search for all locations accessible to this user
            // Don't filter by account - get ALL accessible locations
          }
        }

        // Try the batch get approach - this often returns managed locations
        const batchRes = await fetch(
          'https://mybusinessbusinessinformation.googleapis.com/v1/googleLocations:search',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              pageSize: 100,
              query: {
                // Empty query to get all accessible locations
              }
            })
          }
        )

        if (batchRes.ok) {
          const batchData = await batchRes.json()
          if (batchData.googleLocations) {
            for (const loc of batchData.googleLocations) {
              allLocations.push({
                google_account_email: account.email,
                google_account_id: account.id,
                location_name: loc.title || loc.name,
                address: loc.storefrontAddress,
                phone: loc.primaryPhone,
                category: loc.primaryCategoryId,
                website: loc.websiteUrl,
                place_id: loc.name,
                verified: true
              })
            }
          }
        }

        // Step 3: For each account in accessData, try to get locations
        // INCLUDING accounts where we're listed as a locationGroupUser
        if (accessData.accounts) {
          for (const acc of accessData.accounts) {
            // Check if this account has locationGroups that we manage
            const groupsRes = await fetch(
              `https://mybusinessaccountmanagement.googleapis.com/v1/${acc.name}/locations`,
              {
                headers: { 'Authorization': `Bearer ${token}` }
              }
            )

            if (groupsRes.ok) {
              const groupsData = await groupsRes.json()
              if (groupsData.locations) {
                for (const loc of groupsData.locations) {
                  allLocations.push({
                    google_account_email: account.email,
                    google_account_id: account.id,
                    account_name: acc.name,
                    location_name: loc.name,
                    verified: true
                  })
                }
              }
            }

            // Also try the Business Information API
            const infoRes = await fetch(
              `https://mybusinessbusinessinformation.googleapis.com/v1/${acc.name}/locations?pageSize=100`,
              {
                headers: { 'Authorization': `Bearer ${token}` }
              }
            )

            if (infoRes.ok) {
              const infoData = await infoRes.json()
              if (infoData.locations) {
                for (const loc of infoData.locations) {
                  allLocations.push({
                    google_account_email: account.email,
                    google_account_id: account.id,
                    account_name: acc.name,
                    location_name: loc.title || loc.name,
                    address: loc.storefrontAddress,
                    phone: loc.phoneNumbers?.primaryPhone,
                    category: loc.primaryCategory?.displayName,
                    website: loc.websiteUri,
                    place_id: loc.name?.split('/').pop(),
                    verified: loc.verificationState === 'VERIFIED'
                  })
                }
              }
            }
          }
        }
      }

      // Step 4: MOST IMPORTANT - Try the accounts/-/locations endpoint
      // This gets ALL locations across ALL accounts the user can access
      const allAccountsRes = await fetch(
        'https://mybusiness.googleapis.com/v4/accounts',
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      )

      if (allAccountsRes.ok) {
        const allAccountsData = await allAccountsRes.json()
        if (allAccountsData.accounts) {
          for (const acc of allAccountsData.accounts) {
            const v4LocRes = await fetch(
              `https://mybusiness.googleapis.com/v4/${acc.name}/locations`,
              {
                headers: { 'Authorization': `Bearer ${token}` }
              }
            )

            if (v4LocRes.ok) {
              const v4LocData = await v4LocRes.json()
              if (v4LocData.locations) {
                for (const loc of v4LocData.locations) {
                  if (!allLocations.find(l => l.place_id === loc.name)) {
                    allLocations.push({
                      google_account_email: account.email,
                      google_account_id: account.id,
                      account_name: acc.name,
                      location_name: loc.locationName,
                      address: loc.address,
                      phone: loc.primaryPhone,
                      category: loc.primaryCategory?.categoryId,
                      website: loc.websiteUrl,
                      place_id: loc.name,
                      verified: loc.locationState?.isVerified
                    })
                  }
                }
              }
            }
          }
        }
      }
    }

    // Remove duplicates based on place_id
    const uniqueLocations = allLocations.reduce((acc, loc) => {
      if (!acc.find(l => l.place_id === loc.place_id)) {
        acc.push(loc)
      }
      return acc
    }, [] as any[])

    // Save to database
    if (uniqueLocations.length > 0) {
      for (const loc of uniqueLocations) {
        await supabase
          .from('gbp_locations')
          .upsert({
            user_id: user.id,
            google_account_id: loc.google_account_id,
            google_account_email: loc.google_account_email,
            account_name: loc.account_name,
            location_name: loc.location_name,
            place_id: loc.place_id,
            formatted_address: typeof loc.address === 'object' ?
              `${loc.address.addressLines?.join(', ') || ''}${loc.address.locality ? `, ${loc.address.locality}` : ''}${loc.address.administrativeArea ? `, ${loc.address.administrativeArea}` : ''}`.trim() :
              loc.address,
            phone: loc.phone,
            website: loc.website,
            primary_category: loc.category,
            verified: loc.verified,
            last_synced: new Date().toISOString()
          }, {
            onConflict: 'user_id,place_id',
            ignoreDuplicates: false
          })
      }
    }

    return NextResponse.json({
      success: true,
      locations: uniqueLocations,
      count: uniqueLocations.length
    })

  } catch (error: any) {
    console.error('Error in fetch-locations:', error)
    return NextResponse.json({
      error: 'Failed to fetch locations',
      message: error.message
    }, { status: 500 })
  }
}