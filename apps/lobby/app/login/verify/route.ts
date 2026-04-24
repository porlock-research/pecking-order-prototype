import { NextRequest, NextResponse } from 'next/server';
import { verifyMagicLink, setSessionCookie } from '@/lib/auth';
import { log } from '@/lib/log';
import { renderConfirmPage } from '@/lib/render-confirm-page';

// Bot-safe render: GET renders a tiny auto-submitting confirm page (no token
// consumption). POST consumes the magic link + sets session cookie. Defends
// against email-security-scanner prefetch that was orphaning tokens.
// See docs/plans/2026-04-24-auth-flow-hardening.md Task 2.

const COMPONENT = 'magic-link-route';
const MISSING_TOKEN_PREFIX = '<missing>';

function magicLinkConfirmPage(token: string, next: string): Response {
  return renderConfirmPage({
    title: 'Signing you in…',
    bodyCopy: 'Signing you in…',
    formAction: '/login/verify',
    continueLabel: 'Continue to sign in',
    hiddenFields: { token, next },
  });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const next = req.nextUrl.searchParams.get('next') || '/';

  if (!token) {
    log('warn', COMPONENT, 'magic_link.no_token', {
      tokenPrefix: MISSING_TOKEN_PREFIX,
      method: 'GET',
    });
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Intentionally render the confirm page without hitting D1 — we want
  // scanner GETs to be cheap and side-effect-free. Any token validity
  // check is deferred to POST.
  log('info', COMPONENT, 'magic_link.confirm_page_rendered', {
    tokenPrefix: token.slice(0, 8),
  });
  return magicLinkConfirmPage(token, next);
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const token = (formData.get('token') as string | null) ?? '';
  const next = (formData.get('next') as string | null) || '/';
  const tokenPrefix = token ? token.slice(0, 8) : MISSING_TOKEN_PREFIX;

  if (!token) {
    log('warn', COMPONENT, 'magic_link.no_token', { tokenPrefix, method: 'POST' });
    return NextResponse.redirect(new URL('/login', req.url), 303);
  }

  const result = await verifyMagicLink(token);

  if (result.success && result.sessionId) {
    log('info', COMPONENT, 'magic_link.consumed', { tokenPrefix });
    const response = NextResponse.redirect(new URL(next, req.url), 303);
    await setSessionCookie(response, result.sessionId, req.nextUrl.hostname);
    return response;
  }

  // Map known error strings to event names for easier log queries.
  const errorName =
    result.error === 'Link already used'
      ? 'magic_link.already_used'
      : result.error === 'Link expired'
        ? 'magic_link.expired'
        : result.error === 'Invalid link'
          ? 'magic_link.invalid'
          : 'magic_link.failed';
  log('warn', COMPONENT, errorName, { tokenPrefix, error: result.error });

  const errorUrl = new URL('/login', req.url);
  errorUrl.searchParams.set('error', result.error || 'Verification failed');
  return NextResponse.redirect(errorUrl, 303);
}
