import { useState } from 'react'
import { useI18n } from '@/i18n'
import { loanSummary } from '@/lib/emi'
import { inr } from '@/lib/format'
import { Chip } from '../ui/Chip'
import s from './EmiCalculator.module.css'

const TENURES = [36, 48, 60, 72, 84]

export function EmiCalculator({ price }: { price: number }) {
  const { t } = useI18n()
  const [downPct, setDownPct] = useState(20)
  const [rate, setRate] = useState(9.5)
  const [months, setMonths] = useState(60)

  const down = Math.round((price * downPct) / 100)
  const { principal, monthly, interest } = loanSummary(price, down, rate, months)

  return (
    <section className={s.card} aria-labelledby="emi-title">
      <div className={s.top}>
        <h2 id="emi-title" className="eyebrow">
          {t('emi.title')}
        </h2>
        <p className={s.monthly}>
          <strong className="num">{inr(monthly)}</strong> <span className="muted">{t('emi.monthly')}</span>
        </p>
      </div>

      <label className={s.slider}>
        <span className={s.sliderHead}>
          {t('emi.down')}
          <span className="num">
            {inr(down)} · {downPct}%
          </span>
        </span>
        <input type="range" min={0} max={90} step={5} value={downPct} onChange={(e) => setDownPct(+e.target.value)} />
      </label>

      <label className={s.slider}>
        <span className={s.sliderHead}>
          {t('emi.rate')}
          <span className="num">{rate.toFixed(1)}%</span>
        </span>
        <input type="range" min={7} max={16} step={0.25} value={rate} onChange={(e) => setRate(+e.target.value)} />
      </label>

      <fieldset className={s.tenure}>
        <legend className={s.sliderHead}>{t('emi.tenure')}</legend>
        <div className="row gap-sm">
          {TENURES.map((m) => (
            <Chip key={m} selected={months === m} onClick={() => setMonths(m)}>
              {m}
            </Chip>
          ))}
        </div>
      </fieldset>

      <dl className={s.facts}>
        <div>
          <dt className="muted">{t('emi.loan')}</dt>
          <dd className="num">{inr(principal)}</dd>
        </div>
        <div>
          <dt className="muted">{t('emi.interest')}</dt>
          <dd className="num">{inr(interest)}</dd>
        </div>
      </dl>
      <p className={s.note}>{t('emi.note')}</p>
    </section>
  )
}
