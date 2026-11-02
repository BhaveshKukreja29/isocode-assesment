import { useState, type FormEvent, type ReactNode } from 'react'
import { useI18n } from '@/i18n'
import { ApiError } from '@/lib/api'
import { useMe, type ContactPayload } from '@/lib/queries'
import { Button } from '../ui/Button'
import { Checkbox, Input, Textarea } from '../ui/Field'
import s from './ContactForm.module.css'

export type ContactValues = Omit<ContactPayload, 'consent'>

/**
 * Name / phone / email / message / consent, shared by every "call me" flow.
 * `extra` fields render above the contact fields and arrive in the FormData passed to onSubmit.
 */
export function ContactForm({
  submitLabel,
  onSubmit,
  pending,
  error,
  extra,
  messagePlaceholder,
}: {
  submitLabel: string
  onSubmit: (values: ContactPayload, form: FormData) => void
  pending: boolean
  error: unknown
  extra?: ReactNode
  messagePlaceholder?: string
}) {
  const { t } = useI18n()
  const { data: me } = useMe()
  const [consentMissing, setConsentMissing] = useState(false)
  const fields = error instanceof ApiError ? error.fields : {}

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const consent = data.get('consent') === 'on'
    setConsentMissing(!consent)
    if (!consent) return
    onSubmit({
      name: String(data.get('name')),
      phone: String(data.get('phone')),
      email: (data.get('email') as string) || undefined,
      message: (data.get('message') as string) ?? '',
      consent,
    }, data)
  }

  return (
    <form className={s.form} onSubmit={handleSubmit} noValidate>
      {extra}
      <div className={s.grid}>
        <Input
          name="name"
          label={t('form.name')}
          autoComplete="name"
          required
          minLength={2}
          defaultValue={me?.role === 'buyer' ? me.name : ''}
          error={fields.name}
        />
        <Input
          name="phone"
          label={t('form.phone')}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="98XXXXXXXX"
          required
          defaultValue={me?.role === 'buyer' ? (me.phone ?? '') : ''}
          error={fields.phone}
        />
      </div>
      <Input
        name="email"
        type="email"
        label={t('form.email')}
        autoComplete="email"
        defaultValue={me?.role === 'buyer' ? me.email : ''}
        error={fields.email}
      />
      <Textarea
        name="message"
        label={t('form.message')}
        hint={t('form.messageHint')}
        placeholder={messagePlaceholder}
        maxLength={1000}
        rows={3}
        error={fields.message}
      />
      <Checkbox
        name="consent"
        label={t('form.consent')}
        error={consentMissing || fields.consent ? t('form.consentRequired') : undefined}
      />
      {error instanceof Error && !Object.keys(fields).length && (
        <p className={s.error} role="alert">
          {error.message}
        </p>
      )}
      <Button type="submit" size="lg" block loading={pending}>
        {pending ? t('form.sending') : submitLabel}
      </Button>
    </form>
  )
}

export function Success({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={s.success} role="status">
      <span className={s.tick} aria-hidden>
        <svg width="22" height="22" viewBox="0 0 22 22">
          <path d="m5 11.5 4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <h3>{title}</h3>
      <div className="muted stack">{children}</div>
      {action}
    </div>
  )
}
