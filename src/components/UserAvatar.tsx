'use client'

interface UserAvatarProps {
    email?: string;
    displayName?: string | null;
    selectedIcon?: string | null;
    avatarBackground?: string | null;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    interactive?: boolean;
}

export const PROFILE_ICONS = {
    '🎓': 'Person',
    '📖': 'Scholar',
    '🧠': 'Brain',
    '🎯': 'Target',
    '⭐': 'Star',
    '🏆': 'Trophy',
    '📚': 'Books',
    '💡': 'Idea',
    '🎮': 'Game',
    '🎲': 'Dice',
    '🔍': 'Search',
    '❓': 'Question',
    '💭': 'Thinking',
    '🎪': 'Show',
    '🎤': 'Host',
    '🕵️‍♂️': 'Detective',
    '🧑‍🏫': 'Teacher',
    '🌍': 'Globe',
    '🔬': 'Microscope',
    '🕒': 'Clock',
    '🕹️': 'Joystick',
    '🎭': 'Masks',
    '🎥': 'Camera',
    '🚀': 'Rocket',
    '🌀': 'Cyclone',
    '🌟': 'Sparkles'
} as const

// Curated palette of avatar background themes
export const AVATAR_BACKGROUNDS = {
    blue: {
        name: 'Ocean',
        gradient: 'radial-gradient(circle at 30% 30%, rgba(59, 130, 246, 0.3), rgba(37, 99, 235, 0.8), rgba(30, 64, 175, 1))',
        shadow: '0 4px 12px rgba(37, 99, 235, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
    },
    purple: {
        name: 'Violet',
        gradient: 'radial-gradient(circle at 30% 30%, rgba(168, 85, 247, 0.3), rgba(139, 92, 246, 0.8), rgba(109, 40, 217, 1))',
        shadow: '0 4px 12px rgba(139, 92, 246, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
    },
    teal: {
        name: 'Lagoon',
        gradient: 'radial-gradient(circle at 30% 30%, rgba(45, 212, 191, 0.3), rgba(20, 184, 166, 0.8), rgba(13, 148, 136, 1))',
        shadow: '0 4px 12px rgba(20, 184, 166, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
    },
    rose: {
        name: 'Sunset',
        gradient: 'radial-gradient(circle at 30% 30%, rgba(251, 113, 133, 0.3), rgba(244, 63, 94, 0.8), rgba(225, 29, 72, 1))',
        shadow: '0 4px 12px rgba(244, 63, 94, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
    },
    amber: {
        name: 'Gold',
        gradient: 'radial-gradient(circle at 30% 30%, rgba(251, 191, 36, 0.3), rgba(245, 158, 11, 0.8), rgba(217, 119, 6, 1))',
        shadow: '0 4px 12px rgba(245, 158, 11, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
    },
    slate: {
        name: 'Graphite',
        gradient: 'radial-gradient(circle at 30% 30%, rgba(100, 116, 139, 0.3), rgba(71, 85, 105, 0.8), rgba(51, 65, 85, 1))',
        shadow: '0 4px 12px rgba(71, 85, 105, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
    },
} as const

export type AvatarBackgroundKey = keyof typeof AVATAR_BACKGROUNDS

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
