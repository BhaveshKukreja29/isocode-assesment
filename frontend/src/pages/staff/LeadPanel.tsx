import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Tag } from '@/components/ui/Chip'
import { Select, Textarea } from '@/components/ui/Field'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { dateTime, number, titleCase } from '@/lib/format'
import { STATUS_TONE, useConsultants, useInboxStats, useLead, useLeadAction } from '@/lib/staff'
import type { AiSummary, LeadDetail, LeadEvent, LeadStatus } from '@/lib/types'
import { ResponseTimer } from './ResponseTimer'
import s from './LeadPanel.module.css'

const STATUSES: LeadStatus[] = ['new', 'contacted', 'test_drive', 'negotiation', 'won', 'lost']
// Mirrors the server guardrail so consultants see the problem before pressing send.
const DISCOUNT_HINT = /\b(discount\w*|cashback|offers?|deals?|for free|negotia\w*)\b/i

export function LeadPanel({ id, now }: { id: number; now: number }) {
  const { data: lead, error, refetch, isPending } = useLead(id)
  const [params] = useSearchParams()

  if (isPending) {
    return (
      <div className={s.panel}>
        <Skeleton width="40%" height={28} />
        <Skeleton height={140} />
        <Skeleton height={180} />
      </div>
    )
  }
  if (error) return <ErrorState error={error} onRetry={refetch} />

  return (
    <div className={s.panel}>
      <Link to={`/staff${params.size ? `?${params}` : ''}`} className={s.back}>
        ← All leads
      </Link>
      <Header lead={lead} now={now} />
      <div className={s.columns}>
        <div className={s.col}>
          <AiCard lead={lead} />
          <Composer key={`${lead.id}-${lead.ai_draft ?? ''}`} lead={lead} />
        </div>
        <div className={s.col}>
          <BuyerCard lead={lead} />
          <Timeline events={lead.events} />
        </div>
      </div>
    </div>
  )
}

function Header({ lead, now }: { lead: LeadDetail; now: number }) {
  const actions = useLeadAction(lead.id)
  const { data: consultants } = useConsultants()
  const { data: stats } = useInboxStats()
  const error = actions.status.error ?? actions.assign.error

  return (
    <header className={s.header}>
      <div className={s.identity}>
        <div className="row gap-sm">
          <Tag tone={STATUS_TONE[lead.status]}>{titleCase(lead.status)}</Tag>
          <Tag>{titleCase(lead.kind)}</Tag>
          <Tag>{titleCase(lead.source)}</Tag>
          <ResponseTimer createdAt={lead.created_at} respondedAt={lead.first_response_at} now={now} sla={stats?.sla_minutes ?? 5} />
        </div>
        <h1 className={s.name}>{lead.name}</h1>
        <p className={s.contact}>
          <a href={`tel:+91${lead.phone}`} className="num">
            +91 {lead.phone.slice(0, 5)} {lead.phone.slice(5)}
          </a>
          {lead.email && <a href={`mailto:${lead.email}`}>{lead.email}</a>}
          <span className="muted">Received {dateTime(lead.created_at)}</span>
        </p>
        {lead.opted_out && <p className={s.optOut}>Opted out of messages. Call only.</p>}
      </div>
      <div className={s.controls}>
        <Select
          label="Status"
          value={lead.status}
          disabled={actions.status.isPending}
          onChange={(e) => actions.status.mutate(e.target.value as LeadStatus)}
        >
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {titleCase(status)}
            </option>
          ))}
        </Select>
        <Select
          label="Consultant"
          value={lead.assigned_to?.id ?? ''}
          disabled={actions.assign.isPending}
          onChange={(e) => actions.assign.mutate(Number(e.target.value))}
        >
          {!lead.assigned_to && <option value="">Unassigned</option>}
          {consultants?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        {error && (
          <p className={s.error} role="alert">
            {error.message}
          </p>
        )}
      </div>
    </header>
  )
}

const SUMMARY_FIELDS: [keyof AiSummary, string][] = [
  ['interest', 'Interested in'],
  ['budget', 'Budget'],
  ['timeline', 'Timeline'],
  ['finance', 'Finance'],
  ['trade_in', 'Trade-in'],
]

