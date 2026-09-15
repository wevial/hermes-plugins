/**
 * theme-studio — live theme editor for the Hermes desktop app.
 * Derived from https://github.com/exergonic/hermes-desktop-plugins
 * Upstream revision: 7ecca6718a7ac28af9031f4fa6afab424dfeefd9
 * Copyright (c) 2026 Billy Wayne McCann. MIT License; see LICENSE.
 * Local modifications copyright (c) 2026 Ko Vial, also MIT.
 * See README.md for provenance and modification notes.
 *
 * A route page (/theme-studio) with native color pickers for every surface
 * token. Each change re-registers the SAME contribution id in the `themes`
 * area with the updated palettes; the registry replaces by id and bumps
 * $registryVersion, and ThemeProvider repaints instantly (verified in
 * contrib/registry.ts put/invalidate + themes/context.tsx activeTheme deps).
 *
 * The edited theme is always registered under the name "theme-studio" as
 * TWO palettes — light (colors) and dark (darkColors) — so the app's
 * Appearance light/dark toggle switches between real variants (the app's
 * getBaseColors picks darkColors for dark mode, colors for light).
 *
 * A base-color generator derives both palettes from one chosen color:
 * hue-matched neutrals (monochromatic harmony) with text and accent
 * clamped to WCAG 4.5:1 contrast. "Start from…" is a themed custom menu
 * (presets + the app's current theme, read live from its CSS vars).
 *
 * Multi-color generation: the generator mode selects 1, 3, or 4 SEED
 * colors (base / primary accent / secondary / optional highlight). Each
 * seed drives its own token family in BOTH light and dark — seeds are
 * never averaged and none is ignored. Fidelity first: the picked primary
 * and secondary are used EXACTLY as fills; contrast lives on their
 * COMPANIONS (ink on the fill, brand stroke, rings), never on the fill
 * itself. Surfaces carry the base hue at real saturation (visibly tinted
 * lavender/deep-purple, not near-white/near-black), the secondary spreads
 * across user bubbles, rings and borders, and text is matched to its own
 * surface. Seeds persist under their own storage key
 * (theme-studio-seeds-v1), separate from the generated theme
 * (theme-studio-palette-v2); picking seeds never replaces the saved
 * palettes until Generate is clicked.
 *
 * Persistence: ctx.storage (key v2 stores {light, dark}; v1 flat palettes
 * migrate). Export copies the full theme JSON (both palettes) to the
 * clipboard; Import reads JSON back from the clipboard or a file.
 *
 * Self-contained per the desktop plugin SDK: plain ESM, jsx() only, inline
 * styles with theme vars (disk plugins load at runtime — Tailwind arbitrary
 * values don't exist).
 */

import { host, THEMES_AREA } from '@hermes/plugin-sdk'
import { jsx } from 'react/jsx-runtime'
import { useRef, useState } from 'react'

const ID = 'theme-studio'
const THEME_NAME = 'theme-studio'
const STORAGE_KEY = 'theme-studio-palette-v2'
const LEGACY_STORAGE_KEY = 'theme-studio-palette-v1'
const SEEDS_STORAGE_KEY = 'theme-studio-seeds-v1'

/* Generator modes: the classic single-color recipe plus multi-color seed
 * generation (3 colors, or 4 with the optional highlight). Seeds persist
 * under SEEDS_STORAGE_KEY, SEPARATELY from the generated theme — picking
 * seed colors never touches the saved palettes until Generate is clicked. */
const GEN_MODES = [
  ['single', 'From 1 color'],
  ['multi3', 'From 3 colors'],
  ['multi4', 'From 4 colors (+highlight)']
]

/* Seed roles for multi-color generation. Each seed drives its OWN token
 * family in BOTH light and dark — nothing is averaged and no seed is
 * ignored: base → visibly tinted surfaces (all of them), primary → the
 * EXACT accent fill plus its readable ink/stroke companions, secondary →
 * the EXACT secondary fill plus the blue family (user bubble, focus
 * rings, border tint), highlight → the soft accent pastel fill. */
const SEED_ROLES = [
  ['base', 'Base (surfaces)'],
  ['primary', 'Primary accent'],
  ['secondary', 'Secondary'],
  ['highlight', 'Highlight (soft accent)']
]

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

/* Contrast dial for seed generation (3/4-color modes). 0–1 slider where
 * 0.5 = Balanced = the original recipe EXACTLY (every adjustment scales
 * with the distance from 0.5, which is zero there); Soft (toward 0)
 * relaxes surface separation and text punch, Crisp (toward 1) widens the
 * surface ladder and brightens text. A readable-text floor (WCAG 4.5:1
 * via clampContrast) applies at every setting, and the surface bounds
 * keep the tinted ladder (never flattening to white/black). Persisted
 * alongside the seeds (theme-studio-seeds-v1) — moving the slider never
 * touches the saved palettes until Generate is clicked. Single-color
 * mode keeps its own recipe and does not offer the dial. */
const CONTRAST_DEFAULT = 0.5
const CONTRAST_LABEL = (c) => (c < 0.4 ? 'Soft' : c > 0.6 ? 'Crisp' : 'Balanced')

/* All DesktopThemeColors keys with labels + orng-derived defaults. */
const TOKENS = [
  ['background', 'App background', '#161a22'],
  ['sidebarBackground', 'Sidebar background', '#10131a'],
  ['card', 'Cards / panes', '#1e232b'],
  ['popover', 'Popovers / menus', '#10131a'],
  ['muted', 'Muted surfaces', '#1e232b'],
  ['secondary', 'Secondary surfaces', '#B04928'],
  ['foreground', 'Primary text', '#eeeeee'],
  ['mutedForeground', 'Muted text', '#808080'],
  ['cardForeground', 'Card text', '#eeeeee'],
  ['popoverForeground', 'Popover text', '#eeeeee'],
  ['secondaryForeground', 'Secondary text', '#eeeeee'],
  ['primary', 'Accent (primary)', '#EC5B2B'],
  ['primaryForeground', 'Accent text', '#161a22'],
  ['accent', 'Accent (soft)', '#EE7948'],
  ['accentForeground', 'Accent soft text', '#161a22'],
  ['midground', 'Brand stroke', '#EC5B2B'],
  ['midgroundForeground', 'Brand stroke text', '#161a22'],
  ['composerRing', 'Composer focus ring', '#EC5B2B'],
  ['ring', 'Focus ring', '#EC5B2B'],
  ['border', 'Borders', '#3c3c3c'],
  ['input', 'Input backgrounds', '#1e232b'],
  ['destructive', 'Error / destructive', '#e06c75'],
  ['destructiveForeground', 'Error text', '#161a22'],
  ['sidebarBorder', 'Sidebar border', '#3c3c3c'],
  ['userBubble', 'User message bubble', '#3D2624'],
  ['userBubbleBorder', 'Bubble border', '#3c3c3c']
]

const DEFAULTS = Object.fromEntries(TOKENS.map(([k, , d]) => [k, d]))

/* "Start from…" menu — presets plus the app's CURRENT theme (read live
 * from its CSS variables; the plugin cannot scan ~/.hermes/skins/ — the
 * renderer has no filesystem and the RPC surface is closed). */
const START_OPTIONS = [
  { id: 'current', label: 'Current app theme' },
  { id: 'orng', label: 'orng' },
  { id: 'nous', label: 'nous (app default)' },
  { id: 'defaults', label: 'Studio defaults' }
]

