import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Tag } from '@/components/ui/Chip'
import { Checkbox } from '@/components/ui/Field'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { useI18n, type MessageKey } from '@/i18n'
import { api } from '@/lib/api'
import { useLogout } from '@/lib/auth'
import { date, dateTime } from '@/lib/format'
import { keys, useActivity, useMe } from '@/lib/queries'
import type { User } from '@/lib/types'
import page from './Page.module.css'
import s from './Account.module.css'

export default function Account() {
  const { t } = useI18n()
  const { data: me } = useMe()
  const activity = useActivity(!!me)
  const logout = useLogout()
  const navigate = useNavigate()
  const client = useQueryClient()

  const preferences = useMutation({
    mutationFn: (optOut: boolean) => api<User>('/me/preferences', { method: 'PUT', body: { marketing_opt_out: optOut } }),
    onSuccess: (user) => client.setQueryData(keys.me, user),
  })
  const erase = useMutation({
    mutationFn: () => api<void>('/me', { method: 'DELETE' }),
    onSuccess: () => {
      client.clear()
      client.setQueryData(keys.me, null)
      navigate('/', { replace: true })
    },
  })

  if (!me) return null

  return (
    <div className={`${page.narrow} section ${s.page}`}>
      <title>My account · Company A</title>
      <header className={s.head}>
        <div>
          <p className="eyebrow">{me.email}</p>
          <h1 className={page.title}>{me.name}</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/') })}>
          {t('auth.signOut')}
        </Button>
      </header>

      <section className={page.panel} aria-labelledby="activity">
        <h2 id="activity" className={s.sectionTitle}>
          {t('account.activity')}
        </h2>
        {activity.isPending ? (
          <div className="stack">
            <Skeleton height={56} />
            <Skeleton height={56} />
          </div>
        ) : activity.error ? (
          <ErrorState error={activity.error} onRetry={activity.refetch} />
        ) : activity.data.length === 0 ? (
          <EmptyState title={t('account.empty')} />
        ) : (
          <ul className={s.list}>
            {activity.data.map((item) => (
              <li key={item.lead_id}>
                <div>
                  <strong>{item.subject ?? t(`kind.${item.kind}` as MessageKey)}</strong>
                  <p className="muted">
                    {t(`kind.${item.kind}` as MessageKey)} · {date(item.created_at)}
                    {item.showroom && ` · ${item.showroom}`}
                  </p>
                  {item.test_drive_at && <p className={s.when}>{dateTime(item.test_drive_at)}</p>}
                </div>
                <Tag tone={item.status === 'won' ? 'ok' : item.status === 'lost' ? 'neutral' : 'accent'}>
                  {t(`status.${item.status}` as MessageKey)}
                </Tag>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${page.panel} stack`} aria-labelledby="privacy">
        <h2 id="privacy" className={s.sectionTitle}>
          {t('account.privacy')}
        </h2>
        <Checkbox
          label={
            <>
              <strong>{t('account.optOut')}</strong>
              <br />
              {t('account.optOutHint')}
            </>
          }
          checked={me.marketing_opt_out}
          disabled={preferences.isPending}
          onChange={(e) => preferences.mutate(e.target.checked)}
        />
        <div className={s.danger}>
          <p className="muted">{t('account.deleteHint')}</p>
          <Button
            variant="danger"
            size="sm"
            loading={erase.isPending}
            onClick={() => window.confirm(t('account.deleteConfirm')) && erase.mutate()}
          >
            {t('account.delete')}
          </Button>
        </div>
      </section>
    </div>
  )
}
