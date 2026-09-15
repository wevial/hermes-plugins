/**
 * font-picker — user-local Hermes Desktop plugin.
 * Copyright (c) 2026 Ko Vial. MIT License; see LICENSE.
 *
 * Palette command "Font Picker" opens a dialog: searchable list of installed
 * Mac fonts with live previews, typed family input, and Reset. Scope: chat/UI
 * sans only — overrides --dt-font-sans on documentElement; --dt-font-mono
 * (code/mono/terminal/icons) untouched.
 *
 * No-op until selection: registers only a palette command + status chip; no
 * font applies until the user picks. Persists via ctx.storage across
 * reload/restart. Reset removes the override so the theme's own value wins.
 *
 * Theme-switch safety: the app's applyTheme() rewrites --dt-font-sans inline
 * on documentElement on every theme paint (themes/context.tsx). A
 * MutationObserver on the style attribute re-asserts the override whenever the
 * theme repaints (event-driven, no polling). On Reset we disconnect the
 * observer AND restore the theme's current value explicitly (the theme only
 * rewrites that custom property on its own paint events).
 *
 * Injection safety: family values never enter a CSS string. Every preview and
 * the override itself set el.style.fontFamily directly — the CSSOM parser
 * drops invalid values (braces/semicolons/unbalanced quotes/url()) so
 * arbitrary CSS injection is impossible. CSS-wide keywords rejected
 * explicitly; only a valid family persists/applies.
 */

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  PALETTE_AREA,
  ScrollArea,
  SearchField,
  Tip,
  cn,
  haptic,
  host
} from '@hermes/plugin-sdk'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

const ID = 'font-picker'

// Curated quick-pick list — macOS system fonts only (verified against this
// user's /System/Library/Fonts + Supplemental + ~/Library/Fonts), no network
// fonts, deliberately NOT a remote backend’s font inventory.
const QUICK_PICKS = [
  'Avenir Next', 'Helvetica Neue', 'Helvetica', 'Arial', 'Futura', 'Optima',
  'Palatino', 'Charter', 'Georgia', 'Seravek', 'Verdana', 'Trebuchet MS',
  'Avenir', 'Rockwell', 'Baskerville', 'Didot', 'Menlo'
]

// CSS-wide keywords the CSSOM accepts as font-family — reject so e.g.
// "inherit" can never be stored as a selection.
const CSS_WIDE = new Set(['inherit', 'initial', 'unset', 'revert', 'revert-layer', 'default'])

const OVERRIDE_KEY = 'selection'

const DEFAULT_FALLBACK = 'system-ui, sans-serif'

// ─── Sanitization (shared by UI, storage-load) ──────────────────────────────

function sanitizeFamily(raw) {
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  if (!s || s.length > 64) return null
  if (CSS_WIDE.has(s.toLowerCase())) return null
  // CSSOM probe: invalid values never stick (braces, semicolons, unbalanced
  // quotes, url() all leave fontFamily === '').
  const probe = document.createElement('i')
  probe.style.fontFamily = s
  if (probe.style.fontFamily === '') return null
  return s
}

// ─── Theme-safe override engine ─────────────────────────────────────────────

let observer = null
let applied = null // family currently applied; null = no override
let gen = 0 // observer generation: stale callbacks after reset are ignored
let themeValue = null // theme's --dt-font-sans captured at override time
const appliedListeners = new Set()
const notifyApplied = () => appliedListeners.forEach(fn => fn(applied))

