Generate a handoff prompt for the next session. Run this before ending a session — always, not just mid-plan.

## Goal

Produce a self-contained markdown prompt the next session can consume cold. Treat the next agent like someone who just walked into the room — they have no memory of this conversation, so the handoff must stand on its own.

## Steps

### 1. Gather session state

In parallel:
- `git status` + `git diff --stat` — what's uncommitted
- `git log --oneline <session-start>..HEAD` — what shipped
- `git branch --show-current` — current branch

From the conversation, identify:
- What the user was trying to accomplish this session (one line, in their words if possible)
- What actually got done
- What was NOT done and why (deferred, blocked, out of scope)

### 2. Surface open threads — this is the discoverability step

Scan the session for anything that would orphan if no one followed up:

- **Unfinished work** — tasks started but not closed; commits marked wip/stub; partial implementations
- **Orphaned handoffs** — any spec or plan file edited this session containing phrases like "parallel session owns", "deferred to future session", "future work", or `## Handoff —` sections with incomplete items. The whole reason this command exists: handoffs written into spec sidebars get lost. Pull them into the prompt.
- **Unanswered questions** — things the user asked or you flagged that weren't resolved
- **Pending decisions** — design / architecture choices left open

If any of these exist, they MUST be in the handoff.

### 3. Identify the concrete next step

One specific, actionable sentence. Not "continue the work" — `npm run build` in apps/game-server and fix the remaining TS errors in src/machines/l2-orchestrator.ts:312. File paths + line numbers where relevant.

If there's no clear next step, say so — but first sanity-check whether the session is actually done (merge, archive plan, delete branch) or just paused.

### 4. Draft the handoff

Use this structure. Terse beats thorough. Complete sentences, no session-internal jargon.

```
# Handoff — <YYYY-MM-DD HH:MM>

## Goal
<1-3 sentences: what the user is working toward. Broader than this session.>

## State
- Branch: <name> (<N commits ahead of main / clean / stashed>)
- Uncommitted: <files, or "none">
- Dev server: <running on port X / stopped / n/a>
- Last commit: <sha>: <subject>

## What this session did
- <bullet per meaningful thing>

## Next step
<One concrete sentence. File paths + line numbers if applicable.>

## Open threads
- <bullet per orphaned handoff, pending decision, unresolved question>

## Watch out for
- <traps encountered this session that don't warrant a guardrail but the next agent should know>
```

### 5. Emit

Two destinations, for redundancy:

1. **Print the full markdown block to the user.** Primary delivery — the user can copy-paste it as the first message of the next session. Most reliable path; doesn't depend on any hook firing.
2. **Write a copy to `.remember/handoff.md`** (overwrite, don't append — only the latest handoff is useful). Second-chance discovery if the user forgets to paste.

### 6. No commits

This command does NOT commit. Handoffs are session-ephemeral and don't belong in git history. If there's staged work to commit, do that via `/reflect` or manually before running this.

## When NOT to run

- Pure read-only Q&A session with no state change
- Nothing touched, no decisions made, no open threads

If you're about to run `/handoff` and realize there's genuinely nothing to hand off, say so and exit.
