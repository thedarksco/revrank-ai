'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface GoogleAccount {
  id: string
  email: string
  name: string
  picture_url?: string
  is_manager: boolean
  account_type: string
  last_connected: string
}

interface GBPConnectionButtonProps {
  client: {
    id: string
    gbp_connected: boolean
    gbp_connection_date?: string
  }
}

export default function GBPConnectionButton({ client }: GBPConnectionButtonProps) {
  const [loading, setLoading] = useState(false)
  const [showAccountSelector, setShowAccountSelector] = useState(false)
  const [availableAccounts, setAvailableAccounts] = useState<GoogleAccount[]>([])
  const [currentAccount, setCurrentAccount] = useState<GoogleAccount | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetchAccountInfo()
  }, [client.id])

  const fetchAccountInfo = async () => {
    try {
      const response = await fetch(`/api/gbp/select-account?clientId=${client.id}`)
      if (response.ok) {
        const data = await response.json()
        setAvailableAccounts(data.availableAccounts || [])
        setCurrentAccount(data.client.currentGoogleAccount)
      }
    } catch (error) {
      console.error('Error fetching account info:', error)
    }
  }

  const handleConnect = async () => {
    if (availableAccounts.length === 0) {
      // No accounts available, redirect to OAuth with account selection
      setLoading(true)
      window.location.href = `/api/gbp/auth?clientId=${client.id}&accountSelection=true`
    } else {
      // Show account selector
      setShowAccountSelector(true)
    }
  }

  const handleAccountSelect = async (account: GoogleAccount) => {
    setLoading(true)
    try {
      const response = await fetch('/api/gbp/select-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: client.id,
          googleAccountId: account.id
        }),
      })

      if (response.ok) {
        router.refresh()
        setShowAccountSelector(false)
      } else {
        alert('Failed to select account')
      }
    } catch (error) {
      console.error('Error selecting account:', error)
      alert('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleNewAccount = () => {
    setLoading(true)
    window.location.href = `/api/gbp/auth?clientId=${client.id}&accountSelection=true`
  }

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect this Google Business Profile?')) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/gbp/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clientId: client.id }),
      })

      if (response.ok) {
        router.refresh()
      } else {
        alert('Failed to disconnect GBP')
      }
    } catch (error) {
      console.error('Error disconnecting GBP:', error)
      alert('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (client.gbp_connected) {
    return (
      <div className="flex items-center space-x-4">
        {currentAccount && (
          <div className="flex items-center space-x-2">
            <img
              src={currentAccount.picture_url || '/default-avatar.png'}
              alt={currentAccount.name}
              className="w-6 h-6 rounded-full"
            />
            <span className="text-sm text-gray-600">{currentAccount.email}</span>
            {currentAccount.is_manager && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                Manager
              </span>
            )}
          </div>
        )}
        <button
          onClick={() => setShowAccountSelector(true)}
          className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Switch Account
        </button>
        <button
          onClick={handleDisconnect}
          disabled={loading}
          className="inline-flex items-center px-3 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-red-700" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Disconnecting...
            </>
          ) : (
            'Disconnect'
          )}
        </button>
        <Link
          href={`/clients/${client.id}/gbp`}
          className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          Manage GBP
        </Link>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={handleConnect}
        disabled={loading}
        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
      >
        {loading ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Connecting...
          </>
        ) : (
          <>
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Connect Google Business Profile
          </>
        )}
      </button>

      {/* Account Selector Modal */}
      {showAccountSelector && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Select Google Account
              </h3>
              <div className="space-y-3">
                {availableAccounts.map((account) => (
                  <button
                    key={account.id}
                    onClick={() => handleAccountSelect(account)}
                    disabled={loading}
                    className="w-full flex items-center space-x-3 p-3 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    <img
                      src={account.picture_url || '/default-avatar.png'}
                      alt={account.name}
                      className="w-8 h-8 rounded-full"
                    />
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium text-gray-900">
                        {account.name}
                      </div>
                      <div className="text-sm text-gray-500">{account.email}</div>
                    </div>
                    {account.is_manager && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        Manager
                      </span>
                    )}
                  </button>
                ))}
                <button
                  onClick={handleNewAccount}
                  disabled={loading}
                  className="w-full flex items-center justify-center space-x-2 p-3 border border-dashed border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="text-sm text-gray-600">Add New Account</span>
                </button>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setShowAccountSelector(false)}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}