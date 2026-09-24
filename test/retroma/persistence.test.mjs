import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import test from 'node:test'
const source = readFileSync(new URL('../../plugins/retroma-tactile/plugin.js', import.meta.url), 'utf8')
const flush = () => new Promise(resolve => setImmediate(resolve))
function load(storage) {
  const styles = new Set(), commands = {}, notifications = []
  let dispose
  const plugin = vm.runInNewContext(source.replace(/^import .*$/m, '').replace('export const skinCss', 'const skinCss').replace('export default', 'globalThis.plugin ='), {
    PALETTE_AREA: 'palette', host: { notify: n => notifications.push(n) },
    document: { createElement: () => ({ dataset: {}, remove() { styles.delete(this) } }), head: { append: s => styles.add(s) } }
  })
  plugin.register({ storage, register: c => { commands[c.id] = c.data.run }, onDispose: fn => { dispose = fn } })
  return { styles, commands, notifications, dispose: () => dispose() }
}
test('enable survives a new client instance, disable survives too; disposal preserves preference', async () => {
  let value
  const storage = { get: async () => value, set: async (k, v) => { value = v } }
  let app = load(storage); await flush(); assert.equal(app.styles.size, 0)
  await app.commands.enable(); await app.commands.enable(); assert.equal(app.styles.size, 1)
  app.dispose(); assert.equal(app.styles.size, 0); assert.equal(value, true)
  app = load(storage); await flush(); assert.equal(app.styles.size, 1)
  await app.commands.disable(); app.dispose()
  app = load(storage); await flush(); assert.equal(app.styles.size, 0)
  await Promise.all([app.commands.enable(), app.commands.disable(), app.commands.enable()]); assert.equal(value, true)
})
test('late restore cannot override a command or resurrect disposed styles', async () => {
  let resolve
  const storage = { get: () => new Promise(r => { resolve = r }), set: async () => {} }
  const app = load(storage); await flush(); await app.commands.disable(); resolve(true); await flush(); assert.equal(app.styles.size, 0)
  const other = load(storage); await flush(); other.dispose(); resolve(true); await flush(); assert.equal(other.styles.size, 0)
})
test('storage failure is reported without losing command functionality', async () => {
  const app = load({ get: async () => { throw Error('read') }, set: async () => { throw Error('write') } })
  await flush(); assert.equal(app.styles.size, 0)
  await app.commands.enable(); assert.equal(app.styles.size, 1)
  assert.equal(app.notifications.filter(n => n.kind === 'error').length, 2)
})
