// Bounded Exchanges: loader, registration and render/interaction tests.
//
// PARTIAL INTEGRATION, not live Desktop evidence:
//  * REAL: the uncompiled plugin.js, the Desktop checkout's runtime-loader import allowlist and
//    specifier rewrite, its sdk/runtime.ts shim-module builder, React 19 + react-dom in Chromium,
//    and a UI fixture produced by the real bounded-events read model on a disposable root.
//  * STUBBED: every @hermes/plugin-sdk export (sdk-stub.mjs), the registry `ctx`, and `host`.
// Needs: HERMES_DESKTOP_SRC (apps/desktop/src), BOUNDED_EVENTS_SRC (repo root), CHROMIUM_PATH.
// Uses only dependencies already installed for test/theme-studio. Writes nothing in the repo.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '../..')
const deps = path.resolve(here, '../theme-studio')
const require = createRequire(path.join(deps, 'package.json'))
const esbuild = require('esbuild')
const { chromium } = require('playwright-core')

// Each input is an env var or the equivalent flag: --desktop-src, --bounded-src, --chromium.
const flag = name => {
  const i = process.argv.indexOf(name)
  return i > 0 ? process.argv[i + 1] : undefined
}
const desktopSrc = process.env.HERMES_DESKTOP_SRC || flag('--desktop-src')
const boundedSrc = process.env.BOUNDED_EVENTS_SRC || flag('--bounded-src')
const chromiumPath = process.env.CHROMIUM_PATH || flag('--chromium')
assert(desktopSrc, 'Set HERMES_DESKTOP_SRC to the Desktop apps/desktop/src directory')
assert(boundedSrc, 'Set BOUNDED_EVENTS_SRC to the hermes-bounded-events checkout')
assert(chromiumPath, 'Set CHROMIUM_PATH to a Chromium binary')

const results = []
const consoleErrors = []
const check = async (name, fn) => {
  try {
    await fn()
  } catch (error) {
    console.error('FAIL -', name, '\nbrowser errors:', consoleErrors.join('\n') || '(none)')
    throw error
  }
  results.push(name)
  console.log('ok -', name)
}

// ------------------------------------------------------------- fixture (real read model)
const fixture = JSON.parse(
  execFileSync('python3', ['-B', path.join(here, 'gen-fixture.py')], {
    env: { PATH: '/usr/bin:/bin', PYTHONPATH: boundedSrc, PYTHONDONTWRITEBYTECODE: '1', TMPDIR: process.env.TMPDIR || '/tmp' },
    encoding: 'utf8'
  })
)
await check('fixture comes from the real read model and is labeled read-only', () => {
  assert.equal(fixture.all.ok, true)
  assert.equal(fixture.all.data.kind, 'bounded-events.exchanges')
  assert.equal(fixture.all.data.read_only, true)
  assert.equal(fixture.all.data.exchanges.length, 2)
  assert.ok(fixture.all.data.page.next_cursor)
  assert.equal(fixture.error.ok, false)
  assert.equal(fixture.error.error.reason, 'recipient_mismatch')
})

// ------------------------------------------------------------ loader contract (Node)
const pluginPath = path.join(repo, 'plugins/bounded-exchanges/plugin.js')
const pluginSource = await readFile(pluginPath, 'utf8')
const loaderSource = await readFile(path.join(desktopSrc, 'contrib/runtime-loader.ts'), 'utf8')
const start = loaderSource.indexOf('const importSpecifierRe =')
const end = ['export async function verifyIntegrity', 'export function unloadRuntimePlugin']
  .map(marker => loaderSource.indexOf(marker))
  .find(i => i > start)
assert(start > 0 && end > start, 'runtime-loader.ts anchors moved; update the extraction')
const loaderPart = loaderSource.slice(start, end)
assert(loaderPart.includes('function unsupportedImports') && loaderPart.includes('function rewriteSpecifiers'))

