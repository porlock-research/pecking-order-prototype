import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  // Check both cookie names so staging (po_session_stg) and production (po_session) both work.
  // Actual session validation happens in getSession() against the correct D1 database.
  const session = req.cookies.get('po_session') || req.cookies.get('po_session_stg');
  if (session) return NextResponse.next();

  const loginUrl = new URL('/login', req.url);
  loginUrl.searchParams.set('next', req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/', '/join/:path*', '/game/:path*', '/admin/:path*'],
};
