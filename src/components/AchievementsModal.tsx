'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/app/lib/auth'

interface Achievement {
    id: string
    code: string
    name: string
    description: string
    icon: string | null
    category: string | null
    tier: number | null
    isHidden: boolean
    unlocked: boolean
    unlockedAt: string | null
}

interface Props {
    isOpen: boolean
    onClose: () => void
}

export default function AchievementsModal({ isOpen, onClose }: Props) {
    const { user } = useAuth()
    const [achievements, setAchievements] = useState<Achievement[]>([])
    const [loading, setLoading] = useState(true)
    const modalRef = useRef<HTMLDivElement>(null)
    const closeButtonRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        if (isOpen && user) {
            loadAchievements()
        }
    }, [isOpen, user])

    const loadAchievements = async () => {
        try {
            setLoading(true)
            const response = await fetch('/api/achievements')
            if (response.ok) {
                const data = await response.json()
                setAchievements(data.achievements || [])
            }
        } catch (error) {
            console.error('Error loading achievements:', error)
        } finally {
            setLoading(false)
        }
    }

    // Handle ESC key to close modal
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isOpen) {
                onClose()
            }
        }

        if (isOpen) {
            document.addEventListener('keydown', handleEscape)
            setTimeout(() => closeButtonRef.current?.focus(), 100)
        }

        return () => {
            document.removeEventListener('keydown', handleEscape)
        }
    }, [isOpen, onClose])

    // Trap focus within modal
    useEffect(() => {
        if (!isOpen || !modalRef.current) return

        const modal = modalRef.current
        const focusableElements = modal.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        const handleTab = (event: KeyboardEvent) => {
            if (event.key !== 'Tab') return

            if (event.shiftKey) {
                if (document.activeElement === firstElement) {
                    event.preventDefault()
                    lastElement?.focus()
                }
            } else {
                if (document.activeElement === lastElement) {
                    event.preventDefault()
                    firstElement?.focus()
                }
            }
        }

        modal.addEventListener('keydown', handleTab)
        return () => {
            modal.removeEventListener('keydown', handleTab)
        }
    }, [isOpen])

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [isOpen])

    if (!isOpen) return null

    // Group achievements by category
    const categoryOrder: Record<string, number> = {
        onboarding: 1,
        streak: 2,
        volume: 3,
        skill: 4,
        knowledge: 5,
        hidden: 6
    }

    const categoryLabels: Record<string, string> = {
        onboarding: 'Getting Started',
        streak: 'Streaks & Habits',
        volume: 'Volume & Mastery',
        skill: 'Skill & Performance',
        knowledge: 'Knowledge Categories',
        hidden: 'Secret Achievements'
    }

    const groupedAchievements = achievements.reduce((acc, achievement) => {
        const category = achievement.category || 'other'
        if (!acc[category]) {
            acc[category] = []
        }
        acc[category].push(achievement)
        return acc
    }, {} as Record<string, Achievement[]>)

    // Sort categories and achievements within categories
    const sortedCategories = Object.keys(groupedAchievements).sort((a, b) => {
        const orderA = categoryOrder[a] || 999
        const orderB = categoryOrder[b] || 999
        return orderA - orderB
    })

    sortedCategories.forEach(category => {
        groupedAchievements[category].sort((a, b) => {
            // Sort by tier (lower first), then by unlocked status (unlocked first), then by name
            const tierA = a.tier || 999
            const tierB = b.tier || 999
            if (tierA !== tierB) return tierA - tierB
            if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1
            return a.name.localeCompare(b.name)
        })
    })

    const unlocked = achievements.filter(a => a.unlocked)
    const visibleAchievements = achievements.filter(a => !a.isHidden || a.unlocked)

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 transition-opacity"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Modal */}
            <div className="flex min-h-full items-center justify-center p-4">
                <div
                    ref={modalRef}
                    className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="achievements-title"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-yellow-50">
                        <div>
                            <h2 id="achievements-title" className="text-2xl font-bold text-gray-900">
                                Achievements
                            </h2>
                            <p className="text-sm text-gray-600 mt-1">
                                {unlocked.length} / {visibleAchievements.length} unlocked
                            </p>
                        </div>
                        <button
                            ref={closeButtonRef}
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-lg transition-colors"
                            aria-label="Close achievements"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto px-6 py-6">
                        {loading ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                                    <div key={i} className="card p-4 animate-pulse">
                                        <div className="h-12 w-12 bg-gray-200 rounded-full mx-auto mb-2"></div>
                                        <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {sortedCategories.map(category => {
                                    const categoryAchievements = groupedAchievements[category]
                                    const categoryUnlocked = categoryAchievements.filter(a => a.unlocked).length
                                    
                                    return (
                                        <div key={category}>
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-lg font-semibold text-gray-900">
                                                    {categoryLabels[category] || category}
                                                </h3>
                                                <span className="text-sm text-gray-500">
                                                    {categoryUnlocked} / {categoryAchievements.length}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                                {categoryAchievements.map((achievement) => (
                                                    <div
                                                        key={achievement.id}
                                                        className={`card p-4 text-center transition-all ${
                                                            achievement.unlocked
                                                                ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200'
                                                                : achievement.isHidden
                                                                ? 'bg-gray-100 border-2 border-gray-300 opacity-50'
                                                                : 'bg-gray-50 border-2 border-gray-200 opacity-60'
                                                        }`}
                                                        title={achievement.unlocked || !achievement.isHidden ? achievement.description : 'Hidden Achievement'}
                                                    >
                                                        <div className="text-4xl mb-2">
                                                            {achievement.unlocked 
                                                                ? achievement.icon || '🏆' 
                                                                : achievement.isHidden 
                                                                ? '❓' 
                                                                : '🔒'}
                                                        </div>
                                                        <div className={`text-sm font-medium ${
                                                            achievement.unlocked ? 'text-gray-900' : 'text-gray-500'
                                                        }`}>
                                                            {achievement.unlocked || !achievement.isHidden 
                                                                ? achievement.name 
                                                                : '???'}
                                                        </div>
                                                        {achievement.unlocked && achievement.unlockedAt && (
                                                            <div className="text-xs text-gray-500 mt-1">
                                                                {new Date(achievement.unlockedAt).toLocaleDateString()}
                                                            </div>
                                                        )}
                                                        {!achievement.unlocked && !achievement.isHidden && (
                                                            <div className="text-xs text-gray-400 mt-1 line-clamp-2">
                                                                {achievement.description}
                                                            </div>
                                                        )}
                                                        {!achievement.unlocked && achievement.isHidden && (
                                                            <div className="text-xs text-gray-400 mt-1 italic">
                                                                Keep playing to discover...
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

