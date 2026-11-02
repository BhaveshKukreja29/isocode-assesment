import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { ContactForm, Success } from '@/components/car/ContactForm'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { useI18n, type MessageKey } from '@/i18n'
import { ApiError } from '@/lib/api'
import { useCity } from '@/lib/city'
import { dateTime, istDay, time } from '@/lib/format'
import { useBookTestDrive, useDemoCars, useModels, useShowrooms, useSlots } from '@/lib/queries'
import page from './Page.module.css'
import s from './TestDrive.module.css'

const DAYS = 14

function dayLabel(offset: number, lang: string) {
  const d = new Date(Date.now() + offset * 86_400_000)
  return {
    value: istDay(offset),
    weekday: d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' }),
    day: d.toLocaleDateString('en-IN', { day: 'numeric', timeZone: 'Asia/Kolkata' }),
    month: d.toLocaleDateString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' }),
  }
}

export default function TestDrive() {
  const { t, lang } = useI18n()
  const { city } = useCity()
  const [params] = useSearchParams()
  const models = useModels(city)
  const showrooms = useShowrooms()

  const [modelSlug, setModelSlug] = useState(params.get('model') ?? '')
  const [showroomId, setShowroomId] = useState<number>()
  const [pickedCarId, setDemoCarId] = useState<number>()
  const [day, setDay] = useState(istDay(0))
  const [slot, setSlot] = useState<string>()

  const demoCars = useDemoCars(modelSlug || undefined, showroomId)
  // A showroom with a single demo car of this model needs no extra click.
  const demoCarId = pickedCarId ?? (demoCars.data?.length === 1 ? demoCars.data[0].id : undefined)
  const slots = useSlots(demoCarId, day)
  const booking = useBookTestDrive()

  const chooseModel = (slug: string) => {
    setModelSlug(slug)
    setDemoCarId(undefined)
    setSlot(undefined)
  }
  const chooseShowroom = (id: number) => {
    setShowroomId(id)
    setDemoCarId(undefined)
    setSlot(undefined)
  }

  const model = models.data?.find((m) => m.slug === modelSlug)
  const showroom = showrooms.data?.find((r) => r.id === showroomId)
  const demoCar = demoCars.data?.find((d) => d.id === demoCarId)
  const freeSlots = slots.data?.filter((x) => x.available) ?? []

  if (booking.data) {
    const when = dateTime(booking.data.test_drive_at!)
    return (
      <div className={`${page.narrow} section`}>
        <title>Test drive booked · Company A</title>
        <Success
          title={t('td.done')}
          action={
            <Button variant="dark" onClick={() => { booking.reset(); setSlot(undefined) }}>
              {t('td.another')}
            </Button>
          }
        >
          <p className={s.doneWhen}>
            {model?.name} {demoCar?.variant.name} · {t('td.doneBody', { when, showroom: showroom?.name ?? '' })}
          </p>
          {booking.data.consultant && <p>{t('td.doneConsultant', { consultant: booking.data.consultant })}</p>}
          <p>{t('td.bring')}</p>
        </Success>
      </div>
    )
  }

  return (
    <div className="page section">
      <title>Book a Brand X test drive in Lucknow · Company A</title>
      <meta name="description" content="Pick a showroom, a demo car and a real time slot. No phone calls needed." />
      <header className={page.head}>
        <div className="stack">
          <p className="eyebrow">Gomti Nagar · Aliganj · Alambagh</p>
          <h1 className={page.title}>{t('td.title')}</h1>
          <p className="muted">{t('td.sub')}</p>
        </div>
      </header>

      <div className={s.layout}>
        <div className={s.steps}>
          <Step n={1} title={t('td.model')}>
            {models.error ? (
              <ErrorState error={models.error} onRetry={models.refetch} />
            ) : (
              <div className="row gap-sm">
                {models.data?.map((m) => (
                  <Chip key={m.slug} selected={m.slug === modelSlug} onClick={() => chooseModel(m.slug)}>
                    {m.name}
                  </Chip>
                )) ?? <Skeleton height={40} width={320} />}
              </div>
            )}
          </Step>

          <Step n={2} title={t('td.showroom')} disabled={!modelSlug}>
            <div className={s.showrooms}>
              {showrooms.data?.map((room) => (
                <button
                  key={room.id}
                  className={s.option}
                  aria-pressed={room.id === showroomId}
                  onClick={() => chooseShowroom(room.id)}
                >
                  <strong>{room.name}</strong>
                  <span className="muted">{room.address}</span>
                  <span className="mono muted">
                    {t('common.open', { from: room.opens_at.slice(0, 5), to: room.closes_at.slice(0, 5) })}
                  </span>
                </button>
              ))}
            </div>
          </Step>

          <Step n={3} title={t('td.car')} disabled={!showroomId}>
            {demoCars.isFetching && !demoCars.data ? (
              <Skeleton height={40} width={280} />
            ) : demoCars.data?.length === 0 ? (
              <p className="muted">{t('td.noCars', { showroom: showroom?.name ?? '' })}</p>
            ) : (
              <div className="row gap-sm">
                {demoCars.data?.map((car) => (
                  <Chip key={car.id} selected={car.id === demoCarId} onClick={() => { setDemoCarId(car.id); setSlot(undefined) }}>
                    {car.variant.name} · {t(`fuel.${car.variant.fuel}` as MessageKey)} · {car.colour}
                  </Chip>
                ))}
              </div>
            )}
          </Step>

          <Step n={4} title={t('td.date')} disabled={!demoCarId}>
            <div className={s.days} role="listbox" aria-label={t('td.date')}>
              {Array.from({ length: DAYS }, (_, i) => dayLabel(i, lang)).map((d) => (
                <button
                  key={d.value}
                  role="option"
                  aria-selected={d.value === day}
                  className={s.day}
                  onClick={() => { setDay(d.value); setSlot(undefined) }}
                >
                  <span className="eyebrow">{d.weekday}</span>
                  <strong className="num">{d.day}</strong>
                  <span className="muted">{d.month}</span>
                </button>
              ))}
            </div>
          </Step>

          <Step n={5} title={t('td.time')} disabled={!demoCarId}>
            {!demoCarId ? (
              <p className="muted">{t('td.pickFirst')}</p>
            ) : slots.isPending ? (
              <div className={s.slots}>
                {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} height={40} radius={999} />)}
              </div>
            ) : slots.error ? (
              <ErrorState error={slots.error} onRetry={slots.refetch} />
            ) : freeSlots.length === 0 ? (
              <p className="muted">{t('td.noSlots')}</p>
            ) : (
              <div className={s.slots}>
                {slots.data.map((x) => (
                  <Chip key={x.starts_at} disabled={!x.available} selected={x.starts_at === slot} onClick={() => setSlot(x.starts_at)}>
                    <span className="num">{time(x.starts_at)}</span>
                  </Chip>
                ))}
              </div>
            )}
          </Step>

          <Step n={6} title={t('td.details')} disabled={!slot}>
            <ContactForm
              submitLabel={t('td.confirm')}
              pending={booking.isPending}
              error={booking.error}
              onSubmit={(values) =>
                booking.mutate(
                  { ...values, demo_car_id: demoCarId!, starts_at: slot! },
                  {
                    onSuccess: () => window.scrollTo({ top: 0 }),
                    onError: (error) => error instanceof ApiError && error.status === 409 && setSlot(undefined),
                  },
                )
              }
            />
          </Step>
        </div>

        <aside className={`${s.summary} dark`} aria-label="Summary">
          <p className="eyebrow">{t('td.title')}</p>
          <dl>
            <SummaryRow label={t('td.model')} value={model?.name} />
            <SummaryRow label={t('td.showroom')} value={showroom?.name} />
            <SummaryRow label={t('td.car')} value={demoCar && `${demoCar.variant.name} · ${demoCar.colour}`} />
            <SummaryRow label={t('td.time')} value={slot && dateTime(slot)} />
          </dl>
        </aside>
      </div>
    </div>
  )
}

function Step({ n, title, disabled, children }: { n: number; title: string; disabled?: boolean; children: ReactNode }) {
  return (
    <section className={s.step} data-disabled={disabled || undefined} inert={disabled}>
      <h2 className={s.stepTitle}>
        <span className={s.stepNo}>0{n}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

function SummaryRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className={s.summaryRow}>
      <dt>{label}</dt>
      <dd>{value || '—'}</dd>
    </div>
  )
}
