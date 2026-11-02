import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { CardSkeleton, UsedCarCard } from '@/components/car/Cards'
import grid from '@/components/car/Grid.module.css'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Checkbox, Input, Select } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useI18n, type MessageKey } from '@/i18n'
import { lakh, number } from '@/lib/format'
import { useUsedCars, type UsedParams } from '@/lib/queries'
import page from './Page.module.css'
import s from './UsedCars.module.css'

const PAGE_SIZE = 12
const FUELS = ['petrol', 'diesel', 'cng', 'electric'] as const
const BUDGETS = [3_00_000, 5_00_000, 8_00_000, 10_00_000, 15_00_000]
const YEARS = [2024, 2022, 2020, 2018]
const KMS = [20_000, 40_000, 60_000, 80_000]
const SORTS = ['newest', 'price_asc', 'price_desc', 'km_asc', 'year_desc'] as const
const FILTER_KEYS = ['q', 'fuel', 'transmission', 'max_price', 'min_year', 'max_km', 'max_owners', 'include_booked']

export default function UsedCars() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [search, setSearch] = useState(params.get('q') ?? '')
  const searchTimer = useRef<number>(undefined)
  const resultsRef = useRef<HTMLDivElement>(null)

  const update = (changes: Record<string, string | string[] | null>, resetPage = true) =>
    setParams(
      (p) => {
        for (const [key, value] of Object.entries(changes)) {
          p.delete(key)
          if (Array.isArray(value)) value.forEach((v) => p.append(key, v))
          else if (value) p.set(key, value)
        }
        if (resetPage) p.delete('page')
        return p
      },
      { replace: true, preventScrollReset: true },
    )

  const onSearch = (value: string) => {
    setSearch(value)
    clearTimeout(searchTimer.current)
    searchTimer.current = window.setTimeout(() => update({ q: value.trim() || null }), 300)
  }

  const pageNo = Number(params.get('page') ?? 1)
  const query: UsedParams = {
    q: params.get('q') ?? undefined,
    fuel: params.getAll('fuel'),
    transmission: params.get('transmission') ?? undefined,
    max_price: params.get('max_price') ?? undefined,
    min_year: params.get('min_year') ?? undefined,
    max_km: params.get('max_km') ?? undefined,
    max_owners: params.get('max_owners') ?? undefined,
    include_booked: params.get('include_booked') !== 'false',
    sort: params.get('sort') ?? 'newest',
    page: pageNo,
    page_size: PAGE_SIZE,
  }
  const { data, error, refetch, isPending, isPlaceholderData } = useUsedCars(query)
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1
  const activeFilters = FILTER_KEYS.filter((k) => params.has(k)).length

  const goToPage = (n: number) => {
    update({ page: n > 1 ? String(n) : null }, false)
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const clearAll = () => {
    setSearch('')
    setParams((p) => {
      FILTER_KEYS.forEach((k) => p.delete(k))
      p.delete('page')
      return p
    }, { replace: true })
  }

  const toggleFuel = (fuel: string) => {
    const current = params.getAll('fuel')
    update({ fuel: current.includes(fuel) ? current.filter((f) => f !== fuel) : [...current, fuel] })
  }

  const filters = (
    <div className={s.filters}>
      <fieldset className={s.group}>
        <legend>{t('filters.fuel')}</legend>
        <div className="row gap-sm">
          {FUELS.map((f) => (
            <Chip key={f} selected={params.getAll('fuel').includes(f)} onClick={() => toggleFuel(f)}>
              {t(`fuel.${f}`)}
            </Chip>
          ))}
        </div>
      </fieldset>
      <fieldset className={s.group}>
        <legend>{t('filters.transmission')}</legend>
        <div className="row gap-sm">
          {([null, 'manual', 'automatic'] as const).map((tx) => (
            <Chip key={tx ?? 'any'} selected={params.get('transmission') === tx} onClick={() => update({ transmission: tx })}>
              {tx ? t(`tx.${tx}`) : t('filters.any')}
            </Chip>
          ))}
        </div>
      </fieldset>
      <Select label={t('filters.budget')} value={params.get('max_price') ?? ''} onChange={(e) => update({ max_price: e.target.value })}>
        <option value="">{t('filters.any')}</option>
        {BUDGETS.map((b) => (
          <option key={b} value={b}>
            {lakh(b)}
          </option>
        ))}
      </Select>
      <Select label={t('filters.year')} value={params.get('min_year') ?? ''} onChange={(e) => update({ min_year: e.target.value })}>
        <option value="">{t('filters.any')}</option>
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y}+
          </option>
        ))}
      </Select>
      <Select label={t('filters.km')} value={params.get('max_km') ?? ''} onChange={(e) => update({ max_km: e.target.value })}>
        <option value="">{t('filters.any')}</option>
        {KMS.map((k) => (
          <option key={k} value={k}>
            {number(k)} km
          </option>
        ))}
      </Select>
      <Checkbox
        label={t('filters.firstOwner')}
        checked={params.get('max_owners') === '1'}
        onChange={(e) => update({ max_owners: e.target.checked ? '1' : null })}
      />
      <Checkbox
        label={t('filters.includeBooked')}
        checked={params.get('include_booked') !== 'false'}
        onChange={(e) => update({ include_booked: e.target.checked ? null : 'false' })}
      />
      {activeFilters > 0 && (
        <Button variant="ghost" size="sm" onClick={clearAll}>
          {t('filters.clear')}
        </Button>
      )}
    </div>
  )

  return (
    <div className="page section">
      <title>Certified used Brand X cars in Lucknow · Company A</title>
      <meta name="description" content="Certified used cars with full inspection reports, honest kilometres and upfront prices." />
      <header className={page.head}>
        <div className="stack">
          <p className="eyebrow">Company A Certified</p>
          <h1 className={page.title}>{t('used.title')}</h1>
          <p className="muted">{t('used.sub')}</p>
        </div>
      </header>

      <div className={s.layout}>
        <aside className={s.sidebar} aria-label={t('filters.title')}>
          {filters}
        </aside>

        <section className={s.results} ref={resultsRef} aria-live="polite" aria-busy={isPlaceholderData}>
          <div className={s.toolbar}>
            <Input
              label={<span className="visually-hidden">{t('filters.search')}</span>}
              type="search"
              placeholder={t('filters.search')}
              value={search}
              onChange={(e) => onSearch(e.target.value)}
            />
            <Button variant="outline" className={s.filterButton} onClick={() => setSheetOpen(true)}>
              {t('filters.title')}
              {activeFilters > 0 && <span className={s.badge}>{activeFilters}</span>}
            </Button>
            <Select
              label={<span className="visually-hidden">{t('sort.label')}</span>}
              value={query.sort as string}
              onChange={(e) => update({ sort: e.target.value === 'newest' ? null : e.target.value })}
            >
              {SORTS.map((sort) => (
                <option key={sort} value={sort}>
                  {t(`sort.${sort}` as MessageKey)}
                </option>
              ))}
            </Select>
          </div>

          <p className={s.count}>{data ? t('used.results', { n: data.total }) : ' '}</p>

          {error ? (
            <ErrorState error={error} onRetry={refetch} />
          ) : data && data.items.length === 0 ? (
            <EmptyState
              title={t('used.empty')}
              hint={t('used.emptyHint')}
              action={
                <Button variant="dark" onClick={clearAll}>
                  {t('filters.clear')}
                </Button>
              }
            />
          ) : (
            <div className={`${grid.grid} ${s.cards}`} data-stale={isPlaceholderData || undefined}>
              {isPending
                ? Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} />)
                : data?.items.map((car) => <UsedCarCard key={car.slug} car={car} />)}
            </div>
          )}

          {data && pages > 1 && (
            <nav className={s.pager} aria-label="Pagination">
              <Button variant="outline" size="sm" disabled={pageNo <= 1} onClick={() => goToPage(pageNo - 1)}>
                ← {t('pager.prev')}
              </Button>
              <span className="num muted">{t('pager.status', { page: pageNo, pages })}</span>
              <Button variant="outline" size="sm" disabled={pageNo >= pages} onClick={() => goToPage(pageNo + 1)}>
                {t('pager.next')} →
              </Button>
            </nav>
          )}
        </section>
      </div>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={t('filters.title')}>
        <div className="stack">
          {filters}
          <Button size="lg" block onClick={() => setSheetOpen(false)}>
            {t('filters.show', { n: data?.total ?? 0 })}
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
