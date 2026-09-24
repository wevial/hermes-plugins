// Bounded Exchanges — read-only review of Bounded Events exchanges in Hermes Desktop.
//
// Plain ESM, loaded uncompiled: jsx()/jsxs() calls, no JSX syntax, and only the three
// specifiers the loader allows. The pane shows inbound messages from an external agent with
// their routing state and correlated bot replies. It has no send, replay, approval or
// subscription controls.
//
// One viewer, several profiles: an explicit "All profiles" overview (only when the operator
// enabled it) and a per-profile view. The operator's service config lists the profiles; this
// pane only ever sends an opaque `viewer_profile` id and filters, never a path.
//
// The registered pane reads through `ctx.rest` from this plugin's own backend namespace
// (`/api/plugins/bounded-exchanges/profiles` and `/exchanges`), served by the viewer package
// that bounded-events builds (`python3 -m bounded_events viewer-bundle`). If the host has no
// `ctx.rest`, the pane stays "Not connected". If the route is not installed, not enabled or
// not loaded since the last backend restart, it shows an explicit "not reachable" error. It
// never shows sample data as if it were live.

import {
  Badge,
  Button,
  DisclosureCaret,
  EmptyState,
  ErrorState,
  host,
  Input,
  Loader,
  PALETTE_AREA,
  PANES_AREA
} from '@hermes/plugin-sdk'
import { useCallback, useEffect, useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

export const PLUGIN_ID = 'bounded-exchanges'
export const PAGE_SIZE = 20

// Same identifier rule as the backend (`sandbox._ID_RE`); checked here only to give inline
// feedback. The backend validates again and is the authority.
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const SESSION_RE = /^[\x21-\x7e]{1,256}$/

export const OVERVIEW = 'all'

export const CONNECTION_BLOCKER =
  'This Desktop build offers plugins no backend REST access (ctx.rest), so this pane reads ' +
  'nothing. Use the terminal viewer: python3 -m bounded_events exchanges --root ROOT'

export const UNREACHABLE =
  'The Bounded Exchanges viewer service is not reachable on this backend. It may not be ' +
  'installed, enabled in plugins.enabled, or loaded since the last backend restart.'

// ------------------------------------------------------------------ data sources
/** Used when the host offers no plugin REST door: never connected, never loads anything. */
export function createDisabledSource() {
  return { kind: 'disabled', label: 'Not connected', blocker: CONNECTION_BLOCKER }
}

/** The pane's source when the host offers `ctx.rest`: this plugin's own backend namespace. */
export function sourceForContext(ctx) {
  return ctx && typeof ctx.rest === 'function' ? createRestSource(ctx.rest) : createDisabledSource()
}

export function createRestSource(rest) {
  const call = async path => {
    try {
      return await rest(path)
    } catch (cause) {
      // Host-level failure (404 not mounted/disabled, 401, network): the service did not answer.
      const error = new Error(UNREACHABLE)
      error.reason = 'service_unreachable'
      error.cause = cause
      throw error
    }
  }
  const unwrap = reply => {
    if (!reply || reply.ok !== true) {
      const error = new Error((reply && reply.error && reply.error.message) || 'Request failed')
      error.reason = (reply && reply.error && reply.error.reason) || 'request_failed'
      throw error
    }
    return reply.data
  }
  return {
    kind: 'backend',
    label: 'Backend',
    listProfiles: async () => unwrap(await call('/profiles')),
    load: async query => unwrap(await call('/exchanges' + encodeQuery(query)))
  }
}

export function encodeQuery(query) {
  const parts = []
  for (const key of ['viewer_profile', 'limit', 'cursor', 'chat_session_id', 'conversation_id']) {
    const value = query[key]
    if (value !== undefined && value !== null && value !== '') {
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(value)))
    }
  }
  return parts.length ? '?' + parts.join('&') : ''
}

/** Inline filter validation. Returns an error message or null. */
export function validateFilters(filters) {
  if (filters.conversation_id && !ID_RE.test(filters.conversation_id)) {
    return 'Conversation ID: letters, digits and . _ : - only.'
  }
  if (filters.chat_session_id && !SESSION_RE.test(filters.chat_session_id)) {
    return 'Chat session ID: printable characters, no spaces.'
  }
  return null
}

