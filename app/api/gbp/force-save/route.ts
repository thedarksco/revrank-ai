import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' })
  }

  // Force create a test token entry
  const testId = crypto.randomUUID()
  const { data, error } = await supabase
    .from('google_tokens')
    .insert({
      id: testId,
      google_account_id: testId,
      user_id: user.id,
      access_token: 'test-token',
      refresh_token: 'test-refresh',
      token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      scope: ['business.manage'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()

  return NextResponse.json({
    user_id: user.id,
    insert_result: { success: !error, data, error },
    test: 'If this fails, the database schema is wrong'
  })
}