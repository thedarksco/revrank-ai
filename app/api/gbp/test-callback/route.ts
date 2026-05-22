import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Test 1: Environment Variables
    const envCheck = {
      SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
    }

    // Test 2: Supabase Connection
    let supabaseConnection = false
    let supabaseError = null
    let userInfo = null

    try {
      const supabase = await createClient()
      const { data: { user }, error } = await supabase.auth.getUser()
      supabaseConnection = !error
      supabaseError = error?.message
      userInfo = user ? { id: user.id, email: user.email } : null
    } catch (e: any) {
      supabaseError = e.message
    }

    // Test 3: Database Table Check
    let tableExists = false
    let tableError = null

    if (supabaseConnection && userInfo) {
      try {
        const supabase = await createClient()
        const { error } = await supabase
          .from('google_accounts')
          .select('id')
          .limit(1)

        tableExists = !error || !error.message?.includes('relation')
        tableError = error?.message
      } catch (e: any) {
        tableError = e.message
      }
    }

    // Test 4: Can we insert a test record?
    let canInsert = false
    let insertError = null

    if (tableExists && userInfo) {
      try {
        const supabase = await createClient()
        const testData = {
          user_id: userInfo.id,
          google_account_id: 'callback_test_' + Date.now(),
          email: 'callback_test@example.com',
          name: 'Callback Test',
          picture_url: null,
          account_type: 'standard',
          is_active: true,
          last_connected: new Date().toISOString()
        }

        const { error } = await supabase
          .from('google_accounts')
          .insert(testData)
          .select()
          .single()

        canInsert = !error
        insertError = error?.message
      } catch (e: any) {
        insertError = e.message
      }
    }

    return NextResponse.json({
      success: envCheck.SUPABASE_URL && supabaseConnection && tableExists,
      tests: {
        environment: envCheck,
        supabase: {
          connected: supabaseConnection,
          error: supabaseError,
          user: userInfo
        },
        database: {
          tableExists,
          error: tableError,
          canInsert,
          insertError
        }
      },
      timestamp: new Date().toISOString()
    })

  } catch (err: any) {
    return NextResponse.json({
      error: 'Unexpected error',
      message: err.message,
      stack: err.stack
    })
  }
}