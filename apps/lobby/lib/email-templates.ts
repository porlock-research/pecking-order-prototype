// ── Email templates — "Title Card" ───────────────────────────────────────
// Inline CSS only (email clients strip <style> blocks).
// Voice: reality-TV title-card. Short, declarative, teen-native.
// Shell-agnostic: this is the Pecking Order umbrella brand, not a shell skin.

// ── Palette ──────────────────────────────────────────────────────────────
const BG = '#0e0014';          // near-black plum
const CARD_BG = '#1a0a28';     // dark amethyst
const CARD_BORDER = '#3a1a55'; // muted purple border
const GOLD = '#f0c040';        // warm rich gold
const GOLD_DIM = '#b8922e';    // subdued gold for rules/hairlines
const CTA = '#d946ef';         // vivid fuchsia
const TEXT = '#ede0f5';        // lavender white
const DIM = '#a888c0';         // muted lilac
const FAINT = '#604878';       // barely-there purple

// ── Type stacks (email-safe) ─────────────────────────────────────────────
// Display: tabloid/title-card condensed weight. Impact is the target; degrades
// through Helvetica Neue (macOS) → Arial Black (ubiquitous) → sans-serif.
const DISPLAY = `Impact, 'Helvetica Neue', 'Arial Black', Arial, sans-serif`;
// Body: modern system-sans stack. Supported by Apple Mail, Outlook 365,
// most webmail. Falls back cleanly on anything older.
const BODY = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;

// ── Shared building blocks ───────────────────────────────────────────────

/** Full-page dark wrapper. `preheader` is the hidden inbox-preview line
 * shown next to the subject in Gmail / Apple Mail / Outlook. */
function wrap(inner: string, preheader: string, title: string = 'Pecking Order'): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:${BG};font-family:${BODY};">
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${BG};opacity:0;">${preheader}&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;</div>
  <!-- Built for the drama. Shipped from the group chat. -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG};">
    <tr><td align="center" style="padding:40px 16px 56px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">
        ${inner}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Text-only masthead — stacked "PECKING / ORDER" wordmark in display font,
 * with a gold hairline and a dated issue line. Feels like a tabloid cover. */
function logo(lobbyUrl: string): string {
  const issueDate = new Date()
    .toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })
    .toUpperCase()
    .replace(/,/g, ' \u00b7');
  return `<tr><td align="center" style="padding-bottom:40px;">
    <a href="${lobbyUrl}" target="_blank" style="text-decoration:none;display:inline-block;color:${GOLD};">
      <div style="font-family:${DISPLAY};font-size:48px;font-weight:900;line-height:0.9;letter-spacing:-0.02em;color:${GOLD};text-transform:uppercase;">
        Pecking<br>Order
      </div>
      <div style="width:56px;height:2px;background-color:${GOLD};margin:14px auto 8px;line-height:0;font-size:0;">&nbsp;</div>
      <div style="font-family:${BODY};font-size:9px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${GOLD_DIM};">
        ${issueDate}
      </div>
    </a>
  </td></tr>`;
}

/** Card — dark panel with muted border */
function card(inner: string): string {
  return `<tr><td>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${CARD_BG};border-radius:14px;border:1px solid ${CARD_BORDER};">
      <tr><td style="padding:36px 32px;">
        ${inner}
      </td></tr>
    </table>
  </td></tr>`;
}

/** CTA button */
function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
    <tr><td align="center" style="border-radius:10px;background-color:${CTA};">
      <a href="${href}" target="_blank" style="display:inline-block;padding:16px 44px;font-family:${BODY};font-size:13px;font-weight:bold;letter-spacing:2.5px;text-transform:uppercase;color:#ffffff;text-decoration:none;">
        ${label}
      </a>
    </td></tr>
  </table>`;
}

/** Persona card-deck hero image */
function hero(lobbyUrl: string): string {
  return `<tr><td align="center" style="padding-bottom:28px;">
    <img src="${lobbyUrl}/email-hero.png" alt="Pecking Order — a 7-day social deduction game on your phone" width="320" style="display:block;max-width:80%;height:auto;border:0;" />
  </td></tr>`;
}

/** Quiet bottom-of-email message. No ornaments. */
function footer(text: string): string {
  return `<tr><td style="padding-top:36px;">
    <p style="margin:0;font-family:${BODY};font-size:12px;color:${FAINT};line-height:1.6;text-align:center;">${text}</p>
  </td></tr>`;
}

/** Tracked-caps eyebrow label */
function eyebrow(text: string): string {
  return `<p style="margin:0 0 14px;font-family:${BODY};font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${DIM};">${text}</p>`;
}

/** Tabloid headline — uppercase display, tight leading. Line-height 1.02 gives
 * long wrapped names (e.g. "Maximillianthegreat added you") safe breathing room. */
function hugeLine(text: string, color: string = TEXT): string {
  return `<p style="margin:0 0 20px;font-family:${DISPLAY};font-size:44px;font-weight:900;line-height:1.02;letter-spacing:-0.01em;color:${color};text-transform:uppercase;word-wrap:break-word;overflow-wrap:break-word;">${text}</p>`;
}

/** Body paragraph — left-aligned, readable */
function bodyLine(text: string): string {
  return `<p style="margin:0 0 28px;font-family:${BODY};font-size:16px;line-height:1.55;color:${TEXT};">${text}</p>`;
}

/** Code block — tracked display glyphs over tiny label */
function codeBlock(label: string, code: string): string {
  return `<div style="text-align:left;">
    <p style="margin:0 0 6px;font-family:${BODY};font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${FAINT};">${label}</p>
    <p style="margin:0;font-family:${DISPLAY};font-size:32px;font-weight:900;letter-spacing:6px;color:${GOLD};line-height:1;">${code}</p>
  </div>`;
}

/** Hairline rule used sparingly when structural separation is genuinely needed */
function hairline(): string {
  return `<div style="height:1px;background-color:${GOLD_DIM};opacity:0.4;margin:28px 0;"></div>`;
}

/** Numbered beat row for "what to expect" lists */
function beat(num: string, title: string, body: string, isLast: boolean = false): string {
  return `<tr><td style="padding:14px 0;${isLast ? '' : `border-bottom:1px solid ${CARD_BORDER};`}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="44" valign="top" style="font-family:${DISPLAY};font-size:22px;font-weight:900;color:${GOLD};letter-spacing:1px;line-height:1;padding-top:2px;">${num}</td>
        <td style="font-family:${BODY};font-size:15px;line-height:1.5;color:${TEXT};">
          <strong style="color:${TEXT};font-weight:700;">${title}</strong><br>
          <span style="color:${DIM};">${body}</span>
        </td>
      </tr>
    </table>
  </td></tr>`;
}

/** Button wrapped in a table row (use inside card bodies for spacing control) */
function buttonRow(label: string, href: string, marginBottom: number = 0): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto ${marginBottom}px;"><tr><td>${button(label, href)}</td></tr></table>`;
}

