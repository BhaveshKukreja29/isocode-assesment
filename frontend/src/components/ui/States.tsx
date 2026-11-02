import type { CSSProperties, ReactNode } from 'react'
import { useI18n } from '@/i18n'
import { Button } from './Button'
import s from './States.module.css'

export function Skeleton({ height = 16, width = '100%', radius, style }: {
  height?: number | string
  width?: number | string
  radius?: number | string
  style?: CSSProperties
}) {
  return <span className={s.skeleton} style={{ height, width, borderRadius: radius, ...style }} aria-hidden />
}

export function PageLoader() {
  return (
    <div className={s.loader} role="status" aria-label="Loading">
      <span />
    </div>
  )
}

export function ErrorState({ error, onRetry, title }: { error?: unknown; onRetry?: () => void; title?: string }) {
  const { t } = useI18n()
  const message = error instanceof Error ? error.message : undefined
  return (
    <div className={s.state} role="alert">
      <p className={s.title}>{title ?? t('common.error')}</p>
      {message && <p className="muted">{message}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className={s.state}>
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden>
        <rect x="4" y="16" width="32" height="12" rx="4" stroke="currentColor" strokeWidth="2" />
        <path d="M9 16l4-7h14l4 7" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="12" cy="28" r="3" fill="var(--accent)" stroke="currentColor" strokeWidth="2" />
        <circle cx="28" cy="28" r="3" fill="var(--accent)" stroke="currentColor" strokeWidth="2" />
      </svg>
      <p className={s.title}>{title}</p>
      {hint && <p className="muted">{hint}</p>}
      {action}
    </div>
  )
}
