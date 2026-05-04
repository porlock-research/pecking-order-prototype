# /playtest Page Critique

*Created: 2026-05-03*
*Source: synthesis of page-cro + form-cro + signup-flow-cro + impeccable critique lenses*
*Companion: `.agents/blitz-strategy.md` (strategic plan)*
*Branch: `feat/playtest-blitz`*

> Living document. As Tier-0 work lands, mark items resolved. Punted items at the bottom must be revisited post-blitz.

---

## TL;DR

The lobby's design brief is honored (not AI-generated slop, magazine-cover energy on point) — but the page sells **generic** social deduction, not the differentiator (multi-day, async, phone-native, reality-TV-flavored strategic depth). Form has 4–5 visible fields when waitlist pattern wants email-only. Zero trust signals near form. No legal infrastructure. **Nielsen heuristics: ~25/40** — solid baseline with high-leverage gaps.

---

## What's working — don't touch

- Lobby brief honored: persona portraits as visual interest, magazine-cover type, deep purple/gold/hot-pink palette, photo-driven aesthetic
- *"Vote. Ally. Betray. Survive."* typographic statement is on-brand and clear
- Form fundamentals sound: labels visible (not placeholder-only), Turnstile, inline errors, encrypted PII, conditional referral-detail field, returning-user share-screen
- Server-side handling: Zod validation, encrypted PII, Resend email, segment upsert
- Persona carousel + theme-color override + OG metadata wired up

---

## P0 — must fix before blitz (this branch)

### 1. Hero copy is generic
**Issue:** *"A social game of alliances, betrayal & strategy"* — true of every social-deduction game ever made (Werewolf, Mafia, Among Us, Town of Salem). Doesn't communicate the differentiator (multi-day async on phone). Cold visitor from a strategist subreddit reads it and bounces.

**Fix (Option A chosen):** *"Multi-day social deduction. Played from your phone, async."* Format-led, evocative, no show name (trademark-safe + broad-audience).

### 2. Form too long for waitlist pattern
**Issue:** 4–5 visible fields (email required, phone optional, messaging app optional, referral source required, conditional referral detail). `signup-flow-cro` waitlist pattern is **email-only**. Phone-next-to-email is a trust hit.

**Fix:** Reduce form-on-load to email + Turnstile + consent. Phone/messaging/source move to a post-signup "help us reach you for game-day reminders" screen, all optional. Functional change only — no visual redesign.

### 3. Zero trust signals near form
**Issue:** No "no spam" line, no privacy assurance, no social proof. Cold visitor has no reason to trust this is legit.

**Fix:** Inline microcopy below email: *"No spam. Unsubscribe anytime. We only email about playtests."* Plus link to `/privacy`. (Borderline design — flag to design agent if they want to own placement.)

### 4. No legal infrastructure
**Issue:** Missing `/privacy`, `/terms`. No consent disclosure. Required for general-public targeting (CASL, GDPR, CCPA).

**Fix:** Scaffold both pages with placeholder content flagged `LAWYER REVIEW REQUIRED`. Add consent line above submit referencing both.

### 5. peckingorder.ca apex is dead
**Issue:** `peckingorder.ca` returns ECONNREFUSED. Every Reddit/Twitter share will get URL-checked; a dead apex destroys credibility before signup.

**Fix (Option A chosen):** DNS redirect `peckingorder.ca` → `lobby.peckingorder.ca/playtest`. **User setting up directly.**

### 6. No source attribution
**Issue:** UTM params not captured. Without this the blitz produces no signal — we won't know which subreddit/post converted.

**Fix:** Capture `utm_source/utm_medium/utm_campaign/utm_content` from URL, store as columns on `PlaytestSignups`, log signup events to Axiom for analysis.

---

## P1 — high impact, do if time allows (this branch)

### 7. CTA copy is generic
*"Sign Me Up"* → *"Reserve My Seat"* (in-place, scarcity-flavored, broad-audience).

### 8. Commitment clarity buried
*"Play from your phone. Games run over multiple days."* sits at line 88 in tiny text. Hero now leads with format (Option A), so this becomes redundant — verify.

### 9. SEO basics absent
No `sitemap.xml`, no `robots.txt`. Standard Next 15 conventions: `app/sitemap.ts` + `app/robots.ts`. ~15 min.

