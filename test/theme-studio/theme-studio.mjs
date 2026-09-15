/**
 * theme-studio browser tests — REAL React 19 mount in real Chromium.
 *
 * PARTIAL INTEGRATION notice: the SDK (@hermes/plugin-sdk) is replaced by a
 * stub (sdk-stub.mjs) that mirrors ONLY the export surface verified against
 * the live Mac client source (apps/desktop/src/sdk/index.ts:
 * THEMES_AREA='themes', host.navigate, host.notify). The route render +
 * action wiring is exercised under the app's own React version; the live
 * desktop client itself is NOT driven here.
 *
 * Verifies:
 *  1. Module loads as ESM (import map resolves @hermes/plugin-sdk, react,
 *     react/jsx-runtime); default export { id: 'theme-studio', name }
 *  2. register() contributes exactly: theme (themes), page (routes), nav
 *     (sidebar.nav), command (palette)
 *  3. Registered theme passes the isValidTheme contract from
 *     apps/desktop/src/themes/types.ts (name/label/colors strings +
 *     darkColors object)
 *  4. Registering does NOT paint: no data-hermes-theme attr, no theme CSS
 *     vars on documentElement (no auto-activation — user must opt in)
 *  5. Palette command run() navigates to /theme-studio via host.navigate
 *  6. REAL react-dom mount of the registered route's render()
 *  7. "Generate light + dark" action: persists {light,dark} via ctx.storage,
 *     re-registers the themes contribution with a changed primary, notifies
 *  8. Color-picker (change) path applies a single token edit and re-registers
 *  9. Multi-color generation: 3 seeds (+ optional 4th highlight) each
 *     materially influence BOTH light and dark palettes (never just the
 *     first color, no averaging), WCAG 4.5:1 contrast preserved on primary,
 *     seeds persist under their OWN storage key, theme palettes are NOT
 *     replaced until Generate is clicked, and garbage seed storage recovers
 *     to single mode without throwing.
 *
 * Usage: npm test  (or CHROMIUM_PATH=... node theme-studio.mjs [plugin.js] [out.json])
 */

