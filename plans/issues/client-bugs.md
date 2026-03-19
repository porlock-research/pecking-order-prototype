# Client / UI Bugs

Active client-side and UI issues.

---

## [BUG-004] Cartridge enter animation missed on late join

**Priority**: Low
**Status**: Partially fixed — entrance animation (opacity, y, scale) works but spring overshoot/bounce is not visible.

The CartridgeWrapper bouncy entry animation only plays if the client is already loaded when the cartridge spawns. If a player opens the client after the cartridge is active (the majority case — push notification -> open app), the cartridge renders instantly with no animation.

Tried: requestAnimationFrame defer, setTimeout delay, larger y/scale values, separating CSS animation onto a different element. None produced visible bounce. The `SPRING.bouncy` config (stiffness 300, damping 12) should be underdamped but overshoot is imperceptible. Needs deeper investigation into framer-motion spring behavior.

---

## [BUG-005] Completed phase timeline cards lack visual polish

**Priority**: Low
**Status**: ✅ FIXED (`feature/user-friendliness`, ADR-098) — completed phase results render as living cards in the Dashboard Overlay with category-colored accents and glass styling.

---

## [BUG-008] Group chat creation UI needs redesign

**Priority**: Low
**Status**: Not yet investigated

The NewGroupPicker is reused from the classic shell and doesn't match the immersive shell's design language. Needs a native immersive UI pattern for selecting members and creating group DMs — likely a drawer or inline picker consistent with PlayerDrawer/GroupDrawer.

---

## [BUG-012] iOS standalone PWA does not preserve session

**Priority**: Medium
**Status**: Largely mitigated

**What works now**: Dynamic manifest injection embeds JWT in `start_url` (`/game/CODE?_t=JWT`). When a player taps "Add to Home Screen" in Safari, the PWA installs pre-authenticated. Cookie bridge (`po_pwa_CODE`) provides belt-and-suspenders recovery on iOS 17.2+. Expired token guard gracefully shows LauncherScreen instead of stale auth.

**Remaining limitation**: If the game token expires before PWA install, or if the PWA was installed for a previous game, the embedded `start_url` token is stale. The expired-token guard catches this and shows LauncherScreen with cached games + code entry.

**UX debt**: The re-auth flow is broken in practice — recovery chain redirects to lobby (cross-origin), which opens in iOS in-app browser overlay. Magic link opens Safari, not the standalone PWA. Possible solutions:
- **In-app OTP verification**: 6-digit code flow in lobby. Keeps user in standalone context.
- **Lobby "copy link" flow**: After magic link login in Safari, show "Open in app" button. Hacky but no auth changes.
- **Universal Links**: AASA hosting — may not work for PWAs (native apps only).

**Relevant files**: `apps/client/src/App.tsx`, `apps/client/src/sw.ts`, `apps/lobby/app/api/refresh-token/[code]/route.ts`

---

## [BUG-014] Missing UI: DM invitation accept/decline flow

**Priority**: High — core social mechanic has no client-side interface
**Status**: ✅ FIXED (`feature/ui-polish`, ADR-096)

Unified DM channel model with `pendingMemberIds` replaces old `PendingInvite` system. First message IS the invite. WhispersTab shows pending conversations with inline accept/decline. DMChat shows InviteInputBar with slot tracking for pending conversations. NewConversationPicker sends invites via the unified flow.

---

## [BUG-015a] Missing UI: voting explainer in cartridges

**Priority**: Medium
**Status**: ✅ FIXED (`feature/user-friendliness`, ADR-098) — `VOTE_TYPE_INFO` explainers shown on collapsible timeline event cards in the Dashboard Overlay.

---

## [BUG-015b] Missing UI: economy explainer + transaction log

**Priority**: Medium
**Status**: Constants + selector ready, UI missing

`ECONOMY_INFO` constants and `selectSilverHistory` selector added (PT1-UX-008), but no UI exists to:
- Show silver/gold explanation (tap on balance)
- Display transaction history (recent silver earned/spent/transferred)

---

## [BUG-015c] Missing UI: player activity indicators

**Priority**: Low
**Status**: Deferred — player activity data available via ticker/marquee (existing infrastructure). Dedicated UI not yet implemented.

---

## Vivid Shell Audit (March 2026)

Issues found during Playwright audit of the Vivid shell at 390×844 mobile viewport.

### [BUG-016] Stage "HERE" avatar has perpetual animation instability

**Priority**: Critical
**Status**: Needs investigation

The player's own avatar on the Stage tab (marked "HERE") has an animation that never settles — the element is perpetually "not stable" per Playwright's stability check. Likely a Framer Motion spring or CSS animation loop that continuously recalculates position/scale. Blocks automated interaction testing and may cause unnecessary GPU work on mobile.

**Repro**: Navigate to Stage tab → observe the "HERE"-labeled avatar. Playwright `click()` times out with "element is not stable".

---

### [BUG-017] BroadcastBar marquee text clipping on mobile

**Priority**: Critical
**Status**: ✅ FIXED (`feature/ui-polish`) — gradientWidth 24→40px for smoother edge fade

The scrolling marquee text in the BroadcastBar gets clipped mid-word at both edges. The gradient mask that fades text in/out is too narrow, so words are visibly cut rather than smoothly fading. On 390px width, the effect is pronounced — partial letters visible at left and right edges.

**Fix direction**: Widen the gradient mask zones (currently likely ~10-15px, needs ~30-40px) or add padding to marquee content.

---

### [BUG-018] "Vivid" debug button visible in production tab bar

**Priority**: Medium
**Status**: ✅ FIXED (`feature/ui-polish`) — ShellPicker returns null unless `import.meta.env.DEV`

