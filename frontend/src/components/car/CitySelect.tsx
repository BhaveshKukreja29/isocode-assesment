import { useI18n } from '@/i18n'
import { useCity } from '@/lib/city'
import { useCities } from '@/lib/queries'
import { Select } from '../ui/Field'

export function CitySelect() {
  const { t } = useI18n()
  const { city, setCity } = useCity()
  const { data: cities } = useCities()
  return (
    <Select label={t('common.city')} value={city} onChange={(e) => setCity(e.target.value)}>
      {(cities ?? [{ slug: city, name: '…', id: 0 }]).map((c) => (
        <option key={c.slug} value={c.slug}>
          {c.name}
        </option>
      ))}
    </Select>
  )
}
