import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'User not authenticated' })
  }

  try {
    // Delete test accounts (any account with test in the email or google_account_id starting with test_)
    const { data: deletedAccounts, error: deleteError } = await supabase
      .from('google_accounts')
      .delete()
      .eq('user_id', user.id)
      .or('email.ilike.%test%,google_account_id.ilike.test_%')
      .select()

    if (deleteError) {
      return NextResponse.json({
        error: 'Failed to delete test accounts',
        details: deleteError.message
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Test accounts deleted successfully',
      deletedAccounts: deletedAccounts
    })

  } catch (error: any) {
    return NextResponse.json({
      error: 'Unexpected error',
      message: error.message
    })
  }
}