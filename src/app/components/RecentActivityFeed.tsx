'use client'

import Link from 'next/link'

interface ActivityStats {
    gamesThisWeek: number
    bestScore: number
    leaderboardRank: number | null
    totalPlayers: number
}

interface RecentActivityFeedProps {
    stats: ActivityStats
}

export default function RecentActivityFeed({ stats }: RecentActivityFeedProps) {
    return (
        <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-600">
            {stats.gamesThisWeek > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span>
                        <strong className="text-gray-900">{stats.gamesThisWeek}</strong> game{stats.gamesThisWeek !== 1 ? 's' : ''} this week
                    </span>
                </div>
            )}
            
            {stats.bestScore > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg">
                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span>
                        Best score: <strong className="text-gray-900">${stats.bestScore.toLocaleString()}</strong>
                    </span>
                </div>
            )}
        </div>
    )
}

