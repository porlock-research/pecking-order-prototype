import { NextRequest, NextResponse } from 'next/server';
import { verifyMagicLink } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const next = req.nextUrl.searchParams.get('next') || '/';

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const result = await verifyMagicLink(token);

  if (result.success && result.sessionId) {
    const response = NextResponse.redirect(new URL(next, req.url));
    response.cookies.set('po_session', result.sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    });
    return response;
  }

  // Verification failed — redirect to login with error
  const errorUrl = new URL('/login', req.url);
  errorUrl.searchParams.set('error', result.error || 'Verification failed');
  return NextResponse.redirect(errorUrl);
}
