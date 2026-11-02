import { Link } from 'react-router'
import { CardSkeleton, UsedCarCard } from '@/components/car/Cards'
import { CitySelect } from '@/components/car/CitySelect'
import { ModelGrid } from '@/components/car/ModelGrid'
import grid from '@/components/car/Grid.module.css'
import { ButtonLink } from '@/components/ui/Button'
import { Img } from '@/components/ui/Img'
import { useI18n } from '@/i18n'
import { useCities, useModels, useUsedCars } from '@/lib/queries'
import { useCity } from '@/lib/city'
import { lakh } from '@/lib/format'
import s from './Home.module.css'

const HERO = 'https://images.unsplash.com/photo-1617469767053-d3b523a0b982'

export default function Home() {
  const { t } = useI18n()
  const { city } = useCity()
  const { data: cities } = useCities()
  const { data: models } = useModels(city)
  const used = useUsedCars({ page_size: 4, sort: 'newest', include_booked: false })
  const cityName = cities?.find((c) => c.slug === city)?.name ?? 'Lucknow'
  const hero = models?.find((m) => m.slug === 'model-h')

  return (
    <>
      <title>Company A · Brand X cars in Lucknow with real on-road prices</title>
      <section className={`${s.hero} dark`}>
        <div className={`page ${s.heroGrid}`}>
          <div className={s.heroText}>
            <p className="eyebrow">{t('hero.eyebrow')}</p>
            <h1>
              {t('hero.title1')}
              <br />
              <span className="mark">{t('hero.title2')}</span>
              <br />
              {t('hero.title3')}
            </h1>
            <p className={`${s.lede} muted`}>{t('hero.sub')}</p>
            <div className="row">
              <ButtonLink to="/cars" size="lg">
                {t('hero.ctaCars')}
              </ButtonLink>
              <ButtonLink to="/test-drive" size="lg" variant="outline">
                {t('hero.ctaDrive')}
              </ButtonLink>
            </div>
          </div>
          <div className={s.heroMedia}>
            <Img src={HERO} alt="Brand X Model H" priority ratio="4 / 3" sizes="(max-width: 900px) 100vw, 600px" className={s.heroImg} />
            {hero?.from_price && (
              <Link to="/cars/model-h" className={s.floatTag}>
                <span className="eyebrow">Model H · {cityName}</span>
                <strong className="num">
                  {t('common.from')} {lakh(hero.from_price)}
                </strong>
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="page section">
        <ol className={s.promises}>
          {(['p1', 'p2', 'p3'] as const).map((p, i) => (
            <li key={p}>
              <span className={s.index}>0{i + 1}</span>
              <h3>{t(`home.${p}.title`)}</h3>
              <p className="muted">{t(`home.${p}.body`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="page" aria-labelledby="lineup">
        <div className={s.sectionHead}>
          <div className="stack">
            <h2 id="lineup">{t('home.lineup')}</h2>
            <p className="muted">{t('home.lineupSub', { city: cityName })}</p>
          </div>
          <div className={s.city}>
            <CitySelect />
          </div>
        </div>
        <ModelGrid />
      </section>

      <section className="page section" aria-labelledby="used">
        <div className={s.sectionHead}>
          <div className="stack">
            <h2 id="used">{t('home.used')}</h2>
            <p className="muted">{t('home.usedSub')}</p>
          </div>
          <ButtonLink to="/used-cars" variant="dark">
            {t('home.allUsed')}
          </ButtonLink>
        </div>
        <div className={grid.grid}>
          {used.data
            ? used.data.items.map((car) => <UsedCarCard key={car.slug} car={car} />)
            : Array.from({ length: 4 }, (_, i) => <CardSkeleton key={i} />)}
        </div>
      </section>
    </>
  )
}
