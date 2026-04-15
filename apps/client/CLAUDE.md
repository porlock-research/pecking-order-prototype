# Client (React SPA)

## Design Intent

The client is a premium messaging app that happens to be a game — not a game with chat. Chat is the primary surface. Everything else (voting, games, activities) interrupts the conversation as dramatic events. The mood is atmospheric, social, tactile, alive. Think group chat in a nightclub VIP section.

## Architecture

- **State**: Zustand store (`src/store/useGameStore.ts`). `playerId` is NOT set from SYNC — must call `setPlayerId()` explicitly.
- **WebSocket**: PartySocket via `useGameEngine` hook. Connects to `/parties/game-server/{gameId}`.
- **Shells**: `ShellLoader` lazy-loads from `shells/registry.ts`. Select via `?shell=classic|immersive|vivid|pulse`. Each shell documents its own conventions in `src/shells/<name>/CLAUDE.md`.

## Shell-Agnostic UI Rules

- **No emoji** — use each shell's icon library. Emoji look inconsistent across platforms.
- **Persona avatars always visible** — never replace player avatars with status icons. Use overlay indicators (badges, borders, opacity) on the avatar instead.
- **Cards must be consistent** — across all states (upcoming, live, completed). Don't make upcoming cards look disabled.

## Vaul Portal Gotcha

`Drawer.Portal` renders outside shell DOM tree — CSS custom properties don't resolve inside it. Use explicit hex values inside portals.

## CSS Stack

Tailwind + `@pecking-order/ui-kit` preset is available. Individual shells opt in (Classic) or define their own style conventions with CSS variables (Vivid, Pulse). See each shell's CLAUDE.md.

## Libraries

- **Icons**: per-shell choice (see each shell's CLAUDE.md)
- **Motion**: framer-motion
- **Toasts**: sonner
- **Drawers**: vaul (watch for the Portal CSS-var gotcha above)

## PWA

vite-plugin-pwa, custom service worker (`src/sw.ts`), autoUpdate strategy.

## Error Reporting

Sentry (`@sentry/react`), tunneled via sentry-tunnel worker.
