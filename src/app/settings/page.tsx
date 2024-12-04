'use client'

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import UserAvatar from '@/components/UserAvatar'
import UserSettings from '@/components/UserSettings'
import SpoilerSettings from '@/components/SpoilerSettings'

export default async function SettingsPage() {
    const supabase = createServerComponentClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        redirect('/api/auth/signin')
    }

    const user = session.user
    const displayName = user.user_metadata?.displayName || user.email?.split('@')[0]
    const selectedIcon = user.user_metadata?.selectedIcon

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