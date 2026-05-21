import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({
      authenticated: false,
      error: error?.message || 'No user found'
    })
  }

  // Check if tables exist and get data
  const [googleAccounts, googleTokens, clients] = await Promise.all([
    supabase.from('google_accounts').select('*').eq('user_id', user.id),
    supabase.from('google_tokens').select('*').eq('user_id', user.id),
    supabase.from('clients').select('id, name, google_account_id, gbp_connected').eq('user_id', user.id)
  ])

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      metadata: user.user_metadata
    },
    database: {
      tables: {
        google_accounts_error: googleAccounts.error?.message,
        google_tokens_error: googleTokens.error?.message
      },
      data: {
        google_accounts: googleAccounts.data || [],
        google_accounts_count: googleAccounts.data?.length || 0,
        google_tokens: googleTokens.data || [],
        google_tokens_count: googleTokens.data?.length || 0,
        clients_with_google: clients.data?.filter(c => c.google_account_id || c.gbp_connected) || []
      }
    },
    oauth_config: {
      google_client_id_configured: process.env.GOOGLE_CLIENT_ID ? 'Yes (ends with: ...' + process.env.GOOGLE_CLIENT_ID?.slice(-10) + ')' : 'No',
      redirect_uri: process.env.NODE_ENV === 'production'
        ? 'https://revrank-ai.vercel.app/api/gbp/callback'
        : 'http://localhost:3000/api/gbp/callback'
    }
  })
}