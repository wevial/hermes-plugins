# Bounded Exchanges (Desktop pane, read-only, not yet connected)

A Hermes Desktop pane for reviewing Bounded Events (`hermes-bounded-events` repository)
exchanges. It shows inbound messages from an external agent, their routing and handoff state,
and the correlated bot replies. It has **no** send, replay, approval or subscription controls.

> **Status: the pane does not read any data yet.** The registered pane shows **Not connected**.
> Use the terminal viewer for real exchanges:
>
> ```sh
> python3 -B -m bounded_events exchanges --root /absolute/runtime-root
> ```

## What ships where

| Piece | Location | State |
| --- | --- | --- |
| Shared read model (projection, filters, pages, safety checks) | bounded-events `bounded_events/exchange_view.py` | Implemented and tested |
| Terminal viewer | bounded-events `python3 -m bounded_events exchanges` | Implemented and tested |
| Served request adapter (query allowlist, settings-only root, profile-home binding) | bounded-events `bounded_events/exchange_api.py` (`handle(settings, profile_hermes_home, query)`) | Implemented and tested; **not mounted** |
| Desktop pane + palette command | this folder, `plugin.js` | Implemented; registered pane is disconnected |

**Packaging choice.** The product backend stays in the bounded-events repository and is not
copied here. Duplicating the read model in a plugin folder would leave two copies of the
ledger-safety rules. Once the seam below is resolved, the connected form should be a
bounded-events-built package. It would follow the SDK's "one package, both SDKs" layout:
`dashboard/plugin_api.py` calling `exchange_api.handle`, plus this `plugin.js` as
`desktop/plugin.js`. It would be built and hash-pinned from a reviewed checkout, like the
reply plugin bundle.

## Dependency contract

- Plain ESM loaded **uncompiled** by the Desktop disk loader. It imports only
  `@hermes/plugin-sdk`, `react` and `react/jsx-runtime`, uses `jsx()`/`jsxs()` rather than JSX
  syntax, and makes no network, file or `host.request` calls.
- SDK surface used: `PANES_AREA`, `PALETTE_AREA`, `host.openWorkspace` (feature-detected, with a
  `host.notify` fallback), `Badge`, `Button`, `Input`, `Loader`, `EmptyState` and `ErrorState`.
  Styling uses `var(--ui-*)` theme variables only.
- Data contract: `bounded-events.exchanges` schema 1, exactly as returned by
  `exchange_api.handle(...)["data"]`. The UI fixture used in tests is generated from that real
  function on a disposable root.
- Developed against Hermes Desktop source `358d50ca6dcb01b93ed226ce27f7f0de6d142111`
  (disk revision; not proof of a running build).

## Why the pane is not connected (seam blocker)

A connected pane would call `ctx.rest('/exchanges?…')`, which reaches
`/api/plugins/bounded-exchanges/exchanges` on the Desktop backend. For a profile-scoped
viewer, the backend must know **which profile** the request is for. Only then can it read
that profile's configured root and check the root's recipient binding. At the assessed
revision this cannot be proven with supported interfaces:

1. `apps/desktop/electron/connection-config.ts`: `localPrimaryRequestScope` does not list
   `/api/plugins/*`. For the **primary** profile, a plugin REST call therefore carries no
   `?profile=` (lines 799–809). It lands on the one shared host backend, whose launch
   `HERMES_HOME` can belong to a different profile (the comment there cites a wrong-profile
   write, #118431). Non-primary local profiles do get `?profile=X` (case 6, lines 844–851).
2. Resolving `?profile=X` to a profile home and config inside `plugin_api.py` is only possible
   through private helpers: `hermes_cli.web_server_profiles._config_profile_scope` and
   `_resolve_profile_dir`. The documented backend imports (`hermes_constants.get_hermes_home`,
   `hermes_cli.config.load_config`) return the **process** home unless a caller scopes them.
3. Backend routes mount only for plugins in the launch profile's `plugins.enabled`
   (`hermes_cli/web_server_dashboard.py`, `_plugin_api_mount_skip_reason`). Enablement is
   host-wide, not per profile.

Unblocking needs one of the following: a supported, request-scoped profile context for
plugin routes (for example, Desktop always sending `?profile=` for `/api/plugins/*`, plus a
public resolver), or an operator-supplied single-profile deployment where the backend
process home is the recipient's. Until then, `createRestSource` exists only to pin the query
contract. `register()` never uses it.

## Tests

```sh
node test/bounded-exchanges/test.mjs \
  --desktop-src /path/to/hermes-agent/apps/desktop/src \
  --bounded-src /path/to/hermes-bounded-events \
  --chromium /path/to/chromium
```

The flags can also be given as the env vars `HERMES_DESKTOP_SRC`, `BOUNDED_EVENTS_SRC` and
`CHROMIUM_PATH`. The test uses the dependencies already installed under `test/theme-studio/`.
No Chromium was on `PATH` in the development environment. The verified runs used the
playwright-core browser cache that was already present:
`~/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`. Nothing was installed. Without
any Chromium, the browser checks cannot run; that is a blocker, not a pass.

**Real in the test:**

- the uncompiled `plugin.js`;
- the Desktop checkout's loader import allowlist and specifier rewrite;
- its `sdk/runtime.ts` shim builder;
- React 19 in Chromium;
- a fixture generated from the real read model.

**Stubbed:** every SDK component, `host` and the registry context. Passing tests are **not**
live Desktop evidence.

## Install

Not recommended while the pane is disconnected. It would only display the blocker. If you
still want to see it, copy `plugin.js`, `README.md` and the repository `LICENSE` to
`$HERMES_HOME/desktop-plugins/bounded-exchanges/` on the machine running the Desktop app. It
is opt-in (`defaultEnabled: false`). A runtime plugin loaded through a backend-host path is
not automatically installed on a separate Desktop client machine.
