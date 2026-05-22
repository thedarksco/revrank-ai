import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({
        authenticated: false,
        error: 'No user found',
        userError
      })
    }

    // Check if the user profile exists
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    // Check if google_accounts table exists and has data
    const { data: accounts, error: accountsError } = await supabase
      .from('google_accounts')
      .select('*')
      .eq('user_id', user.id)

    // Try to manually insert a test account with this user's ID
    const testAccountData = {
      user_id: user.id,
      google_account_id: 'auth_test_' + Date.now(),
      email: 'auth_test@example.com',
      name: 'Auth Test Account',
      picture_url: null,
      account_type: 'standard',
      is_active: true,
      last_connected: new Date().toISOString()
    }

    const { data: testInsert, error: insertError } = await supabase
      .from('google_accounts')
      .insert(testAccountData)
      .select()
      .single()

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      },
      profile: profile || null,
      profileError: profileError ? {
        message: profileError.message,
        code: profileError.code
      } : null,
      existing_accounts: accounts || [],
      accountsError: accountsError ? {
        message: accountsError.message,
        code: accountsError.code
      } : null,
      test_insert: {
        success: !insertError,
        data: testInsert,
        error: insertError ? {
          message: insertError.message,
          code: insertError.code,
          details: insertError.details
        } : null
      }
    })

  } catch (err: any) {
    return NextResponse.json({
      error: 'Unexpected error',
      message: err.message,
      stack: err.stack
    })
  }
}