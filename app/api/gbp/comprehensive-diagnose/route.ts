import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const results: any = {
    timestamp: new Date().toISOString(),
    step: 'starting',
    checks: {}
  }

  try {
    // 1. Check environment variables
    results.step = 'env_check'
    results.checks.environment = {
      google_client_id: !!process.env.GOOGLE_CLIENT_ID,
      google_client_secret: !!process.env.GOOGLE_CLIENT_SECRET,
      supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabase_anon_key: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      service_role_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    }

    // 2. Check Supabase connection
    results.step = 'supabase_connection'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    results.checks.supabase = {
      connected: true,
      user_authenticated: !!user,
      user_id: user?.id
    }

    // 3. Check database tables exist and structure
    results.step = 'table_structure'

    // Check google_accounts table
    const { data: googleAccounts, error: accountsError } = await supabase
      .from('google_accounts')
      .select('*')
      .limit(1)

    // Check google_tokens table
    const { data: googleTokens, error: tokensError } = await supabase
      .from('google_tokens')
      .select('*')
      .limit(1)

    // Check gbp_locations table
    const { data: gbpLocations, error: locationsError } = await supabase
      .from('gbp_locations')
      .select('*')
      .limit(1)

    results.checks.tables = {
      google_accounts: {
        exists: !accountsError,
        error: accountsError?.message,
        count: googleAccounts?.length || 0
      },
      google_tokens: {
        exists: !tokensError,
        error: tokensError?.message,
        count: googleTokens?.length || 0
      },
      gbp_locations: {
        exists: !locationsError,
        error: locationsError?.message,
        count: gbpLocations?.length || 0
      }
    }

    // 4. Test Google OAuth URL generation
    results.step = 'oauth_url_test'
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    const redirectUri = 'https://revrank-ai.vercel.app/api/gbp/callback'
    const scopes = [
      'https://www.googleapis.com/auth/business.manage',
      'https://www.googleapis.com/auth/businessprofileperformance',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email'
    ].join(' ')

    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      prompt: 'consent'
    })

    results.checks.oauth_config = {
      redirect_uri: redirectUri,
      scopes_configured: scopes.split(' '),
      client_id_starts_with: process.env.GOOGLE_CLIENT_ID?.substring(0, 10) + '...',
      test_url_generated: true
    }

    // 5. Check if we can create test entries (without saving)
    results.step = 'database_write_test'
    if (user) {
      try {
        // Test if we can insert (but rollback)
        const testAccountData = {
          user_id: user.id,
          google_account_id: 'test_' + Date.now(),
          email: 'test@example.com',
          name: 'Test Account',
          picture_url: null,
          account_type: 'standard' as const,
          is_active: true,
          last_connected: new Date().toISOString()
        }

        // Try insert without committing
        const { data: testAccount, error: testError } = await supabase
          .from('google_accounts')
          .insert(testAccountData)
          .select()
          .single()

        if (testAccount) {
          // Clean up test entry
          await supabase
            .from('google_accounts')
            .delete()
            .eq('id', testAccount.id)
        }

        results.checks.database_write = {
          can_insert: !testError,
          error: testError?.message
        }
      } catch (dbError: any) {
        results.checks.database_write = {
          can_insert: false,
          error: dbError.message
        }
      }
    }

    // 6. Check current database state
    results.step = 'current_data_state'
    const { data: allAccounts } = await supabase
      .from('google_accounts')
      .select(`
        id,
        google_account_id,
        email,
        name,
        is_active,
        last_connected,
        google_tokens (
          id,
          access_token,
          refresh_token,
          token_expires_at,
          scope
        )
      `)

    results.checks.current_data = {
      total_google_accounts: allAccounts?.length || 0,
      accounts_with_tokens: allAccounts?.filter(acc => acc.google_tokens && acc.google_tokens.length > 0).length || 0,
      active_accounts: allAccounts?.filter(acc => acc.is_active).length || 0
    }

    results.step = 'completed'
    results.status = 'success'
    results.diagnosis = analyzeDiagnosis(results)

  } catch (error: any) {
    results.status = 'error'
    results.error = error.message
    results.diagnosis = 'Failed during ' + results.step + ': ' + error.message
  }

  return NextResponse.json(results, { status: 200 })
}

function analyzeDiagnosis(results: any): string {
  const issues = []

  if (!results.checks.environment?.google_client_id) {
    issues.push('Google Client ID missing')
  }
  if (!results.checks.environment?.google_client_secret) {
    issues.push('Google Client Secret missing')
  }
  if (!results.checks.supabase?.connected) {
    issues.push('Supabase connection failed')
  }
  if (!results.checks.tables?.google_accounts?.exists) {
    issues.push('google_accounts table missing')
  }
  if (!results.checks.tables?.google_tokens?.exists) {
    issues.push('google_tokens table missing')
  }
  if (!results.checks.database_write?.can_insert) {
    issues.push('Cannot insert into database: ' + results.checks.database_write?.error)
  }
  if (results.checks.current_data?.total_google_accounts === 0) {
    issues.push('No Google accounts saved in database')
  }

  if (issues.length === 0) {
    return 'All systems operational. If OAuth is failing, check callback logs for token exchange errors.'
  }

  return 'Issues found: ' + issues.join(', ')
}