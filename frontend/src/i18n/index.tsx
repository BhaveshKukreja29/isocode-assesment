import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { en, type MessageKey } from './en'
import { hi } from './hi'

export type Lang = 'en' | 'hi'
type Vars = Record<string, string | number>

const dictionaries = { en, hi }
const STORAGE_KEY = 'lang'

interface I18n {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: MessageKey, vars?: Vars) => string
}

const I18nContext = createContext<I18n | null>(null)

function initialLang(): Lang {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'en' || saved === 'hi') return saved
  return navigator.language.startsWith('hi') ? 'hi' : 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    localStorage.setItem(STORAGE_KEY, next)
    setLangState(next)
  }, [])

  const t = useCallback(
    (key: MessageKey, vars?: Vars) => {
      const text = dictionaries[lang][key] ?? en[key]
      return vars ? text.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? '')) : text
    },
    [lang],
  )

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])
  return <I18nContext value={value}>{children}</I18nContext>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider')
  return ctx
}

export type { MessageKey }
