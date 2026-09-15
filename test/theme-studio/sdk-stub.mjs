/**
 * SDK stub for browser tests. Mirrors ONLY the verified export surface of
 * apps/desktop/src/sdk/index.ts that theme-studio uses:
 *   - THEMES_AREA = 'themes'           (src/themes/user-themes.ts:131)
 *   - host.navigate(path)              (sdk/index.ts:665, sets location.hash)
 *   - host.notify({kind, message})     (sdk/index.ts:633 -> store/notifications)
 *   - host.openWorkspace(id, options)  (sdk/index.ts:1146 — registers a
 *     'panes' contribution, placement 'main', dock center, and IMPERATIVELY
 *     calls revealTreePane so the surface fronts in any workspace mode,
 *     incl. Bot Mode)
 * Everything else is absent on purpose — the plugin must not silently depend
 * on unverified exports. PARTIAL INTEGRATION: this stub, not the live client.
 */
export const THEMES_AREA = 'themes'

window.__navigateTargets = window.__navigateTargets || []
window.__openWorkspaceCalls = []

export const host = {
  navigate: (path) => { window.__navigateTargets.push(path); window.location.hash = path },
  notify: ({ kind, message }) => {
    window.__notifyCalls = window.__notifyCalls || []
    window.__notifyCalls.push({ kind, message })
  },
  // Mirrors the real contract: options.render is required, returns a disposer.
  openWorkspace: (id, options) => {
    if (!id || typeof options?.render !== 'function') {
      throw new Error('openWorkspace: an id and a render function are required')
    }
    window.__openWorkspaceCalls.push({ id, title: options.title, hasRender: true })
    return () => {}
  }
}

export default { host, THEMES_AREA }
