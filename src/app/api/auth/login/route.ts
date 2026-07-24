import { NextRequest, NextResponse } from 'next/server'
import { getGoogleAuthUrl } from '@/lib/pocketbase'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const callbackUrl = new URL('/api/auth/callback', req.nextUrl.origin).toString()
  try {
    const { authUrl, codeVerifier } = await getGoogleAuthUrl(callbackUrl)
    const res = NextResponse.redirect(authUrl)
    res.cookies.set('pb_verifier', codeVerifier, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 300,
      path: '/',
    })
    return res
  } catch (err) {
    console.error('Auth init error:', err)
    return NextResponse.redirect(new URL('/login?error=init', req.nextUrl.origin))
  }
}
