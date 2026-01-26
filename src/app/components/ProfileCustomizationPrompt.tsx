'use client'

import { useState, useEffect } from 'react'
import UserSettings from '@/components/UserSettings'
import { useAuth } from '@/app/lib/auth'

interface ProfileCustomizationPromptProps {
    trigger: 'first_game' | 'leaderboard' | 'menu'
    onComplete?: () => void
    /** For 'menu' trigger: callback to open the parent's settings modal instead of embedding one */
    onOpenSettings?: () => void
}

export default function ProfileCustomizationPrompt({ trigger, onComplete, onOpenSettings }: ProfileCustomizationPromptProps) {
    const { user } = useAuth()
    const [showSettings, setShowSettings] = useState(false)
    const [hasCustomized, setHasCustomized] = useState(false)

    useEffect(() => {
        if (!user) return
        
        // Check if user has customized their profile
        const isCustomized = !!(user.displayName && user.displayName.trim() && user.selectedIcon)
        setHasCustomized(isCustomized)
        
        // Only show prompt if not customized and this is the right trigger
        if (!isCustomized && trigger === 'first_game') {
            // Small delay to let game completion modal show first
            const timer = setTimeout(() => {
                setShowSettings(true)
            }, 2000)
            return () => clearTimeout(timer)
        }
    }, [user, trigger])

    if (hasCustomized || !user) {
        return null
    }

    const getPromptMessage = () => {
        switch (trigger) {
            case 'first_game':
                return {
                    title: '🎉 Great job on your first game!',
                    message: 'Customize your profile to stand out on the leaderboard',
                    cta: 'Customize Profile'
                }
            case 'leaderboard':
                return {
                    title: 'Make your mark',
                    message: 'Add a custom name and icon to personalize your profile',
                    cta: 'Customize Now'
                }
            case 'menu':
                return {
                    title: 'Personalize your profile',
                    message: 'Choose a display name and icon to make your profile unique',
                    cta: 'Get Started'
                }
            default:
                return {
                    title: 'Customize your profile',
                    message: 'Add a display name and icon',
                    cta: 'Customize'
                }
        }
    }

    const prompt = getPromptMessage()


    if (trigger === 'first_game' && showSettings) {
        return (
            <UserSettings
                isOpen={showSettings}
                onClose={() => {
                    setShowSettings(false)
                    onComplete?.()
                }}
                onDisplayNameUpdate={() => {
                    // Check if profile is now customized
                    if (user?.displayName && user?.selectedIcon) {
                        setHasCustomized(true)
                        // Trigger achievement check
                        fetch('/api/user/check-profile-achievement', { method: 'POST' }).catch(() => {})
                    }
                }}
                onIconUpdate={() => {
                    // Check if profile is now customized
                    if (user?.displayName && user?.selectedIcon) {
                        setHasCustomized(true)
                        // Trigger achievement check
                        fetch('/api/user/check-profile-achievement', { method: 'POST' }).catch(() => {})
                    }
                }}
                email={user?.email}
                displayName={user?.displayName}
                selectedIcon={user?.selectedIcon}
                avatarBackground={user?.avatarBackground}
            />
        )
    }

    // For 'menu' trigger: just render a banner, use callback to open parent's modal
    if (trigger === 'menu') {
        return (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                    <div className="text-xl flex-shrink-0">🎨</div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-700 font-medium">{prompt.title}</p>
                        <p className="text-xs text-gray-500">{prompt.message}</p>
                    </div>
                    <button
                        onClick={() => onOpenSettings?.()}
                        className="flex-shrink-0 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                        {prompt.cta}
                    </button>
                </div>
            </div>
        )
    }

    // For 'leaderboard' trigger: render with embedded modal
    if (trigger === 'leaderboard') {
        return (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3">
                    <div className="text-2xl flex-shrink-0">🎨</div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 text-sm mb-1">{prompt.title}</h3>
                        <p className="text-xs text-gray-600 mb-3">{prompt.message}</p>
                        <button
                            onClick={() => setShowSettings(true)}
                            className="btn-primary btn-sm"
                        >
                            {prompt.cta}
                        </button>
                    </div>
                </div>
                {showSettings && (
                    <UserSettings
                        isOpen={showSettings}
                        onClose={() => {
                            setShowSettings(false)
                            onComplete?.()
                        }}
                        onDisplayNameUpdate={() => {
                            if (user?.displayName && user?.selectedIcon) {
                                setHasCustomized(true)
                                fetch('/api/user/check-profile-achievement', { method: 'POST' }).catch(() => {})
                            }
                        }}
                        onIconUpdate={() => {
                            if (user?.displayName && user?.selectedIcon) {
                                setHasCustomized(true)
                                fetch('/api/user/check-profile-achievement', { method: 'POST' }).catch(() => {})
                            }
                        }}
                        email={user?.email}
                        displayName={user?.displayName}
                        selectedIcon={user?.selectedIcon}
                        avatarBackground={user?.avatarBackground}
                    />
                )}
            </div>
        )
    }

    return null
}
