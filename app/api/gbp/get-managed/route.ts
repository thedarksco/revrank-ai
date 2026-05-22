import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' })
  }

  // Get token
  const { data: tokens } = await supabase
    .from('google_tokens')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)

  if (!tokens || tokens.length === 0) {
    return NextResponse.json({ error: 'No token found' })
  }

  const token = tokens[0].access_token

  // Get ALL locations this account has access to (managed OR owned)
  // Using the invitations endpoint to find managed accounts
  const invitationsRes = await fetch(
    'https://mybusinessaccountmanagement.googleapis.com/v1/accounts/-/invitations',
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  )

  // Get accounts this user can access
  const accountsRes = await fetch(
    'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  )

  const accountsData = await accountsRes.json()

  // For managed locations, we need to list ALL locations across ALL accounts
  // including those where we're just a manager, not owner
  const allLocations = []

  if (accountsData.accounts) {
    for (const account of accountsData.accounts) {
      // Check account admins to see our role
      const adminsRes = await fetch(
        `https://mybusinessaccountmanagement.googleapis.com/v1/${account.name}/admins`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      )

      const adminsData = await adminsRes.json()

      // Get locations for this account
      const locationsRes = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?pageSize=100`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      )

      if (locationsRes.ok) {
        const locationsData = await locationsRes.json()
        if (locationsData.locations) {
          for (const location of locationsData.locations) {
            allLocations.push({
              account_name: account.name,
              account_type: account.type,
              role: adminsData.admins?.find((a: any) => a.admin === user.email)?.role || 'MANAGER',
              location_name: location.title,
              address: location.storefrontAddress,
              phone: location.phoneNumbers?.primaryPhone,
              website: location.websiteUri,
              category: location.primaryCategory?.displayName,
              place_id: location.name?.split('/').pop()
            })

            // Save to database
            await supabase
              .from('gbp_locations')
              .upsert({
                user_id: user.id,
                google_account_id: tokens[0].google_account_id,
                google_account_email: user.email,
                account_name: account.name,
                location_name: location.title || location.name,
                place_id: location.name?.split('/').pop(),
                formatted_address: location.storefrontAddress?.addressLines?.join(', '),
                phone: location.phoneNumbers?.primaryPhone,
                website: location.websiteUri,
                primary_category: location.primaryCategory?.displayName,
                verified: true,
                last_synced: new Date().toISOString()
              }, {
                onConflict: 'user_id,place_id',
                ignoreDuplicates: false
              })
          }
        }
      }
    }
  }

  return NextResponse.json({
    total_locations: allLocations.length,
    locations: allLocations
  })
}