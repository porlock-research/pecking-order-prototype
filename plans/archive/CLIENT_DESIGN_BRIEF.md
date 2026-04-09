# Client App (Immersive Shell) — Design Brief

> Reference implementation: `apps/client/src/shells/immersive/`
> Design tokens: `packages/ui-kit/src/theme.css` + `tailwind-preset.js`
> App-specific styles: `apps/client/src/index.css`

## Mood & Tone

The in-game client is the **live experience** — the lobby's theatrical character-select energy sustained across hours of gameplay. Where the lobby is a short, cinematic onboarding, the client is a persistent social arena: dark, layered, and alive with ambient motion. Think **group chat in a nightclub VIP section** — intimate conversations happening over deep bass, soft neon, and frosted glass surfaces.

Key words: **atmospheric, social, tactile, alive**.

The shell should feel like a premium messaging app that happens to be a game — not a game that happens to have chat. Chat is the primary surface. Everything else (voting, games, activities) interrupts the conversation as dramatic events.

---

## Layout Architecture

### Two-Tab Swipeable Shell

The entire app lives in a fixed viewport with two swipeable tabs. No routing, no page transitions — just lateral swipes between Comms and People.

```
┌──────────────────────────────────────┐
│  Header (shrink-0, z-50)             │  Avatar + PO + expand chevron + online badge
├──────────────────────────────────────┤
│  · ·  Page dots                      │  Gold active dot (layoutId animated)
│                                      │
│  Tab Content (flex-1)                │  Comms: Timeline | People: PeopleList
│                                      │
│                                      │
├──────────────────────────────────────┤
│  FloatingInput (shrink-0)            │  Only on Comms tab
│  Footer (shrink-0, pb-safe)          │  Comms / People tabs + indicator bar
└──────────────────────────────────────┘
```

- Root: `fixed inset-0 flex flex-col overflow-hidden`
- Tab content: `flex-1 overflow-hidden` — each tab scrolls independently
- Footer: respects safe-area inset via `pb-safe`
- Overlays (drawers, context menu, dramatic reveals) float above via z-index

### Overlay Stack (z-index)

| Layer | z-index | Component |
|-------|---------|-----------|
| Dramatic reveals | 70 | Full-screen elimination/winner |
| Context menu | 60 | Long-press emoji/action menu |
| Drawers | 50 | PlayerDrawer, GroupDrawer, PerkDrawer |
| Header | 50 | Fixed top bar |
| Toasts | (sonner) | Top-center notification stack |
| Base content | 0 | Timeline, PeopleList |

---

## Background System

### Radial Vignette

The background uses a **single stacked `background-image`** that combines ambient color gradients with the grid pattern. This replaces the flat `bg-grid-pattern` with depth and warmth.

```css
.bg-radial-vignette {
  background-image:
    radial-gradient(ellipse 60% 50% at 50% 0%, rgba(139,92,246,0.18), transparent 70%),   /* purple bloom top-center */
    radial-gradient(ellipse 50% 40% at 80% 80%, rgba(236,72,153,0.12), transparent 70%),   /* pink warmth lower-right */
    radial-gradient(ellipse 50% 40% at 15% 75%, rgba(16,185,129,0.10), transparent 70%),   /* green accent lower-left */
    linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),                 /* grid vertical */
    linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px);                /* grid horizontal */
  background-size: 100% 100%, 100% 100%, 100% 100%, 50px 50px, 50px 50px;
}
```

The radial gradients are painted once (zero ongoing GPU cost). They provide enough color variation for `backdrop-filter: blur()` on glass surfaces to produce visible frosting.

**Important**: Because both the vignette and the grid use `background-image`, they must be combined in a single declaration. Adding `bg-grid-pattern` alongside `bg-radial-vignette` will overwrite one or the other.

---

## Glass Morphism

Glass is the signature material of the immersive shell. Three tiers of frosted glass are used depending on context:

### `.glass-card` — Structural panels (PeopleList cards)

```css
background: rgba(255,255,255,0.07);
border: 1px solid rgba(255,255,255,0.08);
backdrop-filter: blur(8px);
box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
```

Used for: alive player cards, group DM cards. Subtle — the card should feel like frosted glass over the background, not a solid surface.

### `.bubble-glass` — Chat bubbles (received messages)

