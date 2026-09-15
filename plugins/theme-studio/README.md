# Theme Studio (vendored)

Live theme editor for the Hermes Desktop app at the `/theme-studio` route:
native color pickers for all 26 surface tokens, instant repaint, a
light+dark palette generator, multi-color seed
generation (3 colors + optional 4th highlight) with a Contrast dial,
"start from current
theme" via the app's CSS vars, JSON export/import (clipboard + file, plus
VS Code theme import), and native skin (YAML) export.

Contrast model: single-color mode clamps text and the accent to WCAG
4.5:1 against the background. Multi-color mode is role-specific — picked
fills stay EXACT, and each pairing is matched to its own surfaces (ink on
the fill ≥4.5:1, brand stroke on the ground ≥3:1, stroke on the
selected-row fill ≥3:1, text on secondary/soft-accent ≥4.5:1); the fill
itself is deliberately not asserted against the page background.

## Multi-color generation

The generator box has a mode select: **From 1 color** (the original
recipe), **From 3 colors**, **From 4 colors (+highlight)**. In multi-color
mode each seed drives its own token family in BOTH the light and dark
palettes — seeds are never averaged and none is ignored:

| Seed | Role | Tokens it drives |
|------|------|------------------|
| Base | surfaces | every surface (background, sidebar, card, popover, muted, input, border ladder) carries the base hue at REAL saturation — visibly tinted in both modes (light lavender, deep purple), not a near-white/near-black wash |
| Primary accent | brand fill | primary kept EXACTLY as picked in BOTH modes (fills are never contrast-clamped); `primaryForeground` is ink chosen ON the fill (≥4.5:1); `midground` is the readable brand stroke — the fill blended toward the base seed and lightness-clamped to ≥3:1 on the background it is drawn on; `ring`/`composerRing` use the readable secondary companion (see below), not a darkened fill |
| Secondary | blue family | secondary kept EXACTLY as picked in both modes with readable ink (`secondaryForeground` ≥4.5:1); companions spread blue across user bubble + border, focus/composer rings, and a border tint — never a single-use color |
| Highlight *(optional, 4-color mode only)* | soft accent | accent / selected-row pastel fill, tuned so the brand stroke keeps ≥3:1 ON the fill (light: pale tint toward white; dark: chromatic deep tint of the same hue). With only 3 seeds it derives from the FINAL multi primary |

Seed colors persist under their own plugin-storage key
(`theme-studio-seeds-v1`), separate from the generated theme
(`theme-studio-palette-v2`): picking or changing seeds never replaces the
saved palettes until **Generate light + dark** is clicked. Corrupt or
invalid stored seeds recover to single mode without touching the theme.

## Contrast dial (3/4-color modes)

The generator box has a **Contrast** slider (0–100, labeled
Soft–Balanced–Crisp with the numeric value and a **Reset** button). It
scales surface separation and text punch:

- **Balanced (50, default)** is the original recipe EXACTLY — generation
  output is byte-identical to the pre-dial implementation.
- **Crisp (toward 100)** widens the surface ladder (deeper background,
  lighter cards/popovers in dark; whiter background, darker sidebar and
  border-mix in light) and brightens text.
- **Soft (toward 0)** narrows the ladder and softens text.

Guardrails, verified at BOTH extremes: text never drops below WCAG 4.5:1
on its background (foreground and muted text are clamped), surfaces stay
visibly tinted members of the base hue (HSL-saturation and lightness
bounds — never flattening to white/black), and the ladder order
(sidebar < background < muted < card < popover) is preserved. Picked seed
fills stay EXACT at every setting — the dial tunes surfaces, text and
border mixes, never fills.

Scope: the dial applies to 3/4-color generation only (its adjustment
terms vanish at Balanced). Single-color mode keeps its own recipe and
shows a scope note instead of an inert control. Moving the slider only
updates the dial and its persistence — the saved palettes change only on
**Generate**. The value persists inside the seeds storage object
(`theme-studio-seeds-v1` as `{mode, seeds, contrast}`); old shapes
without `contrast`, and corrupt values, recover to Balanced (50).

Fidelity example (base `#9B68C5`, primary `#EFA3B6`, secondary `#4044BF`):
the exact pink `#EFA3B6` and exact blue `#4044BF` are the fills in BOTH
modes. Contrast lives on the companions, never the fills: dark ink
`#161A22` on the pink (8.8:1), `#F5F0EB` on the blue (6.6:1); in dark mode
the brand stroke and rings are the pink/blue themselves (8.4:1 / lifted
periwinkle `#5F62C9` on the deep purple ground); in light mode the brand
stroke is a plum companion of the pink (`#B368B0`, ≥3:1 on the lavender
background) and the rings are the exact blue. Surfaces carry the lavender
base visibly (light background `#ECE5F2`, sidebar `#E0D4EA`; dark
background `#25192F`), and the blue family extends to the user bubble
(`#CDCAEA` light / `#342C68` dark) and border tint.

