import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const {
      clientId,
      googleAccountId
    } = await request.json()

    if (!clientId || !googleAccountId) {
      return NextResponse.json({ error: 'Client ID and Google Account ID required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the Google account belongs to the user
    const { data: googleAccount } = await supabase
      .from('google_accounts')
      .select('id, email, name, is_manager')
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

    // Check if this Google account has tokens
    const { data: tokens } = await supabase
      .from('google_tokens')
      .select('access_token, refresh_token, token_expires_at')
      .eq('google_account_id', googleAccountId)
      .single()

    if (!tokens) {
      return NextResponse.json({ error: 'No tokens found for this Google account' }, { status: 404 })
    }

    // If this is a manager account, get available manager relationships
    let managerRelationships = []
    if (googleAccount.is_manager) {
      const { data: relationships } = await supabase
        .from('gbp_managers')
        .select('*')
        .eq('google_account_id', googleAccountId)
        .eq('is_active', true)

      managerRelationships = relationships || []
    }

    // Update client to use this Google account
    const { error: updateError } = await supabase
      .from('clients')
      .update({
        google_account_id: googleAccountId,
        updated_at: new Date().toISOString()
      })
      .eq('id', clientId)

    if (updateError) {
      console.error('Error updating client with selected account:', updateError)
      return NextResponse.json({ error: 'Failed to select account' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      googleAccount: {
        id: googleAccount.id,
        email: googleAccount.email,
        name: googleAccount.name,
        isManager: googleAccount.is_manager
      },
      managerRelationships,
      hasTokens: !!tokens.access_token
    })
  } catch (error) {
    console.error('Error in select-account API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get client with current Google account association
    const { data: client } = await supabase
      .from('clients')
      .select(`
        id,
        google_account_id,
        gbp_connected,
        google_accounts!inner (
          id,
          email,
          name,
          picture_url,
          is_manager
        )
      `)
      .eq('id', clientId)
      .eq('user_id', user.id)
      .single()

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Get all available Google accounts for the user
    const { data: availableAccounts } = await supabase
      .from('google_accounts')
      .select(`
        id,
        email,
        name,
        picture_url,
        is_manager,
        account_type,
        last_connected
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('last_connected', { ascending: false })

    return NextResponse.json({
      client: {
        id: client.id,
        currentGoogleAccount: client.google_accounts || null,
        gbpConnected: client.gbp_connected
      },
      availableAccounts: availableAccounts || []
    })
  } catch (error) {
    console.error('Error in select-account GET API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}