import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Tag } from '@/components/ui/Chip'
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { useAdminUsedCars, useSaveUsedCar, type AdminUsedCar } from '@/lib/admin'
import { ApiError } from '@/lib/api'
import { inr, istDay, number, titleCase } from '@/lib/format'
import { useShowrooms } from '@/lib/queries'
import type { Fuel, StockStatus, Transmission } from '@/lib/types'
import { useDebounced } from '@/lib/useDebounced'
import s from './Admin.module.css'

const STATUS_TONE = { available: 'ok', booked: 'warn', sold: 'neutral' } as const

export function UsedStock() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const q = useDebounced(search.trim())
  const cars = useAdminUsedCars({ q: q || undefined, status: status || undefined, page })
  const [editing, setEditing] = useState<AdminUsedCar | 'new'>()
  const pages = cars.data ? Math.max(1, Math.ceil(cars.data.total / cars.data.page_size)) : 1

  return (
    <section>
      <header className={s.head}>
        <div>
          <h1>Used stock</h1>
          <p className="muted">
            The used-car manager sets every price here. Full registration numbers are visible only in admin; the public site
            shows a masked version.
          </p>
        </div>
        <Button variant="dark" onClick={() => setEditing('new')}>
          + Add car
        </Button>
      </header>
      <div className={s.grid3} style={{ marginBottom: '1rem' }}>
        <Input label="Search" type="search" placeholder="Stock ID, model or registration" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        <Select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
          <option value="">All</option>
          <option value="available">Available</option>
          <option value="booked">Booked</option>
          <option value="sold">Sold</option>
        </Select>
      </div>
      {cars.error ? (
        <ErrorState error={cars.error} onRetry={cars.refetch} />
      ) : (
        <div className={s.tableWrap} style={{ opacity: cars.isPlaceholderData ? 0.6 : 1 }}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Stock ID</th>
                <th>Car</th>
                <th>Km</th>
                <th>Owners</th>
                <th>Registration</th>
                <th style={{ textAlign: 'right' }}>Price</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {cars.data?.items.map((car) => (
                <tr key={car.id} data-clickable onClick={() => setEditing(car)}>
                  <td className="mono">{car.stock_id}</td>
                  <td>
                    {car.year} {car.make} {car.model} <span className="muted">{car.variant}</span>
                  </td>
                  <td className="num">{number(car.km)}</td>
                  <td className="num">{car.owners}</td>
                  <td className="mono">{car.registration_no}</td>
                  <td className="num" style={{ textAlign: 'right' }}>
                    {inr(car.price)}
                  </td>
                  <td>
                    <Tag tone={STATUS_TONE[car.status]}>{titleCase(car.status)}</Tag>
                    {!car.is_published && <Tag>Hidden</Tag>}
                  </td>
                </tr>
              )) ?? (
                <tr>
                  <td colSpan={7}>
                    <Skeleton height={200} />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="row" style={{ justifyContent: 'center', marginTop: '1rem' }}>
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ←
          </Button>
          <span className="muted num">
            {page} / {pages}
          </span>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            →
          </Button>
        </div>
      )}
      <Sheet open={editing !== undefined} onClose={() => setEditing(undefined)} title={editing === 'new' ? 'Add used car' : `Edit ${editing?.stock_id ?? ''}`} wide>
        {editing !== undefined && <UsedCarForm car={editing === 'new' ? undefined : editing} onDone={() => setEditing(undefined)} />}
      </Sheet>
    </section>
  )
}

function UsedCarForm({ car, onDone }: { car?: AdminUsedCar; onDone: () => void }) {
  const save = useSaveUsedCar()
  const { data: showrooms } = useShowrooms()
  const fields = save.error instanceof ApiError ? save.error.fields : {}

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const f = new FormData(event.currentTarget)
    const text = (k: string) => String(f.get(k) ?? '').trim()
    const score = Number(f.get('score'))
    save.mutate(
      {
        id: car?.id,
        body: {
          stock_id: text('stock_id').toUpperCase(),
          make: text('make'),
          model: text('model'),
          variant: text('variant'),
          fuel: text('fuel') as Fuel,
          transmission: text('transmission') as Transmission,
          year: Number(f.get('year')),
          km: Number(f.get('km')),
          owners: Number(f.get('owners')),
          colour: text('colour'),
          price: Number(f.get('price')),
          status: text('status') as StockStatus,
          registration_no: text('registration_no').replace(/\s/g, '').toUpperCase(),
          showroom_id: Number(f.get('showroom_id')),
          images: text('images').split('\n').map((l) => l.trim()).filter(Boolean),
          inspection: f.get('score')
            ? { ...car?.inspection, score, checked_on: text('checked_on'), items: (car?.inspection.items as unknown[]) ?? [] }
            : null,
          description: text('description'),
          is_published: f.get('is_published') === 'on',
        },
      },
      { onSuccess: onDone },
    )
  }

  return (
    <form className={s.form} onSubmit={submit}>
      <div className={s.grid3}>
        <Input name="stock_id" label="Stock ID" defaultValue={car?.stock_id} placeholder="UC-1500" required error={fields.stock_id} />
        <Input name="price" label="Price ₹ (set by used-car manager)" inputMode="numeric" defaultValue={car?.price} required error={fields.price} />
        <Select name="status" label="Status" defaultValue={car?.status ?? 'available'}>
          <option value="available">Available</option>
          <option value="booked">Booked</option>
          <option value="sold">Sold</option>
        </Select>
        <Input name="make" label="Make" defaultValue={car?.make ?? 'Brand X'} required error={fields.make} />
        <Input name="model" label="Model" defaultValue={car?.model} required error={fields.model} />
        <Input name="variant" label="Variant" defaultValue={car?.variant} required error={fields.variant} />
        <Select name="fuel" label="Fuel" defaultValue={car?.fuel ?? 'petrol'}>
          {['petrol', 'diesel', 'cng', 'hybrid', 'electric'].map((x) => (
            <option key={x} value={x}>
              {titleCase(x)}
            </option>
          ))}
        </Select>
        <Select name="transmission" label="Transmission" defaultValue={car?.transmission ?? 'manual'}>
          <option value="manual">Manual</option>
          <option value="automatic">Automatic</option>
        </Select>
        <Input name="colour" label="Colour" defaultValue={car?.colour} required error={fields.colour} />
        <Input name="year" label="Year" type="number" defaultValue={car?.year} required error={fields.year} />
        <Input name="km" label="Kilometres" inputMode="numeric" defaultValue={car?.km} required error={fields.km} />
        <Input name="owners" label="Owners" type="number" min={1} max={5} defaultValue={car?.owners ?? 1} required error={fields.owners} />
        <Input name="registration_no" label="Registration (full)" defaultValue={car?.registration_no} placeholder="UP32AB1234" required error={fields.registration_no} />
        <Select name="showroom_id" label="Location" defaultValue={car?.showroom_id ?? showrooms?.[0]?.id}>
          {showrooms?.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
        <Input name="score" label="Inspection score /100" type="number" min={0} max={100} defaultValue={car?.inspection.score} />
        <Input name="checked_on" label="Inspected on" type="date" defaultValue={car?.inspection.checked_on ?? istDay(0)} />
      </div>
      <Textarea name="images" label="Photo URLs (one per line)" defaultValue={car?.images.join('\n')} rows={3} error={fields.images} />
      <Textarea name="description" label="Description" defaultValue={car?.description} rows={3} />
      <div className="row">
        <Checkbox name="is_published" label="Listed on the site" defaultChecked={car?.is_published ?? true} />
        {car && (
          <Link to={`/used-cars/${car.slug}`} target="_blank" className="muted">
            View listing ↗
          </Link>
        )}
        <span className="spacer" />
        {save.error && !Object.keys(fields).length && <span className={s.error}>{save.error.message}</span>}
        <Button type="submit" variant="dark" loading={save.isPending}>
          {car ? 'Save car' : 'Add car'}
        </Button>
      </div>
    </form>
  )
}
