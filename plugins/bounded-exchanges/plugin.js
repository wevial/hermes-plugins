// Bounded Exchanges — read-only review of Bounded Events exchanges in Hermes Desktop.
//
// Plain ESM, loaded uncompiled: jsx()/jsxs() calls, no JSX syntax, and only the three
// specifiers the loader allows. The pane shows inbound messages from an external agent with
// their routing state and correlated bot replies. It has no send, replay, approval or
// subscription controls.
//
// BACKEND CONNECTION IS DISABLED. The read model ships in the bounded-events repository
// (`bounded_events/exchange_view.py`, served shape from `exchange_api.handle`). No Desktop
// backend route is mounted because the profile scope of a plugin REST call could not be
// proven. See README.md, "Why the pane is not connected". The registered pane therefore
// renders an explicit "not connected" state. It never shows sample data as if it were live.

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

export const CONNECTION_BLOCKER =
  'Desktop cannot yet prove which profile a plugin backend request belongs to, so this pane ' +
  'reads nothing. Use the terminal viewer: python3 -m bounded_events exchanges --root ROOT'

// ------------------------------------------------------------------ data sources
/** The source the registered pane uses: never connected, never loads anything. */
export function createDisabledSource() {
  return { kind: 'disabled', label: 'Not connected', blocker: CONNECTION_BLOCKER }
}

/** A connected source over the plugin's own backend namespace. NOT used by `register` until
 *  the backend scope seam is resolved; kept so the query contract has one definition. */
export function createRestSource(rest) {
  return {
    kind: 'backend',
    label: 'Backend',
    load: async query => {
      const reply = await rest('/exchanges' + encodeQuery(query))
      if (!reply || reply.ok !== true) {
        const error = new Error((reply && reply.error && reply.error.message) || 'Request failed')
        error.reason = (reply && reply.error && reply.error.reason) || 'request_failed'
        throw error
      }
      return reply.data
    }
  }
}

export function encodeQuery(query) {
  const parts = []
  for (const key of ['limit', 'cursor', 'chat_session_id', 'conversation_id']) {
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

function Exchange({ exchange }) {
  const inbound = exchange.inbound
  return jsxs('article', {
    className: 'grid gap-2 border-b border-(--ui-stroke-secondary) px-3 py-2.5',
    'data-slot': 'exchange',
    'data-exchange-id': exchange.exchange_id,
    children: [
      jsxs('div', {
        className: 'flex flex-wrap items-center gap-1 text-[0.6875rem] ' + muted,
        children: [
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

function SubscriptionLine({ sub }) {
  return jsxs('div', {
    className: 'flex flex-wrap items-center gap-1 text-[0.6875rem] ' + muted,
    'data-slot': 'exchange-subscription',
    children: [
      jsx(Pill, {
        label: sub.sub_id + ' g' + sub.generation + ': ' + sub.effective_state,
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

export function ExchangePane({ source }) {
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
    setState({ status: 'loading' })
    source
      .load({ ...applied, cursor, limit: PAGE_SIZE })
      .then(data => live && setState({ status: 'ready', data }))
      .catch(error => live && setState({ status: 'error', error }))
    return () => {
      live = false
    }
  }, [source, applied, cursor, nonce])

  const apply = useCallback(() => {
    const problem = validateFilters(draft)
    setInvalid(problem)
    if (!problem) {
      setApplied({ ...draft })
      setCursor(null)
    }
  }, [draft])

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
    body = jsx(EmptyState, {
      title: 'No exchanges',
      description: applied.conversation_id || applied.chat_session_id ? 'Nothing matches these filters.' : 'No inbound messages recorded yet.'
    })
  } else {
    const page = state.data.page
    body = jsxs('div', {
      className: 'grid',
      children: [
        jsx('div', {
          className: 'grid gap-1 border-b border-(--ui-stroke-secondary) px-3 py-2',
          children: state.data.subscriptions.map(sub => jsx(SubscriptionLine, { sub }, sub.sub_id + ':' + sub.generation))
        }),
        ...state.data.exchanges.map(exchange => jsx(Exchange, { exchange }, exchange.exchange_id)),
        jsxs('div', {
          className: 'flex items-center justify-between gap-2 px-3 py-2 text-[0.6875rem] ' + muted,
          children: [
            jsx('span', { children: page.returned + ' of ' + page.total_matching + ', newest first' }),
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
    const source = createDisabledSource()
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
