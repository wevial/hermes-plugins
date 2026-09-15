# Font Picker

A Hermes Desktop plugin for choosing the chat/interface sans-serif font without changing code or terminal fonts.

## Use

Install `plugin.js` using the root README instructions, enable **Font Picker** in **Settings → Plugins**, then open **⌘K / Ctrl+K → Font Picker**. Pick a font or type a family name. **Reset** restores the theme font.

The plugin is disabled by default. It applies nothing until you select a font; selections persist in plugin-scoped storage. Local font enumeration uses Chromium's `queryLocalFonts` when available and permission is granted. Quick picks target macOS fonts; a manual family entry is available on other builds. No web fonts are downloaded.

## Implementation and limits

Only `--dt-font-sans` is overridden. A MutationObserver reapplies the selection after a theme repaint; reset/disable restores the captured theme value. Family names are validated before applying through CSSOM. Compatibility depends on the Desktop SDK and theme variables.

The plugin was exercised in isolated browser tests and used on macOS. The original private development harness is not included in this public snapshot; the Theme Studio harness does not test Font Picker.

MIT — © 2026 Ko Vial. See the repository LICENSE.
