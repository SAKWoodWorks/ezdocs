import { NextRequest, NextResponse } from 'next/server'
import { getGoogleAuthUrl } from '@/lib/pocketbase'

function getOrigin(req: NextRequest): string {
  const base = process.env.BASE_URL
  if (base) return base.replace(/\/$/, '')
  const proto = req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '')
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? req.nextUrl.host
  return `${proto}://${host}`
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const origin = getOrigin(req)
  const callbackUrl = new URL('/api/auth/callback', origin).toString()
  try {
    const { authUrl, codeVerifier, state } = await getGoogleAuthUrl(callbackUrl)
    const res = NextResponse.redirect(authUrl)
    const cookieOpts = {
      httpOnly: true,
      sameSite: 'lax' as const,
      maxAge: 300,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    }
    res.cookies.set('pb_verifier', codeVerifier, cookieOpts)
    res.cookies.set('pb_state', state, cookieOpts)
    return res
  } catch (err) {
    console.error('Auth init error:', err)
    return NextResponse.redirect(new URL('/login?error=init', origin))
  }
}
