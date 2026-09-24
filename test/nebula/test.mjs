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
  .replace("<script type=\"module\">", `<script>window.hermesDesktop={desktopPluginsRoot:async()=>'/plugins',readFileDataUrl:async p=>{const r=await fetch('/asset/'+p.split('/').pop());if(!r.ok)throw new Error('missing');const b=await r.blob();return new Promise(res=>{const f=new FileReader();f.onload=()=>res(f.result);f.readAsDataURL(b)})}}</script><script type="module">`)
assert(fixture.includes('id="shell"') && fixture.includes('id="statusbar"') && fixture.includes('id="wordmark"'))
await writeFile(path.join(output, 'index.html'), fixture)
const assetsDir = path.join(root, 'plugins/nebula-skin/assets')
const server = createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/asset/')) {
      const name = req.url.slice(7)
      res.setHeader('Content-Type', name.endsWith('.webp') ? 'image/webp' : 'font/woff2')
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
  for (const mode of ['light', 'dark']) await check(`${mode}: skin paints wallpaper, veils, rims and pixel wordmark without moving anything`, async () => {
    await page.evaluate(m => { selectMode(m); run('disable') }, mode); await waitSkin(false); await settle()
    assert.equal(await page.evaluate(() => document.documentElement.dataset.hermesTheme), 'nebula')
    const before = await metrics()
    const alpha = c => { const m = c.match(/\/\s*([\d.]+)\)$/) || c.match(/^rgba\(.*,\s*([\d.]+)\)$/); return m ? Number(m[1]) : 1 }
    const shellBefore = await page.locator('#shell').evaluate(e => getComputedStyle(e).backgroundImage)
    assert.equal(shellBefore, 'none')
    await page.evaluate(() => run('enable')); await waitSkin(true); await settle()
    assert.deepEqual(await metrics(), before, 'geometry and fonts must not change')
    const shell = await page.locator('#shell').evaluate(e => getComputedStyle(e).backgroundImage)
    assert.match(shell, /^url\("data:image\/webp;base64,/, 'wallpaper is inlined from the plugin asset')
    // Bot Mode roster group paints the editor surface natively; the skin must
    // give it the sidebar's near-opaque fill (live screenshot regression).
    const roster = await page.locator('[data-tree-group="mock-bots"]').evaluate(e => getComputedStyle(e).backgroundColor)
    assert(alpha(roster) >= 0.9, 'bot roster group must be near-opaque over the wallpaper: ' + roster)
    for (const id of ['sidebar', 'pane-body', 'composer-surface']) {
      const rim = await page.locator('#' + id).evaluate(e => { const s = getComputedStyle(e, '::after'); return [s.content, s.pointerEvents, s.boxShadow] })
      assert.notEqual(rim[0], 'none', id); assert.equal(rim[1], 'none'); assert.notEqual(rim[2], 'none')
    }
    const veil = await page.locator('#panel').evaluate(e => getComputedStyle(e.querySelector('.pane-layer')).backgroundColor)
    assert(alpha(veil) > 0.3 && alpha(veil) < 0.9, 'content surface is translucent over the wallpaper: ' + veil)
    const bar = await page.locator('#statusbar').evaluate(e => getComputedStyle(e).backgroundColor)
    assert.equal(alpha(bar), 1, 'status bar stays opaque: ' + bar)
    const wm = await page.locator('#wordmark').evaluate(e => getComputedStyle(e).fontFamily)
    assert.match(wm, /Nebula Pixel/)
    assert(await page.evaluate(() => document.fonts.check("40px 'Nebula Pixel'")), 'pixel font loaded from woff2')
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
