import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, query } from './api'
import type { City, Fuel, Page, Role, StockStatus, Transmission } from './types'

export interface PriceCell {
  variant_id: number
  city_id: number
  ex_showroom: number
  valid_until: string
}

export interface PriceGrid {
  cities: City[]
  variants: { id: number; name: string; fuel: Fuel; transmission: Transmission; is_active: boolean; prices: Record<string, PriceCell> }[]
}

export interface Slab {
  fuel: Fuel
  min_price: number
  max_price: number | null
  rate: string
}

export interface AdminCity extends City {
  registration_fee: number
  fastag_fee: number
  insurance_rate: string
  tax_slabs: Slab[]
}

export interface AdminModelRow {
  id: number
  slug: string
  name: string
  body_type: string
  is_published: boolean
  variant_count: number
  priced_cells: number
}

export interface AdminVariant {
  id: number
  name: string
  fuel: Fuel
  transmission: Transmission
  specs: Record<string, string>
  sort_order: number
  is_active: boolean
}

export interface AdminModel {
  id: number
  slug: string
  name: string
  body_type: string
  tagline: string
  description: string
  images: string[]
  highlights: string[]
  is_published: boolean
  sort_order: number
  colours: { name: string; hex: string }[]
  accessory_packs: { id?: number; name: string; items: string[]; price: number }[]
  variants: AdminVariant[]
}

export type ModelInput = Omit<AdminModel, 'id' | 'variants'>
export type VariantInput = Omit<AdminVariant, 'id'>

export interface AdminUsedCar {
  id: number
  slug: string
  stock_id: string
  make: string
  model: string
  variant: string
  fuel: Fuel
  transmission: Transmission
  year: number
  km: number
  owners: number
  colour: string
  price: number
  status: StockStatus
  registration_no: string
  showroom_id: number
  images: string[]
  inspection: { score?: number; checked_on?: string; [key: string]: unknown }
  description: string
  is_published: boolean
}

export type UsedCarInput = Omit<AdminUsedCar, 'id' | 'slug' | 'inspection'> & {
  inspection: { score: number; checked_on: string; items: unknown[] } | null
}

export interface StaffAccount {
  id: number
  name: string
  email: string
  phone: string | null
  role: Role
  showroom_id: number | null
  is_active: boolean
  model_ids: number[]
}

const invalidate = (client: ReturnType<typeof useQueryClient>, ...keys: string[]) =>
  Promise.all(keys.map((key) => client.invalidateQueries({ queryKey: [key] })))

export const useAdminModels = () =>
  useQuery({ queryKey: ['admin-models'], queryFn: () => api<AdminModelRow[]>('/admin/models') })

export const useAdminModel = (id: number | undefined) =>
  useQuery({ queryKey: ['admin-model', id], queryFn: () => api<AdminModel>(`/admin/models/${id}`), enabled: !!id })

export const usePriceGrid = (modelId: number | undefined) =>
  useQuery({
    queryKey: ['admin-prices', modelId],
    queryFn: () => api<PriceGrid>(`/admin/prices?model_id=${modelId}`),
    enabled: !!modelId,
  })

export const useAdminCities = () =>
  useQuery({ queryKey: ['admin-cities'], queryFn: () => api<AdminCity[]>('/admin/cities') })

export const useAdminUsedCars = (params: { q?: string; status?: string; page: number }) =>
  useQuery({
    queryKey: ['admin-used', params],
    queryFn: () => api<Page<AdminUsedCar>>(`/admin/used-cars${query({ ...params, page_size: 20 })}`),
    placeholderData: keepPreviousData,
  })

export const useStaffAccounts = () =>
  useQuery({ queryKey: ['admin-users'], queryFn: () => api<StaffAccount[]>('/admin/users') })

/** Public catalogue caches (models, prices, used cars) must refresh after admin edits. */
const PUBLIC = ['models', 'model', 'price', 'used', 'used-car']

export function useSavePrices() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (cells: PriceCell[]) => api<void>('/admin/prices', { method: 'PUT', body: { cells } }),
    onSuccess: () => invalidate(client, 'admin-prices', 'admin-models', ...PUBLIC),
  })
}

export function useSaveCity() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: Omit<AdminCity, 'slug' | 'name'>) =>
      api<AdminCity>(`/admin/cities/${id}`, { method: 'PUT', body }),
    onSuccess: () => invalidate(client, 'admin-cities', ...PUBLIC),
  })
}

export function useSaveModel() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: ModelInput }) =>
      api<AdminModel>(id ? `/admin/models/${id}` : '/admin/models', { method: id ? 'PUT' : 'POST', body }),
    onSuccess: (model) => {
      client.setQueryData(['admin-model', model.id], model)
      return invalidate(client, 'admin-models', ...PUBLIC)
    },
  })
}

export function useSaveVariant(modelId: number) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: VariantInput }) =>
      api<AdminModel>(id ? `/admin/variants/${id}` : `/admin/models/${modelId}/variants`, {
        method: id ? 'PUT' : 'POST',
        body,
      }),
    onSuccess: (model) => {
      client.setQueryData(['admin-model', model.id], model)
      return invalidate(client, 'admin-models', 'admin-prices', ...PUBLIC)
    },
  })
}

export function useSaveUsedCar() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: UsedCarInput }) =>
      api<AdminUsedCar>(id ? `/admin/used-cars/${id}` : '/admin/used-cars', { method: id ? 'PUT' : 'POST', body }),
    onSuccess: () => invalidate(client, 'admin-used', ...PUBLIC),
  })
}

export function useCreateUser() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: Omit<StaffAccount, 'id' | 'is_active'> & { password: string }) =>
      api<StaffAccount>('/admin/users', { method: 'POST', body }),
    onSuccess: () => invalidate(client, 'admin-users'),
  })
}

export function useUpdateUser() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<StaffAccount> & { id: number }) =>
      api<StaffAccount>(`/admin/users/${id}`, { method: 'PATCH', body }),
    onSuccess: () => invalidate(client, 'admin-users'),
  })
}
