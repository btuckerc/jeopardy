import { redirect } from 'next/navigation'
import { getAppUser } from '@/lib/clerk-auth'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
    const appUser = await getAppUser()

    if (!appUser) {
        redirect('/sign-in')
    }

    const displayName = appUser.displayName || appUser.email?.split('@')[0] || 'User'
    const selectedIcon = appUser.selectedIcon
    const avatarBackground = appUser.avatarBackground

    return <SettingsClient
        user={{
            id: appUser.id,
            email: appUser.email,
            name: appUser.name,
            displayName: appUser.displayName,
            selectedIcon: appUser.selectedIcon,
            avatarBackground: appUser.avatarBackground,
            role: appUser.role,
            image: appUser.image,
        }}
        displayName={displayName || ''}
        selectedIcon={selectedIcon || null}
        avatarBackground={avatarBackground || null}
    />
}
