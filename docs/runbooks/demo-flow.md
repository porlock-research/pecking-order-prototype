# Product Owner Demo — Runbook

**Last rehearsed:** _(fill in)_
**Rehearsed by:** _(fill in)_
**Staging deploy SHA:** _(fill in once `fix/create-game-flow` is on origin/main)_

This runbook drives the post-2026-04-21 happy path: create a CC game from
the homepage, frictionless join as a second player, host taps Start Game,
both players enter the client, host injects timeline events from admin
panel.

The 6-bug fix series (`docs/superpowers/plans/2026-04-22-create-game-flow-fixes.md`)
removed every regression that broke the original PO session. If anything
in this runbook trips, fall back to the bail-out plan at the bottom.

---

## Pre-demo checklist (T-30 minutes)

- [ ] Confirm `fix/create-game-flow` (or its merge into main) is deployed to staging:
      ```bash
      git log origin/main --oneline | head -10
      # Look for: fix(lobby): always auto-init DO for CC games...
      #           fix(lobby/j): preserve authed user's typed handle...
      #           fix(lobby/api): return 200+null from /api/refresh-token...
      #           fix(lobby/api): return 200+empty from /api/my-active-game...
      #           fix(ws): rate-limit invalid-token / playerId rejects...
      #           feat(lobby): host Start Game button for CC waiting room...
      #           fix(game-server): chain Games→Players insert...
      ```
- [ ] Pre-warm staging Workers (cold starts add 1-3s):
      ```bash
      curl -s https://staging-api.peckingorder.ca/parties/game-server/warmup/state | head -c 100
      curl -s https://staging-lobby.peckingorder.ca/api/my-active-game | head -c 100
      ```
- [ ] Open three tabs:
      1. Host: `staging-lobby.peckingorder.ca` (logged in as your demo identity)
      2. Admin: `staging-lobby.peckingorder.ca/admin/games` (super-admin session)
      3. PO: `staging-lobby.peckingorder.ca/j/PLACEHOLDER` (incognito, will be filled in once you have the code)
- [ ] Open Sentry: `peckingorder-staging` project — keep an eye on issue stream during demo
- [ ] Open Axiom: `po-logs-staging` dataset — quick-link query for the next 30 min

## Demo flow

1. **Create the game (host tab).**
    - Click "Create Game" on the homepage.
    - Leave the STATIC toggle OFF.
    - Confirm the redirect to `/game/<gameId>/waiting`.
    - Copy the invite code that appears next to the game title.
2. **Verify the DO auto-initialized (silent check).**
    - In the admin tab, navigate to `/admin/games/<gameId>` — the Overview tab should show `state: "preGame"` (NOT `"uninitialized"`).
3. **Frictionless join as PO (incognito tab).**
    - Visit `staging-lobby.peckingorder.ca/j/<CODE>`.
    - Type a name → "Let's go".
    - Pick a persona → confirm bio → submit.
    - Confirm the joined-cast portrait appears on the welcome page for both first-joiner and host views.
4. **Host taps Start Game.**
    - On the host's `/game/<gameId>/waiting` tab, the new "Start Game" button should be visible (≥2 players joined).
    - Tap it. Expected: page flips to "Enter Game as p1" within ~1s.
5. **Both players enter the client.**
    - PO clicks the Enter Game link in their tab → pulse client loads → cast strip populated.
    - Host clicks Enter Game in their tab → pulse client loads.
6. **Drive the day from admin panel.**
    - Admin tab → Overview → "Start Day 1" button. (If the DO somehow stayed uninitialized, the button now offers to POST /init first; click OK.)
    - Inject timeline events from the Inject Timeline section:
      - `START_CONFESSION_CHAT` → confession booth opens for both clients.
      - `OPEN_VOTING` → voting UI appears.
      - `CLOSE_VOTING` → result animation fires, eliminated player is announced.

**Expected total runtime:** 3–5 minutes for the happy path, before content/voting time.

## If things go wrong — bail-out plan

| Symptom | First check | Fix |
|---|---|---|
| `/j/CODE` 500s | Axiom for `lobby` errors | Check the game exists in D1 (`wrangler d1 execute pecking-order-journal-db-staging --remote --command "SELECT id, status FROM GameSessions WHERE invite_code='<CODE>'"`). If yes, click "Open Game" from admin and screenshot the error. |
| Start Game button absent | Filled slots count + isHost flag | Confirm the host session matches `host_user_id` on the game row. If host is correct, hard-refresh the page. |
| Start Game button no-op | Network tab → server action response | If `error: 'Game not found'` → wrong invite code casing. If `error: 'Only the host'` → wrong account. |
| Enter Game button doesn't appear after Start | `tokens` state | Check the server action returned a non-empty tokens object (devtools Console → `window.localStorage`). Re-tap Start. |
| WebSocket rejects with 4001/4003/4008 | Network tab → WS frame | 4008 = rate-limit kicked in (>4 invalid attempts in 30s). Clear localStorage for the pulse domain (`localStorage.clear()`) + cookies, retry. |
| Admin Start Day 1 silently no-ops | OverviewTab `state.state` | Should be `"preGame"`. If `"uninitialized"`, click Start Day 1 again — the new dialog will offer to init first. |
| Player can't see admin INJECT_TIMELINE_EVENT effects | INSPECT.SUBSCRIBE WS to confirm event reached the actor | If the inject returns OK but nothing happens, check Axiom for `xstate.error.actor.game-master` (ADR-145). |

## Manual D1 escape hatches

```bash
# Force a game's status to STARTED (use only if Start Game button is broken)
wrangler d1 execute pecking-order-journal-db-staging --remote --command "UPDATE GameSessions SET status='STARTED' WHERE invite_code='<CODE>'"

# List active games for a user (debug who's allowed to host-start)
wrangler d1 execute pecking-order-journal-db-staging --remote --command "SELECT g.invite_code, g.status, g.host_user_id, u.email FROM GameSessions g JOIN Users u ON u.id = g.host_user_id WHERE g.status IN ('RECRUITING','READY','STARTED') ORDER BY g.created_at DESC LIMIT 10"

# Check WS reject cache pressure for a DO (proxy: count rejects in Axiom over last 30s)
# In Axiom UI: dataset=po-logs-staging  query: ['Rejecting connection: invalid player ID' or 'JWT verification failed'] | count() by playerId | sort by _count desc
```

## After the demo

- [ ] Capture session-replay link from Sentry (if any errors fired) — paste into `.remember/today-2026-04-23.md` for follow-up.
- [ ] If anything was hand-fixed mid-demo, file a GH issue immediately. Don't lose the lesson.
- [ ] Update the Last rehearsed date at the top of this file.
