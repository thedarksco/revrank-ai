import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' })
  }

  const { data: accounts } = await supabase
    .from('google_accounts')
    .select('*, google_tokens(*)')
    .eq('user_id', user.id)

  if (!accounts?.[0]) {
    return NextResponse.json({ error: 'No Google account' })
  }

  const token = accounts[0].google_tokens?.[0]?.access_token
  if (!token) {
    return NextResponse.json({ error: 'No token' })
  }

  // CORRECT API: First get the account that manages the locations
  const accountsRes = await fetch(
    'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  )

  if (!accountsRes.ok) {
    return NextResponse.json({
      error: 'Failed to get accounts',
      status: accountsRes.status,
      message: await accountsRes.text()
    })
  }

  const { accounts: gbpAccounts } = await accountsRes.json()

  if (!gbpAccounts?.[0]) {
    return NextResponse.json({ error: 'No GBP accounts found' })
  }

  // Use the FIRST account to get ALL locations it manages
  const accountName = gbpAccounts[0].name

  const locationsRes = await fetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?pageSize=100`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  )

  if (!locationsRes.ok) {
    return NextResponse.json({
      error: 'Failed to get locations',
      status: locationsRes.status,
      message: await locationsRes.text()
    })
  }

  const data = await locationsRes.json()

  // Save to database
  if (data.locations?.length > 0) {
    for (const loc of data.locations) {
      await supabase
        .from('gbp_locations')
        .upsert({
          user_id: user.id,
          google_account_id: accounts[0].id,
          google_account_email: accounts[0].email,
          account_name: accountName,
          location_name: loc.title || loc.locationName,
          place_id: loc.name?.split('/').pop(),
          formatted_address: loc.storefrontAddress?.addressLines?.join(', '),
          phone: loc.phoneNumbers?.primaryPhone,
          website: loc.websiteUri,
          primary_category: loc.primaryCategory?.displayName,
          verified: true,
          last_synced: new Date().toISOString()
        }, {
          onConflict: 'place_id',
          ignoreDuplicates: false
        })
    }
  }

  return NextResponse.json({
    account: accountName,
    locations_count: data.locations?.length || 0,
    locations: data.locations || []
  })
}