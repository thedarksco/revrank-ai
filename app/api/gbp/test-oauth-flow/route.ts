import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({
        error: 'Not authenticated',
        message: 'You need to be logged in to test OAuth flow'
      })
    }

    // Build the exact OAuth URL that would be used
    const state = {
      clientId: null,
      userId: user.id,
      accountSelection: true,
      hostedDomain: null,
      debug: false
    }

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: 'https://revrank-ai.vercel.app/api/gbp/callback',
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/business.manage https://www.googleapis.com/auth/businesscommunications https://www.googleapis.com/auth/plus.business.manage',
      access_type: 'offline',
      prompt: 'select_account',
      state: JSON.stringify(state)
    })

    const oauthUrl = `${authUrl.toString()}?${params.toString()}`

    // Test if we can parse the state back
    const testState = JSON.parse(JSON.stringify(state))

    return NextResponse.json({
      success: true,
      current_user: {
        id: user.id,
        email: user.email
      },
      oauth_state: state,
      state_json: JSON.stringify(state),
      parsed_state: testState,
      user_id_in_state: testState.userId,
      oauth_url: oauthUrl,
      env_check: {
        GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
        SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL
      },
      message: 'Click the oauth_url to test the flow manually'
    })

  } catch (err: any) {
    return NextResponse.json({
      error: 'Unexpected error',
      message: err.message
    })
  }
}