// --------------------------------------------------------------- safe text + labels
// Bidi overrides/isolates, zero-width marks and C0/C1 controls (except newline and tab)
// become visible escapes, so message text cannot reorder or hide what the reviewer sees.
const INVISIBLE_RE = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f​-‏‪-‮⁠-⁩﻿]/g

export function visibleText(text) {
  if (typeof text !== 'string') {
    return ''
  }
  return text.replace(INVISIBLE_RE, ch => '\\u{' + ch.charCodeAt(0).toString(16) + '}')
}

const HANDOFF_LABELS = {
  pending: ['Waiting for handoff', 'muted'],
  prepared: ['Handoff unconfirmed', 'warn'],
  emitted: ['Handed to Hermes job output', 'muted'],
  handoff_unknown: ['Handoff uncertain', 'warn'],
  quarantined: ['Quarantined', 'destructive'],
  cancelled: ['Not delivered: cancelled', 'muted'],
  expired: ['Not delivered: expired', 'muted'],
  rejected: ['Not delivered: rejected', 'destructive'],
  failed: ['Not delivered: failed', 'destructive']
}

export function handoffLabel(handoff) {
  const [label, variant] = HANDOFF_LABELS[handoff.state] || ['Handoff: ' + handoff.state, 'outline']
  return { label, variant }
}

export function hostDeliveryLabel(value) {
  if (value === 'unknown') {
    return { label: 'Chat delivery unknown', variant: 'warn' }
  }
  if (value === 'not_handed_off') {
    return { label: 'Not handed to Hermes', variant: 'muted' }
  }
  return { label: 'Chat delivery: ' + value, variant: 'outline' }
}

const PUBLICATION_LABELS = {
  published: ['Reply published', 'success'],
  publish_unconfirmed: ['Reply publish unconfirmed', 'warn'],
  withheld: ['Reply withheld', 'muted'],
  conflict: ['Reply publish conflict', 'destructive']
}

/** Published is never "received": the reader's receipt is independent evidence we lack. */
export function replyLabels(reply) {
  const [label, variant] = PUBLICATION_LABELS[reply.publication] || ['Reply: ' + reply.publication, 'outline']
  const labels = [{ label, variant }]
  if (reply.file_evidence && reply.file_evidence !== 'present_matching') {
    labels.push({ label: 'File: ' + reply.file_evidence.replace(/_/g, ' '), variant: 'destructive' })
  }
  labels.push({
    label: reply.counterpart_receipt === 'unknown' ? 'Reader receipt unknown' : 'Receipt: ' + reply.counterpart_receipt,
    variant: 'outline'
  })
  return labels
}

// The counterpart's name comes only from the operator's configuration of the subscription
// generation that routed the message (backend `counterpart.attribution`). Nothing here reads
// a name from the payload or turns the source scope into an identity.
const UNKNOWN_WHY = {
  unconfigured: 'unconfigured',
  conflicting: 'routes disagree',
  invalid: 'invalid configuration'
}

/** { name, note, title, configured } for an exchange's or route's `counterpart`. */
export function counterpartLabel(cp) {
  if (cp && cp.attribution === 'configured' && typeof cp.display_name === 'string') {
    return {
      configured: true,
      name: visibleText(cp.display_name),
      note: 'Configured source · not authenticated',
      title:
        'Name from the operator’s configuration for this subscription (id ' +
        visibleText(String(cp.counterpart_id)) +
        '). It is not a verified identity of whoever wrote the message.'
    }
  }
  const why = UNKNOWN_WHY[cp && cp.attribution] || 'unconfigured'
  return {
    configured: false,
    name: 'Unknown source',
    note: why + ' · not authenticated',
    title: 'No operator-configured name applies to this message, so the sender is unknown.'
  }
}

function fmtTime(iso) {
  if (typeof iso !== 'string') {
    return ''
  }
  return iso.replace('T', ' ').replace(/\.\d+Z$/, 'Z')
}

