import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const res = NextResponse.redirect(new URL('/login', req.nextUrl.origin))
  res.cookies.delete('pb_token')
  return res
}
