# Client UI Invariants

## No emoji

Use `@solar-icons/react` (vivid shell) or lucide-react (classic). Emoji look inconsistent across platforms.

## Persona avatars always visible

Never replace player avatars with status icons. Use overlay indicators (badges, borders, opacity) on the avatar instead.

## Results inline, not fullscreen

Completed activity results render inline in the Today tab. Fullscreen takeover ONLY for arcade games (they need the canvas).

## Cards must be consistent

Cards should look consistent across all states (upcoming, live, completed). Don't make upcoming cards look disabled or greyed out.

## Show results immediately

Voting/game/prompt results must appear as soon as the phase closes. Never delay to night summary — async players shouldn't wait hours.
