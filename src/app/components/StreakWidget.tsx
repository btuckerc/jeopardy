'use client'

import Link from 'next/link'

interface StreakData {
    currentStreak: number
    longestStreak: number
    lastGameDate: string | null
}

interface StreakWidgetProps {
    streakData: StreakData
}

export default function StreakWidget({ streakData }: StreakWidgetProps) {
    const { currentStreak, longestStreak, lastGameDate: lastGameDateStr } = streakData

    // Calculate effective streak based on how many days since last played
    const lastGameDate = lastGameDateStr ? new Date(lastGameDateStr) : null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    let effectiveStreak = currentStreak
    let streakStatus: 'active' | 'at_risk' | 'lost' = 'active'
    let previousStreak = 0

    if (lastGameDate && currentStreak > 0) {
        lastGameDate.setHours(0, 0, 0, 0)
        const daysDiff = Math.floor((today.getTime() - lastGameDate.getTime()) / (1000 * 60 * 60 * 24))
        
        if (daysDiff === 0) {
            // Played today - streak is active
            streakStatus = 'active'
            effectiveStreak = currentStreak
        } else if (daysDiff === 1) {
            // Played yesterday - streak is at risk
            streakStatus = 'at_risk'
            effectiveStreak = currentStreak
        } else {
            // 2+ days ago - streak is lost
            previousStreak = currentStreak
            effectiveStreak = 0
            streakStatus = 'lost'
        }
    } else if (currentStreak === 0 && longestStreak === 0) {
        // No streak history at all - don't show widget
        return null
    }

    // Check for milestone streaks (only for active streaks)
    const isMilestone = effectiveStreak > 0 && (
        effectiveStreak === 3 ||
        effectiveStreak === 7 ||
        effectiveStreak === 14 ||
        effectiveStreak === 30 ||
        effectiveStreak === 100
    )

    // Determine styling and content based on status
    let bgGradient = 'bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200'
    let icon = effectiveStreak >= 7 ? '🔥' : effectiveStreak >= 3 ? '⭐' : '📅'
    let title = 'Current Streak'
    let message = 'Keep it going →'
    let messageColor = 'text-gray-600'

    if (streakStatus === 'at_risk') {
        bgGradient = 'bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200'
        icon = '📅'
        title = `${effectiveStreak} ${effectiveStreak === 1 ? 'day' : 'days'} streak`
        message = 'Play today to continue!'
        messageColor = 'text-amber-700'
    } else if (streakStatus === 'lost') {
        bgGradient = 'bg-gradient-to-br from-slate-50 to-gray-50 border-2 border-slate-200'
        icon = '🔄'
        title = previousStreak > 0 ? `Your ${previousStreak}-day streak ended` : 'No active streak'
        message = 'Start a new one!'
        messageColor = 'text-slate-700'
    } else if (isMilestone) {
        bgGradient = 'bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-300'
        message = '🎉 Milestone reached!'
        messageColor = 'text-amber-700'
    }

    return (
        <div className="mt-8 max-w-4xl mx-auto">
            <Link 
                href="/game" 
                className="block group"
            >
                <div className={`
                    relative rounded-2xl overflow-hidden shadow-lg p-6
                    transition-all duration-300 group-hover:shadow-xl group-hover:scale-[1.02]
                    ${bgGradient}
                `}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="text-4xl">
                                {icon}
                            </div>
                            <div>
                                <div className="text-sm font-medium text-gray-600 mb-1">
                                    {title}
                                </div>
                                {streakStatus !== 'lost' && (
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-3xl font-bold text-gray-900">
                                            {effectiveStreak}
                                        </span>
                                        <span className="text-lg text-gray-600">
                                            {effectiveStreak === 1 ? 'day' : 'days'}
                                        </span>
                                    </div>
                                )}
                                {longestStreak > effectiveStreak && streakStatus !== 'lost' && (
                                    <div className="text-xs text-gray-500 mt-1">
                                        Best: {longestStreak} days
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className={`text-sm font-semibold ${messageColor}`}>
                                {message}
                            </div>
                        </div>
                    </div>
                </div>
            </Link>
        </div>
    )
}
