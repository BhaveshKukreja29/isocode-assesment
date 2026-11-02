import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { CitySelect } from '@/components/car/CitySelect'
import { ContactForm, Success } from '@/components/car/ContactForm'
import { EmiCalculator } from '@/components/car/EmiCalculator'
import { Gallery } from '@/components/car/Gallery'
import { PriceBreakup } from '@/components/car/PriceBreakup'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Chip, Tag } from '@/components/ui/Chip'
import { Sheet } from '@/components/ui/Sheet'
import { EmptyState, ErrorState, PageLoader } from '@/components/ui/States'
import { useI18n, type MessageKey } from '@/i18n'
import { ApiError } from '@/lib/api'
import { useCity } from '@/lib/city'
import { inr, lakh } from '@/lib/format'
import { useEnquiry, useModel, usePrice } from '@/lib/queries'
import type { ModelDetail, Variant } from '@/lib/types'
import s from './ModelPage.module.css'

const SPEC_KEYS = ['engine', 'power', 'torque', 'mileage', 'seats', 'boot', 'airbags'] as const

export default function ModelPage() {
  const { slug = '' } = useParams()
  const { t } = useI18n()
  const { city } = useCity()
  const { data: model, error, refetch, isPending } = useModel(slug, city)

  if (isPending) return <PageLoader />
  if (error) {
    return (error as ApiError).status === 404 ? (
      <EmptyState title={t('model.notFound')} action={<ButtonLink to="/cars">{t('nav.cars')}</ButtonLink>} />
    ) : (
      <ErrorState error={error} onRetry={refetch} />
    )
  }
  return <ModelView model={model} />
}

function ModelView({ model }: { model: ModelDetail }) {
  const { t } = useI18n()
  const { city } = useCity()
  const [params, setParams] = useSearchParams()
  const [packId, setPackId] = useState<number>()
  const [enquiryOpen, setEnquiryOpen] = useState(false)

  const variant: Variant | undefined =
    model.variants.find((v) => v.id === Number(params.get('variant'))) ??
    model.variants.find((v) => v.ex_showroom !== null) ??
    model.variants[0]
  const price = usePrice(model.slug, variant?.id, city, packId)
  const priceError =
    price.error instanceof ApiError && price.error.status === 404
      ? t('price.unavailable', { city: model.city.name })
      : price.error
        ? price.error.message
        : null

  const pickVariant = (id: number) =>
    setParams((p) => {
      p.set('variant', String(id))
      return p
    }, { replace: true, preventScrollReset: true })

  const testDriveLink = `/test-drive?model=${model.slug}`
  const fromPrice = Math.min(...model.variants.map((v) => v.ex_showroom ?? Infinity))

  return (
    <article className={`page ${s.layout}`}>
      <title>{`${model.name} price in ${model.city.name}, on-road breakup · Company A`}</title>
      <meta
        name="description"
        content={`${model.name} ${model.body_type.toLowerCase()} from ${Number.isFinite(fromPrice) ? lakh(fromPrice) : ''} ex-showroom. Full on-road price breakup for ${model.city.name}, EMI calculator and online test drive booking.`}
      />
      <link rel="canonical" href={`${location.origin}/cars/${model.slug}`} />

      <div className={s.main}>
        <Gallery images={model.images} alt={model.name} />
        <p className={s.photoNote}>{t('model.photoNote')}</p>

        <ul className={s.highlights}>
          {model.highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>

        <p className={s.description}>{model.description}</p>

        <section aria-labelledby="colours" className="stack">
          <h2 id="colours" className="eyebrow">
            {t('model.colours')}
          </h2>
          <ul className={s.swatches}>
            {model.colours.map((c) => (
              <li key={c.name}>
                <span className={s.swatch} style={{ background: c.hex }} aria-hidden />
                {c.name}
              </li>
            ))}
          </ul>
        </section>

        {variant && (
          <section aria-labelledby="specs" className="stack">
            <h2 id="specs" className="eyebrow">
              {t('model.specs')} · {variant.name}
            </h2>
            <dl className={s.specs}>
              {SPEC_KEYS.filter((k) => variant.specs[k]).map((key) => (
                <div key={key}>
                  <dt>{t(`spec.${key}`)}</dt>
                  <dd>{variant.specs[key]}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {price.data && <EmiCalculator price={price.data.total} />}
      </div>

      <aside className={s.side}>
        <div className={s.sticky}>
          <header className="stack" style={{ gap: '0.4rem' }}>
            <div className="row gap-sm">
              <Tag>{model.body_type}</Tag>
            </div>
            <h1 className={s.name}>{model.name}</h1>
            <p className="muted">{model.tagline}</p>
          </header>

          <CitySelect />

          <fieldset className={s.variants}>
            <legend className="eyebrow">{t('model.variant')}</legend>
            <div className={s.variantList}>
              {model.variants.map((v) => (
                <Chip key={v.id} selected={v.id === variant?.id} onClick={() => pickVariant(v.id)} className={s.variantChip}>
                  <span className={s.variantName}>{v.name}</span>
                  <span className={s.variantMeta}>
                    {t(`fuel.${v.fuel}` as MessageKey)} · {t(`tx.${v.transmission}` as MessageKey)}
                  </span>
                  <span className={`${s.variantPrice} num`}>{v.ex_showroom ? lakh(v.ex_showroom) : '—'}</span>
                </Chip>
              ))}
            </div>
          </fieldset>

          <PriceBreakup
            breakup={price.data}
            loading={price.isFetching}
            error={priceError}
            packs={model.accessory_packs}
            packId={packId}
            onPackChange={setPackId}
          />

          <div className={s.ctas}>
            <ButtonLink to={testDriveLink} size="lg" block>
              {t('model.bookDrive')}
            </ButtonLink>
            <Button variant="outline" size="lg" block onClick={() => setEnquiryOpen(true)}>
              {t('model.enquire')}
            </Button>
            <ButtonLink to={`/trade-in?model=${model.slug}`} variant="ghost" size="sm">
              {t('model.tradeIn')} →
            </ButtonLink>
          </div>
        </div>
      </aside>

      <div className={s.bottomBar}>
        <div>
          <span className="eyebrow">{t('price.total')}</span>
          <strong className="num">{price.data ? inr(price.data.total) : '—'}</strong>
        </div>
        <ButtonLink to={testDriveLink}>{t('model.bookDrive')}</ButtonLink>
      </div>

      <EnquirySheet open={enquiryOpen} onClose={() => setEnquiryOpen(false)} model={model} variant={variant} />
    </article>
  )
}

function EnquirySheet({
  open,
  onClose,
  model,
  variant,
}: {
  open: boolean
  onClose: () => void
  model: ModelDetail
  variant?: Variant
}) {
  const { t } = useI18n()
  const enquiry = useEnquiry()
  const close = () => {
    onClose()
    enquiry.reset()
  }

  return (
    <Sheet open={open} onClose={close} title={`${t('model.enquire')} · ${model.name}`}>
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
          messagePlaceholder={variant ? `Interested in the ${model.name} ${variant.name}` : undefined}
          onSubmit={(values) =>
            enquiry.mutate({
              ...values,
              kind: 'enquiry',
              model_slug: model.slug,
              message: [variant && `Variant: ${variant.name}.`, values.message].filter(Boolean).join(' '),
            })
          }
        />
      )}
    </Sheet>
  )
}
