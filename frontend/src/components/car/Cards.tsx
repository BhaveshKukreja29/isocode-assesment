import { useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useI18n, type MessageKey } from '@/i18n'
import { useCity } from '@/lib/city'
import { km, lakh } from '@/lib/format'
import { ownerLabel } from '@/lib/labels'
import { modelQuery } from '@/lib/queries'
import type { ModelCard as Model, UsedCarCard as UsedCar } from '@/lib/types'
import { Tag } from '../ui/Chip'
import { Img } from '../ui/Img'
import { Skeleton } from '../ui/States'
import s from './Cards.module.css'

const CARD_SIZES = '(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 400px'

export function ModelCard({ model, priority }: { model: Model; priority?: boolean }) {
  const { t } = useI18n()
  const { city } = useCity()
  const client = useQueryClient()
  // Warm the cache on intent so the model page opens instantly.
  const prefetch = () => client.prefetchQuery({ ...modelQuery(model.slug, city), staleTime: 60_000 })

  return (
    <Link to={`/cars/${model.slug}`} className={s.card} onPointerEnter={prefetch} onFocus={prefetch}>
      <Img src={model.image} alt={model.name} sizes={CARD_SIZES} priority={priority} className={s.media} />
      <div className={s.body}>
        <div className="row gap-sm">
          <Tag>{model.body_type}</Tag>
          {model.fuels.map((f) => (
            <Tag key={f}>{t(`fuel.${f}` as MessageKey)}</Tag>
          ))}
        </div>
        <h3 className={s.title}>{model.name}</h3>
        <p className="muted">{model.tagline}</p>
        {model.from_price !== null && (
          <p className={s.price}>
            <span className="muted">{t('common.from')} </span>
            <strong className="num">{lakh(model.from_price)}</strong>
            <span className="muted"> {t('common.exShowroom')}</span>
          </p>
        )}
      </div>
    </Link>
  )
}

export function UsedCarCard({ car }: { car: UsedCar }) {
  const { t } = useI18n()
  return (
    <Link to={`/used-cars/${car.slug}`} className={s.card}>
      <div className={s.mediaWrap}>
        <Img src={car.image} alt={`${car.year} ${car.model} ${car.variant}`} sizes={CARD_SIZES} className={s.media} />
        <span className={s.stock}>
          <Tag tone="dark">{car.stock_id}</Tag>
          {car.status === 'booked' && <Tag tone="warn">{t('used.booked')}</Tag>}
        </span>
      </div>
      <div className={s.body}>
        <h3 className={s.title}>
          {car.year} {car.model} <span className={s.variant}>{car.variant}</span>
        </h3>
        <p className={`${s.facts} muted`}>
          <span className="num">{km(car.km)}</span>
          <span>{t(`fuel.${car.fuel}` as MessageKey)}</span>
          <span>{t(`tx.${car.transmission}` as MessageKey)}</span>
          <span>{ownerLabel(t, car.owners)}</span>
        </p>
        <p className={s.priceRow}>
          <strong className="num">{lakh(car.price)}</strong>
          <span className="muted">{car.location}</span>
        </p>
      </div>
    </Link>
  )
}

export function CardSkeleton() {
  return (
    <div className={s.card} aria-hidden>
      <Skeleton height="auto" radius={0} style={{ aspectRatio: '16 / 10' }} />
      <div className={s.body}>
        <Skeleton width="40%" height={14} />
        <Skeleton width="70%" height={22} />
        <Skeleton width="55%" height={16} />
      </div>
    </div>
  )
}
