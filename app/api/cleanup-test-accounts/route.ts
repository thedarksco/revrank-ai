import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({
        error: 'Not authenticated'
      })
    }

    // Delete all test accounts (ones with 'test' in the email or google_account_id)
    const { data: deleted, error } = await supabase
      .from('google_accounts')
      .delete()
      .or('email.ilike.%test%,google_account_id.ilike.%test%')
      .eq('user_id', user.id)
      .select()

    if (error) {
      return NextResponse.json({
        error: 'Failed to delete test accounts',
        details: error
      })
    }

    return NextResponse.json({
      success: true,
      deleted_count: deleted?.length || 0,
      deleted_accounts: deleted || [],
      message: 'Test accounts deleted successfully'
    })

  } catch (err: any) {
    return NextResponse.json({
      error: 'Unexpected error',
      message: err.message
    })
  }
}