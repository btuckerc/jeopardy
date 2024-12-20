'use client'

import UserAvatar from '@/components/UserAvatar'
import UserSettings from '@/components/UserSettings'
import SpoilerSettings from '@/components/SpoilerSettings'
import { User } from '@supabase/auth-helpers-nextjs'

interface SettingsClientProps {
    user: User
    displayName: string
    selectedIcon: string | null
}

export default function SettingsClient({ user, displayName, selectedIcon }: SettingsClientProps) {
    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-8">Settings</h1>

            <div className="space-y-8">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h2 className="text-2xl font-semibold mb-4">Profile</h2>
                    <div className="flex items-center space-x-4 mb-6">
                        <UserAvatar
                            email={user.email || ''}
                            displayName={displayName}
                            selectedIcon={selectedIcon}
                            size="lg"
                        />
                        <div>
                            <p className="text-lg font-medium">{user.email}</p>
                        </div>
                    </div>
                    <UserSettings
                        email={user.email || ''}
                        displayName={displayName}
                        selectedIcon={selectedIcon}
                        isOpen={true}
                        onClose={() => { }}
                        onDisplayNameUpdate={() => { }}
                        onIconUpdate={() => { }}
                    />
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h2 className="text-2xl font-semibold mb-4">Spoiler Settings</h2>
                    <SpoilerSettings
                        userId={user.id}
                        spoilerBlockEnabled={user.user_metadata?.spoilerBlockEnabled}
                        spoilerBlockDate={user.user_metadata?.spoilerBlockDate}
                    />
                </div>
            </div>
        </div>
    )
} 