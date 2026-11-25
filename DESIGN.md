# DESIGN.md — Lara & Federico Wedding Invitation

> Editorial Botanical Scroll-Chapter System.
> Informed by `taste-skill` (anti-cliché editorial restraint), Vercel `web-design-guidelines` (A11Y, motion, touch ergonomics), and `awesome-design-md` token clarity.

## 1. Visual Philosophy & Anti-Patterns
- **Aesthetic Direction:** Quiet cotton stationery meets cinematic stop-motion storytelling. Refined, calm, serious, and warm — never flashy or "AI-template".
- **Strict Exclusions:**
  - No hard card borders (`border: 1px solid ...`) on editorial overlays.
  - No metallic gold gradients, sparkles, or neon glows.
  - No emojis in UI copy.
  - No cluttered bottom progress bars or distracting floating chrome.
  - No background audio.

## 2. Color Tokens
| Token | Value | Role |
| :--- | :--- | :--- |
| `--surface-paper` | `#f6f4ee` | Primary warm alabaster / cotton paper canvas |
| `--surface-veil-light` | `rgba(246, 244, 238, 0.88)` | Translucent frosted paper veil for daylight scenes |
| `--surface-veil-dark` | `rgba(17, 33, 24, 0.82)` | Deep forest night veil for dark/starry scenes |
| `--ink-primary` | `#1c3526` | Deep forest green — primary text & primary actions |
| `--ink-secondary` | `#2c4c39` | Forest mid-tone — hover states & secondary emphasis |
| `--ink-muted` | `#4b6856` | Eucalyptus muted green — kickers, captions, metadata |
| `--ink-on-dark` | `#f6f4ee` | Warm alabaster text over dark botanical veils |
| `--ink-on-dark-muted` | `rgba(246, 244, 238, 0.76)` | Secondary metadata on dark scenes |
| `--tint-subtle` | `rgba(28, 53, 38, 0.08)` | Secondary pill button & input fill on light |
| `--tint-subtle-dark` | `rgba(246, 244, 238, 0.12)` | Secondary control & input fill on dark |

## 3. Typography
- **Display / Headings:** `Cormorant Garamond` (weights 500, 600), `line-height: 1.12`, `letter-spacing: -0.01em`, `text-wrap: balance`.
- **UI / Body / Kickers:** `Plus Jakarta Sans` (weights 400, 500, 600), clean legibility at small sizes, `text-wrap: pretty`.
- **Numeric Precision:** `font-variant-numeric: tabular-nums` applied to countdown units, dates, and times.

## 4. Layout & Safe Areas
- **Viewport:** Full-height `100dvh` stage with `viewport-fit=cover`.
- **Safe Insets:** Top and bottom overlay blocks respect `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` so content never collides with mobile notches or home bars.
- **Hierarchy:** Each chapter places a concise title/context block near the top and its primary detail or action near the bottom, leaving the central 9:16 video focal point completely unobstructed.

## 5. Motion & Interaction (Chapter Auto-Playback)
- **Discrete Stops:** Frames `0` → `110` → `262` → `414` → `544` → `600`.
- **Triggers:** Single tap/click on stage, small scroll wheel delta, short vertical touch swipe, or keyboard arrows (`ArrowDown` / `ArrowUp` / `Space`).
- **Playback Curve:** Smooth real-time frame playback (~24–28 fps with gentle deceleration into the destination stop). Overlays fade out during travel and reveal cleanly upon arrival.
- **Reduced Motion:** Honors `@media (prefers-reduced-motion: reduce)` by jumping directly to stop frames without intermediate scrubbing.

## 6. Accessibility & Ergonomics
- Touch targets ≥ 44×44px (`min-height: 44px` on primary interactive controls).
- Clear `:focus-visible` outlines (2px solid) for keyboard navigation.
- Semantic HTML landmarks (`<main>`, `<section>`, `<nav>`), explicit `<label>` elements, `autocomplete="name"`, and `aria-live="polite"` status announcements.
- Viewport meta never blocks pinch-to-zoom.
