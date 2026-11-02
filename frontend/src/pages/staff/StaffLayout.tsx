import type { ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router'
import { Logo } from '@/components/layout/Logo'
import { useLogout } from '@/lib/auth'
import { useMe } from '@/lib/queries'
import s from './StaffLayout.module.css'

export default function StaffLayout({ children }: { children: ReactNode }) {
  const { data: me } = useMe()
  const logout = useLogout()
  const navigate = useNavigate()

  return (
    <div className={s.shell}>
      <header className={`${s.bar} dark`}>
        <Link to="/" aria-label="Public site">
          <Logo />
        </Link>
        <nav className={s.nav}>
          <NavLink to="/staff" end className={s.link}>
            Inbox
          </NavLink>
          {me?.role === 'admin' && (
            <NavLink to="/admin" className={s.link}>
              Admin
            </NavLink>
          )}
        </nav>
        <div className={s.user}>
          <span className={s.name}>
            {me?.name} <span className="muted">· {me?.role}</span>
          </span>
          <button className={s.out} onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/login') })}>
            Sign out
          </button>
        </div>
      </header>
      <main className={s.main}>{children}</main>
    </div>
  )
}
