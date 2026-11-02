import { useSearchParams } from 'react-router'
import { ContactForm, Success } from '@/components/car/ContactForm'
import { Input, Select } from '@/components/ui/Field'
import { useI18n } from '@/i18n'
import { ApiError } from '@/lib/api'
import { useCity } from '@/lib/city'
import { useEnquiry, useModels } from '@/lib/queries'
import page from './Page.module.css'

const THIS_YEAR = new Date().getFullYear()

export default function TradeIn() {
  const { t } = useI18n()
  const { city } = useCity()
  const [params] = useSearchParams()
  const { data: models } = useModels(city)
  const enquiry = useEnquiry()
  const fields = enquiry.error instanceof ApiError ? enquiry.error.fields : {}

  return (
    <div className={`${page.narrow} section`}>
      <title>Trade in your car · Company A Lucknow</title>
      <header className="stack" style={{ marginBottom: '2rem' }}>
        <p className="eyebrow">Exchange</p>
        <h1 className={page.title}>{t('tradein.title')}</h1>
        <p className="muted">{t('tradein.sub')}</p>
      </header>

      <div className={page.panel}>
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
            submitLabel={t('tradein.submit')}
            pending={enquiry.isPending}
            error={enquiry.error}
            extra={
              <>
                <div className={page.pair}>
                  <Input name="make" label={t('tradein.make')} required error={fields.make} />
                  <Input name="model" label={t('tradein.model')} required error={fields.model} />
                  <Input name="year" type="number" inputMode="numeric" label={t('tradein.year')} min={1995} max={THIS_YEAR} required error={fields.year} />
                  <Input name="km" type="number" inputMode="numeric" label={t('tradein.km')} min={0} required error={fields.km} />
                </div>
                <Select name="interest" label={t('tradein.interest')} defaultValue={params.get('model') ?? ''}>
                  <option value="">—</option>
                  {models?.map((m) => (
                    <option key={m.slug} value={m.slug}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              </>
            }
            onSubmit={(values, form) =>
              enquiry.mutate({
                ...values,
                kind: 'trade_in',
                model_slug: (form.get('interest') as string) || undefined,
                trade_in: {
                  make: form.get('make'),
                  model: form.get('model'),
                  year: Number(form.get('year')) || null,
                  km: Number(form.get('km')),
                },
              })
            }
          />
        )}
      </div>
    </div>
  )
}
