'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BusinessLocation, ViewMode } from '@/types/business-profiles'

interface Props {
  location: BusinessLocation
  viewMode: ViewMode
  onUpdate?: (location: BusinessLocation) => void
}

export default function BusinessProfileCard({ location, viewMode, onUpdate }: Props) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showActions, setShowActions] = useState(false)

  // Calculate optimization percentage (assuming max score is 100)
  const optimizationPercentage = ((location.optimization_score || 0) / 100) * 100

  // Get top ranking keywords
  const topKeywords = location.ranking_keywords?.slice(0, 5) || []

  const handleAddTag = async () => {
    // Implement tag addition
  }

  const handleManage = () => {
    // Open in Google My Business
    window.open(`https://business.google.com/locations`, '_blank')
  }

  if (viewMode === 'list') {
    return (
      <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center mb-2">
              <h3 className="text-lg font-semibold text-gray-900">{location.location_name}</h3>
              {location.verified && (
                <svg className="ml-2 w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-1">{location.formatted_address}</p>
            {location.phone && <p className="text-sm text-gray-600 mb-1">📞 {location.phone}</p>}
            {location.primary_category && (
              <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                {location.primary_category}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-8 ml-6">
            {/* Reviews */}
            <div className="text-center">
              <p className="text-sm text-gray-500">Reviews</p>
              <p className="text-xl font-semibold text-gray-900">{location.total_reviews}</p>
              {location.average_rating && (
                <p className="text-sm text-yellow-600">⭐ {location.average_rating}</p>
              )}
            </div>

            {/* Optimization Score */}
            <div className="text-center">
              <p className="text-sm text-gray-500">Optimization</p>
              <div className="mt-1">
                <span className={`text-xl font-semibold ${
                  optimizationPercentage >= 70 ? 'text-green-600' :
                  optimizationPercentage >= 40 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {location.optimization_score || 0}
                </span>
                <span className="text-sm text-gray-500"> / 100</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-2">
              <button
                onClick={handleManage}
                className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                Manage
              </button>
              {location.maps_url && (
                <a
                  href={location.maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  View on Maps
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden">
      {/* Header with optimization bar */}
      <div className="relative h-2 bg-gray-200">
        <div
          className={`absolute top-0 left-0 h-full transition-all ${
            optimizationPercentage >= 70 ? 'bg-green-500' :
            optimizationPercentage >= 40 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${optimizationPercentage}%` }}
        />
      </div>

      <div className="p-6">
        {/* Business Info */}
        <div className="mb-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              {location.location_name}
              {location.verified && (
                <svg className="ml-2 w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </h3>
            <button
              onClick={() => setShowActions(!showActions)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
              </svg>
            </button>
          </div>

          {showActions && (
            <div className="absolute right-6 mt-1 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
              <div className="py-1">
                <button
                  onClick={handleAddTag}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Add Tag
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(location.location_name)}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Copy Name
                </button>
                {location.website && (
                  <a
                    href={location.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Visit Website
                  </a>
                )}
              </div>
            </div>
          )}

          <p className="text-sm text-gray-600">{location.formatted_address}</p>
          {location.phone && <p className="text-sm text-gray-600">📞 {location.phone}</p>}
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-2 bg-gray-50 rounded">
            <p className="text-xs text-gray-500">All active</p>
            <p className="text-lg font-semibold text-gray-900">
              {location.optimization_score || 0} <span className="text-xs text-gray-500">/90</span>
            </p>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded">
            <p className="text-xs text-gray-500">Optimization</p>
            <p className="text-lg font-semibold text-gray-900">
              {location.optimization_score || 0} <span className="text-xs text-gray-500">/15</span>
            </p>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded">
            <p className="text-xs text-gray-500">Reviews</p>
            <p className="text-lg font-semibold text-gray-900">{location.total_reviews}</p>
            {location.average_rating && (
              <p className="text-xs text-yellow-600">⭐ {location.average_rating}</p>
            )}
          </div>
        </div>

        {/* Keywords Section */}
        {topKeywords.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-700 mb-2">Keywords</p>
            <div className="space-y-1">
              {topKeywords.map((kw: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 truncate">{kw.keyword}</span>
                  <span className={`font-medium ${
                    kw.position <= 3 ? 'text-green-600' :
                    kw.position <= 10 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    Rank {kw.position}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {location.tags && location.tags.length > 0 && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-1">
              {location.tags.map((tag, idx) => (
                <span key={idx} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleManage}
            className="flex-1 px-3 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
          >
            Manage
          </button>
          {location.maps_url && (
            <a
              href={location.maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              Maps
            </a>
          )}
        </div>
      </div>
    </div>
  )
}