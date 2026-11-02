import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import { keys } from './queries'
import type { User } from './types'

export const homeFor = (user: User) =>
  user.role === 'admin' ? '/admin' : user.role === 'consultant' ? '/staff' : '/account'

export function useLogin() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      api<User>('/auth/login', { method: 'POST', body }),
    onSuccess: (user) => {
      client.clear()
      client.setQueryData(keys.me, user)
    },
  })
}

export function useRegister() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; email: string; phone: string; password: string }) =>
      api<User>('/auth/register', { method: 'POST', body }),
    onSuccess: (user) => client.setQueryData(keys.me, user),
  })
}

export function useLogout() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      client.clear()
      client.setQueryData(keys.me, null)
    },
  })
}
