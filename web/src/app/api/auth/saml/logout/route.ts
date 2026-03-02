import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const isSecure = req.url.startsWith('https');
  const cookieName = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token';

  const response = NextResponse.redirect(new URL('/auth/login', req.url));
  response.cookies.set(cookieName, '', {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}
