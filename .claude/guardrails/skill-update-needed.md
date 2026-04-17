# Skill updates pending

## `investigate-game` skill — soften "don't waste queries on lobby HTTP logs"

**Location:** `.claude/skills/investigate-game/SKILL.md` (Step 1).

**Current line:** *"Do NOT waste queries on lobby HTTP logs — they only contain URL routing (GET /join/CODE), not application data with game IDs."*

**Problem:** This language is too absolute. For invite/join funnel investigations (who tapped a share link, who bounced to `/login`, how many times a `/invite/TOKEN` hit was followed by `/join/CODE`), lobby HTTP logs are exactly the right dataset. This session (2026-04-16) they revealed 83 share-link bounces across 3 playtests — the data that drove the whole frictionless-invite design decision.

**Suggested edit:** Replace the blanket "don't" with a scoped statement:
> "Lobby HTTP logs do NOT contain game-server application events — for XState transitions, cartridge lifecycle, voting, etc., query `game-server-*`. But for invite/join funnel work (share-link taps, login bounces, email-invite conversion), lobby HTTP logs ARE the primary dataset. Cross-reference D1 (`InviteTokens`, `Invites`, `GameSessions`) for token-used state."

**Deletion condition:** Delete this entry once the skill's Step 1 is updated.
