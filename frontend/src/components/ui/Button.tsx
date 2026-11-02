import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import s from './Button.module.css'

type Variant = 'primary' | 'dark' | 'outline' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface Common {
  variant?: Variant
  size?: Size
  block?: boolean
  children: ReactNode
}

const cls = ({ variant = 'primary', size = 'md', block }: Omit<Common, 'children'>, extra?: string) =>
  [s.btn, s[variant], s[size], block && s.block, extra].filter(Boolean).join(' ')

export function Button({
  variant,
  size,
  block,
  loading,
  className,
  children,
  ...rest
}: Common & ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      type="button"
      className={cls({ variant, size, block }, className)}
      aria-busy={loading || undefined}
      disabled={rest.disabled || loading}
      {...rest}
    >
      {loading && <span className={s.spinner} aria-hidden />}
      {children}
    </button>
  )
}

export function ButtonLink({ variant, size, block, className, children, ...rest }: Common & LinkProps) {
  return (
    <Link className={cls({ variant, size, block }, className)} {...rest}>
      {children}
    </Link>
  )
}
