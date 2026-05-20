import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Welcome to RevRank.ai Dashboard</h1>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <p className="text-sm text-blue-800">
                <strong>Signed in as:</strong> {user.email}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Clients</h3>
                <p className="text-3xl font-bold text-blue-600">0</p>
                <p className="text-sm text-gray-500 mt-1">Active clients</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Posts</h3>
                <p className="text-3xl font-bold text-green-600">0</p>
                <p className="text-sm text-gray-500 mt-1">This month</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Reviews</h3>
                <p className="text-3xl font-bold text-purple-600">0</p>
                <p className="text-sm text-gray-500 mt-1">Pending responses</p>
              </div>
            </div>

            <div className="mt-8">
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}