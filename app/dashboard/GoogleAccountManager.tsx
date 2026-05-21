'use client'

import { useState, useEffect } from 'react'

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

export default function GoogleAccountManager() {
  const [accounts, setAccounts] = useState<GoogleAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<GoogleAccount | null>(null)
  const [managerRelationships, setManagerRelationships] = useState<ManagerRelationship[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState<string | null>(null)

  useEffect(() => {
    fetchAccounts()
  }, [])

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

  const handleAccountSelect = async (account: GoogleAccount) => {
    setSelectedAccount(account)
    if (account.is_manager) {
      await fetchManagerRelationships(account.id)
    }
  }

  const connectNewAccount = () => {
    // Redirect to OAuth flow for adding a new Google account (no client required)
    window.location.href = '/api/gbp/auth?accountSelection=true'
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
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Google Accounts</h3>
          <button
            onClick={connectNewAccount}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Account
          </button>
        </div>
      </div>

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
                  onClick={connectNewAccount}
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