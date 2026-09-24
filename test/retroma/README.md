# Retroma local verification

Reuse the existing Theme Studio dependencies; no separate dependency tree is needed:

```sh
npm ci --prefix test/theme-studio
HERMES_DESKTOP_SRC=/path/to/hermes-agent/apps/desktop/src \
CHROMIUM_PATH=/path/to/chromium \
node test/retroma/test.mjs
```

The test requires the actual source checkout and fails if required contracts cannot be extracted. It runs the installed loader's **actual `unsupportedImports` and `rewriteSpecifiers` functions**, transpiled with esbuild, before browser import. It checks the installed `isValidTheme` function, all required color keys, and the component selector anchors. It bundles the actual `applyTheme` function and real color helpers and loads the actual `styles.css` (without package imports). Native appearance/font-preference side effects are stubbed; no live host is contacted.

Ten check groups cover:

1. Loader transformation, theme contract, and source selectors, including the known loader false-positive regression.
2. Inert registration: no root/selection/storage changes and no active tactile stylesheet.
3. Registered Enable command, duplicate enable, dimensions and fonts unchanged.
4. Exact light/dark surface roles and opaque completions with a translucent token.
5. Seven navigation-role fills in both modes with skin on/off; normal, hover, selected and restored states; disabled-hover exclusion; text contrast ≥4.5:1 and row/input edges ≥3:1; distinct input/composer surfaces; keyboard focus, validation, status isolation and deterministic mapping after label/key/order changes.
6. All palette foreground/background pairs and rendered heading, titlebar, body, sidebar, toolbar, code, terminal, popup, input/composer and placeholder text roles ≥4.5:1, with a saved contrast report.
7. Keyboard focus, native input/contenteditable editing, disabled buttons and pressed state.
8. Theme scoping, independent skin operation, Toggle, disable/dispose/reload cleanup and stale callback safety.
9. Sessions scrolling well, child-safe workspace/composer rims, focused perimeter, on/off notifications, geometry and scroll restoration.
10. Narrow viewport overflow and reduced-motion browser rendering without page errors.

The SDK contribution registry is an isolated test context. Separate mock Sessions and Bots panes mirror the shell: Sessions includes its distinct `data-sessions-mode` scrolling list, and the workspace includes an opaque child layer that covers a parent-only shadow. The sidebar mirrors real SidebarMenu nesting and stable navigation IDs; Bot Mode mirrors the toolbar/roster/RowButton slots and actual active utility classes. There is no invented ARIA selection state. Fixture anchors are checked against source, but the representative DOM and representative native button variants/utility cascade are handwritten; Tailwind is not compiled. This does not mount the full Hermes app or prove live command-palette, Bot Mode, drag/drop, Electron, IME or OS integration. Preview controls exercise the registered command callbacks in the mock registry.

## Local preview

After a successful test:

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory test/retroma/.local
```

Open `http://127.0.0.1:8765/`. Light, Dark and Toggle tactile operate only on this isolated page. The preview initially shows light mode with the skin off. Static `mock-light.png` and `mock-dark.png` show the skin on. All are prominently labeled **MOCK — not the real Hermes app**, use generic text, and contain no user screenshot content.

See [source evidence and regression notes](SOURCE-EVIDENCE.md).

Generated HTML/JS/CSS, screenshots, fetched upstream inspection files `contrast.json`, and `results.json` live in ignored `.local/`. Keep generated artifacts and operational reports out of distribution. The runtime artifacts are only each plugin's `plugin.js`, `README.md`, and `LICENSE`.

Cmd+K polish regression also produces `.local/mock-palette-light.png` and
`.local/mock-palette-dark.png`. These are generic source-derived MOCK previews,
not captures of Hermes. Tests sample the visible perimeter over opaque children,
check both theme modes and unrelated dialogs, and preserve geometry, focus,
editing, scrolling and cleanup. Source anchors and live-testing limits are in
`SOURCE-EVIDENCE.md`.
