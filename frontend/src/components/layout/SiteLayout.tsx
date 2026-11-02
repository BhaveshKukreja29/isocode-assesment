import { useState } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router'
import { useI18n } from '@/i18n'
import { homeFor } from '@/lib/auth'
import { useMe, useShowrooms } from '@/lib/queries'
import { Logo } from './Logo'
import s from './SiteLayout.module.css'

export function SiteLayout() {
  const { t, lang, setLang } = useI18n()
  const { data: user } = useMe()
  const { pathname } = useLocation()
  // Remember where the menu was opened; navigating anywhere closes it.
  const [menuPath, setMenuPath] = useState<string | null>(null)
  const menuOpen = menuPath === pathname

  const accountLabel = !user
    ? t('nav.signIn')
    : user.role === 'buyer'
      ? t('nav.account')
      : user.role === 'admin'
        ? t('nav.admin')
        : t('nav.staff')

  const links = [
    ['/cars', t('nav.cars')],
    ['/used-cars', t('nav.used')],
    ['/test-drive', t('nav.testDrive')],
    ['/trade-in', t('nav.tradeIn')],
  ] as const

  return (
    <>
      <a href="#main" className={s.skip}>
        Skip to content
      </a>
      <header className={`${s.header} dark`} data-open={menuOpen || undefined}>
        <div className={`page ${s.bar}`}>
          <Link to="/" className={s.brand} aria-label="Company A home">
            <Logo />
          </Link>
          <nav className={s.nav} aria-label="Main">
            {links.map(([to, label]) => (
              <NavLink key={to} to={to} className={s.link}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className={s.actions}>
            <button className={s.lang} onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}>
              {t('nav.language')}
            </button>
            <Link to={user ? homeFor(user) : '/login'} className={s.account}>
              {accountLabel}
            </Link>
            <button
              className={s.burger}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              aria-label={t('nav.menu')}
              onClick={() => setMenuPath(menuOpen ? null : pathname)}
            >
              <span />
              <span />
            </button>
          </div>
        </div>
        <nav id="mobile-nav" className={s.mobileNav} aria-label="Mobile" inert={!menuOpen}>
          <div>
            {links.map(([to, label]) => (
              <NavLink key={to} to={to} className={s.mobileLink}>
                {label}
              </NavLink>
            ))}
            <NavLink to={user ? homeFor(user) : '/login'} className={s.mobileLink}>
              {accountLabel}
            </NavLink>
          </div>
        </nav>
      </header>
      <main id="main" className={s.main}>
        <Outlet />
      </main>
      <SiteFooter />
      <ScrollRestoration />
    </>
  )
}

function SiteFooter() {
  const { t } = useI18n()
  const { data: showrooms } = useShowrooms()
  return (
    <footer className={`${s.footer} dark`}>
      <div className={`page ${s.footerGrid}`}>
        <div className={s.footerBrand}>
          <Logo />
          <p className="muted">{t('footer.tagline')}</p>
        </div>
        {showrooms?.map((room) => (
          <address key={room.id} className={s.showroom}>
            <strong>{room.name}</strong>
            <span className="muted">{room.address}</span>
            <a href={`tel:${room.phone}`} className="num">
              {room.phone}
            </a>
          </address>
        ))}
      </div>
      <div className={`page ${s.legal}`}>
        <p>{t('footer.prices')}</p>
        <p>{t('footer.privacy')}</p>
      </div>
    </footer>
  )
}
