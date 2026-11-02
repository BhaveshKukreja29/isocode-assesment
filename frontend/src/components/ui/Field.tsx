import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import s from './Field.module.css'

interface FieldProps {
  label: ReactNode
  error?: string
  hint?: ReactNode
}

function Wrap({ id, label, error, hint, children }: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className={s.field} data-invalid={!!error || undefined}>
      <label htmlFor={id} className={s.label}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} className={s.error} role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-msg`} className={s.hint}>
            {hint}
          </p>
        )
      )}
    </div>
  )
}

const describedBy = (id: string, props: FieldProps) => (props.error || props.hint ? `${id}-msg` : undefined)

export function Input({ label, error, hint, ...rest }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <Wrap id={id} label={label} error={error} hint={hint}>
      <input
        id={id}
        className={s.control}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy(id, { label, error, hint })}
        {...rest}
      />
    </Wrap>
  )
}

export function Select({
  label,
  error,
  hint,
  children,
  ...rest
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId()
  return (
    <Wrap id={id} label={label} error={error} hint={hint}>
      <select
        id={id}
        className={`${s.control} ${s.select}`}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy(id, { label, error, hint })}
        {...rest}
      >
        {children}
      </select>
    </Wrap>
  )
}

export function Textarea({ label, error, hint, ...rest }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return (
    <Wrap id={id} label={label} error={error} hint={hint}>
      <textarea
        id={id}
        className={`${s.control} ${s.textarea}`}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy(id, { label, error, hint })}
        {...rest}
      />
    </Wrap>
  )
}

export function Checkbox({
  label,
  error,
  ...rest
}: { label: ReactNode; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <div className={s.check} data-invalid={!!error || undefined}>
      <input id={id} type="checkbox" aria-invalid={!!error || undefined} {...rest} />
      <label htmlFor={id}>{label}</label>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
