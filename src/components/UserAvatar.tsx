'use client'

interface UserAvatarProps {
    email: string;
    displayName?: string | null;
    selectedIcon?: string | null;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const PROFILE_ICONS = {
    '🎓': 'Person',
    '📓': 'Scholar',
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
    '🎤': 'Host'
}

export default function UserAvatar({ email, displayName, selectedIcon, size = 'md', className = '' }: UserAvatarProps) {
    const firstLetter = displayName ? displayName.charAt(0).toUpperCase() : email.charAt(0).toUpperCase()
    const sizeClasses = {
        sm: 'w-8 h-8 text-sm',
        md: 'w-10 h-10 text-base',
        lg: 'w-12 h-12 text-lg'
    }

    return (
        <div
            className={`${sizeClasses[size]} rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold ${className}`}
        >
            {selectedIcon || '👤'}
        </div>
    )
}

export { PROFILE_ICONS } 