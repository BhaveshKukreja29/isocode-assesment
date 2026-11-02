import type { ButtonHTMLAttributes, ReactNode } from 'react'
import s from './Chip.module.css'

export function Chip({
  selected,
  children,
  className,
  ...rest
}: { selected?: boolean; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-pressed={selected} className={`${s.chip} ${className ?? ''}`} {...rest}>
      {children}
    </button>
  )
}

export function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'warn' | 'danger' | 'ok' | 'dark' }) {
  return <span className={`${s.tag} ${s[tone]}`}>{children}</span>
}