A small "Vivid" text button appears at bottom-left of the tab bar, overlapping the Stage tab area. This is a development/debug toggle that shouldn't ship to players. Should be gated behind `import.meta.env.DEV` or a debug flag.

---

### [BUG-019] DramaticReveal doesn't auto-dismiss

**Priority**: Medium
**Status**: Needs design decision

The DramaticReveal overlay (used for elimination announcements, vote results) stays on screen indefinitely until the user taps it. If a player is AFK or doesn't realize they need to tap, it blocks all interaction with the game. Consider auto-dismiss after 5-8 seconds, or at minimum add a visible "Tap to continue" hint.

---

### [BUG-020] Empty Stage chat has no actionable empty state

**Priority**: Medium
**Status**: Needs design

When the Stage tab shows an empty chat (no messages yet), there's no guidance — just blank space. Should show a contextual message like "Group chat opens at [time]" or "Chat is open — say something!" depending on whether OPEN_GROUP_CHAT has fired.

---

### [BUG-021] Whispers empty state lacks guidance

**Priority**: Medium
**Status**: Needs design

The Whispers tab with no conversations shows minimal empty state. New players don't understand what DMs are, how to start one, or the silver cost. Should include a brief explanation and a prominent CTA to start a conversation.

---

### [BUG-022] NewConversationPicker "Start Conversation" button nearly invisible when disabled

**Priority**: Medium
**Status**: ✅ FIXED (`feature/ui-polish`) — disabled state uses warm muted brown (visible but inactive)

When no player is selected in the NewConversationPicker, the "Start Conversation" button is so faded it's nearly invisible against the background. Players may not realize it exists. Should have a visible-but-muted disabled state with clear affordance.

---

### [BUG-023] Player Detail drawer shows "More coming soon..." placeholder

**Priority**: Low
**Status**: ✅ FIXED (`feature/ui-polish`) — removed placeholder div entirely

The PlayerQuickSheet / player detail drawer shows "More coming soon..." text below the player info. This placeholder copy shouldn't be visible in production — either replace with actual content (stats, activity) or remove entirely.

---

### [BUG-024] Cast "ELIMINATED" badge has no visual container

**Priority**: Low
**Status**: ✅ FIXED (`feature/ui-polish`) — pill badge with pink background matching "YOU" badge pattern

Eliminated players on the Cast tab show an "ELIMINATED" text label but it lacks a background container or badge styling. Compared to the "LIVE" badge on active timeline events (which has a pill background), this feels unfinished. Add a muted red/gray badge container.

---

### [BUG-025] No safe area padding on BroadcastBar for notched iPhones

**Priority**: Low
**Status**: ✅ FIXED (`feature/ui-polish`) — paddingTop uses `max(10px, env(safe-area-inset-top))`

The BroadcastBar at the top of the Vivid shell doesn't account for `env(safe-area-inset-top)` on devices with notches or Dynamic Island. Content may overlap with the system status bar area.

---

### [BUG-026] Dashboard "No events scheduled yet." unclear for ADMIN games

**Priority**: Low
**Status**: Needs copy update

In ADMIN-scheduled games, the dashboard timeline shows "No events scheduled yet." because events are injected manually. This is technically correct but confusing — players don't know events are coming. Could show "Events will appear as the host schedules them" or hide the timeline section entirely in ADMIN mode.

---

### [BUG-027] BroadcastBar currency pills have no labels

**Priority**: Low
**Status**: ✅ FIXED (`feature/ui-polish`) — colored dots replaced with bold "S"/"G" letter labels

The silver and gold indicators on the BroadcastBar show as small colored dots with numbers, but no text labels. New players have no way to know what the dots represent without prior context. Consider adding "Silver" / "Gold" labels, or at minimum distinctive icons (coin, gem).

---

## [PT2-001] Bubble vote tie — no elimination when silver is equal

**Priority**: HIGH
**Status**: Open
**Found**: Playtest 2, Day 1 (2026-03-17)

In BUBBLE voting, when the bottom players have equal votes AND equal silver, no one is eliminated. The tiebreaker logic (lowest silver gets eliminated) either isn't implemented or doesn't handle the case where silver is also tied.

**Expected**: In ANY tie scenario across ALL voting mechanisms, the player with the lowest silver balance should be eliminated. If silver is also tied, use a secondary tiebreaker (e.g., player who joined later, random).

**Scope**: Audit all voting machines (MAJORITY, EXECUTIONER, BUBBLE, PODIUM_SACRIFICE, SECOND_TO_LAST, SHIELD, TRUST_PAIRS, FINALS) for tiebreaker logic.

---

## [PT2-002] Group chat scroll triggers DM navigation

**Priority**: CRITICAL
**Status**: Open — cannot reproduce locally
**Found**: Playtest 2, Day 1 (2026-03-17) — multiple player reports

Players report that scrolling up in the group chat opens a DM with whatever player's message they tap during their scroll gesture. The tap-to-scroll touch event is being interpreted as a tap on the message sender's avatar, which triggers the PlayerDetail → DM navigation flow.

**Player quote**: "If you try and scroll up in the group chat, you will instead open a dm with whatever person's message you tapped in your tap-to-scroll gesture"

**Likely cause**: The `onTapAvatar` handler on `MessageCard` fires on touch start rather than distinguishing between taps and scroll gestures. On mobile, a scroll begins with a touch that could be misinterpreted as a tap if the threshold is too low.

**Possible fixes**:
- Add touch move threshold to `onTapAvatar` — only fire if finger didn't move > N pixels
- Use `onPointerUp` with a `pointerType` check instead of `onClick`
- Add a short delay and cancel if scroll detected
- Check if framer-motion's `whileTap` on MessageCard is intercepting scroll gestures

**Reproduction hint**: May only occur when a cartridge (game/vote/activity) is active and the chat area is shorter, requiring more scrolling.
