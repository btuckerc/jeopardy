'use client'

import { User } from '@supabase/supabase-js'

interface UserAvatarProps {
    user: User
    size?: number
}

export default function UserAvatar({ user, size = 32 }: UserAvatarProps) {
    const displayName = user.user_metadata?.displayName || user.email?.split('@')[0] || 'User'
    const selectedIcon = user.user_metadata?.selectedIcon || '👤'

    return (
        <div 
            className="flex items-center justify-center bg-blue-100 dark:bg-blue-900 rounded-full"
            style={{ width: size, height: size }}
        >
            <span style={{ fontSize: size * 0.5 }}>{selectedIcon}</span>
        </div>
    )
} 