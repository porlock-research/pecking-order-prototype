# Marketing Blitz Strategy — Pecking Order

*Last updated: 2026-05-03*
*Time horizon: **days, not weeks**. Cohorts run immediately on signup.*
*Status: live working document — refine as we learn.*

> Companion to `.agents/product-marketing-context.md`. That file holds positioning + audience; this file holds the playbook.

---

## Strategic Goal

Validate broad appeal among reality-TV strategists. Generate qualified signups, run cohorts **immediately**, measure engagement (especially Day-2 retention). If thesis validates → raise funds. If not → project ends.

This is **not a typical launch**. It's a one-shot validation experiment with no audience, no warm relationships, no investor lined up. Days not weeks. The strategy is shaped by those constraints.

---

## The Constraint That Shapes Everything

**Days, not weeks. No warm intros. Limited budget.**

What this rules out:
- Building owned audience first (no time)
- Long-form SEO content for acquisition (3–6 month payoff)
- Cold borrowed outreach as PRIMARY channel (slow conversion without warm intros)
- Multi-platform simultaneous launch (concentration > breadth)
- Lead magnets beyond the playtest itself (the playtest IS the offer)

What we lean on instead:
- **Reddit organic** to communities of strategists that already exist
- **Twitter/X organic** for sustain + viral upside
- **Cold borrowed outreach** in parallel — accept low expected hit rate, but high upside on each win
- **Polished web presence** that converts cold visitors in <90 seconds

---

## Channel Priority

| Priority | Channel | Why |
|---|---|---|
| 1 | **Reddit organic** | Strategists live here. Free. Fast. Highest audience fit. |
| 2 | **Twitter/X organic** | Reality-TV community active. Threads + quote-tweets travel. Surface for borrowed-channel targets. |
| 3 | **Cold borrowed outreach** | Lower expected conversion (no warm intros), but high upside per win. Run in parallel. |
| 4 | **Paid (Reddit Promoted, Meta)** | **Hold** until organic produces signal + conversion data |
| 5 | **SEO basics** | Ship table stakes (titles, meta, og, schema, sitemap). Defer growth SEO entirely. |

---

## What We Explicitly Skip

- Long-form blog/SEO content for THIS push
- TikTok / Reels / Shorts (no video assets, lower strategist density)
- Lead magnets beyond the playtest
- Cold paid ads from day 1
- Email nurture sequences beyond confirmation
- LinkedIn (wrong audience entirely)
- Multi-platform simultaneous launch

---

## Day-by-Day Sequence

### Day 0 (now)
Strategy locked. Persisted. Acquisition surfaces queued.

### Days 1–2 (~48h ramp, parallel work)

**Signup page polish:**
- `impeccable:critique` + `page-cro` + `form-cro` + `signup-flow-cro` critiques in parallel → synthesized punch list
- Tier-0 build: legal scaffolds (privacy/terms), strategist hero rewrite, form reduction (email-first; progressive phone/messaging), source tracking (UTM capture in form)
- `impeccable:harden` + `clarify` + `delight` passes

**Web presence:**
- OG share image purpose-built for blitz (every Reddit/Twitter share renders this)
- `peckingorder.ca` homepage audit — make sure it doesn't actively repel visitors
- Twitter/X profile: handle, bio with playtest link, banner, pinned thread
- Privacy + Terms pages live (placeholder language flagged for lawyer review)
- SEO table-stakes: title/meta on `/playtest`, JSON-LD `WebApplication` schema, og:image, sitemap.xml, robots.txt
- Analytics: UTM capture, signup events, source attribution to D1

