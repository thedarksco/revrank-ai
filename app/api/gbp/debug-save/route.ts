import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// This endpoint simulates what the OAuth callback does but with hardcoded data
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Hardcode the data that should come from OAuth
    const userId = '7f5f1d3e-615b-4b12-8a4a-301c8f2cf90c'

    // Simulate Google user info
    const userInfo = {
      id: '117082080604321194812', // A real Google ID format
      email: 'hello@revrank.ai',
      name: 'RevRank AI',
      given_name: 'RevRank',
      family_name: 'AI',
      picture: 'https://lh3.googleusercontent.com/a/default-user',
      verified_email: true
    }

    // Check if profile exists
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()

    // Build account data exactly as callback does
    const accountData = {
      user_id: userId,
      google_account_id: String(userInfo.id),
      email: String(userInfo.email),
      name: String(userInfo.name),
      picture_url: userInfo.picture || null,
      account_type: 'standard',
      hosted_domain: null,
      is_active: true,
      last_connected: new Date().toISOString()
    }

    // Try to insert
    const { data: googleAccount, error: accountError } = await supabase
      .from('google_accounts')
      .insert(accountData)
      .select()
      .single()

    // If duplicate, try update
    let finalAccount = googleAccount
    let finalError = accountError

    if (accountError && accountError.code === '23505') {
      const { data: existingAccount, error: updateError } = await supabase
        .from('google_accounts')
        .update({
          email: accountData.email,
          name: accountData.name,
          picture_url: accountData.picture_url,
          is_active: true,
          last_connected: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('google_account_id', accountData.google_account_id)
        .select()
        .single()

      finalAccount = existingAccount
      finalError = updateError
    }

    return NextResponse.json({
      profile_exists: !!profile,
      account_data: accountData,
      insert_result: {
        success: !!finalAccount,
        data: finalAccount,
        error: finalError ? {
          message: finalError.message,
          code: finalError.code,
          details: finalError.details
        } : null
      },
      message: 'This simulates the exact save logic from OAuth callback'
    })

  } catch (err: any) {
    return NextResponse.json({
      error: 'Unexpected error',
      message: err.message
    })
  }
}