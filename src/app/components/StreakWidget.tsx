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
    const { currentStreak, longestStreak } = streakData

    // Don't show if streak is 0
    if (currentStreak === 0 && longestStreak === 0) {
        return null
    }

    // Determine if streak is at risk (last game was yesterday, need to play today)
    const lastGameDate = streakData.lastGameDate ? new Date(streakData.lastGameDate) : null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    let isAtRisk = false
    if (lastGameDate && currentStreak > 0) {
        lastGameDate.setHours(0, 0, 0, 0)
        const daysDiff = Math.floor((today.getTime() - lastGameDate.getTime()) / (1000 * 60 * 60 * 24))
        isAtRisk = daysDiff >= 1 // Haven't played today
    }

    // Check for milestone streaks
    const isMilestone = currentStreak > 0 && (
        currentStreak === 3 ||
        currentStreak === 7 ||
        currentStreak === 14 ||
        currentStreak === 30 ||
        currentStreak === 100
    )

    return (
        <div className={`mt-8 max-w-4xl mx-auto ${isAtRisk ? 'animate-pulse' : ''}`}>
            <Link 
                href="/game" 
                className="block group"
            >
                <div className={`
                    relative rounded-2xl overflow-hidden shadow-lg p-6
                    transition-all duration-300 group-hover:shadow-xl group-hover:scale-[1.02]
                    ${isAtRisk 
                        ? 'bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-200' 
                        : isMilestone
                        ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-300'
                        : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200'
                    }
                `}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={`
                                text-4xl ${isAtRisk ? 'animate-bounce' : ''}
                            `}>
                                {isAtRisk ? '⚠️' : currentStreak >= 7 ? '🔥' : currentStreak >= 3 ? '⭐' : '📅'}
                            </div>
                            <div>
                                <div className="text-sm font-medium text-gray-600 mb-1">
                                    {isAtRisk ? 'Streak at Risk!' : 'Current Streak'}
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-bold text-gray-900">
                                        {currentStreak}
                                    </span>
                                    <span className="text-lg text-gray-600">
                                        {currentStreak === 1 ? 'day' : 'days'}
                                    </span>
                                </div>
                                {longestStreak > currentStreak && (
                                    <div className="text-xs text-gray-500 mt-1">
                                        Best: {longestStreak} days
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                            {isAtRisk ? (
                                <div className="text-sm font-semibold text-red-700">
                                    Play today to keep your streak!
                                </div>
                            ) : isMilestone ? (
                                <div className="text-sm font-semibold text-amber-700">
                                    🎉 Milestone reached!
                                </div>
                            ) : (
                                <div className="text-sm text-gray-600">
                                    Keep it going →
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Link>
        </div>
    )
}
