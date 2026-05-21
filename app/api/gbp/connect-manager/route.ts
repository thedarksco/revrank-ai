import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const {
      googleAccountId,
      managerAccountId,
      locationAccountId,
      clientId
    } = await request.json()

    if (!googleAccountId || !managerAccountId || !locationAccountId || !clientId) {
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
      .select('id, email')
      .eq('id', googleAccountId)
      .eq('user_id', user.id)
      .single()

    if (!googleAccount) {
      return NextResponse.json({ error: 'Google account not found' }, { status: 404 })
    }

    // Verify the client belongs to the user
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('user_id', user.id)
      .single()

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Get the GBP manager relationship
    const { data: managerRelationship } = await supabase
      .from('gbp_managers')
      .select('*')
      .eq('google_account_id', googleAccountId)
      .eq('manager_account_id', managerAccountId)
      .eq('location_account_id', locationAccountId)
      .single()

    if (!managerRelationship) {
      return NextResponse.json({ error: 'Manager relationship not found' }, { status: 404 })
    }

    // Update client to connect to this specific manager/location
    const { error: updateError } = await supabase
      .from('clients')
      .update({
        google_account_id: googleAccountId,
        gbp_manager_id: managerRelationship.id,
        gbp_account_id: managerAccountId,
        gbp_location_id: locationAccountId,
        gbp_place_id: managerRelationship.location_place_id,
        gbp_connected: true,
        gbp_connection_date: new Date().toISOString(),
        gbp_last_sync: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', clientId)

    if (updateError) {
      console.error('Error updating client with manager connection:', updateError)
      return NextResponse.json({ error: 'Failed to connect manager account' }, { status: 500 })
    }

    // Mark manager relationship as active
    await supabase
      .from('gbp_managers')
      .update({
        is_active: true,
        last_synced: new Date().toISOString()
      })
      .eq('id', managerRelationship.id)

    return NextResponse.json({
      success: true,
      connection: {
        googleAccount: googleAccount.email,
        managerAccount: managerRelationship.manager_account_name,
        locationAccount: managerRelationship.location_account_name,
        placeId: managerRelationship.location_place_id
      }
    })
  } catch (error) {
    console.error('Error in connect-manager API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}