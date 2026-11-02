export class ApiError extends Error {
  status: number
  fields: Record<string, string>

  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message)
    this.status = status
    this.fields = fields
  }
}

type FastApiDetail = string | { loc: (string | number)[]; msg: string }[]

function cleanMessage(msg: string) {
  return msg.replace(/^Value error, /, '').replace(/^Input should be True$/, 'Please tick this box')
}

function toApiError(status: number, detail: FastApiDetail | undefined): ApiError {
  if (Array.isArray(detail)) {
    const fields: Record<string, string> = {}
    for (const { loc, msg } of detail) fields[String(loc.at(-1))] ??= cleanMessage(msg)
    return new ApiError(status, 'Please check the highlighted fields', fields)
  }
  if (detail) return new ApiError(status, detail)
  if (status >= 500) return new ApiError(status, 'Something went wrong on our side. Please try again.')
  return new ApiError(status, 'Request failed')
}

const BASE = import.meta.env.VITE_API_URL ?? '/api'

export async function api<T>(
  path: string,
  { method = 'GET', body, signal }: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const isForm = body instanceof FormData
  let response: Response
  try {
    response = await fetch(BASE + path, {
      method,
      signal,
      credentials: 'include',
      headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
      body: isForm ? body : body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.")
  }
  if (response.status === 204) return undefined as T
  const data = await response.json().catch(() => undefined)
  if (!response.ok) throw toApiError(response.status, data?.detail)
  return data as T
}

export function query(params: Record<string, string | number | boolean | string[] | undefined | null>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) value.forEach((v) => search.append(key, v))
    else search.set(key, String(value))
  }
  const s = search.toString()
  return s ? `?${s}` : ''
}
