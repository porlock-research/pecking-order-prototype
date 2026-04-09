# Lobby & Invite Flow — Design Brief

> Reference implementation: `apps/lobby/app/join/[code]/page.tsx`
> Design tokens: `packages/ui-kit/src/theme.css` + `tailwind-preset.js`

## Mood & Tone

Reality TV elimination game. The visual language sits between **premium mobile gaming** and **late-night reality TV**: dark, saturated, high-contrast, a little dramatic. Think Love Island app meets fighting-game character select. Playful but polished — never corporate, never casual.

Key words: **immersive, confident, theatrical, mobile-first**.

---

## Layout Principles

### Viewport-Locked, No Scroll (Step 1 Pattern)

The primary layout is a **full-viewport flex column** that fills exactly the screen height. Content adapts to the device — no vertical scrolling on the main interaction screens.

```
┌──────────────────────────────┐
│  Header (flex-shrink-0)      │  PECKING ORDER + invite code
│  Nav/Steps (flex-shrink-0)   │  Step indicator dots
│  Title (flex-shrink-0)       │  Step title (gold, uppercase)
│                              │
│  Hero / Content (flex-1)     │  Fills remaining space
│                              │
│  Thumbnails (flex-shrink-0)  │  Fixed-height selection strip
├──────────────────────────────┤
│  Bottom Bar (flex-shrink-0)  │  Pinned action buttons + errors
└──────────────────────────────┘
```

- Outer container: `h-screen h-dvh flex flex-col overflow-hidden`
- Content area: `flex-1 min-h-0 flex flex-col` with `max-w-lg mx-auto px-4`
- Content top padding: `pt-[max(0.5rem,env(safe-area-inset-top))]` — respects device safe area (notch/dynamic island), minimal otherwise
- Hero/main visual: `flex-1 min-h-0` — adapts to available space
- Bottom bar: `flex-shrink-0` — always visible, never pushed offscreen
- Fallback: Steps with form content (bio, confirmation) use `overflow-y-auto` as a safety valve

### Safe Area Insets

The root layout exports `viewport-fit: "cover"` via Next.js `Viewport` config. This enables `env(safe-area-inset-*)` CSS values on iOS devices with notch, dynamic island, or home indicator. Content top padding and bottom bar bottom padding use `max()` with safe-area insets to ensure nothing is obscured by device chrome.

### Compact Vertical Spacing

Every pixel of vertical space matters on small mobile viewports. Spacing between fixed-height elements (header, step indicator, section titles) is kept tight — `gap-2`, `mt-2` — to maximize the flex-1 hero/content area. Avoid `mt-4` or larger margins between stacked fixed-height elements.

### Why This Matters

Mobile keyboards, browser chrome, and varying device heights make fixed-pixel layouts fragile. The flex approach guarantees buttons are always reachable and the hero image scales gracefully from a 568px iPhone SE to a 932px iPhone 15 Pro Max.

### Max Width

All content is constrained to `max-w-lg` (32rem / 512px). On desktop, this creates a phone-like centered column. On mobile, `px-4` provides 16px side padding.

---

## Background System

Every screen uses a **layered background stack** (all `position: absolute`, `pointer-events-none`):

