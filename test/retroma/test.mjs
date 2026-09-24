// Partial integration: actual loader functions, theme validator/application and CSS;
// SDK registration is isolated. Fixture DOM is source-derived, NOT the live client.
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
assert(loaderPart.includes('function unsupportedImports') && loaderPart.includes('function rewriteSpecifiers'))
const sdk = moduleUrl("export const THEMES_AREA='themes'; export const PALETTE_AREA='command-palette'; export const host={notify:n=>globalThis.notifications.push(n)};")
const transformModule = await import(moduleUrl(await js(`const sdkImportMap=()=>({'@hermes/plugin-sdk':${JSON.stringify(sdk)}});\n${loaderPart}\nexport {unsupportedImports,rewriteSpecifiers}`)))
const sources = await Promise.all(['retroma-theme','retroma-tactile'].map(n => readFile(path.join(root, 'plugins', n, 'plugin.js'), 'utf8')))
const modules = []
for (const source of sources) {
  assert.deepEqual(transformModule.unsupportedImports(source), [])
  modules.push(transformModule.rewriteSpecifiers(source))
}
// Updated loader filters import-regex matches to code ranges: the historic
// string-ending-in-"from" false positive is gone upstream. Assert the fix
// holds AND that real unsupported bare imports are still detected.
assert.deepEqual(transformModule.unsupportedImports("const label = 'Generate from'; const other = 'bad';"), [])
assert.deepEqual(transformModule.unsupportedImports("import x from 'not-a-real-pkg'"), ['not-a-real-pkg'])
const themeModule = await import(moduleUrl(modules[0]))
const types = await read('themes/types.ts')
const { isValidTheme } = await import(moduleUrl(await js(types)))
assert(isValidTheme(themeModule.theme))
const required = [...types.split('export interface DesktopThemeColors {')[1].split('\n}')[0].matchAll(/^  (\w+): string/gm)].map(m => m[1])
for (const colors of [themeModule.theme.colors, themeModule.theme.darkColors]) {
  for (const key of required) assert.match(colors[key], /^#[\da-f]{6}$/i, key)
}
assert.equal(themeModule.theme.typography, undefined)
// Verify every selector anchor exists in the installed source; fail on drift.
for (const [file, anchors] of [
  ['app/command-palette/index.tsx', ['<DialogPrimitive.Content', 'HUD_POSITION,', 'HUD_SURFACE,', 'w-[min(34rem,calc(100vw-2rem))]', '<Command className="bg-transparent" loop shouldFilter={false}>']],
  ['app/floating-hud.ts', ['fixed left-1/2 top-3', 'rounded-xl border border-(--stroke-nous)']],
  ['components/ui/command.tsx', ['data-slot="command"', 'data-slot="command-input"', 'data-slot="command-list"', '**:[[cmdk-group-heading]]:z-10']],
  ['components/ui/button.tsx', ['data-slot="button"','data-variant={variant}']],
  ['components/ui/input.tsx', ['data-slot="input"', 'data-slot="input-group"']],
  ['components/ui/textarea.tsx', ['data-slot="textarea"']],
  ['components/ui/sidebar.tsx', ['data-slot="sidebar"', 'data-sidebar="menu"', 'data-sidebar="menu-button"', 'data-active={isActive}']],
  ['app/chat/sidebar/index.tsx', ['data-sessions-mode={sessionsMode}', 'collapsible="none"', 'data-tour="sessions-sidebar"', 'data-tour={`sidebar-nav-${item.id}`}', "id: 'new-session'", "id: 'capabilities'", "id: 'messaging'", "id: 'artifacts'", "id: 'cron'", 'bg-(--ui-control-active-background)']],
  ['app/chat/sidebar/profile-dropdown-switcher.tsx', ['data-slot="profile-switcher"', '<Button']],
  ['plugins/hermes-bots/roster-pane-content.tsx', ['data-slot="bots-roster"']],
  ['plugins/hermes-bots/roster-pane-toolbar.tsx', ['flex items-center justify-between gap-2 px-2.5 pt-2.5 pb-1.5']],
  ['plugins/hermes-bots/bot-row.tsx', ['<RowButton', 'data-roster-key={rosterKey}', "isActive && 'bg-(--ui-row-active-background)'", '<SessionStatusDot']],
  ['components/ui/row-button.tsx', ['data-slot="row-button"']],
  ['app/chat/composer/index.tsx', ['data-slot="composer-surface"', 'data-slot="composer-root"', 'data-slot={RICH_INPUT_SLOT}', 'contentEditable={!inputDisabled}']],
  ['app/chat/composer/floating-target.ts', ['composer-rich-input']],
  ['components/pane-shell/tree/renderer/tree-group.tsx', ['data-panel-header=""','data-tree-group={node.id}','data-window-top={topEdge || undefined}', "'absolute inset-0 overflow-auto'", "shrink-0 bg-(--ui-sidebar-surface-background)","'var(--panel-titlebar-left, 100%)'"]],
  ['components/ui/pane-tab.tsx', ['--pane-tab-active-bg,var(--ui-editor-surface-background)', '--pane-tab-strip-bg,var(--ui-sidebar-surface-background)']],
  ['app/chat/composer/trigger-popover.tsx', ['data-slot="composer-completion-drawer"','role="listbox"']]
]) for (const anchor of anchors) assert((await read(file)).includes(anchor), `${file}: ${anchor}`)
assert((await read('styles.css')).includes("[data-slot='composer-rich-input']:is(:empty, [data-empty])::before"))
assert((await read('sdk/index.ts')).includes('  notify,'))
assert((await read('themes/user-themes.ts')).includes("THEMES_AREA = 'themes'"))
const paletteContract = await read('app/command-palette/contrib.ts')
const area = paletteContract.match(/PALETTE_AREA = '([^']+)'/)[1]
// Replace the area fixture with the actual contract value.
modules[1] = modules[1].replace(sdk, moduleUrl(`export const PALETTE_AREA=${JSON.stringify(area)}; export const host={notify:n=>globalThis.notifications.push(n)};`))

