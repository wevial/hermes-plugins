# Nebula Theme

A deep-indigo space palette for Hermes Desktop: dark mode is a near-black navy field with lavender rims, cyan and gold accents and lavender meta text; light mode is a tinted lavender interpretation with the same rims and a deeper blue accent. The wallpaper, glow rims and pixel wordmark are the separate, opt-in [Nebula Skin](../nebula-skin/README.md).

This is a palette contribution plus a small theme-scoped color stylesheet. Registering it does **not** select it. No font overrides, external requests, settings writes or theme-selection requests are made.

## Installation

On the computer running Desktop:

```sh
PLUGIN=nebula-theme
DEST="${HERMES_HOME:-$HOME/.hermes}/desktop-plugins/$PLUGIN"
mkdir -p "$DEST"
cp "plugins/$PLUGIN/"{plugin.js,README.md,LICENSE} "$DEST/"
```

Enable it in Settings → Plugins if necessary, then choose **Nebula** in Appearance. To restore your appearance, choose your previous theme; disable and remove the folder only after switching away from it.

## Scope and limitations

- Targets the September 2026 Hermes Desktop theme/SDK contracts (`THEMES_AREA`, `data-hermes-theme` / `data-hermes-mode` root markers).
- The scoped CSS pins content, sidebar and elevated surfaces to their seeds (the host otherwise mixes them toward neutral grey), gives tertiary text its lavender, colors Markdown headings and links, and makes completion drawers opaque. No layout, spacing or typography changes.
- Colors are fixed hand-tuned values. Every palette foreground/background pair meets 4.5:1 in both modes (checked by `test/nebula/test.mjs`).
- Tests use an isolated, source-derived **MOCK**, not the live app.

## License

© 2026 Ko Vial, MIT ([LICENSE](LICENSE)).
