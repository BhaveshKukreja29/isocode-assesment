import { CitySelect } from '@/components/car/CitySelect'
import { ModelGrid } from '@/components/car/ModelGrid'
import { useI18n } from '@/i18n'
import s from './Page.module.css'

export default function Models() {
  const { t } = useI18n()
  return (
    <div className="page section">
      <title>New Brand X cars and on-road prices · Company A Lucknow</title>
      <header className={s.head}>
        <div className="stack">
          <p className="eyebrow">Brand X</p>
          <h1 className={s.title}>{t('nav.cars')}</h1>
          <p className="muted">{t('home.p1.body')}</p>
        </div>
        <div className={s.headAside}>
          <CitySelect />
        </div>
      </header>
      <ModelGrid />
    </div>
  )
}
