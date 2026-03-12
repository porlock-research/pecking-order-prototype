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
**Status**: Not yet investigated

Timeline cards for completed phases (voting results, game results, prompt results) use plain/minimal styling that doesn't match the premium aesthetic of the live cartridge panels. They should carry the same visual language — accent-colored borders, glass backgrounds, subtle glow.

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
**Status**: Constants ready, UI integration missing

`VOTE_TYPE_INFO` constants added for all 9 vote types (PT1-UX-004), but no cartridge UI shows them. Each voting cartridge should display a collapsible "How this works" section or brief intro explaining the vote mechanism and consequences.

**Relevant store**: `VOTE_TYPE_INFO` in shared constants

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
**Status**: Data available, UI missing

`playerActivity` field added to SYNC payload and `selectPlayerActivity` selector created (PT1-UX-009), but no UI surfaces this data. Could show on Cast tab cards or player profile sheets.
