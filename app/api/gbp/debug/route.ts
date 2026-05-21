import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const host = request.headers.get('host')
  const protocol = request.headers.get('x-forwarded-proto') || 'http'
  const fullUrl = request.url

  // Build the redirect URI that would be used
  const redirectUri = process.env.NODE_ENV === 'production'
    ? 'https://revrank-ai.vercel.app/api/gbp/callback'
    : 'http://localhost:3000/api/gbp/callback'

  // Also check what the actual request URL would generate
  const actualRedirectUri = `${protocol}://${host}/api/gbp/callback`

  return NextResponse.json({
    environment: process.env.NODE_ENV,
    configured_redirect_uri: redirectUri,
    actual_request_info: {
      host,
      protocol,
      full_url: fullUrl,
      would_generate: actualRedirectUri
    },
    google_client_id: process.env.GOOGLE_CLIENT_ID ?
      `...${process.env.GOOGLE_CLIENT_ID.slice(-20)}` : 'NOT SET',
    instructions: [
      'Make sure your Google Cloud Console has these EXACT redirect URIs:',
      '1. https://revrank-ai.vercel.app/api/gbp/callback',
      '2. http://localhost:3000/api/gbp/callback',
      '',
      'Go to: https://console.cloud.google.com/apis/credentials',
      'Click on your OAuth 2.0 Client ID',
      'Add to "Authorized redirect URIs" section'
    ]
  })
}