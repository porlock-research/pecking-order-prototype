# Product Marketing Context — Pecking Order

*Last updated: 2026-05-03*
*Referenced by marketing skills (page-cro, form-cro, copywriting, etc.). Update as positioning evolves.*

> **Items marked `[NEEDS REVIEW]`** are placeholders or inferences from existing docs/memory. Confirm or correct before relying on them load-bearingly.

---

## Product Overview

**One-liner:** A multi-day social-deduction game inspired by reality TV's *The Traitors*, played asynchronously on your phone.

**What it does:** Pecking Order is a real-time social game where 6–20 players form alliances, send messages, complete daily activities (votes, prompts, dilemmas, mini-games), and try to survive elimination across multiple in-game days. Days run on a server-driven timeline, so play is asynchronous — players check in for ~5–10 minutes a day. Built phone-first as a PWA, joined via magic-link invites (no app store, no password).

**Product category:** Social games / async multiplayer / reality-TV-inspired social deduction. The "shelf" is between Mafia/Werewolf-style social-deduction apps and Discord-based fan-run reality-TV leagues.

**Product type:** Web-based mobile-first PWA. React 19 client, Cloudflare Workers + Durable Objects backend, XState v5 state machines, D1 for persistence.

**Business model:** Pre-monetization, in playtest phase. `[NEEDS REVIEW]` Future model TBD — likely free-to-play with possible host/cohort tier.

---

## Target Audience

**V1 audience (original product framing):** Teens / early 20s. Group-chat-native. Modern, vibrant, low-friction expectations. (Source: existing `user_target_audience` memory.)

**Blitz audience (PRIMARY for this push):** Reality-TV strategists. Fans of *The Traitors* (US/UK), *Survivor*, *Big Brother*, RHAP (Rob Has a Podcast). They watch reality competition for the social mechanics and game theory, not just drama. Active in r/TheTraitorsUS, r/survivor, r/BigBrother, r/BigBrotherCirclejerk, r/RHAP, RHAP Patreon Discord, Survivor Discord servers. `[NEEDS REVIEW]` — refine the channel list with PO input.

**Decision-makers:** N/A — solo consumer signup.

**Primary use case:** Scratch the "I wish I could actually play *The Traitors*" itch. Get into a real strategic social game with multi-day arc, async-friendly, no install, no synchronous-call coordination.

**Jobs to be done:**
- Hire it to play out the Traitors fantasy ("I'd be so good at this")
- Hire it for low-commitment social play during downtime (phone, async)
- Hire it for community-driven scheming with peers who take the mechanics seriously

**Use cases:**
- Strategist signs up solo from a subreddit, gets matched into a cohort with strangers
- Reality-TV podcast / community signs up as a group via shared invite
- Friend group plays one game together as a "cast"

---

## Personas

| Persona | Cares about | Challenge | Value we promise |
|---|---|---|---|
| **Strategist (PRIMARY for blitz)** | Alliances, reading players, surviving votes, the meta-game | "I love Traitors but can't actually play it. Discord games are too much hassle." | A real multi-day social game where strategy matters, played from phone, async |
| **Casual reality-TV fan** | Hanging out, drama, low-stakes fun | Most multiplayer games need install + sync time | Drop-in async play; 5–10 min/day |
| **Host (future)** | Running a game for friends/community | No good tool for reality-TV-style hosting | `[NEEDS REVIEW]` — not blitz target; future segment |

---

## Problems & Pain Points

**Core problem:** Reality TV strategists love watching social games but have no way to actually *play* one. Existing alternatives are either too brief, too synchronous, or lack the multi-day relational arc that makes *The Traitors* compelling.

**Why alternatives fall short:**
- **Mafia / Werewolf**: One round, in-person or live-call only, no relational continuity
- **Among Us**: Quick matches, no reputation persistence, no political arc
- **Town of Salem**: Synchronous-only, no async play, no multi-day drama
- **Watching reality TV**: Pure passive consumption, no agency
- **Discord-based fan leagues (RHAP fantasy seasons, draft games)**: Fragmented, ad-hoc, no purpose-built tools, often heavy synchronous-call commitment, gatekept by mods/cliques

