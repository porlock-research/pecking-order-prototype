import { NextRequest, NextResponse } from 'next/server';

// Routes the matcher fires on but that should NOT require a session.
// `/playtest` is the public recruitment / signup hub; `/playtest/share/:code`
// is the public referral landing; `/share/:code` is the vanity-domain
// shortcut that rewrites into `/playtest/share/:code`. All three need to be
// reachable by unauthenticated visitors landing from SMS / DM / social.
function isPublicPath(pathname: string): boolean {
  return pathname === '/playtest' ||
    pathname.startsWith('/playtest/share/') ||
    pathname.startsWith('/share/');
}

export function middleware(req: NextRequest) {
  // Vanity domain: playtest.peckingorder.ca → serve /playtest/* pages (rewrite, not redirect)
  const host = req.headers.get('host') || '';
  if (host.endsWith('playtest.peckingorder.ca')) {
    if (req.nextUrl.pathname === '/') {
      return NextResponse.rewrite(new URL('/playtest', req.url));
    }
    // /share/CODE → /playtest/share/CODE
    if (req.nextUrl.pathname.startsWith('/share/')) {
      return NextResponse.rewrite(new URL(`/playtest${req.nextUrl.pathname}`, req.url));
    }
  }

  // Apex domain: peckingorder.ca / www.peckingorder.ca → /casting at root.
  // Same vanity-rewrite pattern as playtest.peckingorder.ca above. URL stays
  // as `peckingorder.ca` (no path exposed) because rewrite is internal.
  // /casting deep-link still works as an alternate URL on both hosts.
  // Staging mirror: staging.peckingorder.ca behaves the same way.
  if (
    host === 'peckingorder.ca' ||
    host === 'www.peckingorder.ca' ||
    host === 'staging.peckingorder.ca'
  ) {
    if (req.nextUrl.pathname === '/') {
      return NextResponse.rewrite(new URL('/casting', req.url));
    }
  }

  // Public routes: skip the session gate. Avoids bouncing fresh visitors
  // from SMS / share links to /login when the destination is a public
  // recruitment surface.
  if (isPublicPath(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  // Check both cookie names so staging (po_session_stg) and production (po_session) both work.
  // Actual session validation happens in getSession() against the correct D1 database.
  const session = req.cookies.get('po_session') || req.cookies.get('po_session_stg');
  if (session) return NextResponse.next();

  const loginUrl = new URL('/login', req.url);
  loginUrl.searchParams.set('next', req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Matcher must include `/share/:path*` so the vanity-domain rewrite above
  // can fire on the playtest.peckingorder.ca subdomain even though the path
  // doesn't start with `/playtest`.
  matcher: ['/', '/join/:path*', '/game/:path*', '/admin/:path*', '/playtest', '/playtest/share/:path*', '/share/:path*'],
};
