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

function fmtTime(iso) {
  if (typeof iso !== 'string') {
    return ''
  }
  return iso.replace('T', ' ').replace(/\.\d+Z$/, 'Z')
}

// ------------------------------------------------------------------------ view
const muted = 'text-(--ui-text-tertiary)'

function Pill({ label, variant }) {
  return jsx(Badge, { variant, children: label })
}

function Message({ who, at, text, truncated }) {
  return jsxs('div', {
    className: 'grid gap-1',
    children: [
      jsxs('div', {
        className: 'flex items-baseline justify-between gap-2 text-[0.6875rem] ' + muted,
        children: [jsx('span', { children: who }), jsx('span', { children: fmtTime(at) })]
      }),
      jsx('div', {
        className:
          'whitespace-pre-wrap break-words rounded-md border border-(--ui-stroke-secondary) px-2 py-1.5 text-xs text-(--ui-text-secondary)',
        'data-slot': 'exchange-text',
        children: text === null || text === undefined ? jsx('span', { className: muted, children: '(no text)' }) : visibleText(text)
      }),
      truncated ? jsx('div', { className: 'text-[0.6875rem] ' + muted, children: 'Truncated for display.' }) : null
    ]
  })
}

function Route({ route }) {
  const handoff = handoffLabel(route.handoff)
  const delivery = hostDeliveryLabel(route.host_delivery)
  return jsxs('div', {
    className: 'grid gap-1.5 border-l border-(--ui-stroke-secondary) pl-2',
    'data-slot': 'exchange-route',
    children: [
      jsxs('div', {
        className: 'flex flex-wrap items-center gap-1',
        children: [
          jsx(Pill, handoff),
          jsx(Pill, delivery),
          route.subscription.effective_state !== 'active'
            ? jsx(Pill, { label: 'Subscription ' + route.subscription.effective_state, variant: 'muted' })
            : null,
          route.handoff.reason ? jsx('span', { className: 'text-[0.6875rem] ' + muted, children: visibleText(route.handoff.reason) }) : null
        ]
      }),
      jsx('div', {
        className: 'text-[0.6875rem] ' + muted,
        children: 'chat ' + (route.chat_session_id || '—') + ' · ' + route.sub_id + ' g' + route.generation
      }),
      route.reply
        ? jsxs('div', {
            className: 'grid gap-1',
            children: [
              jsx('div', {
                className: 'flex flex-wrap gap-1',
                children: replyLabels(route.reply).map(l => jsx(Pill, l, l.label))
              }),
              jsx(Message, {
                who: 'Bot reply',
                at: route.reply.created_utc,
                text: route.reply.text,
                truncated: route.reply.text_truncated
              })
            ]
          })
        : jsx('div', {
            className: 'text-[0.6875rem] ' + muted,
            children: route.reply_allowance === 'open' ? 'No reply yet (one reply allowed).' : 'No reply expected.'
          })
    ]
  })
}

function Exchange({ exchange, labels }) {
  const inbound = exchange.inbound
  return jsxs('article', {
    className: 'grid gap-2 border-b border-(--ui-stroke-secondary) px-3 py-2.5',
    'data-slot': 'exchange',
    'data-exchange-id': exchange.exchange_id,
    'data-profile': exchange.profile,
    children: [
      jsxs('div', {
        className: 'flex flex-wrap items-center gap-1 text-[0.6875rem] ' + muted,
        children: [
          jsx(Pill, { label: labels[exchange.profile] || exchange.profile, variant: 'default' }),
          jsx('span', { className: 'font-medium text-(--ui-text-secondary)', children: exchange.counterpart.source_scope }),
          jsx(Pill, { label: 'unauthenticated source', variant: 'outline' }),
          jsx('span', { children: 'conversation ' + (exchange.conversation_id || '—') })
        ]
      }),
      jsx(Message, {
        who: 'Inbound ' + inbound.record_id + ' v' + inbound.version,
        at: inbound.observed_utc,
        text: inbound.text,
        truncated: inbound.text_truncated
      }),
      exchange.routes.length
        ? exchange.routes.map(route => jsx(Route, { route }, route.sub_id + ':' + route.generation))
        : jsx('div', { className: 'text-[0.6875rem] ' + muted, children: 'Not routed: no subscription matched.' })
    ]
  })
}

