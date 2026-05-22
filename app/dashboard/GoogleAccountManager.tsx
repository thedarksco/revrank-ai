'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

interface GoogleAccount {
  id: string
  google_account_id: string
  email: string
  name: string
  picture_url?: string
  account_type: string
  hosted_domain?: string
  is_manager: boolean
  managed_accounts: string[]
  is_active: boolean
  last_connected: string
  created_at: string
}

interface ManagerRelationship {
  id: string
  manager_account_name: string
  manager_account_id: string
  account_role: string
  location_account_name: string
  location_account_id: string
  location_place_id?: string
  is_active: boolean
  last_synced: string
}

interface BusinessLocation {
  google_account_email: string
  google_account_id: string
  account_name: string
  account_number: string
  location_name: string
  store_code?: string
  address: any
  phone?: string
  category?: string
  website?: string
  place_id?: string
  maps_url?: string
  status?: string
  verified: boolean
}

export default function GoogleAccountManager() {
  const [accounts, setAccounts] = useState<GoogleAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<GoogleAccount | null>(null)
  const [managerRelationships, setManagerRelationships] = useState<ManagerRelationship[]>([])
  const [businessLocations, setBusinessLocations] = useState<BusinessLocation[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [loadingLocations, setLoadingLocations] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    fetchAccounts()
    // Automatically fetch business locations on component mount
    fetchBusinessLocations()

    // Check for error messages from redirect
    const errorParam = searchParams.get('error')
    const errorDetailsParam = searchParams.get('errorDetails')
    const successParam = searchParams.get('success')
    const debugParam = searchParams.get('debug')
    const debugDataParam = searchParams.get('debugData')

    if (errorParam === 'tables_not_found') {
      setError('Database tables not found. Please run the migration script in Supabase SQL Editor.')
    } else if (errorParam === 'save_failed') {
      let errorMessage = 'Failed to save Google account information.'

      if (errorDetailsParam) {
        try {
          const errorDetails = JSON.parse(decodeURIComponent(errorDetailsParam))
          errorMessage += `\n\nError Details:\n- Message: ${errorDetails.message}\n- Code: ${errorDetails.code}`
          if (errorDetails.details) {
            errorMessage += `\n- Details: ${errorDetails.details}`
          }
          if (errorDetails.hint) {
            errorMessage += `\n- Hint: ${errorDetails.hint}`
          }
        } catch (e) {
          errorMessage += `\n\nRaw error: ${errorDetailsParam}`
        }
      }

      setError(errorMessage)
    } else if (errorParam === 'user_not_found') {
      setError('User profile not found in database. Please refresh and try again.')
    } else if (errorParam === 'duplicate_account') {
      setError('This Google account is already connected.')
    } else if (errorParam === 'unexpected_error') {
      setError('An unexpected error occurred. Please try again.')
    }

    if (successParam === 'account_connected' || successParam === 'connected') {
      // Refresh accounts list after successful connection
      fetchAccounts()
      // Automatically fetch business locations after successful connection
      setTimeout(() => fetchBusinessLocations(), 1500)
    }

    if (debugParam === 'true' && debugDataParam) {
      try {
        const debugData = JSON.parse(decodeURIComponent(debugDataParam))
        setError(`DEBUG MODE - Google Account Data:\n\n${JSON.stringify(debugData, null, 2)}`)
      } catch (e) {
        setError(`DEBUG MODE - Raw data: ${debugDataParam}`)
      }
    }
  }, [searchParams])

  const fetchAccounts = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/google/accounts')
      if (response.ok) {
        const data = await response.json()
        setAccounts(data.accounts || [])
      }
    } catch (error) {
      console.error('Error fetching Google accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchManagerRelationships = async (accountId: string) => {
    setSyncing(accountId)
    try {
      const response = await fetch(`/api/google/managers?googleAccountId=${accountId}`)
      if (response.ok) {
        const data = await response.json()
        setManagerRelationships(data.managerRelationships || [])
      }
    } catch (error) {
      console.error('Error fetching manager relationships:', error)
    } finally {
      setSyncing(null)
    }
  }

  const fetchBusinessLocations = async () => {
    setLoadingLocations(true)
    setBusinessLocations([])
    try {
      const response = await fetch('/api/gbp/simple')
      if (response.ok) {
        const data = await response.json()
        if (data.locations && data.locations.length > 0) {
          setBusinessLocations(data.locations)
        }
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoadingLocations(false)
    }
  }

  const handleAccountSelect = async (account: GoogleAccount) => {
    setSelectedAccount(account)
    if (account.is_manager) {
      await fetchManagerRelationships(account.id)
    }
    // Always fetch business locations when an account is selected
    await fetchBusinessLocations()
  }

  const connectNewAccount = (debug = false) => {
    // Redirect to OAuth flow for adding a new Google account (no client required)
    const debugParam = debug ? '&debug=true' : ''
    window.location.href = `/api/gbp/auth?accountSelection=true${debugParam}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center space-x-3 p-4 bg-gray-100 rounded-lg">
              <div className="w-12 h-12 bg-gray-300 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-300 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <div className="text-sm text-red-700">
                {error.split('\n').map((line, index) => (
                  <div key={index} className={index === 0 ? 'font-medium' : 'mt-1 font-mono text-xs'}>
                    {line}
                  </div>
                ))}
              </div>
              {error.includes('migration script') && (
                <p className="mt-2 text-sm text-red-600">
                  Go to your Supabase dashboard → SQL Editor → Run the migration from{' '}
                  <code className="bg-red-100 px-1 py-0.5 rounded">003_multi_account_support.sql</code>
                </p>
              )}
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setError(null)}
                className="inline-flex text-red-400 hover:text-red-500"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Google Accounts</h3>
          <div className="space-x-2">
            <button
              onClick={async () => {
                const res = await fetch('/api/gbp/diagnostic')
                const data = await res.json()
                console.log('Diagnostic:', data)
                alert(`Check console for diagnostic data. Accounts: ${data.database?.google_accounts?.count || 0}, Tokens: ${data.database?.google_tokens?.count || 0}`)
              }}
              className="inline-flex items-center px-3 py-2 border border-purple-300 text-sm leading-4 font-medium rounded-md text-purple-700 bg-white hover:bg-purple-50"
            >
              🔍 Diagnostic
            </button>
            <button
              onClick={async () => {
                const res = await fetch('/api/gbp/test-token')
                const data = await res.json()
                console.log('Token Test:', data)
                alert(`Token test: ${data.gmb_test?.ok ? 'SUCCESS' : 'FAILED'} - Check console`)
              }}
              className="inline-flex items-center px-3 py-2 border border-blue-300 text-sm leading-4 font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50"
            >
              🔑 Test Token
            </button>
            <button
              onClick={async () => {
                const res = await fetch('/api/gbp/fix-now')
                const data = await res.json()
                console.log('FIX NOW Result:', data)
                alert(`Found ${data.total_locations || 0} locations from ${data.accounts_checked?.length || 0} accounts - Check console for full details`)
                if (data.total_locations > 0) {
                  fetchBusinessLocations()
                }
              }}
              className="inline-flex items-center px-3 py-2 border border-red-600 text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
            >
              🚨 FIX NOW
            </button>
            <button
              onClick={async () => {
                const res = await fetch('/api/gbp/fetch-all')
                const data = await res.json()
                console.log('Fetch All:', data)
                alert(`Fetched from ${data.accounts_checked || 0} accounts - Check console`)
              }}
              className="inline-flex items-center px-3 py-2 border border-green-300 text-sm leading-4 font-medium rounded-md text-green-700 bg-white hover:bg-green-50"
            >
              📍 Fetch All
            </button>
            <button
              onClick={fetchBusinessLocations}
              disabled={loadingLocations}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {loadingLocations ? 'Loading...' : 'Refresh Locations'}
            </button>
            <button
              onClick={() => connectNewAccount(false)}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Account
            </button>
            <button
              onClick={async () => {
                if (confirm('Delete all test accounts?')) {
                  const response = await fetch('/api/cleanup-test-accounts', {
                    method: 'DELETE'
                  })
                  const data = await response.json()
                  alert(`Deleted ${data.deleted_count} test accounts`)
                  fetchAccounts()
                }
              }}
              className="inline-flex items-center px-3 py-2 border border-red-300 text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clean Test Accounts
            </button>
            <a
              href="/reset-google-accounts"
              className="inline-flex items-center px-3 py-2 border border-orange-300 text-sm leading-4 font-medium rounded-md text-orange-700 bg-white hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset OAuth
            </a>
          </div>
        </div>
      </div>

      {/* Business Locations Section */}
      {businessLocations.length > 0 && (
        <div className="px-6 pb-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Google Business Profiles</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {businessLocations.map((location, idx) => (
              <div key={idx} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <h5 className="font-medium text-gray-900 text-sm">
                    {location.location_name}
                  </h5>
                  {location.verified && (
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>

                {location.address && (
                  <p className="text-xs text-gray-600 mb-1">
                    {location.address.addressLines?.join(', ')}
                    {location.address.locality && `, ${location.address.locality}`}
                    {location.address.administrativeArea && `, ${location.address.administrativeArea}`}
                    {location.address.postalCode && ` ${location.address.postalCode}`}
                  </p>
                )}

                {location.phone && (
                  <p className="text-xs text-gray-600 mb-1">📞 {location.phone}</p>
                )}

                {location.category && (
                  <p className="text-xs text-gray-500 mb-2">{location.category}</p>
                )}

                <div className="flex items-center justify-between mt-2 pt-2 border-t">
                  <span className="text-xs text-gray-500">
                    via {location.google_account_email}
                  </span>
                  {location.maps_url && (
                    <a
                      href={location.maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      View on Maps →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading Business Locations */}
      {loadingLocations && (
        <div className="px-6 pb-4">
          <div className="flex items-center justify-center py-8">
            <svg className="animate-spin h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="ml-3 text-gray-600">Loading Google Business Profiles...</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
        {/* Accounts List */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">Connected Accounts</h4>
          {accounts.length === 0 ? (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No accounts connected</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by connecting your Google account.</p>
              <div className="mt-6">
                <button
                  onClick={() => connectNewAccount(false)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Connect Google Account
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => handleAccountSelect(account)}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg border text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    selectedAccount?.id === account.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200'
                  }`}
                >
                  <img
                    src={account.picture_url || '/default-avatar.png'}
                    alt={account.name}
                    className="w-10 h-10 rounded-full"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {account.name}
                      </p>
                      {account.is_manager && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          Manager
                        </span>
                      )}
                      {account.account_type === 'gsuite' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          G Suite
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">{account.email}</p>
                    <p className="text-xs text-gray-400">
                      Last connected: {formatDate(account.last_connected)}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Manager Details */}
        <div>
          {selectedAccount ? (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-900">
                  Account Details
                </h4>
                {selectedAccount.is_manager && (
                  <button
                    onClick={() => fetchManagerRelationships(selectedAccount.id)}
                    disabled={syncing === selectedAccount.id}
                    className="inline-flex items-center px-2 py-1 border border-gray-300 rounded text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    {syncing === selectedAccount.id ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-gray-700" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Syncing...
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Sync
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-4">
                  <img
                    src={selectedAccount.picture_url || '/default-avatar.png'}
                    alt={selectedAccount.name}
                    className="w-12 h-12 rounded-full"
                  />
                  <div>
                    <h5 className="text-sm font-medium text-gray-900">
                      {selectedAccount.name}
                    </h5>
                    <p className="text-sm text-gray-500">{selectedAccount.email}</p>
                  </div>
                </div>

                <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 text-sm">
                  <div>
                    <dt className="font-medium text-gray-500">Account Type</dt>
                    <dd className="text-gray-900 capitalize">{selectedAccount.account_type}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-gray-500">Manager Status</dt>
                    <dd className="text-gray-900">
                      {selectedAccount.is_manager ? 'Manager Account' : 'Standard Account'}
                    </dd>
                  </div>
                  {selectedAccount.hosted_domain && (
                    <div>
                      <dt className="font-medium text-gray-500">Domain</dt>
                      <dd className="text-gray-900">{selectedAccount.hosted_domain}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="font-medium text-gray-500">Connected</dt>
                    <dd className="text-gray-900">{formatDate(selectedAccount.created_at)}</dd>
                  </div>
                </dl>

                {selectedAccount.is_manager && managerRelationships.length > 0 && (
                  <div className="mt-4">
                    <h6 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                      Managed Locations ({managerRelationships.length})
                    </h6>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {managerRelationships.map((relationship) => (
                        <div
                          key={relationship.id}
                          className="flex items-center justify-between p-2 bg-white rounded border"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900 truncate">
                              {relationship.location_account_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              Role: {relationship.account_role}
                            </p>
                          </div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            relationship.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {relationship.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
              <div className="text-center">
                <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <p className="mt-2 text-sm text-gray-500">
                  Select an account to view details
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}