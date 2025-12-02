import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getAppUser } from '@/lib/clerk-auth'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
    const appUser = await getAppUser()

    if (!appUser) {
        const headersList = await headers()
        const pathname = headersList.get('x-pathname') || headersList.get('referer') || '/settings'
        const currentPath = pathname.startsWith('http') ? new URL(pathname).pathname : pathname
        redirect(`/sign-in?redirect_url=${encodeURIComponent(currentPath)}`)
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
