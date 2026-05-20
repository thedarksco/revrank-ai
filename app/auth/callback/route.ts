import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const error_description = searchParams.get('error_description')
  const error = searchParams.get('error')

  // Handle OAuth errors from provider
  if (error) {
    console.error('OAuth error:', error, error_description)
    return NextResponse.redirect(
      `${origin}/auth?error=${error}&error_description=${encodeURIComponent(error_description || '')}`
    )
  }

  if (code) {
    try {
      const supabase = await createClient()
      const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code)

      if (sessionError) {
        console.error('Session exchange error:', sessionError)
        return NextResponse.redirect(
          `${origin}/auth?error=session_error&message=${encodeURIComponent(sessionError.message)}`
        )
      }

      // Successfully authenticated
      return NextResponse.redirect(`${origin}${next}`)
    } catch (error) {
      console.error('Unexpected error during auth:', error)
      return NextResponse.redirect(
        `${origin}/auth?error=unexpected_error`
      )
    }
  }

  // No code provided
  return NextResponse.redirect(`${origin}/auth?error=no_code`)
}