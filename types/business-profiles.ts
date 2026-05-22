export interface BusinessLocation {
  id: string
  user_id: string
  google_account_id: string
  google_account_email: string
  account_name: string
  account_number: string
  location_name: string
  store_code?: string
  place_id?: string
  address: any
  formatted_address?: string
  phone?: string
  website?: string
  primary_category?: string
  additional_categories?: string[]
  maps_url?: string
  latitude?: number
  longitude?: number
  status?: string
  verified: boolean
  suspended: boolean
  disabled: boolean
  published: boolean
  total_reviews: number
  average_rating?: number
  response_rate?: number
  ranking_keywords?: any
  optimization_score?: number
  tags?: string[]
  last_synced: string
  created_at: string
  updated_at: string
}

export interface GoogleAccount {
  id: string
  google_account_id: string
  email: string
  name: string
  picture_url?: string
  is_active: boolean
}

export type SortOption = 'name' | 'rating' | 'reviews' | 'optimization'
export type ViewMode = 'grid' | 'list'