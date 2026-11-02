import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Tag } from '@/components/ui/Chip'
import { Checkbox, Input, Select, Textarea } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { ErrorState, Skeleton } from '@/components/ui/States'
import {
  useAdminModel,
  useAdminModels,
  useSaveModel,
  useSaveVariant,
  type AdminModel,
  type AdminVariant,
  type ModelInput,
} from '@/lib/admin'
import { ApiError } from '@/lib/api'
import { titleCase } from '@/lib/format'
import type { Fuel, Transmission } from '@/lib/types'
import s from './Admin.module.css'

const SPEC_KEYS = ['engine', 'power', 'torque', 'mileage', 'seats', 'boot', 'airbags']
const lines = (text: FormDataEntryValue | null) =>
  String(text ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

export function Models() {
  const models = useAdminModels()
  const [editing, setEditing] = useState<number | 'new'>()

  return (
    <section>
      <header className={s.head}>
        <div>
          <h1>Models</h1>
          <p className="muted">Content for each model page: photos, copy, colours, accessory packs and variants.</p>
        </div>
        <Button variant="dark" onClick={() => setEditing('new')}>
          + New model
        </Button>
      </header>
      {models.error ? (
        <ErrorState error={models.error} onRetry={models.refetch} />
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Model</th>
                <th>Body</th>
                <th>Variants</th>
                <th>Priced cells</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {models.data?.map((m) => (
                <tr key={m.id} data-clickable onClick={() => setEditing(m.id)}>
                  <td>
                    <strong>{m.name}</strong> <span className="muted mono">/cars/{m.slug}</span>
                  </td>
                  <td>{m.body_type}</td>
                  <td className="num">{m.variant_count}</td>
                  <td className="num">{m.priced_cells}</td>
                  <td>{m.is_published ? <Tag tone="ok">Published</Tag> : <Tag>Hidden</Tag>}</td>
                </tr>
              )) ?? (
                <tr>
                  <td colSpan={5}>
                    <Skeleton height={120} />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <Sheet open={editing !== undefined} onClose={() => setEditing(undefined)} title={editing === 'new' ? 'New model' : 'Edit model'} wide>
        {editing !== undefined && <ModelEditor id={editing === 'new' ? undefined : editing} onCreated={setEditing} />}
      </Sheet>
    </section>
  )
}

function ModelEditor({ id, onCreated }: { id?: number; onCreated: (id: number) => void }) {
  const model = useAdminModel(id)
  if (id && model.isPending) return <Skeleton height={400} />
  if (model.error) return <ErrorState error={model.error} onRetry={model.refetch} />
  return (
    <div className="stack" style={{ gap: '1.5rem' }}>
      <ModelForm key={model.data?.id ?? 'new'} model={model.data} onCreated={onCreated} />
      {model.data && <Variants model={model.data} />}
    </div>
  )
}

function ModelForm({ model, onCreated }: { model?: AdminModel; onCreated: (id: number) => void }) {
  const save = useSaveModel()
  const fields = save.error instanceof ApiError ? save.error.fields : {}
  const [colours, setColours] = useState(model?.colours ?? [])
  const [packs, setPacks] = useState(model?.accessory_packs ?? [])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const f = new FormData(event.currentTarget)
    const body: ModelInput = {
      slug: String(f.get('slug')),
      name: String(f.get('name')),
      body_type: String(f.get('body_type')),
      tagline: String(f.get('tagline')),
      description: String(f.get('description')),
      images: lines(f.get('images')),
      highlights: lines(f.get('highlights')),
      is_published: f.get('is_published') === 'on',
      sort_order: Number(f.get('sort_order')) || 0,
      colours,
      accessory_packs: packs.map(({ name, items, price }) => ({ name, items, price })),
    }
    save.mutate({ id: model?.id, body }, { onSuccess: (saved) => !model && onCreated(saved.id) })
  }

  return (
    <form className={s.form} onSubmit={submit}>
      <div className={s.grid3}>
        <Input name="name" label="Name" defaultValue={model?.name} required error={fields.name} />
        <Input name="slug" label="URL slug" defaultValue={model?.slug} pattern="[a-z0-9\-]+" required error={fields.slug} />
        <Input name="body_type" label="Body type" defaultValue={model?.body_type} required error={fields.body_type} />
      </div>
      <Input name="tagline" label="Tagline" defaultValue={model?.tagline} error={fields.tagline} />
      <Textarea name="description" label="Description" defaultValue={model?.description} rows={3} error={fields.description} />
      <div className={s.grid2}>
        <Textarea name="images" label="Photo URLs (one per line)" defaultValue={model?.images.join('\n')} rows={4} error={fields.images} />
        <Textarea name="highlights" label="Highlights (one per line)" defaultValue={model?.highlights.join('\n')} rows={4} error={fields.highlights} />
      </div>

      <div className={s.section}>
        <h3>Colours</h3>
        {colours.map((c, i) => (
          <div key={i} className="row gap-sm">
            <input type="color" aria-label="Colour" value={c.hex} onChange={(e) => setColours(colours.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))} />
            <input className={s.cellInput} style={{ width: 200, textAlign: 'left' }} aria-label="Colour name" value={c.name} onChange={(e) => setColours(colours.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <button type="button" className={s.iconBtn} aria-label="Remove colour" onClick={() => setColours(colours.filter((_, j) => j !== i))}>
              ×
            </button>
          </div>
        ))}
        <div>
          <Button size="sm" variant="outline" onClick={() => setColours([...colours, { name: '', hex: '#cccccc' }])}>
            + Colour
          </Button>
        </div>
      </div>

      <div className={s.section}>
        <h3>Accessory packs</h3>
        {packs.map((p, i) => (
          <div key={i} className="row gap-sm">
            <input className={s.cellInput} style={{ width: 160, textAlign: 'left' }} aria-label="Pack name" value={p.name} onChange={(e) => setPacks(packs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <input className={s.cellInput} aria-label="Price" inputMode="numeric" value={p.price} onChange={(e) => setPacks(packs.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) || 0 } : x)))} />
            <input
              className={s.cellInput}
              style={{ width: 280, textAlign: 'left' }}
              aria-label="Items, comma separated"
              placeholder="Items, comma separated"
              value={p.items.join(', ')}
              onChange={(e) => setPacks(packs.map((x, j) => (j === i ? { ...x, items: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) } : x)))}
            />
            <button type="button" className={s.iconBtn} aria-label="Remove pack" onClick={() => setPacks(packs.filter((_, j) => j !== i))}>
              ×
            </button>
          </div>
        ))}
        <div>
          <Button size="sm" variant="outline" onClick={() => setPacks([...packs, { name: '', items: [], price: 0 }])}>
            + Pack
          </Button>
        </div>
      </div>

      <div className="row">
        <Checkbox name="is_published" label="Published on the site" defaultChecked={model?.is_published ?? false} />
        <div style={{ width: 110 }}>
          <Input name="sort_order" label="Order" type="number" defaultValue={model?.sort_order ?? 0} />
        </div>
        <span className="spacer" />
        {save.isSuccess && <span className={s.ok}>Saved</span>}
        {save.error && !Object.keys(fields).length && <span className={s.error}>{save.error.message}</span>}
        <Button type="submit" variant="dark" loading={save.isPending}>
          {model ? 'Save model' : 'Create model'}
        </Button>
      </div>
    </form>
  )
}

function Variants({ model }: { model: AdminModel }) {
  const [editing, setEditing] = useState<AdminVariant | 'new'>()
  return (
    <div className={s.section}>
      <div className="row">
        <h3>Variants</h3>
        <span className="spacer" />
        <Button size="sm" variant="outline" onClick={() => setEditing('new')}>
          + Variant
        </Button>
      </div>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <tbody>
            {model.variants.map((v) => (
              <tr key={v.id} data-clickable onClick={() => setEditing(v)}>
                <td>
                  <strong>{v.name}</strong>
                </td>
                <td>
                  {titleCase(v.fuel)} · {titleCase(v.transmission)}
                </td>
                <td className="muted">{v.specs.engine}</td>
                <td>{v.is_active ? <Tag tone="ok">Active</Tag> : <Tag>Hidden</Tag>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <VariantForm key={editing === 'new' ? 'new' : editing.id} modelId={model.id} variant={editing === 'new' ? undefined : editing} onDone={() => setEditing(undefined)} />}
    </div>
  )
}

function VariantForm({ modelId, variant, onDone }: { modelId: number; variant?: AdminVariant; onDone: () => void }) {
  const save = useSaveVariant(modelId)
  const fields = save.error instanceof ApiError ? save.error.fields : {}

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const f = new FormData(event.currentTarget)
    save.mutate(
      {
        id: variant?.id,
        body: {
          name: String(f.get('name')),
          fuel: f.get('fuel') as Fuel,
          transmission: f.get('transmission') as Transmission,
          is_active: f.get('is_active') === 'on',
          sort_order: Number(f.get('sort_order')) || 0,
          specs: Object.fromEntries(SPEC_KEYS.map((k) => [k, String(f.get(`spec_${k}`) ?? '')]).filter(([, v]) => v)),
        },
      },
      { onSuccess: onDone },
    )
  }

  return (
    <form className={`${s.card} ${s.form}`} onSubmit={submit}>
      <div className={s.grid3}>
        <Input name="name" label="Variant name" defaultValue={variant?.name} required error={fields.name} />
        <Select name="fuel" label="Fuel" defaultValue={variant?.fuel ?? 'petrol'}>
          {['petrol', 'diesel', 'cng', 'hybrid', 'electric'].map((f) => (
            <option key={f} value={f}>
              {titleCase(f)}
            </option>
          ))}
        </Select>
        <Select name="transmission" label="Transmission" defaultValue={variant?.transmission ?? 'manual'}>
          <option value="manual">Manual</option>
          <option value="automatic">Automatic</option>
        </Select>
      </div>
      <div className={s.grid3}>
        {SPEC_KEYS.map((k) => (
          <Input key={k} name={`spec_${k}`} label={titleCase(k)} defaultValue={variant?.specs[k]} />
        ))}
        <Input name="sort_order" label="Order" type="number" defaultValue={variant?.sort_order ?? 0} />
      </div>
      <div className="row">
        <Checkbox name="is_active" label="Active (shown and bookable)" defaultChecked={variant?.is_active ?? true} />
        <span className="spacer" />
        {save.error && <span className={s.error}>{save.error.message}</span>}
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="dark" loading={save.isPending}>
          {variant ? 'Save variant' : 'Add variant'}
        </Button>
      </div>
    </form>
  )
}
