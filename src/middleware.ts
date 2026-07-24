import { NextRequest, NextResponse } from 'next/server'

const PROTECTED_PATTERNS = [
  /^\/$/,
  /^\/prepare\//,
  /^\/stamps/,
  /^\/api\/upload$/,
  /^\/api\/prepare\//,
  /^\/api\/stamps/,
]

function isProtected(pathname: string): boolean {
  return PROTECTED_PATTERNS.some(p => p.test(pathname))
}

async function validateToken(token: string, pbUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${pbUrl}/api/collections/users/auth-refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.ok
  } catch {
    return false
  }
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl

  if (!isProtected(pathname)) return NextResponse.next()

  const token = req.cookies.get('pb_token')?.value
  const pbUrl = process.env.POCKETBASE_URL ?? 'http://localhost:8090'

  if (!token || !(await validateToken(token, pbUrl))) {
    const loginUrl = new URL('/login', req.nextUrl.origin)
    const res = NextResponse.redirect(loginUrl)
    res.cookies.delete('pb_token')
    return res
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)',
  ],
}
