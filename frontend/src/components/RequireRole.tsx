import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { homeFor } from '@/lib/auth'
import { useMe } from '@/lib/queries'
import type { Role } from '@/lib/types'
import { PageLoader } from './ui/States'

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { data: user, isPending } = useMe()
  const location = useLocation()
  if (isPending) return <PageLoader />
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />
  return children
}