1. **Base**: `bg-skin-deep bg-grid-pattern` — deep purple (#2c003e) with subtle grid overlay
2. **Blurred hero** (optional): Full-body persona image, crossfades via `AnimatePresence` when the active persona changes. Blur and opacity vary by context (see table below).
3. **Dark overlay**: `bg-skin-deep/60` — ensures text is always readable over the blurred hero
4. **Radial glow**: `bg-gradient-radial from-skin-panel/40 to-transparent` — centered 800x800 vignette that adds depth

The content sits at `z-10` above all background layers. The bottom bar sits at `z-20`.

**Per-step background treatment** (invite wizard):

| Context | Blur | Opacity | Persona source |
|---------|------|---------|----------------|
| Character select (step 1) | `blur(10px)` | 0.55 | Active persona (changes on browse) |
| Bio authoring (step 2) | `blur(2px)` | 1.0 | Selected/locked-in persona |
| Confirmation (step 3) | `blur(8px)` | 0.45 | Selected/locked-in persona |
| Waiting room | `blur(2px)` | 0.8 | Player's own persona |

The CSS `filter` is applied via inline `style` with a `transition-[filter] duration-500` class for smooth blur changes between steps.

**When to use the blurred hero**: Any screen where a persona is contextually relevant — character select, bio authoring, confirmation, and the waiting room. Not for utility screens (login, admin).

---

## Color Usage

### Primary Palette

| Token | Hex | Role |
|-------|-----|------|
| `skin-deep` | `#2c003e` | Page background, overlays, gradients |
| `skin-panel` | `#4c1d95` | Card backgrounds (at /30 opacity) |
| `skin-gold` | `#fbbf24` | Primary accent — titles, highlights, active states |
| `skin-pink` | `#ec4899` | Primary CTA buttons, destructive warnings |
| `skin-base` | `#ffffff` | Body text, button text on colored bg |
| `skin-dim` | `#d8b4fe` | Secondary text, labels, inactive states |
| `skin-input` | `#5b21b6` | Input backgrounds, skeleton placeholders |

### Opacity Conventions

- Backgrounds: `/30` for cards, `/60` for inputs, `/20` for skeletons
- Text: `/80` for descriptions, `/60` for hints, `/40` for disabled/inactive
- Borders: `border-skin-base` (which is `rgba(255,255,255,0.1)`)

**Important: Tailwind `/opacity` modifier caveat.** The skin tokens are defined as raw `var(--po-*)` CSS custom properties. Tailwind's `/80` opacity modifier (e.g., `bg-skin-deep/80`) requires colors in `rgb()` channel format to work — with plain `var()` it silently fails and the browser falls back to transparent/white. For reliable opacity on skin tokens, use inline `style={{ backgroundColor: 'rgba(44, 0, 62, 0.8)' }}` or define the color+opacity as a dedicated token.

### Accent Rules

- **Gold** (`skin-gold`): Titles, active step indicators, active thumbnail rings, invite codes, stereotypes. The "spotlight" color.
- **Pink** (`skin-pink`): Primary action buttons ("Lock In", "Join Game"). The "do something" color.
- **Gold button** (`bg-skin-gold text-skin-deep`): Secondary progression ("Continue"). Used when the action advances but isn't the final commitment.
- **Green** (`skin-green`): Success states only ("You've Already Joined").
- **Dim/ghost buttons**: `border border-skin-base text-skin-dim` — for back/secondary actions.

---

## Typography

### Hierarchy

| Level | Classes | Example |
|-------|---------|---------|
| Page title | `text-3xl md:text-5xl font-display font-black tracking-tighter text-skin-gold text-glow` | PECKING ORDER |
| Step title | `text-base font-display font-black text-skin-gold text-glow uppercase tracking-widest` | CHOOSE YOUR PERSONA |
| Step subtitle | `text-xs font-display font-bold text-skin-dim uppercase tracking-widest` | WRITE YOUR CATFISH BIO |
| Step hint | `text-xs text-skin-dim/60` | This is what other players will see |
| Hero name | `text-2xl font-display font-black text-skin-base text-glow leading-tight` | Sheila Bear |
| Hero stereotype | `text-xs font-display font-bold text-skin-gold uppercase tracking-[0.2em]` | THE MOMAGER |
| Hero description | `text-sm text-skin-dim/80 leading-snug` | She didn't come to make friends... |
| Body text | `text-sm text-skin-base` | Bio content, instructions |
| Mono labels | `text-xs font-mono text-skin-dim/40` | Character counts, metadata |
| Mono accent | `text-sm font-mono text-skin-dim` | Invite codes |

### Font Families

- `font-display` (Poppins): All headings, titles, button labels, names, stereotypes. Bold to black weight.
- `font-body` (Inter): Body text, descriptions, form content. Regular to semibold.
- `font-mono` (JetBrains Mono): Invite codes, character counts, metadata labels.

### Key Patterns

- Titles are **always uppercase** with generous `tracking-widest` or `tracking-[0.2em]`
- `text-glow` adds a gold text-shadow for premium feel on major headings
- Step titles use `font-display font-black` — never regular weight
- All-caps with wide tracking reads as "game UI", not "corporate"

---

## Components

### Hero Card (Character Select)

The hero card is the dominant visual element. It fills all available vertical space via `flex-1` and contains:

- Full-body persona image (`object-cover object-top`)
- Bottom gradient overlay: `bg-gradient-to-t from-skin-deep via-skin-deep/50 via-40% to-transparent` — solid at bottom, fading at 40% mark
- Text overlay at bottom: name → stereotype → description, spaced with `space-y-1`
- `rounded-2xl overflow-hidden` with `glow-breathe` border animation
- Swipe navigation via `react-swipeable` + `AnimatePresence` with spring physics (`stiffness: 300, damping: 30, mass: 0.8`)

**Chevron buttons**: Small (`w-8 h-8`) ghost circles at `left-2`/`right-2`, vertically centered. `bg-skin-deep/60 backdrop-blur-sm`. Only shown when there's a prev/next option.

### Thumbnail Strip

Horizontal row of circular persona headshots below the hero card.

- Circle: `w-14 h-14 rounded-full`
- Active: `ring-2 ring-skin-gold ring-offset-2 ring-offset-skin-deep scale-110`
- Inactive: `opacity-50 grayscale hover:opacity-70`
- Label below: `text-[10px] font-display font-bold` — first name only
- Gap between thumbnails: `gap-4`, gap between circle and label: `gap-1`
- Staggered entrance: `initial={{ opacity: 0, y: 12 }}` with `delay: idx * 0.08`

### Persona Preview (Compact)

Used on non-hero screens (bio authoring) to remind the user which character they picked.

- Horizontal layout: `flex items-center gap-4`
- Card: `bg-skin-panel/30 border border-skin-base rounded-xl p-4`
- Avatar: `w-16 h-16 rounded-xl` headshot
- Name: `text-sm font-bold text-skin-base`
- Stereotype: `text-xs text-skin-gold font-display uppercase tracking-wider`

### Identity Card (Confirmation)

Full preview of the player's chosen identity. Uses the hero image in a constrained aspect ratio.

- Card: `bg-skin-panel/30 border border-skin-gold/30 rounded-2xl overflow-hidden`
- Image area: `aspect-[16/9]` with gradient overlay and name/stereotype overlaid
- Bio section below: padding with `text-[10px] font-mono text-skin-dim/50 uppercase` label + `text-sm text-skin-base` content

### Step Indicator (Animated)

Three numbered circles connected by animated fill bars.

- Circle: `w-8 h-8 rounded-full font-display font-bold` with `transition-all duration-300`
- Active/completed step: `bg-skin-gold text-skin-deep`
- Future step: `bg-skin-input text-skin-dim/40`
- Completed step shows checkmark (`✓`)
- Connector: `w-10 h-0.5 bg-skin-input relative overflow-hidden`
- Connector fill: `motion.div` with `scaleX` animation from `origin-left`, `bg-skin-gold`
- Fill animates left-to-right on advance, empties on back navigation
- Easing: `[0.4, 0, 0.2, 1]` (Material ease-in-out), 400ms duration

### Bottom Action Bar

Always pinned to the viewport bottom. Contains error messages (if any) and action buttons.

- Container: `flex-shrink-0 relative z-20 bg-gradient-to-b from-skin-deep/0 to-skin-deep pt-3 px-4` with `style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}`
- The gradient fades from transparent (top) to solid `skin-deep` (bottom), blending the bar into the content above
- Bottom padding uses safe-area inset to clear the iPhone home indicator; falls back to `0.75rem` on devices without one
- Inner: `max-w-lg mx-auto`
- Error: `p-3 mb-3 rounded-lg bg-skin-pink/10 border border-skin-pink/30 text-skin-pink text-sm font-mono text-center`
- Buttons: `flex gap-3` — secondary on left (fixed width), primary on right (`flex-1`)

### Buttons

**Primary CTA** (pink):
```
py-4 font-display font-bold text-sm tracking-widest uppercase rounded-xl shadow-lg
bg-skin-pink text-skin-base shadow-btn hover:brightness-110 active:scale-[0.99]
```

**Secondary progression** (gold):
```
py-4 font-display font-bold text-sm tracking-widest uppercase rounded-xl shadow-lg
bg-skin-gold text-skin-deep shadow-btn hover:brightness-110 active:scale-[0.99]
```

**Ghost/back** (border only):
```
px-6 py-4 border border-skin-base text-skin-dim rounded-xl
font-display font-bold text-sm uppercase tracking-widest
hover:bg-skin-input/30 transition-all
```

**Disabled**: `bg-skin-input text-skin-dim/40 cursor-not-allowed`

**Loading**: Bouncing dots pattern — three `w-1.5 h-1.5 bg-current rounded-full animate-bounce` with staggered delays.

### Form Inputs

**Textarea** (glass style):
```
w-full px-4 py-3 backdrop-blur-sm rounded-xl resize-none
text-base font-bold text-skin-gold text-glow
placeholder:text-skin-dim placeholder:font-normal
focus:outline-none
style={{ backgroundColor: 'rgba(44, 0, 62, 0.8)', border: '1px solid var(--po-gold)' }}
```

Gold border via inline style (Tailwind opacity modifiers don't work with `var()` tokens). `backdrop-blur-sm` creates a glass effect over the blurred persona background. `text-glow` adds the gold text-shadow to typed content.

Character counter: `text-xs font-mono` — `text-skin-dim/40` normally, `text-skin-pink` when approaching limit (>260/280).

---

## Skeleton / Loading States

All skeletons use `bg-skin-input/20 animate-pulse` with rounded corners. They match the exact dimensions of the content they replace to prevent layout shifts.

- Hero skeleton: `flex-1` with gradient overlay and placeholder bars for name/stereotype/description
- Description bars: `h-7 w-44`, `h-3 w-28`, `h-3 w-56`, `h-3 w-40`
- Thumbnail skeletons: `w-14 h-14 rounded-full` with `h-2.5 w-10 rounded` label below
- Three thumbnails regardless of `DRAW_SIZE` (matches default)

### Fade-In Pattern

New content fades in via `motion.div` with `key={drawKey}`:
```tsx
<motion.div
  key={`draw-${drawKey}`}
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.4 }}
>
```

The `drawKey` counter increments on every new persona fetch. Combined with the thumbnail stagger animations, this creates a layered entrance effect.

---

## Motion & Animation

### Spring Physics

All swipe/slide transitions use a shared spring config:
```ts
{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }
```

This matches the client app's `SPRING.swipe` for consistency across the product.

### Transition Types

| Context | Animation | Duration |
|---------|-----------|----------|
| Hero swipe | Spring slide left/right (100% translate) | ~300ms (spring) |
| Step transitions | Spring slide left/right (80% translate) | ~300ms (spring) |
| Step indicator fill | scaleX from origin-left | 400ms, ease-in-out |
| Background persona crossfade | Opacity | 500ms |
| Background blur change | CSS `transition-[filter]` | 500ms |
| New draw fade-in | Opacity 0→1 | 400ms |
| Thumbnail stagger | Opacity + translateY | 300ms, 80ms stagger |
| Thumbnail active state | Ring + scale | 200ms (CSS transition) |
| Bottom bar button swap | Opacity crossfade | 150ms |
| Player card entrance (waiting room) | Opacity + translateY (staggered) | 300ms, 60ms stagger |

### AnimatePresence Modes

- Hero swipe carousel: `mode="popLayout"` — old and new coexist during spring animation
- Step content slides: `mode="popLayout"` — exiting step slides out while entering step slides in
- Bottom bar buttons: `mode="wait"` — old buttons fade out before new ones fade in
- Blurred background crossfade: `mode="popLayout"` — smooth blend between persona images

### Touch Interaction

- Swipe detection: `react-swipeable` with `delta: 50`, `trackTouch: true`
- Left edge ignore: 30px from left edge (prevents conflict with browser back gesture)
- Touch action: `pan-y` on hero container (allows vertical scroll, captures horizontal swipe)
- Button press: `active:scale-[0.99]` for subtle tactile feedback
- Thumbnail tap: `whileTap={{ scale: 0.95 }}`

---

## Screen-by-Screen Reference

### Step 1: Choose Your Persona

- Full blurred hero background with dark overlay
- Hero card fills remaining viewport space
- Three persona thumbnails at bottom
- Bottom bar: Redraw (ghost) + Lock In (pink CTA)
- `glow-breathe` animation on hero card border

### Step 2: Write Your Catfish Bio

- Near-opaque blurred hero background (`blur(2px)`, opacity 1.0) — persona is the star of this screen
- Dark overlay ensures readability
- Persona name + stereotype shown as large centered text (no card — the background IS the persona)
- Glass-effect textarea: dark translucent background (`rgba(44,0,62,0.8)`), gold border, gold bold text with `text-glow`
- Content vertically centered via `my-auto`, scrollable as keyboard safety valve
- Bottom bar: Back (ghost) + Continue (gold)

### Step 3: Confirm Your Identity

- Identity card with hero image at constrained aspect ratio
- Bio text below the image in the card
- Visual "this is final" weight — gold border on card
- Bottom bar: Edit Bio (ghost) + Join Game (pink CTA with loading state)

### Already Joined State

- Simple centered card with green accent
- "Go to Waiting Room" link-button
- No bottom bar, no blurred background

### Waiting Room

- Viewport-locked flex layout (same as invite flow)
- Blurred hero background using the player's own persona (`blur(2px)`, opacity 0.8)
- Dark overlay + radial glow (standard background stack)
- Header: "PECKING ORDER" title + invite code
- Status badge: animated pulse dot + status text in a glass pill
- Player list: glass-panel card (`backdrop-blur-md`) with staggered entrance animations
  - Filled slots: persona headshot + name + stereotype, gold accent
  - Empty slots: dashed border, pulsing "?" placeholder, dim text
- Bottom bar: context-dependent CTA
  - Waiting: share prompt text
  - Ready: "Launch Game" pink CTA
  - Started: "Enter Game" green link-button with client URL
- Loading: skeleton player cards matching final layout dimensions

### Error State (No Game)

- Centered card with pink accent
- Error message + "Back to Lobby" pink button
- No bottom bar

---

## Design Principles

1. **The persona is the star**. Every screen should make the player feel like they're choosing a character in a premium game. Large images, dramatic lighting, theatrical text treatment.

2. **No scroll on primary interactions**. The viewport-locked flex layout ensures the full experience is visible at once. Scroll is a fallback, not a feature.

3. **Gold draws the eye, pink drives action**. Gold highlights what you're looking at. Pink highlights what you should tap. Never mix these roles.

4. **Theatrical text**. Uppercase, wide-tracked display font for anything that announces. Quiet mono for metadata. Body font for content the player writes.

5. **Generous negative space over decoration**. The grid pattern and gradient glow provide ambient texture. Individual screens should not add decorative elements — let the persona images and typography do the work.

6. **Skeleton-first loading**. Never show a blank screen or a spinner text. Every loading state maintains the exact layout dimensions of the loaded state, with pulsing `bg-skin-input/20` placeholders.

7. **Spring physics for spatial transitions, opacity for temporal transitions**. Swipes between personas are spatial (spring slide). New data appearing is temporal (opacity fade). Don't mix these.

8. **Mobile-first, desktop-acceptable**. Design for a 375px-wide phone. The `max-w-lg` constraint ensures it doesn't look stretched on desktop. No desktop-specific layouts — the phone layout IS the layout.

---

## Applying to New Screens

When building a new screen in the lobby/invite flow:

1. Start with the viewport-locked flex column layout
2. Use safe-area-aware padding: `pt-[max(0.5rem,env(safe-area-inset-top))]` on content, `paddingBottom: max(0.75rem, env(safe-area-inset-bottom))` on bottom bar
3. Decide if this screen needs the blurred hero background
4. Place fixed-height elements at top and bottom, let the main content fill the middle with `flex-1`
5. Keep vertical spacing tight between fixed elements (`gap-2`, `mt-2`) — every pixel matters on small viewports
6. Use the bottom action bar for all buttons — never inline buttons in scrollable content
7. Match the typography hierarchy exactly — don't invent new text sizes
8. Use skeleton loading states that mirror the final layout
9. Add `motion` fade-in for any content that loads asynchronously

When building a new client app shell:

1. Import and use the same `packages/ui-kit` theme tokens
2. Match the spring physics config (`SPRING.swipe`)
3. Use the same background layering system (base + blur + overlay + glow)
4. Follow the same color role conventions (gold = highlight, pink = action)
5. The `data-theme` attribute switches the entire palette — design for both themes