## Provenance / attribution (MIT)

- Upstream: https://github.com/exergonic/hermes-desktop-plugins (`theme-studio/`)
- Pinned upstream commit of this file: `7ecca6718a7ac28af9031f4fa6afab424dfeefd9`
  (2026-08-13, "Add orng theme and Theme Studio desktop plugins", Billy Wayne
  McCann). Repo head at vendoring time: `0d840eb47d1a22ac157019a0da79848e31814374`.
- The original upstream `plugin.js` at that commit had
  (sha256 `9e4fbd669e4b31674a8c47f3bc1a5d5a153705e3da998054819f62168db54dd1`).
- Original copyright and license: see `LICENSE` (MIT, © 2026 Billy Wayne
  McCann), retained unmodified. **Local modifications since vendoring**
  (upstream attribution preserved):
  1. "Open Theme Studio" fronts its own main-area tab via
     `host.openWorkspace` (Bot Mode fix).
  2. Multi-color seed generation (3 colors + optional 4th highlight)
     alongside the single-color mode, with separate seed persistence
     (`theme-studio-seeds-v1`) — see "Multi-color generation" above.
  3. Multi-color redesign (palette-driven): picked primary/secondary are
     used EXACTLY as fills in both modes with separately contrasted
     companions (ink on the fill, brand stroke, rings); surfaces carry
     the base seed visibly in both modes; the secondary spreads across
     user bubble, rings and border tint; the dark selected-row tint is a
     chromatic deep tint (HSL) instead of a muddy RGB mix.
  4. Contrast dial in the multi-color generator: 0–100 slider
     (Soft–Balanced–Crisp, default 50 = the classic recipe unchanged)
     scaling surface separation, text punch and border visibility, with a
     WCAG 4.5:1 readable-text floor and anti-flattening bounds at every
     setting; applied only on Generate, persisted with the seeds
     (backward compatible, corrupt values recover to 50).
  All local additions also live in this README and the repo-level docs.

## Compatibility (verified against the live Mac client source, 2026-09-14)

Read-only inspection of the Hermes Desktop SDK and theme implementation:

- `THEMES_AREA='themes'`, `ROUTES_AREA='routes'`, `SIDEBAR_NAV_AREA='sidebar.nav'`,
  `PALETTE_AREA='palette'`, `host.navigate`, `host.notify` all exist with the
  behavior the plugin relies on (`src/sdk/index.ts`, `src/themes/user-themes.ts`,
  `src/app/routes.ts`, `src/app/command-palette/contrib.ts`).
- The registered theme passes the app's `isValidTheme` contract
  (`name`/`label`/`colors.background|foreground|primary` + `darkColors`).
- "Start from current app theme" reads the same CSS vars the app's
  `applyTheme` writes (`src/themes/context.tsx` lines 241–268).

## Behavior / limits

- **Installing this plugin does NOT change the active theme.** Registering a
  theme only adds it to Appearance / ⌘K / `/skin` lists; activation happens
  only when the user explicitly selects "Theme Studio" (verified in
  `themes/context.tsx`: active theme is separate `themeName` state, default
  `nous`). Edits inside the editor repaint only after explicit user action.
- Default name collision safety: contributed themes cannot shadow built-ins.
- Palette persists via plugin storage (`theme-studio-palette-v2`); no
  rollback/reset feature exists — use Export JSON to snapshot before big edits.
- Skin (YAML) export downloads to Downloads and requires a manual
  `hermes config set display.skin ...` step; it is a lossy terminal-format
  projection of the desktop palette.

## Install / removal (Mac)

- Install: copy this folder to `~/.hermes/desktop-plugins/theme-studio/`
  then ⌘K → **Reload desktop plugins** if it
  does not appear within a few seconds (the app hot-loads new plugin files).
- Use: sidebar "Theme Studio" row, ⌘K "Open Theme Studio", or `/theme-studio`.
- Removal: delete the folder (or toggle off in Settings → Plugins). The
  contributed theme disappears with it; if "Theme Studio" was selected in
  Appearance, re-select another theme after removal.

## Tests

See `../../test/theme-studio/` (`npm test`) — real-Chromium, real React 19
mount of the registered route, command→navigate wiring, storage/persist and
re-registration behavior, and the no-auto-activation check. Results:
`../../test/theme-studio/results.json`. SDK-stub tests are labeled PARTIAL
INTEGRATION: live-client behavior of the theme page itself is verified only
by source inspection + the registered-contract checks above.
