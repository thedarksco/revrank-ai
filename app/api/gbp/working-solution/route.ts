import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' })
  }

  const { data: tokens } = await supabase
    .from('google_tokens')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)

  if (!tokens || !tokens[0]) {
    return NextResponse.json({ error: 'No token' })
  }

  const token = tokens[0].access_token

  // The solution: For agency accounts that manage locations,
  // we need to fetch locations through the LOCATION GROUPS API
  // or use the accounts endpoint with proper expansion

  const allLocations = []

  try {
    // Step 1: Get all accounts (including ones we manage but don't own)
    const accountsRes = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    )

    const accountsData = await accountsRes.json()

    if (!accountsData.accounts) {
      return NextResponse.json({
        error: 'No accounts found',
        data: accountsData
      })
    }

    // Step 2: For EACH account, try to get locations
    // INCLUDING accounts where we're just a manager
    for (const account of accountsData.accounts) {
      // Try multiple endpoints for each account

      // Method 1: Direct locations endpoint
      const locRes1 = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?pageSize=100`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      )

      if (locRes1.ok) {
        const data = await locRes1.json()
        if (data.locations) {
          for (const loc of data.locations) {
            allLocations.push({
              source: 'direct',
              account: account.name,
              name: loc.title || loc.name,
              address: loc.storefrontAddress,
              phone: loc.phoneNumbers?.primaryPhone,
              place_id: loc.name?.split('/').pop()
            })
          }
        }
      }

      // Method 2: Try with different account format
      const accountNumber = account.name.split('/')[1]
      const locRes2 = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${accountNumber}/locations?pageSize=100`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      )

      if (locRes2.ok) {
        const data = await locRes2.json()
        if (data.locations) {
          for (const loc of data.locations) {
            // Check if not duplicate
            if (!allLocations.find(l => l.place_id === loc.name?.split('/').pop())) {
              allLocations.push({
                source: 'account-number',
                account: accountNumber,
                name: loc.title || loc.name,
                address: loc.storefrontAddress,
                phone: loc.phoneNumbers?.primaryPhone,
                place_id: loc.name?.split('/').pop()
              })
            }
          }
        }
      }
    }

    // Method 3: Try the legacy v4 API
    const legacyRes = await fetch(
      'https://mybusiness.googleapis.com/v4/accounts',
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    )

    if (legacyRes.ok) {
      const legacyData = await legacyRes.json()
      if (legacyData.accounts) {
        for (const account of legacyData.accounts) {
          const locRes = await fetch(
            `https://mybusiness.googleapis.com/v4/${account.name}/locations`,
            {
              headers: { 'Authorization': `Bearer ${token}` }
            }
          )

          if (locRes.ok) {
            const data = await locRes.json()
            if (data.locations) {
              for (const loc of data.locations) {
                if (!allLocations.find(l => l.place_id === loc.locationName)) {
                  allLocations.push({
                    source: 'legacy-v4',
                    account: account.name,
                    name: loc.locationName,
                    address: loc.address,
                    phone: loc.primaryPhone,
                    place_id: loc.locationName
                  })
                }
              }
            }
          }
        }
      }
    }

    // Save all found locations to database
    if (allLocations.length > 0) {
      for (const loc of allLocations) {
        await supabase
          .from('gbp_locations')
          .upsert({
            user_id: user.id,
            google_account_id: tokens[0].google_account_id || tokens[0].id,
            google_account_email: user.email,
            account_name: loc.account,
            location_name: loc.name,
            place_id: loc.place_id,
            formatted_address: typeof loc.address === 'object' ?
              loc.address.addressLines?.join(', ') : loc.address,
            phone: loc.phone,
            verified: true,
            last_synced: new Date().toISOString()
          }, {
            onConflict: 'user_id,place_id',
            ignoreDuplicates: false
          })
      }
    }

    return NextResponse.json({
      success: true,
      total: allLocations.length,
      locations: allLocations,
      accounts_checked: accountsData.accounts?.length || 0
    })

  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    })
  }
}