import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { useI18n } from '@/i18n'
import { ApiError } from '@/lib/api'
import { homeFor, useLogin, useRegister } from '@/lib/auth'
import { useMe } from '@/lib/queries'
import type { User } from '@/lib/types'
import page from './Page.module.css'
import s from './Auth.module.css'

const DEMO_ACCOUNTS = [
  ['Buyer', 'buyer@demo.in'],
  ['Consultant', 'aman@demo.in'],
  ['Admin', 'admin@demo.in'],
] as const

function useAfterAuth() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')
  // Only follow same-site relative paths.
  return (user: User) => navigate(next?.startsWith('/') && !next.startsWith('//') ? next : homeFor(user), { replace: true })
}

export function Login() {
  const { t } = useI18n()
  const { data: me } = useMe()
  const login = useLogin()
  const afterAuth = useAfterAuth()

  if (me) return <Navigate to={homeFor(me)} replace />

  const submit = (email: string, password: string) => login.mutate({ email, password }, { onSuccess: afterAuth })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    submit(String(data.get('email')), String(data.get('password')))
  }

  return (
    <div className={`${page.narrow} section`}>
      <title>Sign in · Company A</title>
      <div className={`${page.panel} ${s.card}`}>
        <h1 className={s.title}>{t('auth.signIn')}</h1>
        <p className="muted">{t('auth.why')}</p>
        <form className="stack" onSubmit={onSubmit}>
          <Input name="email" type="email" label={t('auth.email')} autoComplete="email" required />
          <Input name="password" type="password" label={t('auth.password')} autoComplete="current-password" required />
          {login.error && (
            <p className={s.error} role="alert">
              {login.error.message}
            </p>
          )}
          <Button type="submit" size="lg" block loading={login.isPending}>
            {t('auth.signIn')}
          </Button>
        </form>
        <Link to="/register" className={s.switch}>
          {t('auth.noAccount')}
        </Link>
        <div className={s.demo}>
          <p className="eyebrow">{t('auth.demo')}</p>
          <div className="row gap-sm">
            {DEMO_ACCOUNTS.map(([label, email]) => (
              <Button key={email} variant="outline" size="sm" onClick={() => submit(email, 'Demo@1234')}>
                {label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function Register() {
  const { t } = useI18n()
  const { data: me } = useMe()
  const register = useRegister()
  const afterAuth = useAfterAuth()
  const fields = register.error instanceof ApiError ? register.error.fields : {}

  if (me) return <Navigate to={homeFor(me)} replace />

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    register.mutate(
      {
        name: String(data.get('name')),
        email: String(data.get('email')),
        phone: String(data.get('phone')),
        password: String(data.get('password')),
      },
      { onSuccess: afterAuth },
    )
  }

  return (
    <div className={`${page.narrow} section`}>
      <title>Create account · Company A</title>
      <div className={`${page.panel} ${s.card}`}>
        <h1 className={s.title}>{t('auth.register')}</h1>
        <p className="muted">{t('auth.why')}</p>
        <form className="stack" onSubmit={onSubmit} noValidate>
          <Input name="name" label={t('form.name')} autoComplete="name" required error={fields.name} />
          <Input name="email" type="email" label={t('auth.email')} autoComplete="email" required error={fields.email} />
          <Input name="phone" type="tel" inputMode="tel" label={t('form.phone')} autoComplete="tel-national" required error={fields.phone} />
          <Input
            name="password"
            type="password"
            label={t('auth.password')}
            autoComplete="new-password"
            minLength={8}
            required
            hint={t('auth.passwordHint')}
            error={fields.password}
          />
          {register.error && !Object.keys(fields).length && (
            <p className={s.error} role="alert">
              {register.error.message}
            </p>
          )}
          <Button type="submit" size="lg" block loading={register.isPending}>
            {t('auth.register')}
          </Button>
        </form>
        <Link to="/login" className={s.switch}>
          {t('auth.haveAccount')}
        </Link>
      </div>
    </div>
  )
}
