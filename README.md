# Personal Hermes Desktop plugins

Small, optional customizations for the native [Hermes Desktop](https://hermes-agent.nousresearch.com/docs/developer-guide/desktop-plugin-sdk) app. Independent community project; not an official Nous Research product.

## Plugins

- **[Font Picker](plugins/font-picker/README.md)** — choose a local chat/interface font, preview it, and reset to the theme default. Leaves code and terminal fonts alone.
- **[Theme Studio](plugins/theme-studio/README.md)** — a customized version of Billy Wayne McCann's [Theme Studio](https://github.com/exergonic/hermes-desktop-plugins/tree/main/theme-studio), with a Bot Mode-friendly editor tab, three-/four-color palette generation, visibly tinted light/dark surfaces, and a contrast slider. Original single-color generation and import/export remain available.

## Install

Clone and inspect the plugin you want before installing:

```sh
git clone https://github.com/wevial/hermes-plugins.git
cd hermes-plugins
# Run on the computer running the Desktop app, not just its remote backend.
PLUGIN=theme-studio  # or font-picker
DEST="${HERMES_HOME:-$HOME/.hermes}/desktop-plugins/$PLUGIN"
mkdir -p "$DEST"
cp "plugins/$PLUGIN/"{plugin.js,README.md,LICENSE} "$DEST/"
```

Use the actual Desktop profile's plugin directory if it differs. Enable the plugin in **Settings → Plugins**, then use **⌘K / Ctrl+K → Open Theme Studio** or **Font Picker**. If absent, run **Reload desktop plugins**. Close and reopen an existing plugin tab after upgrades.

Theme Studio only becomes your active theme when you choose it in **Appearance**. Seed colors and contrast apply when you click **Generate light + dark**; individual token edits update the registered theme. Export your palette before major changes. Font Picker is opt-in and does not apply a font before selection.

To uninstall, disable the plugin and remove its installed folder. Switch to another theme before removing an active Theme Studio theme.

## Development and tests

Plugins are plain JavaScript ESM, loaded uncompiled by the Desktop SDK. No runtime package installation is required. Tests need Node.js and Chromium:

```sh
cd test/theme-studio
npm ci
CHROMIUM_PATH=/path/to/chromium npm test
# Optional mock-layout preview, not a screenshot of the real Hermes UI:
CHROMIUM_PATH=/path/to/chromium node swatch-preview.mjs
```

The browser suite uses real React and Chromium with a **stubbed Hermes SDK**. It covers generation, contrast, persistence, and registered command/render wiring, but is not a live Desktop end-to-end test. Existing React development warnings are recorded by the harness.

An additional loader-regression check needs a Hermes source checkout:

```sh
HERMES_RUNTIME_LOADER=/path/to/hermes-agent/apps/desktop/src/contrib/runtime-loader.ts \
  node test/theme-studio/loader-transformation.mjs
```

Desktop APIs evolve; these plugins were developed against a September 2026 Desktop checkout. Verify compatibility with your version. This public snapshot includes the Theme Studio test harness; the earlier private Font Picker development harness is not included.

## License and attribution

[MIT](LICENSE) for original work and local modifications, © 2026 Ko Vial. Theme Studio derives from **Billy Wayne McCann / exergonic**, also MIT; its [original license](plugins/theme-studio/LICENSE), inline notice, pinned upstream revision, and modification notes are retained. See its README for provenance.

Published as a clean source snapshot. Private development history and machine-specific operational notes are intentionally not included.
