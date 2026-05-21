'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function NewClientPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    business_name: '',
    business_address: '',
    city: '',
    state: '',
    zip_code: '',
    phone: '',
    website: '',
    business_category: '',
    target_keywords: '',
    posts_per_week: 3,
    content_tone: 'professional'
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth')
        return
      }

      // Create client with user profile ID
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single()

      if (!profile) {
        // Create profile if it doesn't exist
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || ''
          })

        if (profileError) {
          throw new Error('Failed to create user profile')
        }
      }

      // Create the client
      const { data, error: insertError } = await supabase
        .from('clients')
        .insert({
          user_id: user.id,
          business_name: formData.business_name,
          business_address: formData.business_address,
          city: formData.city,
          state: formData.state,
          zip_code: formData.zip_code,
          phone: formData.phone,
          website: formData.website,
          business_category: formData.business_category,
          target_keywords: formData.target_keywords.split(',').map(k => k.trim()).filter(Boolean),
          posting_schedule: {
            posts_per_week: formData.posts_per_week,
            preferred_days: ['monday', 'wednesday', 'friday']
          },
          content_tone: formData.content_tone,
          status: 'active'
        })
        .select()
        .single()

      if (insertError) {
        throw insertError
      }

      // Redirect to client page
      router.push(`/clients/${data.id}`)
    } catch (err: any) {
      setError(err.message || 'Failed to create client')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Add New Client</h1>
              <Link
                href="/clients"
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </Link>
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Business Information */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Business Information</h3>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div className="col-span-2">
                    <label htmlFor="business_name" className="block text-sm font-medium text-gray-700">
                      Business Name *
                    </label>
                    <input
                      type="text"
                      name="business_name"
                      id="business_name"
                      required
                      value={formData.business_name}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      placeholder="Acme Law Firm"
                    />
                  </div>

                  <div className="col-span-2">
                    <label htmlFor="business_address" className="block text-sm font-medium text-gray-700">
                      Business Address
                    </label>
                    <input
                      type="text"
                      name="business_address"
                      id="business_address"
                      value={formData.business_address}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      placeholder="123 Main Street"
                    />
                  </div>

                  <div>
                    <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                      City
                    </label>
                    <input
                      type="text"
                      name="city"
                      id="city"
                      value={formData.city}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      placeholder="Columbus"
                    />
                  </div>

                  <div>
                    <label htmlFor="state" className="block text-sm font-medium text-gray-700">
                      State
                    </label>
                    <input
                      type="text"
                      name="state"
                      id="state"
                      value={formData.state}
                      onChange={handleChange}
                      maxLength={2}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      placeholder="OH"
                    />
                  </div>

                  <div>
                    <label htmlFor="zip_code" className="block text-sm font-medium text-gray-700">
                      ZIP Code
                    </label>
                    <input
                      type="text"
                      name="zip_code"
                      id="zip_code"
                      value={formData.zip_code}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      placeholder="43215"
                    />
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                      Phone
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      id="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      placeholder="(614) 555-0123"
                    />
                  </div>

                  <div className="col-span-2">
                    <label htmlFor="website" className="block text-sm font-medium text-gray-700">
                      Website
                    </label>
                    <input
                      type="url"
                      name="website"
                      id="website"
                      value={formData.website}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      placeholder="https://www.example.com"
                    />
                  </div>

                  <div className="col-span-2">
                    <label htmlFor="business_category" className="block text-sm font-medium text-gray-700">
                      Business Category
                    </label>
                    <select
                      name="business_category"
                      id="business_category"
                      value={formData.business_category}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                      <option value="">Select a category</option>
                      <option value="Law Firm">Law Firm</option>
                      <option value="Restaurant">Restaurant</option>
                      <option value="Medical Practice">Medical Practice</option>
                      <option value="Dental Practice">Dental Practice</option>
                      <option value="Home Services">Home Services</option>
                      <option value="Auto Services">Auto Services</option>
                      <option value="Retail Store">Retail Store</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SEO Settings */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">SEO Settings</h3>
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label htmlFor="target_keywords" className="block text-sm font-medium text-gray-700">
                      Target Keywords
                    </label>
                    <textarea
                      name="target_keywords"
                      id="target_keywords"
                      rows={3}
                      value={formData.target_keywords}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      placeholder="Enter keywords separated by commas (e.g., personal injury lawyer, car accident attorney)"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      These keywords will be used for rank tracking and content generation
                    </p>
                  </div>
                </div>
              </div>

              {/* Content Settings */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Content Settings</h3>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="posts_per_week" className="block text-sm font-medium text-gray-700">
                      Posts Per Week
                    </label>
                    <select
                      name="posts_per_week"
                      id="posts_per_week"
                      value={formData.posts_per_week}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                      <option value={1}>1 post per week</option>
                      <option value={2}>2 posts per week</option>
                      <option value={3}>3 posts per week</option>
                      <option value={5}>5 posts per week</option>
                      <option value={7}>7 posts per week</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="content_tone" className="block text-sm font-medium text-gray-700">
                      Content Tone
                    </label>
                    <select
                      name="content_tone"
                      id="content_tone"
                      value={formData.content_tone}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                      <option value="professional">Professional</option>
                      <option value="friendly">Friendly</option>
                      <option value="casual">Casual</option>
                      <option value="formal">Formal</option>
                      <option value="conversational">Conversational</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end space-x-3">
                <Link
                  href="/clients"
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating...' : 'Create Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}