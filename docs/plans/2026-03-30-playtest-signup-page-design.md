# Playtest Signup Page — Design Spec

**Date**: 2026-03-30
**Status**: Draft
**Route**: `/playtest` in `apps/lobby`
**Vanity URL**: `playtest.peckingorder.ca` (CNAME → lobby worker)

## Goal

A lightweight, mobile-first, socially shareable signup page that lets future playtesters register their interest. Minimal copy, persona imagery for flavour, zero unnecessary JS.

## Architecture

### Approach: Static RSC + Tiny Client Form

- `/app/playtest/page.tsx` — React Server Component (zero client JS)
- `/app/playtest/signup-form.tsx` — `"use client"` form component (~2-3KB), handles submission state only
- `/app/playtest/actions.ts` — Server Action: validates input, writes to D1, sends confirmation email via Resend, upserts contact to Resend Audience
- `/app/playtest/layout.tsx` — Custom layout with OG/Twitter/Discord metadata, imports only `theme.css`

No shadcn, no framer-motion, no heavy dependencies. The page is essentially server-rendered HTML with a tiny interactive form.

### Middleware

The existing lobby middleware matcher (`/`, `/join/*`, `/game/*`, `/admin/*`) already excludes `/playtest` — no auth required, no changes needed.

## Page Layout (Mobile-First)

### 1. Hero Section
- **Persona images**: 3-5 randomly selected from D1 `PersonaPool` on each server render, served via `/api/persona-image/[id]/headshot.png`
- **Title**: "PECKING ORDER" in Poppins 900, gold (`#fbbf24`)
- **Tagline**: "A social game of alliances, betrayal & strategy" in dim purple (`#d8b4fe`)
- **Pill badge**: "Playtesting Now" — gold on gold-tinted glass

### 2. Signup Form (immediately below hero, above the fold)
- **Heading**: "Join the Next Playtest"
- **Subheading**: "Be the first to know when we're ready for you."
- **Fields**:
  - Email (required) — standard email input, `skin-*` styling
  - "How did you hear about us?" (required) — `<select>` dropdown with options:
    - Friend / word of mouth
    - Reddit
    - Twitter / X
    - Discord
    - Instagram
    - TikTok
    - YouTube
    - Blog / article
    - Other → reveals a free-text input (max 200 chars)
- **Submit button**: "Sign Me Up" — gold gradient, `btn-press` 3D effect
- **Cloudflare Turnstile** widget (invisible mode) below the button

### 3. Teaser Strip (below form)
- Four icons with labels: Vote, Ally, Betray, Survive
- One-liner: "Play from your phone. Games run over multiple days."
- No specific mechanic descriptions — hints only

### 4. Share Buttons (always visible, bottom of page)
- Prompt: "Know someone who'd play?"
- Three buttons:
  - **Twitter/X**: Opens `intent/tweet` URL with pre-filled text + `playtest.peckingorder.ca` link
  - **Discord**: Copies a Discord-friendly message to clipboard (Discord has no share intent)
  - **Copy Link**: Copies `playtest.peckingorder.ca` to clipboard with toast confirmation

### 5. Footer
- `peckingorder.ca` text link

## Success State

After successful submission, the form section is replaced inline (no page reload):

- Green checkmark icon
- "You're In!" heading
- "Check your inbox for a confirmation."
- "We'll reach out when the next playtest is ready."
- **Emphasized share section**: Gold headline "Help us find more players!", "The more players, the better the game." + same three share buttons (larger, more prominent)
- Teaser strip and bottom share buttons remain

## Data Model

### New D1 Table: `PlaytestSignups`

```sql
CREATE TABLE PlaytestSignups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  referral_source TEXT NOT NULL,       -- enum value or 'OTHER'
  referral_detail TEXT,                -- free text when source is 'OTHER' (max 200)
  signed_up_at TEXT NOT NULL DEFAULT (datetime('now')),
  ip_address TEXT,                     -- for rate limiting, not displayed
  turnstile_token TEXT                 -- Cloudflare challenge token (for audit)
);
```

No FK to `Users` table — signups are independent of game accounts.

