// Shared HTML template for the GET-renders-only bot-safe confirm pages
// used by /invite/[token] and /login/verify. Both routes need identical
// shell (spinner, auto-submit script, 3s fallback button); only the
// title, body copy, form action, and hidden inputs vary.
//
// IMPORTANT: inline <script> + <style> here depends on a permissive CSP
// (or none). If Content-Security-Policy script-src is ever tightened on
// the lobby, these pages break silently — auto-submit stops, users see
// an inactive spinner until the 3s fallback button appears. Add nonces
// at that point.

export interface ConfirmPageParams {
  title: string;
  bodyCopy: string;
  formAction: string;
  continueLabel: string;
  hiddenFields?: Record<string, string>;
}

export function renderConfirmPage(params: ConfirmPageParams): Response {
  const { title, bodyCopy, formAction, continueLabel, hiddenFields } = params;
  const hiddenInputs = Object.entries(hiddenFields ?? {})
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${encodeURIComponent(name)}" value="${encodeURIComponent(value)}">`,
    )
    .join('');
  const html = [
    '<!doctype html><html lang="en"><head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    '<style>',
    'body{margin:0;font-family:system-ui,sans-serif;background:#0f0a1a;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}',
    '.card{max-width:360px;text-align:center}',
    '.spinner{width:24px;height:24px;margin:0 auto 16px;border:2px solid #f5c842;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite}',
    'button{margin-top:16px;padding:14px 24px;background:#f5c842;color:#0f0a1a;border:0;border-radius:12px;font-weight:700;cursor:pointer;font-size:15px}',
    '@keyframes spin{to{transform:rotate(360deg)}}',
    '</style></head><body>',
    '<div class="card">',
    '<div class="spinner" aria-hidden="true"></div>',
    `<p>${escapeHtml(bodyCopy)}</p>`,
    `<form method="post" action="${formAction}" id="f">`,
    hiddenInputs,
    `<noscript><button type="submit">${escapeHtml(continueLabel)}</button></noscript>`,
    `<button id="fallback" type="submit" style="display:none">${escapeHtml(continueLabel)}</button>`,
    '</form>',
    // Auto-submit after 150ms so the spinner renders first. If the POST
    // doesn't complete within 3s, reveal a manual-continue button so the
    // user isn't stranded on a flaky connection.
    '<script>setTimeout(function(){var f=document.getElementById("f");if(f)f.submit()},150);',
    'setTimeout(function(){var n=document.getElementById("fallback");if(n)n.style.display="block"},3000);</script>',
    '</div></body></html>',
  ].join('');
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
