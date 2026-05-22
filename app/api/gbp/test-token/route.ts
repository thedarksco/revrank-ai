import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' })
  }

  // Get the token directly from the database
  const { data: tokens, error } = await supabase
    .from('google_tokens')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)

  if (!tokens || tokens.length === 0) {
    return NextResponse.json({
      error: 'No tokens found',
      query_error: error
    })
  }

  const token = tokens[0]

  // Test the token with a simple API call
  const testRes = await fetch(
    'https://www.googleapis.com/oauth2/v1/userinfo',
    {
      headers: {
        'Authorization': `Bearer ${token.access_token}`
      }
    }
  )

  const userInfo = await testRes.json()

  // Now try the GMB API
  const gmbRes = await fetch(
    'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
    {
      headers: {
        'Authorization': `Bearer ${token.access_token}`
      }
    }
  )

  const gmbData = await gmbRes.text()
  let gmbJson = null
  try {
    gmbJson = JSON.parse(gmbData)
  } catch {
    gmbJson = gmbData
  }

  return NextResponse.json({
    token_info: {
      id: token.id,
      google_account_id: token.google_account_id,
      has_access_token: !!token.access_token,
      has_refresh_token: !!token.refresh_token,
      expires_at: token.token_expires_at,
      scope: token.scope
    },
    userinfo_test: {
      status: testRes.status,
      ok: testRes.ok,
      data: userInfo
    },
    gmb_test: {
      status: gmbRes.status,
      ok: gmbRes.ok,
      data: gmbJson
    }
  })
}