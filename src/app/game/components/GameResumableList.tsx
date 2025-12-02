'use client'

import Link from 'next/link'

import type { ResumableGame } from '@/lib/resumable-games'

// Convert Date objects to strings for client component compatibility
// Also remove totalCount since it's not used by the component
export type ClientResumableGame = Omit<ResumableGame, 'createdAt' | 'updatedAt' | 'categories'> & {
    createdAt: string
    updatedAt: string
    categories: Array<{
        id: string
        name: string
        answeredCount: number
    }>
}

interface GameResumableListProps {
    games: ClientResumableGame[]
    loading: boolean
    onEndGame: (gameId: string) => void
}

const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'yesterday'
    return `${diffDays}d ago`
}

export default function GameResumableList({ games, loading, onEndGame }: GameResumableListProps) {
    if (loading) {
        return (
            <div className="card p-6 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent mb-2"></div>
                <p className="text-gray-500">Loading your games...</p>
            </div>
        )
    }

    if (games.length === 0) {
        return (
            <div className="card p-6 text-center bg-gray-50 border-dashed">
                <p className="text-gray-500">No games in progress. Start a new game below!</p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {games.map(game => {
                const MAX_VISIBLE_CATEGORIES = 3
                const visibleCategories = game.categories.slice(0, MAX_VISIBLE_CATEGORIES)
                const hiddenCount = game.categories.length - MAX_VISIBLE_CATEGORIES

                return (
                    <div
                        key={game.id}
                        className="card p-4 hover:shadow-md transition-shadow border border-gray-100"
                    >
                        {/* Top row: title + metadata on left, actions on right */}
                        <div className="flex items-start justify-between gap-4">
                            {/* Left: Game info */}
                            <div className="flex-1 min-w-0">
                                {/* Title row */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="font-semibold text-gray-900">
                                        {game.label}
                                    </h3>
                                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                                        {game.currentRound === 'SINGLE' ? 'Single' : 
                                         game.currentRound === 'DOUBLE' ? 'Double' : 
                                         'Final'}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                        {formatTimeAgo(game.updatedAt)}
                                    </span>
                                    {game.seed && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                navigator.clipboard.writeText(game.seed!)
                                                const btn = e.currentTarget
                                                const originalText = btn.textContent
                                                btn.textContent = 'Copied!'
                                                btn.classList.add('text-green-600', 'bg-green-50')
                                                btn.classList.remove('text-gray-400', 'bg-gray-50')
                                                setTimeout(() => {
                                                    btn.textContent = originalText
                                                    btn.classList.remove('text-green-600', 'bg-green-50')
                                                    btn.classList.add('text-gray-400', 'bg-gray-50')
                                                }, 1500)
                                            }}
                                            className="text-xs text-gray-400 hover:text-gray-600 font-mono bg-gray-50 px-1.5 py-0.5 rounded transition-colors"
                                            title="Click to copy seed and share with friends"
                                        >
                                            {game.seed}
                                        </button>
                                    )}
                                </div>

                                {/* Categories row */}
                                {game.categories.length > 0 && (
                                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                        {visibleCategories.map(cat => (
                                            <span
                                                key={cat.id}
                                                className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded whitespace-nowrap"
                                            >
                                                {cat.name}
                                            </span>
                                        ))}
                                        {hiddenCount > 0 && (
                                            <span className="text-xs text-gray-400">
                                                +{hiddenCount} more
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Right: Actions */}
                            <div className="flex items-center gap-3 flex-shrink-0">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onEndGame(game.id)
                                    }}
                                    className="text-xs text-gray-400 hover:text-red-500 focus:text-red-500 focus:outline-none transition-colors"
                                    title="End game"
                                >
                                    End
                                </button>
                                <Link
                                    href={`/game/${game.id}`}
                                    className="btn-primary px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                >
                                    Resume
                                </Link>
                            </div>
                        </div>

                        {/* Bottom row: Progress bar + stats */}
                        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
                            {/* Progress bar */}
                            <div className="flex-1">
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-blue-500 rounded-full transition-all"
                                        style={{ width: `${game.progress.percentComplete}%` }}
                                    />
                                </div>
                            </div>
                            {/* Stats inline */}
                            <div className="flex items-center gap-4 text-xs text-gray-500 flex-shrink-0">
                                <span>{game.progress.percentComplete}%</span>
                                <span>{game.progress.correctQuestions}/{game.progress.answeredQuestions} correct</span>
                                <span className={`font-medium ${game.currentScore >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                                    {game.currentScore < 0 ? '-' : ''}${Math.abs(game.currentScore).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

