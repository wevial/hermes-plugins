// Nebula — a deep-indigo space palette for Hermes Desktop. © 2026 Ko Vial, MIT.
// Palette + color-only bridges. Wallpaper, glow rims and the pixel wordmark
// live in the separate, opt-in `nebula-skin` plugin.
import { THEMES_AREA } from '@hermes/plugin-sdk'

export const theme = {
  name: 'nebula',
  label: 'Nebula',
  description: 'Deep indigo field, lavender rims, cyan and gold accents. Pairs with the optional Nebula Skin for the wallpaper and glow.',
  colors: {
    background: '#e6e3ff', foreground: '#24215a',
    card: '#efecff', cardForeground: '#24215a',
    muted: '#d3cffa', mutedForeground: '#56528f',
    popover: '#f7f5ff', popoverForeground: '#24215a',
    primary: '#2a6fc0', primaryForeground: '#ffffff',
    secondary: '#d9d5fb', secondaryForeground: '#24215a',
    accent: '#cfc9ff', accentForeground: '#24215a',
    border: '#8a86f0', input: '#8a86f0', ring: '#2a6fc0',
    midground: '#5c55d6', midgroundForeground: '#ffffff', composerRing: '#7b74ef',
    destructive: '#c43d4e', destructiveForeground: '#ffffff',
    sidebarBackground: '#dbd7ff', sidebarBorder: '#8a86f0',
    userBubble: '#d8d3ff', userBubbleBorder: '#9b96ff'
  },
  darkColors: {
    background: '#0b0b2c', foreground: '#f2f0ff',
    card: '#12123a', cardForeground: '#f2f0ff',
    muted: '#25246a', mutedForeground: '#a6a1e6',
    popover: '#1a1852', popoverForeground: '#f2f0ff',
    primary: '#5ecbff', primaryForeground: '#0b0b2c',
    secondary: '#25246a', secondaryForeground: '#f2f0ff',
    accent: '#2b2a72', accentForeground: '#f2f0ff',
    border: '#8a86f0', input: '#8a86f0', ring: '#5ecbff',
    midground: '#b8b3ff', midgroundForeground: '#0b0b2c', composerRing: '#9d9aff',
    destructive: '#ff6b7a', destructiveForeground: '#2a0d12',
    sidebarBackground: '#12123a', sidebarBorder: '#8a86f0',
    userBubble: '#363377', userBubbleBorder: '#9b96ff'
  }
}

