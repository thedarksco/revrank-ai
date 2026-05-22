import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BusinessProfilesClient from './BusinessProfilesClient'

export default async function BusinessProfilesPage() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  // Fetch initial data server-side
  const { data: locations } = await supabase
    .from('gbp_locations')
    .select('*')
    .eq('user_id', user.id)
    .order('location_name', { ascending: true })

  const { data: googleAccounts } = await supabase
    .from('google_accounts')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)

  return <BusinessProfilesClient initialLocations={locations || []} googleAccounts={googleAccounts || []} />
}