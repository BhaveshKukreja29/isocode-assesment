import { ButtonLink } from '@/components/ui/Button'
import { useI18n } from '@/i18n'
import page from './Page.module.css'

export default function NotFound() {
  const { t } = useI18n()
  return (
    <div className={`${page.narrow} section stack`}>
      <title>Page not found · Company A</title>
      <p className="eyebrow">404</p>
      <h1 className={page.title}>{t('notFound.title')}</h1>
      <p className="muted">{t('notFound.body')}</p>
      <div>
        <ButtonLink to="/">{t('notFound.home')}</ButtonLink>
      </div>
    </div>
  )
}
