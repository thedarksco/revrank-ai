import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import GBPConnectionButton from './GBPConnectionButton'
import ClientActions from './ClientActions'

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth')
  }

  // Fetch client details
  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (error || !client) {
    redirect('/clients')
  }

  // Fetch client's keywords
  const { data: keywords } = await supabase
    .from('keywords')
    .select('*')
    .eq('client_id', params.id)
    .order('is_primary', { ascending: false })

  // Fetch recent posts
  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .eq('client_id', params.id)
    .order('created_at', { ascending: false })
    .limit(5)

  // Fetch recent reviews
  const { data: reviews } = await supabase
    .from('reviews')
    .select('*')
    .eq('client_id', params.id)
    .order('review_date', { ascending: false })
    .limit(5)

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold text-gray-900">{client.business_name}</h1>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  client.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : client.status === 'paused'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {client.status || 'active'}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                {client.business_address && `${client.business_address}, `}
                {client.city}, {client.state} {client.zip_code}
              </p>
              {client.phone && (
                <p className="mt-1 text-sm text-gray-600">
                  Phone: {client.phone}
                </p>
              )}
              {client.website && (
                <p className="mt-1 text-sm text-gray-600">
                  Website: <a href={client.website} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-500">{client.website}</a>
                </p>
              )}
            </div>
            <ClientActions client={client} />
          </div>

          {/* GBP Connection Status */}
          <div className="mt-6 border-t pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Google Business Profile</h3>
                {client.gbp_connected ? (
                  <div className="mt-1">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Connected
                    </span>
                    <p className="mt-1 text-sm text-gray-500">
                      Connected on {new Date(client.gbp_connection_date).toLocaleDateString()}
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-gray-500">
                    Connect to manage posts, reviews, and business information
                  </p>
                )}
              </div>
              <GBPConnectionButton client={client} />
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Avg Rating</dt>
                    <dd className="text-lg font-medium text-gray-900">{client.avg_rating || 'N/A'}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Reviews</dt>
                    <dd className="text-lg font-medium text-gray-900">{client.total_reviews || 0}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Posts This Month</dt>
                    <dd className="text-lg font-medium text-gray-900">{client.posts_this_month || 0}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Avg Position</dt>
                    <dd className="text-lg font-medium text-gray-900">{client.avg_position || 'N/A'}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Keywords Section */}
        {keywords && keywords.length > 0 && (
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Target Keywords</h3>
            <div className="flex flex-wrap gap-2">
              {keywords.map((keyword) => (
                <span
                  key={keyword.id}
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    keyword.is_primary
                      ? 'bg-indigo-100 text-indigo-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {keyword.keyword}
                  {keyword.is_primary && (
                    <svg className="ml-1 w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recent Posts */}
        {posts && posts.length > 0 && (
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Recent Posts</h3>
              <Link href={`/clients/${params.id}/posts`} className="text-sm text-indigo-600 hover:text-indigo-500">
                View all →
              </Link>
            </div>
            <div className="space-y-3">
              {posts.map((post) => (
                <div key={post.id} className="border-l-4 border-gray-200 pl-4">
                  <p className="text-sm text-gray-900">{post.title || post.content.substring(0, 50) + '...'}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(post.created_at).toLocaleDateString()} • {post.status}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Reviews */}
        {reviews && reviews.length > 0 && (
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Recent Reviews</h3>
              <Link href={`/clients/${params.id}/reviews`} className="text-sm text-indigo-600 hover:text-indigo-500">
                View all →
              </Link>
            </div>
            <div className="space-y-3">
              {reviews.map((review) => (
                <div key={review.id} className="border-l-4 border-gray-200 pl-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-900">{review.reviewer_name}</span>
                    <div className="flex text-yellow-400">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          className={`w-4 h-4 ${i < review.rating ? 'fill-current' : 'fill-none stroke-current'}`}
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{review.review_text?.substring(0, 100)}...</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(review.review_date).toLocaleDateString()} • {review.response_status}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Back Link */}
        <Link href="/clients" className="text-sm text-indigo-600 hover:text-indigo-500">
          ← Back to Clients
        </Link>
      </div>
    </div>
  )
}