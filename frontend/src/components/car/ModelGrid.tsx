import { useCity } from '@/lib/city'
import { useModels } from '@/lib/queries'
import { ErrorState } from '../ui/States'
import { CardSkeleton, ModelCard } from './Cards'
import s from './Grid.module.css'

export function ModelGrid() {
  const { city } = useCity()
  const { data: models, error, refetch, isPending } = useModels(city)

  if (error) return <ErrorState error={error} onRetry={refetch} />
  return (
    <div className={`${s.grid} ${s.two}`}>
      {isPending
        ? Array.from({ length: 4 }, (_, i) => <CardSkeleton key={i} />)
        : models.map((model, i) => <ModelCard key={model.slug} model={model} priority={i < 2} />)}
    </div>
  )
}
