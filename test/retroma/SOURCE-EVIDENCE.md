# Source evidence: tactile client regression

Inspected 2026-09-16. The supplied actual-client screenshot reports **v0.21.3**. Read-only inspection found that all files below in the client machine's source checkout match the local test checkout byte-for-byte (SHA-256). This identifies the inspected source precisely; it does **not** establish that the running renderer was built from that checkout. No live DOM inspection, GUI input/capture, install, or restart was performed.

The installed tactile entry point matched the pre-repair source (SHA-256 `b195435143b70618b07646450bdb838bbc415ec36967f5f1ff48ecde7da7f483`). No screenshot content was copied into fixtures. Generic mock text only.

| Source relative to desktop/src | Relevant anchors/lines | SHA-256 |
| --- | --- | --- |
| `app/chat/sidebar/index.tsx` | 1461–1475: positioned noncollapsible Sidebar; 1493–1505: SidebarMenuButton; 1620–1624: separate data-sessions-mode scroll child | `929dff8e048ff96c6ad3beee0fc42a63aae8f837a48d6422e7549494acb29507` |
| `components/ui/sidebar.tsx` | 146–155: collapsible=none returns data-slot=sidebar; 340–350: SidebarContent; 486: sidebar-menu-button | `5f4df4a2ccee11ccfad1afdeba9ef74ce7de27baa56ec328ea08971cbe43f2f9` |
| `components/ui/button.tsx` | 17–46: native variants/focus utilities; 100–102: SDK data attributes | `8437fdd395d8af0219bd681cb3e1a39bdbaafe1e7ed463ee1f4428040b0e0892` |
| `components/pane-shell/tree/renderer/tree-group.tsx` | 430–434: positioned group; 513–514: header; 719–734: opaque kept-pane layer can cover parent shadows | `ac18bbaa8bebc735cfa98aef42b52df6fcdf66cb3200431570d3093b3d2c4211` |
| `plugins/hermes-bots/roster-pane-content.tsx` | 129: scrollable bots-roster and child grid | `d906dee7f3b03d5b1f4c8017484eef45de3ae941d26682ab3b34282cb8eb3820` |
| `plugins/hermes-bots/roster-pane-toolbar.tsx` | toolbar first child, compact SDK ghost buttons, optional search/filter row | `8e0a6788e1d883d92cf2c4597cc1b9e94a97154bdd08bc3338e51053356afea4` |
| `app/chat/composer/index.tsx` | 1380–1394: positioned isolated composer-surface and background child | `03e7cc2aa0575fa35f1d5ed720d7ec06fcdc5b94831f1c8642f1e1edce07e2dd` |
| `styles.css` | 1226–1240: global focus-ring suppression; 1338–1361: input focus/invalid cascade; 1866: composer surface | `6e6be55ace0aa8e4a1eefd9dfd2013ecb91789f9c0ee00e2b866969506f12642` |
| `sdk/index.ts` | 633: host.notify supported in-app toast | `e68ccb464f1a8baf812d5881b603153c4ca57af6bffc3d5d677d6345204a9fff` |
| `contrib/runtime-loader.ts` | unsupportedImports / rewriteSpecifiers exercised by test | `a9e90cc744b4c71178547e2e1009f8745daa2cc485d18947e2de3ee18055c09f` |

## Diagnosis and test evidence

