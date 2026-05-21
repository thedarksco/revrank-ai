import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all Google accounts for the user
    const { data: accounts, error } = await supabase
      .from('google_accounts')
      .select(`
        id,
        google_account_id,
        email,
        name,
        picture_url,
        account_type,
        hosted_domain,
        is_manager,
        managed_accounts,
        is_active,
        last_connected,
        created_at
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('last_connected', { ascending: false })

    if (error) {
      console.error('Error fetching Google accounts:', error)
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
    }

    return NextResponse.json({ accounts: accounts || [] })
  } catch (error) {
    console.error('Error in Google accounts API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      googleAccountId,
      email,
      name,
      pictureUrl,
      accountType = 'standard',
      hostedDomain,
      isManager = false,
      managedAccounts = []
    } = await request.json()

    if (!googleAccountId || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if account already exists
    const { data: existingAccount } = await supabase
      .from('google_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('google_account_id', googleAccountId)
      .single()

    if (existingAccount) {
      // Update existing account
      const { data: account, error } = await supabase
        .from('google_accounts')
        .update({
          name,
          picture_url: pictureUrl,
          account_type: accountType,
          hosted_domain: hostedDomain,
          is_manager: isManager,
          managed_accounts: managedAccounts,
          is_active: true,
          last_connected: new Date().toISOString()
        })
        .eq('id', existingAccount.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating Google account:', error)
        return NextResponse.json({ error: 'Failed to update account' }, { status: 500 })
      }

      return NextResponse.json({ account })
    } else {
      // Create new account
      const { data: account, error } = await supabase
        .from('google_accounts')
        .insert({
          user_id: user.id,
          google_account_id: googleAccountId,
          email,
          name,
          picture_url: pictureUrl,
          account_type: accountType,
          hosted_domain: hostedDomain,
          is_manager: isManager,
          managed_accounts: managedAccounts
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating Google account:', error)
        return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
      }

      return NextResponse.json({ account })
    }
  } catch (error) {
    console.error('Error in Google accounts POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}