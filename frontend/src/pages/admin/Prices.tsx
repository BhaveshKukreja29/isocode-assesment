import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Input } from '@/components/ui/Field'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { usePriceGrid, useAdminModels, useSavePrices, type PriceCell } from '@/lib/admin'
import { istDay, lakh, titleCase } from '@/lib/format'
import s from './Admin.module.css'

const key = (variantId: number, cityId: number) => `${variantId}:${cityId}`

export function Prices() {
  const models = useAdminModels()
  const [picked, setPicked] = useState<number>()
  const modelId = picked ?? models.data?.[0]?.id

  return (
    <section>
      <header className={s.head}>
        <div>
          <h1>Price table</h1>
          <p className="muted">
            Ex-showroom price per variant per city. Road tax, insurance and fees come from{' '}
            <Link to="/admin/cities" className="mark">
              Cities &amp; tax
            </Link>
            ; the site computes every on-road breakup from these two tables.
          </p>
        </div>
      </header>
      {models.error ? (
        <ErrorState error={models.error} onRetry={models.refetch} />
      ) : (
        <>
          <div className="row gap-sm" style={{ marginBottom: '1rem' }}>
            {models.data?.map((m) => (
              <Chip key={m.id} selected={m.id === modelId} onClick={() => setPicked(m.id)}>
                {m.name}
              </Chip>
            )) ?? <Skeleton height={40} width={320} />}
          </div>
          {modelId && <Grid key={modelId} modelId={modelId} slug={models.data?.find((m) => m.id === modelId)?.slug} />}
        </>
      )}
    </section>
  )
}

function Grid({ modelId, slug }: { modelId: number; slug?: string }) {
  const grid = usePriceGrid(modelId)
  const save = useSavePrices()
  const [edits, setEdits] = useState<Record<string, string>>({})
  const existingValidity = grid.data?.variants.flatMap((v) => Object.values(v.prices).map((p) => p.valid_until)).sort().at(-1)
  const [validUntil, setValidUntil] = useState<string>()
  const validity = validUntil ?? existingValidity ?? istDay(30)

  if (grid.isPending) return <Skeleton height={240} />
  if (grid.error) return <ErrorState error={grid.error} onRetry={grid.refetch} />
  if (!grid.data.variants.length) return <EmptyState title="No variants yet" hint="Add variants under Models first." />

  const { cities, variants } = grid.data
  const dirty = Object.keys(edits).length

  function submit() {
    const cells: PriceCell[] = []
    for (const v of variants) {
      for (const c of cities) {
        const raw = edits[key(v.id, c.id)] ?? v.prices[c.id]?.ex_showroom?.toString()
        const amount = Number(raw)
        if (raw && amount > 0) cells.push({ variant_id: v.id, city_id: c.id, ex_showroom: amount, valid_until: validity })
      }
    }
    save.mutate(cells, { onSuccess: () => setEdits({}) })
  }

  return (
    <>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Variant</th>
              {cities.map((c) => (
                <th key={c.id} style={{ textAlign: 'right' }}>
                  {c.name} · ₹
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => (
              <tr key={v.id}>
                <td>
                  <strong>{v.name}</strong>{' '}
                  <span className="muted">
                    {titleCase(v.fuel)} · {titleCase(v.transmission)}
                    {!v.is_active && ' · hidden'}
                  </span>
                </td>
                {cities.map((c) => {
                  const k = key(v.id, c.id)
                  const saved = v.prices[c.id]?.ex_showroom
                  const value = edits[k] ?? saved?.toString() ?? ''
                  return (
                    <td key={c.id} style={{ textAlign: 'right' }}>
                      <input
                        className={s.cellInput}
                        inputMode="numeric"
                        aria-label={`${v.name} ex-showroom in ${c.name}`}
                        value={value}
                        placeholder="not priced"
                        data-dirty={k in edits || undefined}
                        data-empty={!value || undefined}
                        title={value ? lakh(Number(value)) : undefined}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [k]: e.target.value.replace(/\D/g, '') }))}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={s.bar}>
        <div style={{ width: 200 }}>
          <Input label="Valid until" type="date" value={validity} min={istDay(0)} onChange={(e) => setValidUntil(e.target.value)} />
        </div>
        <span className="muted" style={{ fontSize: '0.85rem' }}>
          {dirty ? `${dirty} unsaved change${dirty > 1 ? 's' : ''}` : 'All prices saved'}. Saving stamps every priced cell of this model with the validity date.
        </span>
        <span className="spacer" />
        {save.isSuccess && !dirty && <span className={s.ok}>Saved</span>}
        {save.error && <span className={s.error}>{save.error.message}</span>}
        {slug && (
          <Link to={`/cars/${slug}`} target="_blank" className="muted" style={{ fontSize: '0.85rem' }}>
            Preview ↗
          </Link>
        )}
        <Button variant="dark" loading={save.isPending} disabled={!dirty && validUntil === undefined} onClick={submit}>
          Save prices
        </Button>
      </div>
    </>
  )
}
