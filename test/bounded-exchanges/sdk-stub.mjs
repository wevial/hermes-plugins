// PARTIAL SDK STUB for isolated tests. Stand-ins for the few `@hermes/plugin-sdk` exports the
// plugin imports. They render plain DOM carrying the prop values tests assert on. This is NOT
// the Desktop UI kit, theme or host. Passing tests here are not live Desktop evidence.
import { createElement as h } from 'react'

export const PANES_AREA = 'panes'
export const PALETTE_AREA = 'command-palette'

export const host = {
  calls: [],
  notify(n) {
    host.calls.push(['notify', n])
  },
  openWorkspace(id, opts) {
    host.calls.push(['openWorkspace', id, opts])
    return () => {}
  }
}

export function Badge({ variant, children }) {
  return h('span', { 'data-stub': 'badge', 'data-variant': variant || 'default' }, children)
}

export function Button({ variant, size, children, ...props }) {
  return h('button', { 'data-stub': 'button', 'data-variant': variant || 'default', ...props }, children)
}

export function Input(props) {
  return h('input', { 'data-stub': 'input', ...props })
}

export function Loader({ label }) {
  return h('span', { 'data-stub': 'loader', role: 'status', 'aria-label': label })
}

export function DisclosureCaret({ open, ...props }) {
  return h('span', { 'data-stub': 'disclosure-caret', 'data-open': String(Boolean(open)), ...props }, open ? 'v' : '>')
}

export function EmptyState({ title, description }) {
  return h('div', { 'data-stub': 'empty-state' }, h('div', null, title), description ? h('div', null, description) : null)
}

export function ErrorState({ title, description, children }) {
  return h('div', { 'data-stub': 'error-state' }, h('h2', null, title), h('p', null, description), children || null)
}
