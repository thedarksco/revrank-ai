import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get the current user
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get query parameters for filtering
    const searchParams = request.nextUrl.searchParams
    const googleAccountId = searchParams.get('googleAccountId')
    const search = searchParams.get('search')
    const tags = searchParams.get('tags')

    // Build query
    let query = supabase
      .from('gbp_locations')
      .select('*')
      .eq('user_id', user.id)
      .order('location_name', { ascending: true })

    // Apply filters
    if (googleAccountId && googleAccountId !== 'all') {
      query = query.eq('google_account_id', googleAccountId)
    }

    if (search) {
      query = query.or(`location_name.ilike.%${search}%,formatted_address.ilike.%${search}%,primary_category.ilike.%${search}%`)
    }

    if (tags) {
      const tagArray = tags.split(',')
      query = query.contains('tags', tagArray)
    }

    const { data: locations, error } = await query

    if (error) {
      console.error('Error fetching locations:', error)
      return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      locations: locations || [],
      count: locations?.length || 0
    })

  } catch (error: any) {
    console.error('Error in locations API:', error)
    return NextResponse.json({
      error: 'Failed to fetch locations',
      message: error.message
    }, { status: 500 })
  }
}