// Bundle actual applyTheme plus its real color helpers. Only host/React state,
// font preference and native bridge side effects are stubbed in this MOCK.
const context = await read('themes/context.tsx')
const applyPart = context.slice(context.indexOf('function renderedModeFor('), context.indexOf('\n}', context.indexOf('function applyTheme(')) + 2)
assert(applyPart.includes("root.dataset.hermesTheme = skinName"))
const entry = `import { ensureContrast,mix,parseColor } from '@hermes/shared/color';
import {harmonize,readableInk} from ${JSON.stringify(path.join(src,'themes/color.ts'))};
const DEFAULT_TYPOGRAPHY={fontSans:'sans-serif',fontMono:'monospace'};
const nousTheme={}; const $chatFontFamily={get:()=>null};
const resolveChatFontFamily=(v,f)=>v||f; const setAppearance=()=>{};
const INJECTED_FONT_URLS=new Set();
${applyPart}
window.paint=(theme,mode)=>applyTheme({...theme,name:theme.name+'-'+mode,colors:mode==='dark'?theme.darkColors:theme.colors},mode,'sans-serif');`
const bundle = await esbuild.build({stdin:{contents:entry,loader:'ts',resolveDir:src},bundle:true,write:false,format:'iife',alias:{'@hermes/shared/color':path.resolve(src,'../../shared/src/color.ts')}})
await writeFile(path.join(output,'apply.js'),bundle.outputFiles[0].text)
await writeFile(path.join(output,'native.css'),(await read('styles.css')).replace(/^@import .*;$/gm,''))
await writeFile(path.join(output,'theme.js'),modules[0])
await writeFile(path.join(output,'skin.js'),modules[1])
await writeFile(path.join(output,'index.html'), await readFile(path.join(here,'fixture.html'),'utf8'))
// Warning/error regression: compile the host's actual styles.css with the
// host's Tailwind for the exact class strings in source, so utilities, @theme
// mappings, layers and the .dark variant cascade for real (not hand-written).
const modelSettings = await read('app/settings/model-settings.tsx')
const staleAux = modelSettings.slice(modelSettings.indexOf('function StaleAuxWarning('), modelSettings.indexOf('interface ModelSettingsProps'))
const warnClass = staleAux.match(/return \(\s*<div className="([^"]+)">/)?.[1]
const iconClass = staleAux.match(/<AlertTriangle className="([^"]+)"/)?.[1]
const errorClass = modelSettings.match(/const errorNotice = error && \(\s*<div className="([^"]+)">/)?.[1]
const buttonSource = await read('components/ui/button.tsx')
const textStrongClass = buttonSource.match(/textStrong: `([^`]+)`/)?.[1].replace('${TEXT_ACTION_ICON}', buttonSource.match(/TEXT_ACTION_ICON = '([^']+)'/)?.[1] ?? '')
assert.equal(warnClass, 'flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200', 'StaleAuxWarning classes drifted: re-check the Retroma selector')
assert(iconClass && errorClass?.includes('text-destructive') && textStrongClass?.includes('text-muted-foreground'), 'warning/error source anchors')
assert(staleAux.includes('variant="textStrong"') && staleAux.includes('<span className="font-mono">'))
const agentRequire = createRequire(path.resolve(src, '../../../package.json'))
const { compile } = agentRequire('@tailwindcss/node')
// Only non-color animation/font/icon packages are dropped (tw-shimmer is not
// installed in the checkout); tailwindcss and every host @theme mapping stay.
const hostCss = (await read('styles.css')).replace(/^@import '(tw-shimmer|katex|@vscode\/codicons)[^']*';$/gm, '').replace(/^@plugin '@tailwindcss\/typography';$/gm, '')
const candidates = [...new Set([warnClass, iconClass, errorClass, textStrongClass, 'grow font-mono text-xs text-muted-foreground'].join(' ').split(/\s+/))]
const hostCompiled = (await compile(hostCss, { base: src, onDependency() {} })).build(candidates)
for (const utility of ['.text-amber-200', '.bg-amber-500\\/10', '.text-destructive', '.text-muted-foreground']) assert(hostCompiled.includes(utility), 'compiled host utility ' + utility)
await writeFile(path.join(output,'host.css'), hostCompiled)
await writeFile(path.join(output,'warning.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Retroma warning/error — source-shaped MOCK</title>
<link rel="stylesheet" href="host.css"><script src="apply.js"></script></head><body style="margin:0">
<div id="surface" style="width:900px;padding:16px;background:var(--ui-editor-surface-background);color:var(--ui-text-primary)">
<p class="text-xs text-muted-foreground">Helper tasks run on the main model by default. Assign a dedicated model to any task to override.</p>
<div id="warn" class="${warnClass}"><svg id="warn-icon" class="${iconClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3 2 21h20L12 3zM12 10v5M12 18h.01"/></svg><span id="warn-text" class="grow">1 auxiliary task (Title gen) still run on <span id="warn-mono" class="font-mono">openai-codex</span>, not your main model.</span><button id="warn-reset" data-slot="button" data-variant="textStrong" class="${textStrongClass}" style="background:none;border:0;padding:0;font:inherit;font-weight:600">Reset all to main</button></div>
<div id="err" class="${errorClass}"><span id="err-text">Could not reach the backend (version skew).</span><button id="err-restart" data-slot="button" data-variant="textStrong" class="${textStrongClass}" style="background:none;border:0;padding:0;font:inherit;font-weight:600">Restart backend</button></div>
</div>
<script type="module">
import themePlugin,{theme} from './theme.js'
const disposers=[];themePlugin.register({register(){},onDispose(f){disposers.push(f)},storage:{get(){},set(){},remove(){}}})
window.themeDispose=()=>disposers.splice(0).forEach(f=>f())
window.retroma=theme
// Composite every ancestor background (alpha included) exactly as painted,
// then the element's own color over that, in the browser's own color parser.
window.measure=id=>{
  const el=document.getElementById(id),c=document.createElement('canvas');c.width=c.height=1
  const x=c.getContext('2d',{willReadFrequently:true}),chain=[]
  for(let e=el;e;e=e.parentElement) chain.unshift(getComputedStyle(e).backgroundColor)
  const paint=v=>{x.fillStyle='#010203';x.fillStyle=v;if(x.fillStyle==='#010203'&&!/^rgba?\\(1, 2, 3/.test(v))throw new Error('unparsed '+v);x.fillRect(0,0,1,1);return [...x.getImageData(0,0,1,1).data].slice(0,3)}
  x.fillStyle='#fff';x.fillRect(0,0,1,1);let back;for(const bg of chain) back=paint(bg)
  const s=getComputedStyle(el),fore=paint(s.color)
  const lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0)
  const a=lum(fore),b=lum(back)
  return {id,color:s.color,chain:chain.filter(v=>v!=='rgba(0, 0, 0, 0)'),back:'rgb('+back+')',fore:'rgb('+fore+')',opacity:s.opacity,ratio:+((Math.max(a,b)+.05)/(Math.min(a,b)+.05)).toFixed(2)}
}
window.ready=true
</script></body></html>`)
const server = createServer(async (req,res) => {
  try {
    const name = req.url === '/' ? 'index.html' : req.url.slice(1)
    if (!['index.html','native.css','theme.js','skin.js','apply.js','warning.html','host.css'].includes(name)) {res.writeHead(404).end();return}
    res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html')
    res.end(await readFile(path.join(output,name)))
  } catch {res.writeHead(500).end()}
})
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve))
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']})
const page = await browser.newPage({viewport:{width:1120,height:800},reducedMotion:'reduce'})
const errors=[]
page.on('pageerror',e=>{errors.push(e.message);console.error('Browser error:',e.message)})
const results=[]
// Native controls transition for 100ms; two frames can sample an in-flight shadow.
const settle=async()=>{await page.waitForTimeout(160);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))}
async function check(name,fn) {await fn(); results.push(name); console.log('PASS',name)}
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/`)
  await page.waitForFunction(()=>window.ready)
  await check('actual loader transformation, theme contract, source selector contracts',async()=>{})
  await check('registration is inert; no storage or root mutation; tactile opt-in',async()=>{
    assert.deepEqual(await page.evaluate(()=>registrationProof),{notifications:0,root:true,storage:true,storageCalls:0,skinStyles:0,defaultEnabled:false,themeCount:1})
  })
  const metrics=()=>page.evaluate(()=>Object.fromEntries(['action','input','panel','composer','code','terminal','nav-artifacts','bot-one','bot-toolbar','profile-button'].map(id=>{
    const e=document.getElementById(id), r=e.getBoundingClientRect(), s=getComputedStyle(e)
    return [id,[r.x,r.y,r.width,r.height,s.fontFamily,s.fontSize,s.padding,s.lineHeight]]
  })))
  await page.evaluate(()=>selectMode('light'))
  const before=await metrics()
  await check('registered enable is idempotent; skin preserves geometry/fonts',async()=>{
    await page.evaluate(()=>{run('enable');run('enable')})
    assert.equal(await page.locator('style[data-retroma-tactile]').count(),1)
    assert.match(await page.evaluate(()=>notifications.at(-1).message),/is ON/)
    await settle()
    assert.deepEqual(await metrics(),before)
    assert.notEqual(await page.locator('#action').evaluate(e=>getComputedStyle(e).boxShadow),'none')
  })
  await check('Sessions well, child-safe workspace frame, navigation relief and focused composer',async()=>{
    for(const mode of ['light','dark']) {
      await page.evaluate(m=>{selectMode(m);run('disable')},mode);await settle()
      const measure=()=>page.evaluate(()=>Object.fromEntries(['sidebar','sessions-well','panel','composer-surface'].map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect(),s=getComputedStyle(e);return [id,[r.x,r.y,r.width,r.height,e.scrollHeight,e.scrollWidth,s.overflow,s.fontFamily]]})))
      const baseline=await measure()
      await page.evaluate(()=>run('enable'));await settle()
      assert.deepEqual(await measure(),baseline)
      assert.notEqual(await page.locator('#sessions-well').evaluate(e=>getComputedStyle(e).boxShadow),'none','Sessions scrolling list needs its own inset well')
      assert.equal(await page.locator('#sessions-well').evaluate(e=>getComputedStyle(e).backgroundColor),await page.locator('#panel').evaluate(e=>getComputedStyle(e).backgroundColor))
      for(const id of ['sidebar','pane-body','composer-surface']) {
        const rim=await page.locator('#'+id).evaluate(e=>{const s=getComputedStyle(e,'::after');return {content:s.content,pointer:s.pointerEvents,shadow:s.boxShadow}})
        assert.notEqual(rim.content,'none',id+' frame must paint above opaque children')
        assert.equal(rim.pointer,'none');assert.notEqual(rim.shadow,'none')
      }
      assert.notEqual(await page.locator('#nav-skills').evaluate(e=>getComputedStyle(e).boxShadow),'none','actual navigation is sidebar-menu-button, not SDK button')
      await page.locator('#composer').focus()
      assert.notEqual(await page.locator('#composer-surface').evaluate(e=>getComputedStyle(e,'::after').boxShadow),'none','focused composer keeps perimeter')
      await page.locator('#sessions-well').evaluate(e=>e.scrollTop=90)
      assert.equal(await page.locator('#sessions-well').evaluate(e=>e.scrollTop),90)
      await page.evaluate(()=>run('disable'));await settle()
      assert.equal(await page.locator('#sessions-well').evaluate(e=>e.scrollTop),90)
      assert.equal(await page.locator('#pane-body').evaluate(e=>getComputedStyle(e,'::after').content),'none')
      assert.match(await page.evaluate(()=>notifications.at(-1).message),/is OFF/)
      await page.locator('#sessions-well').evaluate(e=>e.scrollTop=0)
    }
    await page.locator('#composer').blur();await page.evaluate(()=>run('enable'))
  })
  await check('workspace frame starts below the header: no header notches, nested ring or rail frame',async()=>{
    // Regression for the live screenshot: a rounded group-wide ::after ran
    // through the lavender header and nested a 4px ring inside cyan content.
    const px=async(clip,points)=>{const png=await page.screenshot({clip});return page.evaluate(async({b,points})=>{const img=new Image();img.src='data:image/png;base64,'+b;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);return points.map(([a,y])=>[...x.getImageData(a,y,1,1).data].slice(0,3))},{b:png.toString('base64'),points})}
    for(const mode of ['light','dark']) {
      await page.evaluate(m=>{selectMode(m);run('disable')},mode);await settle()
      const r=await page.locator('#titlebar').evaluate(e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height}})
      // Header corners/edges plus the right spacer interior, which only shows header fill.
      const pts=[[1,1],[2,6],[r.width-2,1],[r.width-3,6],[1,Math.floor(r.height/2)],[r.width-2,Math.floor(r.height/2)],[r.width-40,r.height-3]]
      const off=await px(r,pts)
      await page.evaluate(()=>run('enable'));await settle()
      assert.equal(await page.locator('#panel').evaluate(e=>getComputedStyle(e,'::after').content),'none','group-wide frame must not span the header')
      assert.deepEqual(await px(r,pts),off,`${mode}: skin must not paint notches or bevels over the header`)
      const body=await page.locator('#pane-body').evaluate(e=>{const s=getComputedStyle(e,'::after'),o=getComputedStyle(e);return {radius:s.borderRadius,clip:o.borderRadius,path:o.clipPath,overflow:o.overflow,shadow:s.boxShadow,top:e.getBoundingClientRect().top}})
      // User-requested rounding is painted by the overlay (kept panes live outside
      // PaneBody), trimmed by the body's unchanged square overflow clip.
      assert.equal(body.radius,'6px');assert.equal(body.clip,'0px','body box and hit-testing stay square')
      assert.equal(body.overflow,'hidden');assert.equal(body.path,'none')
      assert.equal(body.top,r.y+r.height,'bevel begins exactly at the header seam')
      assert(!body.shadow.includes('0px 0px 0px 4px'),'no nested 4px lavender ring: '+body.shadow)
      // Inside the content, just past the frame: plain cyan, not a lavender ring.
      const b=await page.locator('#pane-body').evaluate(e=>{const q=e.getBoundingClientRect();return {x:q.x,y:q.y,width:q.width,height:40}})
      const fill=await page.locator('#panel').evaluate(e=>getComputedStyle(e).backgroundColor)
      const [inner]=await px(b,[[6,20]])
      assert.equal(`rgb(${inner.join(', ')})`,fill,`${mode}: content 6px from edge keeps its fill`)
      // Rounded corners show chrome, never a square cyan leak, at all four corners.
      const chrome=await page.locator('#titlebar').evaluate(e=>getComputedStyle(e).backgroundColor)
      const full=await page.locator('#pane-body').evaluate(e=>{const q=e.getBoundingClientRect();return {x:q.x,y:q.y,width:q.width,height:q.height}})
      const corners=await px(full,[[0,0],[full.width-1,0],[0,full.height-1],[full.width-1,full.height-1]])
      for(const c of corners) assert.equal(`rgb(${c.join(', ')})`,chrome,`${mode}: corner wedge must be chrome: ${JSON.stringify(corners)}`)
      await page.evaluate(()=>run('disable'));await settle()
      assert.deepEqual(await page.locator('#pane-body').evaluate(e=>{const s=getComputedStyle(e);return [s.borderRadius,s.clipPath,s.boxShadow]}),['0px','none','none'],'disable restores square unclipped body')
      assert.deepEqual(await px(r,pts),off);await page.evaluate(()=>run('enable'));await settle()
    }
    // Collapsed rail: source vertical-collapse group has no visible PaneBody.
    await page.evaluate(()=>{const cap=document.createElement('div');cap.id='rail-probe';cap.dataset.treeGroup='mock-rail';cap.style.cssText='position:fixed;right:0;top:0;width:28px;height:140px';cap.innerHTML='<div class="flex h-full shrink-0" style="background:var(--ui-sidebar-surface-background)"></div>';document.body.append(cap)})
    assert.equal(await page.locator('#rail-probe').evaluate(e=>getComputedStyle(e,'::after').content),'none')
    assert.equal(await page.locator('#rail-probe > div').evaluate(e=>getComputedStyle(e,'::after').content),'none','collapsed rail gets no nested frame')
    await page.evaluate(()=>document.getElementById('rail-probe').remove())
    for(const mode of ['light','dark']){await page.evaluate(m=>selectMode(m),mode);await settle();await page.screenshot({path:path.join(output,`mock-seams-${mode}.png`),clip:{x:0,y:40,width:1120,height:200}})}
  })
  await check('live-scene: kept-alive pane host cannot leak square corners; sash hairlines leave the top band clean',async()=>{
    // Source keep-alive-panes.tsx: kept panes render in an absolute z-0 host
    // anchored OVER PaneBody but outside it, so PaneBody's clip never applies.
    // Source tree-split.tsx Sash: full-height z-20 grab band with a 10% hairline
    // (still shown when disabled, e.g. beside a minimized rail).
    await page.evaluate(()=>{
      const body=document.getElementById('pane-body').getBoundingClientRect(),panel=document.getElementById('panel').getBoundingClientRect()
      const host=document.createElement('div');host.id='kept-host';host.dataset.paneHost='mock-chat';host.dataset.treeGroup='mock-main';host.className='absolute overflow-auto z-0'
      host.style.cssText=`position:absolute;z-index:0;overflow:auto;left:${body.left+scrollX}px;top:${body.top+scrollY}px;width:${body.width}px;height:${body.height}px;background:var(--ui-editor-surface-background)`
      host.innerHTML='<div style="height:1400px;padding:24px">Kept-alive chat MOCK</div>';document.body.append(host)
      const sash=(id,x,disabled)=>{const s=document.createElement('div');s.id=id;s.setAttribute('role','separator');s.className='group absolute z-20'+(disabled?' pointer-events-none':' cursor-col-resize')
        s.style.cssText=`position:absolute;z-index:20;left:${x-1}px;top:${panel.top+scrollY}px;height:${panel.height}px;width:8px;${disabled?'pointer-events:none':'cursor:col-resize'}`
        s.innerHTML='<span class="absolute opacity-10" style="position:absolute;top:0;bottom:0;left:1px;width:1px;transform:translateX(-50%);background:var(--ui-stroke-secondary)"></span>'+(disabled?'':'<span class="absolute opacity-0" style="position:absolute;top:0;bottom:0;left:1px;width:4px;transform:translateX(-50%);background:var(--ui-sash-hover-border)"></span>')
        document.body.append(s)}
      sash('sash-left',panel.left,false);sash('sash-right',panel.right-1,true)
      // Tailwind opacity-10 / opacity-0 / group-hover:opacity-100 live in the utilities layer.
      const st=document.createElement('style');st.id='mock-group-hover';st.textContent='@layer utilities{.opacity-10{opacity:.1}.opacity-0{opacity:0}.group:hover>span{opacity:1}}';document.head.append(st)
    })
    const px=async(clip,points)=>{const png=await page.screenshot({clip});return page.evaluate(async({b,points})=>{const img=new Image();img.src='data:image/png;base64,'+b;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);return points.map(([a,y])=>`rgb(${[...x.getImageData(a,y,1,1).data].slice(0,3).join(', ')})`)},{b:png.toString('base64'),points})}
    for(const mode of ['light','dark']) for(const skin of ['enable','disable']) {
      await page.evaluate(({m,s})=>{selectMode(m);run(s)},{m:mode,s:skin});await page.mouse.move(600,700);await settle()
      const chrome=await page.locator('#titlebar').evaluate(e=>getComputedStyle(e).backgroundColor)
      const t=await page.locator('#titlebar').evaluate(e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height}})
      // Top control band beside each seam: header fill only, no hairline.
      const band=await px({x:t.x-2,y:t.y,width:t.width+3,height:t.height},[[2,t.height/2|0],[t.width+1,t.height/2|0]])
      const b=await page.locator('#pane-body').evaluate(e=>{const q=e.getBoundingClientRect();return {x:q.x,y:q.y,width:q.width,height:q.height}})
      const corners=await px(b,[[0,0],[b.width-1,0],[0,b.height-1],[b.width-1,b.height-1],[1,1]])
      if(skin==='enable') {
        for(const c of corners.slice(0,4)) assert.equal(c,chrome,`${mode}: kept host leaks square corner: ${corners}`)
        // 1px in sits on the anti-aliased frame curve: bezel lavender, never cyan fill.
        {const [r,g]=corners[4].match(/\d+/g).map(Number);assert(g<r,`${mode}: cyan inside rounded corner: ${corners[4]}`)}
        assert.deepEqual(band,[chrome,chrome],`${mode}: sash hairline must not cut the top band`)
        // Hover affordance and grab band survive; only resting paint is quiet.
        await page.mouse.move(t.x+1,t.y+t.height/2);await settle()
        assert.equal(await page.evaluate(({x,y})=>document.elementFromPoint(x,y).closest('[role=separator]')?.id,{x:t.x+1,y:t.y+t.height/2}),'sash-left','resize hit area preserved')
        assert.equal(await page.locator('#sash-left > span').first().evaluate(e=>getComputedStyle(e).opacity),'1','hover still shows the seam')
        await page.mouse.move(600,700);await settle()
      } else {
        assert.equal(await page.locator('#sash-left > span').first().evaluate(e=>getComputedStyle(e).opacity),'0.1','skin off restores native hairline')
        assert.equal(await page.locator('#pane-body').evaluate(e=>getComputedStyle(e,'::after').content),'none')
      }
      await page.screenshot({path:path.join(output,`mock-live-scene-${mode}-${skin}.png`),clip:{x:Math.max(0,t.x-40),y:Math.max(0,t.y-4),width:Math.min(1120,t.width+80),height:t.height+80}})
      await page.screenshot({path:path.join(output,`mock-live-corner-${mode}-${skin}.png`),clip:{x:b.x-10,y:b.y+b.height-30,width:40,height:40}})
    }
    await page.evaluate(()=>{for(const id of ['kept-host','sash-left','sash-right','mock-group-hover']) document.getElementById(id).remove();run('enable')})
  })
  await check('inner bevel silhouette is identical at all four corners (mirrored rendered masks)',async()=>{
    // Classify each pixel of a 12x12 corner patch as content fill vs bevel,
    // mirror every corner onto top-left and compare the masks cell by cell.
    const K=12
    for(const mode of ['light','dark']) {
      // Hide scrollbars and row text only while sampling: glyphs at 8px padding
      // otherwise enter the 12px patch and read as "bevel".
      await page.evaluate(m=>{selectMode(m);run('enable');for(const s of ['#sessions-well','#pane-body .pane-layer'])document.querySelector(s).style.scrollbarWidth='none';const st=document.createElement('style');st.id='mask-probe';st.textContent='#sessions-well *{visibility:hidden}';document.head.append(st)},mode);await settle()
      for(const id of ['pane-body','sessions-well']) {
        // Snap each edge like the painter does; rounding height separately misplaces the bottom row.
        const q=await page.locator('#'+id).evaluate(e=>{const r=e.getBoundingClientRect(),x=Math.round(r.left),y=Math.round(r.top);return {x,y,width:Math.round(r.right)-x,height:Math.round(r.bottom)-y}})
        const fill=await page.locator(id==='pane-body'?'#pane-body .pane-layer':'#sessions-well').evaluate(e=>getComputedStyle(e).backgroundColor)
        const png=await page.screenshot({clip:q})
        const out=await page.evaluate(async({b,K,fill})=>{
          const img=new Image();img.src='data:image/png;base64,'+b;await img.decode()
          const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0)
          const f=fill.match(/\d+/g).map(Number),w=c.width,h=c.height
          const at=(a,y)=>{const d=x.getImageData(a,y,1,1).data;return Math.max(...[0,1,2].map(i=>Math.abs(d[i]-f[i])))<14}
          const maps={TL:(i,j)=>[i,j],TR:(i,j)=>[w-1-i,j],BL:(i,j)=>[i,h-1-j],BR:(i,j)=>[w-1-i,h-1-j]}
          const masks=Object.fromEntries(Object.entries(maps).map(([k,m])=>[k,Array.from({length:K},(_,j)=>Array.from({length:K},(_,i)=>at(...m(i,j))?1:0).join('')).join('/')]))
          // Side-by-side 8x enlargement of the four corners, mirrored to TL orientation.
          const z=8,o=document.createElement('canvas');o.width=4*K*z+30;o.height=K*z;const ox=o.getContext('2d');ox.imageSmoothingEnabled=false;ox.fillStyle='#fff';ox.fillRect(0,0,o.width,o.height)
          Object.values(maps).forEach((m,n)=>{for(let j=0;j<K;j++)for(let i=0;i<K;i++){const [a,y]=m(i,j),d=x.getImageData(a,y,1,1).data;ox.fillStyle=`rgb(${d[0]},${d[1]},${d[2]})`;ox.fillRect(n*(K*z+10)+i*z,j*z,z,z)}})
          return {masks,png:o.toDataURL().split(',')[1]}
        },{b:png.toString('base64'),K,fill})
        await writeFile(path.join(output,`mock-corner-masks-${id}-${mode}.png`),Buffer.from(out.png,'base64'))
        const diff=k=>[...out.masks[k]].filter((v,i)=>v!==out.masks.TL[i]).length
        const raw=await page.locator('#'+id).evaluate(e=>JSON.stringify(e.getBoundingClientRect()))
        for(const k of ['TR','BL','BR']) assert(diff(k)<=2,`${mode} ${id}: ${k} inner silhouette differs from TL by ${diff(k)} px ${raw}\n${JSON.stringify(out.masks,null,1)}`)
      }
      await page.evaluate(()=>{for(const s of ['#sessions-well','#pane-body .pane-layer'])document.querySelector(s).style.scrollbarWidth='';document.getElementById('mask-probe').remove()})
    }
  })
  await check('Sessions well inner bevel is rounded at all four corners, not an L at top-right/bottom-left',async()=>{
    // Offset-only inset shadows meet at a right angle at (w-3,3) and (3,h-3).
    // Overlay scrollbars on macOS expose the right band; hide the headless
    // classic scrollbar only while sampling (no geometry assertion depends on it).
    for(const mode of ['light','dark']) {
      await page.evaluate(m=>{selectMode(m);run('enable');const w=document.getElementById('sessions-well');w.scrollTop=40;w.style.scrollbarWidth='none'},mode);await settle()
      const q=await page.locator('#sessions-well').evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bg:getComputedStyle(e).backgroundColor}})
      const png=await page.screenshot({clip:q})
      const px=await page.evaluate(async({b,w,h})=>{const img=new Image();img.src='data:image/png;base64,'+b;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);return [[3,3],[w-4,3],[3,h-4],[w-4,h-4]].map(([a,y])=>`rgb(${[...x.getImageData(a,y,1,1).data].slice(0,3).join(', ')})`)},{b:png.toString('base64'),w:Math.round(q.width),h:Math.round(q.height)})
      for(const [i,c] of px.entries()) assert.notEqual(c,q.bg,`${mode}: square inner bevel corner ${['TL','TR','BL','BR'][i]}: ${px}`)
      assert.equal(await page.locator('#sessions-well').evaluate(e=>e.scrollTop),40,'scroll position preserved')
      await page.screenshot({path:path.join(output,`mock-sessions-well-${mode}.png`),clip:{x:q.x-4,y:q.y-4,width:q.width+8,height:q.height+8}})
      await page.evaluate(()=>{const w=document.getElementById('sessions-well');w.style.scrollbarWidth='';w.scrollTop=0})
    }
  })
  await check('Cmd+K scoped rim paints above opaque children; geometry, focus, typing, scroll and cleanup',async()=>{
    const palette=page.locator('#palette')
    const measure=()=>palette.evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e),input=e.querySelector('input'),list=e.querySelector('[data-slot="command-list"]');return {rect:[r.x,r.y,r.width,r.height],background:s.backgroundColor,color:s.color,border:s.borderWidth,radius:s.borderRadius,overflow:s.overflow,font:s.fontFamily,input:[input.clientWidth,input.clientHeight,getComputedStyle(input).outline],scroll:[list.clientHeight,list.scrollHeight,list.scrollWidth,list.scrollTop]}})
    const rim=locator=>locator.evaluate(e=>{const s=getComputedStyle(e,'::after');return {content:s.content,pointer:s.pointerEvents,z:s.zIndex,shadow:s.boxShadow}})
    const pixels=async()=>{
      const png=await palette.screenshot()
      return page.evaluate(async base64=>{const img=new Image();img.src='data:image/png;base64,'+base64;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return [[1,Math.floor(c.height/2)],[c.width-2,Math.floor(c.height/2)],[Math.floor(c.width/2),1],[Math.floor(c.width/2),c.height-2]].map(([x,y])=>[...ctx.getImageData(x,y,1,1).data])},png.toString('base64'))
    }
    for(const mode of ['light','dark']) {
      await page.evaluate(m=>{selectMode(m);run('disable')},mode);await settle()
      await page.keyboard.press('Control+k')
      assert(await palette.isVisible())
      assert.equal(await page.evaluate(()=>document.activeElement.id),'palette-input')
      await page.locator('#palette-input').fill('Generic search')
      await page.keyboard.press('ArrowLeft');await page.keyboard.type('!')
      assert.equal(await page.locator('#palette-input').inputValue(),'Generic searc!h')
      await page.locator('#palette [data-slot="command-list"]').evaluate(e=>e.scrollTop=60)
      const baseline=await measure(),off=await pixels()
      const unrelated=await Promise.all(['#unrelated-dialog','#unrelated-hud'].map(id=>rim(page.locator(id))))
      await page.evaluate(()=>run('enable'));await settle()
      assert.deepEqual(await measure(),baseline)
      assert.equal(await page.evaluate(()=>document.activeElement.id),'palette-input')
      const frame=await rim(palette)
      assert.equal(frame.pointer,'none');assert.equal(frame.z,'20');assert.notEqual(frame.content,'none')
      assert.notEqual(frame.shadow,'none')
      assert.deepEqual(await Promise.all(['#unrelated-dialog','#unrelated-hud'].map(id=>rim(page.locator(id)))),unrelated)
      const on=await pixels()
      for(let i=0;i<4;i++) assert.notDeepEqual(on[i],off[i],`${mode} rim edge ${i} must be visible over opaque children`)
      // Verify the actual painted edge remains distinct from the unchanged fill.
      const lum=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0)
      for(let i=0;i<4;i++){const a=lum(on[i]),b=lum(off[i]);assert((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=3,`${mode} edge ${i} contrast: ${JSON.stringify({on,off})}`)}
      await page.locator('#palette-input').click();await page.keyboard.press('End');await page.keyboard.type('x')
      assert.equal(await page.locator('#palette-input').inputValue(),'Generic searc!hx')
      await page.screenshot({path:path.join(output,`mock-palette-${mode}.png`),fullPage:true})
      await page.evaluate(()=>run('disable'));await settle()
      assert.deepEqual(await measure(),baseline)
      assert.equal((await rim(palette)).content,'none')
      assert.deepEqual(await pixels(),off)
      await page.keyboard.press('Escape');assert(!(await palette.isVisible()))
    }
    await page.evaluate(()=>run('enable'))
  })
  await check('Retroma skin bevels stay lavender rather than cyan; fills and native focus remain intact',async()=>{
    for(const mode of ['light','dark']) {
      await page.evaluate(m=>selectMode(m),mode);await page.evaluate(()=>run('enable'));await settle();
      const result=await page.evaluate(()=>{
        const root=getComputedStyle(document.documentElement),ctx=document.createElement('canvas').getContext('2d');
        const rgb=value=>{ctx.fillStyle=value;ctx.fillRect(0,0,1,1);return Array.from(ctx.getImageData(0,0,1,1).data).slice(0,3)};
        // Resolve custom property colors via a real element; var() cannot be
        // resolved by a canvas fillStyle setter directly.
        const probe=document.createElement('span');document.body.append(probe);
        const values=['--retroma-light','--retroma-shade'].map(v=>{probe.style.color=`var(${v})`;return rgb(getComputedStyle(probe).color)});probe.remove();
        return {values,panel:getComputedStyle(document.getElementById('panel')).backgroundColor,header:getComputedStyle(document.getElementById('titlebar')).boxShadow};
      });
      for(const c of result.values) assert(c[0]>c[1] && c[2]>c[0],`${mode}: bevel must be lavender, not cyan: ${c}`);
      assert.equal(result.panel,mode==='light'?'rgb(222, 251, 255)':'rgb(23, 46, 54)','content fill unchanged');
      await page.locator('#titlebar').screenshot({path:path.join(output,`mock-bevel-${mode}.png`)});
    }
  });
  await check('light/dark roles, opaque completion popup even with translucent token',async()=>{
    for(const mode of ['light','dark']) {
      await page.evaluate(m=>selectMode(m),mode);await settle()
      const colors=await page.evaluate(()=>['panel','sidebar','titlebar','heading'].map(id=>getComputedStyle(document.getElementById(id)).getPropertyValue(id==='heading'?'color':'background-color')))
      assert.deepEqual(colors,mode==='light'?['rgb(222, 251, 255)','rgb(198, 185, 233)','rgb(198, 185, 233)','rgb(164, 72, 58)']:['rgb(23, 46, 54)','rgb(61, 52, 86)','rgb(61, 52, 86)','rgb(240, 156, 131)'])
      await page.evaluate(async()=>{document.documentElement.style.setProperty('--dt-popover','rgba(100,80,140,.2)');await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))})
      assert.equal(await page.locator('#popup').evaluate(e=>getComputedStyle(e).backgroundColor),'color(srgb 0.392157 0.313726 0.54902)')
      await page.evaluate(()=>document.documentElement.style.removeProperty('--dt-popover'))
      await settle()
      await page.screenshot({path:path.join(output,`mock-${mode}.png`),fullPage:true})
    }
  })
  await check('top-edge titlebar chrome: left spacer, center gutter and right spacer share one lavender fill',async()=>{
    for(const mode of ['light','dark']) {
      await page.evaluate(m=>selectMode(m),mode);await settle()
      // Spacers and the strip are transparent by design (source tree-group.tsx):
      // they SHOW the header fill. Effective paint = own bg, else nearest
      // ancestor fill inside the header — what the eye actually sees.
      const paints=await page.evaluate(()=>['titlebar-left','titlebar-strip','titlebar-right'].map(id=>{
        let e=document.getElementById(id)
        const header=document.getElementById('titlebar')
        while(e && e!==header.parentElement){
          const bg=getComputedStyle(e).backgroundColor
          if(bg && bg!=='rgba(0, 0, 0, 0)') return bg
          e=e.parentElement
        }
        return 'unpainted'
      }))
      assert.ok(paints.every(f=>f===paints[0]),`top chrome layers diverge in ${mode}: ${paints.join(' | ')}`)
      // The unified fill must be the lavender sidebar seed, not the old accent-soft mauve.
      assert.equal(paints[0],mode==='light'?'rgb(198, 185, 233)':'rgb(61, 52, 86)',mode)
      // A non-top-edge zone keeps the source defaults: strip on sidebar, active tab on editor surface.
      const below=await page.evaluate(()=>['panel','sidebar'].map(id=>getComputedStyle(document.getElementById(id)).backgroundColor))
      assert.notDeepEqual(below,[paints[0],paints[0]],'top fill must not bleed into body/sidebar roles')
    }
  })
  await check('tabs alone have subtle tint, stronger active tint and preserved underline',async()=>{
    for(const mode of ['light','dark']) {
      await page.evaluate(m=>selectMode(m),mode);await settle();
      const t=await page.evaluate(()=>{
        const rgb=e=>{const ctx=document.createElement('canvas').getContext('2d');ctx.fillStyle=getComputedStyle(e).backgroundColor;ctx.fillRect(0,0,1,1);return Array.from(ctx.getImageData(0,0,1,1).data).slice(0,3)};
        return {active:rgb(document.getElementById('tab-active')),idle:rgb(document.getElementById('tab-idle')),bar:rgb(document.getElementById('titlebar')),shadow:getComputedStyle(document.getElementById('tab-active')).boxShadow};
      });
      const distance=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
      assert(distance(t.idle,t.bar)>=5 && distance(t.idle,t.bar)<=20,`${mode}: idle tab subtle contrast`);
      assert(distance(t.active,t.bar)>distance(t.idle,t.bar) && distance(t.active,t.bar)<=32,`${mode}: active tab stronger contrast`);
      assert.notEqual(t.shadow,'none');
      assert(mode==='light'?t.idle[0]<t.bar[0]:t.idle[0]>t.bar[0]);
      const tabIds=['tab-idle','tab-bot-a','tab-bot-b'];
      const inspect=id=>page.locator('#'+id).evaluate(e=>{
        const s=getComputedStyle(e),line=getComputedStyle(e,'::after'),r=e.getBoundingClientRect();
        return {bg:s.backgroundColor,shadow:s.boxShadow,line:line.backgroundColor,width:line.width,content:line.content,pointer:line.pointerEvents,rect:[r.x,r.y,r.width,r.height]};
      });
      await page.mouse.move(0,0);await settle();
      const resting=await Promise.all(tabIds.map(inspect));
      assert(resting.every(s=>s.bg===resting[0].bg),'Terminal and bot idle tabs must match');
      assert(resting.every(s=>s.content==='""' && s.width==='1px' && s.pointer==='none'),'every tab needs a non-interactive divider');
      const hovered=[];
      for(const id of tabIds){await page.locator('#'+id).hover();await settle();hovered.push(await inspect(id));}
      assert(hovered.every(s=>s.bg===hovered[0].bg && s.shadow===hovered[0].shadow),'same hover treatment for Terminal and bots');
      assert.deepEqual(hovered.map(s=>s.rect),resting.map(s=>s.rect),'hover must not move tabs');
      await page.mouse.move(0,0);await settle();
      await page.locator('#titlebar').screenshot({path:path.join(output,`mock-tabs-${mode}.png`)});
    }
  });
  await check('collapsed top-edge rail cap matches titlebar without recoloring expanded content',async()=>{
    // tree-group's vertical-collapse branch omits data-panel-header and reserves
    // the control band as padding on the editor-colored group itself.
    await page.evaluate(()=>{
      const cap=document.createElement('div');cap.id='collapsed-cap';cap.dataset.treeGroup='mock-collapsed';cap.dataset.windowTop='true';
      cap.style.cssText='position:fixed;right:0;top:0;width:28px;height:140px;padding-top:44px;border-radius:0 16px 0 0;z-index:300';
      cap.innerHTML='<div style="height:100%;background:var(--ui-sidebar-surface-background)"><div role="tablist"><div data-tree-tab="mock-schedule" data-vertical="true" style="writing-mode:vertical-rl;padding:8px">Scheduled tasks</div></div></div>';
      document.body.append(cap);
    });
    for(const mode of ['light','dark']) {
      await page.evaluate(m=>selectMode(m),mode);await settle();
      const actual=await page.evaluate(()=>{
        const cap=document.getElementById('collapsed-cap'),style=getComputedStyle(cap);
        return {cap:style.backgroundColor,header:getComputedStyle(document.getElementById('titlebar')).backgroundColor,body:getComputedStyle(document.getElementById('panel')).backgroundColor,padding:style.paddingTop,width:cap.getBoundingClientRect().width};
      });
      assert.equal(actual.cap,actual.header,`${mode}: collapsed rail leaves a mismatched corner cap`);
      assert.notEqual(actual.body,actual.cap,'expanded content must keep its editor fill');
      assert.equal(actual.padding,'44px');assert.equal(actual.width,28);
      await page.screenshot({path:path.join(output,`mock-corner-${mode}.png`),clip:{x:1024,y:0,width:96,height:140}});
      await page.evaluate(()=>document.getElementById('collapsed-cap').removeAttribute('data-window-top'));await settle();
      assert.equal(await page.locator('#collapsed-cap').evaluate(e=>getComputedStyle(e).backgroundColor),actual.body,'non-top rail must retain host fill');
      await page.evaluate(()=>document.getElementById('collapsed-cap').dataset.windowTop='true');
    }
    await page.evaluate(()=>document.getElementById('collapsed-cap').remove());
  });
  await check('real navigation IDs: rainbow fills, input contrast, selection, focus and status isolation',async()=>{
    const ids=['nav-new-session','nav-skills','nav-messaging','nav-artifacts','nav-cron','profile-button','bot-one']
    const lightExpected=['rgb(255, 224, 218)','rgb(255, 232, 198)','rgb(244, 243, 185)','rgb(206, 239, 214)','rgb(198, 244, 249)','rgb(218, 232, 255)','rgb(236, 221, 246)']
    const darkExpected=['rgb(73, 49, 58)','rgb(73, 59, 45)','rgb(65, 67, 43)','rgb(41, 68, 61)','rgb(37, 67, 77)','rgb(48, 63, 91)','rgb(68, 54, 83)']
    const styles=id=>page.locator('#'+id).evaluate(e=>{const s=getComputedStyle(e);const rgb=v=>{const c=document.createElement('canvas');c.width=c.height=1;const ctx=c.getContext('2d');ctx.fillStyle=v;ctx.fillRect(0,0,1,1);const d=ctx.getImageData(0,0,1,1).data;return `rgb(${d[0]}, ${d[1]}, ${d[2]})`};return {bg:rgb(getComputedStyle(s.backgroundColor==='rgba(0, 0, 0, 0)'?e.parentElement:e).backgroundColor),ink:rgb(s.color),shadow:s.boxShadow,outline:s.outlineStyle,edge:rgb(s.outlineColor),border:s.borderColor}})
    const contrast=(a,b)=>{const lum=s=>{const c=s.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return c[0]*.2126+c[1]*.7152+c[2]*.0722};const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
    for (const mode of ['light','dark']) {
      await page.evaluate(m=>selectMode(m),mode); await settle()
      const expected=mode==='light'?lightExpected:darkExpected
      await page.mouse.move(1100,0)
      for (const skin of ['disable','enable']) {
        await page.evaluate(s=>run(s),skin); await settle()
        for(let i=0;i<ids.length;i++) {const s=await styles(ids[i]);if(!['nav-artifacts','bot-one'].includes(ids[i])) assert.equal(s.bg,expected[i]);assert(contrast(s.bg,s.ink)>=4.5,`${mode} ${ids[i]}`);assert(contrast(s.bg,s.edge)>=3,`${mode} ${ids[i]} edge`)}
        for(const id of ['input','composer','composer-surface']) {
          const s=await styles(id); assert.equal(s.bg,mode==='light'?'rgb(255, 243, 214)':'rgb(38, 63, 61)');
          assert.notEqual(s.bg,(await styles('panel')).bg);if(id==='input') assert(contrast(s.bg,s.border)>=3,'input border')
          if(id!=='composer-surface') assert(contrast(s.bg,s.ink)>=4.5,id)
        }
        for(const id of ['bot-detail','bot-age']) assert(contrast((await styles('bot-one')).bg,(await styles(id)).ink)>=4.5,id)
        // Pointer hover must change only enabled rows, preserve selection, and remain readable.
        for(const id of ids) {
          const normal=await styles(id)
          await page.locator('#'+id).hover(); await page.waitForTimeout(150)
          const hover=await styles(id)
          assert.notEqual(hover.bg,normal.bg,`${mode} ${skin} ${id} hover`)
          assert(contrast(hover.bg,hover.ink)>=4.5,`${id} hover contrast`)
          assert.equal(hover.shadow,normal.shadow,`${id} selection preserved on hover`)
          await page.mouse.move(1100,0); await page.waitForTimeout(150)
          assert.equal((await styles(id)).bg,normal.bg,`${id} hover restores`)
        }
        await page.locator('#nav-skills').evaluate(e=>e.setAttribute('aria-disabled','true'))
        const inactive=await styles('nav-skills');await page.locator('#nav-skills').hover();await page.waitForTimeout(150)
        assert.equal((await styles('nav-skills')).bg,inactive.bg)
        await page.locator('#nav-skills').evaluate(e=>e.setAttribute('aria-disabled','false'));await page.mouse.move(1100,0);await page.waitForTimeout(150)
        // Selection follows the source class / Radix open state, without event handlers.
        for(const [id,key] of [['nav-skills','bg-(--ui-control-active-background)'],['bot-two','bg-(--ui-row-active-background)'],['profile-button',null]]) {
          const normal=await styles(id)
          await page.locator('#'+id).evaluate((e,k)=>k?e.classList.add(k):e.setAttribute('data-state','open'),key);await settle()
          const selected=await styles(id)
          assert.notEqual(selected.shadow,normal.shadow);assert.notEqual(selected.bg,normal.bg)
          assert(contrast(selected.bg,selected.ink)>=4.5,`${id} selected contrast`)
          await page.locator('#'+id).evaluate((e,k)=>k?e.classList.remove(k):e.setAttribute('data-state','closed'),key);await settle()
          assert.deepEqual(await styles(id),normal)
        }
        assert.notEqual((await styles('nav-artifacts')).shadow,'none')
        assert.notEqual((await styles('bot-one')).shadow,(await styles('bot-two')).shadow)
      }
      const status=await styles('bot-status')
      await page.evaluate(()=>document.documentElement.dataset.hermesTheme='other'); await settle()
      assert.equal((await styles('bot-status')).bg,status.bg)
      assert.notEqual((await styles('nav-new-session')).bg,expected[0])
      assert.notEqual((await styles('input')).bg,mode==='light'?'rgb(255, 243, 214)':'rgb(38, 63, 61)')
      await page.evaluate(m=>selectMode(m),mode); await settle()
    }
    // Reorder/rename mock labels and roster keys: category mapping never reads them.
    await page.evaluate(()=>{const e=document.querySelector('#nav-skills');e.querySelector('span').textContent='Generic translated label';e.parentElement.parentElement.prepend(e.parentElement);document.querySelector('#bot-one').dataset.rosterKey='mock-renamed'})
    assert.equal((await styles('nav-skills')).bg,darkExpected[1]);assert.notEqual((await styles('bot-one')).bg,darkExpected[6])
    await page.locator('#nav-artifacts').focus();await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'nav-cron')
    assert.equal((await styles('nav-cron')).outline,'solid')
    await page.locator('#input').focus(); await page.waitForTimeout(250); const focus=await styles('input')
    await page.evaluate(()=>run('disable'));await settle();assert.equal((await styles('input')).border,focus.border)
    await page.evaluate(()=>{document.querySelector('#input').setAttribute('aria-invalid','true')});await page.waitForTimeout(250)
    const invalid=await styles('input');assert.notEqual(invalid.border,focus.border)
    await page.evaluate(()=>{run('enable');document.querySelector('#input').disabled=true});await settle()
    assert(await page.locator('#input').isDisabled());assert.equal((await styles('input')).border,invalid.border)
    await page.evaluate(()=>{document.querySelector('#input').disabled=false;document.querySelector('#input').removeAttribute('aria-invalid')})
    await page.locator('#bot-one').evaluate(e=>e.classList.remove('bg-(--ui-row-active-background)'));await settle()
    assert.equal((await styles('bot-one')).shadow,(await styles('bot-two')).shadow)
  })
  const contrastReport=[]
  await check('all colored text roles and real placeholders meet 4.5:1 in both modes',async()=>{
    for(const mode of ['light','dark']) for(const skin of ['disable','enable']) {
      await page.evaluate(({mode,skin})=>{selectMode(mode);run(skin);document.querySelector('#composer').setAttribute('data-empty','true')},{mode,skin});await page.waitForTimeout(250);await settle()
      const roles=await page.evaluate(()=>{
        const rgb=v=>{const c=document.createElement('canvas');c.width=c.height=1;const x=c.getContext('2d');x.fillStyle=v;x.fillRect(0,0,1,1);return [...x.getImageData(0,0,1,1).data].slice(0,3)}
        const lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0)
        return [['heading','panel'],['titlebar','titlebar'],['panel','panel'],['sidebar','sidebar'],['bot-toolbar','sidebar'],['action','action'],['code','code'],['terminal','terminal'],['popup','popup'],['input','input'],['composer','composer-surface'],['composer-surface','composer-surface'],['input','input','::placeholder'],['composer','composer-surface','::before']].map(([id,bg,pseudo])=>{
          const st=getComputedStyle(document.getElementById(id),pseudo),back=rgb(getComputedStyle(document.getElementById(bg)).backgroundColor),fore=rgb(st.color),alpha=Number(st.opacity)
          const a=lum(fore.map((v,i)=>v*alpha+back[i]*(1-alpha))),b=lum(back)
          return {role:id+(pseudo||''),foreground:st.color,background:getComputedStyle(document.getElementById(bg)).backgroundColor,opacity:alpha,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)}
        })
      })
      const palette=mode==='light'?themeModule.theme.colors:themeModule.theme.darkColors
      for(const [bg,fg] of [['background','foreground'],['card','cardForeground'],['muted','mutedForeground'],['popover','popoverForeground'],['primary','primaryForeground'],['secondary','secondaryForeground'],['accent','accentForeground'],['midground','midgroundForeground'],['destructive','destructiveForeground'],['sidebarBackground','foreground'],['userBubble','foreground']]) {
        const lum=hex=>hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0)
        const a=lum(palette[bg]),b=lum(palette[fg]);roles.push({role:`palette ${fg}/${bg}`,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)})
      }
      for(const role of roles) assert(role.ratio>=4.5,`${mode} ${skin} ${role.role}: ${JSON.stringify(role)}`)
      contrastReport.push({mode,skin,roles})
      await page.locator('#composer').evaluate(e=>e.removeAttribute('data-empty'))
    }
    await writeFile(path.join(output,'contrast.json'),JSON.stringify(contrastReport,null,2))
  })
  await check('keyboard focus, text input, contenteditable, disabled and pressed controls',async()=>{
    await page.locator('#action').focus()
    await page.keyboard.press('Tab')
    assert.equal(await page.evaluate(()=>document.activeElement.id),'input')
    await page.locator('#input').fill('Generic sample')
    assert.equal(await page.locator('#input').inputValue(),'Generic sample')
    const focusSkin=await page.locator('#input').evaluate(e=>getComputedStyle(e).boxShadow)
    await page.evaluate(()=>run('disable'))
    await settle()
    assert.equal(await page.locator('#input').evaluate(e=>getComputedStyle(e).boxShadow),focusSkin)
    await page.evaluate(()=>run('enable'))
    await page.locator('#composer').fill('Editable mock message')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.type('!')
    assert.equal(await page.locator('#composer').innerText(),'Editable mock messag!e')
    assert(await page.locator('#disabled').isDisabled())
    const normal=await page.locator('#action').evaluate(e=>getComputedStyle(e).boxShadow)
    await page.locator('#action').evaluate(e=>e.setAttribute('aria-pressed','true'))
    await settle()
    assert.notEqual(await page.locator('#action').evaluate(e=>getComputedStyle(e).boxShadow),normal)
    await page.locator('#action').evaluate(e=>e.removeAttribute('aria-pressed'))
  })
  await check('theme switch scopes colors; skin works independently; toggle and dispose restore',async()=>{
    await page.evaluate(()=>{document.documentElement.dataset.hermesTheme='other';run('disable')})
    await settle()
    const baseline=await page.locator('#action').evaluate(e=>getComputedStyle(e).boxShadow)
    assert.notEqual(await page.locator('#heading').evaluate(e=>getComputedStyle(e).color),'rgb(240, 156, 131)')
    await page.evaluate(()=>run('toggle'))
    await settle()
    assert.notEqual(await page.locator('#action').evaluate(e=>getComputedStyle(e).boxShadow),baseline)
    await page.evaluate(()=>run('toggle'))
    await settle()
    assert.equal(await page.locator('#action').evaluate(e=>getComputedStyle(e).boxShadow),baseline)
    await page.evaluate(()=>{const staleEnable=contributions.find(c=>c.id==='enable').data.run;run('enable');skinDispose();skinDispose();staleEnable()})
    assert.equal(await page.locator('style[data-retroma-tactile]').count(),0)
    assert.equal(await page.locator('#palette').evaluate(e=>getComputedStyle(e,'::after').content),'none')
    const notificationsAfterDispose=await page.evaluate(()=>notifications.length)
    await page.evaluate(()=>skinDispose())
    assert.equal(await page.evaluate(()=>notifications.length),notificationsAfterDispose)
    await page.evaluate(()=>{selectMode('light');themeDispose()})
    await settle()
    assert.notEqual(await page.locator('#nav-artifacts').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(206, 239, 214)')
    assert.equal(await page.locator('#nav-artifacts').evaluate(e=>getComputedStyle(e).boxShadow),'none')
    assert.notEqual(await page.locator('#composer').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 243, 214)')
    assert.equal(await page.locator('style[data-retroma-colors]').count(),0)
    assert.equal(await page.evaluate(()=>contributions.length),0)
    await page.evaluate(()=>registerPlugins())
    assert.equal(await page.locator('style[data-retroma-tactile]').count(),0)
    assert.equal(await page.locator('style[data-retroma-colors]').count(),1)
  })
  await check('model-settings stale-aux warning and error notice: compiled host cascade, >=4.5:1 both modes, no leakage',async()=>{
    const w=await browser.newPage({viewport:{width:940,height:220}})
    w.on('pageerror',e=>errors.push(e.message))
    await w.goto(`http://127.0.0.1:${server.address().port}/warning.html`);await w.waitForFunction(()=>window.ready)
    const text=['warn-text','warn-mono','warn-reset','err-text','err-restart']
    const all=()=>w.evaluate(ids=>ids.map(id=>measure(id)),[...text,'warn-icon'])
    const cosmic={name:'cosmic',label:'Cosmic MOCK',colors:{...(await w.evaluate(()=>retroma.colors)),background:'#f3f0ff',card:'#f3f0ff'},darkColors:{...(await w.evaluate(()=>retroma.darkColors)),background:'#0d0b1f',card:'#0d0b1f'}}
    const report=[]
    const ours=()=>w.evaluate(()=>{const e=document.getElementById('warn'),p=document.createElement('span');document.body.append(p);p.style.color='var(--retroma-orange-ink)';const ink=getComputedStyle(p).color;p.style.color='var(--retroma-orange-fill)';const fill=getComputedStyle(p).color;p.remove();const s=getComputedStyle(e);return {color:s.color,bg:s.backgroundColor,ink,fill,theme:document.documentElement.dataset.hermesTheme,dark:document.documentElement.classList.contains('dark')}})
    for(const mode of ['light','dark']) {
      await w.evaluate(m=>paint(retroma,m),mode)
      const own=await ours()
      assert.equal(own.theme,'retroma');assert.equal(own.dark,mode==='dark','host .dark variant follows mode')
      // Ownership: the Retroma rule, not the source utility, now wins the cascade.
      assert.equal(own.color,own.ink,`${mode}: warning ink comes from Retroma`);assert.equal(own.bg,own.fill)
      const fixed=await all()
      for(const m of fixed.filter(m=>text.includes(m.id))) assert(m.ratio>=4.5,`${mode} ${m.id}: ${JSON.stringify(m)}`)
      assert(fixed.find(m=>m.id==='warn-icon').ratio>=3,`${mode} icon`)
      assert.equal(fixed.find(m=>m.id==='err-text').color,await w.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--dt-destructive').trim()).then(v=>w.evaluate(v=>{const p=document.createElement('span');p.style.color=v;document.body.append(p);const c=getComputedStyle(p).color;p.remove();return c},v)),'error keeps the destructive token')
      await w.locator('#warn-reset').hover();const hover=await w.evaluate(()=>measure('warn-reset'));assert(hover.ratio>=4.5,`${mode} reset hover ${JSON.stringify(hover)}`);await w.mouse.move(930,210)
      await w.locator('#surface').screenshot({path:path.join(output,`mock-warning-${mode}.png`)})
      // Same page with only the Retroma colour sheet muted: reproduces the report.
      await w.evaluate(()=>document.querySelector('style[data-retroma-colors]').media='not all')
      const before=await all()
      await w.locator('#surface').screenshot({path:path.join(output,`mock-warning-${mode}-before.png`)})
      if(mode==='light') assert(before.find(m=>m.id==='warn-text').ratio<2,'fixture must reproduce the unreadable amber-200 text: '+JSON.stringify(before[0]))
      await w.evaluate(()=>document.querySelector('style[data-retroma-colors]').media='')
      // Switching to another theme restores the source utilities exactly.
      await w.evaluate(({c,m})=>paint(c,m),{c:cosmic,m:mode})
      const other=await ours(),otherAll=await all()
      assert.equal(other.theme,'cosmic');assert.notEqual(other.color,own.ink);assert.notEqual(other.bg,own.fill)
      assert.deepEqual(otherAll.find(m=>m.id==='warn-text').color,before.find(m=>m.id==='warn-text').color,'cosmic gets the native amber-200, no Retroma leakage')
      await w.locator('#surface').screenshot({path:path.join(output,`mock-warning-${mode}-cosmic.png`)})
      report.push({mode,fixed,before,cosmic:otherAll})
    }
    await w.evaluate(()=>{paint(retroma,'light');themeDispose()})
    assert.equal(await w.locator('style[data-retroma-colors]').count(),0)
    assert.notEqual(await w.evaluate(()=>getComputedStyle(document.getElementById('warn')).color),(await ours()).ink,'dispose removes the override')
    await writeFile(path.join(output,'warning-contrast.json'),JSON.stringify(report,null,2))
    for(const r of report) console.log(`  ${r.mode}: `+r.fixed.map(m=>`${m.id} ${m.ratio}`).join(', ')+` | before warn-text ${r.before[0].ratio} | cosmic warn-text ${r.cosmic[0].ratio}`)
    await w.close()
  })
  await check('narrow viewport and reduced motion: no added horizontal overflow',async()=>{
    await page.setViewportSize({width:520,height:800})
    await page.evaluate(()=>{selectMode('light');run('enable')})
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
    assert.deepEqual(errors,[])
  })
  await writeFile(path.join(output,'results.json'),JSON.stringify({kind:'MOCK partial integration; not live Hermes',passed:results,errors},null,2))
} finally {await browser.close();await new Promise(r=>server.close(r))}
console.log('Preview: test/retroma/.local/index.html (serve this directory over HTTP)')