// ------------------------------------------------------------------------ view
// Layout: the conversation first (who wrote what, and what the bot answered), the routing
// and identity metadata one "Details" click away. Warnings that change what the reviewer
// should believe (incomplete results, unconfirmed or failed handoff, file problems) stay
// visible; routine states become one quiet status line.
//
// Styling uses only utility classes the Desktop stylesheet already generates (its Tailwind build
// does not scan plugin files); layout values it lacks go through inline `style`.
const muted = 'text-(--ui-text-tertiary)'
const caption = 'text-[0.6875rem] leading-4'
const rule = 'border-(--ui-stroke-secondary)'

function Pill({ label, variant }) {
  return jsx(Badge, { variant, children: label })
}

function Time({ at }) {
  if (typeof at !== 'string') {
    return null
  }
  return jsx('time', {
    className: 'shrink-0 tabular-nums ' + muted,
    dateTime: at,
    title: at,
    children: fmtTime(at).replace(/:\d\dZ$/, 'Z')
  })
}

/** Button that shows/hides a region; the region is only rendered while open. */
function Toggle({ open, onToggle, controls, label, extra, disabled, slot }) {
  return jsxs(Button, {
    type: 'button',
    size: 'xs',
    variant: open ? 'secondary' : 'ghost',
    'aria-expanded': open,
    'aria-controls': controls,
    'data-slot': slot,
    disabled,
    onClick: onToggle,
    children: [jsx(DisclosureCaret, { open, 'aria-hidden': true }), label, extra || null]
  })
}

function Bubble({ direction, who, at, text, truncated, status }) {
  const inbound = direction === 'in'
  return jsxs('div', {
    className:
      'grid min-w-0 gap-1 rounded-md border px-2.5 py-2 ' +
      rule +
      (inbound ? ' bg-(--ui-bg-tertiary)' : ' ml-4 bg-(--ui-chat-bubble-background)'),
    'data-slot': inbound ? 'exchange-inbound' : 'exchange-reply',
    children: [
      jsxs('div', {
        className: 'flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 ' + caption,
        children: [
          // Wraps rather than truncates: a reply header names both ends (bot → source), and cutting it
          // at a narrow pane hid the counterpart entirely (real-Desktop capture 27-narrow-delta-long).
          jsx('span', {
            className: 'min-w-0 break-words font-medium text-(--ui-text-secondary)',
            'data-slot': 'exchange-bubble-who',
            children: who
          }),
          status || null,
          jsx('span', { className: 'flex-1' }),
          jsx(Time, { at })
        ]
      }),
      jsx('div', {
        className: 'whitespace-pre-wrap break-words text-[0.8125rem] leading-5 text-(--ui-text-primary)',
        'data-slot': 'exchange-text',
        children: text === null || text === undefined ? jsx('span', { className: muted, children: '(no text)' }) : visibleText(text)
      }),
      truncated ? jsx('div', { className: caption + ' ' + muted, children: 'Truncated for display.' }) : null
    ]
  })
}

/** Handoff/subscription states worth a badge; the routine ones join the quiet status line. */
function routeStatus(route) {
  const handoff = handoffLabel(route.handoff)
  const delivery = hostDeliveryLabel(route.host_delivery)
  const loud = []
  const quiet = []
  ;(handoff.variant === 'muted' ? quiet : loud).push(handoff)
  quiet.push(delivery)
  if (route.subscription.effective_state !== 'active') {
    loud.push({ label: 'Subscription ' + route.subscription.effective_state, variant: 'muted' })
  }
  return { loud, quiet }
}

function Route({ route, botLabel }) {
  const { loud, quiet } = routeStatus(route)
  const reply = route.reply
  let replyPart
  if (reply) {
    const [publication, ...rest] = replyLabels(reply)
    const receipt = rest.pop()
    // A reply goes back along its own route, so it names that route's configured source.
    replyPart = jsx(Bubble, {
      direction: 'out',
      who: 'Reply · ' + botLabel + ' → ' + counterpartLabel(route.counterpart).name,
      at: reply.created_utc,
      text: reply.text,
      truncated: reply.text_truncated,
      status: jsxs('span', {
        className: 'flex flex-wrap items-center gap-1',
        children: [
          jsx(Pill, publication),
          ...rest.map(l => jsx(Pill, l, l.label)),
          // Publication is our side only; whether the other agent read it is a separate fact.
          jsx('span', { className: muted, 'data-slot': 'exchange-receipt', children: receipt.label })
        ]
      })
    })
  } else {
    replyPart = jsx('div', {
      className: 'ml-4 ' + caption + ' ' + muted,
      'data-slot': 'exchange-no-reply',
      children: route.reply_allowance === 'open' ? 'No reply yet (one reply allowed).' : 'No reply expected.'
    })
  }
  return jsxs('div', {
    className: 'grid min-w-0 gap-1.5',
    'data-slot': 'exchange-route',
    children: [
      jsxs('div', {
        className: 'ml-4 flex min-w-0 flex-wrap items-center gap-1 ' + caption + ' ' + muted,
        'data-slot': 'exchange-route-status',
        children: [
          ...loud.map(l => jsx(Pill, l, l.label)),
          jsx('span', { children: quiet.map(l => l.label).join(' · ') })
        ]
      }),
      replyPart
    ]
  })
}

