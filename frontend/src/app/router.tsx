import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Outlet } from 'react-router'
import { SiteLayout } from '@/components/layout/SiteLayout'
import { PageLoader } from '@/components/ui/States'
import { RequireRole } from '@/components/RequireRole'
import Home from '@/pages/Home'

// Everything but the landing page is split out so the first load stays small.
const Models = lazy(() => import('@/pages/Models'))
const ModelPage = lazy(() => import('@/pages/ModelPage'))
const UsedCars = lazy(() => import('@/pages/UsedCars'))
const UsedCarPage = lazy(() => import('@/pages/UsedCarPage'))
const TestDrive = lazy(() => import('@/pages/TestDrive'))
const TradeIn = lazy(() => import('@/pages/TradeIn'))
const Login = lazy(() => import('@/pages/Auth').then((m) => ({ default: m.Login })))
const Register = lazy(() => import('@/pages/Auth').then((m) => ({ default: m.Register })))
const Account = lazy(() => import('@/pages/Account'))
const NotFound = lazy(() => import('@/pages/NotFound'))
const StaffLayout = lazy(() => import('@/pages/staff/StaffLayout'))
const Inbox = lazy(() => import('@/pages/staff/Inbox'))
const Admin = lazy(() => import('@/pages/admin/Admin'))

const page = (element: ReactNode) => <Suspense fallback={<PageLoader />}>{element}</Suspense>

export const router = createBrowserRouter([
  {
    element: <SiteLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'cars', element: page(<Models />) },
      { path: 'cars/:slug', element: page(<ModelPage />) },
      { path: 'used-cars', element: page(<UsedCars />) },
      { path: 'used-cars/:slug', element: page(<UsedCarPage />) },
      { path: 'test-drive', element: page(<TestDrive />) },
      { path: 'trade-in', element: page(<TradeIn />) },
      { path: 'login', element: page(<Login />) },
      { path: 'register', element: page(<Register />) },
      { path: 'account', element: page(<RequireRole roles={['buyer']}><Account /></RequireRole>) },
      { path: '*', element: page(<NotFound />) },
    ],
  },
  {
    element: page(
      <RequireRole roles={['consultant', 'admin']}>
        <StaffLayout>
          <Outlet />
        </StaffLayout>
      </RequireRole>,
    ),
    children: [
      { path: 'staff', element: page(<Inbox />) },
      { path: 'staff/leads/:id', element: page(<Inbox />) },
      { path: 'admin/*', element: page(<RequireRole roles={['admin']}><Admin /></RequireRole>) },
    ],
  },
])
