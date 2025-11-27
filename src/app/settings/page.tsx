import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
    const session = await auth()

    if (!session?.user) {
        redirect('/auth/signin')
    }

    const user = session.user
    const displayName = user.displayName || user.name || user.email?.split('@')[0]
    const selectedIcon = user.selectedIcon
    const avatarBackground = user.avatarBackground

    return <SettingsClient
        user={user}
        displayName={displayName || ''}
        selectedIcon={selectedIcon || null}
        avatarBackground={avatarBackground || null}
    />
}