function SubscriptionLine({ sub, label }) {
  return jsxs('div', {
    className: 'flex flex-wrap items-center gap-1 text-[0.6875rem] ' + muted,
    'data-slot': 'exchange-subscription',
    children: [
      jsx(Pill, {
        label: label + ' · ' + sub.sub_id + ' g' + sub.generation + ': ' + sub.effective_state,
        variant: sub.effective_state === 'active' ? 'success' : 'muted'
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
    className: 'border-b border-(--ui-stroke-secondary) px-3 py-1.5 text-[0.6875rem] ' + muted,
    'data-slot': 'exchange-source',
    children: source.kind === 'fixture' ? 'ISOLATED FIXTURE: synthetic data, not a live backend.' : source.label
  })
}

function ProfilePicker({ profiles, selected, onSelect }) {
  const options = (profiles.overview ? [{ id: OVERVIEW, label: 'All profiles' }] : []).concat(profiles.profiles)
  return jsx('div', {
    className: 'flex flex-wrap gap-1 border-b border-(--ui-stroke-secondary) px-3 py-2',
    role: 'group',
    'aria-label': 'Profile',
    'data-slot': 'exchange-profiles',
    children: options.map(p =>
      jsx(
        Button,
        {
          type: 'button',
          size: 'sm',
          variant: p.id === selected ? 'secondary' : 'ghost',
          'aria-pressed': p.id === selected,
          onClick: () => onSelect(p.id),
          children: p.label
        },
        p.id
      )
    )
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
    className: 'grid gap-1 border-b border-(--ui-stroke-secondary) px-3 py-2 text-[0.6875rem]',
    'data-slot': 'exchange-incomplete',
    role: 'status',
    children: [
      jsx(Pill, { label: 'Incomplete: ' + down.length + ' profile(s) unavailable', variant: 'warn' }),
      ...down.map(p => jsx('div', { className: muted, children: p.label + ': ' + p.reason }, p.id))
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

export function ExchangePane({ source }) {
  const [profiles, setProfiles] = useState(source.kind === 'disabled' ? null : { status: 'loading' })
  const [selected, setSelected] = useState(null)
  const [draft, setDraft] = useState({ conversation_id: '', chat_session_id: '' })
  const [applied, setApplied] = useState({ conversation_id: '', chat_session_id: '' })
  const [cursor, setCursor] = useState(null)
  const [state, setState] = useState(source.kind === 'disabled' ? { status: 'disabled' } : { status: 'loading' })
  const [invalid, setInvalid] = useState(null)
  const [nonce, setNonce] = useState(0)

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

  const labels = {}
  if (profiles && profiles.status === 'ready') {
    for (const p of profiles.data.profiles) labels[p.id] = p.label
  }

  const filterBar = jsxs('form', {
    className: 'grid gap-1.5 border-b border-(--ui-stroke-secondary) px-3 py-2',
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
        disabled: source.kind === 'disabled',
        onChange: event => setDraft({ ...draft, conversation_id: event.target.value.trim() })
      }),
      jsx(Input, {
        'aria-label': 'Chat session ID',
        placeholder: 'Chat session ID',
        value: draft.chat_session_id,
        disabled: source.kind === 'disabled',
        onChange: event => setDraft({ ...draft, chat_session_id: event.target.value.trim() })
      }),
      jsxs('div', {
        className: 'flex items-center gap-1.5',
        children: [
          jsx(Button, { type: 'submit', size: 'sm', disabled: source.kind === 'disabled', children: 'Filter' }),
          jsx(Button, {
            type: 'button',
            size: 'sm',
            variant: 'ghost',
            disabled: source.kind === 'disabled',
            onClick: () => setNonce(n => n + 1),
            children: 'Refresh'
          })
        ]
      }),
      invalid ? jsx('div', { className: 'text-[0.6875rem] text-destructive', role: 'alert', children: invalid }) : null
    ]
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
      children: jsx(Button, { size: 'sm', variant: 'outline', onClick: () => setNonce(n => n + 1), children: 'Retry' })
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
      className: 'grid',
      children: [
        jsx(ProfileStatus, { data: state.data }),
        jsx('div', {
          className: 'grid gap-1 border-b border-(--ui-stroke-secondary) px-3 py-2',
          children: state.data.subscriptions.map(sub =>
            jsx(SubscriptionLine, { sub, label: labels[sub.profile] || sub.profile }, sub.profile + ':' + sub.sub_id + ':' + sub.generation)
          )
        }),
        ...state.data.exchanges.map(exchange => jsx(Exchange, { exchange, labels }, exchange.item_key)),
        jsxs('div', {
          className: 'flex items-center justify-between gap-2 px-3 py-2 text-[0.6875rem] ' + muted,
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
        jsx('ul', {
          className: 'grid gap-0.5 px-3 pb-3 text-[0.6875rem] ' + muted,
          'data-slot': 'exchange-evidence-limits',
          children: state.data.evidence_limits.map(item => jsx('li', { children: item }, item))
        })
      ]
    })
  }

  return jsxs('section', {
    className: 'flex h-full min-h-0 flex-col overflow-y-auto text-sm',
    'data-slot': 'bounded-exchanges',
    'aria-label': 'Bounded Events exchanges (read-only)',
    children: [
      jsx('header', {
        className: 'px-3 pt-2.5 pb-1 text-xs font-medium text-(--ui-text-secondary)',
        children: 'Exchanges · read-only'
      }),
      jsx(SourceBanner, { source }),
      profiles && profiles.status === 'ready'
        ? jsx(ProfilePicker, { profiles: profiles.data, selected, onSelect: selectProfile })
        : null,
      filterBar,
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
