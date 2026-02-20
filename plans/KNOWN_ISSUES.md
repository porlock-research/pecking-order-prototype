# Known Issues

## [BUG-001] Game Master DMs missing from SYNC

DMs from the Game Master no longer appear in the sync message. Noticed after immersive shell visual polish changes — unclear if related to the shell changes or a pre-existing server-side issue. Needs investigation.

**Status**: Not yet investigated

## [BUG-002] Elimination reveal auto-dismisses

The DramaticReveal full-screen overlay for eliminations dismisses automatically (3s timer). It should persist until the user manually dismisses it.

**Status**: Not yet investigated

## [BUG-003] Header day number off by one

Header shows `DAY {dayIndex + 1}` but `dayIndex` is already 1-based from the server, so day 1 displays as "DAY 2". The `+ 1` in `Header.tsx` should likely be removed.

**Status**: Not yet investigated

## [BUG-004] Cartridge enter animation missed on late join

The CartridgeWrapper bouncy entry animation only plays if the client is already loaded when the cartridge spawns. If a player opens the client after the cartridge is active (the majority case — push notification → open app), the cartridge renders instantly with no animation. The enter animation should trigger on first render regardless of when the player connects.

**Status**: Not yet investigated

## [BUG-011] Toast notifications used redundantly, need intentional strategy

Toasts fire for ticker events that are already visible in the timeline (silver transfers, phase changes, game rewards). This creates duplicate information and notification fatigue. Need a clear policy for when toasts are appropriate — e.g. only for targeted events the player might miss (DM rejections, perk results), not for broadcast events already shown inline.

**Status**: Not yet investigated

## [BUG-010] Lobby admin panel shows all players as eliminated

The admin panel in the lobby always displays players with eliminated status regardless of their actual status. Likely a mapping/projection issue in the admin game state view.

**Status**: Not yet investigated

## [BUG-009] Irrelevant ticker messages shown in 1-on-1 DMs

The DM timeline shows ticker/system events that are unrelated to the two players in the conversation. The intent is for DM history to include only events where both players are involved (e.g. silver transfers between them, votes involving both). A ticker message should only appear in a DM if both the viewer and the DM partner are in the event's `involvedPlayerIds`.

**Status**: Not yet investigated

## [BUG-008] Group chat creation UI needs redesign

The current NewGroupPicker is reused from the classic shell and doesn't match the immersive shell's design language. Needs a native immersive UI pattern for selecting members and creating group DMs — likely a drawer or inline picker that feels consistent with PlayerDrawer/GroupDrawer.

**Status**: Not yet investigated

## [BUG-007] Online indicator too subtle and inconsistently shown

The small green dot for online status is easy to miss. Should be more prominent — e.g. a gold ring around the avatar when online. Also needs to be applied consistently everywhere an avatar appears (PeopleList, chat bubbles, drawers, typing indicator) — currently only shown in PeopleList cards and PlayerDrawer.

**Status**: Not yet investigated

## [BUG-006] Immersive header layout is cluttered and avatar misplaced

The expanded header view feels disorganized — no clear visual hierarchy or governing layout scheme. The user avatar should be on the right side of the header (not left), and the expanded section needs a cleaner information layout.

**Status**: Not yet investigated

## [BUG-005] Completed phase timeline cards lack visual polish (immersive shell)

The timeline cards for completed phases (voting results, game results, prompt results) use plain/minimal styling that doesn't match the premium aesthetic of the live cartridge panels. They should carry the same visual language — accent-colored borders, glass backgrounds, subtle glow — so the timeline reads as a rich history of dramatic events, not a flat log.

**Status**: Not yet investigated
