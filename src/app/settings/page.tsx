import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import UserAvatar from '@/components/UserAvatar'
import UserSettings from '@/components/UserSettings'
import SpoilerSettings from '@/components/SpoilerSettings'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
    const supabase = createServerComponentClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        redirect('/api/auth/signin')
    }

    const user = session.user
    const displayName = user.user_metadata?.displayName || user.email?.split('@')[0]
    const selectedIcon = user.user_metadata?.selectedIcon

    return <SettingsClient
        user={user}
        displayName={displayName}
        selectedIcon={selectedIcon}
    />
} 