// ── Email templates — "Title Card" ───────────────────────────────────────
// Inline CSS only (email clients strip <style> blocks).
// Voice: tabloid magazine cover. Short, declarative, teen-native.
//
// Paper-first register per apps/lobby/.impeccable.md: dark-mode email
// rendering is unreliable across clients (Outlook normalisation strips
// custom dark schemes; Gmail mobile auto-inverts; some webmails ignore
// color-scheme entirely). Paper ground + ink type renders predictably
// in light AND auto-darkened modes.

// ── Palette ──────────────────────────────────────────────────────────────
// Mirrors [data-theme="reality-tv-tabloid"] from packages/ui-kit/src/theme.css
// in paper-first form. Token *names* are kept for codebase continuity;
// rename pass is out of scope for the redesign.
const BG = '#f5f3f0';                          // paper ground
const CARD_BG = '#ffffff';                     // raised card on paper
const CARD_BORDER = 'rgba(10,10,10,0.10)';     // subtle ink rule
const RED = '#d72638';                         // tabloid red — single accent
const RED_DEEP = '#8a1a25';                    // shadow tone
const GOLD = '#d4a118';                        // premium signal — used sparingly
const TEXT = '#0a0a0a';                        // ink body
const DIM = '#555555';                         // supporting copy
const FAINT = '#8b8b8b';                       // footers
const RULE = 'rgba(10,10,10,0.16)';            // hairline divider

// Legacy alias for older call sites that still reference CTA / GOLD_DIM
const CTA = RED;
const GOLD_DIM = '#b8922e';

// ── Type stacks (email-safe) ─────────────────────────────────────────────
// Display: tabloid/title-card condensed weight. Big Shoulders Display is the
// project's web display face but most email clients strip remote fonts.
// Falls through Impact → Helvetica Neue Condensed → Arial Black → sans.
const DISPLAY = `'Big Shoulders Display', Impact, 'Helvetica Neue Condensed', 'Arial Black', Arial, sans-serif`;
// Body: Manrope is the web body face; same fallback story. Stack supports
// Apple Mail, Outlook 365, most webmail.
const BODY = `Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;

// ── Shared building blocks ───────────────────────────────────────────────

/** Full-page paper wrapper. `preheader` is the hidden inbox-preview line
 * shown next to the subject in Gmail / Apple Mail / Outlook. */
function wrap(inner: string, preheader: string, title: string = 'Pecking Order'): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:${BG};font-family:${BODY};color:${TEXT};">
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
 * with an ink hairline and a dated issue line. Magazine-cover voice without
 * the gold-glow aesthetic — paper-first register. */
function logo(lobbyUrl: string): string {
  const issueDate = new Date()
    .toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })
    .toUpperCase()
    .replace(/,/g, ' ·');
  return `<tr><td align="center" style="padding-bottom:40px;">
    <a href="${lobbyUrl}" target="_blank" style="text-decoration:none;display:inline-block;color:${TEXT};">
      <div style="font-family:${DISPLAY};font-size:60px;font-weight:900;line-height:0.85;letter-spacing:-0.03em;color:${TEXT};text-transform:uppercase;">
        Pecking<br>Order
      </div>
      <div style="width:80px;height:3px;background-color:${TEXT};margin:18px auto 10px;line-height:0;font-size:0;">&nbsp;</div>
      <div style="font-family:${BODY};font-size:9px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${DIM};">
        ${issueDate}
      </div>
    </a>
  </td></tr>`;
}

/** Card — white panel with subtle ink-rule border, sits on the paper ground */
function card(inner: string): string {
  return `<tr><td>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${CARD_BG};border-radius:14px;border:1px solid ${CARD_BORDER};">
      <tr><td style="padding:36px 32px;">
        ${inner}
      </td></tr>
    </table>
  </td></tr>`;
}

/** CTA button — red bg, paper text. Single saturated accent doing the action job. */
function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
    <tr><td align="center" style="border-radius:10px;background-color:${RED};">
      <a href="${href}" target="_blank" style="display:inline-block;padding:16px 44px;font-family:${BODY};font-size:13px;font-weight:bold;letter-spacing:2.5px;text-transform:uppercase;color:${BG};text-decoration:none;">
        ${label}
      </a>
    </td></tr>
  </table>`;
}

/** Persona card-deck hero image — fills the column; cover hook.
 * object-fit crops the source PNG to a tight band in Gmail/Apple Mail/etc.
 * Outlook ignores object-fit and falls back to natural aspect; no worse than v1. */
function hero(lobbyUrl: string): string {
  return `<tr><td align="center" style="padding-bottom:32px;">
    <img src="${lobbyUrl}/email-hero.png" alt="Pecking Order — a social deduction game played in a group chat" width="480" style="display:block;width:100%;max-width:480px;height:260px;object-fit:cover;object-position:center;border:0;" />
  </td></tr>`;
}

/** Quiet bottom-of-email message. No ornaments. */
function footer(text: string): string {
  return `<tr><td style="padding-top:36px;">
    <p style="margin:0;font-family:${BODY};font-size:12px;color:${FAINT};line-height:1.6;text-align:center;">${text}</p>
  </td></tr>`;
}

