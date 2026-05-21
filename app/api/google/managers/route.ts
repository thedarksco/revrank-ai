import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const googleAccountId = searchParams.get('googleAccountId')

    if (!googleAccountId) {
      return NextResponse.json({ error: 'Google Account ID required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the Google account belongs to the user
    const { data: googleAccount } = await supabase
      .from('google_accounts')
      .select('id')
      .eq('id', googleAccountId)
      .eq('user_id', user.id)
      .single()

    if (!googleAccount) {
      return NextResponse.json({ error: 'Google account not found' }, { status: 404 })
    }

    // Get the access token for this account
    const { data: tokenData } = await supabase
      .from('google_tokens')
      .select('access_token, refresh_token, token_expires_at')
      .eq('google_account_id', googleAccountId)
      .single()

    if (!tokenData) {
      return NextResponse.json({ error: 'No tokens found for this account' }, { status: 404 })
    }

    // Check if token needs refresh
    const now = new Date()
    const expiresAt = new Date(tokenData.token_expires_at || 0)
    let accessToken = tokenData.access_token

    if (expiresAt <= now && tokenData.refresh_token) {
      // Refresh the token
      try {
        const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            refresh_token: tokenData.refresh_token,
            grant_type: 'refresh_token',
          }),
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
            .eq('google_account_id', googleAccountId)
        }
      } catch (refreshError) {
        console.error('Error refreshing token:', refreshError)
        return NextResponse.json({ error: 'Failed to refresh token' }, { status: 401 })
      }
    }

    // Fetch accounts from Google My Business Account Management API
    try {
      const response = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Google API error: ${response.status}`)
      }

      const accountsData = await response.json()
      const accounts = accountsData.accounts || []

      // Store manager relationships in database
      for (const account of accounts) {
        if (account.role === 'OWNER' || account.role === 'MANAGER') {
          // This account can manage locations, fetch them
          try {
            const locationsResponse = await fetch(
              `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`,
              {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
              }
            )

            if (locationsResponse.ok) {
              const locationsData = await locationsResponse.json()
              const locations = locationsData.locations || []

              for (const location of locations) {
                // Store or update manager relationship
                await supabase
                  .from('gbp_managers')
                  .upsert({
                    google_account_id: googleAccountId,
                    manager_account_name: account.accountName || account.name,
                    manager_account_id: account.name,
                    account_role: account.role,
                    location_account_name: location.title || location.name,
                    location_account_id: location.name,
                    location_place_id: location.metadata?.placeId,
                    is_active: true,
                    last_synced: new Date().toISOString()
                  }, {
                    onConflict: 'google_account_id, manager_account_id, location_account_id'
                  })
              }
            }
          } catch (locationsError) {
            console.warn(`Failed to fetch locations for account ${account.name}:`, locationsError)
          }
        }
      }

      // Return the accounts and stored manager relationships
      const { data: managerRelationships } = await supabase
        .from('gbp_managers')
        .select('*')
        .eq('google_account_id', googleAccountId)
        .eq('is_active', true)

      return NextResponse.json({
        accounts,
        managerRelationships: managerRelationships || []
      })
    } catch (apiError) {
      console.error('Error fetching accounts from Google API:', apiError)
      return NextResponse.json({ error: 'Failed to fetch Google Business accounts' }, { status: 500 })
    }
  } catch (error) {
    console.error('Error in Google managers API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      googleAccountId,
      managerAccountId,
      locationAccountId
    } = await request.json()

    if (!googleAccountId || !managerAccountId || !locationAccountId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the Google account belongs to the user
    const { data: googleAccount } = await supabase
      .from('google_accounts')
      .select('id')
      .eq('id', googleAccountId)
      .eq('user_id', user.id)
      .single()

    if (!googleAccount) {
      return NextResponse.json({ error: 'Google account not found' }, { status: 404 })
    }

    // Update manager relationship status
    const { data: manager, error } = await supabase
      .from('gbp_managers')
      .update({
        is_active: true,
        last_synced: new Date().toISOString()
      })
      .eq('google_account_id', googleAccountId)
      .eq('manager_account_id', managerAccountId)
      .eq('location_account_id', locationAccountId)
      .select()
      .single()

    if (error) {
      console.error('Error updating manager relationship:', error)
      return NextResponse.json({ error: 'Failed to update manager relationship' }, { status: 500 })
    }

    return NextResponse.json({ manager })
  } catch (error) {
    console.error('Error in Google managers POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}