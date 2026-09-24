# Nebula Skin

Optional decoration for the [Nebula Theme](../nebula-theme/README.md): a pixel-art "station" space wallpaper behind the window, translucent content surfaces over it, crisp top-left-lit bevels (zero blur, after Retroma Tactile) on the sidebar, pane bodies, sessions well and composer, raised navigation pills in per-row hues, a lavender scrollbar, a monospace status bar and the empty-chat wordmark set in the Silkscreen pixel face.

The skin only paints while the Nebula theme is selected; enabling it under another theme changes nothing. Native sizes, padding, hit areas, drag regions and body fonts are untouched. Registration is inert: use **⌘K → Enable Nebula skin** (or Toggle/Disable). Your choice is remembered per client and restored on the next launch.

## Installation

On the computer running Desktop, install the theme first, then:

```sh
PLUGIN=nebula-skin
DEST="${HERMES_HOME:-$HOME/.hermes}/desktop-plugins/$PLUGIN"
mkdir -p "$DEST/assets"
cp "plugins/$PLUGIN/"{plugin.js,README.md,LICENSE} "$DEST/"
cp "plugins/$PLUGIN/assets/"* "$DEST/assets/"
```

The `assets/` folder must sit beside `plugin.js` under the Desktop plugin root: the skin resolves it through the app's `desktopPluginsRoot()` and inlines the wallpaper and font as data URLs via `readFileDataUrl` (under the 16 MB preview cap). A missing wallpaper produces an error notice and the skin runs without it.

## Scope and limitations

- Window glass (Settings → Appearance) owns the same shell layer and keeps it transparent; with glass on the wallpaper will not show.
- No blurred glows or halos: every rim shadow has a 0px blur radius (asserted by the test).
- Rims are pointer-transparent `::after` overlays (the Retroma Tactile approach) so kept-alive panes cannot cover them and no geometry changes.
- Contrast: real prose over the veiled wallpaper is sampled from a screenshot in both modes and must clear 4.5:1; light mode uses a heavier veil for that reason.
- Selector anchors (`data-contrib-shell`, `sessions-sidebar`, `pane-body`, `composer-surface`, `statusbar`, `.wordmark`, …) are checked against the desktop source by the test and will need revisiting if Hermes changes them.
- Tests use an isolated, source-derived **MOCK**, not the live app.

## Provenance and license

Wallpaper and palette © 2026 Ko Vial, MIT ([LICENSE](LICENSE)). The pixel face is [Silkscreen](https://github.com/googlefonts/silkscreen) © The Silkscreen Project Authors, SIL Open Font License 1.1 ([assets/OFL-Silkscreen.txt](assets/OFL-Silkscreen.txt)); the subsetted `silkscreen.woff2` is redistributed under that license.
