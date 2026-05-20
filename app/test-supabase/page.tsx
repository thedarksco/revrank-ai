'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function TestSupabase() {
  const [status, setStatus] = useState<string>('Checking connection...')
  const [details, setDetails] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function checkConnection() {
      try {
        const supabase = createClient()

        // Test 1: Check if we can connect
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          throw sessionError
        }

        // Test 2: Try a simple query (this will fail if tables don't exist yet, which is ok)
        const { data, error: queryError } = await supabase
          .from('profiles')
          .select('count')
          .limit(1)

        setStatus('✅ Supabase connection successful!')
        setDetails({
          connected: true,
          hasSession: !!session,
          user: session?.user?.email || 'Not logged in',
          tablesCreated: !queryError || !queryError.message.includes('relation'),
          queryError: queryError?.message
        })
      } catch (err: any) {
        setStatus('❌ Connection failed')
        setError(err.message || 'Unknown error')
        setDetails({
          connected: false,
          error: err.message
        })
      }
    }

    checkConnection()
  }, [])

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Supabase Connection Test</h1>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
          <p className="text-lg mb-4">{status}</p>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <p className="text-red-800">Error: {error}</p>
            </div>
          )}

          {details && (
            <div className="bg-gray-50 rounded-md p-4">
              <h3 className="font-semibold mb-2">Details:</h3>
              <ul className="space-y-2">
                <li>Connected: {details.connected ? '✅ Yes' : '❌ No'}</li>
                {details.connected && (
                  <>
                    <li>User Session: {details.hasSession ? '✅ Active' : '⚠️ Not logged in'}</li>
                    <li>Current User: {details.user}</li>
                    <li>Database Tables: {details.tablesCreated ? '✅ Created' : '⚠️ Not created yet'}</li>
                    {details.queryError && (
                      <li className="text-amber-600">Query Note: {details.queryError}</li>
                    )}
                  </>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <h3 className="font-semibold mb-2">📋 Setup Checklist:</h3>
          <ol className="list-decimal list-inside space-y-2 ml-4">
            <li>Create Supabase project at supabase.com</li>
            <li>Copy your project URL, anon key, and service role key</li>
            <li>Add them to your .env.local file</li>
            <li>Run the database schema SQL in Supabase SQL Editor</li>
            <li>Enable Google OAuth in Supabase Authentication settings</li>
            <li>Restart your Next.js dev server after adding env vars</li>
          </ol>
        </div>

        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <h3 className="font-semibold mb-2">⚠️ Important:</h3>
          <p>If you see "Connection failed", make sure you've:</p>
          <ul className="list-disc list-inside ml-4 mt-2">
            <li>Added your Supabase credentials to .env.local</li>
            <li>Restarted your development server (npm run dev)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}