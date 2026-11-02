import { useEffect, useRef, type ReactNode } from 'react'
import { useI18n } from '@/i18n'
import s from './Sheet.module.css'

/** Native <dialog>: focus trap, Esc and inert background for free. Bottom sheet on phones. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const { t } = useI18n()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={`${s.sheet} ${wide ? s.wide : ''}`}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {open && (
        <div className={s.inner}>
          <header className={s.head}>
            <h2 className={s.title}>{title}</h2>
            <button className={s.close} onClick={onClose} aria-label={t('common.close')}>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <path d="M1 1l12 12M13 1 1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </header>
          <div className={s.body}>{children}</div>
        </div>
      )}
    </dialog>
  )
}