import { chromium } from 'playwright-core'
import { readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'

const pluginPath = process.argv[2] || new URL('../../plugins/theme-studio/plugin.js', import.meta.url)
const outPath = process.env.TEST_OUT || ''
const source = readFileSync(pluginPath, 'utf8')
const read = p => readFileSync(new URL(p, import.meta.url))

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  headless: true
})
const page = await browser.newPage()
const errors = []
page.on('pageerror', e => errors.push('pageerror: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()) })

const srv = createServer((req, res) => {
  const p = new URL(req.url, 'http://x').pathname
  let body, ct = 'text/javascript'
  if (p === '/sdk-stub.mjs') body = read('./sdk-stub.mjs')
  else if (p === '/shims/react.esm.js') body = read('./shims/react.esm.js')
  else if (p === '/shims/jsx-runtime.esm.js') body = read('./shims/jsx-runtime.esm.js')
  else if (p === '/shims/react-dom-client.esm.js') body = read('./shims/react-dom-client.esm.js')
  else if (p === '/index.html' || p === '/') { body = read('./index.html'); ct = 'text/html' }
  else if (p === '/plugin.js') body = source
  else { res.writeHead(404); res.end('nope ' + p); return }
  res.writeHead(200, { 'content-type': ct }); res.end(body)
})
await new Promise(r => srv.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${srv.address().port}`
await page.goto(base + '/')
await page.waitForFunction(() => window.__warmupDone === true, null, { timeout: 10000 })

const results = {}

// 1+2+3+4: import, register with a recording ctx, inspect contributions.
results.register = await page.evaluate(async () => {
  const m = await import('/plugin.js')
  const d = m.default
  const regs = []
  const storage = new Map()
  const ctx = {
    register: c => regs.push(c),
    storage: { get: k => (storage.has(k) ? storage.get(k) : null), set: (k, v) => storage.set(k, v) }
  }
  d.register(ctx)
  const theme = regs.find(r => r.area === 'themes')?.data
  const route = regs.find(r => r.area === 'routes')
  const nav = regs.find(r => r.area === 'sidebar.nav')
  const cmd = regs.find(r => r.area === 'palette')
  // isValidTheme contract (apps/desktop/src/themes/types.ts)
  const themeValid = !!theme &&
    typeof theme.name === 'string' && typeof theme.label === 'string' &&
    typeof theme.colors?.background === 'string' &&
    typeof theme.colors?.foreground === 'string' &&
    typeof theme.colors?.primary === 'string' &&
    theme.darkColors && typeof theme.darkColors === 'object'
  return {
    id: d.id,
    name: d.name,
    areas: regs.map(r => r.area),
    themeName: theme?.name,
    themeValid,
    colorTokenCount: Object.keys(theme?.colors || {}).length,
    routePath: route?.data?.path,
    routeRenderIsFn: typeof route?.render === 'function',
    navPath: nav?.data?.path,
    cmdLabel: cmd?.data?.label,
    cmdHasRun: typeof cmd?.data?.run === 'function',
    // auto-activation check: the app's applyTheme sets these on activation
    hermesThemeAttr: document.documentElement.getAttribute('data-hermes-theme'),
    rootInlineStyle: (document.documentElement.getAttribute('style') || '').trim()
  }
})

// 5: palette command wiring. RED for the Bot Mode bug: the command must open
// the studio as a main-area workspace pane via host.openWorkspace (imperative
// revealTreePane — fronts the tab in Bot Mode), not merely set location.hash
// (which leaves the page behind the focused pane's active tab). When the
// running host lacks openWorkspace it falls back to host.navigate.
results.commandRun = await page.evaluate(async () => {
  const m = await import('/plugin.js')
  const regs = []
  const storage = new Map()
  const ctx = {
    register: c => regs.push(c),
    storage: { get: k => (storage.has(k) ? storage.get(k) : null), set: (k, v) => storage.set(k, v) }
  }
  m.default.register(ctx)
  const cmd = regs.find(r => r.area === 'palette')
  window.__openWorkspaceCalls = []
  window.__navigateTargets = []
  cmd.data.run()
  return {
    openWorkspaceCalls: window.__openWorkspaceCalls,
    navigateTargets: window.__navigateTargets,
    finalHash: window.location.hash
  }
})

// 5b: fallback — with host.openWorkspace absent (older desktop), run() must
// still navigate to /theme-studio instead of throwing. The stub's `host` is a
// mutable object shared with the plugin's import, so deleting the property
// simulates an older host; restore right after.
results.commandRunFallback = await page.evaluate(async () => {
  const sdk = await import('/sdk-stub.mjs')
  const m = await import('/plugin.js')
  const regs = []
  const storage = new Map()
  const ctx = {
    register: c => regs.push(c),
    storage: { get: k => (storage.has(k) ? storage.get(k) : null), set: (k, v) => storage.set(k, v) }
  }
  m.default.register(ctx)
  const cmd = regs.find(r => r.area === 'palette')
  const saved = sdk.host.openWorkspace
  delete sdk.host.openWorkspace
  window.__openWorkspaceCalls = []
  window.__navigateTargets = []
  let threw = null
  try { cmd.data.run() } catch (e) { threw = String(e) }
  sdk.host.openWorkspace = saved
  return {
    threw,
    navigateTargets: window.__navigateTargets,
    finalHash: window.location.hash
  }
})

// 6+7+8: REAL React mount; drive the Generate action and a color edit.
results.mount = await page.evaluate(async () => {
  const React = await import('/shims/react.esm.js')
  const { createRoot } = await import('/shims/react-dom-client.esm.js')
  const m = await import('/plugin.js')
  const regs = []
  const storage = new Map()
  let registerCalls = 0
  let lastThemeData = null
  const notifyCalls = []
  const ctx = {
    register: c => { regs.push(c); if (c.area === 'themes') { registerCalls++; lastThemeData = c.data } },
    storage: { get: k => (storage.has(k) ? storage.get(k) : null), set: (k, v) => storage.set(k, v) }
  }
  m.default.register(ctx)
  const route = regs.find(r => r.area === 'routes')
  const host = document.getElementById('root')
  const root = createRoot(host)
  let mountErr = null
  try {
    root.render(React.createElement(route.render))
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  } catch (e) { mountErr = String(e) }
  const buttons = [...host.querySelectorAll('button')]
  const genBtn = buttons.find(b => /Generate light \+ dark/.test(b.textContent || ''))
  const beforePrimary = lastThemeData?.darkColors?.primary
  // change the base color, then click Generate
  const colorInput = host.querySelector('input[type="color"]')
  if (colorInput) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(colorInput, '#2244ff')
    colorInput.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise(r => setTimeout(r, 30))
  }
  if (genBtn) { genBtn.click(); await new Promise(r => setTimeout(r, 60)) }
  const afterGeneratePrimary = lastThemeData?.darkColors?.primary
  const stored = storage.get('theme-studio-palette-v2')
  // drive a single-token color edit in the token grid (first picker after mode row)
  const gridInputs = [...host.querySelectorAll('label input[type="color"]')]
  const beforeGrid = lastThemeData?.darkColors?.background
  if (gridInputs[0]) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(gridInputs[0], '#123456')
    gridInputs[0].dispatchEvent(new Event('input', { bubbles: true }))
    gridInputs[0].dispatchEvent(new Event('change', { bubbles: true }))
    await new Promise(r => setTimeout(r, 60))
  }
  return {
    mountErr,
    rootChildren: host.children.length,
    textSample: (host.textContent || '').slice(0, 90),
    colorInputs: host.querySelectorAll('input[type="color"]').length,
    foundGenerateBtn: !!genBtn,
    registerCallsAfterGenerate: registerCalls,
    primaryBefore: beforePrimary,
    primaryAfterGenerate: afterGeneratePrimary,
    storedHasLightAndDark: !!stored?.light && !!stored?.dark,
    storedPrimary: stored?.dark?.primary || null,
    backgroundAfterEdit: lastThemeData?.darkColors?.background,
    notifyKinds: (window.__notifyCalls || []).map(n => n.kind)
  }
})

// 9: multi-color generation — real DOM controls, real Generate click.
results.multiColor = await page.evaluate(async () => {
  const React = await import('/shims/react.esm.js')
  const { createRoot } = await import('/shims/react-dom-client.esm.js')
  const m = await import('/plugin.js')
  const regs = []
  const storage = new Map()
  let lastThemeData = null
  const ctx = {
    register: c => { regs.push(c); if (c.area === 'themes') lastThemeData = c.data },
    storage: { get: k => (storage.has(k) ? storage.get(k) : null), set: (k, v) => storage.set(k, v) }
  }
  m.default.register(ctx)
  const route = regs.find(r => r.area === 'routes')
  const host = document.getElementById('root')
  host.textContent = ''
  const root = createRoot(host)
  root.render(React.createElement(route.render))
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))

  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  const setInput = (el, v) => {
    nativeSetter.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const setSelect = (el, v) => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, v)
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const clickGenerate = async () => {
    const b = [...host.querySelectorAll('button')].find(x => /Generate light \+ dark/.test(x.textContent || ''))
    b.click()
    await new Promise(r => setTimeout(r, 60))
  }
  const seedInput = role => host.querySelector(`input[data-seed-role="${role}"]`)
  const snap = () => ({
    dark: { ...lastThemeData.darkColors },
    light: { ...lastThemeData.colors }
  })

  const lum = h => {
    const c = String(h).replace('#', '')
    const v = [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16) / 255)
      .map(u => (u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4)))
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]
  }
  const cr = (a, b) => {
    const x = lum(a); const y = lum(b)
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
  }

  const modeSel = host.querySelector('select[data-role="gen-mode"]')
  if (!modeSel) return { hasModeSelect: false }

  // 4-color mode, distinct seeds, Generate.
  setSelect(modeSel, 'multi4')
  await new Promise(r => setTimeout(r, 30))
  const visibleRoles = [...host.querySelectorAll('input[data-seed-role]')].map(i => i.dataset.seedRole)
  setInput(seedInput('base'), '#2244ff')
  setInput(seedInput('primary'), '#ffaa00')
  setInput(seedInput('secondary'), '#00aa66')
  setInput(seedInput('highlight'), '#cc44aa')
  // Theme palettes must NOT change before Generate is clicked.
  const beforeGenerate = snap()
  await clickGenerate()
  const four = snap()

  // 3-color mode (same first three seeds, no highlight) — accent must
  // differ from the 4-color run in BOTH modes (4th seed is material).
  setSelect(modeSel, 'multi3')
  await new Promise(r => setTimeout(r, 30))
  await clickGenerate()
  const three = snap()

  // Swap ONLY the primary seed → primary changes both modes, accent doesn't.
  setInput(seedInput('primary'), '#ffee00')
  await clickGenerate()
  const swapPrimary = snap()

  // Swap ONLY the secondary seed → secondary changes both modes.
  setInput(seedInput('primary'), '#ffaa00')
  setInput(seedInput('secondary'), '#aa3311')
  await clickGenerate()
  const swapSecondary = snap()

  // "Not just the first color": single-color generate from the same base.
  setSelect(modeSel, 'single')
  await new Promise(r => setTimeout(r, 30))
  const singleInput = host.querySelector('input[type="color"]')
  setInput(singleInput, '#2244ff')
  await clickGenerate()
  const singleOnly = snap()

  // Seed edit WITHOUT Generate: stored theme palettes unchanged.
  setSelect(modeSel, 'multi4')
  await new Promise(r => setTimeout(r, 30))
  const storedBeforeIdleEdit = JSON.stringify(storage.get('theme-studio-palette-v2'))
  setInput(seedInput('highlight'), '#112233')
  const themeAfterIdleEdit = JSON.stringify(lastThemeData)
  const idleEditKeptTheme = themeAfterIdleEdit === JSON.stringify(lastThemeData) &&
    JSON.stringify(storage.get('theme-studio-palette-v2')) === storedBeforeIdleEdit

  const r = {
    hasModeSelect: true,
    visibleRoles,
    generateChangedTheme: JSON.stringify(beforeGenerate) !== JSON.stringify(four),
    // Fidelity: the picked primary is the EXACT fill in BOTH modes —
    // contrast lives on its companions (ink on the fill, brand stroke),
    // never on the fill itself.
    primaryExactBothModes: four.dark.primary === '#FFAA00' && four.light.primary === '#FFAA00',
    primaryInkContrast: {
      dark: Math.round(cr(four.dark.primaryForeground, four.dark.primary) * 100) / 100,
      light: Math.round(cr(four.light.primaryForeground, four.light.primary) * 100) / 100
    },
    midgroundVisible: {
      dark: Math.round(cr(four.dark.midground, four.dark.background) * 100) / 100,
      light: Math.round(cr(four.light.midground, four.light.background) * 100) / 100
    },
    accentTextContrast: {
      dark: Math.round(cr(four.dark.accentForeground, four.dark.accent) * 100) / 100,
      light: Math.round(cr(four.light.accentForeground, four.light.accent) * 100) / 100
    },
    highlightIsMaterial: three.dark.accent !== four.dark.accent && three.light.accent !== four.light.accent,
    primarySeedIsMaterial: swapPrimary.dark.primary !== four.dark.primary && swapPrimary.light.primary !== four.light.primary,
    primarySeedNotAverageNorIgnored: swapPrimary.dark.primary !== singleOnly.dark.primary,
    secondarySeedIsMaterial: swapSecondary.dark.secondary !== four.dark.secondary && swapSecondary.light.secondary !== four.light.secondary,
    idleEditKeptTheme,
    seedsStoredSeparately: (() => {
      const s = storage.get('theme-studio-seeds-v1')
      return !!s && typeof s === 'object' && s.mode === 'multi4' && !!s.seeds &&
        s.seeds.highlight === '#112233' && !storage.get('theme-studio-palette-v2').seeds
    })()
  }
  // Contrast is asserted on the ROLE-SPECIFIC pairings: ink ON the primary
  // fill (4.5), brand stroke vs the background it is drawn on (3), and
  // text on the soft-accent surface (4.5). The fill-vs-background ratio of
  // the primary is deliberately NOT asserted — a pastel fill is supposed
  // to sit gently on the page with its own ink carrying the text.
  r.contrastOk = r.primaryExactBothModes &&
    r.primaryInkContrast.dark >= 4.5 && r.primaryInkContrast.light >= 4.5 &&
    r.midgroundVisible.dark >= 3 && r.midgroundVisible.light >= 3 &&
    r.accentTextContrast.dark >= 4.5 && r.accentTextContrast.light >= 4.5
  return r
}) // then a fresh ctx: garbage seeds must recover to single mode without throwing
results.seedRecovery = await page.evaluate(async () => {
  const React = await import('/shims/react.esm.js')
  const { createRoot } = await import('/shims/react-dom-client.esm.js')
  const m = await import('/plugin.js')
  const regs = []
  const storage = new Map()
  storage.set('theme-studio-seeds-v1', { mode: 'bogus-mode', seeds: { base: 'not-a-color', primary: '#00ff88', secondary: 42, highlight: null } })
  let lastThemeData = null
  const ctx = {
    register: c => { regs.push(c); if (c.area === 'themes') lastThemeData = c.data },
    storage: { get: k => (storage.has(k) ? storage.get(k) : null), set: (k, v) => storage.set(k, v) }
  }
  m.default.register(ctx)
  const route = regs.find(r => r.area === 'routes')
  const host = document.getElementById('root')
  host.textContent = ''
  const root = createRoot(host)
  let mountErr = null
  try { root.render(React.createElement(route.render)) } catch (e) { mountErr = String(e) }
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  return {
    mountErr,
    hasModeSelect: !!host.querySelector('select[data-role="gen-mode"]'),
    singleIsDefaultValue: host.querySelector('select[data-role="gen-mode"]')?.value === 'single',
    badSeedDropped: !host.querySelector('input[data-seed-role="base"]') ||
      host.querySelector('input[data-seed-role="base"]').value !== 'not-a-color',
    themeStillValid: lastThemeData?.darkColors?.background?.startsWith('#')
  }
})

// 10: multi-color FIDELITY — the user's exact palette (base #9B68C5,
// primary #EFA3B6, secondary #4044BF) must survive generation:
//  A. exact palette fidelity: the primary and secondary are used EXACTLY
//     as fills in BOTH modes (no contrast clamp on fills); contrast is
//     asserted on the role-specific companions instead: ink ON the fill
//     (4.5), brand stroke vs its background (3), stroke on the selected
//     row (3), text on the secondary/soft-accent surfaces (4.5).
//  B. three-color soft-accent dependence: with no highlight seed the
//     soft accent derives from the FINAL multi primary (swapping only the
//     primary seed changes the accent; the old code never recomputed it).
//  C. visibly tinted surfaces: multi-mode dark surfaces carry more of the
//     base seed than the single-mode recipe, BOTH modes show measurable
//     saturation (lavender/deep purple, not near-white/near-black), and
//     text on every text-bearing surface keeps 4.5:1.
//  D. blue spread: the secondary seed moves at least 4 blue-family tokens
//     (secondary, userBubble, userBubbleBorder, ring, composerRing,
//     border, sidebarBorder) per mode — never a single-use color.
results.fidelity = await page.evaluate(async () => {
  const React = await import('/shims/react.esm.js')
  const { createRoot } = await import('/shims/react-dom-client.esm.js')
  const m = await import('/plugin.js')
  const regs = []
  const storage = new Map()
  let lastThemeData = null
  const ctx = {
    register: c => { regs.push(c); if (c.area === 'themes') lastThemeData = c.data },
    storage: { get: k => (storage.has(k) ? storage.get(k) : null), set: (k, v) => storage.set(k, v) }
  }
  m.default.register(ctx)
  const route = regs.find(r => r.area === 'routes')
  const host = document.getElementById('root')
  host.textContent = ''
  const root = createRoot(host)
  root.render(React.createElement(route.render))
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))

  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  const setInput = (el, v) => {
    nativeSetter.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const setSelect = (el, v) => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, v)
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const generate = async () => {
    const b = [...host.querySelectorAll('button')].find(x => /Generate light \+ dark/.test(x.textContent || ''))
    b.click()
    await new Promise(r => setTimeout(r, 60))
  }
  const seedInput = role => host.querySelector(`input[data-seed-role="${role}"]`)
  const snap = () => ({ dark: { ...lastThemeData.darkColors }, light: { ...lastThemeData.colors } })
  const modeSel = host.querySelector('select[data-role="gen-mode"]')

  const lum = h => {
    const c = String(h).replace('#', '')
    const v = [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16) / 255)
      .map(u => (u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4)))
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]
  }
  const cr = (a, b) => {
    const x = lum(a); const y = lum(b)
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
  }
  const hsl = h => {
    const c = String(h).replace('#', '')
    const [r, g, b] = [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16) / 255)
    const max = Math.max(r, g, b); const min = Math.min(r, g, b)
    const l = (max + min) / 2
    if (max === min) return [0, 0, l]
    const d = max - min
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    let hh
    if (max === r) hh = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) hh = ((b - r) / d + 2) / 6
    else hh = ((r - g) / d + 4) / 6
    return [hh, s, l]
  }

  // A: the user's exact palette, 3-color mode. Fills stay EXACT; the old
  // assertion (fill clears 4.5:1 vs the background) encoded the design bug
  // where the pastel primary was force-darkened into a raspberry — it is
  // deliberately replaced by companion-pairing assertions.
  setSelect(modeSel, 'multi3')
  await new Promise(r => setTimeout(r, 30))
  setInput(seedInput('base'), '#9B68C5')
  setInput(seedInput('primary'), '#EFA3B6')
  setInput(seedInput('secondary'), '#4044BF')
  await generate()
  const user = snap()
  const [bh, bs, bl] = hsl(user.dark.background)
  const [lh0, ls0, ll0] = hsl(user.light.background)
  const a = {
    darkPrimaryExact: user.dark.primary === '#EFA3B6',
    lightPrimaryExact: user.light.primary === '#EFA3B6',
    darkSecondaryExact: user.dark.secondary === '#4044BF',
    lightSecondaryExact: user.light.secondary === '#4044BF',
    primaryInkContrast: {
      dark: Math.round(cr(user.dark.primaryForeground, user.dark.primary) * 100) / 100,
      light: Math.round(cr(user.light.primaryForeground, user.light.primary) * 100) / 100
    },
    midgroundVisible: {
      dark: Math.round(cr(user.dark.midground, user.dark.background) * 100) / 100,
      light: Math.round(cr(user.light.midground, user.light.background) * 100) / 100
    },
    strokeOnSelectedRow: {
      dark: Math.round(cr(user.dark.midground, user.dark.accent) * 100) / 100,
      light: Math.round(cr(user.light.midground, user.light.accent) * 100) / 100
    },
    accentTextContrast: {
      dark: Math.round(cr(user.dark.accentForeground, user.dark.accent) * 100) / 100,
      light: Math.round(cr(user.light.accentForeground, user.light.accent) * 100) / 100
    },
    secondaryTextContrast: {
      dark: Math.round(cr(user.dark.secondaryForeground, user.dark.secondary) * 100) / 100,
      light: Math.round(cr(user.light.secondaryForeground, user.light.secondary) * 100) / 100
    }
  }
  a.exactFidelityOk = a.darkPrimaryExact && a.lightPrimaryExact &&
    a.darkSecondaryExact && a.lightSecondaryExact &&
    a.primaryInkContrast.dark >= 4.5 && a.primaryInkContrast.light >= 4.5 &&
    a.midgroundVisible.dark >= 3 && a.midgroundVisible.light >= 3 &&
    a.strokeOnSelectedRow.dark >= 3 && a.strokeOnSelectedRow.light >= 3 &&
    a.accentTextContrast.dark >= 4.5 && a.accentTextContrast.light >= 4.5 &&
    a.secondaryTextContrast.dark >= 4.5 && a.secondaryTextContrast.light >= 4.5

  // B: three-color soft accent derives from the FINAL multi primary —
  // swapping ONLY the primary seed must move the accent in both modes,
  // and the multi3 accent must differ from the single-recipe accent.
  setInput(seedInput('primary'), '#FFEE00')
  await generate()
  const swapPrimary = snap()
  setInput(seedInput('primary'), '#EFA3B6')
  await generate()
  const again = snap()
  setSelect(modeSel, 'single')
  await new Promise(r => setTimeout(r, 30))
  setInput(host.querySelector('input[type="color"]'), '#9B68C5')
  await generate()
  const single = snap()
  const b = {
    accentFollowsPrimarySeedDark: swapPrimary.dark.accent !== user.dark.accent,
    accentFollowsPrimarySeedLight: swapPrimary.light.accent !== user.light.accent,
    accentStableOnPrimaryUnchanged: again.dark.accent === user.dark.accent && again.light.accent === user.light.accent,
    multiAccentDiffersFromSingle: user.dark.accent !== single.dark.accent || user.light.accent !== single.light.accent
  }
  b.softAccentOk = b.accentFollowsPrimarySeedDark && b.accentFollowsPrimarySeedLight &&
    b.accentStableOnPrimaryUnchanged && b.multiAccentDiffersFromSingle

  // C: multi-mode dark surfaces carry more of the base seed than the
  // single-mode recipe, BOTH modes show a visible tint (measurable HSL
  // saturation — light lavender, dark deep purple, not near-white/near-
  // black), and text keeps 4.5:1 on its own surface (background AND card).
  const [sh2, ss2, sl2] = hsl(single.dark.background)
  const c = {
    multiDarkBgMoreSaturated: bs > ss2 + 0.02,
    multiDarkBgLadderRaised: bl > sl2,
    darkBgVisiblyTinted: bs >= 0.12 && bl >= 0.1 && bl <= 0.2,
    lightBgVisiblyTinted: ls0 >= 0.12 && ll0 <= 0.96,
    darkTextContrast: Math.round(cr(user.dark.foreground, user.dark.background) * 100) / 100,
    lightTextContrast: Math.round(cr(user.light.foreground, user.light.background) * 100) / 100,
    darkCardTextContrast: Math.round(cr(user.dark.cardForeground, user.dark.card) * 100) / 100,
    lightCardTextContrast: Math.round(cr(user.light.cardForeground, user.light.card) * 100) / 100
  }
  c.surfacesOk = c.multiDarkBgMoreSaturated && c.multiDarkBgLadderRaised &&
    c.darkBgVisiblyTinted && c.lightBgVisiblyTinted &&
    c.darkTextContrast >= 4.5 && c.lightTextContrast >= 4.5 &&
    c.darkCardTextContrast >= 4.5 && c.lightCardTextContrast >= 4.5

  // D: blue spread — swapping ONLY the secondary seed moves at least 4 of
  // the blue-family tokens per mode; the exact blue fill is already
  // asserted in A.
  setSelect(modeSel, 'multi3')
  await new Promise(r => setTimeout(r, 30))
  setInput(seedInput('secondary'), '#1B7F4B')
  await generate()
  const swapSecondary = snap()
  const blueTokens = ['secondary', 'userBubble', 'userBubbleBorder', 'ring', 'composerRing', 'border', 'sidebarBorder']
  const d = {
    movedDark: blueTokens.filter(k => swapSecondary.dark[k] !== user.dark[k]).length,
    movedLight: blueTokens.filter(k => swapSecondary.light[k] !== user.light[k]).length
  }
  d.blueFamiliesOk = d.movedDark >= 4 && d.movedLight >= 4

  return { palette: user, singleComparison: single, exact: a, softAccent: b, surfaces: c, blueSpread: d,
    fidelityOk: a.exactFidelityOk && b.softAccentOk && c.surfacesOk && d.blueFamiliesOk }
})

// 11: CONTRAST SLIDER — multi-color generation only. The slider (0–100,
// Soft–Balanced–Crisp, default 50) is scoped to 3/4-color seed generation:
await page.evaluate(b => { window.__contrastBaseline = b }, JSON.parse(readFileSync(new URL('./contrast-baseline.json', import.meta.url), 'utf8')))

//  A. UI + persistence: slider exists in multi mode at default 50; dragging
//     it NEVER mutates the theme palettes or re-registers (contrast applies
//     only on Generate) but IS persisted alongside the seeds under the seeds
//     storage key; Reset returns to 50. In single mode there is no inert
//     slider — the scope is labeled instead. A stored contrast value is
//     restored on mount; corrupt values recover to 0.5.
//  B. default preservation: Generate at the default (50) reproduces the
//     pre-slider palettes EXACTLY (contrast-baseline.json, captured from the
//     pre-slider implementation for the user's palette).
//  C. material effect + floors: contrast 15 vs 85 materially changes the
//     generated palettes in BOTH modes (surface separation and text
//     lightness move); neither extreme flattens surfaces (dark bg stays
//     inside 0.06–0.24 HSL lightness and visibly tinted, light bg inside
//     0.85–0.97) and text keeps the readable floor (foreground AND muted
//     text ≥4.5:1 on their background at both extremes).
results.contrast = await page.evaluate(async () => {
  const React = await import('/shims/react.esm.js')
  const { createRoot } = await import('/shims/react-dom-client.esm.js')
  const m = await import('/plugin.js')
  const regs = []
  const storage = new Map()
  let lastThemeData = null
  let registerCalls = 0
  const ctx = {
    register: c => { regs.push(c); if (c.area === 'themes') { registerCalls++; lastThemeData = c.data } },
    storage: { get: k => (storage.has(k) ? storage.get(k) : null), set: (k, v) => storage.set(k, v) }
  }
  m.default.register(ctx)
  const route = regs.find(r => r.area === 'routes')
  const host = document.getElementById('root')
  host.textContent = ''
  const root = createRoot(host)
  root.render(React.createElement(route.render))
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))

  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  const setInput = (el, v) => {
    nativeSetter.call(el, String(v))
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const setSelect = (el, v) => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, v)
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const clickGenerate = async () => {
    const b = [...host.querySelectorAll('button')].find(x => /Generate light \+ dark/.test(x.textContent || ''))
    b.click()
    await new Promise(r => setTimeout(r, 60))
  }
  const seedInput = role => host.querySelector(`input[data-seed-role="${role}"]`)
  const snap = () => JSON.stringify({ dark: lastThemeData.darkColors, light: lastThemeData.colors })
  const lum = h => {
    const c = String(h).replace('#', '')
    const v = [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16) / 255)
      .map(u => (u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4)))
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]
  }
  const cr = (a, b) => {
    const x = lum(a); const y = lum(b)
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
  }
  const hslL = h => {
    const c = String(h).replace('#', '')
    const [r, g, b] = [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16) / 255)
    return (Math.max(r, g, b) + Math.min(r, g, b)) / 2
  }
  const hslS = h => {
    const c = String(h).replace('#', '')
    const [r, g, b] = [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16) / 255)
    const max = Math.max(r, g, b); const min = Math.min(r, g, b)
    const l = (max + min) / 2
    if (max === min) return 0
    return l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min)
  }
  const rangeSel = 'input[type="range"][data-role="contrast"]'

  // A1: slider present in multi mode at default 50, with a value label.
  setSelect(host.querySelector('select[data-role="gen-mode"]'), 'multi3')
  await new Promise(r => setTimeout(r, 30))
  const slider = host.querySelector(rangeSel)
  const sliderDefault = slider ? Number(slider.value) : null
  const valueLabel = host.querySelector('[data-role="contrast-value"]')?.textContent || ''

  // Drag to 85: theme palettes and re-registration must NOT change; the
  // value IS persisted alongside the seeds.
  const themeBeforeDrag = snap()
  const storedThemeBeforeDrag = JSON.stringify(storage.get('theme-studio-palette-v2'))
  const registersBeforeDrag = registerCalls
  if (slider) setInput(slider, 85)
  await new Promise(r => setTimeout(r, 30))
  const storedSeedsAfterDrag = storage.get('theme-studio-seeds-v1')
  const dragMutatedTheme = snap() !== themeBeforeDrag ||
    JSON.stringify(storage.get('theme-studio-palette-v2')) !== storedThemeBeforeDrag
  const dragReRegistered = registerCalls !== registersBeforeDrag
  const dragPersisted = storedSeedsAfterDrag?.contrast === 0.85 &&
    storedSeedsAfterDrag?.mode === 'multi3' &&
    !storage.get('theme-studio-palette-v2')?.seeds

  // Reset button returns the slider to the default.
  const resetBtn = [...host.querySelectorAll('button')].find(b => /reset/i.test(b.textContent || '') && (b.dataset.role || '').startsWith('contrast'))
  if (resetBtn) { resetBtn.click(); await new Promise(r => setTimeout(r, 30)) }
  const afterReset = host.querySelector(rangeSel) ? Number(host.querySelector(rangeSel).value) : null

  // B: Generate at the default reproduces the pre-slider output EXACTLY.
  setInput(seedInput('base'), '#9B68C5')
  setInput(seedInput('primary'), '#EFA3B6')
  setInput(seedInput('secondary'), '#4044BF')
  await clickGenerate()
  const defaultOut = { light: lastThemeData.colors, dark: lastThemeData.darkColors }

  // C: contrast 15 vs 85 — material change in BOTH modes, no flattening,
  // readable-text floor holds at both extremes.
  const gen = async (v) => {
    const el = host.querySelector(rangeSel)
    if (el) setInput(el, v)
    await new Promise(r => setTimeout(r, 20))
    await clickGenerate()
    return { light: { ...lastThemeData.colors }, dark: { ...lastThemeData.darkColors } }
  }
  const soft = await gen(15)
  const crisp = await gen(85)
  const sep = p => Math.abs(hslL(p.dark.card) - hslL(p.dark.background))
  const floors = p => ({
    darkFg: Math.round(cr(p.dark.foreground, p.dark.background) * 100) / 100,
    lightFg: Math.round(cr(p.light.foreground, p.light.background) * 100) / 100,
    darkMuted: Math.round(cr(p.dark.mutedForeground, p.dark.background) * 100) / 100,
    lightMuted: Math.round(cr(p.light.mutedForeground, p.light.background) * 100) / 100
  })
  const within = (v, lo, hi) => v >= lo && v <= hi
  const extremesOk = [soft, crisp].every(p =>
    within(hslL(p.dark.background), 0.06, 0.24) && hslS(p.dark.background) >= 0.12 &&
    within(hslL(p.light.background), 0.85, 0.97) && hslS(p.light.background) >= 0.12 &&
    hslL(p.dark.background) > 0.02 && hslL(p.dark.background) < 0.4 &&
    hslL(p.light.background) > 0.7 && hslL(p.light.background) < 0.99)
  const softFloors = floors(soft)
  const crispFloors = floors(crisp)
  const floorsOk = [softFloors, crispFloors].every(f =>
    f.darkFg >= 4.5 && f.lightFg >= 4.5 && f.darkMuted >= 4.5 && f.lightMuted >= 4.5)
  const materialChangeDarkSep = sep(crisp) > sep(soft) + 0.005
  // Key-by-key deep compare (JSON.stringify would be sensitive to the
  // different key ORDER between buildTheme's TOKENS mapping and the
  // generator's return literal).
  const paletteEq = (a, b) => Object.keys(b).every(k => a[k] === b[k]) && Object.keys(a).length >= Object.keys(b).length
  const defaultMatchesBaseline =
    paletteEq(defaultOut.light, window.__contrastBaseline.light) &&
    paletteEq(defaultOut.dark, window.__contrastBaseline.dark)

  // A2: single mode — no inert slider; the scope is labeled instead.
  setSelect(host.querySelector('select[data-role="gen-mode"]'), 'single')
  await new Promise(r => setTimeout(r, 30))
  const singleHasSlider = !!host.querySelector(rangeSel)
  const singleScopeNote = !!(host.querySelector('[data-role="contrast-scope"]') || '')

  // A3: persistence + recovery — stored contrast restores on mount; garbage
  // recovers to 0.5. Checked in separate top-level evaluates below.

  const materialChange = {
    darkSepSoft: Math.round(sep(soft) * 1000) / 1000,
    darkSepCrisp: Math.round(sep(crisp) * 1000) / 1000,
    fgMovedDark: soft.dark.foreground !== crisp.dark.foreground,
    fgMovedLight: soft.light.foreground !== crisp.light.foreground,
    bgMovedDark: soft.dark.background !== crisp.dark.background,
    bgMovedLight: soft.light.background !== crisp.light.background
  }

  return {
    sliderDefault,
    valueLabelSample: valueLabel,
    dragMutatedTheme,
    dragReRegistered,
    dragPersisted,
    afterReset,
    singleHasSlider,
    singleScopeNote,
    materialChange,
    softFloors,
    crispFloors,
    extremesOk,
    floorsOk,
    defaultMatchesBaseline,
    contrastOk: sliderDefault === 50 && !dragMutatedTheme && !dragReRegistered && dragPersisted &&
      afterReset === 50 && !singleHasSlider && singleScopeNote &&
      materialChangeDarkSep && materialChange.fgMovedDark && materialChange.fgMovedLight &&
      materialChange.bgMovedDark && materialChange.bgMovedLight &&
      extremesOk && floorsOk && defaultMatchesBaseline
  }
})

// A3a: a stored contrast value restores on mount (fresh ctx + storage).
results.contrastPersisted = await page.evaluate(async () => {
  const React = await import('/shims/react.esm.js')
  const { createRoot } = await import('/shims/react-dom-client.esm.js')
  const m = await import('/plugin.js')
  const regs = []
  const storage = new Map()
  storage.set('theme-studio-seeds-v1', { mode: 'multi3', seeds: { base: '#9B68C5', primary: '#EFA3B6', secondary: '#4044BF' }, contrast: 0.8 })
  const ctx = { register: c => regs.push(c), storage: { get: k => (storage.has(k) ? storage.get(k) : null), set: (k, v) => storage.set(k, v) } }
  m.default.register(ctx)
  const route = regs.find(r => r.area === 'routes')
  const host = document.getElementById('root')
  host.textContent = ''
  const root = createRoot(host)
  root.render(React.createElement(route.render))
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  const sel = host.querySelector('select[data-role="gen-mode"]')
  const slider = host.querySelector('input[type="range"][data-role="contrast"]')
  return { modeIsMulti3: sel?.value === 'multi3', sliderValue: slider ? Number(slider.value) : null }
})

// A3b: corrupt stored contrast (non-numeric) recovers to the default 50.
results.contrastRecovery = await page.evaluate(async () => {
  const React = await import('/shims/react.esm.js')
  const { createRoot } = await import('/shims/react-dom-client.esm.js')
  const m = await import('/plugin.js')
  const regs = []
  const storage = new Map()
  storage.set('theme-studio-seeds-v1', { mode: 'multi3', seeds: {}, contrast: 'crisp' })
  const ctx = { register: c => regs.push(c), storage: { get: k => (storage.has(k) ? storage.get(k) : null), set: (k, v) => storage.set(k, v) } }
  m.default.register(ctx)
  const route = regs.find(r => r.area === 'routes')
  const host = document.getElementById('root')
  host.textContent = ''
  const root = createRoot(host)
  root.render(React.createElement(route.render))
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  const slider = host.querySelector('input[type="range"][data-role="contrast"]')
  return slider ? Number(slider.value) : null
})

results.errors = errors
await browser.close()
srv.close()
if (outPath) writeFileSync(outPath, JSON.stringify(results, null, 2))
console.log(JSON.stringify(results, null, 2))
