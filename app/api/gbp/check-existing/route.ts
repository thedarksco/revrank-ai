import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get all Google accounts in the database
    const { data: allAccounts, error: fetchError } = await supabase
      .from('google_accounts')
      .select('*')
      .order('created_at', { ascending: false })

    if (fetchError) {
      return NextResponse.json({
        error: 'Failed to fetch accounts',
        details: fetchError
      })
    }

    // Get the current user
    const { data: { user } } = await supabase.auth.getUser()

    return NextResponse.json({
      current_user: user ? { id: user.id, email: user.email } : null,
      total_accounts: allAccounts?.length || 0,
      accounts: allAccounts || [],
      message: 'This shows ALL Google accounts in the database'
    })

  } catch (err: any) {
    return NextResponse.json({
      error: 'Unexpected error',
      message: err.message
    })
  }
}