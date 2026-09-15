/**
 * Builds browser-ESM shims for the test harness.
 *
 * The npm react/react-dom packages are CJS; the plugin (and browsers) need
 * ESM with NAMED exports, and the plugin's `useState` (from 'react') must be
 * the SAME React instance react-dom renders with, and the one jsx-runtime
 * closes over — otherwise React throws "Invalid hook call".
 *
 * Strategy:
 *   1. react: esbuild bundle (IIFE, self-contained) → ESM wrapper re-exporting
 *      every name (names enumerated from the real package in Node).
 *   2. react/jsx-runtime and react-dom/client: esbuild bundle as ESM with
 *      `react` EXTERNAL, then rewrite the emitted `from "react"` to
 *      `from "./react.esm.js"` and append the named re-exports.
 *
 * Outputs under ./shims/: react.esm.js, jsx-runtime.esm.js,
 * react-dom-client.esm.js. Run via `npm test` (or `node build-shims.mjs`).
 */
import { build } from 'esbuild'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const here = p => new URL(p, import.meta.url).pathname
const nodeRequire = createRequire(import.meta.url)
mkdirSync(here('./shims/'), { recursive: true })

const RESERVED = new Set(['default'])
const ident = k => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) && !RESERVED.has(k)

const keyList = exports => [...new Set(Object.keys(exports))].filter(ident)

// 1) react — self-contained IIFE + wrapper.
await build({
  bundle: true, format: 'iife', platform: 'browser', minify: false, logLevel: 'silent',
  entryPoints: [here('./node_modules/react/index.js')],
  outfile: here('./shims/react.iife.js'),
  globalName: '__ReactGlobal'
})
const reactKeys = keyList(nodeRequire('./node_modules/react/index.js')).filter(ident)
writeFileSync(here('./shims/react.esm.js'), [
  '/* AUTO-GENERATED browser ESM shim of react (esbuild IIFE). Do not edit. */',
  'var __ReactGlobal = globalThis.__ReactGlobal = (globalThis.__ReactGlobal || {});',
  readFileSync(here('./shims/react.iife.js'), 'utf8').replace(/^var __ReactGlobal = /, '__ReactGlobal = '),
  'const m = __ReactGlobal;',
  'export default m;',
  ...reactKeys.map(k => `export const ${k} = m[${JSON.stringify(k)}];`),
  ''
].join('\n'))

// 2+3) jsx-runtime & react-dom/client: ESM output, react external → shared copy.
const esmWithExternal = async (entry, outfile, globalStub) => {
  await build({
    bundle: true, format: 'esm', platform: 'browser', minify: false, logLevel: 'silent',
    entryPoints: [entry], outfile, external: ['react']
  })
  let out = readFileSync(outfile, 'utf8')
  out = out.replace(/from\s*"react"/g, 'from "./react.esm.js"')
  // esbuild keeps a runtime __require fallback for dynamic requires; bind it
  // to the shared React shim so `__require("react")` can't throw in browsers.
  out = out.replace(
    /var __require = \/\* @__PURE__ \*\/ \(\(x\) =>[\s\S]*?\}\);/,
    'var __require = (x) => x === "react" ? __ReactEsm : (() => { throw new Error("unexpected require " + x) })();'
  )
  return out
}

const jsxKeys = keyList(nodeRequire('./node_modules/react/jsx-runtime.js')).filter(ident)
const jsxOut = await esmWithExternal(here('./node_modules/react/jsx-runtime.js'), here('./shims/jsx-runtime.raw.mjs'))
writeFileSync(here('./shims/jsx-runtime.esm.js'), [
  '/* AUTO-GENERATED browser ESM shim of react/jsx-runtime (esbuild ESM, react external → ./react.esm.js). Do not edit. */',
  'import * as __ReactEsm from "./react.esm.js";',
  jsxOut.replace('export default require_jsx_runtime();', 'const __jsxDefault = require_jsx_runtime();'),
  ...jsxKeys.map(k => `export const ${k} = __jsxDefault[${JSON.stringify(k)}];`),
  ''
].join('\n'))

const domKeys = keyList(nodeRequire('./node_modules/react-dom/client.js')).filter(ident)
const domOut = await esmWithExternal(here('./node_modules/react-dom/client.js'), here('./shims/react-dom-client.raw.mjs'))
writeFileSync(here('./shims/react-dom-client.esm.js'), [
  '/* AUTO-GENERATED browser ESM shim of react-dom/client (esbuild ESM, react external → ./react.esm.js). Do not edit. */',
  'import * as __ReactEsm from "./react.esm.js";',
  domOut.replace('export default require_client();', 'const __domDefault = require_client();'),
  ...domKeys.map(k => `export const ${k} = __domDefault[${JSON.stringify(k)}];`),
  ''
].join('\n'))

console.log('shims built:', { reactKeys: reactKeys.length, jsxKeys: jsxKeys.length, domKeys: domKeys.length })
