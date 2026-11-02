import { Tag } from '@/components/ui/Chip'
import { duration } from '@/lib/format'
import s from './Inbox.module.css'

export function ResponseTimer({ createdAt, respondedAt, now, sla }: { createdAt: string; respondedAt: string | null; now: number; sla: number }) {
  const start = new Date(createdAt).getTime()
  if (respondedAt) {
    const took = new Date(respondedAt).getTime() - start
    return <Tag tone={took <= sla * 60_000 ? 'ok' : 'neutral'}>replied in {duration(took)}</Tag>
  }
  const waited = now - start
  const late = waited > sla * 60_000
  return (
    <Tag tone={late ? 'danger' : 'accent'}>
      <span className={late ? undefined : s.pulse} aria-hidden />
      {late ? 'overdue' : 'waiting'} {duration(waited)}
    </Tag>
  )
}
