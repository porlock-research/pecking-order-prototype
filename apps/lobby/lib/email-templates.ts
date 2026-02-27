// ── Brand-consistent email templates ─────────────────────────────────────
// Inline CSS only (email clients strip <style> blocks).
// Colors match packages/ui-kit/src/theme.css default theme.

const DEEP = '#2c003e';
const PANEL = '#4c1d95';
const GOLD = '#fbbf24';
const PINK = '#ec4899';
const DIM = '#d8b4fe';
const BASE = '#ffffff';

/** Shared outer wrapper — dark background, centered column, safe fonts */
function wrap(inner: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:${DEEP};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${DEEP};">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">
        ${inner}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Logo image header — served from R2 via assets CDN */
function logo(assetsUrl: string, lobbyUrl: string): string {
  return `<tr><td align="center" style="padding-bottom:32px;">
    <a href="${lobbyUrl}" target="_blank" style="text-decoration:none;">
      <img src="${assetsUrl}/branding/email-logo.png" alt="PECKING ORDER" width="320" style="display:block;max-width:100%;height:auto;border:0;" />
    </a>
  </td></tr>`;
}

/** Glass-style card container */
function card(inner: string): string {
  return `<tr><td>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${PANEL};border-radius:16px;border:1px solid rgba(255,255,255,0.1);">
      <tr><td style="padding:32px 28px;">
        ${inner}
      </td></tr>
    </table>
  </td></tr>`;
}

/** Pink CTA button */
function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
    <tr><td align="center" style="border-radius:12px;background-color:${PINK};">
      <a href="${href}" target="_blank" style="display:inline-block;padding:16px 40px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:${BASE};text-decoration:none;">
        ${label}
      </a>
    </td></tr>
  </table>`;
}

/** Dim footer text */
function footer(text: string): string {
  return `<tr><td align="center" style="padding-top:24px;">
    <span style="font-family:'Courier New',Courier,monospace;font-size:11px;color:${DIM};opacity:0.5;">${text}</span>
  </td></tr>`;
}

// ── Public builders ──────────────────────────────────────────────────────

export function buildInviteEmailHtml(opts: {
  senderName: string;
  inviteLink: string;
  inviteCode: string;
  assetsUrl: string;
  lobbyUrl: string;
}): string {
  return wrap(`
    ${logo(opts.assetsUrl, opts.lobbyUrl)}
    ${card(`
      <p style="margin:0 0 6px;font-size:15px;color:${DIM};text-align:center;">
        You've been summoned.
      </p>
      <p style="margin:0 0 28px;font-size:16px;color:${BASE};text-align:center;">
        <strong style="color:${GOLD};">${opts.senderName}</strong> invited you to play.
      </p>
      ${button('Join the Game', opts.inviteLink)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid rgba(255,255,255,0.08);">
        <tr><td style="padding-top:20px;" align="center">
          <span style="font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${DIM};opacity:0.6;">Invite Code</span>
          <br>
          <span style="font-family:'Courier New',Courier,monospace;font-size:22px;font-weight:bold;letter-spacing:4px;color:${GOLD};">${opts.inviteCode}</span>
        </td></tr>
      </table>
    `)}
    ${footer('Choose wisely. Trust no one.')}
  `);
}

export function buildLoginEmailHtml(opts: {
  loginLink: string;
  assetsUrl: string;
  lobbyUrl: string;
}): string {
  return wrap(`
    ${logo(opts.assetsUrl, opts.lobbyUrl)}
    ${card(`
      <p style="margin:0 0 24px;font-size:15px;color:${DIM};text-align:center;">
        Tap below to sign in. This link expires in 5 minutes.
      </p>
      ${button('Sign In', opts.loginLink)}
    `)}
    ${footer('If you didn\'t request this, you can ignore it.')}
  `);
}
