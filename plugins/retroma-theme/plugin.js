// Retroma-inspired adaptation, upstream © 2026 emarpiee, MIT (see LICENSE).
// https://github.com/emarpiee/Retroma/tree/cf9c544c4950529e0ce87587127e6b72d5451848
// Hermes adaptation © 2026 Ko Vial, MIT. No upstream fonts or Obsidian selectors.
import { THEMES_AREA } from '@hermes/plugin-sdk'

export const theme = {
  name: 'retroma',
  label: 'Retroma',
  description: 'Cyan wells, lavender frames and restrained rainbow navigation; inspired by emarpiee’s Retroma. Interpretive dark palette.',
  colors: {
    background: '#defbff', foreground: '#51446f',
    card: '#defbff', cardForeground: '#51446f',
    muted: '#c6b9e9', mutedForeground: '#51446f',
    popover: '#ded5f2', popoverForeground: '#51446f',
    primary: '#674397', primaryForeground: '#f5f1ff',
    secondary: '#c6b9e9', secondaryForeground: '#51446f',
    accent: '#ad85af', accentForeground: '#30223f',
    border: '#81709c', input: '#81709c', ring: '#7041a5',
    midground: '#674397', midgroundForeground: '#f5f1ff', composerRing: '#7041a5',
    destructive: '#a4483a', destructiveForeground: '#fff6ed',
    sidebarBackground: '#c6b9e9', sidebarBorder: '#81709c',
    userBubble: '#d5c9ef', userBubbleBorder: '#81709c'
  },
  darkColors: {
    background: '#172e36', foreground: '#e0d4f4',
    card: '#172e36', cardForeground: '#e0d4f4',
    muted: '#3d3456', mutedForeground: '#c4b4d8',
    popover: '#403751', popoverForeground: '#e0d4f4',
    primary: '#c5a4ed', primaryForeground: '#291f3b',
    secondary: '#3d3456', secondaryForeground: '#e0d4f4',
    accent: '#674763', accentForeground: '#f1e4f7',
    border: '#9480b1', input: '#9480b1', ring: '#d0adff',
    midground: '#c5a4ed', midgroundForeground: '#291f3b', composerRing: '#d0adff',
    destructive: '#f09c83', destructiveForeground: '#38231f',
    sidebarBackground: '#3d3456', sidebarBorder: '#9480b1',
    userBubble: '#423c60', userBubbleBorder: '#9480b1'
  }
}