/* Starter palettes — one-click starting points. orng = the ported Zed
 * theme; nous = the app's own built-in dark palette; defaults = the
 * studio's orng-derived baseline. Loading one fills the palette you are
 * currently editing (Dark or Light tab). */
const PRESETS = {
  orng: { ...DEFAULTS },
  nous: {
    background: '#0D2F86',
    foreground: '#FFE6CB',
    card: '#12378F',
    cardForeground: '#FFE6CB',
    muted: '#183F9A',
    mutedForeground: '#B5C7F3',
    popover: '#123A96',
    popoverForeground: '#FFE6CB',
    primary: '#FFE6CB',
    primaryForeground: '#0D2F86',
    secondary: '#1B45A4',
    secondaryForeground: '#E0E8FF',
    accent: '#1540B1',
    accentForeground: '#F0F4FF',
    border: '#3158AD',
    input: '#0B2566',
    ring: '#FFE6CB',
    midground: '#0053FD',
    midgroundForeground: '#F0F4FF',
    composerRing: '#FFE6CB',
    destructive: '#C0473A',
    destructiveForeground: '#FEF2F2',
    sidebarBackground: '#09286F',
    sidebarBorder: '#234A9C',
    userBubble: '#143B91',
    userBubbleBorder: '#3A63BD'
  }
}

/* ── Color math ──────────────────────────────────────────────────────── */

function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
}

function hexLuminance(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
}

/* WCAG relative luminance (sRGB gamma curve) — the contrast math below
 * uses this, not hexLuminance. */
function relLuminance(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  const lin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2])
}

