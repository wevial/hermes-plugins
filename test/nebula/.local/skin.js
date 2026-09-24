// Cosmos Skin — station wallpaper, lavender glow rims and a glowing wordmark for
// the Cosmos theme. © 2026 Ko Vial, MIT. Silkscreen font © The Silkscreen
// Project Authors, SIL OFL 1.1 (assets/OFL-Silkscreen.txt).
import { PALETTE_AREA, host } from 'data:text/javascript;base64,ZXhwb3J0IGNvbnN0IFRIRU1FU19BUkVBPSd0aGVtZXMnOyBleHBvcnQgY29uc3QgUEFMRVRURV9BUkVBPSJwYWxldHRlIjsgZXhwb3J0IGNvbnN0IGhvc3Q9e25vdGlmeTpuPT5nbG9iYWxUaGlzLm5vdGlmaWNhdGlvbnMucHVzaChuKX07'

const WALLPAPER_FILE = 'nebula-station.webp'
const SPACE_FILE = 'cosmos-space.webp'
const SPARKLE_FILE = 'sparkle.png'

// Everything is scoped to the Cosmos theme so enabling the skin on another
// palette changes nothing. Native sizes, padding, hit areas, drag regions and
// body fonts are preserved; only paint changes. Overlays that must sit above
// opaque pane children are pointer-transparent ::after rims (same approach as
// Retroma Tactile) so geometry and scrolling are untouched.
export const skinCss = ({ wallpaper, sparkle }) => `
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
/* Stronger tab and sidebar hierarchy without changing session text. */
:root[data-hermes-theme="nebula"] [data-tree-tab],
:root[data-hermes-theme="nebula"] [data-tree-tab] .font-medium {
  font-weight: 700;
}
:root[data-hermes-theme="nebula"][data-hermes-mode="dark"] [data-tour="sessions-sidebar"] [data-sessions-project] [data-slot="row-button"].p-0 > span {
  color: #d5b8ff;
  font-weight: 600;
}
:root[data-hermes-theme="nebula"][data-hermes-mode="dark"] [data-tour="sessions-sidebar"] span[class~="tracking-[0.16em]"] {
  color: color-mix(in srgb, var(--nebula-lavender) 78%, #f4f1ff);
}
/* Top edge: the header band lets the wallpaper through; tabs get a faint tint. */
:root[data-hermes-theme="nebula"] [data-tree-group][data-window-top="true"] > [data-panel-header] {
  --pane-tab-strip-bg: color-mix(in srgb, var(--theme-card-seed) 30%, transparent);
  --pane-tab-active-bg: color-mix(in srgb, var(--theme-card-seed) 65%, transparent);
  background-color: transparent;
}
/* The strip paints its own opaque sidebar fill and resets the active-tab
   token. Override that child layer as well as the surrounding header. */
:root[data-hermes-theme="nebula"] [data-tree-group][data-window-top="true"] [data-zone-tabstrip] {
  --pane-tab-strip-bg: color-mix(in srgb, var(--theme-card-seed) 30%, transparent);
  --pane-tab-active-bg: color-mix(in srgb, var(--theme-card-seed) 65%, transparent);
  background-color: transparent;
}
/* Clear the group behind the header too, including the Bot Mode override.
   Content panes retain their own editor/sidebar fills and inherited tokens. */
:root[data-hermes-theme="nebula"] [data-contrib-shell] [data-tree-group][data-window-top="true"] {
  background-color: transparent;
}
/* Move the removed backing layer below the header, preserving content contrast. */
:root[data-hermes-theme="nebula"] [data-contrib-shell] [data-tree-group][data-window-top="true"] > .relative.min-h-0.min-w-0.flex-1.overflow-hidden {
  background-color: var(--ui-editor-surface-background);
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
/* Session rows keep soft corners; native fills/focus provide state feedback. */
:root[data-hermes-theme="nebula"] [data-tour="sessions-sidebar"] [data-slot="row-button"] {
  border-radius: 8px;
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
/* Preserve native wordmark typography; only its color and glow are themed. */
:root[data-hermes-theme="nebula"] .wordmark {
  color: var(--nebula-lavender);
  text-shadow: 0 0 12px color-mix(in srgb, var(--nebula-lavender) 60%, transparent);
}
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
  description: 'Optional station wallpaper, lavender glow rims and glowing wordmark for the Cosmos theme. Remembers your palette command choice.',
  register(ctx) {
    let style = null
    let disposed = false
    let userChanged = false
    let assets = null
    let enabledState = false
    let background = 'station'
    let backgroundChanged = false
    let paintVersion = 0
    let pendingSave = Promise.resolve()
    const removeStyle = () => { style?.remove(); style = null }
    const loadAssets = async () => {
      if (assets) return assets
      const [wallpaper, space, sparkle] = await Promise.all([loadAsset(WALLPAPER_FILE), loadAsset(SPACE_FILE), loadAsset(SPARKLE_FILE)].map(p => p.catch(() => null)))
      assets = { wallpaper, space, sparkle }
      if (!wallpaper && !disposed) host.notify({ kind: 'error', message: 'Cosmos wallpaper could not be read; the skin is on without it. Is assets/nebula-station.webp installed?' })
      return assets
    }
    const apply = async enabled => {
      if (disposed) return
      enabledState = enabled
      const version = ++paintVersion
      if (!enabled) { removeStyle(); return }
      const loaded = await loadAssets()
      if (disposed || version !== paintVersion) return
      const wallpaper = background === 'space' ? loaded.space : loaded.wallpaper
      if (!wallpaper) {
        host.notify({ kind: 'error', message: 'The selected Cosmos background could not be read. Check the installed assets.' })
      }
      if (!style) {
        style = document.createElement('style')
        style.dataset.nebulaSkin = ''
        document.head.append(style)
      }
      style.textContent = skinCss({ ...loaded, wallpaper })
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
    const chooseBackground = value => {
      if (disposed) return
      backgroundChanged = true
      background = value
      const applied = apply(enabledState)
      pendingSave = pendingSave.then(() => applied).then(() => ctx.storage.set('background', value))
        .then(() => {
          if (!disposed) host.notify({ kind: 'info', message: `Cosmos background: ${value === 'space' ? 'space without station' : 'space station'}.${enabledState ? '' : ' Enable Cosmos skin to see it.'}` })
        }).catch(() => {
          if (!disposed) host.notify({ kind: 'error', message: 'Cosmos background preference could not be saved.' })
        })
      return pendingSave
    }
    Promise.resolve().then(() => Promise.all([ctx.storage.get('enabled'), Promise.resolve().then(() => ctx.storage.get('background')).catch(() => 'station')])).then(([enabled, savedBackground]) => {
      if (disposed) return
      if (!backgroundChanged) background = savedBackground === 'space' ? 'space' : 'station'
      return apply(userChanged ? enabledState : enabled === true)
    }).catch(() => {
      if (!disposed && !userChanged) host.notify({ kind: 'error', message: 'Could not restore the Cosmos skin preference; use the palette to enable it.' })
    })
    for (const [id, label, run] of [
      ['enable', 'Enable Cosmos skin', enable],
      ['disable', 'Disable Cosmos skin', disable],
      ['toggle', 'Toggle Cosmos skin', () => enabledState ? disable() : enable()],
      ['background-space', 'Cosmos background: without space station', () => chooseBackground('space')],
      ['background-station', 'Cosmos background: with space station', () => chooseBackground('station')],
      ['background-toggle', 'Toggle Cosmos background (station / no station)', () => chooseBackground(background === 'station' ? 'space' : 'station')]
    ]) ctx.register({ id, area: PALETTE_AREA, data: { label, keywords: ['cosmos', 'nebula', 'space', 'skin', 'wallpaper'], run } })
    ctx.onDispose(() => { disposed = true; removeStyle() })
  }
}
