# Pulse Mockups

Interactive HTML prototypes used as authoritative visual reference for the Pulse shell. See `reference_pulse_prototypes` in auto-memory for which mockup is current.

## Conventions

Follow these when adding a new mockup.

### 1. Numbering

Name as `NN-topic.html` using the next integer after the highest existing file. Numbers are append-only; don't renumber existing prototypes.

### 2. Local serving

Mockups are plain HTML — no build step. Serve via a background shell:

```
cd docs/reports/pulse-mockups && python3 -m http.server 8765
```

Use `Bash run_in_background=true`; kill at end of session. Share URLs as `http://localhost:8765/NN-topic.html`.

Note: the server only serves HTML — no images, fonts, or assets from subdirectories. Use external URLs (CDN, Google Fonts) or base64 data URIs under ~100KB. Relative `src="personas/foo.png"` paths will 404.

### 3. Styling vocabulary

Inherit from `11-cast-strip-v2.html` (newest) or `08-full-interaction-prototype.html` (original).

Palette lives in `:root` CSS variables:
- `--bg` `#0a0a0e`
- `--surface` `#13131a`
- `--accent` `#ff3b6f`
- `--gold` `#ffd700`
- `--online` `#2ecc71`
- `--whisper` `#9b59b6`

Font: `Outfit` via Google Fonts. Phone frame: 390px wide, ~780-820px tall, rounded 36px border, dark phone chrome.

### 4. Persona images

Persona images live on the staging CDN:

```
https://staging-assets.peckingorder.ca/personas/persona-XX/headshot.png
https://staging-assets.peckingorder.ca/personas/persona-XX/medium.png
https://staging-assets.peckingorder.ca/personas/persona-XX/full.png
```

- `headshot` — small avatars (32–44px)
- `medium` — social panel hero thumbs
- `full` — DM hero gallery max

### 5. Interactivity

Use inline `<script>` with an `h()` helper that builds nodes via `document.createElement` + `appendChild` + `textContent` — never assign HTML as a string. The `finite-mockup-no-innerhtml.rule` guardrail explains why: the security_reminder hook blocks any write containing raw-HTML assignment patterns, even for trusted static mockups with no user input. Avoid frameworks, avoid build steps — prototypes must run directly from the local server.

### 6. Change notes

Add a "what changed" notes block at the bottom of the mockup so design iterations are self-documenting when the user refreshes.

### 7. Keep CSS simple

Complex CSS (deep nesting, pseudo-elements, animations, absolute positioning) breaks rendering in the brainstorm companion frame. Prefer flat class hierarchies, inline styles for one-offs, minimal CSS. If a mockup renders broken, simplify the CSS rather than debugging the frame template.
