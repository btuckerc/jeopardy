'use client'

import { getAuthUser } from './auth'
import UserAvatar from '@/components/UserAvatar'
import UserSettings from '@/components/UserSettings'
import SpoilerSettings from '@/components/SpoilerSettings'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default async function SettingsPage() {
    const user = await getAuthUser()

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-8">Settings</h1>

            <div className="space-y-8">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h2 className="text-2xl font-semibold mb-4">Profile</h2>
                    <div className="flex items-center space-x-4 mb-6">
                        <UserAvatar user={user} size={64} />
                        <div>
                            <p className="text-lg font-medium">{user.email}</p>
                        </div>
                    </div>
                    <UserSettings user={user} />
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h2 className="text-2xl font-semibold mb-4">Spoiler Settings</h2>
                    <SpoilerSettings user={user} />
                </div>
            </div>
        </div>
    )
} 