// The host mixes seeds toward neutral chrome, which greys the indigo. Pin the
// surfaces to their seeds and give the meta text its lavender. Colors only:
// no inline root writes, selection requests, storage or typography changes.
export const colorCss = `
:root[data-hermes-theme="nebula"] {
  --nebula-cyan: #2a6fc0;
  --nebula-gold: #b07a00;
  --nebula-lavender: #4b45c2;
  --nebula-meta: #4e4a86;
  --nebula-placeholder: #6f6aa8;
  --ui-bg-chrome: var(--theme-background-seed);
  --ui-bg-sidebar: var(--theme-sidebar-seed);
  --ui-bg-editor: var(--theme-card-seed);
  --ui-bg-elevated: var(--theme-elevated-seed);
  --ui-bg-input: var(--theme-card-seed);
  --ui-chat-surface-background: var(--theme-background-seed);
  --ui-editor-surface-background: var(--theme-card-seed);
  --ui-sidebar-surface-background: var(--theme-sidebar-seed);
  --ui-chat-bubble-background: var(--theme-bubble-seed);
  --ui-text-tertiary: var(--nebula-meta);
  --ui-text-quaternary: var(--nebula-meta);
  --ui-stroke-primary: var(--dt-border);
  --ui-stroke-secondary: color-mix(in srgb, var(--dt-border) 70%, transparent);
  --ui-stroke-tertiary: color-mix(in srgb, var(--dt-border) 40%, transparent);
  --dt-popover: rgb(from var(--theme-elevated-seed) r g b / 1);
}
:root[data-hermes-theme="nebula"][data-hermes-mode="dark"] {
  --nebula-cyan: #5ecbff;
  --nebula-gold: #f5c542;
  --nebula-lavender: #b8b3ff;
  --nebula-meta: #a6a1e6;
  --nebula-placeholder: #8c88c9;
}
/* Sidebar captions (PINNED / SESSIONS / date dividers) in lavender rather
   than the cyan primary the host hard-codes for them. */
:root[data-hermes-theme="nebula"] [data-tour="sessions-sidebar"] :is(span[class~="tracking-[0.16em]"], span[class~="tracking-[0.12em]"]) {
  color: var(--nebula-lavender);
}
/* Navigation rows: one hue per row, cycling in the mockup's order (pink,
   cyan, gold, green, blue, lavender, periwinkle). Position-based so plugin
   rows (Theme Studio, Kanban, …) and user reordering are covered too. */
:root[data-hermes-theme="nebula"] {
  --nebula-ink-1: #b8236f; --nebula-ink-2: #0a6b86; --nebula-ink-3: #8a5f00; --nebula-ink-4: #1b7a49;
  --nebula-ink-5: #2a5fc0; --nebula-ink-6: #5a3fc0; --nebula-ink-7: #3b52b5;
}
:root[data-hermes-theme="nebula"][data-hermes-mode="dark"] {
  --nebula-ink-1: #ff7ac0; --nebula-ink-2: #5fe0ff; --nebula-ink-3: #f5d36a; --nebula-ink-4: #7af0b8;
  --nebula-ink-5: #7fb2ff; --nebula-ink-6: #c9b4ff; --nebula-ink-7: #b8c6ff;
}
:root[data-hermes-theme="nebula"] [data-tour="sessions-sidebar"] li[data-sidebar="menu-item"]:nth-child(7n+1):has([data-tour^="sidebar-nav-"]) { --nebula-row-ink: var(--nebula-ink-1); }
:root[data-hermes-theme="nebula"] [data-tour="sessions-sidebar"] li[data-sidebar="menu-item"]:nth-child(7n+2):has([data-tour^="sidebar-nav-"]) { --nebula-row-ink: var(--nebula-ink-2); }
:root[data-hermes-theme="nebula"] [data-tour="sessions-sidebar"] li[data-sidebar="menu-item"]:nth-child(7n+3):has([data-tour^="sidebar-nav-"]) { --nebula-row-ink: var(--nebula-ink-3); }
:root[data-hermes-theme="nebula"] [data-tour="sessions-sidebar"] li[data-sidebar="menu-item"]:nth-child(7n+4):has([data-tour^="sidebar-nav-"]) { --nebula-row-ink: var(--nebula-ink-4); }
:root[data-hermes-theme="nebula"] [data-tour="sessions-sidebar"] li[data-sidebar="menu-item"]:nth-child(7n+5):has([data-tour^="sidebar-nav-"]) { --nebula-row-ink: var(--nebula-ink-5); }
:root[data-hermes-theme="nebula"] [data-tour="sessions-sidebar"] li[data-sidebar="menu-item"]:nth-child(7n+6):has([data-tour^="sidebar-nav-"]) { --nebula-row-ink: var(--nebula-ink-6); }
:root[data-hermes-theme="nebula"] [data-tour="sessions-sidebar"] li[data-sidebar="menu-item"]:nth-child(7n+7):has([data-tour^="sidebar-nav-"]) { --nebula-row-ink: var(--nebula-ink-7); }
:root[data-hermes-theme="nebula"] [data-tour="sessions-sidebar"] [data-sidebar="menu-button"]:has([data-tour^="sidebar-nav-"]) {
  color: color-mix(in srgb, var(--dt-foreground) 60%, var(--nebula-row-ink, var(--nebula-lavender)));
  border-color: color-mix(in srgb, var(--nebula-row-ink, var(--nebula-lavender)) 70%, transparent);
}
/* Icons are Codicon <i> glyphs (or SVGs for plugin rows); paint them the row hue. */
:root[data-hermes-theme="nebula"] [data-tour="sessions-sidebar"] [data-sidebar="menu-button"]:has([data-tour^="sidebar-nav-"]) > :is(svg, .codicon) {
  color: var(--nebula-row-ink, var(--nebula-lavender));
}
:root[data-hermes-theme="nebula"] :is(input[data-slot="input"], textarea[data-slot="textarea"])::placeholder,
:root[data-hermes-theme="nebula"] [data-slot="composer-rich-input"]:is(:empty, [data-empty])::before {
  color: var(--nebula-placeholder) !important;
  opacity: 1;
}
:root[data-hermes-theme="nebula"] [data-slot="composer-root"] {
  --composer-fill: var(--theme-card-seed);
}
:root[data-hermes-theme="nebula"] [data-slot="aui_assistant-message-content"] .aui-md :is(h1,h2,h3,h4,h5,h6) {
  color: var(--nebula-lavender);
}
:root[data-hermes-theme="nebula"] [data-slot="aui_assistant-message-content"] .aui-md a {
  color: var(--nebula-cyan);
}
:root[data-hermes-theme="nebula"] [data-slot="composer-completion-drawer"] {
  background-color: rgb(from var(--dt-popover) r g b / 1);
}
`

export default {
  id: 'nebula-theme', name: 'Nebula Theme',
  description: 'Registers the Nebula palette without selecting it. Wallpaper and glow are the separate Nebula Skin plugin.',
  register(ctx) {
    ctx.register({ id: 'palette', area: THEMES_AREA, data: theme })
    const style = document.createElement('style')
    style.dataset.nebulaColors = ''
    style.textContent = colorCss
    document.head.append(style)
    ctx.onDispose(() => style.remove())
  }
}
