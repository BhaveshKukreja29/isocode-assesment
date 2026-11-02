import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Checkbox, Input, Select } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { useAdminModels, useCreateUser, useStaffAccounts, useUpdateUser, type StaffAccount } from '@/lib/admin'
import { ApiError } from '@/lib/api'
import { titleCase } from '@/lib/format'
import { useMe, useShowrooms } from '@/lib/queries'
import type { Role } from '@/lib/types'
import s from './Admin.module.css'

const ROLES: Role[] = ['consultant', 'admin', 'buyer']

export function Users() {
  const users = useStaffAccounts()
  const { data: showrooms } = useShowrooms()
  const { data: models } = useAdminModels()
  const { data: me } = useMe()
  const update = useUpdateUser()
  const [creating, setCreating] = useState(false)
  const [skills, setSkills] = useState<StaffAccount>()

  const showroomName = (id: number | null) => showrooms?.find((r) => r.id === id)?.name ?? '—'
  const modelNames = (ids: number[]) =>
    ids.length ? ids.map((id) => models?.find((m) => m.id === id)?.name).filter(Boolean).join(', ') : 'All models'

  return (
    <section>
      <header className={s.head}>
        <div>
          <h1>Users &amp; roles</h1>
          <p className="muted">
            Consultants get leads for their showroom; specialisations steer leads for those models to them first. Deactivated
            consultants stop receiving new leads.
          </p>
        </div>
        <Button variant="dark" onClick={() => setCreating(true)}>
          + Add user
        </Button>
      </header>
      {update.error && <p className={s.error}>{update.error.message}</p>}
      {users.error ? (
        <ErrorState error={users.error} onRetry={users.refetch} />
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Showroom</th>
                <th>Sells</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {users.data?.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.name}</strong> <span className="muted">{u.email}</span>
                  </td>
                  <td>
                    <select
                      className={s.cellInput}
                      style={{ textAlign: 'left' }}
                      aria-label={`Role for ${u.name}`}
                      value={u.role}
                      disabled={u.id === me?.id}
                      onChange={(e) => update.mutate({ id: u.id, role: e.target.value as Role })}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {titleCase(r)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {u.role === 'consultant' ? (
                      <select
                        className={s.cellInput}
                        style={{ textAlign: 'left', width: 150 }}
                        aria-label={`Showroom for ${u.name}`}
                        value={u.showroom_id ?? ''}
                        onChange={(e) => update.mutate({ id: u.id, showroom_id: Number(e.target.value) || null })}
                      >
                        <option value="">None</option>
                        {showrooms?.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      showroomName(u.showroom_id)
                    )}
                  </td>
                  <td>
                    {u.role === 'consultant' ? (
                      <Button size="sm" variant="ghost" onClick={() => setSkills(u)}>
                        {modelNames(u.model_ids)} ✎
                      </Button>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`${u.name} active`}
                      checked={u.is_active}
                      disabled={u.id === me?.id}
                      onChange={(e) => update.mutate({ id: u.id, is_active: e.target.checked })}
                    />
                  </td>
                </tr>
              )) ?? (
                <tr>
                  <td colSpan={5}>
                    <Skeleton height={200} />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={creating} onClose={() => setCreating(false)} title="Add user">
        {creating && <CreateUser onDone={() => setCreating(false)} />}
      </Sheet>
      <Sheet open={!!skills} onClose={() => setSkills(undefined)} title={`${skills?.name ?? ''} sells`}>
        {skills && (
          <form
            className={s.form}
            onSubmit={(e) => {
              e.preventDefault()
              const ids = new FormData(e.currentTarget).getAll('model').map(Number)
              update.mutate({ id: skills.id, model_ids: ids }, { onSuccess: () => setSkills(undefined) })
            }}
          >
            <p className="muted">Leave all unticked for a generalist who can take any model.</p>
            {models?.map((m) => (
              <Checkbox key={m.id} name="model" value={m.id} label={m.name} defaultChecked={skills.model_ids.includes(m.id)} />
            ))}
            <Button type="submit" variant="dark" loading={update.isPending}>
              Save
            </Button>
          </form>
        )}
      </Sheet>
    </section>
  )
}

function CreateUser({ onDone }: { onDone: () => void }) {
  const create = useCreateUser()
  const { data: showrooms } = useShowrooms()
  const fields = create.error instanceof ApiError ? create.error.fields : {}

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const f = new FormData(event.currentTarget)
    create.mutate(
      {
        name: String(f.get('name')),
        email: String(f.get('email')),
        phone: (f.get('phone') as string) || null,
        password: String(f.get('password')),
        role: f.get('role') as Role,
        showroom_id: Number(f.get('showroom_id')) || null,
        model_ids: [],
      },
      { onSuccess: onDone },
    )
  }

  return (
    <form className={s.form} onSubmit={submit}>
      <Input name="name" label="Name" required error={fields.name} />
      <Input name="email" type="email" label="Email" required error={fields.email} />
      <Input name="phone" type="tel" label="Mobile (optional)" error={fields.phone} />
      <Input name="password" type="password" label="Temporary password" minLength={8} required error={fields.password} hint="At least 8 characters. Share it securely." />
      <div className={s.grid2}>
        <Select name="role" label="Role" defaultValue="consultant">
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {titleCase(r)}
            </option>
          ))}
        </Select>
        <Select name="showroom_id" label="Showroom">
          <option value="">None</option>
          {showrooms?.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
      </div>
      {create.error && !Object.keys(fields).length && <p className={s.error}>{create.error.message}</p>}
      <Button type="submit" variant="dark" loading={create.isPending}>
        Create user
      </Button>
    </form>
  )
}