function startWatching() {
  if (observer) return
  const myGen = ++gen
  observer = new MutationObserver(() => {
    if (myGen !== gen || !applied) return
    // Loop guard: only write when something else actually changed the value
    // (e.g. a theme paint). Our own writes therefore never re-trigger work.
    if (document.documentElement.style.getPropertyValue('--dt-font-sans') !== applied) {
      document.documentElement.style.setProperty('--dt-font-sans', applied)
    }
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
}

function stopWatching() {
  gen += 1
  if (observer) {
    observer.disconnect()
    observer = null
  }
  applied = null
}

function applyOverride(family) {
  // Capture the theme's current value BEFORE touching state, so Reset can
  // restore exactly what the theme last painted (not our own override).
  const current = document.documentElement.style.getPropertyValue('--dt-font-sans').trim()
  if (current && current !== applied) themeValue = current
  if (!themeValue) themeValue = null
  stopWatching() // reset generation so a fresh observer never races
  applied = family
  startWatching()
  document.documentElement.style.setProperty('--dt-font-sans', family)
  notifyApplied()
}

function removeOverride() {
  stopWatching()
  const root = document.documentElement
  root.style.removeProperty('--dt-font-sans')
  // Restore the theme's captured value. If none was recorded (we overrode
  // before the theme ever painted, or it was empty), leave the property
  // absent — the cascade default wins and the next theme event repaints.
  if (themeValue) {
    root.style.setProperty('--dt-font-sans', themeValue)
  }
  applied = null
  themeValue = null
  notifyApplied()
}

// ─── Dialog/chip visibility: tiny store + useSyncExternalStore-style hook ───
// Plain React only (runtime plugins may import @hermes/plugin-sdk + react).
// The store mutates from imperative code (palette run, override engine); each
// hook subscribes via useEffect and setState — event-driven, no polling.

const dialogStore = {
  listeners: new Set(),
  open: false,
  set(open) {
    this.open = open
    this.listeners.forEach(fn => fn(open))
  }
}

function useDialogOpen() {
  const [open, setOpen] = useState(dialogStore.open)
  useEffect(() => {
    const fn = v => setOpen(v)
    dialogStore.listeners.add(fn)
    return () => dialogStore.listeners.delete(fn)
  }, [])
  return open
}

function Chip() {
  const family = useApplied()
  if (!family) return null
  return jsx(Tip, {
    label: `UI font: ${family} — click to change`,
    children: jsx('button', {
      className: cn(
        'inline-flex h-full items-center gap-1 px-1.5 text-[0.6875rem] transition-colors',
        'text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover) hover:text-foreground'
      ),
      type: 'button',
      onClick: () => {
        haptic('tap')
        dialogStore.set(true)
      },
      children: jsx('span', {
        style: { fontFamily: `"${family}", ${DEFAULT_FALLBACK}` },
        children: family
      })
    })
  })
}

function FontDialog() {
  const open = useDialogOpen()
  if (!open) return null
  return jsx(DialogRoot, { onClose: () => dialogStore.set(false) })
}

// Mounted once by register() so useDialogOpen/useApplied subscriptions exist
// for the chip + palette run path even before the dialog ever opens.
function PluginRoot() {
  return jsxs(Fragment, { children: [jsx(Chip, {}), jsx(FontDialog, {})] })
}

function useApplied() {
  const [v, setV] = useState(applied)
  useEffect(() => {
    const fn = x => setV(x)
    appliedListeners.add(fn)
    return () => appliedListeners.delete(fn)
  }, [])
  return v
}

let pluginCtx = null

function DialogRoot({ onClose }) {
  const [families, setFamilies] = useState(QUICK_PICKS)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(applied || '')
  const [typed, setTyped] = useState('')
  const [apiState, setApiState] = useState('checking')
  const [localCount, setLocalCount] = useState(0)

  // queryLocalFonts: user-gesture-gated local font inventory (Chromium).
  // Triggered ONLY from the explicit button click — never on mount.
  const loadLocalFonts = useCallback(async () => {
    try {
      if (!window.queryLocalFonts) {
        setApiState('unavailable')
        return
      }
      const fonts = await window.queryLocalFonts()
      const names = [...new Set(fonts.map(f => f.family))].sort((a, b) => a.localeCompare(b))
      if (names.length > 0) {
        setFamilies(names)
        setLocalCount(names.length)
        setApiState('ok')
      } else {
        setApiState('unavailable')
      }
    } catch (err) {
      setApiState(err && err.name === 'NotAllowedError' ? 'denied' : 'unavailable')
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? families.filter(f => f.toLowerCase().includes(q)) : families
  }, [families, query])

  const choose = family => {
    const clean = sanitizeFamily(family)
    if (!clean) return
    setSelected(clean)
    applyOverride(clean)
    pluginCtx.storage.set(OVERRIDE_KEY, clean)
  }

  const reset = () => {
    pluginCtx.storage.remove(OVERRIDE_KEY)
    removeOverride()
    setSelected('')
    onClose()
  }

  const commitTyped = () => {
    const clean = sanitizeFamily(typed)
    if (clean) {
      choose(clean)
      onClose()
    } else {
      host.notify({ kind: 'error', message: `"${typed}" is not a usable font family name.` })
    }
  }

  return jsxs(Dialog, { open: true, onOpenChange: o => { if (!o) onClose() }, children: [
    jsxs(DialogContent, { className: 'max-w-lg', children: [
      jsxs(DialogHeader, { children: [
        jsx(DialogTitle, { children: 'Font Picker' }),
        jsx(DialogDescription, { children: 'Choose the app UI / chat sans font. Code, mono and terminal fonts are not affected.' })
      ] }),
      jsx(SearchField, {
        value: query,
        onChange: setQuery,
        placeholder: localCount > 0 ? `Search ${localCount} installed families…` : 'Search fonts…'
      }),
      apiState === 'denied' && jsx('div', {
        className: 'text-(--ui-text-tertiary) text-xs',
        children: 'Permission denied — using the quick list. You can still type a family name below.'
      }),
      apiState === 'unavailable' && jsx('div', {
        className: 'text-(--ui-text-tertiary) text-xs',
        children: 'System font enumeration unavailable in this build — use the quick list or type a family name.'
      }),
      jsx(ScrollArea, { className: 'h-64', children:
        jsx('div', { className: 'flex flex-col gap-0.5 py-1', children:
          filtered.map(family =>
            jsx('button', {
              key: family,
              type: 'button',
              onClick: () => { choose(family); onClose() },
              className: cn(
                'flex w-full items-baseline justify-between gap-3 rounded px-2 py-1.5 text-left text-sm',
                'hover:bg-(--chrome-action-hover)',
                selected === family && 'bg-(--ui-accent)/10'
              ),
              children: [
                jsx('span', {
                  className: 'truncate',
                  style: { fontFamily: `"${family}", ${DEFAULT_FALLBACK}` },
                  children: family
                }),
                selected === family && jsx('span', { className: 'text-(--ui-accent) text-xs', children: 'active' })
              ]
            }, family)
          )
        })
      }),
      filtered.length === 0 && jsx('div', { className: 'py-6 text-center text-(--ui-text-tertiary) text-sm', children: 'No matching families.' }),
      jsxs('div', { className: 'flex items-center gap-2', children: [
        jsx(Input, {
          value: typed,
          onChange: e => setTyped(e?.target?.value ?? e),
          placeholder: 'Type a font family name…',
          onKeyDown: e => { if (e.key === 'Enter') commitTyped() }
        }),
        jsx(Button, { variant: 'secondary', size: 'sm', onClick: commitTyped, disabled: !typed.trim(), children: 'Apply' })
      ] }),
      jsxs(DialogFooter, { className: 'flex items-center justify-between', children: [
        jsxs('div', { className: 'flex gap-2', children: [
          jsx(Button, { variant: 'secondary', size: 'sm', onClick: loadLocalFonts, disabled: apiState === 'ok', children: 'Load all installed fonts' }),
          jsx(Button, { variant: 'ghost', size: 'sm', onClick: reset, disabled: !selected, children: 'Reset to default' })
        ] }),
        jsx(Button, { variant: 'ghost', size: 'sm', onClick: onClose, children: 'Close' })
      ] })
    ] })
  ] })
}

// ─── Default export (the HermesPlugin) ──────────────────────────────────────

export default {
  id: ID,
  name: 'Font Picker',
  description: 'Pick the app UI font (chat/UI sans only; code/mono untouched). No-op until you choose.',
  defaultEnabled: false,

  register(ctx) {
    // Re-apply a persisted selection on (re)load — sanitized again on the way
    // in; a corrupt/unparsable stored value is discarded, never applied.
    pluginCtx = ctx
    const stored = sanitizeFamily(ctx.storage.get(OVERRIDE_KEY, null))
    if (stored) applyOverride(stored)

    // Full cleanup on disable/reload: remove the override AND restore the
    // theme's value explicitly, since the theme only repaints on its own
    // events and would otherwise keep our last value until then.
    ctx.onDispose(() => removeOverride())

    // Palette command — data contribution: { label, keywords, run }.
    // The only entry point. No pane, no poll, no timer.
    ctx.register({
      id: 'open',
      area: PALETTE_AREA,
      data: {
        label: 'Font Picker',
        keywords: ['font', 'ui', 'sans', 'family', 'typography'],
        run: () => dialogStore.set(true)
      }
    })

    // Status chip: UI contribution with top-level render. Shows the active
    // family once one is chosen; hidden entirely until then (no-op posture).
    ctx.register({
      id: 'chip',
      area: 'statusBar.right',
      order: 130,
      render: () => jsx(PluginRoot, {})
    })
  }
}