// The native theme model has no heading/titlebar roles and normally dilutes
// card seeds. Scope these color-only bridges to the HOST'S selected theme.
// No inline root writes, selection requests, storage, or typography changes.
export const colorCss = `
:root[data-hermes-theme="retroma"] {
  --retroma-heading: #a4483a;
  --ui-bg-chrome: var(--theme-sidebar-seed);
  --ui-bg-sidebar: var(--theme-sidebar-seed);
  --ui-bg-editor: var(--theme-card-seed);
  --ui-bg-elevated: var(--theme-elevated-seed);
  --retroma-input-surface: #fff3d6;
  --retroma-input-ink: #493d32;
  --retroma-placeholder: #76634f;
  --retroma-well: #defbff;
  --ui-bg-input: var(--retroma-input-surface);
  --ui-text-primary: var(--theme-foreground);
  --ui-text-secondary: var(--theme-foreground);
  --ui-text-tertiary: var(--theme-foreground);
  --ui-text-quaternary: var(--theme-foreground);
  --ui-stroke-primary: var(--dt-border);
  --ui-stroke-secondary: var(--dt-border);
  --ui-chat-surface-background: var(--theme-background-seed);
  --ui-editor-surface-background: var(--theme-card-seed);
  --ui-sidebar-surface-background: var(--theme-sidebar-seed);
  --ui-chat-bubble-background: var(--theme-bubble-seed);
  --dt-popover: rgb(from var(--theme-elevated-seed) r g b / 1);
}
:root[data-hermes-theme="retroma"][data-hermes-mode="dark"] {
  --retroma-heading: #f09c83;
  --retroma-input-surface: #263f3d;
  --retroma-input-ink: #dcebe0;
  --retroma-placeholder: #aec7bb;
  --retroma-well: #23434b;
}
/* Only real control slots; no document reading, per-user IDs or DOM mutation. */
:root[data-hermes-theme="retroma"] :is(input[data-slot="input"], [data-slot="input-group"], textarea[data-slot="textarea"], [data-slot="composer-surface"]) {
  background-color: var(--retroma-input-surface);
  color: var(--retroma-input-ink);
}
:root[data-hermes-theme="retroma"] :is(input[data-slot="input"], textarea[data-slot="textarea"])::placeholder {
  color: var(--retroma-placeholder);
  opacity: 1;
}
:root[data-hermes-theme="retroma"] [data-slot="composer-rich-input"]:is(:empty, [data-empty])::before {
  color: var(--retroma-placeholder) !important;
  opacity: 1;
}
/* The editor shares its enclosing fill, so the surface rim stays continuous. */
:root[data-hermes-theme="retroma"] [data-slot="composer-rich-input"] {
  color: var(--retroma-input-ink);
  background-color: transparent;
}
:root[data-hermes-theme="retroma"] [data-slot="composer-root"] {
  --composer-fill: var(--retroma-input-surface);
}
:root[data-hermes-theme="retroma"] [data-tour="sessions-sidebar"],
:root[data-hermes-theme="retroma"] [data-tree-group]:has([data-slot="bots-roster"]) {
  background-color: var(--theme-sidebar-seed);
}
/* A quiet wash ties the sidebar's separated native regions into one frame. */
:root[data-hermes-theme="retroma"] [data-tour="sessions-sidebar"] {
  background-image: linear-gradient(180deg, transparent, color-mix(in srgb, var(--retroma-well) 24%, transparent));
}
:root[data-hermes-theme="retroma"] [data-tour="sessions-sidebar"] [data-sidebar="menu"],
:root[data-hermes-theme="retroma"] [data-slot="bots-roster"] {
  background-color: var(--retroma-well);
}
:root[data-hermes-theme="retroma"] {
  --retroma-red-fill: #ffe0da;
  --retroma-red-ink: #913e32;
  --retroma-orange-fill: #ffe8c6;
  --retroma-orange-ink: #885000;
  --retroma-yellow-fill: #f4f3b9;
  --retroma-yellow-ink: #656000;
  --retroma-green-fill: #ceefd6;
  --retroma-green-ink: #28663b;
  --retroma-cyan-fill: #c6f4f9;
  --retroma-cyan-ink: #006477;
  --retroma-blue-fill: #dae8ff;
  --retroma-blue-ink: #36578a;
  --retroma-violet-fill: #ecddf6;
  --retroma-violet-ink: #75458d;
}
:root[data-hermes-theme="retroma"][data-hermes-mode="dark"] {
  --retroma-red-fill: #49313a;
  --retroma-red-ink: #f3b9ad;
  --retroma-orange-fill: #493b2d;
  --retroma-orange-ink: #e6c08d;
  --retroma-yellow-fill: #41432b;
  --retroma-yellow-ink: #d5d394;
  --retroma-green-fill: #29443d;
  --retroma-green-ink: #a2d7b2;
  --retroma-cyan-fill: #25434d;
  --retroma-cyan-ink: #98d5e2;
  --retroma-blue-fill: #303f5b;
  --retroma-blue-ink: #b5cdf4;
  --retroma-violet-fill: #443653;
  --retroma-violet-ink: #d8b9ed;
}
:root[data-hermes-theme="retroma"] [data-tour="sessions-sidebar"] [data-sidebar="menu-button"]:has([data-tour="sidebar-nav-new-session"]) {
  --retroma-row-fill: var(--retroma-red-fill);
  --retroma-row-ink: var(--retroma-red-ink);
}
:root[data-hermes-theme="retroma"] [data-tour="sessions-sidebar"] [data-sidebar="menu-button"]:has([data-tour="sidebar-nav-skills"]) {
  --retroma-row-fill: var(--retroma-orange-fill);
  --retroma-row-ink: var(--retroma-orange-ink);
}
:root[data-hermes-theme="retroma"] [data-tour="sessions-sidebar"] [data-sidebar="menu-button"]:has([data-tour="sidebar-nav-messaging"]) {
  --retroma-row-fill: var(--retroma-yellow-fill);
  --retroma-row-ink: var(--retroma-yellow-ink);
}
:root[data-hermes-theme="retroma"] [data-tour="sessions-sidebar"] [data-sidebar="menu-button"]:has([data-tour="sidebar-nav-artifacts"]) {
  --retroma-row-fill: var(--retroma-green-fill);
  --retroma-row-ink: var(--retroma-green-ink);
}
:root[data-hermes-theme="retroma"] [data-tour="sessions-sidebar"] [data-sidebar="menu-button"]:has([data-tour="sidebar-nav-cron"]) {
  --retroma-row-fill: var(--retroma-cyan-fill);
  --retroma-row-ink: var(--retroma-cyan-ink);
}
:root[data-hermes-theme="retroma"] [data-slot="profile-switcher"] [data-slot="button"] {
  --retroma-row-fill: var(--retroma-blue-fill);
  --retroma-row-ink: var(--retroma-blue-ink);
}
:root[data-hermes-theme="retroma"] [data-slot="bots-roster"] [data-slot="row-button"][data-roster-key] {
  --retroma-row-fill: var(--retroma-violet-fill);
  --retroma-row-ink: var(--retroma-violet-ink);
}
:root[data-hermes-theme="retroma"] :is([data-tour="sessions-sidebar"] [data-sidebar="menu-button"]:has([data-tour="sidebar-nav-new-session"]),
  [data-tour="sessions-sidebar"] [data-sidebar="menu-button"]:has([data-tour="sidebar-nav-skills"]),
  [data-tour="sessions-sidebar"] [data-sidebar="menu-button"]:has([data-tour="sidebar-nav-messaging"]),
  [data-tour="sessions-sidebar"] [data-sidebar="menu-button"]:has([data-tour="sidebar-nav-artifacts"]),
  [data-tour="sessions-sidebar"] [data-sidebar="menu-button"]:has([data-tour="sidebar-nav-cron"]),
  [data-slot="profile-switcher"] [data-slot="button"],
  [data-slot="bots-roster"] [data-slot="row-button"][data-roster-key]) {
  background-color: var(--retroma-row-fill);
  color: var(--retroma-row-ink);
  border-color: var(--retroma-row-ink);
}
:root[data-hermes-theme="retroma"] :is([data-tour="sessions-sidebar"] [data-sidebar="menu-button"]:has([data-tour="sidebar-nav-new-session"]),
  [data-tour="sessions-sidebar"] [data-sidebar="menu-button"]:has([data-tour="sidebar-nav-skills"]),
  [data-tour="sessions-sidebar"] [data-sidebar="menu-button"]:has([data-tour="sidebar-nav-messaging"]),
  [data-tour="sessions-sidebar"] [data-sidebar="menu-button"]:has([data-tour="sidebar-nav-artifacts"]),
  [data-tour="sessions-sidebar"] [data-sidebar="menu-button"]:has([data-tour="sidebar-nav-cron"]),
  [data-slot="profile-switcher"] [data-slot="button"],
  [data-slot="bots-roster"] [data-slot="row-button"][data-roster-key]):not(:focus-visible) {
  outline: 1px solid color-mix(in srgb, var(--retroma-row-ink) 80%, var(--retroma-row-fill));
  outline-offset: -1px;
}
:root[data-hermes-theme="retroma"] :is([data-tour="sessions-sidebar"] [data-sidebar="menu-button"]:has([data-tour="sidebar-nav-new-session"]),
  [data-tour="sessions-sidebar"] [data-sidebar="menu-button"]:has([data-tour="sidebar-nav-skills"]),
  [data-tour="sessions-sidebar"] [data-sidebar="menu-button"]:has([data-tour="sidebar-nav-messaging"]),
  [data-tour="sessions-sidebar"] [data-sidebar="menu-button"]:has([data-tour="sidebar-nav-artifacts"]),
  [data-tour="sessions-sidebar"] [data-sidebar="menu-button"]:has([data-tour="sidebar-nav-cron"]),
  [data-slot="profile-switcher"] [data-slot="button"],
  [data-slot="bots-roster"] [data-slot="row-button"][data-roster-key]):hover:not(:disabled):not([aria-disabled="true"]) {
  background-color: color-mix(in srgb, var(--retroma-row-fill) 92%, var(--retroma-row-ink));
}
/* Neutral roster metadata has explicit host text utilities. Override only
   those text nodes, never status icons or their shared semantic variables. */
:root[data-hermes-theme="retroma"] [data-slot="bots-roster"] [data-slot="row-button"][data-roster-key] :is(div[class~="text-(--ui-text-tertiary)"], span[class~="text-(--ui-text-quaternary)"]) {
  color: var(--retroma-row-ink);
}
/* Source currently sets these literal utility classes, NOT isActive/aria-selected.
   Keep this narrow and source-contract tested. Inset selection costs no layout. */
:root[data-hermes-theme="retroma"] [data-tour="sessions-sidebar"] [data-sidebar="menu-button"][class~="bg-(--ui-control-active-background)"],
:root[data-hermes-theme="retroma"] [data-slot="bots-roster"] [data-roster-key][class~="bg-(--ui-row-active-background)"],
:root[data-hermes-theme="retroma"] [data-slot="profile-switcher"] [data-slot="button"][data-state="open"] {
  background-color: color-mix(in srgb, var(--retroma-row-fill) 88%, var(--retroma-row-ink));
  box-shadow: inset 4px 0 0 var(--retroma-row-ink), inset 0 0 0 2px var(--retroma-row-ink);
}
/* Keep the top-edge header, drag spacers and empty strip on one lavender
   chrome fill. Individual tab chips receive their subtle tint below. */
:root[data-hermes-theme="retroma"] [data-tree-group][data-window-top="true"] > [data-panel-header] {
  --pane-tab-active-bg: var(--ui-sidebar-surface-background);
  --pane-tab-strip-bg: var(--ui-sidebar-surface-background);
  background-color: var(--ui-sidebar-surface-background);
  color: var(--dt-accent-foreground);
}
/* Tint only the tab chips, not the strip, tools, drag spacers or rail cap.
   Mixing toward the ink darkens light tabs and lightens dark tabs subtly.
   Set tokens on the tabs themselves so native strip-local defaults cannot
   shadow them; keep native hover/selection shadows and the active underline. */
:root[data-hermes-theme="retroma"] [data-tree-group][data-window-top="true"] > [data-panel-header] [data-slot="pane-tab"]:not([data-vertical]) {
  --retroma-tab-idle: color-mix(in srgb, var(--ui-sidebar-surface-background) 90%, var(--theme-foreground));
  --retroma-tab-active: color-mix(in srgb, var(--ui-sidebar-surface-background) 82%, var(--theme-foreground));
  --pane-tab-strip-bg: var(--retroma-tab-idle);
  --pane-tab-active-bg: var(--retroma-tab-active);
  --ui-tab-hover-darken: 2%;
  background-color: var(--retroma-tab-idle);
}
:root[data-hermes-theme="retroma"] [data-tree-group][data-window-top="true"] > [data-panel-header] [data-slot="pane-tab"][data-active="true"]:not([data-vertical]) {
  background-color: var(--retroma-tab-active);
}
/* Short dividers stay visible without shifting tabs or replacing the native
   hover shadow, keyboard focus, multi-selection wash or active underline. */
:root[data-hermes-theme="retroma"] [data-tree-group][data-window-top="true"] > [data-panel-header] [data-slot="pane-tab"]:not([data-vertical])::after {
  content: '';
  position: absolute;
  pointer-events: none;
  right: 0;
  top: 7px;
  bottom: 7px;
  width: 1px;
  background-color: color-mix(in srgb, var(--theme-foreground) 32%, transparent);
}
/* Collapsed vertical rails omit the header: their reserved titlebar padding
   exposes the group's editor fill. Paint that headerless top-edge group as
   chrome too; expanded groups and non-top rails keep their original fill. */
:root[data-hermes-theme="retroma"] [data-tree-group][data-window-top="true"]:not(:has(> [data-panel-header])) {
  background-color: var(--ui-sidebar-surface-background);
}
:root[data-hermes-theme="retroma"] [data-slot="aui_assistant-message-content"] .aui-md :is(h1,h2,h3,h4,h5,h6) {
  color: var(--retroma-heading);
}
:root[data-hermes-theme="retroma"] [data-slot="composer-completion-drawer"] {
  background-color: rgb(from var(--dt-popover) r g b / 1);
}
/* Model settings StaleAuxWarning hard-codes dark-only text-amber-200 over a
   10% amber wash: unreadable on the light cyan well. Match that exact source
   class set only (not the utility globally) and keep it an amber warning using
   the palette's orange pair. Icon and mono provider inherit the ink; the
   textStrong reset link keeps its own muted-foreground token. */
:root[data-hermes-theme="retroma"] div[class~="text-amber-200"][class~="bg-amber-500/10"][class~="border-amber-500/40"] {
  background-color: var(--retroma-orange-fill);
  border-color: color-mix(in srgb, var(--retroma-orange-ink) 55%, var(--retroma-orange-fill));
  color: var(--retroma-orange-ink);
}
`

export default {
  id: 'retroma-theme', name: 'Retroma Theme',
  description: 'Registers Retroma colors without selecting them. Tactile styling is a separate plugin.',
  register(ctx) {
    ctx.register({ id: 'palette', area: THEMES_AREA, data: theme })
    const style = document.createElement('style')
    style.dataset.retromaColors = ''
    style.textContent = colorCss
    document.head.append(style)
    ctx.onDispose(() => style.remove())
  }
}
