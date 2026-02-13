import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_PREFIXES = ['/join/', '/game/'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!needsAuth) return NextResponse.next();

  const session = req.cookies.get('po_session');
  if (session) return NextResponse.next();

  const loginUrl = new URL('/login', req.url);
  loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/join/:path*', '/game/:path*'],
};
