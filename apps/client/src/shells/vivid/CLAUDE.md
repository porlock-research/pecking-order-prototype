# Vivid Shell

The primary legacy shell. Vivid is where most playtest feedback was gathered; its conventions inform Pulse's existence but should NOT be ported to Pulse.

## CSS

- Inline styles with `--vivid-*` CSS variables (not Tailwind classes)
- Background system: radial vignette gradients + grid combine in a SINGLE `background-image` declaration. Adding `bg-grid-pattern` alongside `bg-radial-vignette` overwrites one or the other.

## Typography

Quicksand (display) + DM Sans (body)

## Icons

`@solar-icons/react` with `weight="Bold"`

## Motion

Springs from `./springs.ts`

## Z-Index

Overlay stack: dramatic reveals (70) > context menu (60) > drawers/header (50) > toasts (sonner) > base (0).

Note: Pulse has its own `PULSE_Z` contract; this stack is Vivid/Classic only.

## Layout

3 tabs: Chat, Today, People

## Cartridge Presentation

- **Results inline, not fullscreen** — completed activity results render inline in the Today tab
- Fullscreen takeover ONLY for arcade games (they need the canvas) — handled by `CartridgeTakeover` component