function DetailRow({ term, value }) {
  return jsxs('div', {
    className: 'grid min-w-0 gap-2',
    style: { gridTemplateColumns: 'minmax(5rem, 7.5rem) minmax(0, 1fr)' },
    children: [
      jsx('dt', { className: muted, children: term }),
      jsx('dd', { className: 'min-w-0 break-words text-(--ui-text-secondary)', children: value })
    ]
  })
}

function ExchangeDetails({ exchange, id }) {
  const inbound = exchange.inbound
  const cp = exchange.counterpart
  const source = counterpartLabel(cp)
  const rows = [
    ['Record', inbound.record_id + ' v' + inbound.version],
    ['Conversation', exchange.conversation_id || '—'],
    ['Source', source.configured ? source.name + ' [' + visibleText(String(cp.counterpart_id)) + '] · ' + source.note : source.name + ' (' + source.note + ')'],
    ['Source scope', cp.source_scope + ' (unauthenticated source)'],
    ['Observed', fmtTime(inbound.observed_utc) || '—']
  ]
  if (source.configured) {
    // The name is the current configuration; it may have been set after the message arrived.
    rows.splice(3, 0, [
      'Source named',
      fmtTime(cp.configured_utc) + (cp.configured_after_observation ? ' (after this message was observed)' : '')
    ])
  }
  exchange.routes.forEach((route, i) => {
    const p = exchange.routes.length > 1 ? 'Route ' + (i + 1) + ' ' : ''
    if (exchange.routes.length > 1) {
      const r = counterpartLabel(route.counterpart)
      rows.push([p + 'Source', r.configured ? r.name + ' [' + visibleText(String(route.counterpart.counterpart_id)) + ']' : r.name + ' (' + r.note + ')'])
    }
    rows.push([p + 'Subscription', route.sub_id + ' g' + route.generation + ' (' + route.subscription.effective_state + ')'])
    rows.push([p + 'Chat session', route.chat_session_id || '—'])
    rows.push([p + 'Handoff', handoffLabel(route.handoff).label + (route.handoff.reason ? ': ' + visibleText(route.handoff.reason) : '')])
    rows.push([p + 'Chat delivery', hostDeliveryLabel(route.host_delivery).label])
    rows.push([p + 'Reply allowance', String(route.reply_allowance)])
    if (route.reply) {
      rows.push([p + 'Reply', replyLabels(route.reply).map(l => l.label).join(' · ')])
      rows.push([p + 'Reply written', fmtTime(route.reply.created_utc) || '—'])
    }
  })
  return jsx('dl', {
    id,
    className: 'grid min-w-0 gap-1 rounded-md border border-dashed px-2.5 py-2 ' + rule + ' ' + caption,
    'data-slot': 'exchange-details',
    children: rows.map(([term, value]) => jsx(DetailRow, { term, value }, term))
  })
}

