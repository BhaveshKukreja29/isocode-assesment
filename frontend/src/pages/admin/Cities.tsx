import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { useAdminCities, useSaveCity, type AdminCity, type Slab } from '@/lib/admin'
import { titleCase } from '@/lib/format'
import type { Fuel } from '@/lib/types'
import s from './Admin.module.css'

const FUELS: Fuel[] = ['petrol', 'diesel', 'cng', 'hybrid', 'electric']

export function Cities() {
  const cities = useAdminCities()
  return (
    <section>
      <header className={s.head}>
        <div>
          <h1>Cities &amp; tax</h1>
          <p className="muted">
            Fees and road-tax slabs per registration city. Each fuel needs slabs that start at ₹0, follow on without gaps,
            and end open-ended (leave “up to” blank). The server rejects anything else.
          </p>
        </div>
      </header>
      {cities.error ? (
        <ErrorState error={cities.error} onRetry={cities.refetch} />
      ) : (
        <div className={s.cards}>
          {cities.data?.map((city) => <CityCard key={city.id} city={city} />) ?? (
            <Skeleton height={320} />
          )}
        </div>
      )}
    </section>
  )
}

function CityCard({ city }: { city: AdminCity }) {
  const save = useSaveCity()
  const [draft, setDraft] = useState(city)
  const set = <K extends keyof AdminCity>(k: K, v: AdminCity[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const setSlab = (i: number, patch: Partial<Slab>) =>
    set('tax_slabs', draft.tax_slabs.map((slab, j) => (i === j ? { ...slab, ...patch } : slab)))
  const sorted = draft.tax_slabs.map((slab, i) => ({ slab, i })).sort((a, b) => a.slab.fuel.localeCompare(b.slab.fuel) || a.slab.min_price - b.slab.min_price)

  return (
    <form
      className={s.card}
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate(draft)
      }}
    >
      <h2 style={{ fontSize: '1.2rem' }}>{city.name}</h2>
      <div className={s.grid3}>
        <Input label="Registration + HSRP ₹" inputMode="numeric" value={draft.registration_fee} onChange={(e) => set('registration_fee', Number(e.target.value) || 0)} />
        <Input label="FASTag ₹" inputMode="numeric" value={draft.fastag_fee} onChange={(e) => set('fastag_fee', Number(e.target.value) || 0)} />
        <Input label="Insurance % of ex-showroom" inputMode="decimal" value={draft.insurance_rate} onChange={(e) => set('insurance_rate', e.target.value)} />
      </div>
      <div className={s.section}>
        <h3>Road-tax slabs</h3>
        <div className={s.rows}>
          <div className={`${s.rowEdit} muted`} style={{ fontSize: '0.75rem' }}>
            <span>Fuel</span>
            <span>From ₹</span>
            <span>Up to ₹ (blank = no limit)</span>
            <span>Rate %</span>
            <span />
          </div>
          {sorted.map(({ slab, i }) => (
            <div key={i} className={s.rowEdit}>
              <select aria-label="Fuel" value={slab.fuel} onChange={(e) => setSlab(i, { fuel: e.target.value as Fuel })}>
                {FUELS.map((f) => (
                  <option key={f} value={f}>
                    {titleCase(f)}
                  </option>
                ))}
              </select>
              <input aria-label="From" inputMode="numeric" value={slab.min_price} onChange={(e) => setSlab(i, { min_price: Number(e.target.value) || 0 })} />
              <input
                aria-label="Up to"
                inputMode="numeric"
                value={slab.max_price ?? ''}
                placeholder="no limit"
                onChange={(e) => setSlab(i, { max_price: e.target.value ? Number(e.target.value) : null })}
              />
              <input aria-label="Rate" inputMode="decimal" value={slab.rate} onChange={(e) => setSlab(i, { rate: e.target.value })} />
              <button type="button" className={s.iconBtn} aria-label="Remove slab" onClick={() => set('tax_slabs', draft.tax_slabs.filter((_, j) => j !== i))}>
                ×
              </button>
            </div>
          ))}
        </div>
        <div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => set('tax_slabs', [...draft.tax_slabs, { fuel: 'petrol', min_price: 0, max_price: null, rate: '0' }])}
          >
            + Add slab
          </Button>
        </div>
      </div>
      <div className="row">
        {save.error && <span className={s.error}>{save.error.message}</span>}
        {save.isSuccess && <span className={s.ok}>Saved</span>}
        <span className="spacer" />
        <Button type="submit" variant="dark" loading={save.isPending}>
          Save {city.name}
        </Button>
      </div>
    </form>
  )
}