await check('plugin passes the real loader import allowlist; JSX-free plain ESM', async () => {
  const staticMap = "const sdkImportMap = () => ({ '@hermes/plugin-sdk': 'x:sdk', 'react/jsx-dev-runtime': 'x:jsxdev', 'react/jsx-runtime': 'x:jsx', react: 'x:react' })"
  const code = (await esbuild.transform(`${staticMap}\n${loaderPart}\nexport { unsupportedImports, rewriteSpecifiers }`, { loader: 'ts', format: 'esm' })).code
  const loader = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
  assert.deepEqual(loader.unsupportedImports(pluginSource), [])
  assert.deepEqual(loader.unsupportedImports("import fs from 'node:fs'"), ['node:fs'])
  const rewritten = loader.rewriteSpecifiers(pluginSource)
  for (const spec of ["'@hermes/plugin-sdk'", "'react'", "'react/jsx-runtime'"]) {
    assert(!rewritten.includes('from ' + spec), spec + ' not rewritten')
  }
  // Uncompiled ESM must parse as-is: esbuild with the plain JS loader rejects JSX syntax.
  await esbuild.transform(pluginSource, { loader: 'js', format: 'esm' })
  assert(!/dangerouslySetInnerHTML|innerHTML|eval\(|new Function/.test(pluginSource))
  assert(!/fetch\(|XMLHttpRequest|WebSocket/.test(pluginSource))
})

// ------------------------------------------------------ browser host (real shims + React)
const hostEntry = `
import { installPluginSdk, sdkImportMap } from ${JSON.stringify(path.join(desktopSrc, 'sdk/runtime.ts'))}
import * as ReactDOMClient from 'react-dom/client'
import * as React from 'react'
import * as sdkStub from ${JSON.stringify(path.join(here, 'sdk-stub.mjs'))}
installPluginSdk()
${loaderPart}
globalThis.__test = { rewriteSpecifiers, unsupportedImports, ReactDOMClient, React, sdkStub }
`
const stubSdkPlugin = {
  name: 'stub-sdk-index',
  setup(build) {
    // sdk/runtime.ts imports the real SDK barrel as './index'; hand it the partial stub.
    build.onResolve({ filter: /^\.\/index$/ }, args =>
      args.importer.endsWith(path.join('sdk', 'runtime.ts')) ? { path: path.join(here, 'sdk-stub.mjs') } : undefined
    )
  }
}
const hostBundle = (
  await esbuild.build({
    stdin: { contents: hostEntry, loader: 'ts', resolveDir: here },
    bundle: true,
    write: false,
    format: 'iife',
    // One React: runtime.ts would otherwise resolve the Desktop checkout's own node_modules.
    alias: {
      react: path.join(deps, 'node_modules/react'),
      'react-dom': path.join(deps, 'node_modules/react-dom')
    },
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [stubSdkPlugin],
    logLevel: 'silent'
  })
).outputFiles[0].text

const browser = await chromium.launch({ executablePath: chromiumPath, args: ['--no-sandbox'] })
const page = await browser.newPage()
page.on('console', msg => msg.type() === 'error' && consoleErrors.push(msg.text()))
page.on('pageerror', err => consoleErrors.push(String(err)))
page.on('dialog', dialog => {
  consoleErrors.push('unexpected dialog: ' + dialog.message())
  dialog.dismiss()
})
await page.setContent('<!doctype html><html><body><div id="mount"></div></body></html>')
await page.addScriptTag({ content: hostBundle })

// Load plugin.js exactly as the disk door would: allowlist, rewrite, import a blob module.
await page.evaluate(async source => {
  const t = globalThis.__test
  const bad = t.unsupportedImports(source)
  if (bad.length) throw new Error('unsupported imports: ' + bad.join(','))
  const url = URL.createObjectURL(new Blob([t.rewriteSpecifiers(source)], { type: 'text/javascript' }))
  globalThis.__plugin = await import(url)
}, pluginSource)

const mount = (kind, fx) =>
  page.evaluate(
    async ({ kind, fx }) => {
      const t = globalThis.__test
      const mod = globalThis.__plugin
      globalThis.__root?.unmount()
      const el = document.getElementById('mount')
      el.innerHTML = ''
      globalThis.__queries = []
      let source
      if (kind === 'registered') {
        const contributions = []
        const ctx = {
          source: 'plugin:' + mod.default.id,
          register: c => (contributions.push(c), () => {}),
          registerMany: cs => (contributions.push(...cs), () => {})
        }
        mod.default.register(ctx)
        globalThis.__contributions = contributions
        const pane = contributions.find(c => c.area === t.sdkStub.PANES_AREA)
        globalThis.__root = t.ReactDOMClient.createRoot(el)
        globalThis.__root.render(pane.render())
        return
      }
      if (kind === 'fixture') {
        let release
        globalThis.__gate = new Promise(r => (release = r))
        globalThis.__release = release
        source = {
          kind: 'fixture',
          label: 'Isolated fixture',
          load: async query => {
            globalThis.__queries.push(query)
            await globalThis.__gate
            if (query.cursor) return fx.page2.data
            if (query.conversation_id === 'conv-1') return fx.conv1.data
            if (query.conversation_id) return fx.none.data
            return fx.all.data
          }
        }
      } else if (kind === 'error') {
        source = {
          kind: 'fixture',
          label: 'Isolated fixture',
          load: async query => {
            globalThis.__queries.push(query)
            const e = new Error(fx.error.error.message)
            e.reason = fx.error.error.reason
            throw e
          }
        }
      }
      globalThis.__root = t.ReactDOMClient.createRoot(el)
      globalThis.__root.render(t.React.createElement(mod.ExchangePane, { source }))
    },
    { kind, fx }
  )
const text = () => page.locator('#mount').innerText()
const queries = () => page.evaluate(() => globalThis.__queries)

await check('registers one pane and one palette command; disabled pane reads nothing', async () => {
  await mount('registered')
  const contribs = await page.evaluate(() =>
    globalThis.__contributions.map(c => ({ id: c.id, area: c.area, title: c.title, data: c.data && { placement: c.data.placement, id: c.data.id, label: c.data.label } }))
  )
  assert.deepEqual(contribs.map(c => [c.id, c.area]), [['pane', 'panes'], ['open', 'command-palette']])
  assert.equal(contribs[0].data.placement, 'right')
  assert.equal(contribs[1].data.label, 'Open Bounded Exchanges')
  await page.locator('[data-stub="error-state"]').waitFor()
  const body = await text()
  assert.match(body, /Not connected/)
  assert.match(body, /cannot yet prove which profile/)
  assert.doesNotMatch(body, /ISOLATED FIXTURE/)
  assert.equal(await page.locator('[data-slot="exchange"]').count(), 0)
  assert.equal(await page.locator('input[disabled]').count(), 2)
  // Palette run opens the same (disconnected) view; it never sends or activates anything.
  const calls = await page.evaluate(() => {
    const t = globalThis.__test
    t.sdkStub.host.calls.length = 0
    globalThis.__contributions.find(c => c.id === 'open').data.run()
    return t.sdkStub.host.calls.map(c => [c[0], c[1]])
  })
  assert.deepEqual(calls, [['openWorkspace', 'bounded-exchanges']])
})

await check('loading, then fixture exchanges rendered with honest state labels', async () => {
  await mount('fixture', fixture)
  await page.locator('[data-slot="exchange-loading"]').waitFor()
  await page.evaluate(() => globalThis.__release())
  await page.locator('[data-slot="exchange"]').first().waitFor()
  assert.equal(await page.locator('[data-slot="exchange"]').count(), 2)
  const body = await text()
  assert.match(body, /ISOLATED FIXTURE: synthetic data, not a live backend/)
  assert.match(body, /Handed to Hermes job output/)
  assert.match(body, /Chat delivery unknown/)
  assert.match(body, /unauthenticated source/)
  assert.match(body, /sub-1 g1: active/)
  assert.match(body, /No reply yet \(one reply allowed\)/)
  assert.match(body, /is not a receipt/)
  assert.doesNotMatch(body, /\breceived\b|\bdelivered\b|\bread by\b/i)
  assert.deepEqual(await queries(), [{ conversation_id: '', chat_session_id: '', cursor: null, limit: 20 }])
})

await check('untrusted message text renders inert and visible', async () => {
  const body = await text()
  assert.match(body, /<script>window\.__pwned=1<\/script>/)
  assert.equal(await page.locator('#mount script').count(), 0)
  assert.equal(await page.evaluate(() => globalThis.__pwned), undefined)
  assert(!body.includes('‮'), 'bidi override must not reach the DOM text')
  assert.match(body, /\\u\{202e\}evil\\u\{202c\}/)
})

await check('Older pages with next_cursor; reply shown as published, receipt unknown', async () => {
  await page.getByRole('button', { name: 'Older' }).click()
  await page.locator('[data-exchange-id="agent-x/m1/v1"]').waitFor()
  const q = await queries()
  assert.equal(q.at(-1).cursor, fixture.all.data.page.next_cursor)
  const body = await text()
  assert.match(body, /Reply published/)
  assert.match(body, /Reader receipt unknown/)
  // No Tailwind stylesheet in this harness, so assert the DOM text + class, not layout.
  const replyText = page.locator('[data-exchange-id="agent-x/m1/v1"] [data-slot="exchange-text"]').last()
  assert.equal(await replyText.textContent(), 'Build is green.\nTwo flaky tests.')
  assert.match(await replyText.getAttribute('class'), /whitespace-pre-wrap/)
  await page.getByRole('button', { name: 'Newest' }).waitFor()
})

await check('conversation filter: invalid input refused inline, valid input queries, empty state', async () => {
  const before = (await queries()).length
  await page.getByLabel('Conversation ID').fill('bad id!')
  await page.getByRole('button', { name: 'Filter' }).click()
  await page.getByRole('alert').waitFor()
  assert.equal((await queries()).length, before)
  await page.getByLabel('Conversation ID').fill('conv-1')
  await page.getByRole('button', { name: 'Filter' }).click()
  await page.waitForFunction(() => globalThis.__queries.at(-1).conversation_id === 'conv-1')
  assert.equal((await queries()).at(-1).cursor, null)
  await page.locator('[data-exchange-id="agent-x/m3/v1"]').waitFor()
  assert.equal(await page.locator('[data-slot="exchange"]').count(), 2)
  await page.getByLabel('Conversation ID').fill('nope')
  await page.getByRole('button', { name: 'Filter' }).click()
  await page.locator('[data-stub="empty-state"]').waitFor()
  assert.match(await text(), /Nothing matches these filters/)
})

await check('backend error shows the error state with retry, not stale data', async () => {
  await mount('error', fixture)
  await page.locator('[data-stub="error-state"]').waitFor()
  const body = await text()
  assert.match(body, /Could not load exchanges/)
  assert.match(body, /belongs to a different profile/)
  assert.equal(await page.locator('[data-slot="exchange"]').count(), 0)
  await page.getByRole('button', { name: 'Retry' }).click()
  await page.waitForFunction(() => globalThis.__queries.length === 2)
})

await browser.close()
const unexpected = consoleErrors.filter(e => !/Warning: /.test(e))
assert.deepEqual(unexpected, [], 'browser console errors: ' + unexpected.join('\n'))
console.log(`\n${results.length} checks passed (stubbed SDK; not a live Desktop test).`)