### 10. OG image quality — VERIFIED 2026-05-03
`apps/lobby/public/og-playtest.png` checked: three persona cast cards on deep-purple/magenta background, "JOIN THE PECKING ORDER" wordmark with "Alliances. Betrayal. Strategy." subhead. Atmospheric text (no Traitors mention), correct 1200x630 aspect, on-brand. **Ship as-is.** Optional refresh once new lobby brief lands; flagged in punted items.

---

## P2 — polish (defer to post-blitz or next branch)

- "How did you hear about us?" — keep as optional / post-signup; not load-bearing for blitz
- Help/FAQ section ("How does this work?" "Is it free?")
- Reduced-motion compliance check on entrance animations
- ARIA improvements
- Email autocomplete + email typo detection (e.g., gmial.com → gmail.com)

---

## Persona red flags (strategist from r/TheTraitorsUS, 90s window)

| Window | What they see | Risk |
|---|---|---|
| 0–5s | Brand wordmark + tagline; tagline now says *"Multi-day social deduction. Played from your phone, async."* | LOW (after fix) |
| 5–15s | Persona carousel rotates. Visual interest. | LOW |
| 15–30s | "Playtesting Now" badge. Curiosity rises. | LOW |
| 30–60s | Scrolls to form. With reduction: sees ONE field (email) + Turnstile + consent. | LOW (after fix) |
| 60–90s | Submits. Success state: "You're In!" + referral code. Anchored next steps still thin (P2). | MED (deferred) |

---

## Punted items — revisit after blitz lands

**Design refresh (other agent's branch, then post-blitz):**
- Success-state visual redesign — ticket-stub motif (lobby brief explicitly references this)
- `impeccable:harden` pass (production hardening from lobby brief)
- `impeccable:clarify` pass (microcopy polish)
- `impeccable:delight` pass (animation/motion on success state)
- Visual treatment of trust microcopy near form

**peckingorder.ca evolution (post-validation):**
- Option B: Simple landing page on apex with brand framing
- Option C: Promote `/playtest` content to apex root (route restructure)

**Advanced analytics (V2):**
- A/B variants on hero (Option A vs B vs C)
- A/B variants on CTA copy
- Day-2 retention cohort segmentation by UTM source
- PostHog or similar for session replay

**Real legal copy:**
- Lawyer-reviewed `/privacy` and `/terms`
- GDPR/CCPA compliance check (formal)
- Cookie banner if/when EU traffic warrants

**Customer research (during/post-blitz):**
- Mine `referral_detail` responses for verbatim quotes — replace placeholders in `.agents/product-marketing-context.md`
- Reddit/Twitter mention sentiment analysis
- Post-game survey for first cohort

**Content workstreams (next phase):**
- Reddit subreddit post drafting (3 angles × 3 targets = 9 drafts)
- Twitter/X launch thread + daily-post bank
- Mod-DM templates per target subreddit
- Cold-borrowed outreach DM templates

**Form/page improvements (V2 after design lands):**
- Help/FAQ section
- Urgency/scarcity ("Cohort 1 — N seats" or "Next cohort starts [date]")
- Anonymized testimonial surface from past playtests

---

## Decisions locked (2026-05-03)

- **Hero copy:** Option A (format-led) — *"Multi-day social deduction. Played from your phone, async."*
- **CTA copy:** *"Reserve My Seat"*
- **Form trust microcopy:** *"No spam. Unsubscribe anytime. We only email about playtests."*
- **peckingorder.ca:** DNS redirect to `/playtest` (Option A); user owns DNS configuration
- **Design changes:** OUT this session; another agent owns lobby UI redesign
- **Traitors mention:** OUT of all copy (trademark + audience-breadth); stays as our targeting compass only
- **Legal pages:** Scaffold with `LAWYER REVIEW REQUIRED` placeholders; ship now, lawyer follow-up later
- **Branch:** `feat/playtest-blitz` (separate from other agent's lobby-design branch)

---

## Tier-0 build order (this branch)

1. Persist critique (this file) ✓
2. `/privacy` + `/terms` scaffold pages (~30m)
3. Form reduction to waitlist pattern, functional only (~45m)
4. Hero + CTA + microcopy rewrite, in-place (~30m)
5. Source tracking — UTM capture + signup events to Axiom + D1 columns (~30m)
6. `app/sitemap.ts` + `app/robots.ts` (~15m)
7. OG image verification (~5m)
8. Inline trust microcopy (~10m)

**Total: ~3h focused work.** After completion, return to punted items in priority order.
