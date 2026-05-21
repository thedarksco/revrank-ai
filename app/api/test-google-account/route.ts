import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({
      error: 'User not authenticated',
      userError: userError?.message,
      step: 'auth_check'
    })
  }

  try {
    const { test_google_account_id, email, name } = await request.json()

    // Test 1: Check if google_accounts table exists
    const { error: tableCheckError } = await supabase
      .from('google_accounts')
      .select('id')
      .limit(1)

    if (tableCheckError) {
      return NextResponse.json({
        error: 'google_accounts table does not exist',
        tableError: tableCheckError.message,
        step: 'table_check',
        solution: 'Run the migration script in Supabase SQL Editor'
      })
    }

    // Test 2: Check if user has a profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({
        error: 'User profile not found',
        profileError: profileError?.message,
        step: 'profile_check',
        userId: user.id,
        solution: 'User profile might not be created properly'
      })
    }

    // Test 3: Try to create a google account
    const { data: googleAccount, error: accountError } = await supabase
      .from('google_accounts')
      .insert({
        user_id: user.id,
        google_account_id: test_google_account_id,
        email: email,
        name: name,
        account_type: 'standard',
        is_manager: false,
        is_active: true
      })
      .select()
      .single()

    if (accountError) {
      return NextResponse.json({
        error: 'Failed to create Google account',
        accountError: accountError.message,
        accountErrorCode: accountError.code,
        accountErrorDetails: accountError.details,
        step: 'account_creation',
        user: {
          id: user.id,
          email: user.email
        },
        profile: profile
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Google account created successfully',
      googleAccount: googleAccount,
      user: {
        id: user.id,
        email: user.email
      },
      profile: profile
    })

  } catch (error: any) {
    return NextResponse.json({
      error: 'Unexpected error',
      message: error.message,
      step: 'catch_block'
    })
  }
}