import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { clientId } = await request.json()

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify client belongs to user
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('user_id', user.id)
      .single()

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Get client's current Google account association
    const { data: clientData } = await supabase
      .from('clients')
      .select('google_account_id, gbp_manager_id')
      .eq('id', clientId)
      .single()

    // Don't delete tokens - just disconnect from client
    // Tokens are tied to Google accounts and may be used by other clients

    // Deactivate manager relationship if exists
    if (clientData?.gbp_manager_id) {
      await supabase
        .from('gbp_managers')
        .update({
          is_active: false,
          last_synced: new Date().toISOString()
        })
        .eq('id', clientData.gbp_manager_id)
    }

    // Update client GBP connection status
    await supabase
      .from('clients')
      .update({
        google_account_id: null,
        gbp_manager_id: null,
        gbp_connected: false,
        gbp_connection_date: null,
        gbp_account_id: null,
        gbp_location_id: null,
        gbp_place_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', clientId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error disconnecting GBP:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}