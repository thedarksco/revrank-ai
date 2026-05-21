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

    // Delete Google tokens
    await supabase
      .from('google_tokens')
      .delete()
      .eq('client_id', clientId)

    // Update client GBP connection status
    await supabase
      .from('clients')
      .update({
        gbp_connected: false,
        gbp_connection_date: null,
        gbp_account_id: null,
        gbp_location_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', clientId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error disconnecting GBP:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}