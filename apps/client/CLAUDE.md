# Client (React SPA)

## Design Intent

The client is a premium messaging app that happens to be a game — not a game with chat. Chat is the primary surface. Everything else (voting, games, activities) interrupts the conversation as dramatic events. The mood is atmospheric, social, tactile, alive. Think group chat in a nightclub VIP section.

## Architecture

- **State**: Zustand store (`src/store/useGameStore.ts`). `playerId` is NOT set from SYNC — must call `setPlayerId()` explicitly.
- **WebSocket**: PartySocket via `useGameEngine` hook. Connects to `/parties/game-server/{gameId}`.
- **Shells**: `ShellLoader` lazy-loads from `shells/registry.ts`. Select via `?shell=immersive|classic|vivid`.

## Shell Conventions

**Vivid shell** (primary):
- Inline styles with `--vivid-*` CSS variables (NOT Tailwind classes)
- `@solar-icons/react` icons with `weight="Bold"`
- Springs from `shells/vivid/springs.ts`

**Classic shell**:
- Tailwind classes
- lucide-react icons

**Vaul Portal trap**: `Drawer.Portal` renders outside shell DOM tree — CSS custom properties don't resolve. Use explicit hex values inside portals.

## UI Rules

- **No emoji** — use `@solar-icons/react` (vivid) or lucide-react (classic). Emoji look inconsistent across platforms.
- **Persona avatars always visible** — never replace player avatars with status icons. Use overlay indicators (badges, borders, opacity) on the avatar instead.
- **Results inline, not fullscreen** — completed activity results render inline in the Today tab. Fullscreen takeover ONLY for arcade games (they need the canvas).
- **Cards must be consistent** — across all states (upcoming, live, completed). Don't make upcoming cards look disabled.

## CSS

Tailwind + `@pecking-order/ui-kit` preset. Shell-specific CSS variables (e.g., `--vivid-*`).

**Overlay z-index stack**: dramatic reveals (70) > context menu (60) > drawers/header (50) > toasts (sonner) > base (0).

**Background system**: Radial vignette gradients + grid use single `background-image` declaration. Adding `bg-grid-pattern` alongside `bg-radial-vignette` overwrites one or the other.

## Libraries

- **Icons**: `@solar-icons/react` (vivid), lucide-react (classic/admin)
- **Motion**: framer-motion
- **Toasts**: sonner
- **Drawers**: vaul

## PWA

vite-plugin-pwa, custom service worker (`src/sw.ts`), autoUpdate strategy.

## Error Reporting

Sentry (`@sentry/react`), tunneled via sentry-tunnel worker.
