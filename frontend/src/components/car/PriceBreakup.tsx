import { useI18n, type MessageKey } from '@/i18n'
import { date, inr } from '@/lib/format'
import type { AccessoryPack, PriceBreakup as Breakup } from '@/lib/types'
import { Chip } from '../ui/Chip'
import { Skeleton } from '../ui/States'
import s from './PriceBreakup.module.css'

/** On-road price as a receipt: every line from the admin price table, a total, a validity date. */
export function PriceBreakup({
  breakup,
  loading,
  error,
  packs,
  packId,
  onPackChange,
}: {
  breakup: Breakup | undefined
  loading: boolean
  error: string | null
  packs: AccessoryPack[]
  packId: number | undefined
  onPackChange: (id: number | undefined) => void
}) {
  const { t } = useI18n()

  return (
    <section className={`${s.receipt} dark`} aria-labelledby="price-title" aria-busy={loading}>
      <header className={s.head}>
        <h2 id="price-title" className="eyebrow">
          {t('price.title')}
          {breakup && ` · ${breakup.city.name}`}
        </h2>
      </header>

      {error ? (
        <p className={s.unavailable}>{error}</p>
      ) : !breakup ? (
        <div className="stack">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} height={18} />
          ))}
        </div>
      ) : (
        <>
          <dl className={s.lines} data-stale={loading || undefined}>
            {breakup.items.map((item) => (
              <div key={item.key} className={s.line}>
                <dt>
                  {t(`price.${item.key}` as MessageKey)}
                  {item.rate !== null && item.key !== 'tcs' && <span className={s.rate}> {Number(item.rate)}%</span>}
                  {item.label && <span className={s.rate}> · {item.label}</span>}
                </dt>
                <dd className="num">{inr(item.amount)}</dd>
              </div>
            ))}
          </dl>
          <div className={s.total}>
            <span>{t('price.total')}</span>
            <strong className="num">{inr(breakup.total)}</strong>
          </div>
        </>
      )}

      {packs.length > 0 && (
        <fieldset className={s.packs}>
          <legend className={s.packLegend}>{t('price.packs')}</legend>
          <div className="row gap-sm">
            <Chip selected={packId === undefined} onClick={() => onPackChange(undefined)} className={s.packChip}>
              {t('price.noPack')}
            </Chip>
            {packs.map((pack) => (
              <Chip
                key={pack.id}
                selected={packId === pack.id}
                onClick={() => onPackChange(pack.id)}
                className={s.packChip}
                title={pack.items.join(', ')}
              >
                {pack.name} <span className="num muted">+{inr(pack.price)}</span>
              </Chip>
            ))}
          </div>
        </fieldset>
      )}

      <footer className={s.foot}>
        {breakup && <p className={s.valid}>{t('price.validUntil', { date: date(breakup.valid_until) })}</p>}
        <p>{t('price.disclaimer')}</p>
      </footer>
    </section>
  )
}
