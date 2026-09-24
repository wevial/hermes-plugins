# Retroma Tactile

An independently optional Hermes Desktop skin inspired by [Retroma by emarpiee](https://github.com/emarpiee/Retroma). It gives actual sidebar navigation and boxed SDK buttons raised edges and panels/inputs inset bevels, with consistent six-pixel control and panel corners. The scrolling Sessions list, sidebar menus, and Bot Mode roster wells get inset frames; the existing roster toolbar gets one grouped raised frame. It works with any active theme, using that theme's tokens. It never selects a palette.

It preserves native compact button sizes, padding, hit targets, layout, fonts, drag regions, and input behavior. Inline text/link actions and destructive buttons retain their native treatment. Inputs keep host focus/validation borders and shadows. The composer perimeter persists on focus, with an additional keyboard/typing outline; boxed controls and navigation get a keyboard focus cue. Pane and composer bevels use pointer-transparent overlays above opaque children; control bevels use inset shadows so they do not enlarge bounds or require moving controls when pressed.

## Installation and explicit opt-in

From this repository, on the computer running Desktop:

```sh
PLUGIN=retroma-tactile
DEST="${HERMES_HOME:-$HOME/.hermes}/desktop-plugins/$PLUGIN"
mkdir -p "$DEST"
cp "plugins/$PLUGIN/"{plugin.js,README.md,LICENSE} "$DEST/"
```

Use the intended Desktop profile's plugin directory. The plugin defaults **disabled**. Enable **Retroma Tactile** in Settings → Plugins to register its commands. On first use, run **Enable Retroma tactile skin** in the command palette. **Disable Retroma tactile skin** removes the style immediately; **Toggle Retroma tactile skin** switches either way.

Your last command choice is saved in plugin-scoped storage and restored when the client reopens or the plugin reloads. After upgrading from the session-only version, enable the skin once to save your preference. Disabling the skin saves OFF. Disabling/unloading the plugin removes its stylesheet and commands without erasing the saved preference; re-enabling the plugin restores that preference. No palette, font, or root-element changes are made. Repeated commands, late restoration, and disposal are safe. Storage errors are reported instead of claiming the preference was saved.

Persistence regression: `node --test test/retroma/persistence.test.mjs` from the repository root. This uses isolated renderer/storage doubles, not a live-client restart.

## Limitations

This is a renderer CSS plugin, not Hermes' CLI/YAML color-skin format. It depends on SDK button data attributes, `.desktop-input-chrome`, `data-sessions-mode`, and pane `data-tree-group` anchors. Sidebar navigation uses `data-sidebar="menu-button"`, not the SDK button slot. The theme's selected-row border and fill remain in control. The palette is unchanged; the Sessions well uses the existing editor surface token (icy cyan in Retroma light).

Pane/sidebar/composer hosts are already positioned in the inspected source. Their `::after` rims paint above opaque child panes, use inset shadows, and ignore pointer input; they do not alter padding, overflow, positioning, or hit areas. This depends on those pseudo-elements remaining unused by the host. The roster toolbar has no dedicated data slot: its frame uses the first sibling before `bots-roster`, matching the inspected structure. Loading/empty rosters without that well receive no toolbar frame. These structural dependencies are less stable than dedicated slots. Boxed buttons explicitly use CSS appearance; native form-control appearance, status icons, inline actions, fonts, and drag regions are not overridden. Focused/invalid inputs retain host styling.

The source-derived browser fixture checks toggle/disposal, focus/input behavior, dimensions, and fonts. It is a **MOCK partial integration test**, not a live Desktop or Bot Mode test. Native OS chrome, real pane dragging, IME integration, HUD/glass modes, and all third-party controls remain unverified. See [tests](../../test/retroma/README.md).

## Provenance and license

Upstream **emarpiee / Retroma**, MIT, pinned to [revision `cf9c544c4950529e0ce87587127e6b72d5451848`](https://github.com/emarpiee/Retroma/tree/cf9c544c4950529e0ce87587127e6b72d5451848). The upstream `--rtm-btn-3d-normal` / `--rtm-btn-3d-active` inset shadow/light concept and inset pane treatment informed this restrained adaptation. Local work replaces the dynamic light-angle math, Obsidian selectors and sizing with theme-aware, fixed two-pixel edges and Hermes lifecycle cleanup. No fonts or upstream assets are bundled.

Copyright © 2026 emarpiee; [LICENSE](LICENSE) preserves the upstream MIT text verbatim. Hermes adaptation © 2026 Ko Vial, also MIT under the repository license. Retain the license alongside installed copies.
