// Nebula theme + skin: real loader transform, real applyTheme, real styles.css,
// source-derived MOCK DOM (reuses the Retroma fixture, wrapped in the contrib
// shell the skin paints). Not the live Hermes app.
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createServer } from 'node:http'
const require = createRequire(new URL('../theme-studio/package.json', import.meta.url))
const { chromium } = require('playwright-core')
const esbuild = require('esbuild')
const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const src = process.env.HERMES_DESKTOP_SRC
assert(src, 'Set HERMES_DESKTOP_SRC to the desktop src directory')
assert(process.env.CHROMIUM_PATH, 'Set CHROMIUM_PATH to Chromium')
const read = p => readFile(path.join(src, p), 'utf8')
const output = path.join(here, '.local')
await mkdir(output, { recursive: true })
const js = async s => (await esbuild.transform(s, { loader: 'ts', format: 'esm' })).code
const moduleUrl = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
const loader = await read('contrib/runtime-loader.ts')
const loaderPart = loader.slice(loader.indexOf('const importSpecifierRe ='), ['export async function verifyIntegrity', 'export function unloadRuntimePlugin'].map(m => loader.indexOf(m)).find(i => i > 0))
const paletteArea = (await read('app/command-palette/contrib.ts')).match(/PALETTE_AREA = '([^']+)'/)[1]
const sdk = moduleUrl(`export const THEMES_AREA='themes'; export const PALETTE_AREA=${JSON.stringify(paletteArea)}; export const host={notify:n=>globalThis.notifications.push(n)};`)
const transformModule = await import(moduleUrl(await js(`const sdkImportMap=()=>({'@hermes/plugin-sdk':${JSON.stringify(sdk)}});\n${loaderPart}\nexport {unsupportedImports,rewriteSpecifiers}`)))
const sources = await Promise.all(['nebula-theme', 'nebula-skin'].map(n => readFile(path.join(root, 'plugins', n, 'plugin.js'), 'utf8')))
const modules = sources.map(s => { assert.deepEqual(transformModule.unsupportedImports(s), []); return transformModule.rewriteSpecifiers(s) })
const themeModule = await import(moduleUrl(modules[0]))
const { isValidTheme } = await import(moduleUrl(await js(await read('themes/types.ts'))))
assert(isValidTheme(themeModule.theme))
const required = [...(await read('themes/types.ts')).split('export interface DesktopThemeColors {')[1].split('\n}')[0].matchAll(/^  (\w+): string/gm)].map(m => m[1])
for (const colors of [themeModule.theme.colors, themeModule.theme.darkColors]) for (const key of required) assert.match(colors[key], /^#[\da-f]{6}$/i, key)
assert.equal(themeModule.theme.typography, undefined, 'palette plugin must not change fonts')
// User-specified dark roles map exactly; the light palette is unchanged.
const lower = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.toLowerCase()]))
assert.deepEqual(lower(themeModule.theme.darkColors), {
  background: '#050816', foreground: '#f4f1ff', card: '#0b1026', cardForeground: '#f4f1ff', muted: '#1b2252', mutedForeground: '#b8b4d9',
  popover: '#11183a', popoverForeground: '#f4f1ff', primary: '#8d63ff', primaryForeground: '#050816', secondary: '#1b2252', secondaryForeground: '#f4f1ff',
  accent: '#1b2252', accentForeground: '#f4f1ff', border: '#705cff', input: '#705cff', ring: '#8d63ff', midground: '#b35cff', midgroundForeground: '#050816',
  composerRing: '#8d63ff', destructive: '#ff6584', destructiveForeground: '#050816', sidebarBackground: '#151b46', sidebarBorder: '#3e55d9',
  userBubble: '#1b2252', userBubbleBorder: '#705cff'
})
assert.deepEqual(themeModule.theme.colors, {
  background: '#e6e3ff', foreground: '#24215a', card: '#efecff', cardForeground: '#24215a', muted: '#d3cffa', mutedForeground: '#56528f',
  popover: '#f7f5ff', popoverForeground: '#24215a', primary: '#2a6fc0', primaryForeground: '#ffffff', secondary: '#d9d5fb', secondaryForeground: '#24215a',
  accent: '#cfc9ff', accentForeground: '#24215a', border: '#8a86f0', input: '#8a86f0', ring: '#2a6fc0', midground: '#5c55d6', midgroundForeground: '#ffffff',
  composerRing: '#7b74ef', destructive: '#c43d4e', destructiveForeground: '#ffffff', sidebarBackground: '#dbd7ff', sidebarBorder: '#8a86f0',
  userBubble: '#d8d3ff', userBubbleBorder: '#9b96ff'
}, 'light palette preserved')
// Selector anchors the skin depends on, checked against the installed source.
for (const [file, anchors] of [
  ['app/contrib/controller.tsx', ['data-contrib-shell=""']],
  ['components/ui/sidebar.tsx', ['data-slot="sidebar-wrapper"', 'data-sidebar="menu-button"']],
  ['app/chat/sidebar/index.tsx', ['data-tour="sessions-sidebar"', 'bg-(--ui-control-active-background)']],
  ['app/chat/sidebar/chrome.tsx', ['tracking-[0.12em]']],
  ['app/chat/sidebar/session-row.tsx', ["isSelected && 'bg-(--ui-row-active-background)'"]],
  ['app/shell/statusbar-controls.tsx', ['data-slot="statusbar"']],
  ['components/pane-shell/tree/renderer/tree-group.tsx', ['data-panel-header=""', 'data-window-top={topEdge || undefined}']],
  ['components/pane-shell/tree/renderer/pane-body.tsx', ['relative min-h-0 min-w-0 flex-1 overflow-hidden']],
  ['app/chat/composer/index.tsx', ['data-slot="composer-surface"', 'data-slot="composer-root"']],
  ['components/assistant-ui/thread/user-message.tsx', ['composer-human-message', 'data-slot="aui_user-message-root"']],
  ['components/chat/code-card.tsx', ['data-slot="code-card"']],
  ['components/chat/wordmark.tsx', ["'wordmark fit-text"]],
  ['contrib/runtime-loader.ts', ['desktopPluginsRoot']],
  ['../electron/preload.ts', ['readFileDataUrl: filePath', 'desktopPluginsRoot: ()']]
]) for (const anchor of anchors) assert((await read(file)).includes(anchor), `${file}: ${anchor}`)
assert((await read('styles.css')).includes('.wordmark {'))
const context = await read('themes/context.tsx')
const applyPart = context.slice(context.indexOf('function renderedModeFor('), context.indexOf('\n}', context.indexOf('function applyTheme(')) + 2)
const entry = `import { ensureContrast,mix,parseColor } from '@hermes/shared/color';
import {harmonize,readableInk} from ${JSON.stringify(path.join(src, 'themes/color.ts'))};
const DEFAULT_TYPOGRAPHY={fontSans:'sans-serif',fontMono:'monospace'};
const nousTheme={}; const $chatFontFamily={get:()=>null};
const resolveChatFontFamily=(v,f)=>v||f; const setAppearance=()=>{};
const INJECTED_FONT_URLS=new Set();
${applyPart}
window.paint=(theme,mode)=>applyTheme({...theme,name:theme.name+'-'+mode,colors:mode==='dark'?theme.darkColors:theme.colors},mode,'sans-serif');`
const bundle = await esbuild.build({ stdin: { contents: entry, loader: 'ts', resolveDir: src }, bundle: true, write: false, format: 'iife', alias: { '@hermes/shared/color': path.resolve(src, '../../shared/src/color.ts') } })
await writeFile(path.join(output, 'apply.js'), bundle.outputFiles[0].text)
await writeFile(path.join(output, 'native.css'), (await read('styles.css')).replace(/^@import .*;$/gm, ''))
await writeFile(path.join(output, 'theme.js'), modules[0])
await writeFile(path.join(output, 'skin.js'), modules[1])
// Fixture: the Retroma MOCK page, wrapped in the contrib shell, with a wordmark
// and a stubbed hermesDesktop bridge that serves the real asset files.
let fixture = await readFile(path.join(here, '../retroma/fixture.html'), 'utf8')
fixture = fixture.replace('Retroma — MOCK preview', 'Nebula — MOCK preview').replace('MOCK · Retroma', 'MOCK · Nebula')
  .replace('<div class="workspace">', '<div data-contrib-shell="" id="shell"><div data-slot="sidebar-wrapper" style="display:contents"><div class="workspace">')
  .replace('</main></div>\n<div id="palette"', '</main></div></div><footer id="statusbar" data-slot="statusbar" style="height:20px;padding:0 6px;font-size:10px;background:var(--ui-sidebar-surface-background);color:var(--ui-text-tertiary)">Gateway ready · MOCK</footer></div>\n<div id="palette"')
  .replace('<div data-slot="aui_assistant-message-content">', '<div data-slot="aui_intro"><p id="wordmark" class="wordmark" style="font-size:40px">HERMES AGENT</p></div><div data-slot="aui_assistant-message-content">')
  .replace('style[data-retroma-tactile]', 'style[data-nebula-skin]')
  .replace('</style><script src="apply.js">', '.mock-cap{color:var(--theme-primary)}</style><script src="apply.js">')
  .replace(/ data-mock-cap=""/g, ' data-mock-cap=""')
  // Real captions: SidebarPanelLabel (tracking-[0.16em] + 8px .dither glyph) and
  // a SidebarDateDivider (tracking-[0.12em]); nav icons are Codicon <i>s.
  .replace('<div data-slot="sidebar-group-label">PINNED · MOCK</div>', '<div data-slot="sidebar-group-label"><span id="pinned-label" class="flex min-w-0 items-center gap-2 pl-2 text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-(--theme-primary) mock-cap" style="display:flex;align-items:center;gap:8px;padding-left:8px;font-size:0.64rem;font-weight:600;text-transform:uppercase;letter-spacing:0.16em" data-mock-cap=""><span id="pinned-glyph" aria-hidden="true" class="dither inline-block size-2 shrink-0 rounded-[1px]" style="display:inline-block;width:8px;height:8px;flex-shrink:0"></span><span>PINNED · MOCK</span></span></div>')
  .replace('<div data-slot="sidebar-group-label">SESSIONS · MOCK</div>', '<div data-slot="sidebar-group-label"><span class="flex min-w-0 items-center gap-2 pl-2 text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-(--theme-primary) mock-cap" style="display:flex;align-items:center;gap:8px;padding-left:8px;font-size:0.64rem;font-weight:600;text-transform:uppercase;letter-spacing:0.16em" data-mock-cap=""><span aria-hidden="true" class="dither inline-block size-2 shrink-0 rounded-[1px]" style="display:inline-block;width:8px;height:8px;flex-shrink:0"></span><span>SESSIONS · MOCK</span></span><div class="flex items-center gap-2 px-2 pt-2"><span id="date-divider" class="shrink-0 text-[0.64rem] font-semibold uppercase tracking-[0.12em] text-(--ui-text-quaternary)">EARLIER · MOCK</span></div></div>')
  .replace(/<span data-tour="sidebar-nav-([a-z-]+)">/g, '<i aria-hidden="true" class="codicon codicon-mock size-4 shrink-0"></i><span data-tour="sidebar-nav-$1">')
  // A files-changed widget on the chat surface (WIDGET_SHELL_CLASS + slot).
  .replace('<div data-slot="aui_intro">', '<div id="changed-files" data-slot="aui_changed-files" class="rounded-3xl bg-(--ui-widget-surface-background) px-3.5 py-3" style="background:var(--ui-widget-surface-background);border-radius:24px;padding:12px 14px">3 files changed · MOCK</div><div data-slot="aui_intro">')
  .replace("<script type=\"module\">", `<script>window.hermesDesktop={desktopPluginsRoot:async()=>'/plugins',readFileDataUrl:async p=>{const r=await fetch('/asset/'+p.split('/').pop());if(!r.ok)throw new Error('missing');const b=await r.blob();return new Promise(res=>{const f=new FileReader();f.onload=()=>res(f.result);f.readAsDataURL(b)})}}</script><script type="module">`)
