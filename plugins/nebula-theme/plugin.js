// Cosmos — a deep-indigo space palette for Hermes Desktop. © 2026 Ko Vial, MIT.
// Palette + color-only bridges. Wallpaper, glow rims and the pixel wordmark
// live in the separate, opt-in `nebula-skin` plugin.
import { THEMES_AREA } from '@hermes/plugin-sdk'

export const theme = {
  name: 'nebula',
  label: 'Cosmos',
  description: 'Deep indigo field, lavender rims, cyan and gold accents. Pairs with the optional Cosmos Skin for the wallpaper and glow.',
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
  // Dark roles, exact: app #050816, main panel #0B1026, elevated #11183A,
  // sidebar #151B46, input/card #1B2252, borders #705CFF / #3E55D9, text
  // #F4F1FF / #B8B4D9 / #7E82AE, accent #8D63FF, purple #B35CFF, error #FF6584.
  darkColors: {
    background: '#050816', foreground: '#f4f1ff',
    card: '#0b1026', cardForeground: '#f4f1ff',
    muted: '#1b2252', mutedForeground: '#b8b4d9',
    popover: '#11183a', popoverForeground: '#f4f1ff',
    primary: '#8d63ff', primaryForeground: '#050816',
    secondary: '#1b2252', secondaryForeground: '#f4f1ff',
    accent: '#1b2252', accentForeground: '#f4f1ff',
    border: '#705cff', input: '#705cff', ring: '#8d63ff',
    midground: '#b35cff', midgroundForeground: '#050816', composerRing: '#8d63ff',
    destructive: '#ff6584', destructiveForeground: '#050816',
    sidebarBackground: '#151b46', sidebarBorder: '#3e55d9',
    userBubble: '#1b2252', userBubbleBorder: '#705cff'
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
  --nebula-cyan: #47d9ff;
  --nebula-gold: #ffd86a;
  --nebula-lavender: #b35cff;
  --nebula-accent: #8d63ff;
  --nebula-magenta: #f05cff;
  --nebula-blue: #497bff;
  --nebula-warm: #ffb878;
  --nebula-meta: #b8b4d9;
  --nebula-placeholder: #7e82ae;
  --ui-text-quaternary: #7e82ae;
  --ui-stroke-secondary: #3e55d9;
  --ui-bg-input: #1b2252;
  --ui-success: #52e6b4 !important; /* applyTheme writes a harmonized green inline */
  --ui-warning: #ffc857;
  --ui-danger: #ff6584;
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
  --nebula-ink-1: #f05cff; --nebula-ink-2: #47d9ff; --nebula-ink-3: #ffd86a; --nebula-ink-4: #52e6b4;
  --nebula-ink-5: #497bff; --nebula-ink-6: #b35cff; --nebula-ink-7: #ffb878;
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
:root[data-hermes-theme="nebula"][data-hermes-mode="dark"] [data-slot="composer-root"] {
  --composer-fill: var(--ui-bg-input);
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
  id: 'nebula-theme', name: 'Cosmos Theme',
  description: 'Registers the Cosmos palette without selecting it. Wallpaper and glow are the separate Cosmos Skin plugin.',
  register(ctx) {
    ctx.register({ id: 'palette', area: THEMES_AREA, data: theme })
    const style = document.createElement('style')
    style.dataset.nebulaColors = ''
    style.textContent = colorCss
    document.head.append(style)
    ctx.onDispose(() => style.remove())
  }
}
