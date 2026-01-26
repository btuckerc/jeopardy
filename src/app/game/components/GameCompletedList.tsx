'use client'

import Link from 'next/link'
import type { ClientResumableGame } from './GameResumableList'

interface GameCompletedListProps {
    games: ClientResumableGame[]
    loading: boolean
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
    if (diffDays < 30) return `${diffDays}d ago`
    return date.toLocaleDateString()
}

export default function GameCompletedList({ games, loading }: GameCompletedListProps) {
    if (loading) {
        return (
            <div className="w-full card p-6 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent mb-2"></div>
                <p className="text-gray-500">Loading completed games...</p>
            </div>
        )
    }

    if (games.length === 0) {
        return (
            <div className="w-full card p-6 text-center bg-gray-50 border-dashed">
                <p className="text-gray-500">No completed games yet. Finish a game to see it here!</p>
            </div>
        )
    }

    return (
        <div className="w-full space-y-3">
            {games.map(game => {
                const MAX_VISIBLE_CATEGORIES = 3
                const visibleCategories = game.categories.slice(0, MAX_VISIBLE_CATEGORIES)
                const hiddenCount = game.categories.length - MAX_VISIBLE_CATEGORIES
                const accuracy = game.progress.answeredQuestions > 0
                    ? Math.round((game.progress.correctQuestions / game.progress.answeredQuestions) * 100)
                    : 0

                return (
                    <div
                        key={game.id}
                        className="w-full card p-4 hover:shadow-md transition-shadow border border-gray-100 overflow-hidden"
                    >
                        {/* Top row: title + metadata on left, actions on right */}
                        <div className="flex items-start justify-between gap-4">
                            {/* Left: Game info - min-w-0 allows flex child to shrink below content size */}
                            <div className="flex-1 min-w-0 overflow-hidden">
                                {/* Title row */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="font-semibold text-gray-900">
                                        {game.label}
                                    </h3>
                                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                                        Completed
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
                                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap overflow-hidden">
                                        {visibleCategories.map(cat => (
                                            <span
                                                key={cat.id}
                                                className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded truncate max-w-[150px]"
                                                title={cat.name}
                                            >
                                                {cat.name}
                                            </span>
                                        ))}
                                        {hiddenCount > 0 && (
                                            <span className="text-xs text-gray-400 flex-shrink-0">
                                                +{hiddenCount} more
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Right: View button */}
                            <div className="flex items-center gap-3 flex-shrink-0">
                                <Link
                                    href={`/game/${game.id}`}
                                    className="btn-secondary px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                >
                                    Review
                                </Link>
                            </div>
                        </div>

                        {/* Bottom row: Stats */}
                        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
                            {/* Progress bar (full) */}
                            <div className="flex-1">
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-green-500 rounded-full"
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            </div>
                            {/* Stats inline */}
                            <div className="flex items-center gap-4 text-xs text-gray-500 flex-shrink-0">
                                <span>{accuracy}% accuracy</span>
                                <span>{game.progress.correctQuestions}/{game.progress.answeredQuestions} correct</span>
                                <span className={`font-medium ${game.currentScore >= 0 ? 'text-green-600' : 'text-red-500'}`}>
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
