// Retroma-inspired adaptation, upstream © 2026 emarpiee, MIT (see LICENSE).
// https://github.com/emarpiee/Retroma/tree/cf9c544c4950529e0ce87587127e6b72d5451848
// Hermes adaptation © 2026 Ko Vial, MIT. Restrained inset light/shadow treatment.
import { PALETTE_AREA, host } from '@hermes/plugin-sdk'

// Preserve native compact sizes, padding, hit areas, drag regions and fonts.
// Boxed SDK controls and source-backed navigation; no layout or font rules.
// Frame overlays paint above opaque pane children without intercepting input.
export const skinCss = `
:root {
  --retroma-edge: var(--ui-stroke-primary);
  --retroma-raised: inset 0 0 0 1px var(--retroma-edge), inset 2px 2px 0 var(--retroma-light), inset -2px -2px 0 var(--retroma-shade);
  /* Each inner corner is traced by exactly one 3px-offset copy of the rim:
     shade (3,3) at top-left, light (-3,-3) at bottom-right, and two lowest
     mid-tone copies (-3,3) / (3,-3) at top-right and bottom-left. Same shape,
     same offset, so all four inner curves match (a uniform 3px ring would
     give those two corners a tighter radius-3 curve). Shade and light still
     cover the straight bands; the mid tones show only in their corner wedges. */
  --retroma-inset: inset 0 0 0 1px var(--retroma-edge), inset 3px 3px 0 var(--retroma-shade), inset -3px -3px 0 var(--retroma-light), inset -3px 3px 0 var(--retroma-mid), inset 3px -3px 0 var(--retroma-mid);
  --retroma-mid: color-mix(in srgb, var(--retroma-shade) 50%, var(--retroma-light));
  --retroma-light: color-mix(in srgb, var(--dt-card) 90%, white);
  --retroma-shade: color-mix(in srgb, var(--dt-foreground) 38%, var(--dt-card));
}
/* Retroma's chrome is lavender but its card seed is cyan. Deriving bevel
   highlights from that card produced stray blue hairlines on lavender frames.
   Change only decorative edge colors; retain content fills and focus rings.
   Other themes keep the generic card-derived tactile treatment above. */
:root[data-hermes-theme="retroma"] {
  --retroma-light: color-mix(in srgb, var(--ui-sidebar-surface-background) 72%, white);
  --retroma-shade: color-mix(in srgb, var(--dt-foreground) 38%, var(--ui-sidebar-surface-background));
}
[data-slot="button"]:is([data-variant="default"], [data-variant="secondary"], [data-variant="outline"], [data-variant="ghost"]):not(:focus-visible):not([aria-invalid="true"]) {
  border-radius: 6px;
  box-shadow: inset 0 0 0 1px var(--retroma-edge), inset 2px 2px 0 var(--retroma-light), inset -2px -2px 0 var(--retroma-shade);
}
:where([data-slot="button"]:is([data-variant="secondary"], [data-variant="outline"], [data-variant="ghost"])):not(:disabled):not([aria-disabled="true"]) {
  background-color: var(--dt-card);
}
[data-slot="button"]:is([data-variant="default"], [data-variant="secondary"], [data-variant="outline"], [data-variant="ghost"]):is(:active,[aria-pressed="true"],[data-state="on"]):not(:disabled):not([aria-disabled="true"]):not(:focus-visible):not([aria-invalid="true"]) {
  box-shadow: inset 0 0 0 1px var(--retroma-edge), inset 2px 2px 0 var(--retroma-shade), inset -2px -2px 0 var(--retroma-light);
}
/* Existing menu/roster wells and the real roster toolbar; no spacing changes. */
[data-tour="sessions-sidebar"] [data-sidebar="menu"],
[data-slot="bots-roster"] {
  border-radius: 6px;
  box-shadow: inset 0 0 0 1px var(--retroma-edge), inset 2px 2px 0 var(--retroma-shade), inset -2px -2px 0 var(--retroma-light);
}
/* Roster toolbar is the first child of the roster pane, preceding its well. */
div:has(> [data-slot="bots-roster"]) > div:first-child:not([data-slot="bots-roster"]) {
  border-radius: 6px;
  box-shadow: inset 0 0 0 1px var(--retroma-edge), inset 2px 2px 0 var(--retroma-light), inset -2px -2px 0 var(--retroma-shade);
}
/* These hosts are already positioned in the inspected client source.
   An inset shadow on the parent paints UNDER its opaque kept-pane children.
   A noninteractive overlay survives that stacking without changing geometry.
   Tree groups frame only their PaneBody (pane-body.tsx: relative flex-1
   overflow-hidden), never the whole group: a group-wide frame ran through
   the header, notched its top corners and nested a ring inside the content.
   Square corners so adjacent headers, sidebar and rail meet flush. */
[data-tree-group] > div.relative.flex-1.overflow-hidden::after,
[data-tour="sessions-sidebar"]::after,
[data-slot="composer-surface"]::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 7;
  pointer-events: none;
  border-radius: 0;
  box-shadow: var(--retroma-inset);
}
[data-slot="composer-surface"]::after { border-radius: inherit; }
/* Soften the inset content surface only; header and sidebar seams stay square.
   Kept-alive panes (keep-alive-panes.tsx) render in an absolute z-0 host
   anchored OVER PaneBody, outside it, so no PaneBody clip or background can
   round them. The z-7 overlay therefore paints the corner wedges itself: its
   outer chrome shadow is trimmed to the square body box by the body's own
   overflow-hidden, leaving only the four wedges, above any pane host.
   The body box, hit-testing and pane layers are unchanged. */
[data-tree-group] > div.relative.flex-1.overflow-hidden::after {
  border-radius: 6px;
  box-shadow: 0 0 0 6px var(--ui-sidebar-surface-background), var(--retroma-inset);
}
/* tree-split.tsx Sash: its resting 10% hairline spans the full track height,
   cutting the top control band beside the sidebar and a minimized rail. The
   framed bodies already mark the seam, so quiet only that resting paint; the
   grab band, cursor, hover/drag highlight and hit area are untouched. */
[role="separator"].group.absolute:not(:hover) > span:first-child {
  opacity: 0;
}
/* Cmd+K: Radix Content in app/command-palette/index.tsx, not all dialogs.
   Its source-specific width + direct Command distinguish other HUDs/pickers.
   Content is already fixed/overflow-hidden. Paint above opaque command rows
   (including z-10 headings), without adding border width or intercepting input. */
[role="dialog"][class~="w-[min(34rem,calc(100vw-2rem))]"]:has(> [data-slot="command"])::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 20;
  pointer-events: none;
  border-radius: inherit;
  box-shadow: inset 0 0 0 2px var(--dt-popover-foreground), inset 3px 3px 0 var(--retroma-light), inset -3px -3px 0 var(--retroma-shade);
}
/* Sessions is NOT a SidebarMenu: it is a separate scrolling flex child. */
[data-tour="sessions-sidebar"] [data-sessions-mode] {
  background-color: var(--ui-editor-surface-background);
  border-radius: 6px;
  box-shadow: var(--retroma-inset);
}
/* SidebarMenuButton never carries data-slot=button. Include contributed nav
   as well as built-ins, while letting the theme's selected row rim win. */
[data-tour="sessions-sidebar"] [data-sidebar="menu-button"] {
  box-shadow: var(--retroma-raised);
}
[data-tour="sessions-sidebar"] [data-sidebar="menu-button"]:active:not([aria-disabled="true"]):not(:disabled) {
  box-shadow: var(--retroma-inset);
}
/* Explicit CSS rendering for boxed buttons; leave native form controls alone. */
[data-slot="button"]:is([data-variant="default"], [data-variant="secondary"], [data-variant="outline"], [data-variant="ghost"]) {
  appearance: none;
}
/* The host currently suppresses utility focus rings globally. Supply a visible
   keyboard cue, without replacing input validation or composer border/glow. */
[data-tour="sessions-sidebar"] [data-sidebar="menu-button"]:focus-visible,
[data-slot="button"]:is([data-variant="default"], [data-variant="secondary"], [data-variant="outline"], [data-variant="ghost"]):focus-visible {
  outline: 2px solid var(--dt-ring);
  outline-offset: -2px;
}
[data-slot="composer-surface"]:focus-within::after {
  outline: 2px solid var(--dt-ring);
  outline-offset: -2px;
}
/* Shared edge treatment joins existing regions without changing their bounds. */
[data-panel-header] {
  box-shadow: inset 0 1px 0 var(--retroma-light);
}
/* The framed body below supplies the seam; only a bodiless header needs one. */
[data-panel-header]:last-child {
  box-shadow: inset 0 -1px 0 var(--retroma-edge), inset 0 1px 0 var(--retroma-light);
}
[data-tour="sessions-sidebar"] [data-sidebar="menu-button"],
[data-slot="bots-roster"] [data-slot="row-button"][data-roster-key] {
  border-radius: 6px;
}
[data-slot="button"]:is([data-variant="secondary"], [data-variant="outline"], [data-variant="ghost"]):hover:not(:disabled):not([aria-disabled="true"]) {
  background-color: color-mix(in srgb, var(--dt-card) 92%, var(--dt-foreground));
}
.desktop-input-chrome:not(:focus):not(:focus-within):not([data-state="open"]):not([aria-invalid="true"]) {
  box-shadow: inset 1px 1px 0 var(--retroma-shade), inset -1px -1px 0 var(--retroma-light);
}
`

