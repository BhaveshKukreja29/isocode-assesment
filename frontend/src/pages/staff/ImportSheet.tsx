import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { useImportCsv } from '@/lib/staff'
import s from './ImportSheet.module.css'

export function ImportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const upload = useImportCsv()
  const [file, setFile] = useState<File | null>(null)

  const close = () => {
    upload.reset()
    setFile(null)
    onClose()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (file) upload.mutate(file)
  }

  return (
    <Sheet open={open} onClose={close} title="Import portal leads">
      <div className="stack">
        <p className="muted">
          Upload a CSV export from a car portal. Columns: <code className="mono">name, phone</code> (required),{' '}
          <code className="mono">email, model, message, portal, ref, received_at</code>. Duplicates (same phone and model in
          the last 30 days, or same portal ref) are skipped. Each new lead is assigned and acknowledged straight away.
        </p>
        <a href="/sample-portal-leads.csv" download className={s.sample}>
          Download a sample CSV ↓
        </a>

        {upload.data ? (
          <div className={s.result} role="status">
            <div className={s.counts}>
              <span>
                <strong className="num">{upload.data.created}</strong> imported
              </span>
              <span>
                <strong className="num">{upload.data.duplicates}</strong> duplicates skipped
              </span>
              <span>
                <strong className="num">{upload.data.errors.length}</strong> rows with errors
              </span>
            </div>
            {upload.data.errors.length > 0 && (
              <ul className={s.errors}>
                {upload.data.errors.map((e) => (
                  <li key={e.row}>
                    <span className="mono">Row {e.row}</span> {e.error}
                  </li>
                ))}
              </ul>
            )}
            <Button variant="dark" onClick={close}>
              Done
            </Button>
          </div>
        ) : (
          <form className="stack" onSubmit={submit}>
            <Input
              label="CSV file"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              error={upload.error?.message}
            />
            <Button type="submit" disabled={!file} loading={upload.isPending}>
              Import
            </Button>
          </form>
        )}
      </div>
    </Sheet>
  )
}
