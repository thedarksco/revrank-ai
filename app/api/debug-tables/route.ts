import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Check google_accounts table structure
    const { data: accountsData, error: accountsError } = await supabase
      .from('google_accounts')
      .select('*')
      .limit(1)

    // Check google_tokens table structure
    const { data: tokensData, error: tokensError } = await supabase
      .from('google_tokens')
      .select('*')
      .limit(1)

    // Try to describe table structure using raw SQL
    const { data: accountsStructure, error: accountsStructureError } = await supabase.rpc('exec_sql', {
      sql: "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'google_accounts' ORDER BY ordinal_position"
    })

    const { data: tokensStructure, error: tokensStructureError } = await supabase.rpc('exec_sql', {
      sql: "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'google_tokens' ORDER BY ordinal_position"
    })

    return NextResponse.json({
      google_accounts: {
        exists: !accountsError,
        error: accountsError?.message,
        sample_data: accountsData,
        structure: accountsStructure || 'Could not get structure'
      },
      google_tokens: {
        exists: !tokensError,
        error: tokensError?.message,
        sample_data: tokensData,
        structure: tokensStructure || 'Could not get structure'
      }
    })

  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to check tables',
      message: error.message
    }, { status: 500 })
  }
}