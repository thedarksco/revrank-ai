import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({
        error: 'Not authenticated',
        details: userError
      })
    }

    // Check if tables exist
    const { error: tableCheckError } = await supabase
      .from('google_accounts')
      .select('id')
      .limit(1)

    if (tableCheckError && tableCheckError.message?.includes('relation')) {
      return NextResponse.json({
        error: 'Tables not found',
        message: 'The google_accounts table does not exist. Please run the migration script.',
        migration_needed: true
      })
    }

    // Try to create a test Google account
    const testData = {
      user_id: user.id,
      google_account_id: 'manual_test_' + Date.now(),
      email: 'manual_test@example.com',
      name: 'Manual Test Account',
      picture_url: null,
      account_type: 'standard',
      is_active: true,
      last_connected: new Date().toISOString()
    }

    const { data: savedAccount, error: saveError } = await supabase
      .from('google_accounts')
      .insert(testData)
      .select()
      .single()

    if (saveError) {
      return NextResponse.json({
        error: 'Save failed',
        test_data: testData,
        save_error: {
          message: saveError.message,
          code: saveError.code,
          details: saveError.details,
          hint: saveError.hint
        },
        user_info: {
          id: user.id,
          email: user.email
        }
      })
    }

    // List all existing Google accounts for this user
    const { data: existingAccounts, error: listError } = await supabase
      .from('google_accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    return NextResponse.json({
      success: true,
      test_account_saved: savedAccount,
      all_accounts: existingAccounts || [],
      user_info: {
        id: user.id,
        email: user.email
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