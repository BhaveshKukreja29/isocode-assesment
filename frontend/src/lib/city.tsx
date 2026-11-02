import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

const KEY = 'city'
const DEFAULT_CITY = 'lucknow'

const CityContext = createContext<{ city: string; setCity: (slug: string) => void } | null>(null)

/** The buyer's registration city drives every on-road price on the site. */
export function CityProvider({ children }: { children: ReactNode }) {
  const [city, setState] = useState(() => localStorage.getItem(KEY) ?? DEFAULT_CITY)
  const setCity = useCallback((slug: string) => {
    localStorage.setItem(KEY, slug)
    setState(slug)
  }, [])
  const value = useMemo(() => ({ city, setCity }), [city, setCity])
  return <CityContext value={value}>{children}</CityContext>
}

export function useCity() {
  const ctx = useContext(CityContext)
  if (!ctx) throw new Error('useCity must be used inside CityProvider')
  return ctx
}
