/**
 * theme-studio swatch preview — renders the ACTUAL generated palettes
 * (user's exact seeds: base #9B68C5, primary #EFA3B6, secondary #4044BF)
 * as a mock app layout (sidebar, chat, cards, buttons, composer, selected
 * row, user bubbles) in BOTH light and dark, then screenshots it.
 *
 * Usage: CHROMIUM_PATH=... node swatch-preview.mjs [out.png]
 */
import { chromium } from 'playwright-core'
import { readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'

const outPath = process.argv[2] || fileURLToPath(new URL('./swatch-preview.png', import.meta.url))
const source = readFileSync(fileURLToPath(new URL('../../plugins/theme-studio/plugin.js', import.meta.url)), 'utf8')
const read = p => readFileSync(new URL(p, import.meta.url))

const srv = createServer((req, res) => {
  const p = new URL(req.url, 'http://x').pathname
  let body, ct = 'text/javascript'
  if (p === '/sdk-stub.mjs') body = read('./sdk-stub.mjs')
  else if (p === '/shims/react.esm.js') body = read('./shims/react.esm.js')
  else if (p === '/shims/jsx-runtime.esm.js') body = read('./shims/jsx-runtime.esm.js')
  else if (p === '/shims/react-dom-client.esm.js') body = read('./shims/react-dom-client.esm.js')
  else if (p === '/index.html' || p === '/') { body = read('./index.html'); ct = 'text/html' }
  else if (p === '/plugin.js') body = source
  else { res.writeHead(404); res.end('nope'); return }
  res.writeHead(200, { 'content-type': ct }); res.end(body)
})
await new Promise(r => srv.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${srv.address().port}`

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true })
const page = await browser.newPage({ viewport: { width: 1500, height: 1240 } })
await page.goto(base + '/')
await page.waitForFunction(() => window.__warmupDone === true, null, { timeout: 10000 })

const palettes = await page.evaluate(async () => {
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
  setSelect(document.querySelector('select[data-role="gen-mode"]'), 'multi3')
  await new Promise(r => setTimeout(r, 30))
  setInput(document.querySelector('input[data-seed-role="base"]'), '#9B68C5')
  setInput(document.querySelector('input[data-seed-role="primary"]'), '#EFA3B6')
  setInput(document.querySelector('input[data-seed-role="secondary"]'), '#4044BF')
  const btn = [...document.querySelectorAll('button')].find(b => /Generate light \+ dark/.test(b.textContent || ''))
  btn.click()
  await new Promise(r => setTimeout(r, 80))
  return { light: lastThemeData.colors, dark: lastThemeData.darkColors }
})
await browser.close()
srv.close()
writeFileSync(fileURLToPath(new URL('./swatch-palettes.json', import.meta.url)), JSON.stringify(palettes, null, 2))

// Render the mock app with plain HTML/CSS from the generated tokens.
const panel = (p, label) => {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  return `
  <div style="flex:1;background:${p.background};border-radius:10px;overflow:hidden;font-family:-apple-system,Segoe UI,sans-serif;border:1px solid ${p.border};min-width:0">
    <div style="display:flex;height:560px">
      <div style="width:190px;background:${p.sidebarBackground};border-right:1px solid ${p.sidebarBorder};padding:12px 10px;display:flex;flex-direction:column;gap:4px">
        <div style="font-weight:700;font-size:13px;color:${p.midground};margin-bottom:8px">Hermes</div>
        ${['Sessions', 'Bots', 'Cron', 'Files', 'Theme Studio'].map((n, i) => `
          <div style="padding:6px 8px;border-radius:6px;font-size:12px;${i === 4
            ? `background:${p.accent};color:${p.midground};font-weight:600`
            : `color:${p.mutedForeground}`}${i === 4 ? '' : ''}">${n}</div>`).join('')}
        <div style="margin-top:auto;font-size:10px;color:${p.mutedForeground}">sidebar · nav · selected row</div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;min-width:0">
        <div style="padding:10px 14px;border-bottom:1px solid ${p.border};color:${p.foreground};font-size:13px;font-weight:600">Conversation — ${label}</div>
        <div style="flex:1;padding:12px 14px;display:flex;flex-direction:column;gap:10px">
          <div style="align-self:flex-end;max-width:70%;background:${p.userBubble};border:1px solid ${p.userBubbleBorder};color:${p.foreground};padding:8px 10px;border-radius:12px 12px 3px 12px;font-size:12px">user bubble — secondary family fill + border</div>
          <div style="max-width:80%;color:${p.foreground};font-size:12px;line-height:1.5">assistant reply on the app background — body text keeps its own pairing with this surface.</div>
          <div style="background:${p.card};border:1px solid ${p.border};border-radius:8px;padding:10px;color:${p.cardForeground};font-size:12px">
            <div style="font-weight:600;margin-bottom:4px">Card / pane</div>
            <span style="color:${p.mutedForeground}">muted text on card</span>
          </div>
          <div style="background:${p.popover};border:1px solid ${p.border};border-radius:8px;padding:8px 10px;color:${p.popoverForeground};font-size:12px;width:220px">Popover / menu surface</div>
          <div style="display:flex;gap:8px;align-items:center">
            <span style="background:${p.primary};color:${p.primaryForeground};padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600">Primary button</span>
            <span style="background:${p.secondary};color:${p.secondaryForeground};padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600">Secondary button</span>
            <span style="background:${p.destructive};color:${p.destructiveForeground};padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600">Delete</span>
          </div>
        </div>
        <div style="padding:10px 14px">
          <div style="border:1.5px solid ${p.composerRing};border-radius:8px;padding:8px 10px;background:${p.input};color:${p.foreground};font-size:12px">composer — focus ring <span style="color:${p.mutedForeground}">· input surface</span></div>
        </div>
      </div>
    </div>
  </div>`
}

const html = `<!doctype html><html><body style="margin:0;background:#888;padding:14px;display:flex;gap:14px">
${panel(palettes.light, 'LIGHT')}${panel(palettes.dark, 'DARK')}
</body></html>`

const tmp = fileURLToPath(new URL('./swatch.html', import.meta.url))
writeFileSync(tmp, html)
const b2 = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true })
const p2 = await b2.newPage({ viewport: { width: 1500, height: 620 }, deviceScaleFactor: 2 })
await p2.goto('file://' + tmp)
await new Promise(r => setTimeout(r, 300))
await p2.screenshot({ path: outPath, fullPage: true })
await b2.close()
console.log('SWATCH_PNG=' + outPath)
console.log('PALETTES_JSON=' + fileURLToPath(new URL('./swatch-palettes.json', import.meta.url)))
