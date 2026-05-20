import { NextResponse } from 'next/server'

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const callbackUrl = `${supabaseUrl}/auth/v1/callback`

  return NextResponse.json({
    message: 'OAuth Debug Info',
    supabase_project_url: supabaseUrl,
    expected_callback_url: callbackUrl,
    google_client_id_configured: process.env.GOOGLE_CLIENT_ID ? 'Yes (ends with: ...' + process.env.GOOGLE_CLIENT_ID?.slice(-10) + ')' : 'No',
    instructions: [
      '1. The callback URL in Google Cloud Console must be EXACTLY:',
      callbackUrl,
      '2. In Supabase, the Google Client ID must be:',
      process.env.GOOGLE_CLIENT_ID || 'Not configured',
      '3. In Supabase, the Google Client Secret must match what is in Google Cloud Console',
      '4. Clear your browser cache and cookies, then try again'
    ]
  })
}