- The old skin styled `data-sidebar=menu`, but the bulk Sessions list is a sibling `data-sessions-mode` scroller. It therefore remained a flat lavender area. The old mock contained no Sessions list at all.
- Navigation rows are `sidebar-menu-button`, not `button`. The old skin only rounded their corners; most rainbow outlines visible in the screenshot already came from the theme. The repair adds relief to real navigation, including contributed rows, without replacing their color rules.
- Tree-group parent inset shadows paint below opaque child panes. Parent-only computed-shadow assertions cannot prove a visible frame. The fixture now includes an opaque child pane and the repair uses a positioned, pointer-transparent rim over it. Sessions/sidebar and composer hosts are already positioned in source. No CSS layout/scroll/drag properties are changed.
- The old `composer-surface:not(:focus-within)` intentionally removed its bevel during typing. Its new overlay persists without replacing native border/glow styles. Host CSS globally suppresses native/utility focus rings; the skin adds a visible outline on its boxed controls/navigation and the focused composer. Inputs still yield to their real focus/invalid CSS.
- Native button variants are Tailwind utilities; the injected skin is unlayered. The theme's more-specific selected-row styles intentionally win over generic relief. No broad `!important` override is used. Boxed buttons get `appearance:none` for deterministic CSS rendering; this is defensive normalization, not a demonstrated macOS root cause. Native form widgets are not reset. The mock includes utility-layer variants, the actual unlayered stylesheet, transparent ghost/outline/text controls, disabled controls and focus behavior, but does not compile Tailwind or emulate AppKit.
- Registration is deliberately inert. Settings enabling registers commands; a separate palette command activates the skin, and reload resets it. The screenshot cannot establish whether that command ran. Commands now report ON/OFF using supported `host.notify`, including idempotent invocations; registration/disposal remain silent.

The added regression was run before the repair and failed with `Sessions scrolling list needs its own inset well` (`boxShadow: none`). It passes after the repair, checks light/dark wells, overlaid rims, focused composer, actual navigation relief, fixed geometry and scroll offsets, on/off feedback, and cleanup. Existing checks exercise actual loader transformation, theme application, keyboard editing, input validation, selection/hover, semantic status colors, font preservation, narrow viewport, and disposal/stale callbacks. Native transition settling is explicit so restored-style assertions do not sample an in-flight 100ms animation.

Generated light/dark previews are MOCK partial integrations. Visually review them locally; live Electron rendering, OS appearance, pane drag interactions, IME, HUD/glass modes, and Font Picker integration remain unverified. No theme source or typography settings were changed. No automatic activation, storage, or root attribute mutation was added.

## Targeted Cmd+K perimeter polish (2026-09-16)

Local source inspection only for this follow-up; no Mac access or live app interaction.

- `app/command-palette/index.tsx:1526–1544`: Radix Content combines `HUD_POSITION`, `HUD_SURFACE`, the exact `w-[min(34rem,calc(100vw-2rem))]` class, overflow clipping, and a direct `<Command className="bg-transparent">` child. The plugin requires the dialog role, this width class, and the direct command slot together. Ordinary dialogs, command pickers without that width, and HUDs without the direct command child do not match. The class dependency is checked by the source contract regression.
- `app/floating-hud.ts:11–20`: content is already fixed, rounded and bordered; the overlay inherits its existing radius without changing layout, native shadow, fill, animation, or drag rules.
- `components/ui/command.tsx:15,35,53,73`: command, input and list slots; group headings can have z-index 10. The new `::after` paints at z-index 20 with pointer events disabled, a 2px popover-foreground rim and a 1px matching bevel. Existing theme variables give a dark purple rim in light mode and a readable light rim in dark mode. No theme tokens were changed.
- `app/chat/sidebar/index.tsx:1462–1474` supports flipped sidebar borders; `components/pane-shell/tree/renderer/tree-group.tsx:432–434` identifies groups/top-edge but not adjacency to the sidebar. Optional internal corner polish is deferred: these anchors alone do not safely identify which shared corners to square across layouts.

`test.mjs` adds a source-derived palette container with opaque descendants and a z-10 heading. It checks all four rim pixels against skin-off rendering (at least 3:1 contrast in both modes), unchanged bounds/fill/font/input outline/scroll dimensions and offsets, focus retention, click and typing, MOCK shortcut open/Escape close, unrelated dialog/HUD exclusion, disable pixel restoration, and disposal. The MOCK keyboard handlers do not execute Radix/cmdk: real focus trapping and keyboard dispatch remain for parent/live verification. Existing theme-color sampling now uses the suite's transition-settling helper after a mode switch.

Generic previews: `.local/mock-palette-light.png` and `.local/mock-palette-dark.png`. Both were visually inspected: continuous readable rims surround the unchanged fills, with subtle inner bevels. No private screenshot text was copied into the fixture.