// ── Public builders ──────────────────────────────────────────────────────

export function buildInviteEmail(opts: {
  senderName: string;
  inviteLink: string;
  inviteCode: string;
  assetsUrl: string;
  lobbyUrl: string;
}): { subject: string; html: string } {
  const sender = opts.senderName.trim() || 'Someone';
  const subject = `${sender} wants you in`;
  const preheader = `${sender} just added you to their cast. 7 days, your phone, everyone against everyone.`;
  const html = wrap(
    `
    ${logo(opts.lobbyUrl)}
    ${hero(opts.lobbyUrl)}
    ${card(`
      ${eyebrow('Cast list')}
      ${hugeLine(`${sender} added you`)}
      ${bodyLine('7 days. Your phone. Alliances, votes, eliminations &mdash; all in one group chat.')}
      ${buttonRow('Take your spot', opts.inviteLink, 28)}
      ${hairline()}
      ${codeBlock('Invite code', opts.inviteCode)}
    `)}
    ${footer('Didn&rsquo;t expect this? You can safely ignore.')}
  `,
    preheader,
    subject,
  );
  return { subject, html };
}

export function buildLoginEmail(opts: {
  loginLink: string;
  assetsUrl: string;
  lobbyUrl: string;
}): { subject: string; html: string } {
  const subject = 'One tap back in';
  const preheader = 'One-tap link, live for 5 minutes.';
  const html = wrap(
    `
    ${logo(opts.lobbyUrl)}
    ${card(`
      ${eyebrow('Sign in')}
      ${hugeLine('One tap back in')}
      ${bodyLine(`Link is live for <strong style="color:${GOLD};font-weight:700;">5 minutes</strong>.`)}
      ${buttonRow('Sign in', opts.loginLink)}
    `)}
    ${footer('Not you? Ignore this &mdash; nothing happens.')}
  `,
    preheader,
    subject,
  );
  return { subject, html };
}

export function buildPlaytestConfirmationEmail(opts: {
  assetsUrl: string;
  lobbyUrl: string;
  playtestUrl: string;
  referralCode?: string;
}): { subject: string; html: string } {
  const subject = 'You\u2019re on the list';
  const shareUrl = opts.referralCode
    ? `${opts.playtestUrl}/share/${opts.referralCode}`
    : opts.playtestUrl;

  const preheader = 'You made the cast. Next round drops soon &mdash; bring your people.';
  const html = wrap(
    `
    ${logo(opts.lobbyUrl)}
    ${hero(opts.lobbyUrl)}
    ${card(`
      ${eyebrow('Confirmed')}
      ${hugeLine('You&rsquo;re in', GOLD)}
      ${bodyLine('Next playtest drops soon. Here&rsquo;s the shape of it:')}

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
        ${beat('01', 'Pick a face', 'Play a persona with their own history, drama, and enemies.')}
        ${beat('02', 'Play from your phone', '7 days, real time. Things happen while you&rsquo;re at school.')}
        ${beat('03', 'Last one standing wins', 'Form alliances. Send gifts. Vote someone out. Don&rsquo;t get voted out.', true)}
      </table>

      ${bodyLine('We&rsquo;ll email when it&rsquo;s your turn. Until then &mdash; bring your people:')}

      ${opts.referralCode ? `
        <div style="margin-bottom:24px;">${codeBlock('Your code', opts.referralCode)}</div>
      ` : ''}

      ${buttonRow('Send to a friend', shareUrl)}
    `)}
    ${footer('A social deduction game. On your phone. For 7 days.')}
  `,
    preheader,
    subject,
  );
  return { subject, html };
}
