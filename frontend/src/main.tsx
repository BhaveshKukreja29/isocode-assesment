import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from '@/app/router'
import { I18nProvider } from '@/i18n'
import { CityProvider } from '@/lib/city'
import '@/styles/global.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: (count, error) => count < 2 && ((error as { status?: number }).status ?? 500) >= 500,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <CityProvider>
          <RouterProvider router={router} />
        </CityProvider>
      </I18nProvider>
    </QueryClientProvider>
  </StrictMode>,
)