export default {
  id: 'retroma-tactile', name: 'Retroma Tactile', defaultEnabled: false,
  description: 'Optional raised controls and inset panels for any theme. Remembers your palette command choice across restarts.',
  register(ctx) {
    let style = null
    let disposed = false
    let userChanged = false
    let pendingSave = Promise.resolve()
    const removeStyle = () => { style?.remove(); style = null }
    const apply = enabled => {
      if (disposed) return
      if (!enabled) { removeStyle(); return }
      if (style) return
      style = document.createElement('style')
      style.dataset.retromaTactile = ''
      style.textContent = skinCss
      document.head.append(style)
    }
    const choose = enabled => {
      if (disposed) return
      userChanged = true
      apply(enabled)
      // Serialize writes so rapid toggles persist the final choice.
      pendingSave = pendingSave.then(() => ctx.storage.set('enabled', enabled))
        .then(() => {
          if (!disposed) host.notify({ kind: 'info', message: enabled
            ? 'Retroma tactile skin is ON and will be restored next launch.'
            : 'Retroma tactile skin is OFF. Theme and fonts are unchanged.' })
        }).catch(() => {
          if (!disposed) host.notify({ kind: 'error', message: 'Retroma skin changed, but its preference could not be saved.' })
        })
      return pendingSave
    }
    const disable = () => choose(false)
    const enable = () => choose(true)
    // A late storage read must never override a newer command or disposal.
    Promise.resolve().then(() => ctx.storage.get('enabled')).then(enabled => {
      if (!userChanged && !disposed) apply(enabled === true)
    }).catch(() => {
      if (!disposed && !userChanged) host.notify({ kind: 'error', message: 'Could not restore the Retroma skin preference; use the palette to enable it.' })
    })
    for (const [id, label, run] of [
      ['enable', 'Enable Retroma tactile skin', enable],
      ['disable', 'Disable Retroma tactile skin', disable],
      ['toggle', 'Toggle Retroma tactile skin', () => style ? disable() : enable()]
    ]) ctx.register({ id, area: PALETTE_AREA, data: { label, keywords: ['retroma', 'skin', 'bevel'], run } })
    ctx.onDispose(() => { disposed = true; removeStyle() })
  }
}
