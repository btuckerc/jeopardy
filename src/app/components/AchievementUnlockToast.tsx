'use client'

import { useEffect } from 'react'
import toast from 'react-hot-toast'

interface AchievementUnlock {
    code: string
    name: string
    icon: string | null
    description: string
}

interface AchievementUnlockToastProps {
    achievements: AchievementUnlock[]
}

export function AchievementUnlockToast({ achievements }: AchievementUnlockToastProps) {
    useEffect(() => {
        achievements.forEach((achievement) => {
            // Determine if this is a significant achievement (streak milestones, major volume, etc.)
            const isSignificant = 
                achievement.code.startsWith('STREAK_') ||
                achievement.code.startsWith('QUESTIONS_') && achievement.code.includes('_1000') ||
                achievement.code === 'PERFECT_GAME' ||
                achievement.code === 'ALL_CATEGORIES_MASTER'

            toast(
                (t) => (
                    <div className="flex items-start gap-3">
                        <div className="text-3xl flex-shrink-0">
                            {achievement.icon || '🏆'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-bold text-gray-900 text-sm mb-0.5">
                                Achievement Unlocked!
                            </div>
                            <div className="font-semibold text-gray-800 text-base mb-1">
                                {achievement.name}
                            </div>
                            <div className="text-xs text-gray-600">
                                {achievement.description}
                            </div>
                        </div>
                        <button
                            onClick={() => toast.dismiss(t.id)}
                            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                            aria-label="Dismiss"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                ),
                {
                    duration: isSignificant ? 6000 : 4000,
                    position: 'bottom-right',
                    className: 'achievement-toast',
                    style: {
                        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                        border: '2px solid #fbbf24',
                        borderRadius: '12px',
                        padding: '16px',
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                    },
                    icon: null, // We're using custom icon in the toast content
                }
            )
        })
    }, [achievements])

    return null
}

// Helper function to show achievement unlock toast
export function showAchievementUnlock(achievement: AchievementUnlock) {
    const isSignificant = 
        achievement.code.startsWith('STREAK_') ||
        (achievement.code.startsWith('QUESTIONS_') && achievement.code.includes('_1000')) ||
        achievement.code === 'PERFECT_GAME' ||
        achievement.code === 'ALL_CATEGORIES_MASTER'

    toast(
        (t) => (
            <div className="flex items-start gap-3">
                <div className="text-3xl flex-shrink-0 animate-bounce">
                    {achievement.icon || '🏆'}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 text-sm mb-0.5">
                        Achievement Unlocked!
                    </div>
                    <div className="font-semibold text-gray-800 text-base mb-1">
                        {achievement.name}
                    </div>
                    <div className="text-xs text-gray-600">
                        {achievement.description}
                    </div>
                </div>
                <button
                    onClick={() => toast.dismiss(t.id)}
                    className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Dismiss"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        ),
        {
            duration: isSignificant ? 6000 : 4000,
            position: 'bottom-right',
            className: 'achievement-toast',
            style: {
                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                border: '2px solid #fbbf24',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
            },
            icon: null,
        }
    )
}
