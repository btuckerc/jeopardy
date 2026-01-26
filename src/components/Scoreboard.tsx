'use client'

import UserAvatar from './UserAvatar'

export interface Player {
    id: string
    displayName: string
    selectedIcon?: string | null
    avatarBackground?: string | null
    score: number
    isCurrentUser?: boolean
    isActive?: boolean // For multiplayer: whose turn is it
}

interface ScoreboardProps {
    players: Player[]
    currentRound?: 'SINGLE' | 'DOUBLE' | 'FINAL'
    showRoundIndicator?: boolean
    compact?: boolean
    className?: string
}

/**
 * Scoreboard component - displays player scores in a multiplayer-ready format.
 * For single player, pass an array with one player.
 * For multiplayer (future), pass multiple players with isActive indicating whose turn it is.
 */
export default function Scoreboard({
    players,
    currentRound,
    showRoundIndicator = true,
    compact = false,
    className = ''
}: ScoreboardProps) {
    const roundLabels: Record<string, string> = {
        SINGLE: 'Jeopardy',
        DOUBLE: 'Double Jeopardy',
        FINAL: 'Final Jeopardy'
    }

    const formatScore = (score: number) => {
        const prefix = score < 0 ? '-$' : '$'
        return `${prefix}${Math.abs(score).toLocaleString()}`
    }

    if (compact) {
        // Compact mode for header display
        return (
            <div className={`flex items-center gap-4 ${className}`}>
                {showRoundIndicator && currentRound && (
                    <div className="hidden sm:flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Round
                        </span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">
                            {roundLabels[currentRound] || currentRound}
                        </span>
                    </div>
                )}
                
                <div className="flex items-center gap-3">
                    {players.map((player, _index) => (
                        <div
                            key={player.id}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                                player.isActive
                                    ? 'bg-amber-100 ring-2 ring-amber-400'
                                    : 'bg-gray-100'
                            } ${player.isCurrentUser ? 'ring-2 ring-blue-400' : ''}`}
                        >
                            <UserAvatar
                                email=""
                                displayName={player.displayName}
                                selectedIcon={player.selectedIcon}
                                avatarBackground={player.avatarBackground}
                                size="sm"
                            />
                            <div className="flex flex-col">
                                <span className="text-xs text-gray-600 font-medium truncate max-w-[80px]">
                                    {player.isCurrentUser ? 'You' : player.displayName}
                                </span>
                                <span className={`text-sm font-bold ${
                                    player.score >= 0 ? 'text-gray-900' : 'text-red-600'
                                }`}>
                                    {formatScore(player.score)}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    // Full scoreboard display (for game end or standalone view)
    return (
        <div className={`bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden ${className}`}>
            {showRoundIndicator && currentRound && (
                <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium opacity-90">Current Round</span>
                        <span className="text-lg font-bold">
                            {roundLabels[currentRound] || currentRound}
                        </span>
                    </div>
                </div>
            )}
            
            <div className="divide-y divide-gray-100">
                {players
                    .sort((a, b) => b.score - a.score) // Sort by score descending
                    .map((player, index) => (
                        <div
                            key={player.id}
                            className={`flex items-center gap-4 p-4 transition-all ${
                                player.isActive
                                    ? 'bg-amber-50 border-l-4 border-amber-400'
                                    : ''
                            } ${player.isCurrentUser ? 'bg-blue-50' : ''}`}
                        >
                            {/* Rank indicator */}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                index === 0 && players.length > 1
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-gray-100 text-gray-600'
                            }`}>
                                {index + 1}
                            </div>
                            
                            {/* Player info */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <UserAvatar
                                    email=""
                                    displayName={player.displayName}
                                    selectedIcon={player.selectedIcon}
                                    avatarBackground={player.avatarBackground}
                                    size="md"
                                />
                                <div className="flex flex-col min-w-0">
                                    <span className="font-medium text-gray-900 truncate">
                                        {player.displayName}
                                        {player.isCurrentUser && (
                                            <span className="ml-2 px-2 py-0.5 bg-blue-600 text-white text-xs font-semibold rounded-full">
                                                You
                                            </span>
                                        )}
                                    </span>
                                    {player.isActive && (
                                        <span className="text-xs text-amber-600 font-medium">
                                            Current turn
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            {/* Score */}
                            <div className={`text-2xl font-bold ${
                                player.score >= 0 ? 'text-gray-900' : 'text-red-600'
                            }`}>
                                {formatScore(player.score)}
                            </div>
                        </div>
                    ))}
            </div>
        </div>
    )
}

/**
 * Simple single-player score display for backward compatibility
 */
export function SimpleScore({ score, className = '' }: { score: number; className?: string }) {
    const formatScore = (s: number) => {
        const prefix = s < 0 ? '-$' : '$'
        return `${prefix}${Math.abs(s).toLocaleString()}`
    }

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <span className="text-sm font-medium text-gray-600">Score:</span>
            <span className={`text-xl font-bold ${score >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                {formatScore(score)}
            </span>
        </div>
    )
}