**What it costs them:** The Traitors-shaped craving goes unmet. They theorize on Reddit, run draft leagues, watch shows on repeat — but never get to scheme.

**Emotional tension:** "I'd be SO good at this. Why can I only watch?"

---

## Competitive Landscape

**Direct:** Town of Salem, Werewolf-style apps, Among Us — *fall short on multi-day arc, async play, and reputation persistence.*

**Secondary:** Reddit/Discord fantasy reality-TV leagues (RHAP fantasy, r/survivor draft games, fantasy Big Brother) — *fragmented, no native tools, sync-heavy, friction to join.*

**Indirect:** Watching *The Traitors* / *Survivor* itself — *passive, fills the emotional space without giving agency.*

---

## Differentiation

**Key differentiators:**
- Multi-day async format (play during downtime, not as a fixed evening)
- Phone-native PWA (no install, no app-store friction, no Discord onboarding)
- Persistent reputation / alliance memory across days
- Reality-TV-grade visual presentation (multiple "shells" — Pulse, Vivid, Classic, Immersive)
- Magic-link invites (no password, instant join from text/DM)

**How we do it differently:** Built async-first on a server-driven timeline. The game runs whether you're online or not — alarms drive phase transitions; you check in when you have time. Existing alternatives were retrofitted for async (Discord channels) or are sync-only by design.

**Why that's better:** You play at lunch. You don't coordinate 8 friends. The slow-burn social drama IS the point, not a workaround.

**Why customers choose us:** It's the closest thing to actually playing *The Traitors*, on a device they already use, during time they already have free.

---

## Objections

| Objection | Response |
|---|---|
| "I won't have time for a multi-day game" | 5–10 min/day, async — play during your existing downtime |
| "Just another Werewolf clone?" | No — multi-day arc, persistent reputation, phone-native, async |
| "Why give you my email and phone?" | Email for game-day reminders. Phone optional, encrypted, never sold |
| "Is this real / will the playtest actually run?" | Active development, prior playtests run; cohorts opening as signups grow |
| "Will I be matched with bots?" | No — real human cohorts only |
| "Is this a paid thing?" | Free during playtest. No credit card required. |

**Anti-persona:** Players who want fast-twitch ranked play, voice-chat-required social, or one-and-done sessions. Pecking Order is for slow drama, not Apex Legends.

---

## Switching Dynamics (JTBD Four Forces)

**Push (away from current state):** Frustration that watching *The Traitors* leaves them on the sidelines. Discord game leagues are too sync-heavy / fragmented / gatekept.

**Pull (toward us):** "I can finally actually play something like *The Traitors*, on my phone, in my own time."

**Habit (current behavior):** Watching reality TV. Theorizing on Reddit. Quick mobile games (Wordle, Subway Surfers) during downtime.

**Anxiety (about switching):** "Will this take too much time?" / "Will it be cringe?" / "Will I be matched with weirdos?" / "Is it actually any good or is this vaporware?"

---

## Customer Language

`[NEEDS REVIEW — populate from real customer voices]` Initial guesses below; replace with verbatim quotes from blitz signups (`referral_detail` field) and social mentions:

**How they describe the problem:**
- "I want to play *The Traitors* so bad"
- "I'd be SO good at this game"
- "Why isn't there an actual game version of this"
- "Discord games are too much hassle"
- "I just want to scheme"

**How they describe us:** *(needs verbatim post-launch — collect from referral_detail responses, social mentions, post-game survey)*

**Words to USE:** strategist, alliance, betrayal, cohort, vote, reveal, scheme, multi-day, async, phone-first, social game, day, phase, eliminate, cast, banish

