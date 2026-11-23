'use client'

import { useState } from 'react'
import { PageShell } from '@/components/PageShell'
import { PageHeader } from '@/components/PageHeader'
import UserSettings from '@/components/UserSettings'

export interface SettingsUser {
    id: string
    email?: string | null
    name?: string | null
    displayName?: string | null
    selectedIcon?: string | null
    avatarBackground?: string | null
    role?: string | null
    image?: string | null
}

interface SettingsClientProps {
    user: SettingsUser
    displayName: string
    selectedIcon: string | null
    avatarBackground: string | null
}

export default function SettingsClient({
    user,
    displayName: initialDisplayName,
    selectedIcon: initialSelectedIcon,
    avatarBackground: initialAvatarBackground,
}: SettingsClientProps) {
    const [displayName, setDisplayName] = useState(initialDisplayName)
    const [selectedIcon, setSelectedIcon] = useState<string | null>(initialSelectedIcon)
    const [avatarBackground, setAvatarBackground] = useState<string | null>(initialAvatarBackground)

    return (
        <PageShell variant="narrow">
            <PageHeader
                kicker="Account"
                title="Settings"
                subtitle="Customize your profile, avatar, and episode spoiler protection."
            />

            <div className="card p-6 sm:p-8">
                <UserSettings
                    embedded
                    email={user.email || ''}
                    displayName={displayName}
                    selectedIcon={selectedIcon}
                    avatarBackground={avatarBackground}
                    isOpen={true}
                    onClose={() => {}}
                    onDisplayNameUpdate={setDisplayName}
                    onIconUpdate={setSelectedIcon}
                    onAvatarBackgroundUpdate={setAvatarBackground}
                />
            </div>
        </PageShell>
    )
}
