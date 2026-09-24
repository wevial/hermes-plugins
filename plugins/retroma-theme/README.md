# Retroma Theme

An optional Hermes Desktop adaptation inspired by [Retroma by emarpiee](https://github.com/emarpiee/Retroma). Light mode uses icy cyan content, lavender panels, mauve window headers, purple text/borders, and rust Markdown headings. Dark mode is an interpretation with deep cyan content, purple panels, and warm peach headings. Light mode retains outlined pastel navigation; dark mode uses muted jewel fills with brighter companion inks. Text inputs and the actual chat composer use warm cream in light mode and muted dark teal with light mint ink in dark mode.

This is a palette contribution plus a small, theme-scoped color stylesheet. Registering it does **not** select it. No font overrides, external font requests, settings writes, or theme-selection requests are made. Raised controls are independently available in [Retroma Tactile](../retroma-tactile/README.md).

## Installation

From this repository, on the computer running Desktop:

```sh
PLUGIN=retroma-theme
DEST="${HERMES_HOME:-$HOME/.hermes}/desktop-plugins/$PLUGIN"
mkdir -p "$DEST"
cp "plugins/$PLUGIN/"{plugin.js,README.md,LICENSE} "$DEST/"
```

Use the plugin directory belonging to your intended Desktop profile. The folder name must match the plugin ID. Desktop discovers the plugin; enable it in Settings → Plugins if necessary. Choose **Retroma** in Appearance only when you want to apply it. Registering/reloading does not select Retroma; if Retroma was already selected, reloading updates its colors.

To restore your appearance, choose your previous theme. Before uninstalling an active Retroma theme, select another theme, disable Retroma Theme, then remove its installed folder. Disposal removes its stylesheet and the host removes its theme contribution. No previous-theme snapshot is stored or automatically restored.

## Scope and limitations

- Targets the September 2026 Hermes Desktop theme/SDK contracts. `THEMES_AREA` accepts a `DesktopTheme`; `data-hermes-theme` and `data-hermes-mode` gate the stylesheet.
- Native token mixing normally washes out card colors. The scoped CSS maps content/sidebar/elevated surfaces to their exact theme seeds, adds heading/header roles, and makes completion drawers opaque, including when their input token is translucent.
- Mauve applies to renderer window-edge panel headers. OS-native titlebar/traffic-light colors remain controlled by Hermes; no native bridge changes are made.
- Theme colors are intentionally fixed rather than Retroma's accent-generated OKLCH system. Native accent overrides can still affect host-rendered roles. Dark colors are an interpretation, not a claimed upstream preset.
- Real navigation mapping: `sidebar-nav-new-session` → red, `skills` → orange, `messaging` → yellow, `artifacts` → green, `cron` → cyan; `profile-switcher` buttons → blue; `bots-roster` / `row-button[data-roster-key]` → violet. Mapping uses fixed control roles, never label text, ordering, or the value of a roster key. Unknown contributed navigation remains native.
- The sessions sidebar's actual `data-sidebar="menu"` and Bot Mode's `bots-roster` form cyan wells inside lavender frames. No layout dimensions or spacing are changed. Bot group-chat rows without `data-roster-key` remain native.
- Current navigation does **not** pass `isActive` into `SidebarMenuButton`; `data-active` stays false even on selected routes. Selection therefore targets the source's literal `bg-(--ui-control-active-background)` class. Bot rows similarly use `bg-(--ui-row-active-background)`. These dependencies are contract-tested and must be revisited if Hermes changes selection markup. No route or click handlers are replaced.
- Hover adds a subtle role tint; selection adds a stronger fill and persistent inset rail. Disabled rows do not receive hover tint. The sidebar has a quiet cyan wash connecting its existing regions. Native keyboard focus outlines remain owned by Hermes.
- Rainbow values are direct row declarations, not shared status/error tokens. Nested status indicators keep their explicit native tokens. No observers, document-text inspection, user data extraction, or persistence are used.
- Native input borders, validation, disabled opacity, and focus behavior remain owned by Hermes. Color bridges cover real Input/InputGroup/Textarea and composer surface/rich-input slots; no typography override is added.
- No Obsidian layout, folder coloring, fonts, CRT effects, or application-specific integrations are ported. Core font-selection behavior still applies when choosing any theme.
- Tests use an isolated, source-derived **MOCK**, not the real Hermes application. Live Desktop, Bot Mode routing, OS chrome, HUD/glass modes, drag/drop, and future component selector changes are not certified.

## Provenance and license

Upstream: **emarpiee / Retroma**, [revision `cf9c544c4950529e0ce87587127e6b72d5451848`](https://github.com/emarpiee/Retroma/tree/cf9c544c4950529e0ce87587127e6b72d5451848).

Inspected `theme.css`, `README.md`, and `LICENSE.txt` at that revision. The upstream source supplies the design vocabulary: paper/panel/titlebar separation, colored headings, and raised/inset light-and-shadow treatments. Local changes replace Obsidian selectors and generated colors with Hermes contributions and scoped CSS. No upstream screenshot or personal reference content is distributed.

Upstream copyright © 2026 emarpiee. The upstream MIT license is preserved verbatim as [LICENSE](LICENSE); retain it with installed copies. Hermes adaptation © 2026 Ko Vial, also MIT under the repository license.

See [test instructions and coverage](../../test/retroma/README.md).