/** Tracked-caps eyebrow label — red, mirrors the web "Casting Call" kicker */
function eyebrow(text: string): string {
  return `<p style="margin:0 0 14px;font-family:${BODY};font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${RED};">${text}</p>`;
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

/** Stacked-verb statement. Each word becomes its own line in giant display
 * type with alternating ink/red. Mirrors the `/playtest` and /j/ web treatments.
 *
 * Default colors rotate TEXT → RED → TEXT → RED. Pass a `colors` array to
 * override per-line. Line-height is set to 1.0 for Outlook safety; we add an
 * explicit margin between lines so the stack still has air on tight renderers. */
function verbStack(words: string[], colors?: string[]): string {
  const palette = colors ?? [TEXT, RED, TEXT, RED];
  return `<div style="margin:0 0 32px;text-align:center;">${words
    .map((word, i) => {
      const color = palette[i % palette.length];
      const isLast = i === words.length - 1;
      return `<div style="font-family:${DISPLAY};font-size:52px;font-weight:900;line-height:1.0;letter-spacing:-0.02em;color:${color};text-transform:uppercase;${isLast ? '' : 'margin-bottom:6px;'}">${word}</div>`;
    })
    .join('')}</div>`;
}

/** Code block — tracked display glyphs over tiny label. Gold for the code
 * value preserves "premium identifier" weight without a second saturated hue. */
function codeBlock(label: string, code: string): string {
  return `<div style="text-align:left;">
    <p style="margin:0 0 6px;font-family:${BODY};font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${FAINT};">${label}</p>
    <p style="margin:0;font-family:${DISPLAY};font-size:32px;font-weight:900;letter-spacing:6px;color:${GOLD};line-height:1;">${code}</p>
  </div>`;
}

/** Hairline rule used sparingly when structural separation is genuinely needed */
function hairline(): string {
  return `<div style="height:1px;background-color:${RULE};margin:28px 0;"></div>`;
}

/** Numbered beat row for "what to expect" lists. Number in red — matches the
 * web rhythm-strip's red step numbers (01 / 02 / 03). */
function beat(num: string, title: string, body: string, isLast: boolean = false): string {
  return `<tr><td style="padding:14px 0;${isLast ? '' : `border-bottom:1px solid ${RULE};`}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="44" valign="top" style="font-family:${DISPLAY};font-size:22px;font-weight:900;color:${RED};letter-spacing:1px;line-height:1;padding-top:2px;">${num}</td>
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

// Suppress unused-variable warnings for legacy aliases preserved for compat
void CTA;
void GOLD_DIM;
void RED_DEEP;

// ── Public builders ──────────────────────────────────────────────────────

export function buildInviteEmail(opts: {
  senderName: string;
  inviteLink: string;
  inviteCode: string;
  assetsUrl: string;
  lobbyUrl: string;
}): { subject: string; html: string } {
  const sender = opts.senderName.trim() || 'Someone';
  const subject = `${sender} added you to Pecking Order`;
  const preheader = `${sender} invited you to play Pecking Order &mdash; a social deduction game played in a group chat.`;
  const html = wrap(
    `
    ${logo(opts.lobbyUrl)}
    ${hero(opts.lobbyUrl)}
    ${card(`
      ${eyebrow('Cast list')}
      ${hugeLine(`${sender} added you`)}
      ${bodyLine('Catfish your friends. A few minutes a day on your phone. Last catfish wins.')}
      ${verbStack(['Vote.', 'Ally.', 'Betray.', 'Survive.'])}
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
  const subject = 'Your Pecking Order sign-in link';
  const preheader = 'One-tap link, live for 5 minutes.';
  const html = wrap(
    `
    ${logo(opts.lobbyUrl)}
    ${card(`
      ${eyebrow('Sign in')}
      ${hugeLine('One tap back in')}
      ${bodyLine(`Link is live for <strong style="color:${RED};font-weight:700;">5 minutes</strong>.`)}
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
  const subject = 'You’re on the Pecking Order waitlist';
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
      ${bodyLine('Next playtest drops soon. The shape of it:')}

      ${verbStack(['Vote.', 'Ally.', 'Betray.', 'Survive.'])}

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
        ${beat('01', 'Pick a face', 'Play a persona with their own history, drama, and enemies.')}
        ${beat('02', 'Play from your phone', 'Real time, day by day. Things happen while you&rsquo;re at school.')}
        ${beat('03', 'Last catfish wins', 'Form alliances. Send gifts. Vote someone out. Don&rsquo;t get voted out.', true)}
      </table>

      ${bodyLine('We&rsquo;ll email when it&rsquo;s your turn. Until then &mdash; bring your people:')}

      ${opts.referralCode ? `
        <div style="margin-bottom:24px;">${codeBlock('Your code', opts.referralCode)}</div>
      ` : ''}

      ${buttonRow('Send to a friend', shareUrl)}
    `)}
    ${footer('A social deduction game. On your phone. In the group chat.')}
  `,
    preheader,
    subject,
  );
  return { subject, html };
}