```css
background: rgba(255,255,255,0.10);
border: 1px solid rgba(255,255,255,0.10);
backdrop-filter: blur(8px);
box-shadow:
  inset 0 1px 0 rgba(255,255,255,0.10),
  0 2px 8px rgba(0,0,0,0.15);
```

Used for: other players' chat bubbles. Slightly more opaque + a subtle drop shadow to float the bubble off the timeline. The inset highlight sells the glass illusion.

### Drawer glass — Floating sheets (PlayerDrawer, GroupDrawer, PerkDrawer)

```
bg-skin-fill/95 backdrop-blur-xl
```

Used for: all vaul drawers. Nearly opaque but the `backdrop-blur-xl` bleeds through enough content behind to feel like a floating sheet rather than a solid panel. The 95% opacity is deliberate — fully opaque kills the depth illusion, anything below 90% makes text hard to read.

### When NOT to use glass

- Own chat bubbles: solid `bg-skin-pink` — your messages should feel assertive, not transparent
- Game Master messages: solid `bg-skin-gold/15` with gold left border — authority, not glass
- The header: `bg-skin-panel/90 backdrop-blur-md` — lighter blur, more opaque (it's always visible, heavy blur would be distracting)
- Eliminated player cards: `bg-skin-glass` (no backdrop-filter) — they're faded out anyway

---

## Color Usage

### Role Assignments

| Color | Token | Role in client |
|-------|-------|----------------|
| Gold | `skin-gold` | Your identity, currency, vote cartridges, Game Master, authority |
| Pink | `skin-pink` | Social actions (send, DM), your chat bubbles, prompt cartridges, CTA buttons |
| Green | `skin-green` | Online status, alive count, game cartridges, success states |
| Red | `skin-danger` | Eliminations, error toasts, eliminated player badges |
| Dim | `skin-dim` | Secondary text, timestamps, offline status, metadata |
| White | `skin-base` | Primary body text |

### Accent Color Mapping

The three cartridge types each own a color. This color is used consistently across the cartridge wrapper glow, accent strips, return-to-action pill, and timeline system events:

| Cartridge | Color | Glow | Strip class |
|-----------|-------|------|-------------|
| Voting | Gold | `rgba(251,191,36,0.20)` | `.cartridge-strip-voting` |
| Game | Green | `rgba(16,185,129,0.20)` | `.cartridge-strip-game` |
| Prompt | Pink | `rgba(236,72,153,0.20)` | `.cartridge-strip-prompt` |

### Opacity Conventions

- Panel backgrounds: `/80` to `/95` with blur
- Card backgrounds: `/06` to `/10` (glass tiers)
- Borders: `white/[0.06]` (subtle) to `white/[0.10]` (visible)
- Inactive text: `/50` to `/60`
- Timestamps: `/50` on dim

---

## Typography

Follows the same font families as the lobby. The key difference is **scale** — the client uses smaller, denser text because it's a persistent messaging UI, not a cinematic onboarding flow.

### Hierarchy

| Level | Classes | Example |
|-------|---------|---------|
| Section header | `text-base font-bold text-skin-base uppercase tracking-wider font-display` | PEOPLE |
| Player name | `font-bold text-base truncate` | Countess Snuffles |
| Chat message | `text-base leading-relaxed` | hey what's the plan |
| Sender label | `text-sm font-bold text-skin-gold` | Skyler Blue |
| System event | `text-[10px] font-mono uppercase tracking-wider` | SKYLER BLUE WAS ELIMINATED |
| Timestamp | `text-[9px] font-mono text-skin-dim/50` | 01:24 PM |
| Badge label | `text-[9px] font-mono uppercase` | YOU / ELIMINATED |
| Currency | `font-mono font-bold text-sm` | 42 |
| Metadata | `text-[10px] font-mono text-skin-dim` | 3 members |
| Chars remaining | `font-mono text-[10px] text-skin-dim` | 847/1200 |

### Key Rules

- **Chat text is `text-base`** — never smaller. This is a messaging app; readability at arm's length is non-negotiable.
- **Player names are always `font-bold`** — they anchor the eye in a stream of messages.
- **Gold for sender names in others' messages** — distinguishes "who said this" from "what they said".
- **Mono for all numbers and metadata** — currency, character counts, timestamps, online counts.
- **Display font only for section headers** (PEOPLE, COMMS) — not for conversational UI.

---

## Avatar System

Avatars use the `PersonaAvatar` component which renders headshot images with a letter-initial fallback. Sizes are intentionally varied to create visual hierarchy.

### Size Scale

| Context | Size | Notes |
|---------|------|-------|
| Header (your avatar) | 36px | Gold halo shadow |
| Chat bubbles | 40px | Only on first message in group |
| Chat spacer (no avatar) | w-10 (40px) | Maintains alignment |
| PeopleList — You / Alive | 56px | Largest in list |
| PeopleList — Eliminated | 52px | Slightly smaller, grayscale |
| PeopleList — Group stack | 36px each | In 52×52 container, 12px offset |
| PlayerDrawer / GroupDrawer | 72px | Profile-photo scale |
| Typing indicator | 32px | In FloatingInput |
| Typing indicator (drawer) | 24px | Smaller in drawer context |

### Visual Treatments

- **Online indicator**: `isOnline` prop on `PersonaAvatar`. When `true`: `ring-2 ring-skin-gold` + `shadow-[0_0_6px_rgba(251,191,36,0.3)]` (gold ring with warm glow). When `false`: `ring-1 ring-white/10` (subtle offline ring). Applied consistently across Header, PeopleList, PlayerDrawer, ChatBubble, and typing indicator.
- **Eliminated**: `grayscale` filter + skull overlay (scales with avatar size via `getSkullSize()`).
- **Group stacks**: Two avatars offset by 12px diagonally, each with `ring-2 ring-skin-deep` to separate.

---

## Spring Physics & Motion

All animations use Framer Motion with shared spring configs from `springs.ts`.

### Spring Presets

| Name | Stiffness | Damping | Mass | Use case |
|------|-----------|---------|------|----------|
| `button` | 400 | 17 | — | Quick feedback on taps |
| `snappy` | 500 | 25 | — | Header expand, tab indicator, tooltips |
| `bouncy` | 300 | 12 | — | Cartridge entry, dramatic reveals, FAB |
| `gentle` | 200 | 20 | — | Chat bubble entrance, fade-ins |
| `swipe` | 300 | 30 | 0.8 | Tab swipe transitions (low mass = responsive) |

### Tap Presets

| Name | Scale | Use case |
|------|-------|----------|
| `button` | 0.95 | Standard buttons |
| `card` | 0.98 | Player cards, group cards |
| `bubble` | 0.97 | Chat bubble press |
| `fab` | 0.90 | Send button, perk FAB (most aggressive) |

### Motion Rules

1. **Chat bubbles enter from below**: `initial={{ opacity: 0, y: 8, scale: 0.97 }}` with `SPRING.gentle`
2. **Cards enter with stagger**: `delay: i * 0.02` per item in lists
3. **Cartridges enter with bounce**: `initial={{ opacity: 0, y: 20, scale: 0.96 }}` with `SPRING.bouncy`
4. **Drawers use vaul's built-in spring** — drag handle for dismiss, spring snap back
5. **Tab swipe uses direction-aware variants**: enter from ±100%, exit to ∓100%
6. **Dramatic reveals scale in**: `scale: 0 → 1` with `SPRING.bouncy`
7. **Never animate layout on scroll** — only on discrete state changes (new message, tab switch, drawer open)

---

## Chat Timeline

The timeline is the heart of the app. It's a scrollable list of chat bubbles, system events, and inline cartridge panels.

### Message Grouping

Messages from the same sender are grouped: only the first shows the avatar and sender name. Subsequent messages in the group show only the bubble with a spacer where the avatar would be. A new group starts when the sender changes or a system event intervenes.

### Scroll Behavior

- **Auto-scroll on new messages** — but only if the user is within 100px of the bottom. If they've scrolled up to read history, new messages don't yank them down.
- **Return-to-action pill** — when an active cartridge exists and the user has scrolled away, a floating pill appears: "Return to Vote" / "Return to Game" / "Return to Activity". Color-coded per cartridge type. Tapping scrolls to the cartridge.
- **Jump to latest** — when no cartridge is active and the user is scrolled up, a neutral "Jump to latest" pill appears instead.

### Inline Cartridges

Voting panels, game panels, and prompt panels render inline in the timeline, wrapped in `CartridgeWrapper`. The wrapper provides:

- Color-coded border + `glow-breathe` animation (pulsing box-shadow)
- `backdrop-blur-sm` for glass depth
- `SPRING.bouncy` entry animation

---

## Drawers

All detail views use vaul `Drawer` components — bottom sheets that slide up over the content. This is a deliberate pattern: **the timeline never navigates away**. Everything overlays it.

### Shared Drawer Anatomy

```
┌────────────────────────────────────┐
│         ━━━━━━━━━━━━               │  Drag handle (w-12, glow shadow)
│                                    │
│  [Avatar]  Name / Members          │  Header with avatar(s) + metadata
│            status · currency       │
│                            chars   │  Chars remaining counter
├────────────────────────────────────┤
│                                    │
│  Messages (flex-1, scroll)         │  ChatBubble components
│                                    │
├────────────────────────────────────┤
│  [💰]  [  input field  ]  [Send]  │  Input bar (backdrop-blur)
└────────────────────────────────────┘
```

- Height: `h-[65vh] max-h-[85vh]`
- Background: `bg-skin-fill/95 backdrop-blur-xl`
- Drag handle: `w-12 h-1 rounded-full bg-white/20 shadow-[0_0_8px_rgba(255,255,255,0.1)]`
- Overlay: `bg-black/60`

### PlayerDrawer (1-on-1 DM)

- Avatar: 72px with online dot (w-4)
- Shows player name, status, online/offline, currency
- Silver transfer UI (expandable)
- Uses `usePlayerTimeline` hook for message history

### GroupDrawer (Group DM)

- Stacked avatars (36px, 52×52 container) matching PeopleList style
- Member names + count
- No silver transfer (group DMs are chat-only)
- Typing indicator with avatar + animated dots

### PerkDrawer

- Same glass treatment as other drawers
- Three perk cards with icon, description, cost
- SPY_DMS: target picker (list of alive players)
- Results delivered via toast, not inline

---

## People List

The People tab is a scrollable roster with sections:

### Sections (top to bottom)

1. **"You" card** — pinned at top, gold border, `animate-glow-breathe` pulsing box-shadow. Shows DM stats (chars left, partners left) and currency.
2. **Groups** — collapsible section with group DM threads. Each card shows stacked avatars + last message preview. Tap opens GroupDrawer.
3. **Alive** — alphabetical list with count badge `(N)` in green. Each card shows avatar (56px), name, currency, last DM preview. Tap opens PlayerDrawer.
4. **Eliminated** — collapsible (collapsed by default), count badge in red. Smaller avatars (52px), grayscale, 50% opacity.

### Card Treatment

- You card: `bg-skin-gold/10 border border-skin-gold/30` (warm, highlighted)
- Alive / Group cards: `.glass-card` (frosted, neutral)
- Eliminated cards: `bg-skin-glass border border-white/[0.04] opacity-50` (faded, no blur)

---

## Notifications

### Sonner Toasts

All transient notifications use `sonner` toasts positioned `top-center`. These replace inline banners for:

- DM rejections (error toast)
- Silver transfers (💰 icon)
- Game rewards (success toast)
- Voting phase changes (🗳️ icon)
- Night phase (🌙 icon)
- Perk results (custom rich toast for SPY_DMS intel)

Toast styling matches the shell theme:
```
background: var(--po-bg-panel)
color: var(--po-text)
border: 1px solid rgba(255,255,255,0.1)
```

### Dramatic Reveals

Full-screen overlays for high-drama moments. These are **not** toasts — they demand attention.

**Elimination**: Skull icon (48px) + red glow pulse + shake animation + player name. Persists until tap to dismiss.

**Winner**: Crown icon (56px) + gold glow pulse + confetti (canvas-confetti from corners) + player name + gold payout. Manual dismiss only.

Both use localStorage (`po-reveals-${gameId}`) to track seen reveals and queue unseen ones on reconnect.

---

## Interactive Patterns

### Long-Press → Context Menu

On other players' chat bubbles, a 500ms long-press triggers the context menu with three actions: Message, Send Silver, Spy DMs. The menu appears at the press coordinates with viewport bounds checking.

### Tap → Reply

A short tap on another player's bubble sets it as a reply target. A pink-bordered preview appears above the input field with a dismiss button.

### Emoji Reactions

Long-press also opens a 6-emoji reaction bar (💀👀🔥🐔👑😂). Reactions are local-only — no server persistence. Selecting an emoji triggers a float-up animation.

### Swipe → Tab Switch

Horizontal swipe (delta 50px) switches between Comms and People. Left-edge 30px is excluded (iOS back gesture zone). Touch-only, no mouse drag.

---

## Performance Guidelines

1. **One blur layer per visible card** — `.glass-card` and `.bubble-glass` each create a GPU compositing layer. Acceptable in lists with <20 visible items.
2. **`backdrop-blur-xl` only on overlays** — drawers and the input bar. Never on scrollable list items.
3. **`backdrop-blur-sm` on CartridgeWrapper** — only one active cartridge at a time, minimal cost.
4. **Radial vignette is paint-once** — no animation, no ongoing GPU cost.
5. **`glow-breathe` is CSS animation** — runs on compositor thread, doesn't trigger layout.
6. **Lazy-loaded shell** — `ImmersiveShell` is code-split via the shell registry (`?shell=immersive`).
7. **Framer Motion `layoutId`** — used sparingly: tab dots, footer indicator. Not on list items (too many).

---

## Technical Gotchas

### Tailwind opacity modifiers don't work with CSS custom property colors

All `skin-*` colors resolve to CSS custom properties (e.g. `ring-skin-gold` → `var(--po-gold)` → `#fbbf24`). Tailwind's opacity modifier syntax (`/70`, `/50`, etc.) requires colors to be in decomposed channel format (`251 191 36`) to generate valid `rgb(R G B / alpha)`. When the color is a hex string wrapped in `var()`, the modifier produces invalid CSS like `rgb(#fbbf24 / 0.7)` which the browser silently ignores — **the entire declaration is dropped with no visual output**.

**Rule**: Never use opacity modifiers on `skin-*` ring/text/bg/border colors. Use the color at full opacity, or use an arbitrary value with explicit rgba:

```
❌  ring-skin-gold/70        → invalid CSS, silently fails
✅  ring-skin-gold            → full opacity, works
✅  ring-[rgba(251,191,36,0.7)] → arbitrary value, works
```

Standard Tailwind colors (`white`, `black`, `red-500`, etc.) **do** support opacity modifiers because they're defined in channel format internally. So `ring-white/10` and `bg-black/60` are fine.

---

## Design Principles

1. **Chat is king**. The timeline is the primary surface. Cartridges, drawers, and overlays interrupt it — they never replace it. The user should always feel one swipe away from the conversation.

2. **Glass creates hierarchy**. Opaque panels (header, own bubbles) are foreground. Frosted glass (cards, received bubbles) is midground. The radial vignette background is deep background. Three layers, three levels of blur.

3. **Gold is you, pink is action**. Your avatar has a gold halo. Your "You" card glows gold. Currency is gold. But the send button is pink. DM actions are pink. Your chat bubbles are pink. Gold says "look at this". Pink says "do this".

4. **Drawers, not navigation**. Every detail view (player profile, group thread, perks) is a bottom sheet. The user is never "navigated away" from the main experience — they pull up a sheet, interact, dismiss it, and the timeline is exactly where they left it.

5. **Motion earns attention**. `glow-breathe` on the active cartridge and "You" card. `animate-pulse-live` on online dots. Dramatic reveal shake + glow. Everything else is still. If everything moves, nothing stands out.

6. **Ambient texture, not decoration**. The radial vignette, grid pattern, and glass highlights create atmosphere. But no ornamental borders, no drop-shadow cards, no gradients-for-gradients-sake. The personas and conversation are the content — the shell just sets the mood.

7. **Consistent tactile feedback**. Every tappable surface responds to touch: `TAP.button` for buttons, `TAP.card` for cards, `TAP.fab` for the send button. The scale values are tuned per surface — larger surfaces (cards) need less squish (0.98) than small targets (FAB, 0.90).

8. **Mobile-first, touch-first**. Swipe to change tabs. Long-press for context. Drag to dismiss drawers. All interactions are designed for thumbs on a phone. Desktop mouse support exists but is not the design target.
