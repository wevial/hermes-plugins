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
await check('fixture comes from the real multi-profile service on disposable roots', () => {
  assert.deepEqual(fixture.profiles.data.profiles.map(p => p.id), ['alpha', 'beta', 'gamma'])
  assert.equal(fixture.all.data.kind, 'bounded-events.exchange-service')
  assert.equal(fixture.all.data.read_only, true)
  assert.equal(fixture.all.data.complete, false) // gamma's root does not exist
  assert.equal(fixture.all.data.exchanges.length, 4)
  assert.ok(fixture.alpha.data.page.next_cursor)
  assert.equal(fixture.gamma.ok, false)
  assert.equal(fixture.gamma.error.reason, 'root_unavailable')
  assert.deepEqual(fixture.all_nope.data.exchanges, [])
  assert.equal(fixture.all_nope.data.complete, false)
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
      if (kind.startsWith('registered')) {
        const contributions = []
        const ctx = {
          source: 'plugin:' + mod.default.id,
          register: c => (contributions.push(c), () => {}),
          registerMany: cs => (contributions.push(...cs), () => {})
        }
        globalThis.__restPaths = []
        if (kind === 'registered-rest') {
          // Stands in for the host's ctx.rest: answers with exact ExchangeService responses
          // (the same bodies the real host mount returned in viewer_host_mount.py).
          ctx.rest = async path => {
            globalThis.__restPaths.push(path)
            if (path === '/profiles') return fx.profiles
            const [route, search] = path.split('?')
            if (route !== '/exchanges') throw new Error('404 Not Found')
            const q = Object.fromEntries(new URLSearchParams(search || ''))
            if (q.viewer_profile === 'all') return q.conversation_id ? fx.all_nope : fx.all
            if (q.viewer_profile === 'alpha') return q.cursor ? fx.alpha_page2 : fx.alpha
            return fx[q.viewer_profile]
          }
        } else if (kind === 'registered-404') {
          ctx.rest = async path => {
            globalThis.__restPaths.push(path)
            throw new Error('404 Plugin not found')
          }
        }
        mod.default.register(ctx)
        globalThis.__contributions = contributions
        const pane = contributions.find(c => c.area === t.sdkStub.PANES_AREA)
        globalThis.__root = t.ReactDOMClient.createRoot(el)
        globalThis.__root.render(pane.render())
        return
      }
      // Every fixture answer is an exact ExchangeService response (see gen-fixture.py).
      const pick = q => {
        if (q.viewer_profile === 'all') {
          return q.conversation_id === 'conv-1' ? fx.all_conv1 : q.conversation_id ? fx.all_nope : fx.all
        }
        if (q.viewer_profile === 'alpha') {
          return q.cursor ? fx.alpha_page2 : q.conversation_id ? fx.alpha_none : fx.alpha
        }
        return fx[q.viewer_profile]
      }
      const unwrap = reply => {
        if (!reply.ok) {
          const e = new Error(reply.error.message)
          e.reason = reply.error.reason
          throw e
        }
        return reply.data
      }
      // Each load waits until the test releases it by index, so races can be ordered.
      globalThis.__pending = []
      const held = () => new Promise(resolve => globalThis.__pending.push(resolve))
      const fixtureSource = answer => ({
        kind: 'fixture',
        label: 'Isolated fixture',
        listProfiles: async () => fx.profiles.data,
        load: async query => {
          globalThis.__queries.push(query)
          await held()
          return unwrap(answer(query))
        }
      })
      if (kind === 'fixture') {
        source = fixtureSource(pick)
      } else if (kind === 'wrong-answer') {
        source = fixtureSource(() => fx.beta) // always answers beta, whatever was asked
      }
      globalThis.__root = t.ReactDOMClient.createRoot(el)
      globalThis.__root.render(t.React.createElement(mod.ExchangePane, { source }))
    },
    { kind, fx }
  )
