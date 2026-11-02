import type { MessageKey } from '@/i18n'

type T = (key: MessageKey, vars?: Record<string, string | number>) => string

export function ownerLabel(t: T, owners: number) {
  return owners <= 3 ? t(`used.owner${owners}` as MessageKey) : t('used.ownerN', { n: owners })
}
