import { useState, type CSSProperties } from 'react'
import { useParams } from 'react-router'
import { ContactForm, Success } from '@/components/car/ContactForm'
import { EmiCalculator } from '@/components/car/EmiCalculator'
import { Gallery } from '@/components/car/Gallery'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Tag } from '@/components/ui/Chip'
import { Sheet } from '@/components/ui/Sheet'
import { EmptyState, ErrorState, PageLoader } from '@/components/ui/States'
import { useI18n, type MessageKey } from '@/i18n'
import type { ApiError } from '@/lib/api'
import { date, inr, km, lakh } from '@/lib/format'
import { ownerLabel } from '@/lib/labels'
import { useEnquiry, useUsedCar } from '@/lib/queries'
import type { UsedCarDetail } from '@/lib/types'
import model from './ModelPage.module.css'
import s from './UsedCarPage.module.css'

export default function UsedCarPage() {
  const { slug = '' } = useParams()
  const { t } = useI18n()
  const { data: car, error, refetch, isPending } = useUsedCar(slug)

  if (isPending) return <PageLoader />
  if (error) {
    return (error as ApiError).status === 404 ? (
      <EmptyState title={t('used.notFound')} action={<ButtonLink to="/used-cars">{t('used.title')}</ButtonLink>} />
    ) : (
      <ErrorState error={error} onRetry={refetch} />
    )
  }
  return <UsedCarView car={car} />
}

function UsedCarView({ car }: { car: UsedCarDetail }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const title = `${car.year} ${car.make} ${car.model} ${car.variant}`
  const booked = car.status === 'booked'

  const facts: [string, string][] = [
    [t('filters.year'), String(car.year)],
    [t('filters.km'), km(car.km)],
    [t('filters.fuel'), t(`fuel.${car.fuel}` as MessageKey)],
    [t('filters.transmission'), t(`tx.${car.transmission}` as MessageKey)],
    [t('filters.owners'), ownerLabel(t, car.owners)],
    [t('model.colours'), car.colour],
    [t('used.registration'), car.registration],
  ]

  return (
    <article className={`page ${model.layout}`}>
      <title>{`${title} for ${lakh(car.price)} · Certified used · Company A`}</title>
      <meta
        name="description"
        content={`${title}, ${km(car.km)}, ${ownerLabel(t, car.owners)}. Certified with a full inspection report. ${lakh(car.price)}.`}
      />
      <link rel="canonical" href={`${location.origin}/used-cars/${car.slug}`} />

      <div className={model.main}>
        <Gallery images={car.images} alt={title} />
        <p className={model.photoNote}>{t('model.photoNote')}</p>
        <p className={model.description}>{car.description}</p>
        <Inspection car={car} />
        <EmiCalculator price={car.price} />
      </div>

      <aside className={model.side}>
        <div className={model.sticky}>
          <header className="stack" style={{ gap: '0.5rem' }}>
            <div className="row gap-sm">
              <Tag tone="dark">{car.stock_id}</Tag>
              {booked && <Tag tone="warn">{t('used.booked')}</Tag>}
            </div>
            <h1 className={s.title}>
              {car.year} {car.model} <span className="muted">{car.variant}</span>
            </h1>
            <p className="muted">{t('used.location', { showroom: car.location })}</p>
          </header>

          <p className={`${s.price} num`}>{inr(car.price)}</p>

          <dl className={s.facts}>
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd className="num">{value}</dd>
              </div>
            ))}
          </dl>

          {booked && <p className={s.bookedNote}>{t('used.bookedNote')}</p>}

          <div className={model.ctas}>
            <Button size="lg" block onClick={() => setOpen(true)}>
              {t('used.enquire')}
            </Button>
            <ButtonLink to="/trade-in" variant="ghost" size="sm">
              {t('model.tradeIn')} →
            </ButtonLink>
          </div>
        </div>
      </aside>

      <div className={model.bottomBar}>
        <div>
          <span className="eyebrow">{car.stock_id}</span>
          <strong className="num">{inr(car.price)}</strong>
        </div>
        <Button onClick={() => setOpen(true)}>{t('used.enquire')}</Button>
      </div>

      <UsedEnquirySheet open={open} onClose={() => setOpen(false)} car={car} title={title} />
    </article>
  )
}

function Inspection({ car }: { car: UsedCarDetail }) {
  const { t } = useI18n()
  const report = car.inspection
  if (!report.items?.length) return null
  const score = report.score ?? 0

  return (
    <section className={s.inspection} aria-labelledby="inspection">
      <header className={s.inspectionHead}>
        <div className={s.ring} style={{ '--score': score } as CSSProperties} role="img" aria-label={`${t('used.score')} ${score}/100`}>
          <span className="num">{score}</span>
        </div>
        <div className="stack" style={{ gap: '0.35rem' }}>
          <h2 id="inspection">{t('used.inspection')}</h2>
          {report.checked_on && <p className="muted">{t('used.checkedOn', { date: date(report.checked_on) })}</p>}
          <div className="row gap-sm">
            {report.accident_free && <Tag tone="ok">✓ {t('used.accidentFree')}</Tag>}
            {report.flood_free && <Tag tone="ok">✓ {t('used.floodFree')}</Tag>}
            {report.service_history && (
              <Tag>
                {t('used.service')}: {report.service_history}
              </Tag>
            )}
          </div>
        </div>
      </header>
      <ul className={s.items}>
        {report.items.map((item) => (
          <li key={item.area} data-status={item.status}>
            <span className={s.dot} aria-hidden />
            <strong>{item.area}</strong>
            <span className="muted">{item.note}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function UsedEnquirySheet({ open, onClose, car, title }: { open: boolean; onClose: () => void; car: UsedCarDetail; title: string }) {
  const { t } = useI18n()
  const enquiry = useEnquiry()
  const close = () => {
    onClose()
    enquiry.reset()
  }
  return (
    <Sheet open={open} onClose={close} title={`${t('used.enquire')} · ${car.stock_id}`}>
      {enquiry.data ? (
        <Success title={t('form.thanks', { name: enquiry.variables?.name.split(' ')[0] ?? '' })}>
          <p>
            {enquiry.data.consultant
              ? t('form.assigned', { consultant: enquiry.data.consultant })
              : t('form.assignedNone')}
          </p>
        </Success>
      ) : (
        <ContactForm
          submitLabel={t('form.submit')}
          pending={enquiry.isPending}
          error={enquiry.error}
          messagePlaceholder={`Is the ${title} still available?`}
          onSubmit={(values) => enquiry.mutate({ ...values, kind: 'used_car', used_car_slug: car.slug })}
        />
      )}
    </Sheet>
  )
}
