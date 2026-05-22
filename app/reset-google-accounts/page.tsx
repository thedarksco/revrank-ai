'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ResetGoogleAccountsPage() {
  const [resetting, setResetting] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  const handleReset = async () => {
    if (!confirm('This will completely disconnect ALL Google accounts. You will need to reconnect them. Continue?')) {
      return
    }

    setResetting(true)
    setMessage('')

    try {
      const response = await fetch('/api/gbp/disconnect-all', {
        method: 'DELETE',
        credentials: 'include'
      })

      const data = await response.json()

      if (response.ok) {
        setMessage('✅ All Google accounts disconnected successfully! Please go to Dashboard and reconnect your Google account.')
      } else {
        setMessage(`❌ Error: ${data.error || 'Failed to disconnect accounts'}`)
      }
    } catch (error: any) {
      setMessage(`❌ Error: ${error.message}`)
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-4">Reset Google Accounts</h1>

        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-4">
            If your Google Business Profiles aren't syncing, this will completely disconnect all Google accounts
            and force a fresh OAuth consent with updated permissions.
          </p>
          <p className="text-sm text-red-600 mb-4">
            ⚠️ Warning: This will disconnect ALL Google accounts. You'll need to reconnect them.
          </p>
        </div>

        <button
          onClick={handleReset}
          disabled={resetting}
          className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {resetting ? 'Disconnecting...' : 'Disconnect All Google Accounts'}
        </button>

        {message && (
          <div className="mt-4 p-3 rounded-lg bg-gray-100">
            <p className="text-sm">{message}</p>
          </div>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-indigo-600 hover:text-indigo-800 text-sm"
          >
            ← Back to Dashboard
          </button>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-600">
            <strong>Next steps after reset:</strong><br/>
            1. Go to Dashboard<br/>
            2. Click "Connect Google Account"<br/>
            3. Ensure you select the hello@revrank.ai account<br/>
            4. Google should prompt for Google My Business permissions<br/>
            5. Go to Business Profiles page to verify your 19 profiles appear
          </p>
        </div>
      </div>
    </div>
  )
}