assert(fixture.includes('id="shell"') && fixture.includes('id="statusbar"') && fixture.includes('id="wordmark"') && fixture.includes('id="pinned-glyph"') && fixture.includes('id="changed-files"') && fixture.includes('codicon-mock'))
// Source contracts the sidebar rules lean on (fail loudly if Hermes renames them).
const sidebarLabel = await read('app/shell/sidebar-label.tsx')
assert(sidebarLabel.includes('tracking-[0.16em] text-(--theme-primary)') && sidebarLabel.includes("'dither inline-block size-2"), 'SidebarPanelLabel caption/glyph contract')
const sidebarIndex = await read('app/chat/sidebar/index.tsx')
assert(sidebarIndex.includes('data-tour={`sidebar-nav-${item.id}`}') && sidebarIndex.includes('<Codicon name={codicon}'), 'nav row label handle + codicon contract')
assert((await read('components/chat/widget-shell.ts')).includes('bg-(--ui-widget-surface-background)'), 'widget shell token contract')
assert((await read('components/assistant-ui/thread/changed-files-card.tsx')).includes('data-slot="aui_changed-files"'), 'changed-files slot contract')
fixture = fixture.replace('id="titlebar-strip" class="titlebar-strip"', 'id="titlebar-strip" data-zone-tabstrip="mock-main" class="titlebar-strip"')
  .replace('</style>', '[data-zone-tabstrip]{background:var(--ui-sidebar-surface-background);--pane-tab-active-bg:var(--ui-sidebar-surface-background)}</style>')
