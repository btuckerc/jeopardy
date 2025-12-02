'use client'

import { PROFILE_ICONS, AVATAR_BACKGROUNDS, type AvatarBackgroundKey } from '@/lib/avatar'

// Re-export for backward compatibility
export { PROFILE_ICONS, AVATAR_BACKGROUNDS, type AvatarBackgroundKey }

interface UserAvatarProps {
    email?: string;
    displayName?: string | null;
    selectedIcon?: string | null;
    avatarBackground?: string | null;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    interactive?: boolean;
}

export default function UserAvatar({ 
    email, 
    displayName, 
    selectedIcon, 
    avatarBackground,
    size = 'md', 
    className = '',
    interactive = false
}: UserAvatarProps) {
    const sizeClasses = {
        sm: 'w-8 h-8 text-sm',
        md: 'w-10 h-10 text-base',
        lg: 'w-16 h-16 text-2xl'
    }

    // Get the background theme - default to blue if not set or invalid
    const bgKey = (avatarBackground && avatarBackground in AVATAR_BACKGROUNDS) 
        ? avatarBackground as AvatarBackgroundKey 
        : 'blue'
    const bgTheme = AVATAR_BACKGROUNDS[bgKey]
    
    return (
        <div 
            className={`
                ${sizeClasses[size]} 
                rounded-full 
                flex items-center justify-center 
                font-semibold
                relative
                transition-all duration-300 ease-out
                ${interactive ? 'hover:scale-110 hover:shadow-lg focus:scale-110 focus:shadow-lg' : ''}
                ${className}
            `}
            style={{
                background: bgTheme.gradient,
                boxShadow: bgTheme.shadow
            }}
            role="img"
            aria-label={displayName || email || 'User avatar'}
        >
            {/* Subtle shine overlay */}
            <div 
                className="absolute inset-0 rounded-full opacity-20"
                style={{
                    background: 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.4), transparent 60%)'
                }}
            />
            
            {/* Emoji/Icon */}
            <span className="relative z-10 select-none" style={{ filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))' }}>
                {selectedIcon || '👤'}
            </span>
        </div>
    )
}