const FLAG_TEXT: Record<string, string> = {
  llm_disabled: 'AI is switched off (no API key), so this summary comes from keyword rules.',
  llm_failed: 'The AI service did not answer in time, so this summary comes from keyword rules.',
  'draft_replaced:mentions_discount': 'The AI draft mentioned a discount, so it was replaced with a safe template.',
  'draft_replaced:quotes_price': 'The AI draft quoted a price, so it was replaced with a safe template. Prices come only from the price table.',
}

function AiCard({ lead }: { lead: LeadDetail }) {
  const { regenerate } = useLeadAction(lead.id)
  const summary = lead.ai_summary

  return (
    <section className={`${s.card} ${s.ai} dark`} aria-labelledby="ai-title">
      <div className={s.cardHead}>
        <h2 id="ai-title" className="eyebrow">
          Buyer summary
        </h2>
        {summary && (
          <span className="row gap-sm">
            <Tag tone={summary.confidence === 'low' ? 'warn' : summary.confidence === 'high' ? 'accent' : 'neutral'}>
              {summary.confidence === 'low' ? 'unsure: confirm with buyer' : `${summary.confidence} confidence`}
            </Tag>
            <Tag tone="neutral">{summary.source === 'llm' ? 'AI' : 'Rules'}</Tag>
          </span>
        )}
      </div>

      {!summary ? (
        <div className="stack">
          <Skeleton height={20} />
          <Skeleton height={60} />
          <p className="muted">Summarising…</p>
        </div>
      ) : (
        <>
          <p className={s.headline}>{summary.headline}</p>
          <dl className={s.summary}>
            {SUMMARY_FIELDS.map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd data-empty={!summary[key] || undefined}>{(summary[key] as string) || 'Not mentioned'}</dd>
              </div>
            ))}
            {summary.preferences.length > 0 && (
              <div className={s.wide}>
                <dt>Preferences</dt>
                <dd className="row gap-sm">
                  {summary.preferences.map((p) => (
                    <Tag key={p}>{p}</Tag>
                  ))}
                </dd>
              </div>
            )}
          </dl>
          {summary.ask_next.length > 0 && (
            <div className={s.askNext}>
              <p className="eyebrow">Ask on the call</p>
              <ul>
                {summary.ask_next.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          {summary.flags.map((flag) => FLAG_TEXT[flag] && (
            <p key={flag} className={s.flag}>
              {FLAG_TEXT[flag]}
            </p>
          ))}
        </>
      )}
      <Button variant="outline" size="sm" loading={regenerate.isPending} onClick={() => regenerate.mutate()}>
        Regenerate
      </Button>
    </section>
  )
}

function Composer({ lead }: { lead: LeadDetail }) {
  const { contact } = useLeadAction(lead.id)
  const [channel, setChannel] = useState<'whatsapp' | 'sms' | 'call'>(lead.opted_out ? 'call' : 'whatsapp')
  const [body, setBody] = useState(lead.ai_draft ?? '')
  const isCall = channel === 'call'
  const discountWarning = !isCall && DISCOUNT_HINT.test(body)

  return (
    <section className={s.card} aria-labelledby="reply-title">
      <div className={s.cardHead}>
        <h2 id="reply-title" className="eyebrow">
          {isCall ? 'Log a call' : 'First reply'}
        </h2>
        {!isCall && lead.ai_draft && <Tag>AI draft · edit before sending</Tag>}
      </div>
      <div className={s.channels} role="radiogroup" aria-label="Channel">
        {(['whatsapp', 'sms', 'call'] as const).map((c) => (
          <button
            key={c}
            role="radio"
            aria-checked={channel === c}
            disabled={c !== 'call' && lead.opted_out}
            className={s.channel}
            onClick={() => setChannel(c)}
          >
            {c === 'whatsapp' ? 'WhatsApp' : c === 'sms' ? 'SMS' : 'Call notes'}
          </button>
        ))}
      </div>
      <Textarea
        label={<span className="visually-hidden">Message</span>}
        value={body}
        rows={isCall ? 3 : 6}
        maxLength={1000}
        placeholder={isCall ? 'What did you discuss?' : 'Write a reply'}
        onChange={(e) => setBody(e.target.value)}
        error={discountWarning ? 'Remove discount or offer wording: messages cannot promise money off.' : undefined}
      />
      {contact.error && (
        <p className={s.error} role="alert">
          {contact.error.message}
        </p>
      )}
      <div className="row">
        <span className="muted" style={{ fontSize: '0.8rem' }}>
          {isCall ? 'Counts as first response.' : 'Sent as a mock message and logged on the timeline.'}
        </span>
        <span className="spacer" />
        <Button
          variant="dark"
          loading={contact.isPending}
          disabled={body.trim().length < 2 || discountWarning}
          onClick={() => contact.mutate({ channel, body: body.trim() }, { onSuccess: () => setBody('') })}
        >
          {isCall ? 'Save call' : `Send ${channel === 'sms' ? 'SMS' : 'WhatsApp'}`}
        </Button>
      </div>
    </section>
  )
}

function BuyerCard({ lead }: { lead: LeadDetail }) {
  const tradeIn = lead.details.trade_in
  return (
    <section className={s.card} aria-labelledby="buyer-title">
      <h2 id="buyer-title" className="eyebrow">
        What they asked
      </h2>
      <p className={s.quote}>{lead.message || <span className="muted">No message.</span>}</p>
      <dl className={s.meta}>
        <div>
          <dt>Interested in</dt>
          <dd>
            {lead.used_car_slug ? (
              <Link to={`/used-cars/${lead.used_car_slug}`} target="_blank">
                {lead.subject} ↗
              </Link>
            ) : (
              (lead.subject ?? lead.details.model_text ?? '—')
            )}
          </dd>
        </div>
        <div>
          <dt>Showroom</dt>
          <dd>{lead.showroom?.name ?? 'Not chosen'}</dd>
        </div>
        {lead.details.portal && (
          <div>
            <dt>Portal</dt>
            <dd>{lead.details.portal}</dd>
          </div>
        )}
        {tradeIn && (
          <div>
            <dt>Trade-in car</dt>
            <dd>
              {tradeIn.year} {tradeIn.make} {tradeIn.model}, {number(Number(tradeIn.km))} km
            </dd>
          </div>
        )}
      </dl>
      {lead.test_drives.map((drive) => (
        <div key={drive.id} className={s.drive}>
          <Tag tone={drive.status === 'booked' ? 'accent' : 'neutral'}>Test drive · {drive.status}</Tag>
          <strong>{dateTime(drive.starts_at)}</strong>
          <span className="muted">
            {drive.car} · {drive.showroom}
          </span>
        </div>
      ))}
    </section>
  )
}

function describe(event: LeadEvent): string {
  const d = event.data as Record<string, string>
  switch (event.kind) {
    case 'created':
      return `Lead received from ${titleCase(d.source ?? 'website')}`
    case 'assigned':
      return `Auto-assigned to ${d.to}`
    case 'reassigned':
      return `Reassigned from ${d.from ?? 'nobody'} to ${d.to}`
    case 'status':
      return `Status ${titleCase(d.from)} → ${titleCase(d.to)}`
    case 'ai':
      return d.source === 'llm' ? 'AI summary and draft ready' : 'Summary and draft generated by rules'
    case 'message':
      return d.channel === 'call' ? 'Call logged' : `${d.channel === 'sms' ? 'SMS' : 'WhatsApp'} sent`
  }
}

function Timeline({ events }: { events: LeadEvent[] }) {
  return (
    <section className={s.card} aria-labelledby="timeline-title">
      <h2 id="timeline-title" className="eyebrow">
        Timeline
      </h2>
      <ol className={s.timeline}>
        {[...events].reverse().map((event) => (
          <li key={event.id} data-kind={event.kind}>
            <div className={s.eventHead}>
              <strong>{describe(event)}</strong>
              <span className="muted num">{dateTime(event.created_at)}</span>
            </div>
            {event.actor && <span className="muted">by {event.actor.name}</span>}
            {typeof event.data.body === 'string' && event.data.body && <p className={s.bubble}>{event.data.body}</p>}
          </li>
        ))}
      </ol>
    </section>
  )
}
