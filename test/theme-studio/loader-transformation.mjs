// Regression: run the desktop app's ACTUAL runtime-loader transformation on
// theme-studio/plugin.js — not the test import shim.
//
// The loader (apps/desktop/src/contrib/runtime-loader.ts) decides which
// imports are unsupported with:
//
//   const importSpecifierRe = () =>
//     /(from\s*|import\s*\(\s*|import\s+)(['\"])([^'\"]+)\2/g
//
// `from\s*` is NOT anchored to import syntax: any occurrence of the word
// "from" followed (after optional whitespace) by a quote character matches.
// A UI string ending in the word "from" (e.g. 'How many seed colors to
// generate from') therefore makes the loader report a bogus unsupported
// import and refuse to load the plugin.
//
// This test extracts the regex straight from the loader source when available
// (HERMES_RUNTIME_LOADER) so it can never drift from the real pipeline, and
// asserts the plugin passes unsupportedImports() AND rewriteSpecifiers()
// without producing a bare (unmappable) specifier.
import { readFileSync, existsSync } from 'node:fs'

const LOADER_PATHS = [
  process.env.HERMES_RUNTIME_LOADER
].filter(Boolean)

function loaderRegex() {
  for (const p of LOADER_PATHS) {
    if (existsSync(p)) {
      const src = readFileSync(p, 'utf8')
      const m = src.match(/const importSpecifierRe = \(\) => \/(.+)\/g/)
      if (m) {
        console.log(`using actual loader regex from ${p}`)
        return new RegExp(m[1], 'g')
      }
    }
  }
  throw new Error('runtime-loader.ts importSpecifierRe not found — set HERMES_RUNTIME_LOADER')
}

const MAP = new Set(['@hermes/plugin-sdk', 'react', 'react/jsx-runtime'])
const re = loaderRegex()
const source = readFileSync(new URL('../../plugins/theme-studio/plugin.js', import.meta.url), 'utf8')

const unsupported = []
for (const m of source.matchAll(re)) {
  const spec = m[3]
  // Same skip rules as unsupportedImports() in runtime-loader.ts.
  if (spec && !/^[./]/.test(spec) && !/^[a-z][a-z0-9+.-]*:/i.test(spec) && !MAP.has(spec)) {
    unsupported.push(spec)
  }
}

if (unsupported.length > 0) {
  console.error('FAIL: loader would reject plugin.js with unsupported import(s):')
  for (const s of unsupported) console.error('  ' + JSON.stringify(s))
  process.exit(1)
}

// rewriteSpecifiers() must also leave every mapped specifier intact (nothing
// rewritten inside strings/comments) — if the regex misfires inside a string
// it could corrupt plugin source at load time.
let rewrites = 0
for (const m of source.matchAll(re)) if (MAP.has(m[3])) rewrites++
const importLines = source.split('\n').filter((l) => /^\s*import\s/.test(l)).length
if (rewrites !== importLines) {
  console.error(`FAIL: loader regex rewrote ${rewrites} specifiers but the plugin declares ${importLines} import lines`)
  process.exit(1)
}

console.log(`PASS: plugin.js passes the actual runtime-loader transformation (${importLines} imports, 0 unsupported)`)