const text = () => page.locator('#mount').innerText()
const queries = () => page.evaluate(() => globalThis.__queries)
const release = i => page.evaluate(i => globalThis.__pending[i](), i)
const waitPending = n => page.waitForFunction(n => globalThis.__pending.length >= n, n)
const rows = () => page.locator('[data-slot="exchange"]')
const rowProfiles = () => page.$$eval('[data-slot="exchange"]', els => els.map(e => e.dataset.profile))
const pick = name => page.getByRole('button', { name, exact: true })

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
  assert.match(body, /offers plugins no backend REST access/)
  assert.doesNotMatch(body, /ISOLATED FIXTURE/)
  assert.equal(await page.locator('[data-slot="exchange-profiles"]').count(), 0)
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

await check('registered pane uses ctx.rest: exact namespace paths, service data, labels', async () => {
  await mount('registered-rest', fixture)
  await rows().first().waitFor()
  const paths = await page.evaluate(() => globalThis.__restPaths)
  assert.deepEqual(paths, ['/profiles', '/exchanges?viewer_profile=all&limit=20'])
  assert.equal(await rows().count(), 4)
  const body = await text()
  assert.doesNotMatch(body, /ISOLATED FIXTURE|Not connected/)
  assert.match(body, /Incomplete: 1 profile\(s\) unavailable/)
  await pick('Alpha bot').click()
  await page.waitForFunction(() => globalThis.__restPaths.length === 3)
  assert.equal((await page.evaluate(() => globalThis.__restPaths)).at(-1), '/exchanges?viewer_profile=alpha&limit=20')
  await page.locator('[data-profile="alpha"]').first().waitFor()
  await pick('Older').click()
  await page.waitForFunction(() => globalThis.__restPaths.length === 4)
  const older = (await page.evaluate(() => globalThis.__restPaths)).at(-1)
  assert.equal(older, '/exchanges?viewer_profile=alpha&limit=20&cursor=' + encodeURIComponent(fixture.alpha.data.page.next_cursor))
  assert(!/root|hermes_home|path=/.test((await page.evaluate(() => globalThis.__restPaths)).join(' ')))
})

await check('registered pane: host route missing/disabled shows "not reachable", never empty', async () => {
  await mount('registered-404', fixture)
  await page.locator('[data-stub="error-state"]').waitFor()
  const body = await text()
  assert.match(body, /viewer service is not reachable on this backend/)
  assert.equal(await rows().count(), 0)
  assert.equal(await page.locator('[data-stub="empty-state"]').count(), 0)
})

await check('overview: every row labeled by profile, duplicate IDs kept apart, incomplete shown', async () => {
  await mount('fixture', fixture)
  await page.locator('[data-slot="exchange-loading"]').waitFor()
  await waitPending(1)
  assert.deepEqual(await queries(), [{ viewer_profile: 'all', conversation_id: '', chat_session_id: '', cursor: null, limit: 20 }])
  assert.equal(await pick('All profiles').getAttribute('aria-pressed'), 'true')
  await release(0)
  await rows().first().waitFor()
  assert.equal(await rows().count(), 4)
  assert.deepEqual((await rowProfiles()).sort(), ['alpha', 'alpha', 'alpha', 'beta'])
  const m1 = await page.$$eval('[data-exchange-id="agent-x/m1/v1"]', els => els.map(e => e.dataset.profile).sort())
  assert.deepEqual(m1, ['alpha', 'beta'])
  const body = await text()
  assert.match(body, /ISOLATED FIXTURE: synthetic data, not a live backend/)
  assert.match(body, /Alpha bot/)
  assert.match(body, /Beta bot/)
  assert.match(body, /Incomplete: 1 profile\(s\) unavailable/)
  assert.match(body, /Gamma bot: root_unavailable/)
  assert.match(body, /Chat delivery unknown/)
  assert.match(body, /Reply published/)
  assert.match(body, /Reader receipt unknown/)
  assert.match(body, /is not a receipt/)
  assert.doesNotMatch(body, /\breceived\b|\bdelivered\b|\bread by\b/i)
})