### Resend Audience

- Create a Resend Audience: "Playtest Signups"
- Each signup upserts a contact with metadata:
  - `referral_source`: the selected option
  - `signed_up_at`: ISO timestamp
- Future fields (e.g., `availability`, `player_type`) become additional metadata for segmentation
- Audience ID stored as environment variable: `RESEND_PLAYTEST_AUDIENCE_ID`

## Confirmation Email

Sent via Resend on successful signup. Simple, on-brand:

- **From**: `playtest@peckingorder.ca` (or existing sender domain)
- **Subject**: "You're on the list!"
- **Body**: Brief welcome, what to expect ("We'll email you when the next playtest is scheduled"), share link, unsubscribe link (handled by Resend)

HTML email template in `apps/lobby/lib/email-templates.ts` alongside existing templates.

## Security

### Cloudflare Turnstile
- Invisible mode — no user interaction required
- Site key in env var: `TURNSTILE_SITE_KEY`
- Secret key in env var: `TURNSTILE_SECRET_KEY`
- Server Action validates token before processing signup

### Rate Limiting
- Server-side check: max 5 signups per IP per hour
- Query `PlaytestSignups` by `ip_address` + `signed_up_at > datetime('now', '-1 hour')`
- Returns friendly "Slow down — try again in a bit" message

### Input Validation (Zod)
- Email: valid format, max 254 chars
- Referral source: enum validation against allowed values
- Referral detail: max 200 chars, stripped of HTML/script tags
- All validation runs server-side in the Server Action

### Duplicate Emails
- `UNIQUE` constraint on email column
- On conflict: return "You're already signed up!" as a success (not an error) — don't leak whether an email is registered

## Social Media Optimization

### Open Graph / Twitter Cards
In `/app/playtest/layout.tsx`:

```
og:title — "Pecking Order — Join the Playtest"
og:description — "A social game of alliances, betrayal & strategy. Sign up to play."
og:image — Static OG image (1200x630) stored in R2 or /public, featuring persona artwork + game title
og:url — https://playtest.peckingorder.ca
twitter:card — summary_large_image
twitter:title / twitter:description — same as OG
```

### Discord Embed
Discord reads OG tags. The `og:image` and `og:description` will render as a rich embed when the link is pasted.

### OG Image
A static image (1200x630) created as part of implementation:
- Game title in gold
- 3-4 persona headshots (exported from R2 assets)
- "Join the Playtest" text
- Deep purple background matching the theme
- Created once, committed to `/public/og-playtest.png`
- Not dynamically generated — a static asset

## DNS / Vanity URL

- Add CNAME record: `playtest.peckingorder.ca` → lobby worker hostname
- Add custom domain binding in Cloudflare Workers (or Pages, depending on lobby deployment)
- Lobby's Next.js routing handles `/playtest` naturally — no path rewriting needed

## Styling

- Import `@pecking-order/ui-kit/theme.css` for CSS variables
- Use `skin-*` Tailwind classes for colours
- Fonts: Poppins (display), Inter (body) — loaded via `<link>` with `preconnect`
- No shadcn components — native `<input>`, `<select>`, `<button>` with Tailwind styling
- Responsive: mobile-first (375px baseline), scales up to desktop with max-width container

## File Structure

```
apps/lobby/app/playtest/
├── layout.tsx          # Metadata (OG, Twitter, viewport), minimal wrapper
├── page.tsx            # RSC: hero, persona images, teaser strip, share buttons
├── signup-form.tsx     # "use client": form fields, submission state, Turnstile
└── actions.ts          # Server Action: validate, D1 insert, Resend email + audience

apps/lobby/lib/
└── email-templates.ts  # Add playtest confirmation template (alongside existing)

apps/lobby/migrations/
└── XXXX_create_playtest_signups.sql  # New D1 migration
```

## Out of Scope

- Privacy policy / legal consent (will add later)
- Additional form fields (availability, player type) — future segmentation fields
- Analytics / tracking pixels
- A/B testing
- Admin view of signups (query D1 directly or use Resend dashboard)
