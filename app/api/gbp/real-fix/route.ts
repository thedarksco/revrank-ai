import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' })
  }

  // Get the most recent token
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

  // The KEY is to use the locations:batchGet endpoint with readMask
  // This gets ALL locations the account has access to, not just owned ones
  try {
    // First, we need to get the account
    const accountsRes = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!accountsRes.ok) {
      return NextResponse.json({
        error: 'Failed to fetch accounts',
        status: accountsRes.status,
        statusText: accountsRes.statusText
      })
    }

    const accountsData = await accountsRes.json()

    // For a manager account, we need to use the account that actually owns the locations
    // The managed locations are under a different account that we have access to

    // Try to list ALL locations without specifying an account
    // This uses the legacy endpoint that shows managed locations
    const legacyRes = await fetch(
      'https://mybusiness.googleapis.com/v4/accounts',
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )

    let legacyData = null
    if (legacyRes.ok) {
      legacyData = await legacyRes.json()
    }

    // Also try the location groups endpoint which shows managed groups
    const groupsRes = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/locations:batchGetReviews',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          locationNames: []
        })
      }
    )

    let groupsData = null
    if (groupsRes.ok) {
      groupsData = await groupsRes.json()
    }

    // The REAL fix: Use the correct parent parameter
    // For managed locations, we need to use "locations/-" as the parent
    const managedRes = await fetch(
      'https://mybusinessbusinessinformation.googleapis.com/v1/locations/-/locations?pageSize=100',
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )

    let managedData = null
    let managedError = null
    if (managedRes.ok) {
      managedData = await managedRes.json()
    } else {
      managedError = await managedRes.text()
    }

    // Try another approach: search for locations
    const searchRes = await fetch(
      'https://mybusinessbusinessinformation.googleapis.com/v1/googleLocations:search',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          location: {
            name: 'Law Firm'
          },
          pageSize: 100
        })
      }
    )

    let searchData = null
    let searchError = null
    if (searchRes.ok) {
      searchData = await searchRes.json()
    } else {
      searchError = await searchRes.text()
    }

    return NextResponse.json({
      token_exists: true,
      accounts: accountsData,
      legacy_api: legacyData,
      groups_api: groupsData,
      managed_locations: managedData,
      managed_error: managedError,
      search_results: searchData,
      search_error: searchError,
      help: 'Check each API response to see which one returns the 19 locations'
    })

  } catch (error: any) {
    return NextResponse.json({
      error: 'Exception occurred',
      message: error.message,
      stack: error.stack
    })
  }
}