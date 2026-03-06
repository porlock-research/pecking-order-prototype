import { NextRequest, NextResponse } from 'next/server';
import { verifyMagicLink, getSessionCookieName } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const next = req.nextUrl.searchParams.get('next') || '/';

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const result = await verifyMagicLink(token);

  if (result.success && result.sessionId) {
    const cookieName = await getSessionCookieName();
    const response = NextResponse.redirect(new URL(next, req.url));
    const host = req.nextUrl.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    response.cookies.set(cookieName, result.sessionId, {
      httpOnly: true,
      secure: !isLocal,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
      ...(isLocal ? {} : { domain: '.peckingorder.ca' }),
    });
    return response;
  }

  // Verification failed — redirect to login with error
  const errorUrl = new URL('/login', req.url);
  errorUrl.searchParams.set('error', result.error || 'Verification failed');
  return NextResponse.redirect(errorUrl);
}
