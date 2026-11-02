import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, query } from './api'
import type {
  ActivityItem,
  City,
  DemoCar,
  LeadCreated,
  ModelCard,
  ModelDetail,
  Page,
  PriceBreakup,
  Showroom,
  Slot,
  UsedCarCard,
  UsedCarDetail,
  User,
} from './types'

const LONG = 10 * 60_000

export const keys = {
  me: ['me'] as const,
  cities: ['cities'] as const,
  showrooms: ['showrooms'] as const,
  models: (city: string) => ['models', city] as const,
  model: (slug: string, city: string) => ['model', slug, city] as const,
  price: (slug: string, variantId: number, city: string, packId?: number) =>
    ['price', slug, variantId, city, packId ?? null] as const,
  used: (params: Record<string, unknown>) => ['used', params] as const,
  usedCar: (slug: string) => ['used-car', slug] as const,
  demoCars: (slug: string, showroomId?: number) => ['demo-cars', slug, showroomId ?? null] as const,
  slots: (demoCarId: number, day: string) => ['slots', demoCarId, day] as const,
  activity: ['activity'] as const,
}

export const modelQuery = (slug: string, city: string) => ({
  queryKey: keys.model(slug, city),
  queryFn: () => api<ModelDetail>(`/models/${slug}${query({ city })}`),
})

export const useCities = () =>
  useQuery({ queryKey: keys.cities, queryFn: () => api<City[]>('/cities'), staleTime: LONG })

export const useShowrooms = () =>
  useQuery({ queryKey: keys.showrooms, queryFn: () => api<Showroom[]>('/showrooms'), staleTime: LONG })

export const useModels = (city: string) =>
  useQuery({ queryKey: keys.models(city), queryFn: () => api<ModelCard[]>(`/models${query({ city })}`) })

export const useModel = (slug: string, city: string) =>
  useQuery({ ...modelQuery(slug, city), placeholderData: keepPreviousData })

export const usePrice = (slug: string, variantId: number | undefined, city: string, packId?: number) =>
  useQuery({
    queryKey: keys.price(slug, variantId ?? 0, city, packId),
    queryFn: () =>
      api<PriceBreakup>(`/models/${slug}/price${query({ variant_id: variantId, city, pack_id: packId })}`),
    enabled: variantId !== undefined,
    placeholderData: keepPreviousData,
    retry: false,
  })

export type UsedParams = Record<string, string | string[] | number | boolean | undefined>

export const useUsedCars = (params: UsedParams) =>
  useQuery({
    queryKey: keys.used(params),
    queryFn: ({ signal }) => api<Page<UsedCarCard>>(`/used-cars${query(params)}`, { signal }),
    placeholderData: keepPreviousData,
  })

export const useUsedCar = (slug: string) =>
  useQuery({
    queryKey: keys.usedCar(slug),
    queryFn: () => api<UsedCarDetail>(`/used-cars/${slug}`),
    retry: (count, error) => (error as { status?: number }).status !== 404 && count < 2,
  })

export const useDemoCars = (slug: string | undefined, showroomId?: number) =>
  useQuery({
    queryKey: keys.demoCars(slug ?? '', showroomId),
    queryFn: () => api<DemoCar[]>(`/models/${slug}/demo-cars${query({ showroom_id: showroomId })}`),
    enabled: !!slug && showroomId !== undefined,
  })

export const useSlots = (demoCarId: number | undefined, day: string) =>
  useQuery({
    queryKey: keys.slots(demoCarId ?? 0, day),
    queryFn: () => api<Slot[]>(`/test-drives/slots${query({ demo_car_id: demoCarId, day })}`),
    enabled: demoCarId !== undefined,
    staleTime: 15_000,
    refetchInterval: 60_000,
  })

export const useActivity = (enabled: boolean) =>
  useQuery({
    queryKey: keys.activity,
    queryFn: () => api<ActivityItem[]>('/me/activity'),
    enabled,
  })

export interface ContactPayload {
  name: string
  phone: string
  email?: string
  message?: string
  consent: boolean
}

export function useEnquiry() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: ContactPayload & Record<string, unknown>) =>
      api<LeadCreated>('/leads', { method: 'POST', body }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.activity }),
  })
}

export function useBookTestDrive() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: ContactPayload & { demo_car_id: number; starts_at: string }) =>
      api<LeadCreated>('/test-drives', { method: 'POST', body }),
    onSettled: (_data, _error, body) => {
      client.invalidateQueries({ queryKey: ['slots', body.demo_car_id] })
      client.invalidateQueries({ queryKey: keys.activity })
    },
  })
}

export const useMe = () =>
  useQuery({ queryKey: keys.me, queryFn: () => api<User | null>('/auth/me'), staleTime: LONG })
