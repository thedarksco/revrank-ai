'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import BusinessProfileCard from '@/components/business-profiles/BusinessProfileCard'
import BusinessProfileFilters from '@/components/business-profiles/BusinessProfileFilters'
import { BusinessLocation, GoogleAccount, SortOption, ViewMode } from '@/types/business-profiles'

interface Props {
  initialLocations: BusinessLocation[]
  googleAccounts: GoogleAccount[]
}

export default function BusinessProfilesClient({ initialLocations, googleAccounts }: Props) {
  const [locations, setLocations] = useState<BusinessLocation[]>(initialLocations)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAccount, setSelectedAccount] = useState<string>('all')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortBy, setSortBy] = useState<SortOption>('name')

  // Extract unique tags from all locations
  const allTags = useMemo(() => {
    const tags = new Set<string>()
    locations.forEach(location => {
      location.tags?.forEach(tag => tags.add(tag))
    })
    return Array.from(tags)
  }, [locations])

  // Filter and sort locations
  const filteredLocations = useMemo(() => {
    let filtered = locations

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(location =>
        location.location_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        location.formatted_address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        location.primary_category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        location.phone?.includes(searchQuery)
      )
    }

    // Filter by Google account
    if (selectedAccount !== 'all') {
      filtered = filtered.filter(location => location.google_account_id === selectedAccount)
    }

    // Filter by tags
    if (selectedTags.length > 0) {
      filtered = filtered.filter(location =>
        selectedTags.every(tag => location.tags?.includes(tag))
      )
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.location_name.localeCompare(b.location_name)
        case 'rating':
          return (b.average_rating || 0) - (a.average_rating || 0)
        case 'reviews':
          return b.total_reviews - a.total_reviews
        case 'optimization':
          return (b.optimization_score || 0) - (a.optimization_score || 0)
        default:
          return 0
      }
    })

    return filtered
  }, [locations, searchQuery, selectedAccount, selectedTags, sortBy])

  // Calculate statistics
  const stats = useMemo(() => {
    const active = locations.filter(l => l.status === 'OPEN' || !l.status).length
    const verified = locations.filter(l => l.verified).length
    const avgOptimization = locations.reduce((sum, l) => sum + (l.optimization_score || 0), 0) / (locations.length || 1)
    const totalReviews = locations.reduce((sum, l) => sum + l.total_reviews, 0)

    return { active, verified, avgOptimization, totalReviews }
  }, [locations])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/gbp/fetch-locations')
      if (response.ok) {
        const data = await response.json()
        if (data.locations) {
          // Reload locations from database
          const locResponse = await fetch('/api/gbp/locations')
          if (locResponse.ok) {
            const locData = await locResponse.json()
            setLocations(locData.locations || [])
          }
        }
      }
    } catch (error) {
      console.error('Error syncing locations:', error)
    } finally {
      setSyncing(false)
    }
  }

  const handleBulkAction = async (action: string, locationIds: string[]) => {
    // Implement bulk actions (add tags, export, etc.)
    console.log('Bulk action:', action, locationIds)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Business Profiles</h1>
              <p className="mt-1 text-sm text-gray-600">
                Manage and optimize your Google Business Profiles
              </p>
            </div>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {syncing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Syncing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Business Profile
                </>
              )}
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">All active</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {stats.active} <span className="text-sm text-gray-500">/ {locations.length}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100">
                <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Pinned</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.verified}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-yellow-100">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Optimization</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {Math.round(stats.avgOptimization || 0)} <span className="text-sm text-gray-500">/ 15</span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Inactive</p>
                <p className="text-2xl font-semibold text-gray-900">{locations.length - stats.active}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <BusinessProfileFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedAccount={selectedAccount}
          onAccountChange={setSelectedAccount}
          googleAccounts={googleAccounts}
          selectedTags={selectedTags}
          onTagsChange={setSelectedTags}
          availableTags={allTags}
          sortBy={sortBy}
          onSortChange={setSortBy}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* Profiles Grid/List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="animate-spin h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : filteredLocations.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No business profiles found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchQuery || selectedTags.length > 0
                ? 'Try adjusting your filters'
                : 'Connect a Google account to get started'}
            </p>
            {locations.length === 0 && (
              <div className="mt-6">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Connect Google Account
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className={viewMode === 'grid' ?
            'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' :
            'space-y-4'
          }>
            {filteredLocations.map((location) => (
              <BusinessProfileCard
                key={location.id}
                location={location}
                viewMode={viewMode}
                onUpdate={(updatedLocation) => {
                  setLocations(prev => prev.map(l => l.id === updatedLocation.id ? updatedLocation : l))
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}