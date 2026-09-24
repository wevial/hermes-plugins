// Cosmos Skin — station wallpaper, lavender glow rims and a pixel wordmark for
// the Cosmos theme. © 2026 Ko Vial, MIT. Silkscreen font © The Silkscreen
// Project Authors, SIL OFL 1.1 (assets/OFL-Silkscreen.txt).
import { PALETTE_AREA, host } from '@hermes/plugin-sdk'

const WALLPAPER_FILE = 'nebula-station.webp'
const FONT_FILE = 'silkscreen.woff2'
const SPARKLE_FILE = 'sparkle.png'

// Everything is scoped to the Cosmos theme so enabling the skin on another
// palette changes nothing. Native sizes, padding, hit areas, drag regions and
// body fonts are preserved; only paint changes. Overlays that must sit above
// opaque pane children are pointer-transparent ::after rims (same approach as
// Retroma Tactile) so geometry and scrolling are untouched.
export const skinCss = ({ wallpaper, font, sparkle }) => `
${font ? `@font-face { font-family: 'Nebula Pixel'; src: url(${font}) format('woff2'); font-display: swap; }` : ''}
:root[data-hermes-theme="nebula"] {
  --nebula-rim: var(--dt-border);
  --nebula-glow: 0 0 10px color-mix(in srgb, var(--nebula-lavender) 35%, transparent);
  --nebula-frame: inset 0 0 0 1px var(--nebula-rim);
  --nebula-veil: 0.42;
  --nebula-sidebar-keep: 96%;
}
:root[data-hermes-theme="nebula"][data-hermes-mode="light"] {
  --nebula-veil: 0.78;
  --nebula-glow: 0 0 12px color-mix(in srgb, var(--nebula-lavender) 45%, transparent);
}
/* Wallpaper: painted once on the window shell, behind everything. Glass mode
   owns the same layer; if the user has glass on, the host's !important keeps
   it transparent and the wallpaper simply does not show. */
${wallpaper ? `
:root[data-hermes-theme="nebula"] [data-contrib-shell] {
  background-image: url(${wallpaper});
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}` : ''}
/* Content surfaces become a veil over the wallpaper instead of solid fills.
   The sidebar stays almost opaque like the mockup; the status bar stays solid. */
:root[data-hermes-theme="nebula"] [data-contrib-shell] {
  --ui-chat-surface-background: rgb(from var(--theme-background-seed) r g b / var(--nebula-veil));
  --ui-editor-surface-background: rgb(from var(--theme-card-seed) r g b / var(--nebula-veil));
  --ui-sidebar-surface-background: color-mix(in srgb, var(--theme-sidebar-seed) var(--nebula-sidebar-keep), transparent);
}
:root[data-hermes-theme="nebula"] [data-slot="sidebar-wrapper"] {
  background-color: transparent;
}
/* Bot Mode: the roster is a pane tree-group painting the EDITOR surface, not
   the sessions sidebar. Give that group the sidebar's near-opaque fill so bot
   rows and previews sit on a panel, not on raw wallpaper. */
:root[data-hermes-theme="nebula"] [data-contrib-shell] [data-tree-group]:has([data-slot="bots-roster"]) {
  --ui-editor-surface-background: color-mix(in srgb, var(--theme-sidebar-seed) var(--nebula-sidebar-keep), transparent);
  --ui-chat-surface-background: color-mix(in srgb, var(--theme-sidebar-seed) var(--nebula-sidebar-keep), transparent);
  background-color: color-mix(in srgb, var(--theme-sidebar-seed) var(--nebula-sidebar-keep), transparent);
}
:root[data-hermes-theme="nebula"] [data-slot="statusbar"] {
  --ui-sidebar-surface-background: var(--theme-background-seed);
  font-family: var(--dt-font-mono);
  letter-spacing: 0.02em;
}
/* Top edge: the header band lets the wallpaper through; tabs get a faint tint. */
:root[data-hermes-theme="nebula"] [data-tree-group][data-window-top="true"] > [data-panel-header] {
  --pane-tab-strip-bg: color-mix(in srgb, var(--theme-card-seed) 45%, transparent);
  --pane-tab-active-bg: color-mix(in srgb, var(--theme-card-seed) 80%, transparent);
  background-color: transparent;
}
:root[data-hermes-theme="nebula"] [data-tree-group][data-window-top="true"]:not(:has(> [data-panel-header])) {
  background-color: transparent;
}
/* Lavender rims with a soft glow: sidebar, pane bodies, composer. Painted by
   pointer-transparent overlays so opaque kept-alive panes cannot cover them. */
:root[data-hermes-theme="nebula"] [data-tour="sessions-sidebar"]::after,
:root[data-hermes-theme="nebula"] [data-tree-group] > div.relative.flex-1.overflow-hidden::after,
:root[data-hermes-theme="nebula"] [data-slot="composer-surface"]::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 7;
  pointer-events: none;
  border-radius: 0;
  box-shadow: var(--nebula-frame), inset var(--nebula-glow);
}
:root[data-hermes-theme="nebula"] [data-slot="composer-surface"]::after {
  border-radius: inherit;
}
/* Rounded content bodies like Retroma. The overlay's outer ring is trimmed
   by PaneBody's overflow-hidden, leaving indigo corner wedges above any
   kept-alive pane host; the box, hit-testing and scrolling are unchanged. */
:root[data-hermes-theme="nebula"] [data-tree-group] > div.relative.flex-1.overflow-hidden::after {
  border-radius: 12px;
  box-shadow: 0 0 0 12px var(--theme-background-seed), var(--nebula-frame), inset var(--nebula-glow);
}
/* The sessions list is its own scrolling well: give it a rounded rim too. */
:root[data-hermes-theme="nebula"] [data-tour="sessions-sidebar"] [data-sessions-mode] {
  border-radius: 12px;
  box-shadow: var(--nebula-frame), inset var(--nebula-glow);
  background-color: color-mix(in srgb, var(--theme-card-seed) 45%, transparent);
}
:root[data-hermes-theme="nebula"] [data-slot="composer-surface"] {
  border-color: var(--nebula-rim) !important;
  box-shadow: var(--nebula-glow);
}
:root[data-hermes-theme="nebula"] [data-slot="composer-surface"]:focus-within {
  box-shadow: 0 0 14px color-mix(in srgb, var(--nebula-lavender) 45%, transparent);
}
/* Navigation chips: rounder, outlined in the row's own hue (set by the theme)
   with a matching glow; the selected row brightens. */
:root[data-hermes-theme="nebula"] [data-tour="sessions-sidebar"] [data-sidebar="menu-button"]:has([data-tour^="sidebar-nav-"]) {
  border-radius: 10px;
  background-color: color-mix(in srgb, var(--theme-card-seed) 60%, transparent);
  box-shadow: 0 0 8px color-mix(in srgb, var(--nebula-row-ink, var(--nebula-lavender)) 30%, transparent);
}
:root[data-hermes-theme="nebula"] [data-tour="sessions-sidebar"] [data-sidebar="menu-button"]:has([data-tour^="sidebar-nav-"])[class~="bg-(--ui-control-active-background)"] {
  border-color: var(--nebula-row-ink, var(--nebula-lavender));
  background-color: var(--theme-accent-soft);
  box-shadow: 0 0 12px color-mix(in srgb, var(--nebula-row-ink, var(--nebula-lavender)) 50%, transparent);
}
/* Session rows: rounded like Retroma; hover and the active row get a rim. */
:root[data-hermes-theme="nebula"] [data-tour="sessions-sidebar"] [data-slot="row-button"] {
  border-radius: 8px;
}
:root[data-hermes-theme="nebula"] [data-tour="sessions-sidebar"] [data-slot="row-button"]:hover {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--nebula-rim) 40%, transparent);
}
:root[data-hermes-theme="nebula"] [data-tour="sessions-sidebar"] [data-slot="row-button"][class~="bg-(--ui-row-active-background)"] {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--nebula-rim) 60%, transparent), var(--nebula-glow);
}
/* Section caption glyph: the native 8px dithered square becomes the sparkle,
   painted by an overlay so the caption's geometry is unchanged. */
${sparkle ? `
:root[data-hermes-theme="nebula"] [data-tour="sessions-sidebar"] span[class~="tracking-[0.16em]"] > span.dither {
  position: relative;
  background: none;
}
:root[data-hermes-theme="nebula"] [data-tour="sessions-sidebar"] span[class~="tracking-[0.16em]"] > span.dither::after {
  content: "";
  position: absolute;
  inset: -4px;
  pointer-events: none;
  background: url(${sparkle}) center / contain no-repeat;
}` : ''}
/* Inline widgets (files-changed card, clarify) sit on a veil over the scene
   with a rim, instead of the opaque widget surface. */
:root[data-hermes-theme="nebula"] [data-contrib-shell] {
  --ui-widget-surface-background: color-mix(in srgb, var(--theme-card-seed) 55%, transparent);
}
:root[data-hermes-theme="nebula"] [data-slot="aui_changed-files"] {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--nebula-rim) 60%, transparent);
}
/* User bubble: lavender-tinted, outlined, like the mockup. Assistant text
   stays unboxed on the scene; code cards get a translucent dark card. */
:root[data-hermes-theme="nebula"] [data-slot="aui_user-message-root"] .composer-human-message {
  border-color: var(--dt-user-bubble-border);
  box-shadow: var(--nebula-glow);
}
/* Code and diff text need a solid reading surface over the wallpaper.
   Keep diff add/remove tints on their child rows, not on the backdrop. */
:root[data-hermes-theme="nebula"] :is([data-slot="code-card"], [data-slot="diff-lines"], [data-slot="file-diff-panel"]) {
  --ui-bg-editor: rgb(from var(--theme-card-seed) r g b / 1);
  --expandable-fade-from: var(--ui-bg-editor);
  background-color: var(--ui-bg-editor) !important;
}
:root[data-hermes-theme="nebula"] [data-slot="code-card"] {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--nebula-rim) 60%, transparent);
}
/* The empty-chat wordmark in the pixel face; body text is untouched. */
${font ? `
:root[data-hermes-theme="nebula"] .wordmark {
  font-family: 'Nebula Pixel', var(--dt-font-sans, sans-serif);
  letter-spacing: 0.12em;
  color: var(--nebula-lavender);
  text-shadow: 0 0 12px color-mix(in srgb, var(--nebula-lavender) 60%, transparent);
}` : ''}
/* Scrollbar thumb in lavender rather than the foreground-derived grey. */
:root[data-hermes-theme="nebula"] {
  --dt-scrollbar-thumb: var(--nebula-lavender);
}
`