function Exchange({ exchange, labels, overview }) {
  const [open, setOpen] = useState(false)
  const inbound = exchange.inbound
  const botLabel = labels[exchange.profile] || exchange.profile
  const detailsId = 'bx-details-' + String(exchange.item_key).replace(/[^A-Za-z0-9_-]/g, '_')
  const source = counterpartLabel(exchange.counterpart)
  return jsxs('article', {
    className: 'grid min-w-0 gap-2 border-b px-3 py-3 ' + rule,
    'data-slot': 'exchange',
    'data-exchange-id': exchange.exchange_id,
    'data-profile': exchange.profile,
    'aria-label': 'Message from ' + source.name + ' to ' + botLabel,
    children: [
      jsxs('div', {
        className: 'flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 ' + caption + ' ' + muted,
        children: [
          overview ? jsx(Pill, { label: botLabel, variant: 'default' }) : null,
          jsxs('span', {
            className: 'min-w-0 break-words text-xs font-medium text-(--ui-text-primary)',
            'data-slot': 'exchange-direction',
            'data-attribution': exchange.counterpart.attribution || 'unconfigured',
            title: source.title,
            children: [source.name, ' → ', botLabel]
          }),
          jsx('span', { className: 'min-w-0 break-words', 'data-slot': 'exchange-source-note', title: source.title, children: source.note }),
          exchange.conversation_id ? jsx('span', { className: 'min-w-0 truncate', children: '· ' + exchange.conversation_id }) : null
        ]
      }),
      jsx(Bubble, {
        direction: 'in',
        who: 'Inbound',
        at: inbound.observed_utc,
        text: inbound.text,
        truncated: inbound.text_truncated
      }),
      exchange.routes.length
        ? exchange.routes.map(route => jsx(Route, { route, botLabel }, route.sub_id + ':' + route.generation))
        : jsx('div', { className: 'ml-4 ' + caption + ' ' + muted, children: 'Not routed: no subscription matched.' }),
      jsx('div', {
        className: 'flex',
        children: jsx(Toggle, {
          open,
          onToggle: () => setOpen(v => !v),
          controls: detailsId,
          label: 'Details',
          slot: 'exchange-details-toggle'
        })
      }),
      open ? jsx(ExchangeDetails, { exchange, id: detailsId }) : null
    ]
  })
}

function SubscriptionLine({ sub, label }) {
  return jsxs('div', {
    className: 'flex min-w-0 flex-wrap items-center gap-1 ' + caption + ' ' + muted,
    'data-slot': 'exchange-subscription',
    children: [
      jsx(Pill, {
        label: label + ' · ' + sub.sub_id + ' g' + sub.generation + ': ' + sub.effective_state,
        variant: sub.effective_state === 'active' ? 'success' : 'muted'
      }),
      jsx('span', {
        'data-slot': 'exchange-subscription-source',
        title: counterpartLabel(sub.counterpart).title,
        children: 'from ' + counterpartLabel(sub.counterpart).name + ' (' + sub.source_scope + ')'
      }),
      jsx('span', { children: 'expires ' + fmtTime(sub.expires_utc) }),
      sub.reply_binding
        ? jsx('span', { children: 'replies ' + sub.replies_used + '/' + sub.reply_binding.max_replies })
        : null
    ]
  })
}

function SourceBanner({ source }) {
  if (source.kind === 'backend') {
    return null
  }
  return jsx('div', {
    className: 'border-b px-3 py-1.5 ' + rule + ' ' + caption + ' ' + muted,
    'data-slot': 'exchange-source',
    children: source.kind === 'fixture' ? 'ISOLATED FIXTURE: synthetic data, not a live backend.' : source.label
  })
}

/** A native select: one line whatever the profile count, fully keyboard-operable. */
function ProfilePicker({ profiles, selected, onSelect }) {
  const options = (profiles.overview ? [{ id: OVERVIEW, label: 'All profiles' }] : []).concat(profiles.profiles)
  return jsx('select', {
    className:
      'h-7 min-w-0 flex-1 rounded-[3px] border bg-transparent px-1.5 text-xs text-(--ui-text-primary) outline-none focus-visible:ring-[0.1875rem] focus-visible:ring-ring/50 ' +
      rule,
    'aria-label': 'Profile',
    'data-slot': 'exchange-profiles',
    style: { flexBasis: '10rem' },
    value: selected || '',
    onChange: event => onSelect(event.target.value),
    children: options.map(p => jsx('option', { value: p.id, children: p.label }, p.id))
  })
}

/** Per-profile availability for the current selection. Never hidden: an unavailable profile
 *  means the view is incomplete, not empty. */