fixture = fixture.replace('<div data-slot="sidebar-group-label">', '<div data-sessions-project="mock"><button data-slot="row-button" class="p-0"><span id="project-label">Example project</span></button></div><div data-slot="sidebar-group-label">')
fixture = fixture.replace('skinPlugin.register(context(sd));', 'const sc=context(sd);skinPlugin.register(sc);window.reloadSkin=()=>{sd.splice(0).forEach(f=>f());skinPlugin.register(sc)};')
fixture = fixture.replace("get(k){window.storageLog.push('get:'+k);", "get(k){if(k==='background' && window.failBackgroundRead)throw new Error('background read failed');window.storageLog.push('get:'+k);")
assert(fixture.includes('window.reloadSkin='), 'reload fixture preserves the plugin storage namespace')
await writeFile(path.join(output, 'index.html'), fixture)
const assetsDir = path.join(root, 'plugins/nebula-skin/assets')
const server = createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/asset/')) {
      const name = req.url.slice(7)
      res.setHeader('Content-Type', name.endsWith('.webp') ? 'image/webp' : name.endsWith('.png') ? 'image/png' : 'font/woff2')
      res.end(await readFile(path.join(assetsDir, name))); return
    }
    const name = req.url === '/' ? 'index.html' : req.url.slice(1)
    if (!['index.html', 'native.css', 'theme.js', 'skin.js', 'apply.js'].includes(name)) { res.writeHead(404).end(); return }
    res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html')
    res.end(await readFile(path.join(output, name)))
  } catch { res.writeHead(500).end() }
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1120, height: 800 }, reducedMotion: 'reduce' })
const errors = []
page.on('pageerror', e => { errors.push(e.message); console.error('Browser error:', e.message) })
const settle = async () => { await page.waitForTimeout(160); await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))) }
const waitSkin = on => page.waitForFunction(on => document.querySelectorAll('style[data-nebula-skin]').length === (on ? 1 : 0), on)
async function check(name, fn) { await fn(); console.log('PASS', name) }
const lum = c => c.map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }).reduce((a, v, i) => a + v * [.2126, .7152, .0722][i], 0)
const ratio = (a, b) => (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05)
const hex = h => h.slice(1).match(/../g).map(v => parseInt(v, 16))
// Computed box-shadow/text-shadow -> per-layer [x, y, blur] (commas inside rgb() kept).
const shadowLayers = v => v === 'none' ? [] : v.split(/,(?![^(]*\))/).map(l => [...l.replace(/\w+\([^)]*\)/g, '').matchAll(/(-?[\d.]+)px/g)].map(m => Number(m[1])))
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/`)
  await page.waitForFunction(() => window.ready)
  await check('registration is inert: no storage, root or DOM mutation; skin off by default', async () => {
    assert.deepEqual(await page.evaluate(() => registrationProof), { notifications: 0, root: true, storage: true, storageCalls: 0, skinStyles: 0, defaultEnabled: false, themeCount: 1 })
  })
  await check('palette pairs meet 4.5:1 in both modes', async () => {
    for (const mode of ['light', 'dark']) {
      const p = mode === 'light' ? themeModule.theme.colors : themeModule.theme.darkColors
      for (const [bg, fg] of [['background', 'foreground'], ['card', 'cardForeground'], ['muted', 'mutedForeground'], ['popover', 'popoverForeground'], ['primary', 'primaryForeground'], ['secondary', 'secondaryForeground'], ['accent', 'accentForeground'], ['midground', 'midgroundForeground'], ['destructive', 'destructiveForeground'], ['sidebarBackground', 'foreground'], ['userBubble', 'foreground']]) {
        const r = ratio(hex(p[bg]), hex(p[fg])); assert(r >= 4.5, `${mode} ${fg}/${bg} ${r.toFixed(2)}`)
      }
    }
  })
  const metrics = () => page.evaluate(() => Object.fromEntries(['action', 'input', 'panel', 'composer', 'code', 'nav-artifacts', 'sidebar', 'sessions-well', 'wordmark'].map(id => { const e = document.getElementById(id), r = e.getBoundingClientRect(), s = getComputedStyle(e); return [id, [r.x, r.y, r.width, r.height, s.fontFamily === s.fontFamily && id !== 'wordmark' ? s.fontFamily : 'wordmark', s.fontSize, s.padding]] })))
  for (const mode of ['light', 'dark']) await check(`${mode}: skin paints wallpaper, veils, rims and native wordmark without moving anything`, async () => {
    await page.evaluate(m => { selectMode(m); run('disable') }, mode); await waitSkin(false); await settle()
    assert.equal(await page.evaluate(() => document.documentElement.dataset.hermesTheme), 'nebula')
    const before = await metrics()
    const originalWordmark = await page.locator('#wordmark').evaluate(e => { const s = getComputedStyle(e); return [s.fontFamily, s.letterSpacing] })
    const alpha = c => { const m = c.match(/\/\s*([\d.]+)\)$/) || c.match(/^rgba\(.*,\s*([\d.]+)\)$/); return m ? Number(m[1]) : 1 }
    const shellBefore = await page.locator('#shell').evaluate(e => getComputedStyle(e).backgroundImage)
    assert.equal(shellBefore, 'none')
    await page.evaluate(() => run('enable')); await waitSkin(true); await settle()
    assert.deepEqual(await metrics(), before, 'geometry and fonts must not change')
    const shell = await page.locator('#shell').evaluate(e => getComputedStyle(e).backgroundImage)
    assert.match(shell, /^url\("data:image\/webp;base64,/, 'wallpaper is inlined from the plugin asset')
    const quietWallpaper = `url("data:image/webp;base64,${(await readFile(path.join(assetsDir, 'cosmos-space.webp'))).toString('base64')}")`
    await page.evaluate(() => run('background-space')); await settle()
    assert.equal(await page.locator('#shell').evaluate(e => getComputedStyle(e).backgroundImage), quietWallpaper, 'station-free command paints original space asset')
    assert.deepEqual(await metrics(), before, 'wallpaper selection does not change geometry or fonts')
    assert((await page.evaluate(() => storageLog)).includes('set:background'), 'background selection is saved')
    await page.evaluate(() => run('disable')); await waitSkin(false)
    await page.evaluate(() => run('enable')); await waitSkin(true); await settle()
    assert.equal(await page.locator('#shell').evaluate(e => getComputedStyle(e).backgroundImage), quietWallpaper, 'skin toggle preserves wallpaper selection')
    await page.evaluate(() => reloadSkin()); await waitSkin(true); await settle()
    assert.equal(await page.locator('#shell').evaluate(e => getComputedStyle(e).backgroundImage), quietWallpaper, 'background preference restores after plugin reload')
    await page.evaluate(() => run('background-toggle')); await settle()
    assert.equal(await page.locator('#shell').evaluate(e => getComputedStyle(e).backgroundImage), shell, 'background toggle restores station')
    await page.evaluate(() => { window.failBackgroundRead = true; reloadSkin() }); await waitSkin(true); await settle()
    assert.equal(await page.locator('#shell').evaluate(e => getComputedStyle(e).backgroundImage), shell, 'background read failure must not prevent enabled skin restoration')
    await page.evaluate(() => { window.failBackgroundRead = false })
    // Bot Mode roster group paints the editor surface natively; the skin must
    // give it the sidebar's near-opaque fill (live screenshot regression).
    assert.equal(alpha(await page.locator('#panel').evaluate(e => getComputedStyle(e).backgroundColor)), 0, 'top group must not tint the transparent header from underneath')
    await page.locator('[data-tree-group="mock-bots"]').evaluate(e => e.dataset.windowTop = 'true'); await settle()
    assert.equal(alpha(await page.locator('[data-tree-group="mock-bots"]').evaluate(e => getComputedStyle(e).backgroundColor)), 0, 'top bot group must also reveal wallpaper')
    await page.locator('[data-tree-group="mock-bots"]').evaluate(e => delete e.dataset.windowTop); await settle()
    for (const id of ['titlebar', 'titlebar-strip']) {
      assert.equal(alpha(await page.locator('#' + id).evaluate(e => getComputedStyle(e).backgroundColor)), 0, `${id} reveals wallpaper`)
    }
    assert.equal(await page.locator('#tab-active').evaluate(e => getComputedStyle(e).fontWeight), '700', 'tabs are bold')
    if (mode === 'dark') {
      assert.equal(await page.locator('#project-label').evaluate(e => getComputedStyle(e).color), 'rgb(213, 184, 255)', 'project labels use soft lavender ink')
      assert.equal(await page.locator('#project-label').evaluate(e => getComputedStyle(e).fontWeight), '600')
      assert.notEqual(await page.locator('#pinned-label').evaluate(e => getComputedStyle(e).color), 'rgb(141, 99, 255)', 'section headings are lighter than the primary accent')
    }
    const tabs = await page.locator('.titlebar-tab').evaluateAll(es => es.map(e => ({ active: e.dataset.active, bg: getComputedStyle(e).backgroundColor })))
    for (const tab of tabs) assert(Math.abs(alpha(tab.bg) - (tab.active === 'true' ? .65 : .3)) < .01, 'tabs keep distinct translucent active/idle fills')
    const roster = await page.locator('[data-tree-group="mock-bots"]').evaluate(e => getComputedStyle(e).backgroundColor)
    assert(alpha(roster) >= 0.9, 'bot roster group must be near-opaque over the wallpaper: ' + roster)
    for (const id of ['sidebar', 'pane-body', 'composer-surface']) {
      const rim = await page.locator('#' + id).evaluate(e => { const s = getComputedStyle(e, '::after'); return [s.content, s.pointerEvents, s.boxShadow] })
      assert.notEqual(rim[0], 'none', id); assert.equal(rim[1], 'none'); assert.notEqual(rim[2], 'none')
      // Restore the original soft rim glow; the new palette stays independent.
      assert(shadowLayers(rim[2]).some(l => l[2] > 0), `${id} retains its original glow: ${rim[2]}`)
    }
    if (mode === 'dark') {
      // Exact role mapping reaches the rendered tokens.
      const roles = await page.evaluate(() => { const s = getComputedStyle(document.documentElement); return Object.fromEntries(['--nebula-cyan', '--nebula-gold', '--nebula-lavender', '--nebula-accent', '--nebula-magenta', '--nebula-blue', '--nebula-warm', '--nebula-meta', '--nebula-placeholder', '--ui-text-quaternary', '--ui-stroke-secondary', '--ui-bg-input', '--ui-success', '--ui-warning', '--ui-danger'].map(k => [k, s.getPropertyValue(k).trim()])) })
      assert.deepEqual(roles, { '--nebula-cyan': '#47d9ff', '--nebula-gold': '#ffd86a', '--nebula-lavender': '#b35cff', '--nebula-accent': '#8d63ff', '--nebula-magenta': '#f05cff', '--nebula-blue': '#497bff', '--nebula-warm': '#ffb878', '--nebula-meta': '#b8b4d9', '--nebula-placeholder': '#7e82ae', '--ui-text-quaternary': '#7e82ae', '--ui-stroke-secondary': '#3e55d9', '--ui-bg-input': '#1b2252', '--ui-success': '#52e6b4', '--ui-warning': '#ffc857', '--ui-danger': '#ff6584' })
    }
    if (mode === 'dark') {
      await page.evaluate(() => { document.querySelector('#palette').hidden = false; document.querySelector('[data-slot="command-item"]').dataset.selected = 'true' })
      const rows = page.locator('[data-slot="command-item"]');
      const paint = loc => loc.evaluate(e => { const s = getComputedStyle(e); return { bg: s.backgroundColor, fg: s.color, edge: s.boxShadow } });
      const selected = await paint(rows.nth(0));
      await rows.nth(1).hover(); await settle();
      assert.deepEqual(await paint(rows.nth(1)), selected, 'pointer hover matches keyboard selection');
      assert.equal(selected.bg, 'rgb(62, 85, 217)');
      assert.notEqual((await paint(rows.nth(2))).bg, selected.bg, 'idle rows remain distinct');
      assert(ratio(hex('#3e55d9'), hex('#f4f1ff')) >= 4.5, 'selected command text remains readable');
      await rows.nth(1).evaluate(e => e.dataset.disabled = 'true');
      assert.notEqual((await paint(rows.nth(1))).bg, selected.bg, 'disabled rows do not gain the highlight');
      await page.evaluate(() => { document.querySelector('#palette').hidden = true; document.querySelectorAll('[data-slot="command-item"]').forEach(e => { delete e.dataset.selected; delete e.dataset.disabled }) });
    }
    const focusGlow = await page.evaluate(async () => {
      const composer = document.querySelector('#composer-surface');
      const input = document.createElement('input');
      composer.append(input); input.focus();
      await new Promise(resolve => setTimeout(resolve, 350));
      const actual = getComputedStyle(composer).boxShadow;
      const probe = document.createElement('div');
      probe.style.boxShadow = '0 0 14px color-mix(in srgb, var(--nebula-lavender) 45%, transparent)';
      composer.append(probe);
      const expected = getComputedStyle(probe).boxShadow;
      probe.remove(); input.remove();
      return { actual, expected };
    });
    assert.equal(focusGlow.actual, focusGlow.expected, 'focused composer uses the shared purple glow');
    const codeBackdrops = await page.evaluate(() => {
      const slots = ['code-card', 'diff-lines', 'file-diff-panel'];
      return slots.map(slot => {
        const el = document.createElement(slot === 'diff-lines' ? 'pre' : 'div');
        el.dataset.slot = slot;
        document.querySelector('#shell').append(el);
        const bg = getComputedStyle(el).backgroundColor;
        el.remove();
        return [slot, bg];
      });
    });
    for (const [slot, bg] of codeBackdrops) assert.equal(alpha(bg), 1, `${slot} must block the wallpaper: ${bg}`);
    const veil = await page.locator('#panel').evaluate(e => getComputedStyle(e.querySelector('.pane-layer')).backgroundColor)
    assert(alpha(veil) > 0.3 && alpha(veil) <= 0.65, 'content surface is translucent over the wallpaper: ' + veil)
    const bar = await page.locator('#statusbar').evaluate(e => getComputedStyle(e).backgroundColor)
    assert.equal(alpha(bar), 1, 'status bar stays opaque: ' + bar)
    // Sidebar feedback round: captions lavender (not host cyan), sparkle glyph,
    // per-row nav hues, rounded session rows, veiled files-changed widget.
    const lav = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--nebula-lavender').trim())
    const capColor = await page.locator('#pinned-label').evaluate(e => getComputedStyle(e).color)
    assert.equal(capColor, await page.evaluate(l => { const d = document.createElement('div'); d.style.color = l; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c }, mode === 'dark' ? `color-mix(in srgb, ${lav} 78%, #f4f1ff)` : lav), 'caption is lavender: ' + capColor)
    const glyph = await page.locator('#pinned-glyph').evaluate(e => [getComputedStyle(e).backgroundImage, getComputedStyle(e, '::after').backgroundImage, e.getBoundingClientRect().width])
    assert.equal(glyph[0], 'none', 'native dither removed'); assert.match(glyph[1], /^url\("data:image\/png;base64,/, 'sparkle painted'); assert.equal(glyph[2], 8, 'glyph box unchanged')
    const inks = await page.evaluate(() => [...document.querySelectorAll('[data-tour="sessions-sidebar"] [data-sidebar="menu-button"]')].map(b => [getComputedStyle(b).borderTopColor, getComputedStyle(b.querySelector('.codicon')).color, getComputedStyle(b).borderRadius]))
    assert(inks.length >= 5, 'fixture has nav rows'); assert.equal(new Set(inks.map(i => i[1])).size, inks.length, 'each nav row icon has its own hue: ' + inks.map(i => i[1]).join(' | '))
    assert(inks.every(i => i[2] === '10px'), 'nav chips rounded 10px')
    const rowRadius = await page.locator('#sessions-well [data-slot="row-button"]').first().evaluate(e => getComputedStyle(e).borderRadius)
    assert.equal(rowRadius, '8px', 'session rows rounded')
    const sessionHover = page.locator('#sessions-well [data-slot="row-button"]').first()
    await sessionHover.hover(); await settle()
    assert.equal(await sessionHover.evaluate(e => getComputedStyle(e).boxShadow), 'none', 'session hover has no decorative border')
    await page.mouse.move(0, 0); await settle()
    const widget = await page.locator('#changed-files').evaluate(e => getComputedStyle(e).backgroundColor)
    assert(alpha(widget) > 0.3 && alpha(widget) < 0.8, 'files-changed widget is veiled, not opaque: ' + widget)
    // Nav row label text still clears AA on its chip fill in this mode.
    const navPng = await page.locator('#nav-artifacts').screenshot()
    const navBg = await page.evaluate(async b => { const img = new Image(); img.src = 'data:image/png;base64,' + b; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return [...x.getImageData(2, 2, 1, 1).data].slice(0, 3) }, navPng.toString('base64'))
    const navFg = await page.locator('#nav-artifacts').evaluate(e => getComputedStyle(e).color.match(/\d+/g).slice(0, 3).map(Number))
    assert(ratio(navBg, navFg) >= 4.5, `${mode} nav label ${ratio(navBg, navFg).toFixed(2)} fg=${navFg} bg=${navBg}`)
    assert.deepEqual(await page.locator('#wordmark').evaluate(e => { const s = getComputedStyle(e); return [s.fontFamily, s.letterSpacing] }), originalWordmark, 'wordmark retains native typography')
    // Real text over the veiled content still clears AA. Sample the panel prose
    // against a screenshot of what is actually behind it.
    const png = await page.locator('#heading').screenshot()
    const bg = await page.evaluate(async b => { const img = new Image(); img.src = 'data:image/png;base64,' + b; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return [...x.getImageData(1, 1, 1, 1).data].slice(0, 3) }, png.toString('base64'))
    const fg = await page.locator('#heading').evaluate(e => getComputedStyle(e).color.match(/\d+/g).slice(0, 3).map(Number))
    const r = ratio(bg, fg); assert(r >= 4.5, `${mode} heading over veiled wallpaper ${r.toFixed(2)} bg=${bg}`)
    await page.screenshot({ path: path.join(output, `mock-${mode}.png`) })
    await page.evaluate(() => run('disable')); await waitSkin(false); await settle()
    assert.equal(await page.locator('#shell').evaluate(e => getComputedStyle(e).backgroundImage), 'none')
    assert.equal(await page.locator('#pane-body').evaluate(e => getComputedStyle(e, '::after').content), 'none')
    assert.match(await page.evaluate(() => notifications.at(-1).message), /is OFF/)
  })
  await check('skin is scoped to the Nebula theme; toggle and dispose clean up', async () => {
    await page.evaluate(() => run('enable')); await waitSkin(true)
    await page.evaluate(() => { document.documentElement.dataset.hermesTheme = 'other' }); await settle()
    assert.equal(await page.locator('#shell').evaluate(e => getComputedStyle(e).backgroundImage), 'none', 'other themes untouched')
    assert.equal(await page.locator('#pane-body').evaluate(e => getComputedStyle(e, '::after').content), 'none')
    await page.evaluate(() => selectMode('dark')); await settle()
    await page.evaluate(() => run('toggle')); await waitSkin(false)
    await page.evaluate(() => run('toggle')); await waitSkin(true)
    await page.evaluate(() => { skinDispose(); themeDispose() })
    assert.equal(await page.locator('style[data-nebula-skin]').count(), 0)
    assert.equal(await page.locator('style[data-nebula-colors]').count(), 0)
  })
  assert.deepEqual(errors, [])
  console.log(`Preview: ${path.relative(root, output)}/index.html (serve over HTTP); screenshots mock-light.png / mock-dark.png`)
} finally { await browser.close(); server.close() }
