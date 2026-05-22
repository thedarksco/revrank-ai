import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get the current user
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Delete all Google tokens for this user
    const { error: tokenError } = await supabase
      .from('google_tokens')
      .delete()
      .eq('user_id', user.id)

    // Delete all Google accounts for this user
    const { error: accountError } = await supabase
      .from('google_accounts')
      .delete()
      .eq('user_id', user.id)

    // Delete any cached business locations
    const { error: locationsError } = await supabase
      .from('gbp_locations')
      .delete()
      .eq('user_id', user.id)

    if (tokenError) {
      console.error('Error deleting tokens:', tokenError)
    }

    if (accountError) {
      console.error('Error deleting accounts:', accountError)
    }

    if (locationsError) {
      console.error('Error deleting locations:', locationsError)
    }

    return NextResponse.json({
      success: true,
      message: 'All Google accounts and data disconnected successfully'
    })

  } catch (error: any) {
    console.error('Error in disconnect-all:', error)
    return NextResponse.json({
      error: 'Failed to disconnect accounts',
      message: error.message
    }, { status: 500 })
  }
}