import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api, query } from './api'
import type { ImportResult, InboxStats, LeadDetail, LeadRow, LeadStatus, Page, Ref } from './types'

export interface LeadFilters {
  scope: 'mine' | 'showroom' | 'unassigned' | 'all'
  status: LeadStatus[]
  q: string
  page: number
}

const POLL = 20_000

export const STATUS_TONE = {
  new: 'accent',
  contacted: 'neutral',
  test_drive: 'dark',
  negotiation: 'warn',
  won: 'ok',
  lost: 'neutral',
} as const

export const useLeads = (filters: LeadFilters) =>
  useQuery({
    queryKey: ['staff', 'leads', filters],
    queryFn: () => api<Page<LeadRow>>(`/staff/leads${query({ ...filters, page_size: 25 })}`),
    placeholderData: keepPreviousData,
    refetchInterval: POLL,
  })

export const useInboxStats = () =>
  useQuery({
    queryKey: ['staff', 'stats'],
    queryFn: () => api<InboxStats>('/staff/leads/stats'),
    refetchInterval: POLL,
  })

export const useLead = (id: number | undefined) =>
  useQuery({
    queryKey: ['staff', 'lead', id],
    queryFn: () => api<LeadDetail>(`/staff/leads/${id}`),
    enabled: id !== undefined,
    refetchInterval: (q) => (q.state.data && !q.state.data.ai_summary ? 3_000 : false),
  })

export const useConsultants = () =>
  useQuery({
    queryKey: ['staff', 'consultants'],
    queryFn: () => api<Ref[]>('/staff/consultants'),
    staleTime: 10 * 60_000,
  })

/** Mutations on one lead. Each returns the fresh lead, which we drop straight into the cache. */
export function useLeadAction(id: number) {
  const client = useQueryClient()
  const onSuccess = (lead: LeadDetail) => {
    client.setQueryData(['staff', 'lead', id], lead)
    client.invalidateQueries({ queryKey: ['staff', 'leads'] })
    client.invalidateQueries({ queryKey: ['staff', 'stats'] })
  }
  const path = `/staff/leads/${id}`
  return {
    status: useMutation({
      mutationFn: (status: LeadStatus) => api<LeadDetail>(`${path}/status`, { method: 'PATCH', body: { status } }),
      onSuccess,
    }),
    assign: useMutation({
      mutationFn: (userId: number) => api<LeadDetail>(`${path}/assign`, { method: 'POST', body: { user_id: userId } }),
      onSuccess,
    }),
    contact: useMutation({
      mutationFn: (body: { channel: 'whatsapp' | 'sms' | 'call'; body: string }) =>
        api<LeadDetail>(`${path}/contact`, { method: 'POST', body }),
      onSuccess,
    }),
    regenerate: useMutation({
      mutationFn: () => api<LeadDetail>(`${path}/ai`, { method: 'POST' }),
      onSuccess,
    }),
  }
}

export function useImportCsv() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return api<ImportResult>('/staff/leads/import', { method: 'POST', body: form })
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['staff'] }),
  })
}

/** A clock for response timers. One interval per consumer, coarse on purpose. */
export function useNow(intervalMs = 10_000) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
