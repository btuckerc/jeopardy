'use client'

interface LeaderboardEntry {
    rank: number
    userId: string
    displayName: string
    selectedIcon: string | null
    avatarBackground: string | null
    score: number
    correct: boolean
}

interface PodiumViewProps {
    topThree: LeaderboardEntry[]
}

const rankConfig = {
    1: {
        medal: '🥇',
        color: 'from-yellow-300 to-yellow-500',
        height: 'h-48',
        label: '1st'
    },
    2: {
        medal: '🥈',
        color: 'from-gray-300 to-gray-400',
        height: 'h-36',
        label: '2nd'
    },
    3: {
        medal: '🥉',
        color: 'from-amber-600 to-amber-700',
        height: 'h-28',
        label: '3rd'
    }
}

export default function PodiumView({ topThree }: PodiumViewProps) {
    if (topThree.length === 0) {
        return null
    }

    // Sort by rank
    const sorted = [...topThree].sort((a, b) => a.rank - b.rank)
    
    // Reorder for display: 2nd, 1st, 3rd
    const displayOrder = [1, 0, 2].map(i => sorted[i]).filter(Boolean)
    
    return (
        <div className="bg-gradient-to-b from-blue-800 to-blue-900 rounded-2xl shadow-2xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white text-center mb-8">Top Players</h2>
            
            <div className="flex items-end justify-center gap-4 h-64">
                {displayOrder.map((entry) => {
                    if (!entry) return null
                    
                    const config = rankConfig[entry.rank as keyof typeof rankConfig]
                    
                    return (
                        <div key={entry.userId} className="flex flex-col items-center">
                            {/* Avatar and name */}
                            <div className="text-center mb-4">
                                <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center text-2xl mb-2 mx-auto">
                                    {entry.selectedIcon || entry.displayName.charAt(0).toUpperCase()}
                                </div>
                                <p className="text-white font-semibold text-sm truncate max-w-[100px]">
                                    {entry.displayName}
                                </p>
                                <p className="text-2xl">{config.medal}</p>
                            </div>
                            
                            {/* Podium column */}
                            <div className={`
                                w-24 ${config.height} rounded-t-xl bg-gradient-to-b ${config.color}
                                flex items-end justify-center pb-4 shadow-lg
                            `}>
                                <span className="text-white font-bold text-lg">
                                    {config.label}
                                </span>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
