// ── Email templates — "The Dark Court" ───────────────────────────────────
// Inline CSS only (email clients strip <style> blocks).
// Design: sealed missives from a shadowy court — deep plum, warm gold,
// ornamental dividers, Georgia body text, game-world voice.

// ── Palette ──────────────────────────────────────────────────────────────
const BG = '#0e0014';          // near-black plum
const CARD_BG = '#1a0a28';     // dark amethyst
const CARD_BORDER = '#3a1a55'; // muted purple border
const GOLD = '#f0c040';        // warm rich gold
const GOLD_DIM = '#b8922e';    // subdued gold for rules/dividers
const CTA = '#d946ef';         // vivid fuchsia
const TEXT = '#ede0f5';        // lavender white
const DIM = '#a888c0';         // muted lilac
const FAINT = '#604878';       // barely-there purple

// ── Shared building blocks ───────────────────────────────────────────────

/** Full-page dark wrapper — centered 480px column */
function wrap(inner: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:${BG};font-family:Georgia,'Times New Roman',Times,serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG};">
    <tr><td align="center" style="padding:48px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">
        ${inner}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Logo image — served from R2 assets CDN */
function logo(assetsUrl: string, lobbyUrl: string): string {
  return `<tr><td align="center" style="padding-bottom:12px;">
    <a href="${lobbyUrl}" target="_blank" style="text-decoration:none;">
      <img src="${assetsUrl}/branding/email-logo.png" alt="PECKING ORDER" width="280" style="display:block;max-width:100%;height:auto;border:0;" />
    </a>
  </td></tr>
  <tr><td align="center" style="padding-bottom:36px;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="width:60px;border-bottom:1px solid ${GOLD_DIM};"></td>
      <td style="padding:0 14px;font-size:11px;color:${GOLD_DIM};letter-spacing:3px;">&#9670;</td>
      <td style="width:60px;border-bottom:1px solid ${GOLD_DIM};"></td>
    </tr></table>
  </td></tr>`;
}

/** Card — dark panel with gold-tinted border */
function card(inner: string): string {
  return `<tr><td>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${CARD_BG};border-radius:12px;border:1px solid ${CARD_BORDER};">
      <tr><td style="padding:36px 32px;">
        ${inner}
      </td></tr>
    </table>
  </td></tr>`;
}

/** Gold-bordered CTA button */
function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
    <tr><td align="center" style="border-radius:10px;background-color:${CTA};">
      <a href="${href}" target="_blank" style="display:inline-block;padding:16px 44px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:bold;letter-spacing:2.5px;text-transform:uppercase;color:#ffffff;text-decoration:none;">
        ${label}
      </a>
    </td></tr>
  </table>`;
}

/** Gold ornamental divider — horizontal rule with diamond */
function divider(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
    <tr>
      <td style="border-bottom:1px solid ${GOLD_DIM};"></td>
      <td style="padding:0 12px;font-size:9px;color:${GOLD_DIM};letter-spacing:3px;">&#9670;</td>
      <td style="border-bottom:1px solid ${GOLD_DIM};"></td>
    </tr>
  </table>`;
}

/** Persona card-deck hero image */
function hero(lobbyUrl: string): string {
  return `<tr><td align="center" style="padding-bottom:28px;">
    <img src="${lobbyUrl}/email-hero.png" alt="Pecking Order personas" width="320" style="display:block;max-width:80%;height:auto;border:0;" />
  </td></tr>`;
}