function ProfileStatus({ data }) {
  const down = data.profiles.filter(p => p.status !== 'ok')
  if (!down.length) {
    return null
  }
  return jsxs('div', {
    className: 'grid gap-1 border-b px-3 py-2 ' + rule + ' ' + caption,
    'data-slot': 'exchange-incomplete',
    role: 'status',
    children: [
      jsxs('div', {
        className: 'flex flex-wrap items-center gap-1.5',
        children: [
          jsx(Pill, { label: 'Incomplete: ' + down.length + ' profile(s) unavailable', variant: 'warn' }),
          jsx('span', { className: muted, children: 'Results below leave these out.' })
        ]
      }),
      ...down.map(p => jsx('div', { className: 'text-(--ui-text-secondary)', children: p.label + ': ' + p.reason }, p.id))
    ]
  })
}

/** A response is shown only if it answers the request the pane is currently making. */
export function answersRequest(data, request) {
  if (!data || !data.selection || data.selection.profile !== request.viewer_profile) {
    return false
  }
  const echoed = data.selection.filters || {}
  return ['conversation_id', 'chat_session_id'].every(k => (echoed[k] || '') === (request[k] || ''))
}

const EMPTY_FILTERS = { conversation_id: '', chat_session_id: '' }

export function ExchangePane({ source }) {
  const [profiles, setProfiles] = useState(source.kind === 'disabled' ? null : { status: 'loading' })
  const [selected, setSelected] = useState(null)
  const [draft, setDraft] = useState(EMPTY_FILTERS)
  const [applied, setApplied] = useState(EMPTY_FILTERS)
  const [cursor, setCursor] = useState(null)
  const [state, setState] = useState(source.kind === 'disabled' ? { status: 'disabled' } : { status: 'loading' })
  const [invalid, setInvalid] = useState(null)
  const [nonce, setNonce] = useState(0)
  const [panel, setPanel] = useState(null) // 'filters' | 'subscriptions' | null
  const [aboutOpen, setAboutOpen] = useState(false)

  useEffect(() => {
    if (source.kind === 'disabled') {
      return undefined
    }
    let live = true
    source
      .listProfiles()
      .then(data => {
        if (!live) return
        setProfiles({ status: 'ready', data })
        const first = data.overview ? OVERVIEW : data.profiles[0] && data.profiles[0].id
        setSelected(first || null)
        if (!first) setState({ status: 'error', error: new Error('No profiles are configured for this viewer.') })
      })
      .catch(error => {
        if (!live) return
        setProfiles({ status: 'error', error })
        setState({ status: 'error', error })
      })
    return () => {
      live = false
    }
  }, [source])

  useEffect(() => {
    if (source.kind === 'disabled' || !selected) {
      return undefined
    }
    let live = true
    const request = { viewer_profile: selected, ...applied, cursor, limit: PAGE_SIZE }
    setState({ status: 'loading' }) // switching never leaves another selection's rows on screen
    source
      .load(request)
      .then(data => {
        if (!live) return
        if (!answersRequest(data, request)) {
          setState({ status: 'error', error: new Error('The service answered a different selection; nothing shown.') })
          return
        }
        setState({ status: 'ready', data })
      })
      .catch(error => live && setState({ status: 'error', error }))
    return () => {
      live = false
    }
  }, [source, selected, applied, cursor, nonce])

  const selectProfile = useCallback(id => {
    setCursor(null) // cursors belong to one profile + filter selection
    setSelected(id)
  }, [])

  const apply = useCallback(() => {
    const problem = validateFilters(draft)
    setInvalid(problem)
    if (!problem) {
      setApplied({ ...draft })
      setCursor(null)
    }
  }, [draft])

  const clear = useCallback(() => {
    setInvalid(null)
    setDraft(EMPTY_FILTERS)
    setApplied(EMPTY_FILTERS)
    setCursor(null)
  }, [])

  const labels = {}
  if (profiles && profiles.status === 'ready') {
    for (const p of profiles.data.profiles) labels[p.id] = p.label
  }
  const disabled = source.kind === 'disabled'
  const activeFilters = (applied.conversation_id ? 1 : 0) + (applied.chat_session_id ? 1 : 0)
  const subscriptions = state.status === 'ready' ? state.data.subscriptions : []
  const togglePanel = name => setPanel(p => (p === name ? null : name))

  const toolbar = jsxs('div', {
    className: 'flex min-w-0 flex-wrap items-center gap-1.5 border-b px-3 pb-2 ' + rule,
    'data-slot': 'exchange-toolbar',
    children: [
      profiles && profiles.status === 'ready'
        ? jsx(ProfilePicker, { profiles: profiles.data, selected, onSelect: selectProfile })
        : null,
      jsxs('div', {
        className: 'flex shrink-0 items-center gap-1',
        children: [
          jsx(Toggle, {
            open: panel === 'filters',
            onToggle: () => togglePanel('filters'),
            controls: 'bx-filters',
            label: 'Filters',
            extra: activeFilters ? jsx(Badge, { variant: 'default', children: String(activeFilters) }) : null,
            disabled,
            slot: 'exchange-filters-toggle'
          }),
          subscriptions.length
            ? jsx(Toggle, {
                open: panel === 'subscriptions',
                onToggle: () => togglePanel('subscriptions'),
                controls: 'bx-subscriptions',
                label: 'Subscriptions',
                extra: jsx('span', { className: muted, children: String(subscriptions.length) }),
                slot: 'exchange-subscriptions-toggle'
              })
            : null
        ]
      })
    ]
  })

  const filterPanel = jsxs('form', {
    id: 'bx-filters',
    className: 'grid gap-1.5 border-b px-3 py-2 ' + rule,
    'data-slot': 'exchange-filters',
    onSubmit: event => {
      event.preventDefault()
      apply()
    },
    children: [
      jsx(Input, {
        'aria-label': 'Conversation ID',
        placeholder: 'Conversation ID',
        value: draft.conversation_id,
        disabled,
        onChange: event => setDraft({ ...draft, conversation_id: event.target.value.trim() })
      }),
      jsx(Input, {
        'aria-label': 'Chat session ID',
        placeholder: 'Chat session ID',
        value: draft.chat_session_id,
        disabled,
        onChange: event => setDraft({ ...draft, chat_session_id: event.target.value.trim() })
      }),
      jsxs('div', {
        className: 'flex items-center gap-1.5',
        children: [
          jsx(Button, { type: 'submit', size: 'sm', disabled, children: 'Filter' }),
          jsx(Button, { type: 'button', size: 'sm', variant: 'ghost', disabled, onClick: clear, children: 'Clear' })
        ]
      }),
      invalid ? jsx('div', { className: caption + ' text-destructive', role: 'alert', children: invalid }) : null
    ]
  })

  const subscriptionPanel = jsx('div', {
    id: 'bx-subscriptions',
    className: 'grid gap-1 border-b px-3 py-2 ' + rule,
    'data-slot': 'exchange-subscriptions',
    children: subscriptions.map(sub =>
      jsx(SubscriptionLine, { sub, label: labels[sub.profile] || sub.profile }, sub.profile + ':' + sub.sub_id + ':' + sub.generation)
    )
  })

  let body
  if (state.status === 'disabled') {
    body = jsx(ErrorState, {
      className: 'p-4',
      title: 'Not connected',
      description: source.blocker
    })
  } else if (state.status === 'loading') {
    body = jsxs('div', {
      className: 'grid place-items-center gap-2 p-6 text-xs ' + muted,
      'data-slot': 'exchange-loading',
      children: [jsx(Loader, { label: 'Loading exchanges' }), 'Loading exchanges…']
    })
  } else if (state.status === 'error') {
    body = jsx(ErrorState, {
      className: 'p-4',
      title: 'Could not load exchanges',
      description: String((state.error && state.error.message) || 'Unknown error'),
      // ErrorState lays children out in a grid, which stretched the button across the whole
      // pane in the real Desktop; keep it at its natural width, centered under the message.
      children: jsx('div', {
        className: 'flex justify-center',
        'data-slot': 'exchange-retry',
        children: jsx(Button, { size: 'sm', variant: 'outline', onClick: () => setNonce(n => n + 1), children: 'Retry' })
      })
    })
  } else if (!state.data.exchanges.length) {
    const filtered = applied.conversation_id || applied.chat_session_id
    body = jsxs('div', {
      className: 'grid',
      children: [
        jsx(ProfileStatus, { data: state.data }),
        jsx(EmptyState, {
          title: state.data.complete ? 'No exchanges' : 'No exchanges from available profiles',
          description: !state.data.complete
            ? 'Some profiles could not be read, so this is not a complete answer.'
            : filtered
              ? 'Nothing matches these filters.'
              : 'No inbound messages recorded yet.'
        })
      ]
    })
  } else {
    const page = state.data.page
    const overview = state.data.selection.profile === OVERVIEW
    body = jsxs('div', {
      className: 'grid min-w-0',
      children: [
        jsx(ProfileStatus, { data: state.data }),
        ...state.data.exchanges.map(exchange => jsx(Exchange, { exchange, labels, overview }, exchange.item_key)),
        jsxs('div', {
          className: 'flex flex-wrap items-center justify-between gap-2 px-3 py-2 ' + caption + ' ' + muted,
          children: [
            jsx('span', {
              children: overview
                ? page.returned + ' newest across profiles' + (page.truncated ? '; select a profile to see more' : '')
                : page.returned + ' of ' + page.total_matching + ', newest first'
            }),
            jsxs('div', {
              className: 'flex gap-1.5',
              children: [
                cursor ? jsx(Button, { size: 'sm', variant: 'ghost', onClick: () => setCursor(null), children: 'Newest' }) : null,
                page.next_cursor
                  ? jsx(Button, { size: 'sm', variant: 'ghost', onClick: () => setCursor(page.next_cursor), children: 'Older' })
                  : null
              ]
            })
          ]
        }),
        jsxs('div', {
          className: 'grid gap-1 px-3 pb-3',
          children: [
            jsx('div', {
              className: 'flex',
              children: jsx(Toggle, {
                open: aboutOpen,
                onToggle: () => setAboutOpen(v => !v),
                controls: 'bx-evidence',
                label: 'What these states mean',
                slot: 'exchange-evidence-toggle'
              })
            }),
            aboutOpen
              ? jsx('ul', {
                  id: 'bx-evidence',
                  className: 'grid list-disc gap-0.5 pl-4 ' + caption + ' ' + muted,
                  'data-slot': 'exchange-evidence-limits',
                  children: state.data.evidence_limits.map(item => jsx('li', { children: item }, item))
                })
              : null
          ]
        })
      ]
    })
  }

  return jsxs('section', {
    className: 'flex h-full min-h-0 min-w-0 flex-col overflow-y-auto text-sm',
    'data-slot': 'bounded-exchanges',
    'aria-label': 'Bounded Events exchanges (read-only)',
    children: [
      jsxs('header', {
        className: 'flex items-center gap-2 px-3 pt-2.5 pb-2',
        children: [
          jsx('span', { className: 'text-xs font-medium text-(--ui-text-secondary)', children: 'Exchanges' }),
          jsx(Badge, { variant: 'outline', children: 'read-only' }),
          jsx('span', { className: 'flex-1' }),
          jsx(Button, {
            type: 'button',
            size: 'xs',
            variant: 'ghost',
            disabled,
            onClick: () => setNonce(n => n + 1),
            children: 'Refresh'
          })
        ]
      }),
      jsx(SourceBanner, { source }),
      toolbar,
      panel === 'filters' ? filterPanel : null,
      panel === 'subscriptions' && subscriptions.length ? subscriptionPanel : null,
      body
    ]
  })
}

// ------------------------------------------------------------------ registration
export default {
  id: PLUGIN_ID,
  name: 'Bounded Exchanges',
  defaultEnabled: false,
  register(ctx) {
    const source = sourceForContext(ctx)
    const render = () => jsx(ExchangePane, { source })
    ctx.registerMany([
      {
        id: 'pane',
        area: PANES_AREA,
        title: 'Exchanges',
        data: { placement: 'right', width: '380px' },
        render
      },
      {
        id: 'open',
        area: PALETTE_AREA,
        data: {
          id: PLUGIN_ID + '.open',
          label: 'Open Bounded Exchanges',
          keywords: ['bounded', 'events', 'exchanges', 'external', 'agent', 'reply'],
          run: () => {
            if (typeof host.openWorkspace === 'function') {
              host.openWorkspace(PLUGIN_ID, { title: 'Exchanges', render })
            } else {
              host.notify({ kind: 'info', message: 'Bounded Exchanges is in the Exchanges pane.' })
            }
          }
        }
      }
    ])
  }
}
