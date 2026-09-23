# Bounded Exchanges (Desktop pane, read-only)

A Hermes Desktop pane for reviewing Bounded Events (`hermes-bounded-events` repository)
exchanges. One viewer covers several profiles. **All profiles** is an overview, shown only if
the operator enables it. You can also select a single profile. The pane shows inbound messages
from an external agent, their routing and handoff state, and the correlated bot replies. It has
**no** send, replay, approval or subscription controls.

## Status: what is runnable vs tested vs live

| Piece | State |
| --- | --- |
| Read model, multi-profile service, terminal viewer (bounded-events) | Implemented; offline unit tests |
| Backend route package: `python3 -m bounded_events viewer-bundle` builds `dashboard/plugin_api.py` + a verified vendored service | **Runnable artifact.** Mounted by the real Hermes web server in an isolated synthetic HOME (`tests/integration/viewer_host_mount.py`, 23 checks) |
| This pane: reads `/api/plugins/bounded-exchanges/…` through `ctx.rest` | Implemented; browser tests with a stubbed SDK and the real service responses |
| Installed on a real Hermes backend and viewed in a real Desktop | **Not done.** Not installed, not enabled, never run live |

If the Desktop build offers plugins no `ctx.rest`, the pane shows **Not connected**. If the
backend route is missing, disabled or not yet loaded, the pane shows **not reachable**. Neither
case is shown as an empty list.

## Setup (operator, on the backend host)

Every step below changes a live installation. Do them only under an approved activation.

1. Build the package from a reviewed checkout. Include this pane as the Desktop half:
   ```sh
   python3 -B -m bounded_events viewer-bundle --out /abs/NEW-dir \
     --desktop-js /path/to/hermes-plugins/plugins/bounded-exchanges/plugin.js
   ```
2. Copy the whole directory to `<HERMES_HOME>/plugins/bounded-exchanges/`. Use the
   `HERMES_HOME` the backend process was **launched** with.
3. Write the allowlist `<HERMES_HOME>/plugins/bounded-exchanges/viewer-config.json`, mode `0600`,
   **next to** `dashboard/` and never inside it:
   ```json
   {"kind": "bounded-events.exchange-viewer", "schema": 1, "overview": true,
    "profiles": [
     {"id": "alpha", "label": "Alpha bot",
      "hermes_home": "/home/me/.hermes/profiles/alpha", "root": "/home/me/be-roots/alpha"},
     {"id": "beta", "label": "Beta bot",
      "hermes_home": "/home/me/.hermes/profiles/beta", "root": "/home/me/be-roots/beta"}]}
   ```
4. Add `bounded-exchanges` to `plugins.enabled` and restart the backend. Routes mount only at
   startup.
5. In Desktop, enable **Bounded Exchanges** in Capabilities → Plugins. It is opt-in. Then open
   **Open Bounded Exchanges** from ⌘K.

To stop serving it, remove `bounded-exchanges` from `plugins.enabled`. The host then returns
404 per request, without a restart. To uninstall, also delete the package directory.

## Access and scope caveats (read before enabling)

- **Backend-wide read authorization.** The route uses the backend's ordinary authentication
  and nothing more. Anyone authenticated to that backend can read **every profile listed in
  `viewer-config.json`**, including message and reply text. List only profiles that every user
  of that backend may review.
- **Overview scope.** `viewer_profile=all` aggregates only the listed profiles, and only when
  `"overview": true`. It is one bounded page: up to 10 items per profile, capped by `limit`.
  It is never a fallback to the backend's own `HERMES_HOME`. An unreadable profile marks it
  **incomplete**.
- **Connection identity.** The pane shows whatever backend Desktop routes the plugin request
  to. Normally that is the shared local host backend. An isolated backend
  (`HERMES_DESKTOP_ISOLATED_BACKEND`), a remote backend or a per-profile remote override
  answers from **its own** package and config, or reports not reachable or `not_configured`.
  The profile list comes from the answering backend's config. It is not proof of which
  machine answered.
- The client never sends a path. Desktop's own `?profile=` routing parameter is ignored. Each
  configured root must be bound to its configured `hermes_home`, or that profile is
  unavailable.
- **No agent tools.** The package has no `plugin.yaml` and registers none. Its interaction with
  the agent-side plugin loader when enabled was not tested.

**Packaging choice.** The service code ships only from bounded-events, vendored and
hash-verified in the built package. This folder holds only the pane.

## Dependency contract

- Plain ESM loaded **uncompiled** by the Desktop disk loader. It imports only
  `@hermes/plugin-sdk`, `react` and `react/jsx-runtime`, and uses `jsx()`/`jsxs()`. Its only
  I/O is `ctx.rest` to its own namespace: no fetch, file access or `host.request`.
- SDK surface used: `ctx.rest`, `PANES_AREA`, `PALETTE_AREA`, `host.openWorkspace`
  (feature-detected, with a `host.notify` fallback), `Badge`, `Button`, `Input`, `Loader`,
  `EmptyState` and `ErrorState`. Styling uses `var(--ui-*)` theme variables only.
- Data contract: `GET /profiles` → `ExchangeService.profiles()`;
  `GET /exchanges?viewer_profile=…` → `ExchangeService.handle()`
  (`bounded-events.exchange-service` schema 1).
- Developed against the installed Hermes source `358d50ca6dcb01b93ed226ce27f7f0de6d142111`
  (read-only; not proof of a running build or of latest upstream).

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
- a fixture generated from the real multi-profile service on disposable roots.

**Stubbed:** every SDK component, `host` and the registry context. Passing tests are **not**
live Desktop evidence.

Backend route, real host mount (from the bounded-events checkout). It runs with a Python
that already has the Hermes web dependencies, inside a throwaway synthetic HOME:

```sh
python3 -B tests/integration/viewer_host_mount.py --hermes-src /path/to/hermes-agent
```
