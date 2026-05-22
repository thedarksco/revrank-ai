import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' })
  }

  // Get the connected Google account
  const { data: accounts } = await supabase
    .from('google_accounts')
    .select('*, google_tokens(*)')
    .eq('user_id', user.id)

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ error: 'No Google accounts connected' })
  }

  const account = accounts[0]
  const token = account.google_tokens?.[0]

  if (!token) {
    return NextResponse.json({ error: 'No token found' })
  }

  // Test the Google My Business API
  const response = await fetch(
    'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
    {
      headers: {
        'Authorization': `Bearer ${token.access_token}`
      }
    }
  )

  const data = await response.text()

  return NextResponse.json({
    account_email: account.email,
    api_status: response.status,
    api_response: response.ok ? JSON.parse(data) : data
  })
}