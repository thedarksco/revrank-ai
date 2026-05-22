import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Check if tables exist and their structure
    const results = {
      timestamp: new Date().toISOString(),
      checks: {}
    }

    // Test google_accounts table
    try {
      const { data: accountsData, error: accountsError } = await supabase
        .from('google_accounts')
        .select('*')
        .limit(1)

      results.checks.google_accounts = {
        exists: !accountsError,
        error: accountsError?.message || null,
        sample_count: accountsData?.length || 0
      }
    } catch (e: any) {
      results.checks.google_accounts = {
        exists: false,
        error: e.message
      }
    }

    // Test google_tokens table
    try {
      const { data: tokensData, error: tokensError } = await supabase
        .from('google_tokens')
        .select('*')
        .limit(1)

      results.checks.google_tokens = {
        exists: !tokensError,
        error: tokensError?.message || null,
        sample_count: tokensData?.length || 0
      }
    } catch (e: any) {
      results.checks.google_tokens = {
        exists: false,
        error: e.message
      }
    }

    // Test profiles table
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email')
        .limit(1)

      results.checks.profiles = {
        exists: !profilesError,
        error: profilesError?.message || null,
        sample_count: profilesData?.length || 0
      }
    } catch (e: any) {
      results.checks.profiles = {
        exists: false,
        error: e.message
      }
    }

    // Check current user
    const { data: { user } } = await supabase.auth.getUser()
    results.checks.current_user = {
      authenticated: !!user,
      user_id: user?.id || null,
      email: user?.email || null
    }

    // If user exists, check if profile exists
    if (user) {
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        results.checks.user_profile = {
          exists: !profileError,
          error: profileError?.message || null,
          profile: profileData || null
        }
      } catch (e: any) {
        results.checks.user_profile = {
          exists: false,
          error: e.message
        }
      }
    }

    return NextResponse.json(results)

  } catch (error: any) {
    return NextResponse.json({
      error: 'Database check failed',
      message: error.message
    }, { status: 500 })
  }
}