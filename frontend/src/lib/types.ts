export type Fuel = 'petrol' | 'diesel' | 'cng' | 'hybrid' | 'electric'
export type Transmission = 'manual' | 'automatic'
export type Role = 'buyer' | 'consultant' | 'admin'
export type StockStatus = 'available' | 'booked' | 'sold'
export type LeadKind = 'enquiry' | 'test_drive' | 'used_car' | 'trade_in'
export type LeadSource = 'website' | 'portal' | 'social' | 'walk_in'
export type LeadStatus = 'new' | 'contacted' | 'test_drive' | 'negotiation' | 'won' | 'lost'

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface Ref {
  id: number
  name: string
}

export interface City {
  id: number
  slug: string
  name: string
}

export interface Showroom {
  id: number
  slug: string
  name: string
  address: string
  phone: string
  opens_at: string
  closes_at: string
  city: City
}

export interface ModelCard {
  slug: string
  name: string
  body_type: string
  tagline: string
  image: string | null
  from_price: number | null
  fuels: Fuel[]
  transmissions: Transmission[]
}

export interface Variant {
  id: number
  name: string
  fuel: Fuel
  transmission: Transmission
  specs: Record<string, string>
  ex_showroom: number | null
  valid_until: string | null
}

export interface AccessoryPack {
  id: number
  name: string
  items: string[]
  price: number
}

export interface ModelDetail {
  id: number
  slug: string
  name: string
  body_type: string
  tagline: string
  description: string
  images: string[]
  highlights: string[]
  variants: Variant[]
  colours: { name: string; hex: string }[]
  accessory_packs: AccessoryPack[]
  city: City
}

export interface PriceLine {
  key: 'ex_showroom' | 'road_tax' | 'registration' | 'insurance' | 'fastag' | 'tcs' | 'accessories'
  amount: number
  rate: string | null
  label: string | null
}

export interface PriceBreakup {
  variant_id: number
  city: City
  items: PriceLine[]
  total: number
  valid_until: string
}

export interface DemoCar {
  id: number
  colour: string
  showroom_id: number
  variant: Variant
}

export interface UsedCarCard {
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
  price: number
  status: StockStatus
  image: string | null
  location: string
}

export interface InspectionItem {
  area: string
  status: 'ok' | 'attention'
  note: string
}

export interface UsedCarDetail extends UsedCarCard {
  id: number
  colour: string
  images: string[]
  inspection: {
    score?: number
    checked_on?: string
    accident_free?: boolean
    flood_free?: boolean
    service_history?: string
    items?: InspectionItem[]
  }
  description: string
  registration: string
  showroom_id: number
}

export interface Slot {
  starts_at: string
  available: boolean
}

export interface LeadCreated {
  id: number
  consultant: string | null
  test_drive_at: string | null
}

export interface User {
  id: number
  name: string
  email: string
  phone: string | null
  role: Role
  showroom_id: number | null
  marketing_opt_out: boolean
}

export interface ActivityItem {
  lead_id: number
  kind: LeadKind
  status: LeadStatus
  subject: string | null
  created_at: string
  test_drive_at: string | null
  showroom: string | null
}

export interface LeadRow {
  id: number
  name: string
  phone: string
  kind: LeadKind
  source: LeadSource
  status: LeadStatus
  subject: string | null
  showroom: Ref | null
  assigned_to: Ref | null
  headline: string | null
  created_at: string
  first_response_at: string | null
}

export interface AiSummary {
  headline: string
  interest: string | null
  budget: string | null
  timeline: string | null
  finance: string | null
  trade_in: string | null
  preferences: string[]
  ask_next: string[]
  source: 'llm' | 'rules'
  confidence: 'high' | 'medium' | 'low'
  flags: string[]
}

export interface LeadEvent {
  id: number
  kind: 'created' | 'assigned' | 'reassigned' | 'status' | 'message' | 'ai'
  data: Record<string, unknown>
  actor: Ref | null
  created_at: string
}

export interface LeadDetail extends LeadRow {
  email: string | null
  message: string
  details: { trade_in?: Record<string, string | number>; portal?: string; model_text?: string }
  used_car_slug: string | null
  opted_out: boolean
  ai_summary: AiSummary | null
  ai_draft: string | null
  events: LeadEvent[]
  test_drives: { id: number; starts_at: string; status: string; car: string; showroom: string }[]
}

export interface InboxStats {
  open: number
  awaiting_reply: number
  overdue: number
  answered_in_sla_pct: number | null
  median_response_minutes: number | null
  sla_minutes: number
}

export interface ImportResult {
  created: number
  duplicates: number
  errors: { row: number; error: string }[]
}
