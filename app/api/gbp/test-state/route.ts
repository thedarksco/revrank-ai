import { NextRequest, NextResponse } from 'next/server'

// This endpoint tests state parsing exactly as the callback does it
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const state = searchParams.get('state')

  if (!state) {
    return NextResponse.json({
      error: 'No state parameter provided',
      message: 'Add ?state=... to the URL'
    })
  }

  let parsedState: any = {}
  let parseError = null

  try {
    parsedState = JSON.parse(state)
  } catch (e: any) {
    parseError = e.message
  }

  return NextResponse.json({
    raw_state: state,
    parsed: parsedState,
    has_userId: !!parsedState.userId,
    userId_value: parsedState.userId || 'NOT FOUND',
    parse_error: parseError,
    message: 'This shows exactly how the OAuth callback parses the state parameter'
  })
}