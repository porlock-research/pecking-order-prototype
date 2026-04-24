import { NextRequest, NextResponse } from 'next/server';
import { verifyMagicLink, setSessionCookie } from '@/lib/auth';

// Bot-safe render: GET renders a tiny auto-submitting confirm page (no token
// consumption). POST consumes the magic link + sets session cookie. Defends
// against email-security-scanner prefetch that was orphaning tokens.
// See docs/plans/2026-04-24-auth-flow-hardening.md Task 2.

function renderConfirmPage(token: string, next: string): Response {
  // token, next are url-safe primitives that we re-encode before embedding.
  const safeToken = encodeURIComponent(token);
  const safeNext = encodeURIComponent(next);
  const html = [
    '<!doctype html><html lang="en"><head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>Signing you in…</title>',
    '<style>',
    'body{margin:0;font-family:system-ui,sans-serif;background:#0f0a1a;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}',
    '.card{max-width:360px;text-align:center}',
    '.spinner{width:24px;height:24px;margin:0 auto 16px;border:2px solid #f5c842;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite}',
    'button{margin-top:16px;padding:14px 24px;background:#f5c842;color:#0f0a1a;border:0;border-radius:12px;font-weight:700;cursor:pointer;font-size:15px}',
    '@keyframes spin{to{transform:rotate(360deg)}}',
    '</style></head><body>',
    '<div class="card">',
    '<div class="spinner" aria-hidden="true"></div>',
    '<p>Signing you in…</p>',
    '<form method="post" action="/login/verify" id="f">',
    `<input type="hidden" name="token" value="${safeToken}">`,
    `<input type="hidden" name="next" value="${safeNext}">`,
    '<noscript><button type="submit">Continue to sign in</button></noscript>',
    '<button id="fallback" type="submit" style="display:none">Continue to sign in</button>',
    '</form>',
    '<script>setTimeout(function(){var f=document.getElementById("f");if(f)f.submit()},150);',
    'setTimeout(function(){var n=document.getElementById("fallback");if(n)n.style.display="block"},3000);</script>',
    '</div></body></html>',
  ].join('');
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const next = req.nextUrl.searchParams.get('next') || '/';

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Intentionally render the confirm page without hitting D1 — we want
  // scanner GETs to be cheap and side-effect-free. Any token validity
  // check is deferred to POST.
  return renderConfirmPage(token, next);
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const token = (formData.get('token') as string | null) ?? '';
  const next = (formData.get('next') as string | null) || '/';

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url), 303);
  }

  const result = await verifyMagicLink(token);

  if (result.success && result.sessionId) {
    const response = NextResponse.redirect(new URL(next, req.url), 303);
    await setSessionCookie(response, result.sessionId, req.nextUrl.hostname);
    return response;
  }

  const errorUrl = new URL('/login', req.url);
  errorUrl.searchParams.set('error', result.error || 'Verification failed');
  return NextResponse.redirect(errorUrl, 303);
}