/** Atmospheric footer with ornament */
function footer(text: string): string {
  return `<tr><td align="center" style="padding-top:32px;">
    <span style="font-size:10px;color:${FAINT};letter-spacing:4px;">&#9670; &#9670; &#9670;</span>
    <br><br>
    <span style="font-family:Georgia,'Times New Roman',Times,serif;font-size:12px;font-style:italic;color:${FAINT};line-height:1.5;">${text}</span>
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
    ${hero(opts.lobbyUrl)}
    ${card(`
      <p style="margin:0 0 8px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:${DIM};text-align:center;">
        You have been summoned
      </p>
      <p style="margin:0 0 28px;font-size:18px;color:${TEXT};text-align:center;line-height:1.5;">
        <strong style="color:${GOLD};">${opts.senderName}</strong> has invited you to join a game of alliances, betrayal, and strategy.
      </p>
      ${button('Join the Game', opts.inviteLink)}
      ${divider()}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td align="center">
          <span style="font-family:'Courier New',Courier,monospace;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${FAINT};">Invite Code</span>
          <br>
          <span style="font-family:'Courier New',Courier,monospace;font-size:24px;font-weight:bold;letter-spacing:5px;color:${GOLD};">${opts.inviteCode}</span>
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
    ${hero(opts.lobbyUrl)}
    ${card(`
      <p style="margin:0 0 24px;font-size:16px;color:${TEXT};text-align:center;line-height:1.5;">
        Tap below to enter. This passage expires in <strong style="color:${GOLD};">5 minutes</strong>.
      </p>
      ${button('Sign In', opts.loginLink)}
    `)}
    ${footer('If you didn&rsquo;t request this, you can safely ignore it.')}
  `);
}

export function buildPlaytestConfirmationHtml(opts: {
  assetsUrl: string;
  lobbyUrl: string;
  playtestUrl: string;
  referralCode?: string;
}): string {
  const shareUrl = opts.referralCode
    ? `${opts.playtestUrl}/share/${opts.referralCode}`
    : opts.playtestUrl;

  return wrap(`
    ${logo(opts.assetsUrl, opts.lobbyUrl)}
    ${hero(opts.lobbyUrl)}
    ${card(`
      <p style="margin:0 0 4px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:${DIM};text-align:center;">
        Confirmed
      </p>
      <p style="margin:0 0 24px;font-size:28px;font-weight:bold;color:${GOLD};text-align:center;letter-spacing:1px;">
        You&rsquo;re In
      </p>

      ${divider()}

      <p style="margin:0 0 6px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${FAINT};text-align:center;">
        What to expect
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr><td style="padding:10px 0;border-bottom:1px solid ${CARD_BORDER};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td width="32" valign="top" style="font-size:14px;color:${GOLD};padding-top:1px;">&#9733;</td>
            <td style="font-size:14px;color:${TEXT};line-height:1.5;">
              <strong style="color:${TEXT};">Pick a persona</strong>
              <span style="color:${DIM};"> &mdash; choose a character with a unique identity and backstory</span>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:10px 0;border-bottom:1px solid ${CARD_BORDER};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td width="32" valign="top" style="font-size:14px;color:${GOLD};padding-top:1px;">&#9733;</td>
            <td style="font-size:14px;color:${TEXT};line-height:1.5;">
              <strong style="color:${TEXT};">Play on your phone</strong>
              <span style="color:${DIM};"> &mdash; games unfold over multiple days with scheduled events</span>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:10px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td width="32" valign="top" style="font-size:14px;color:${GOLD};padding-top:1px;">&#9733;</td>
            <td style="font-size:14px;color:${TEXT};line-height:1.5;">
              <strong style="color:${TEXT};">Form alliances, vote, survive</strong>
              <span style="color:${DIM};"> &mdash; outwit others to be the last one standing</span>
            </td>
          </tr></table>
        </td></tr>
      </table>

      <p style="margin:0 0 20px;font-size:14px;color:${DIM};text-align:center;line-height:1.5;">
        We&rsquo;ll email you when the next playtest is ready.<br>
        Until then &mdash; recruit your allies:
      </p>
      ${button('Share Your Link', shareUrl)}
      ${opts.referralCode ? `
      ${divider()}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td align="center">
          <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${FAINT};">Your Referral Code</span>
          <br>
          <span style="font-family:'Courier New',Courier,monospace;font-size:24px;font-weight:bold;letter-spacing:5px;color:${GOLD};">${opts.referralCode}</span>
        </td></tr>
      </table>` : ''}
    `)}
    ${footer('A social game of alliances, betrayal &amp; strategy')}
  `);
}
