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

  const debug = {
    accounts_found: [],
    locations_found: [],
    errors: []
  }

  try {
    // Get ALL accounts including MANAGED accounts
    const accountsRes = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Goog-Api-Client': 'gl-js/ fire/9.6.7'
        }
      }
    )

    const accountsData = await accountsRes.json()
    debug.accounts_found = accountsData.accounts || []

    // CRITICAL: For agency accounts, we need to check for INVITATIONS
    // These are accounts we manage but don't own
    const invitationsRes = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/invitations',
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    )

    let invitations = []
    if (invitationsRes.ok) {
      const invData = await invitationsRes.json()
      invitations = invData.invitations || []
      debug.invitations = invitations
    }

    // Check each account INCLUDING parent/child relationships
    for (const account of debug.accounts_found) {
      // Get admins to see our role
      const adminsRes = await fetch(
        `https://mybusinessaccountmanagement.googleapis.com/v1/${account.name}/admins`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      )

      let ourRole = 'UNKNOWN'
      if (adminsRes.ok) {
        const adminsData = await adminsRes.json()
        const ourAdmin = adminsData.admins?.find((a: any) =>
          a.admin === user.email || a.admin === 'hello@revrank.ai'
        )
        ourRole = ourAdmin?.role || 'MANAGER'
        debug[`${account.name}_role`] = ourRole
      }

      // CRITICAL FIX: Use the readMask parameter to get ALL data
      const locationsRes = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?` +
        new URLSearchParams({
          pageSize: '100',
          readMask: 'name,title,storefrontAddress,phoneNumbers,websiteUri,primaryCategory,metadata'
        }),
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      )

      if (locationsRes.ok) {
        const locData = await locationsRes.json()
        if (locData.locations) {
          debug[`${account.name}_locations`] = locData.locations.length
          debug.locations_found.push(...locData.locations)
        }
      } else {
        debug[`${account.name}_error`] = await locationsRes.text()
      }

      // ALSO check for location groups (multi-location businesses)
      const groupsRes = await fetch(
        `https://mybusinessaccountmanagement.googleapis.com/v1/${account.name}/locations`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      )

      if (groupsRes.ok) {
        const groupData = await groupsRes.json()
        if (groupData.locations) {
          debug[`${account.name}_groups`] = groupData.locations
        }
      }
    }

    // Save found locations
    if (debug.locations_found.length > 0) {
      for (const loc of debug.locations_found) {
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
    }

    return NextResponse.json({
      success: true,
      total_locations: debug.locations_found.length,
      accounts_checked: debug.accounts_found.map(a => ({
        name: a.name,
        type: a.type,
        accountName: a.accountName,
        role: a.role
      })),
      debug: debug
    })

  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      debug: debug
    })
  }
}