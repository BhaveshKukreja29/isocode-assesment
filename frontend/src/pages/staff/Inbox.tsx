import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Chip, Tag } from '@/components/ui/Chip'
import { Input } from '@/components/ui/Field'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { titleCase } from '@/lib/format'
import { STATUS_TONE, useInboxStats, useLeads, useNow, type LeadFilters } from '@/lib/staff'
import type { LeadRow, LeadStatus } from '@/lib/types'
import { useDebounced } from '@/lib/useDebounced'
import { ImportSheet } from './ImportSheet'
import { LeadPanel } from './LeadPanel'
import { ResponseTimer } from './ResponseTimer'
import s from './Inbox.module.css'

const SCOPES: [LeadFilters['scope'], string][] = [
  ['mine', 'Mine'],
  ['showroom', 'My showroom'],
  ['unassigned', 'Unassigned'],
  ['all', 'All'],
]
const STATUSES: LeadStatus[] = ['new', 'contacted', 'test_drive', 'negotiation', 'won', 'lost']

export default function Inbox() {
  const { id } = useParams()
  const leadId = id ? Number(id) : undefined
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') ?? '')
  const [importOpen, setImportOpen] = useState(false)
  const q = useDebounced(search.trim())
  const now = useNow()

  const filters: LeadFilters = {
    scope: (params.get('scope') as LeadFilters['scope']) ?? 'mine',
    status: params.getAll('status') as LeadStatus[],
    q,
    page: Number(params.get('page') ?? 1),
  }
  const leads = useLeads(filters)
  const stats = useInboxStats()
  const pages = leads.data ? Math.max(1, Math.ceil(leads.data.total / leads.data.page_size)) : 1

  const set = (key: string, value: string | string[] | null) =>
    setParams(
      (p) => {
        p.delete(key)
        p.delete('page')
        if (Array.isArray(value)) value.forEach((v) => p.append(key, v))
        else if (value) p.set(key, value)
        return p
      },
      { replace: true },
    )

  const toggleStatus = (status: LeadStatus) =>
    set('status', filters.status.includes(status) ? filters.status.filter((x) => x !== status) : [...filters.status, status])

  return (
    <div className={s.page} data-detail={leadId !== undefined || undefined}>
      <title>Lead inbox · Company A</title>
      <section className={s.stats} aria-label="Response stats">
        <Stat label="Open leads" value={stats.data?.open} />
        <Stat label="Awaiting first reply" value={stats.data?.awaiting_reply} />
        <Stat label={`Over ${stats.data?.sla_minutes ?? 5} min`} value={stats.data?.overdue} alert={!!stats.data?.overdue} />
        <Stat
          label={`Answered in ${stats.data?.sla_minutes ?? 5} min · 30d`}
          value={stats.data?.answered_in_sla_pct != null ? `${stats.data.answered_in_sla_pct}%` : '—'}
        />
        <Stat
          label="Median first response"
          value={stats.data?.median_response_minutes != null ? `${stats.data.median_response_minutes}m` : '—'}
        />
      </section>

      <div className={s.split}>
        <section className={s.listPane} aria-label="Leads">
          <div className={s.toolbar}>
            <div className={s.scopes} role="tablist">
              {SCOPES.map(([value, label]) => (
                <button
                  key={value}
                  role="tab"
                  aria-selected={filters.scope === value}
                  className={s.scope}
                  onClick={() => set('scope', value === 'mine' ? null : value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className={s.searchRow}>
              <Input
                label={<span className="visually-hidden">Search leads</span>}
                type="search"
                placeholder="Search name or phone"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                Import CSV
              </Button>
            </div>
            <div className={s.statusRow}>
              {STATUSES.map((status) => (
                <Chip key={status} selected={filters.status.includes(status)} onClick={() => toggleStatus(status)} className={s.statusChip}>
                  {titleCase(status)}
                </Chip>
              ))}
            </div>
          </div>

          <div className={s.list} data-stale={leads.isPlaceholderData || undefined}>
            {leads.error ? (
              <ErrorState error={leads.error} onRetry={leads.refetch} />
            ) : leads.isPending ? (
              Array.from({ length: 6 }, (_, i) => (
                <div key={i} className={s.rowSkeleton}>
                  <Skeleton width="50%" />
                  <Skeleton width="80%" height={12} />
                </div>
              ))
            ) : leads.data.items.length === 0 ? (
              <EmptyState title="No leads here" hint="Try another tab or clear the filters." />
            ) : (
              leads.data.items.map((lead) => (
                <LeadListItem key={lead.id} lead={lead} now={now} active={lead.id === leadId} sla={stats.data?.sla_minutes ?? 5} showOwner={filters.scope !== 'mine'} />
              ))
            )}
          </div>

          {pages > 1 && (
            <nav className={s.pager} aria-label="Pagination">
              <Button size="sm" variant="ghost" disabled={filters.page <= 1} onClick={() => setParams((p) => { p.set('page', String(filters.page - 1)); return p })}>
                ←
              </Button>
              <span className="num muted">
                {filters.page} / {pages} · {leads.data?.total} leads
              </span>
              <Button size="sm" variant="ghost" disabled={filters.page >= pages} onClick={() => setParams((p) => { p.set('page', String(filters.page + 1)); return p })}>
                →
              </Button>
            </nav>
          )}
        </section>

        <section className={s.detailPane} aria-label="Lead detail">
          {leadId ? (
            <LeadPanel id={leadId} now={now} />
          ) : (
            <EmptyState title="Pick a lead" hint="Unanswered leads are at the top. Every lead should hear from us within 5 minutes." />
          )}
        </section>
      </div>

      <ImportSheet open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  )
}

function Stat({ label, value, alert }: { label: string; value: number | string | undefined; alert?: boolean }) {
  return (
    <div className={s.stat} data-alert={alert || undefined}>
      <span className="num">{value ?? '—'}</span>
      <span className={s.statLabel}>{label}</span>
    </div>
  )
}

function LeadListItem({ lead, now, active, sla, showOwner }: { lead: LeadRow; now: number; active: boolean; sla: number; showOwner: boolean }) {
  const [params] = useSearchParams()
  return (
    <Link
      to={`/staff/leads/${lead.id}${params.size ? `?${params}` : ''}`}
      preventScrollReset
      className={s.row}
      aria-current={active || undefined}
    >
      <div className={s.rowTop}>
        <strong>{lead.name}</strong>
        <ResponseTimer createdAt={lead.created_at} respondedAt={lead.first_response_at} now={now} sla={sla} />
      </div>
      <p className={s.headline}>{lead.headline ?? lead.subject ?? 'Summarising…'}</p>
      <div className={s.rowMeta}>
        <Tag tone={STATUS_TONE[lead.status]}>{titleCase(lead.status)}</Tag>
        <span className="muted">{titleCase(lead.source)}</span>
        {lead.showroom && <span className="muted">· {lead.showroom.name}</span>}
        {showOwner && <span className="muted">· {lead.assigned_to?.name ?? 'Unassigned'}</span>}
      </div>
    </Link>
  )
}
