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
    .limit(1)

  if (!tokens || !tokens[0]) {
    return NextResponse.json({ error: 'No token' })
  }

  const token = tokens[0].access_token

  // Simple approach - just get accounts and their locations
  const accountsRes = await fetch(
    'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  )

  const accountsData = await accountsRes.json()
  const locations = []

  if (accountsData.accounts) {
    for (const account of accountsData.accounts) {
      const locRes = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress,phoneNumbers,websiteUri,primaryCategory`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      )

      if (locRes.ok) {
        const locData = await locRes.json()
        if (locData.locations) {
          locations.push(...locData.locations)
        }
      }
    }
  }

  // Save to database and return
  for (const loc of locations) {
    await supabase
      .from('gbp_locations')
      .upsert({
        user_id: user.id,
        google_account_id: tokens[0].id,
        google_account_email: user.email,
        location_name: loc.title || loc.name,
        place_id: loc.name?.split('/').pop(),
        formatted_address: loc.storefrontAddress?.addressLines?.join(', '),
        phone: loc.phoneNumbers?.primaryPhone,
        website: loc.websiteUri,
        primary_category: loc.primaryCategory?.displayName,
        verified: true,
        last_synced: new Date().toISOString()
      }, {
        onConflict: 'user_id,place_id',
        ignoreDuplicates: false
      })
  }

  return NextResponse.json({
    locations: locations,
    count: locations.length
  })
}