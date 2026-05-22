import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Hard-code your user ID for testing
    const userId = '7f5f1d3e-615b-4b12-8a4a-301c8f2cf90c'

    // Step 1: Check if profile exists
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    // Step 2: Try to insert a Google account directly
    const testGoogleAccount = {
      user_id: userId,
      google_account_id: 'direct_test_' + Date.now(),
      email: 'hello@revrank.ai',
      name: 'RevRank AI',
      picture_url: null,
      account_type: 'standard',
      is_active: true,
      last_connected: new Date().toISOString()
    }

    const { data: insertedAccount, error: insertError } = await supabase
      .from('google_accounts')
      .insert(testGoogleAccount)
      .select()
      .single()

    // Step 3: List all accounts
    const { data: allAccounts, error: listError } = await supabase
      .from('google_accounts')
      .select('*')
      .eq('user_id', userId)

    return NextResponse.json({
      profile: {
        exists: !!profile,
        data: profile,
        error: profileError
      },
      insert_test: {
        success: !!insertedAccount,
        data: insertedAccount,
        error: insertError ? {
          message: insertError.message,
          code: insertError.code,
          details: insertError.details,
          hint: insertError.hint
        } : null
      },
      all_accounts: allAccounts || [],
      test_data_used: testGoogleAccount
    })

  } catch (err: any) {
    return NextResponse.json({
      error: 'Unexpected error',
      message: err.message,
      stack: err.stack
    })
  }
}