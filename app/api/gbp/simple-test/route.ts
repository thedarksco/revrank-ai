import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Get auth state from cookies directly
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({
        error: 'Not authenticated',
        userError: userError
      })
    }

    // Build the OAuth URL with the correct user ID
    const state = {
      userId: user.id,
      clientId: null,
      debug: true,
      accountSelection: true
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

    return NextResponse.json({
      message: 'OAuth URL generated',
      user: {
        id: user.id,
        email: user.email
      },
      oauth_url: `${authUrl.toString()}?${params.toString()}`,
      state: state,
      instruction: 'Copy the oauth_url and paste it in a new browser tab to test the OAuth flow'
    })

  } catch (err: any) {
    return NextResponse.json({
      error: 'Unexpected error',
      message: err.message
    })
  }
}