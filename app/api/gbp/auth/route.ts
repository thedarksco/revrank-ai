import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Google OAuth scopes needed for GBP management
const GBP_SCOPES = [
  'https://www.googleapis.com/auth/business.manage',
  'https://www.googleapis.com/auth/businesscommunications',
  'https://www.googleapis.com/auth/plus.business.manage'
].join(' ')

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const clientId = searchParams.get('clientId')

  if (!clientId) {
    return NextResponse.json({ error: 'Client ID required' }, { status: 400 })
  }

  // Verify user is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/auth', request.url))
  }

  // Verify client belongs to user
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('user_id', user.id)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  // Build Google OAuth URL
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.append('client_id', process.env.GOOGLE_CLIENT_ID!)
  authUrl.searchParams.append('redirect_uri', `${process.env.NEXT_PUBLIC_APP_URL || 'https://revrank-ai.vercel.app'}/api/gbp/callback`)
  authUrl.searchParams.append('response_type', 'code')
  authUrl.searchParams.append('scope', GBP_SCOPES)
  authUrl.searchParams.append('access_type', 'offline')
  authUrl.searchParams.append('prompt', 'consent')
  authUrl.searchParams.append('state', JSON.stringify({ clientId, userId: user.id }))

  return NextResponse.redirect(authUrl.toString())
}