**Content drafted in batch:**
- 5–10 Twitter/X posts (1 launch thread, daily quote-tweets, anonymized game-moment teasers)
- 3 subreddit post variants per target (3 angles × 3 targets = 9 drafts)
- Mod-DM templates (one per subreddit, customized to subreddit's culture)
- Cold-outreach DM templates (RHAP, podcasters, YouTubers)

### Day 3 (launch)

- **Subreddit drop #1: r/RHAP** (warmest fit — fantasy-game culture pre-exists)
- Launch Twitter/X thread + reply engagement
- 2–3 cold-borrowed DMs sent
- **Engagement protocol:** every comment, reply within 30 min in first 6 hours
- Monitor: page views, form starts, signups, conversion-by-source

### Day 4
- Subreddit drop #2: **r/TheTraitorsUS** (Traitors-direct angle, different post variant)
- Twitter daily posts + replies
- 2–3 cold-borrowed DMs
- Run first playtest with Day-3 signups (immediate cohort)
- Capture (anonymized) dramatic moments for second-wave content

### Day 5
- Subreddit drop #3: **r/survivor** OR **r/BigBrother** (broader angle, third variant)
- Twitter daily
- 2–3 cold-borrowed DMs
- Cohort continues; collect testimonials

### Days 6–7+ (sustain)
- Second-wave subreddit posts WITH proof from first cohort
- Twitter posts featuring (anonymized) moments from games
- If any borrowed-channel target bites → coordinate around their schedule (often the leverage event)
- Daily decision: which channel is converting? Double down or kill?
- **Day 7 review:** are we hitting Tier A signal? If yes → consider paid amp. If no → reposition.

---

## Channel Playbooks

### Reddit Organic

**Targets (in priority order):**
1. r/RHAP — most fantasy-reality-TV-game native; warmest fit
2. r/TheTraitorsUS — direct genre fit; higher mod scrutiny
3. r/survivor — large; mod-strict on self-promo
4. r/BigBrother — large; less mod-strict
5. r/BigBrotherCirclejerk — meta-fan community; novelty welcome
6. (Backup) r/realityTV, r/bachelornation if Top 5 underperform

**Anti-promo culture:** Most subs ban self-promo. Strategy must survive mod review.

**Three post angles to draft (each ~250–500 words):**

1. **"Show, not pitch"** — Lead with a real moment from a past playtest as a story. The mention of signing up comes at the END as a soft offer. Lowest mod-risk. Best for r/survivor.

2. **"Open letter / social experiment"** — Frame as open invitation: "We built a multi-day social-deduction game inspired by Traitors. Looking for strategists to playtest." Direct and honest. Best for r/RHAP and r/TheTraitorsUS.

3. **"Behind the scenes / dev-blog"** — "Why we built async Traitors and what we've learned." Establishes legitimacy, less promotional feel. Best for higher-scrutiny subs.

**Mod-permission protocol:**
- DM mods of top 2 targets **before** posting
- Ask: "We're playtesting a Traitors-inspired game; would a post about it be welcome, or against rules?"
- Even rejection gives info — sometimes mods volunteer where to post instead

**Engagement protocol:**
- First 6 hours: reply to every comment within 30 min
- Don't get defensive on negative comments — agree with valid critique, redirect
- If post gets nuked: don't repost immediately, read the rules, message mods, learn

### Twitter/X Organic

**Goal:** Sustain visibility between Reddit drops. Surface to potential borrowed-channel targets (RHAP folks, reality-TV creators) who lurk there.

**Format:**
- **1 launch-day thread**: "We built a multi-day social-deduction game inspired by Traitors..." 5–7 tweets, 1 hero image, 1 link to /playtest
- **Daily**: quote-tweets / replies on reality-TV community posts
- **After first cohort**: anonymized game-moment posts ("a player just betrayed her closest ally on Day 3 — here's the message she sent")

**Hashtags (use sparingly):** #TheTraitors, #TheTraitorsUS, #Survivor, #BigBrother, #RHAP

**Tag-targets** (include in threads where relevant; never @-spam): @RobHasApodcast, reality-TV recap accounts, mid-tier reality-TV commentary accounts

### Cold Borrowed Outreach

**Targets to identify (10–20):**
- RHAP — host, producers, regular guests
- Reality-TV YouTubers — Survivor recap channels, Traitors reaction creators (mid-size, more responsive than top tier)
- Smaller reality-TV podcasters (easier to land than RHAP itself)
- Reality-TV fan-fiction / fantasy-league organizers on Reddit/Discord
- Subreddit power-users (top 1% commenters in r/TheTraitorsUS, r/survivor) — already evangelists

**Approach:**
- Personal DM/email — never blast
- Open with specific praise of their content (must be genuine — read their work)
- Pitch: "We built a game inspired by what you cover. Would love your take. Free access, no pressure."
- Send link to /playtest + magic-link invite to a private cohort if they want to play with friends

**Expected hit rate:** 5–10% engage; 1–2% produce material exposure. Target 20+ contacts to get 1–2 wins.

### Web Presence (table-stakes)

- **`/playtest` page**: form polish complete, OG image purpose-built for share preview
- **`peckingorder.ca` homepage**: confirm state — if empty/broken, simple landing that redirects to /playtest with brand framing
- **Twitter/X profile**: handle, bio with playtest link, banner, pinned launch thread
- **Privacy + Terms pages**: live with placeholder language flagged `LAWYER REVIEW REQUIRED`
- **SEO basics**: title/meta on /playtest, JSON-LD `WebApplication` schema, og:image, sitemap.xml, robots.txt

### Paid (held until signal)

**Triggers to launch paid:**
- First cohort yields >30% Day-2 retention
- Conversion-by-source data identifies winning channel
- Total signups >100

**When triggered, in order:**
1. **Reddit Promoted Posts** to subscribers of r/TheTraitorsUS, r/survivor, r/BigBrother, r/RHAP
2. **Meta Lookalike Ads** based on signup pixel data (need 100+ signups for lookalike base)
3. (Skip Twitter Ads — expensive, less effective for niche B2C)

**Budget posture:** $0 upfront. Cash deployed only after organic produces signal.

---

## KPIs

### Success tiers (from `.agents/product-marketing-context.md`)

- **Tier A (validated):** 100+ signups, 30%+ first-game completion, organic referral usage
- **Tier B (investor-grade):** 500+ signups, 3+ cohorts with sustained Day-2+ engagement
- **Tier C (broad appeal):** organic word-of-mouth visible (referral codes used, social mentions, mod-friendly posts in target subreddits)

### By stage

| Stage | Metric | Day |
|---|---|---|
| Leading | Signups by source | 1–3 |
| Leading | Page → form-start rate | 1–3 |
| Leading | Form-start → completion rate | 1–3 |
| Mid | Strategist language in `referral_detail` | 3–5 |
| Mid | First-email reply rate | 3–5 |
| Lagging | First-game completion rate | 5–7 |
| Lagging | **Day-2 retention** (KEY) | 5–14 |
| Lagging | Referral codes used | 7–14 |
| Lagging | Repeat cohort engagement | 7–14 |

---

## Kill / Pivot Criteria

| Trigger | Pivot |
|---|---|
| Day 3 yields <30 signups across all channels | Channel mix wrong → reposition; try secondary subs |
| First cohort <30% Day-2 retention | Product issue → fix before continuing push |
| 3+ subreddit mod bans | Angle/positioning wrong → rewrite from scratch |
| Day 7: no organic word-of-mouth visible | Broad-appeal thesis not validated → reconsider |
| Day 7: zero borrowed-channel responses | Acceptable; organic is primary anyway |

---

## Open Decisions / TODOs

- [ ] Confirm subreddit target list (r/RHAP, r/TheTraitorsUS, r/survivor, r/BigBrother, r/BigBrotherCirclejerk)
- [ ] Cohort cadence promise on the form ("starting this week" vs "first available cohort")
- [ ] Borrowed-channel target list (10–20 names, prioritized)
- [ ] Budget reserve for paid amp once organic shows signal
- [ ] Twitter/X handle (peckingorder? peckingordergame? other?)
- [ ] Decision-maker for "go" vs "kill" at Day 3 / Day 7 review

---

## Skills referenced (for future sessions)

- `community-marketing` — Reddit + Discord channel mechanics
- `launch-strategy` — ORB framework, phase model
- `marketing-psychology` — mimetic desire, scarcity, anchoring (for hero copy + cohort framing)
- `copywriting` — hero + CTA copy
- `social-content` — Twitter/X posts, threads, hooks
- `page-cro` + `form-cro` + `signup-flow-cro` — form/page conversion
- `analytics-tracking` — UTM strategy, event naming
- `seo-audit` — table-stakes SEO check
- `customer-research` — Reddit mining, post-signup voice-of-customer