await check('untrusted message text renders inert and visible', async () => {
  const body = await text()
  assert.match(body, /<script>window\.__pwned=1<\/script>/)
  assert.equal(await page.locator('#mount script').count(), 0)
  assert.equal(await page.evaluate(() => globalThis.__pwned), undefined)
  assert(!body.includes('‮'), 'bidi override must not reach the DOM text')
  assert.match(body, /\\u\{202e\}evil\\u\{202c\}/)
  const replyText = page.locator('[data-exchange-id="agent-x/m1/v1"][data-profile="alpha"] [data-slot="exchange-text"]').last()
  assert.equal(await replyText.textContent(), 'Build is green.\nTwo flaky tests.')
})

await check('switching clears rows at once and a late answer for an old selection is dropped', async () => {
  await pick('Beta bot').click()
  await page.locator('[data-slot="exchange-loading"]').waitFor()
  assert.equal(await rows().count(), 0) // no overview rows left under the beta selection
  await waitPending(2)
  await pick('Alpha bot').click()
  await waitPending(3)
  await release(1) // beta answers late, after the user moved on
  await page.waitForTimeout(100)
  assert.equal(await rows().count(), 0)
  await page.locator('[data-slot="exchange-loading"]').waitFor()
  await release(2)
  await rows().first().waitFor()
  assert.deepEqual(await rowProfiles(), ['alpha', 'alpha'])
  const q = await queries()
  assert.deepEqual(q.slice(1).map(x => x.viewer_profile), ['beta', 'alpha'])
})

await check('cursor stays with its profile: Older pages alpha, switching resets it', async () => {
  await pick('Older').click()
  await waitPending(4)
  assert.equal((await queries()).at(-1).cursor, fixture.alpha.data.page.next_cursor)
  await release(3)
  await page.locator('[data-exchange-id="agent-x/m1/v1"][data-profile="alpha"]').waitFor()
  assert.deepEqual(await rowProfiles(), ['alpha'])
  await pick('All profiles').click()
  await waitPending(5)
  const last = (await queries()).at(-1)
  assert.deepEqual([last.viewer_profile, last.cursor], ['all', null])
  await release(4)
  await rows().first().waitFor()
})

await check('filters: invalid refused inline; empty overview with an unavailable profile is not a false empty', async () => {
  const before = (await queries()).length
  await page.getByLabel('Conversation ID').fill('bad id!')
  await pick('Filter').click()
  await page.getByRole('alert').waitFor()
  assert.equal((await queries()).length, before)
  await page.getByLabel('Conversation ID').fill('nope')
  await pick('Filter').click()
  await waitPending(6)
  await release(5)
  await page.locator('[data-stub="empty-state"]').waitFor()
  const body = await text()
  assert.match(body, /No exchanges from available profiles/)
  assert.match(body, /not a complete answer/)
  assert.doesNotMatch(body, /Nothing matches these filters/)
  await pick('Alpha bot').click()
  await waitPending(7)
  assert.equal((await queries()).at(-1).conversation_id, 'nope')
  await release(6)
  await page.getByText('Nothing matches these filters.').waitFor()
})

await check('an unavailable profile shows an error, never an empty list', async () => {
  await pick('Gamma bot').click()
  await waitPending(8)
  await release(7)
  await page.locator('[data-stub="error-state"]').waitFor()
  const body = await text()
  assert.match(body, /Could not load exchanges/)
  assert.match(body, /configured root is missing/)
  assert.equal(await rows().count(), 0)
  assert.equal(await page.locator('[data-stub="empty-state"]').count(), 0)
  await pick('Retry').click()
  await waitPending(9)
})

await check('a response for a different selection is refused, not displayed', async () => {
  await mount('wrong-answer', fixture)
  await waitPending(1)
  await release(0) // asked for "all", service answers beta
  await page.locator('[data-stub="error-state"]').waitFor()
  assert.match(await text(), /answered a different selection; nothing shown/)
  assert.equal(await rows().count(), 0)
})

await browser.close()
const unexpected = consoleErrors.filter(e => !/Warning: /.test(e))
assert.deepEqual(unexpected, [], 'browser console errors: ' + unexpected.join('\n'))
console.log(`\n${results.length} checks passed (stubbed SDK; not a live Desktop test).`)
