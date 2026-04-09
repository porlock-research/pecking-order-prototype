# Pecking Order -- Design Brief

> Living source of truth for the visual language across lobby and client apps.

## Core Aesthetic

**Reality TV meets live broadcast.** Deep purples, gold accents, hot pink highlights,
glassmorphism panels, and constant ambient motion. The UI should feel like a live
television event -- never static, always breathing.

## Principles

1. **No emojis** -- strictly text-based UI. Use text labels, monospace glyphs (`*`, `#`, `+`),
   or CSS shapes (circles, rings, gradient strips) for all iconography.
2. **Live event energy** -- subtle ambient animations (breathing glows, pulsing dots,
   shimmer bars) that signal "something is happening right now."
3. **Glassmorphism everywhere** -- panels float over blurred backgrounds with
   `backdrop-filter: blur()` and translucent fills.
4. **Per-mechanic theming** -- each voting type gets a unique accent color and gradient
   strip so players instantly recognize the current game mode.
5. **Dramatic reveals** -- eliminations and results use scale/glow animations, not
   just color changes.

## Color Palette

| Token             | Hex / Value           | Usage                          |
|-------------------|-----------------------|--------------------------------|
| `--po-bg-deep`    | `#2c003e`             | App background                 |
| `--po-bg-panel`   | `#4c1d95`             | Card/panel surfaces            |
| `--po-gold`       | `#fbbf24`             | Primary accent, gold actions   |
| `--po-pink`       | `#ec4899`             | Secondary accent, shields      |
| `--po-danger`     | `#ef4444`             | Eliminations, warnings         |
| `--po-info`       | `#818cf8`             | Bubble mechanic, informational |
| `--po-green`      | `#10b981`             | Trust, positive actions        |
| `--po-orange`     | `#f97316`             | Podium, caution states         |
| `--po-text-dim`   | `#d8b4fe`             | Muted text, second-to-last     |

## Vote Type Accent Map

| Type            | Accent Color  | Strip Class            |
|-----------------|---------------|------------------------|
| MAJORITY        | Gold          | `vote-strip-majority`  |
| EXECUTIONER     | Red (danger)  | `vote-strip-executioner` |
| BUBBLE          | Indigo (info) | `vote-strip-bubble`    |
| SHIELD          | Pink          | `vote-strip-shield`    |
| PODIUM_SACRIFICE| Orange        | `vote-strip-podium`    |
| SECOND_TO_LAST  | Dim purple    | `vote-strip-second`    |
| TRUST_PAIRS     | Green         | `vote-strip-trust`     |

## Component Patterns

### Vote Panel
- Outer: `vote-panel` class (glass bg, blur, subtle border)
- Top: 4px accent gradient strip (`vote-strip-{type}`)
- Content: padded inner container with `space-y-3`

### Player Cards (interactive)
- Base: `bg-skin-deep/40 border border-white/[0.06] rounded-xl`
- Hover: `hover:border-white/20`
- Selected: accent border + accent bg/20 + ring
- Disabled: `opacity-40 grayscale`
- Vote count: pill badge with accent bg

### Elimination Reveal
- Card: `elimination-reveal` animation (scale + red glow)
- "ELIMINATED" tag: `animate-flash-update`
- Results wrapper: `animate-slide-up-in`

## Animation Inventory

| Class             | Duration | Use Case                    |
|-------------------|----------|-----------------------------|
| `pulse-live`      | 2s loop  | Live indicator dots         |
| `shimmer`         | 3s loop  | Loading text, gold accents  |
| `glow-breathe`    | 3s loop  | Active panels, admin button |
| `spin-slow`       | 8s loop  | Spinners, calculating       |
| `slide-up-in`     | 300ms    | Results reveal              |
| `badge-pop`       | 400ms    | Vote counts, status badges  |
| `flash-update`    | 500ms    | Breaking news, new votes    |
| `fade-in`         | 200ms    | Tab transitions             |
| `elimination-reveal` | 600ms | Eliminated player card      |
| `count-pop`       | 300ms    | Vote count increment        |

## Typography

- **Display** (`font-display`): Poppins -- titles, headers, dramatic labels
- **Body** (`font-body`): Inter -- chat messages, descriptions
- **Mono** (`font-mono`): JetBrains Mono -- state labels, counts, IDs
- **text-glow**: Gold text shadow for emphasis on key labels