async function loadAsset(file) {
  const desktop = globalThis.window?.hermesDesktop
  if (!desktop?.desktopPluginsRoot || !desktop?.readFileDataUrl) return null
  const root = await desktop.desktopPluginsRoot()
  if (!root) return null
  return desktop.readFileDataUrl(`${root}/nebula-skin/assets/${file}`)
}

export default {
  id: 'nebula-skin', name: 'Cosmos Skin', defaultEnabled: false,
  description: 'Optional station wallpaper, lavender glow rims and pixel wordmark for the Cosmos theme. Remembers your palette command choice.',
  register(ctx) {
    let style = null
    let disposed = false
    let userChanged = false
    let assets = null
    let pendingSave = Promise.resolve()
    const removeStyle = () => { style?.remove(); style = null }
    const loadAssets = async () => {
      if (assets) return assets
      const [wallpaper, font, sparkle] = await Promise.all([loadAsset(WALLPAPER_FILE), loadAsset(FONT_FILE), loadAsset(SPARKLE_FILE)].map(p => p.catch(() => null)))
      assets = { wallpaper, font, sparkle }
      if (!wallpaper && !disposed) host.notify({ kind: 'error', message: 'Cosmos wallpaper could not be read; the skin is on without it. Is assets/nebula-station.webp installed?' })
      return assets
    }
    const apply = async enabled => {
      if (disposed) return
      if (!enabled) { removeStyle(); return }
      if (style) return
      const loaded = await loadAssets()
      if (disposed || style) return
      style = document.createElement('style')
      style.dataset.nebulaSkin = ''
      style.textContent = skinCss(loaded)
      document.head.append(style)
    }
    const choose = enabled => {
      if (disposed) return
      userChanged = true
      const applied = apply(enabled)
      pendingSave = pendingSave.then(() => applied).then(() => ctx.storage.set('enabled', enabled))
        .then(() => {
          if (!disposed) host.notify({ kind: 'info', message: enabled
            ? 'Cosmos skin is ON (shows with the Cosmos theme) and will be restored next launch.'
            : 'Cosmos skin is OFF. Theme and fonts are unchanged.' })
        }).catch(() => {
          if (!disposed) host.notify({ kind: 'error', message: 'Cosmos skin changed, but its preference could not be saved.' })
        })
      return pendingSave
    }
    const disable = () => choose(false)
    const enable = () => choose(true)
    Promise.resolve().then(() => ctx.storage.get('enabled')).then(enabled => {
      if (!userChanged && !disposed) return apply(enabled === true)
    }).catch(() => {
      if (!disposed && !userChanged) host.notify({ kind: 'error', message: 'Could not restore the Cosmos skin preference; use the palette to enable it.' })
    })
    for (const [id, label, run] of [
      ['enable', 'Enable Cosmos skin', enable],
      ['disable', 'Disable Cosmos skin', disable],
      ['toggle', 'Toggle Cosmos skin', () => style ? disable() : enable()]
    ]) ctx.register({ id, area: PALETTE_AREA, data: { label, keywords: ['cosmos', 'nebula', 'space', 'skin', 'wallpaper'], run } })
    ctx.onDispose(() => { disposed = true; removeStyle() })
  }
}