function contrastRatio(a, b) {
  const la = relLuminance(a)
  const lb = relLuminance(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

function mixHex(a, b, t) {
  const ra = hexToRgb(a)
  const rb = hexToRgb(b)
  if (!ra || !rb) return a
  const out = ra.map((v, i) => Math.round((v + (rb[i] - v) * t) * 255))
  return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()
}

function readableOn(hex) {
  return (hexLuminance(hex) > 0.5 ? '#161A22' : '#F5F0EB').toUpperCase()
}

/* Pick the darker or lighter ink by which clears WCAG 4.5:1 with the better
 * margin. (Naive luminance says "white text on orange"; contrast math says
 * dark text wins on orange — matching orng's #EC5B2B/#161A22 pair.) */
function readableOnWcag(hex) {
  const dark = '#161A22'
  const light = '#F5F0EB'
  return (contrastRatio(hex, dark) >= contrastRatio(hex, light) ? dark : light).toUpperCase()
}

function hexToHsl(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return [0, 0, 0]
  const [r, g, b] = rgb
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [h, s, l]
}

function hslToHex(h, s, l) {
  const hue = ((h % 1) + 1) % 1
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const f = (t) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }
  const toHex = (v) => Math.round(v * 255).toString(16).padStart(2, '0')
  return '#' + [f(hue + 1 / 3), f(hue), f(hue - 1 / 3)].map(toHex).join('').toUpperCase()
}

/* Nudge `hex` lightness until it clears `min` contrast (default WCAG AA
 * 4.5:1) against `against`. Darkens when the target is light, lightens
 * when it is dark — capped so it always returns a color. */
function clampContrast(hex, against, min = 4.5) {
  const [h, s] = hexToHsl(hex)
  let l = hexToHsl(hex)[2]
  const step = relLuminance(against) > 0.5 ? -0.02 : 0.02
  for (let i = 0; i < 40; i++) {
    if (contrastRatio(hex, against) >= min) return hex
    l = Math.min(1, Math.max(0.02, l + step))
    hex = hslToHex(h, s, l)
  }
  return hex
}

/* Mix `color` toward `base` until `color` itself clears `min` contrast on
 * the result — used for soft-accent surfaces that carry the brand stroke
 * as text (selected-row backgrounds). More mixing is always monotonic:
 * toward a dark base it deepens, toward white it pales. */
function distinctSoftAccent(color, base, min = 3) {
  for (let t = 0.6; t <= 0.95; t += 0.05) {
    const candidate = mixHex(color, base, t)
    if (contrastRatio(color, candidate) >= min) return candidate
  }
  return mixHex(color, base, 0.95)
}

/* Mix `source` toward `base` until `stroke` clears `min` contrast ON the
 * result — the selected-row PASTEL fill is tuned against the stroke that
 * renders on it (stroke↔fill pairing), never against the page background. */
function pastelOn(source, stroke, base, min = 3) {
  for (let t = 0.55; t <= 0.97; t += 0.03) {
    const candidate = mixHex(source, base, t)
    if (contrastRatio(stroke, candidate) >= min) return candidate
  }
  return mixHex(source, base, 0.97)
}

/* Dark-mode deep tint of `source`: reduce LIGHTNESS in HSL space (keeping
 * real chroma) until `stroke` clears `min` contrast ON the result. Mixing
 * RGB toward a dark background instead collapses saturation and reads as
 * muddy grey-brown — this keeps the fill chromatic. */
function deepTint(source, stroke, min = 3) {
  const [h, s] = hexToHsl(source)
  const sat = Math.min(0.5, Math.max(0.25, s * 0.6))
  for (let l = 0.42; l >= 0.1; l -= 0.02) {
    const candidate = hslToHex(h, sat, l)
    if (contrastRatio(stroke, candidate) >= min) return candidate
  }
  return hslToHex(h, sat, 0.1)
}

/* ── Multi-color palette ───────────────────────────────────────────────
 * Design: fidelity + separation. Each seed keeps its identity:
 *   base      → every surface carries the base hue at REAL saturation so
 *               light mode reads lavender (not near-white) and dark mode
 *               deep purple (not near-black), stepped into a ladder
 *               (sidebar < background < muted < card < popover).
 *   primary   → the EXACT picked color as the primary FILL in both modes.
 *               Contrast lives on its COMPANIONS, never the fill:
 *               primaryForeground is ink chosen ON the fill; the brand
 *               stroke (midground) is the fill blended toward the base
 *               seed and lightness-clamped to 3:1 against the background
 *               it is drawn on (light mode) — never the fill mangled to
 *               carry text itself.
 *   secondary → the EXACT picked color as the secondary fill with its own
 *               readable ink, plus companions that spread blue across
 *               meaningful roles: user bubble + border, focus/composer
 *               rings, and a hint mixed into borders.
 *   highlight → the soft accent (selected-row) pastel fill, tuned so the
 *               brand stroke keeps 3:1 ON the fill.
 * Text tokens are contrast-matched to their OWN surfaces (the card /
 * popover / input ladder), not to the app background. */
function generateMultiPalette(baseHex, mode, seedPrimary, seedSecondary, seedHighlight, contrast) {
  const dark = mode === 'dark'
  const [h, s] = hexToHsl(baseHex)
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

  /* Contrast dial: `cd` is the signed distance of the dial from Balanced.
   * At Balanced (0.5, or any invalid value) cd is 0 and every adjustment
   * below is a no-op — the palette is byte-identical to the pre-dial
   * recipe. Soft (cd < 0) narrows the surface ladder and softens text;
   * Crisp (cd > 0) widens it (deep background, lighter cards/popovers in
   * dark mode; whiter background, darker sidebar/border in light) and
   * brightens text — with ladder bounds so surfaces stay VISIBLY TINTED
   * members of the base hue (never near-white/near-black flats) and keep
   * their order (sidebar < background < muted < card < popover). */
  const cd = (typeof contrast === 'number' && isFinite(contrast)
    ? clamp(contrast, 0, 1) - CONTRAST_DEFAULT
    : 0)

  const bgSat = clamp(s * (dark ? 0.7 : 0.75), 0.18, dark ? 0.38 : 0.36)
  const ladderRaw = dark
    ? { background: 0.14, sidebar: 0.105, muted: 0.16, card: 0.175, input: 0.15, popover: 0.19, border: 0.3 }
    : { background: 0.925, sidebar: 0.875, muted: 0.905, card: 0.94, input: 0.935, popover: 0.95, border: 0.8 }
  const ladderCenter = dark ? 0.1475 : 0.9125
  const surfLo = dark ? 0.06 : 0.85
  const surfHi = dark ? 0.24 : 0.965
  const borderLoHi = dark ? [0.06, 0.42] : [0.7, 0.87]
  const ladder = {}
  for (const key of Object.keys(ladderRaw)) {
    const loHi = key === 'border' ? borderLoHi : [surfLo, surfHi]
    ladder[key] = clamp(ladderCenter + (ladderRaw[key] - ladderCenter) * (1 + cd * 0.9), loHi[0], loHi[1])
  }
  const surface = (key, satMul = 1) => hslToHex(h, clamp(bgSat * satMul, 0.04, 0.42), ladder[key])
  const background = surface('background')
  const sidebar = surface('sidebar', 1.05)
  const card = surface('card')
  const muted = surface('muted')
  const input = surface('input')
  const popover = surface('popover', 0.9)

  const fgSat = clamp(s * 0.22, 0.05, 0.12)
  /* Text punch scales with the dial; the WCAG 4.5:1 floor against the
   * background holds at EVERY dial setting (readable-text floor). */
  const foreground = clampContrast(
    hslToHex(h, fgSat, clamp(dark ? 0.93 + cd * 0.05 : 0.12 - cd * 0.05, dark ? 0.88 : 0.08, dark ? 0.97 : 0.15)),
    background
  )
  const mutedForeground = clampContrast(
    hslToHex(h, fgSat * 0.8, clamp(dark ? 0.6 + cd * 0.08 : 0.42 - cd * 0.08, 0.3, 0.68)),
    background
  )

  // Primary FILL: exact picked color. Ink/stroke: separate pairings.
  const primary = seedPrimary
  const primaryForeground = readableOnWcag(primary)
  let midground = primary
  if (contrastRatio(primary, background) < 3) {
    midground = clampContrast(mixHex(primary, baseHex, 0.55), background, 3)
  }

  // Blue family: exact secondary fill + companions that keep blue visible
  // wherever it must read against the background (rings, bubble borders).
  const secondary = seedSecondary
  const secondaryForeground = readableOnWcag(secondary)
  const blueVisible = clampContrast(secondary, background, 3)
  const destructive = hslToHex(0, 0.65, dark ? 0.65 : 0.45)

  /* Border visibility scales with the dial (mixed toward the blue family);
   * default mix ratios are untouched. */
  const border = mixHex(surface('border'), secondary, clamp((dark ? 0.18 : 0.22) + cd * 0.14, 0.04, 0.4))
  const sidebarBorder = mixHex(surface('border'), secondary, clamp((dark ? 0.24 : 0.28) + cd * 0.14, 0.04, 0.4))

  // Soft accent (selected-row) PASTEL fill from the 4th seed or the final
  // primary, tuned so the brand stroke keeps 3:1 ON the fill (stroke↔fill
  // pairing). Light: pale tint toward white. Dark: chromatic deep tint
  // (HSL lightness reduction — RGB mixing toward the background goes muddy).
  const accSrc = seedHighlight || primary
  const accent = dark
    ? deepTint(accSrc, midground)
    : pastelOn(accSrc, midground, '#ffffff')
  const accentForeground = readableOnWcag(accent)

  return {
    background,
    foreground,
    card,
    cardForeground: foreground,
    muted,
    mutedForeground,
    popover,
    popoverForeground: foreground,
    primary,
    primaryForeground,
    secondary,
    secondaryForeground,
    accent,
    accentForeground,
    midground,
    midgroundForeground: readableOnWcag(midground),
    composerRing: blueVisible,
    ring: blueVisible,
    border,
    input,
    destructive,
    destructiveForeground: readableOnWcag(destructive),
    sidebarBackground: sidebar,
    sidebarBorder,
    userBubble: mixHex(secondary, card, dark ? 0.66 : 0.8),
    userBubbleBorder: dark ? blueVisible : secondary
  }
}

/* ── Base-color generator ──────────────────────────────────────────────
 * One base color in, a complete 26-token palette out (for one mode).
 * Design theory: monochromatic harmony — every neutral carries the base
 * hue at low saturation so all surfaces read as one family; the accent is
 * the base hue clamped to WCAG 4.5:1 on the background; destructive is a
 * fixed semantic red tuned per mode; surfaces form a lightness ladder
 * (sidebar < background < muted < card < input < popover in dark, the
 * inverse in light). */
function generatePalette(baseHex, mode, seeds) {
  const dark = mode === 'dark'
  const seed = seeds && typeof seeds === 'object' ? seeds : {}
  const up = (hex) => (hex && hexToRgb(hex) ? hex.toUpperCase() : null)
  const seedPrimary = up(seed.primary)
  const seedSecondary = up(seed.secondary)
  const seedHighlight = up(seed.highlight)
  const multi = !!seedPrimary
  const [h, s, l] = hexToHsl(baseHex)
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

  // Multi-color mode has its own recipe: exact seed fills with separately
  // contrasted companions and visibly tinted surfaces (see the design note
  // on generateMultiPalette).
  if (multi) {
    return generateMultiPalette(baseHex, mode, seedPrimary, seedSecondary, seedHighlight, seed.contrast)
  }

  // Surfaces: single mode keeps the original recipe (backward compatible),
  // hue-matched neutrals at low saturation while text contrast margins
  // stay generous.
  const bgSat = clamp(s * 0.3, 0.05, dark ? 0.25 : 0.18)
  const ladder = dark
    ? { background: 0.07, sidebar: 0.05, muted: 0.09, card: 0.11, input: 0.12, popover: 0.13, border: 0.22 }
    : { background: 0.965, sidebar: 0.93, muted: 0.95, card: 0.985, input: 0.97, popover: 1, border: 0.87 }
  const background = hslToHex(h, bgSat, ladder.background)
  const surface = (key) => hslToHex(h, bgSat, ladder[key])

  const fgSat = clamp(s * 0.22, 0.04, dark ? 0.12 : 0.1)
  const foreground = hslToHex(h, fgSat, dark ? 0.93 : 0.11)

  // Accent = the base hue, vivid enough to read as brand, clamped to AA.
  // Dark: keep the base's lightness (floor 0.5 so a murky base still pops).
  // Light: scale down toward 0.32–0.45 so it clears 4.5:1 on near-white.
  let primary = clampContrast(
    hslToHex(h, clamp(s, 0.45, 0.9), dark ? clamp(l, 0.5, 0.62) : clamp(0.55 * l, 0.32, 0.45)),
    background
  )

  const border = hslToHex(h, clamp(s * 0.15, 0.04, 0.1), ladder.border)
  const mutedForeground = clampContrast(hslToHex(h, fgSat * 0.7, dark ? 0.58 : 0.44), background)
  const destructive = hslToHex(0, 0.65, dark ? 0.65 : 0.45)

  const sidebar = surface('sidebar')
  const card = surface('card')
  const popover = surface('popover')
  const muted = surface('muted')
  const input = surface('input')

  // Soft accent = the background of SELECTED surfaces (the ⌘K palette's
  // highlighted row: bg-accent) while the brand stroke (midground) renders
  // the match letters ON it (text-(--ui-accent)). The two must stay
  // distinct or the match text vanishes into the row: mix the primary
  // toward `base` until the stroke clears 3:1 on the result (dark: toward
  // the background — deep tint; light: toward white — pale tint). The old
  // fixed recipe mixed toward foreground, making accent ≈ midground
  // (contrast ~1.2:1), and a fixed 60% white mix missed 3:1 for green.
  // (Multi-color mode has its own pastelOn recipe in generateMultiPalette.)
  const softAccent = distinctSoftAccent(primary, dark ? background : '#ffffff')

  const secondary = dark ? hslToHex(h, clamp(s, 0.4, 0.8), 0.42) : hslToHex(h, bgSat, 0.88)
  const secondaryText = foreground

  return {
    background,
    foreground,
    card,
    cardForeground: foreground,
    muted,
    mutedForeground,
    popover,
    popoverForeground: foreground,
    primary,
    primaryForeground: readableOnWcag(primary),
    secondary,
    secondaryForeground: secondaryText,
    accent: softAccent,
    accentForeground: readableOnWcag(softAccent),
    midground: primary,
    midgroundForeground: readableOnWcag(primary),
    composerRing: primary,
    ring: primary,
    border,
    input,
    destructive,
    destructiveForeground: readableOnWcag(destructive),
    sidebarBackground: sidebar,
    sidebarBorder: border,
    userBubble: dark ? hslToHex(h, clamp(s * 0.6, 0.3, 0.7), 0.24) : hslToHex(h, clamp(s * 0.35, 0.12, 0.3), 0.92),
    userBubbleBorder: dark ? hslToHex(h, clamp(s * 0.7, 0.4, 0.8), 0.38) : primary
  }
}

/* ── VS Code color-theme import ─────────────────────────────────────────
 * Mirrors the app's own converter (apps/desktop/src/themes/vscode.ts):
 * same key priorities, same derived-token recipes. Deliberate deviation:
 * no AA accent enforcement on import — the studio's job is to let you tweak,
 * so a low-contrast brand accent imports as-is and you fix it with a swatch.
 */
function convertVscToPalette(vsc) {
  const colors = vsc && typeof vsc.colors === 'object' ? vsc.colors : {}
  const take = (keys, fallback) => {
    for (const k of keys) {
      if (typeof colors[k] === 'string') return colors[k]
    }
    return fallback
  }

  const bgHit = take(['editor.background', 'editorPane.background', 'editorGroup.background'], null)
  const dark = vsc.type === 'dark' || (vsc.type !== 'light' && hexLuminance(bgHit || '#1e1e1e') < 0.4)
  const background = bgHit || (dark ? '#1e1e1e' : '#ffffff')
  const foreground = take(['editor.foreground', 'foreground'], dark ? '#d4d4d4' : '#1f1f1f')

  // Brand accent first (buttons/links/badges) — focusBorder is often muted
  // gray and makes imported accents look like the desktop default.
  const accent = take([
    'button.background',
    'textLink.activeForeground',
    'textLink.foreground',
    'activityBarBadge.background',
    'badge.background',
    'progressBar.background',
    'pickerGroup.foreground',
    'list.highlightForeground',
    'editorLink.activeForeground',
    'focusBorder',
    'tab.activeBorder',
    'statusBarItem.remoteBackground'
  ], mixHex(foreground, background, 0.55))

  const elevated = take([
    'editorWidget.background', 'dropdown.background', 'menu.background',
    'quickInput.background', 'editorSuggestWidget.background'
  ], mixHex(background, foreground, dark ? 0.08 : 0.05))

  const card = take([
    'sideBarSectionHeader.background', 'tab.inactiveBackground',
    'editorGroupHeader.tabsBackground'
  ], mixHex(background, foreground, dark ? 0.04 : 0.025))

  const sidebar = take(['sideBar.background', 'activityBar.background'], mixHex(background, foreground, dark ? 0.02 : 0.012))

  const border = take([
    'panel.border', 'editorGroup.border', 'sideBar.border', 'contrastBorder',
    'widget.border', 'input.border'
  ], mixHex(background, foreground, dark ? 0.16 : 0.14))

  const input = take(['input.background', 'dropdown.background', 'quickInput.background'], mixHex(background, foreground, dark ? 0.1 : 0.06))

  const mutedForeground = take([
    'descriptionForeground', 'editorLineNumber.foreground',
    'tab.inactiveForeground', 'disabledForeground'
  ], mixHex(foreground, background, 0.45))

  const destructive = take([
    'editorError.foreground', 'errorForeground',
    'editorOverviewRuler.errorForeground', 'notificationsErrorIcon.foreground'
  ], '#e25563')

  return {
    background,
    foreground,
    card,
    cardForeground: foreground,
    muted: mixHex(background, foreground, dark ? 0.06 : 0.04),
    mutedForeground,
    popover: elevated,
    popoverForeground: foreground,
    primary: accent,
    primaryForeground: readableOn(accent),
    secondary: mixHex(accent, background, dark ? 0.72 : 0.86),
    secondaryForeground: foreground,
    accent: mixHex(accent, background, dark ? 0.82 : 0.88),
    accentForeground: foreground,
    border,
    input,
    ring: accent,
    midground: accent,
    midgroundForeground: readableOn(accent),
    composerRing: accent,
    destructive,
    destructiveForeground: readableOn(destructive),
    sidebarBackground: sidebar,
    sidebarBorder: border,
    userBubble: mixHex(card, accent, dark ? 0.18 : 0.12),
    userBubbleBorder: border
  }
}

/* ── Start from current app theme ──────────────────────────────────────
 * The plugin cannot read ~/.hermes/skins/ (renderer has no fs, RPC is
 * closed), but the app writes the ACTIVE theme's resolved palette as CSS
 * custom properties on <html> (themes/context.tsx applyTheme: --theme-*
 * brand seeds + --dt-* tokens). Reading those gives the real rendered
 * colors of whatever skin is selected in Appearance — the live equivalent
 * of "scan the skins". */
const CSS_VARS = [
  '--theme-background-seed', '--theme-foreground', '--theme-primary',
  '--theme-secondary', '--theme-accent-soft', '--theme-midground',
  '--theme-sidebar-seed', '--theme-card-seed', '--theme-elevated-seed',
  '--theme-bubble-seed', '--dt-primary-foreground', '--dt-secondary-foreground',
  '--dt-accent-foreground', '--dt-border', '--dt-input', '--dt-ring',
  '--dt-muted', '--dt-composer-ring', '--dt-destructive',
  '--dt-destructive-foreground', '--dt-sidebar-border', '--dt-user-bubble-border'
]

/* Reconstruct a 26-token palette from a map of the app's theme CSS vars
 * ({'--theme-background-seed': '#161a22', ...}). Unset/invalid vars fall
 * back; text-on-surface tokens the app doesn't seed are derived with the
 * same recipes as the VS Code converter. */
function paletteFromCssVars(vars) {
  const get = (name, fallback) => {
    const v = vars && vars[name]
    return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim().toUpperCase() : String(fallback).toUpperCase()
  }
  const background = get('--theme-background-seed', DEFAULTS.background)
  const foreground = get('--theme-foreground', DEFAULTS.foreground)
  const primary = get('--theme-primary', DEFAULTS.primary)
  const accent = get('--theme-accent-soft', DEFAULTS.accent)
  const midground = get('--theme-midground', primary)
  const border = get('--dt-border', DEFAULTS.border)
  const destructive = get('--dt-destructive', DEFAULTS.destructive)

  return {
    background,
    foreground,
    card: get('--theme-card-seed', DEFAULTS.card),
    cardForeground: foreground,
    muted: get('--dt-muted', DEFAULTS.muted),
    mutedForeground: mixHex(foreground, background, 0.45),
    popover: get('--theme-elevated-seed', DEFAULTS.popover),
    popoverForeground: foreground,
    primary,
    primaryForeground: get('--dt-primary-foreground', readableOnWcag(primary)),
    secondary: get('--theme-secondary', DEFAULTS.secondary),
    secondaryForeground: get('--dt-secondary-foreground', foreground),
    accent,
    accentForeground: get('--dt-accent-foreground', readableOnWcag(accent)),
    midground,
    midgroundForeground: readableOnWcag(midground),
    composerRing: get('--dt-composer-ring', primary),
    ring: get('--dt-ring', primary),
    border,
    input: get('--dt-input', DEFAULTS.input),
    destructive,
    destructiveForeground: get('--dt-destructive-foreground', readableOnWcag(destructive)),
    sidebarBackground: get('--theme-sidebar-seed', DEFAULTS.sidebarBackground),
    sidebarBorder: get('--dt-sidebar-border', border),
    userBubble: get('--theme-bubble-seed', DEFAULTS.userBubble),
    userBubbleBorder: get('--dt-user-bubble-border', border)
  }
}

function buildTheme(palettes) {
  const colors = {}
  const dark = {}
  for (const [key] of TOKENS) {
    colors[key] = (palettes.light && palettes.light[key]) || DEFAULTS[key]
    dark[key] = (palettes.dark && palettes.dark[key]) || DEFAULTS[key]
  }
  return {
    name: THEME_NAME,
    label: 'Theme Studio',
    description: 'Live-edited in Theme Studio (theme-studio plugin)',
    colors, // light slot — the app's light/dark toggle picks between the two
    darkColors: dark
  }
}

/* Export one palette as a native Hermes skin (YAML). The skin format is
 * terminal-oriented: it can carry background/foreground/accent/border/
 * destructive/muted-text explicitly, plus status_bar_bg as a second surface
 * hint. The per-surface desktop tokens (sidebar, card, popover, bubbles)
 * CANNOT survive this format — the desktop's skin converter derives them by
 * mixing. So this export is the palette's *feel* for CLI/TUI/sharing, not
 * the studio's layered look (that stays in the plugin contribution).
 * The skin format is single-mode: export the palette of the tab you are on. */
function buildSkinYaml(palette, mode) {
  const q = (h) => `"${String(h || '').toUpperCase()}"`
  const fg = palette.foreground || DEFAULTS.foreground
  const accent = palette.primary || DEFAULTS.primary
  const border = palette.border || DEFAULTS.border
  const destructive = palette.destructive || DEFAULTS.destructive
  const dim = palette.mutedForeground || DEFAULTS.mutedForeground
  const bg = palette.background || DEFAULTS.background
  const sb = palette.sidebarBackground || DEFAULTS.sidebarBackground
  const skinName = `theme-studio-${mode}`

  return [
    `name: ${skinName}`,
    `description: Exported from Theme Studio (${mode} palette)`,
    '',
    'colors:',
    `  background: ${q(bg)}`,
    '',
    `  ui_accent: ${q(accent)}`,
    `  banner_accent: ${q(accent)}`,
    '',
    `  banner_title: ${q(fg)}`,
    `  banner_text: ${q(fg)}`,
    `  ui_text: ${q(fg)}`,
    `  banner_dim: ${q(dim)}`,
    `  banner_border: ${q(border)}`,
    `  ui_border: ${q(border)}`,
    '',
    '  ui_ok: "#7FD88F"',
    '  ui_warn: "#E5C07B"',
    `  ui_error: ${q(destructive)}`,
    '',
    `  prompt: ${q(fg)}`,
    `  input_rule: ${q(accent)}`,
    `  response_border: ${q(border)}`,
    `  status_bar_bg: ${q(sb)}`,
    `  status_bar_text: ${q(fg)}`,
    '  status_bar_good: "#7FD88F"',
    '  status_bar_warn: "#E5C07B"',
    `  status_bar_critical: ${q(destructive)}`,
    `  session_label: ${q(accent)}`,
    `  session_border: ${q(border)}`
  ].join('\n') + '\n'
}

export default {
  id: ID,
  name: 'Theme Studio',
  register(ctx) {
    // Module-level palette cache so re-registration (from the page) and the
    // initial registration share the same source of truth. Two palettes:
    // light (the app's light mode) and dark.
    const sanitize = (obj) => {
      const out = {}
      for (const [key] of TOKENS) {
        if (typeof obj[key] === 'string') out[key] = obj[key]
      }
      return out
    }
    const fromStored = (stored) => {
      if (stored && typeof stored === 'object') {
        if (stored.light && typeof stored.light === 'object' && stored.dark && typeof stored.dark === 'object') {
          // v2 shape — both palettes saved.
          return { light: { ...DEFAULTS, ...sanitize(stored.light) }, dark: { ...DEFAULTS, ...sanitize(stored.dark) } }
        }
        const flat = sanitize(stored)
        if (Object.keys(flat).length) {
          // v1 shape — one flat palette (dark); derive a matching light one.
          const dark = { ...DEFAULTS, ...flat }
          return { light: generatePalette(dark.primary, 'light'), dark }
        }
      }
      const dark = { ...DEFAULTS }
      return { light: generatePalette(dark.primary, 'light'), dark }
    }

    let palettes = fromStored(ctx.storage.get(STORAGE_KEY) || ctx.storage.get(LEGACY_STORAGE_KEY))

    /* Seed-mode state — persisted under its own key, validated on load:
     * unknown modes fall back to 'single', non-hex seed values are dropped.
     * Recovered garbage never touches the saved theme palettes. */
    const sanitizeSeeds = (raw) => {
      const out = {}
      if (!raw || typeof raw !== 'object') return out
      for (const [role] of SEED_ROLES) {
        const v = raw[role]
        if (typeof v === 'string' && hexToRgb(v)) out[role] = v.toUpperCase()
      }
      return out
    }
    const fromStoredSeeds = (stored) => {
      const mode = stored && GEN_MODES.some(([m]) => m === stored.mode) ? stored.mode : 'single'
      /* Contrast rides in the same storage object as the seeds; a missing
       * or corrupt value (old shape, non-numeric garbage) recovers to the
       * Balanced default without touching the theme palettes. */
      const rawContrast = stored && typeof stored.contrast === 'number' && isFinite(stored.contrast)
        ? stored.contrast
        : CONTRAST_DEFAULT
      const contrast = Math.min(1, Math.max(0, rawContrast))
      return { mode, seeds: sanitizeSeeds(stored && stored.seeds), contrast }
    }
    let seedState = fromStoredSeeds(ctx.storage.get(SEEDS_STORAGE_KEY))
    const persistSeeds = (next) => {
      seedState = next
      ctx.storage.set(SEEDS_STORAGE_KEY, next)
    }

    const persist = (next) => {
      palettes = next
      ctx.storage.set(STORAGE_KEY, next)
    }

    const registerTheme = () => {
      ctx.register({
        id: 'theme-studio-theme',
        area: THEMES_AREA,
        data: buildTheme(palettes)
      })
    }

    // Initial registration — the theme exists from the moment the plugin loads.
    registerTheme()

    // Page render, shared by the routes-area page and the palette command's
    // openWorkspace tab (both get the live palettes + registerTheme).
    const renderPage = () => jsx(ThemeStudioPage, {
      getPalettes: () => palettes,
      setPalettes: persist,
      registerTheme,
      getSeeds: () => seedState,
      setSeeds: persistSeeds
    })

    ctx.register({
      id: 'theme-studio-page',
      area: 'routes',
      data: { path: '/theme-studio' },
      render: renderPage
    })

    ctx.register({
      id: 'theme-studio-nav',
      area: 'sidebar.nav',
      data: {
        path: '/theme-studio',
        label: 'Theme Studio',
        codicon: 'paintcan'
      }
    })

    /* "Open Theme Studio": openWorkspace fronts the studio as a main-area
     * tab with an imperative revealTreePane (sdk/index.ts:1146), so it
     * surfaces in ANY workspace mode — Bot Mode included, where a bare
     * host.navigate('/theme-studio') only changes the hash and the page can
     * stay behind the focused pane's active tab (observed as a no-op).
     * Feature-detected: older desktops fall back to plain navigate. */
    const openStudio = () => {
      if (typeof host.openWorkspace === 'function') {
        host.openWorkspace(ID, {
          title: 'Theme Studio',
          render: renderPage
        })
      } else {
        host.navigate('/theme-studio')
      }
    }

    ctx.register({
      id: 'theme-studio-cmd',
      area: 'palette',
      data: {
        id: 'theme-studio-open',
        label: 'Open Theme Studio',
        keywords: ['theme', 'color', 'studio', 'skin'],
        run: openStudio
      }
    })
  }
}

const btn = {
  background: 'transparent',
  border: '1px solid var(--ui-stroke-secondary)',
  borderRadius: 6,
  padding: '4px 10px',
  fontSize: 12,
  cursor: 'pointer'
}

const selectStyle = {
  background: 'var(--ui-surface, transparent)',
  color: 'var(--ui-text-secondary)',
  border: '1px solid var(--ui-stroke-secondary)',
  borderRadius: 6,
  padding: '4px 8px',
  fontSize: 12,
  cursor: 'pointer'
}

function ThemeStudioPage({ getPalettes, setPalettes, registerTheme, getSeeds, setSeeds }) {
  const [palettes, setPalettesState] = useState(getPalettes())
  const [mode, setMode] = useState('dark')
  const [baseHex, setBaseHex] = useState((getPalettes().dark.primary || DEFAULTS.primary).toUpperCase())
  const [menuOpen, setMenuOpen] = useState(false)
  const [sourceLabel, setSourceLabel] = useState('Start from…')
  const fileRef = useRef(null)

  /* Multi-color seed state. Seeds persist under their own storage key and
   * are editable WITHOUT touching the saved theme palettes — only Generate
   * replaces the theme. Unknown stored modes/values are already sanitized
   * in register(); defaults keep every picker a valid color. */
  const seedInit = getSeeds ? getSeeds() : { mode: 'single', seeds: {}, contrast: CONTRAST_DEFAULT }
  const [genMode, setGenMode] = useState(seedInit.mode)
  const [seedColors, setSeedColors] = useState({
    base: seedInit.seeds.base || (getPalettes().dark.primary || DEFAULTS.primary).toUpperCase(),
    primary: seedInit.seeds.primary || DEFAULTS.primary,
    secondary: seedInit.seeds.secondary || DEFAULTS.secondary,
    highlight: seedInit.seeds.highlight || DEFAULTS.accent
  })
  const [contrast, setContrastState] = useState(
    typeof seedInit.contrast === 'number' && isFinite(seedInit.contrast) ? seedInit.contrast : CONTRAST_DEFAULT
  )

  const setSeed = (role, value) => {
    const next = { ...seedColors, [role]: value }
    setSeedColors(next)
    if (setSeeds) setSeeds({ mode: genMode, seeds: next, contrast })
  }
  const changeGenMode = (m) => {
    setGenMode(m)
    if (setSeeds) setSeeds({ mode: m, seeds: seedColors, contrast })
  }
  /* Slider drag: local state + persistence ONLY — the saved theme palettes
   * are not touched until Generate is clicked. */
  const changeContrast = (value) => {
    const next = Math.min(1, Math.max(0, value))
    setContrastState(next)
    if (setSeeds) setSeeds({ mode: genMode, seeds: seedColors, contrast: next })
  }

  const apply = (key, value) => {
    const next = { ...palettes, [mode]: { ...palettes[mode], [key]: value } }
    setPalettesState(next)
    setPalettes(next)
    registerTheme() // re-register -> registryVersion bump -> live repaint
  }

  /* Merge a partial {light?, dark?} patch, persist, repaint. */
  const loadPalettes = (patch, note) => {
    const next = { light: { ...palettes.light }, dark: { ...palettes.dark }, ...patch }
    setPalettesState(next)
    setPalettes(next)
    registerTheme()
    if (note) host.notify({ kind: 'success', message: note })
  }

  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(buildTheme(palettes), null, 2))
      host.notify({ kind: 'success', message: 'Theme JSON copied to clipboard (light + dark palettes)' })
    } catch {
      host.notify({ kind: 'error', message: 'Clipboard write failed' })
    }
  }

  /* Download the active palette as a native Hermes skin. The renderer
   * cannot write to ~/.hermes/skins/ directly, so this saves
   * theme-studio-<mode>.yaml to the OS Downloads folder; the toast explains
   * the two-step activation. */
  const exportSkinFile = () => {
    try {
      const blob = new Blob([buildSkinYaml(palettes[mode], mode)], { type: 'text/yaml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `theme-studio-${mode}.yaml`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      host.notify({
        kind: 'success',
        message: `theme-studio-${mode}.yaml downloaded. Move it to ~/.hermes/skins/ then run: hermes config set display.skin theme-studio-${mode}`
      })
    } catch {
      host.notify({ kind: 'error', message: 'Skin export failed' })
    }
  }

  /* Accept a parsed JSON object and return a {light?, dark?} patch:
   *   1. Full Hermes theme  {colors: {…}, darkColors: {…}} — both slots
   *   2. Bare Hermes map    {background, …} — lands in the active slot
   *   3. VS Code theme      {type: 'dark', colors: {editor.background, …}}
   *      (also matched by dotted key names) — converted, active slot
   * Throws when nothing matches, so an unsupported file errors instead of
   * silently loading an unchanged palette. */
  const applyParsed = (parsed) => {
    if (!parsed || typeof parsed !== 'object') throw new Error('not a theme')
    const colors = parsed.colors && typeof parsed.colors === 'object' ? parsed.colors : parsed

    // VS Code theme: explicit type field, or dotted workbench key names.
    const looksVsc = parsed.type === 'dark' || parsed.type === 'light' ||
      Object.keys(colors).some((k) => k.includes('.'))
    if (looksVsc) {
      const converted = convertVscToPalette(parsed)
      return { [mode]: { ...palettes[mode], ...converted } }
    }

    const pick = (obj) => {
      const out = {}
      for (const [key] of TOKENS) {
        if (typeof obj[key] === 'string') out[key] = obj[key]
      }
      return out
    }
    const countMatches = (obj) => TOKENS.reduce((n, [k]) => n + (typeof obj[k] === 'string' ? 1 : 0), 0)

    const darkColors = parsed.darkColors && typeof parsed.darkColors === 'object' ? parsed.darkColors : null
    if (darkColors && countMatches(colors) + countMatches(darkColors) > 0) {
      // Full Hermes export — carries both palettes.
      return { light: { ...palettes.light, ...pick(colors) }, dark: { ...palettes.dark, ...pick(darkColors) } }
    }

    if (countMatches(colors) === 0) throw new Error('no recognized theme keys')
    return { [mode]: { ...palettes[mode], ...pick(colors) } }
  }

  const importFromFile = (file) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const patch = applyParsed(JSON.parse(String(reader.result)))
        const which = patch.light && patch.dark ? 'light + dark palettes' : `${mode} palette`
        loadPalettes(patch, `Imported ${file.name} — ${which} now active`)
      } catch {
        host.notify({ kind: 'error', message: `${file.name} is not a Hermes or VS Code theme JSON` })
      }
    }
    reader.onerror = () => host.notify({ kind: 'error', message: 'Could not read the file' })
    reader.readAsText(file)
  }

  const importFromClipboard = async () => {
    try {
      const patch = applyParsed(JSON.parse(await navigator.clipboard.readText()))
      const which = patch.light && patch.dark ? 'light + dark palettes' : `${mode} palette`
      loadPalettes(patch, `Theme imported — ${which} now active`)
    } catch {
      host.notify({ kind: 'error', message: 'Clipboard does not contain a valid theme' })
    }
  }

  const loadPreset = (name) => {
    loadPalettes({ [mode]: { ...(PRESETS[name] || DEFAULTS) } }, `Loaded preset: ${name} (${mode} palette)`)
  }

  /* Read the app's ACTIVE theme (whatever skin is selected in Appearance)
   * from its live CSS variables and load it as the starting palette. The
   * app sets data-hermes-mode ('light'|'dark') on <html> — load into that
   * slot so the imported palette matches what is on screen. */
  const startFromCurrentTheme = () => {
    const root = document.documentElement
    const cs = getComputedStyle(root)
    const vars = {}
    for (const name of CSS_VARS) vars[name] = cs.getPropertyValue(name).trim()
    const palette = paletteFromCssVars(vars)
    const slot = root.dataset.hermesMode === 'light' ? 'light' : 'dark'
    loadPalettes({ [slot]: palette }, `Started from the current app theme (${slot})`)
    setMode(slot)
    setSourceLabel('Current app theme')
  }

  const pickStart = (id) => {
    setMenuOpen(false)
    if (id === 'current') {
      startFromCurrentTheme()
      return
    }
    loadPreset(id)
    setSourceLabel(id === 'defaults' ? 'Studio defaults' : id)
  }

  const generate = () => {
    const valid = (hex, fallback) => (/^#[0-9a-fA-F]{6}$/.test(hex || '') ? hex : fallback)
    if (genMode === 'single') {
      const hex = valid(baseHex, DEFAULTS.primary)
      loadPalettes(
        { light: generatePalette(hex, 'light'), dark: generatePalette(hex, 'dark') },
        `Generated light + dark palettes from ${hex.toUpperCase()}`
      )
      return
    }
    const base = valid(seedColors.base, DEFAULTS.primary)
    const count = genMode === 'multi4' ? 4 : 3
    const seeds = {
      primary: valid(seedColors.primary, base),
      secondary: valid(seedColors.secondary, base)
    }
    if (count === 4) seeds.highlight = valid(seedColors.highlight, base)
    seeds.contrast = contrast
    loadPalettes(
      { light: generatePalette(base, 'light', seeds), dark: generatePalette(base, 'dark', seeds) },
      `Generated light + dark palettes from ${count} seed colors`
    )
  }

  const modeBtn = (m, label) => jsx('button', {
    key: m,
    type: 'button',
    onClick: () => setMode(m),
    style: {
      ...btn,
      padding: '3px 14px',
      fontWeight: mode === m ? 700 : 400,
      background: mode === m ? 'var(--ui-accent)' : 'transparent',
      borderColor: mode === m ? 'var(--ui-accent)' : 'var(--ui-stroke-secondary)',
      color: mode === m ? '#161a22' : 'var(--ui-text-tertiary)'
    },
    children: label
  })

  return jsx('div', {
    style: { display: 'grid', gap: 12, padding: 20, maxWidth: 860 },
    children: [
      jsx('div', {
        key: 'header',
        style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
        children: [
          jsx('div', {
            children: [
              jsx('div', { style: { fontWeight: 700, fontSize: 15, color: 'var(--ui-text-secondary)' }, children: 'Theme Studio' }),
              jsx('div', { style: { fontSize: 12, color: 'var(--ui-text-quaternary)' }, children: 'Pick a color — the app repaints instantly. Select "Theme Studio" in Appearance to keep it active.' })
            ]
          }),
          jsx('div', { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: [
            jsx('div', {
              key: 'start-menu',
              style: { position: 'relative' },
              children: [
                jsx('button', {
                  type: 'button',
                  onClick: () => setMenuOpen(!menuOpen),
                  title: 'Start from a preset or the app\u2019s current theme',
                  style: { ...selectStyle, display: 'flex', alignItems: 'center', gap: 6 },
                  children: [
                    jsx('span', { children: sourceLabel }),
                    jsx('span', { style: { fontSize: 9, color: 'var(--ui-text-quaternary)' }, children: menuOpen ? '\u25B2' : '\u25BC' })
                  ]
                }),
                menuOpen ? [
                  jsx('div', {
                    key: 'backdrop',
                    onClick: () => setMenuOpen(false),
                    style: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }
                  }),
                  jsx('div', {
                    key: 'menu',
                    style: {
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      zIndex: 1000,
                      minWidth: 190,
                      background: 'var(--ui-bg-elevated)',
                      border: '1px solid var(--ui-stroke-secondary)',
                      borderRadius: 8,
                      padding: 4,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
                    },
                    children: START_OPTIONS.map((o) =>
                      jsx('button', {
                        key: o.id,
                        type: 'button',
                        onClick: () => pickStart(o.id),
                        className: 'hover:bg-(--chrome-action-hover)',
                        style: {
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          background: 'transparent',
                          border: 'none',
                          borderRadius: 6,
                          padding: '6px 10px',
                          fontSize: 12,
                          color: 'var(--ui-text-secondary)',
                          cursor: 'pointer'
                        },
                        children: o.label
                      })
                    )
                  })
                ] : null
              ]
            }),
            jsx('input', {
              key: 'file',
              ref: fileRef,
              type: 'file',
              accept: '.json,application/json',
              style: { display: 'none' },
              onChange: (e) => {
                const f = e.target.files && e.target.files[0]
                if (f) importFromFile(f)
                e.target.value = '' // allow re-picking the same file
              }
            }),
            jsx('button', {
              type: 'button',
              onClick: () => fileRef.current && fileRef.current.click(),
              style: { ...btn, color: 'var(--ui-text-tertiary)' },
              children: 'Import file…'
            }),
            jsx('button', {
              type: 'button',
              onClick: importFromClipboard,
              title: 'Paste a theme JSON from the clipboard',
              style: { ...btn, color: 'var(--ui-text-quaternary)' },
              children: 'Clipboard'
            }),
            jsx('button', {
              type: 'button',
              onClick: copyExport,
              style: { ...btn, color: 'var(--ui-text-tertiary)' },
              children: 'Export JSON'
            }),
            jsx('button', {
              type: 'button',
              onClick: exportSkinFile,
              title: 'Download the active palette as a native Hermes skin (YAML) — appears under Appearance after activation',
              style: { ...btn, color: 'var(--ui-accent)', fontWeight: 600 },
              children: 'Export skin…'
            })
          ]})
        ]
      }),
      jsx('div', {
        key: 'generator',
        style: {
          border: '1px solid var(--ui-stroke-secondary)',
          borderRadius: 8,
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap'
        },
        children: [
          jsx('div', { style: { fontWeight: 600, fontSize: 12.5, color: 'var(--ui-text-secondary)' }, children: 'Generate from seed colors' }),
          jsx('select', {
            'data-role': 'gen-mode',
            value: genMode,
            onChange: (e) => changeGenMode(e.target.value),
            title: 'How many seed colors to generate with',
            style: selectStyle,
            children: GEN_MODES.map(([m, label]) => jsx('option', { key: m, value: m, children: label }))
          }),
          genMode === 'single' ? [
            jsx('input', {
              key: 'single-color',
              type: 'color',
              value: baseHex,
              onChange: (e) => setBaseHex(e.target.value),
              style: { width: 44, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }
            }),
            jsx('span', { key: 'single-hex', style: { fontFamily: MONO, fontSize: 11, color: 'var(--ui-text-quaternary)' }, children: baseHex })
          ] : SEED_ROLES
            .filter(([role]) => role !== 'highlight' || genMode === 'multi4')
            .map(([role, label]) =>
              jsx('div', {
                key: role,
                style: { display: 'flex', alignItems: 'center', gap: 6 },
                children: [
                  jsx('input', {
                    type: 'color',
                    'data-seed-role': role,
                    value: seedColors[role] || '#000000',
                    onChange: (e) => setSeed(role, e.target.value),
                    style: { width: 40, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }
                  }),
                  jsx('span', { style: { fontSize: 11, color: 'var(--ui-text-tertiary)' }, children: label }),
                  jsx('span', { style: { fontFamily: MONO, fontSize: 11, color: 'var(--ui-text-quaternary)' }, children: (seedColors[role] || '').toUpperCase() })
                ]
              })
            ),
          /* Contrast dial — 3/4-color generation only. In single mode the
           * scope is labeled instead of rendering an inert control. */
          genMode === 'single'
            ? jsx('span', {
                key: 'contrast-scope',
                'data-role': 'contrast-scope',
                style: { fontSize: 11, color: 'var(--ui-text-quaternary)' },
                children: 'Contrast: 3/4-color modes only'
              })
            : jsx('span', {
                key: 'contrast',
                style: { display: 'flex', alignItems: 'center', gap: 6 },
                children: [
                  jsx('label', {
                    key: 'contrast-label',
                    htmlFor: 'ts-contrast',
                    style: { fontSize: 11, color: 'var(--ui-text-tertiary)' },
                    children: 'Contrast'
                  }),
                  jsx('input', {
                    key: 'contrast-range',
                    id: 'ts-contrast',
                    type: 'range',
                    min: 0,
                    max: 100,
                    step: 1,
                    value: Math.round(contrast * 100),
                    'data-role': 'contrast',
                    title: 'Surface separation and text punch \u2014 applied to the generated palettes when you click Generate (Soft \u2013 Balanced \u2013 Crisp)',
                    onChange: (e) => changeContrast(Number(e.target.value) / 100),
                    style: { width: 120, cursor: 'pointer' }
                  }),
                  jsx('span', {
                    key: 'contrast-value',
                    'data-role': 'contrast-value',
                    title: 'Current contrast setting (50 = Balanced = the classic recipe)',
                    style: { fontFamily: MONO, fontSize: 11, color: 'var(--ui-text-tertiary)', minWidth: 78 },
                    children: `${CONTRAST_LABEL(contrast)} \u00B7 ${Math.round(contrast * 100)}`
                  }),
                  jsx('button', {
                    key: 'contrast-reset',
                    type: 'button',
                    'data-role': 'contrast-reset',
                    onClick: () => changeContrast(CONTRAST_DEFAULT),
                    title: 'Reset contrast to Balanced (50)',
                    style: { ...btn, padding: '2px 8px', fontSize: 11, color: 'var(--ui-text-tertiary)' },
                    children: 'Reset'
                  })
                ]
              }),
          jsx('button', {
            type: 'button',
            onClick: generate,
            style: { ...btn, color: 'var(--ui-accent)', fontWeight: 600 },
            children: 'Generate light + dark'
          }),
          jsx('span', {
            style: { fontSize: 11.5, color: 'var(--ui-text-quaternary)' },
            children: genMode === 'single'
              ? 'One color in — all 26 tokens for both modes derive from it (hue-matched neutrals, WCAG 4.5:1 on text and accent).'
              : 'Each seed drives its own token family in light AND dark — base → visibly tinted surfaces, primary → exact accent fill with its own readable ink and brand stroke, secondary → exact fill plus the blue family (user bubble, rings, border tint), highlight → soft accent pastel. Fill colors stay exactly as picked; companion inks and strokes are contrast-matched separately. The Contrast dial (Soft–Balanced–Crisp) tunes surface separation and text punch when you Generate; 50 = Balanced = the classic recipe, and text never drops below WCAG 4.5:1. Picking seeds never changes the theme until you Generate.'
          })
        ]
      }),
      jsx('div', {
        key: 'mode',
        style: { display: 'flex', alignItems: 'center', gap: 8 },
        children: [
          jsx('span', { style: { fontSize: 12, color: 'var(--ui-text-tertiary)' }, children: 'Editing:' }),
          modeBtn('dark', 'Dark'),
          modeBtn('light', 'Light'),
          jsx('span', { style: { fontSize: 11.5, color: 'var(--ui-text-quaternary)' }, children: 'The app\u2019s light/dark toggle picks between these two palettes.' })
        ]
      }),
      jsx('div', {
        key: 'grid',
        style: {
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 8
        },
        children: TOKENS.map(([key, label]) =>
          jsx('label', {
            key,
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 10px',
              border: '1px solid var(--ui-stroke-secondary)',
              borderRadius: 6,
              cursor: 'pointer'
            },
            children: [
              jsx('input', {
                type: 'color',
                value: palettes[mode][key] || '#000000',
                onChange: (e) => apply(key, e.target.value),
                style: {
                  width: 34,
                  height: 26,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: 0
                }
              }),
              jsx('span', { style: { flex: 1, fontSize: 12, color: 'var(--ui-text-secondary)' }, children: label }),
              jsx('span', { style: { fontFamily: MONO, fontSize: 11, color: 'var(--ui-text-quaternary)' }, children: (palettes[mode][key] || '#000000').toUpperCase() })
            ]
          })
        )
      }),
      jsx('div', {
        key: 'tip',
        style: { fontSize: 11.5, color: 'var(--ui-text-quaternary)', lineHeight: 1.5 },
        children: 'Import accepts Hermes theme JSON (from Export — carries both palettes) or VS Code color-theme JSON (lands in the palette you are editing). Presets and single-palette imports fill the active tab. Palettes persist across reloads (plugin storage).'
      })
    ]
  })
}