**Words to AVOID:** game theory (too academic), AI-powered (it's not), metaverse, Web3, DAO, NFT, "blockchain-anything," "gamified" (cringe), "engagement" (sounds like a pitch deck)

**Glossary:**

| Term | Meaning |
|---|---|
| Cohort / Cast | A group of players in one game |
| Day | An in-game day (real-time hours, not 24h); has phases |
| Phase | A segment within a day (morning chat, voting, reveal, etc.) |
| Cartridge | The activity that runs in a phase (voting, prompt, dilemma, arcade) |
| Pulse / Vivid / Classic / Immersive | Visual shells, different tones for different audiences |
| Persona | A fictional character a player is assigned (with portrait + bio) |

---

## Brand Voice

**Tone (varies by surface):**
- **Lobby** (signup, invite redemption, waiting room): *loud · gossipy · electric.* Magazine-cover loud type. Reality-TV title-card meets event poster meets nightclub door.
- **In-game (Pulse shell)**: *calm · dramatic · recedes.* Lets the social moments be the focus.
- **Confirmation emails**: tabloid-title-card brand (umbrella, not Pulse skin)

**Style:** Punchy, present-tense, teen-native. Section labels read like a casting board, not a settings panel. Short clauses. Drama-aware. Knowing wink, not earnest startup pitch.

**Personality (3–5 adjectives):** loud, gossipy, electric, knowing, slightly camp.

---

## Proof Points

`[NEEDS REVIEW]` Most metrics are pre-blitz. Fill from prior playtest data + blitz results.

**Metrics:**
- 1+ successful playtest (engagement metrics: `[NEEDS EXTRACT — query Axiom / past-game data]`)
- Current waitlist signups: `[NEEDS COUNT — query D1 PlaytestSignups table]`
- Multiple game shells shipped (Pulse, Vivid, Classic, Immersive)
- 17+ bespoke game cartridges built (voting, prompts, dilemmas, arcade games)

**Customers / Testimonials:** None published yet. *Opportunity*: collect 1–2 quotes from successful past playtest for the blitz page.

**Value themes:**

| Theme | Proof |
|---|---|
| Multi-day async social drama | Server alarms drive phase transitions; players drop in/out without coordination |
| Phone-native, no install | PWA, magic-link invites, no app store, no password |
| Reality-TV-grade presentation | Multiple themed shells, persona portraits, dramatic title cards |
| Real strategic depth | Cartridge variety; 17+ unique daily activities; persistent alliances |

---

## Goals

**Business goal (THIS PUSH):** Validate that Pecking Order has broad appeal among reality-TV strategists. Run a marketing blitz to reality-TV subreddits and adjacent communities, generate qualified signups, run cohorts, measure engagement. If engagement validates the thesis → raise funds. If not → project ends. (No investor lined up yet; the blitz is also our market-validation experiment.)

**Conversion action:** Email signup on `/playtest` form → matched into next playtest cohort → completes Day 1 and returns for Day 2.

**Funnel stages to measure:**

1. Page view (`/playtest` from blitz traffic)
2. Form start (first field interaction)
3. Form submit (signup completed)
4. Cohort assignment (manual / scheduled)
5. First-game start
6. First-day completion
7. **Day-2 return (KEY retention metric)**
8. Cohort completion

**Current metrics:**
- Signup conversion: **unknown** (no analytics — first thing to fix)
- Push delivery health: known issues (desktop Brave AbortError, P0 — fix in progress on `fix/brave-push-uxtrap`)
- Day-2 retention from prior playtests: `[NEEDS REVIEW — extract from successful playtest data]`

**Success criteria for the blitz** `[NEEDS REVIEW — user/PO to set]`:

- **Tier A (validated):** 100+ qualified signups, 30%+ complete first scheduled game, organic referral usage
- **Tier B (investor-grade):** 500+ signups, 3+ completed cohorts with sustained day-2+ engagement
- **Tier C (broad appeal):** organic word-of-mouth visible (referral codes used, social mentions, mod-friendly posts in target subreddits)

---

## Notes for Marketing Skills

- Lobby has its own design brief at `apps/lobby/.impeccable.md` — reference it alongside this file for visual/tonal decisions (loud, photo-driven, magazine-cover).
- Pulse (in-game) has its own brief at the repo root `.impeccable.md` — calm, dramatic, recedes. Don't conflate.
- Active engagement-engine work is multi-session: push delivery (`fix/brave-push-uxtrap`), invite/auth/PWA first-tap conversion, signup-form retargeting (THIS workstream).
- Email templates use an "umbrella tabloid title-card" brand, distinct from Pulse — see `apps/lobby/lib/email-templates.ts`.
