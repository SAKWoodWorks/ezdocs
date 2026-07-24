import { NextRequest, NextResponse } from 'next/server'
import { exchangeOAuth2Code } from '@/lib/pocketbase'

const ALLOWED_DOMAIN = '@sakww.com'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const origin = req.nextUrl.origin
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const codeVerifier = req.cookies.get('pb_verifier')?.value

  if (!code || !codeVerifier) {
    return NextResponse.redirect(new URL('/login?error=missing', origin))
  }

  const callbackUrl = new URL('/api/auth/callback', origin).toString()

  try {
    const { token, record } = await exchangeOAuth2Code(code, codeVerifier, callbackUrl)

    if (!record.email.endsWith(ALLOWED_DOMAIN)) {
      return NextResponse.redirect(new URL('/login?error=domain', origin))
    }

    const res = NextResponse.redirect(new URL('/', origin))
    res.cookies.set('pb_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })
    res.cookies.delete('pb_verifier')
    return res
  } catch (err) {
    console.error('Auth callback error:', err)
    return NextResponse.redirect(new URL('/login?error=auth', origin))
  }
}
