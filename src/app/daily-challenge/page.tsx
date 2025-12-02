'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/lib/auth'
import { checkAnswer } from '@/app/lib/answer-checker'
import Link from 'next/link'
import UserAvatar from '@/components/UserAvatar'

interface DailyChallenge {
    id: string
    date: string
    question: {
        id: string
        question: string
        answer: string
        category: string
        airDate: string | null
    }
    userAnswer: {
        correct: boolean
        completedAt: string
    } | null
}

interface LeaderboardEntry {
    rank: number
    userId: string
    displayName: string
    selectedIcon: string | null
    avatarBackground: string | null
    correct: boolean
    completedAt: string
}

export default function DailyChallengePage() {
    const router = useRouter()
    const { user } = useAuth()
    const [challenge, setChallenge] = useState<DailyChallenge | null>(null)
    const [loading, setLoading] = useState(true)
    const [userAnswer, setUserAnswer] = useState('')
    const [showAnswer, setShowAnswer] = useState(false)
    const [revealAnswer, setRevealAnswer] = useState(false)
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
    const [leaderboardLoading, setLeaderboardLoading] = useState(false)

    useEffect(() => {
        loadChallenge()
        loadLeaderboard()
    }, [])

    const loadChallenge = async () => {
        try {
            const response = await fetch('/api/daily-challenge')
            if (response.ok) {
                const data = await response.json()
                setChallenge(data)
                if (data.userAnswer) {
                    setShowAnswer(true)
                    setIsCorrect(data.userAnswer.correct)
                    // If incorrect, don't auto-reveal answer (user needs to click button)
                    if (data.userAnswer.correct) {
                        setRevealAnswer(true)
                    }
                }
            }
        } catch (error) {
            console.error('Error loading challenge:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadLeaderboard = async () => {
        setLeaderboardLoading(true)
        try {
            const response = await fetch('/api/daily-challenge/leaderboard')
            if (response.ok) {
                const data = await response.json()
                setLeaderboard(data.leaderboard || [])
            }
        } catch (error) {
            console.error('Error loading leaderboard:', error)
        } finally {
            setLeaderboardLoading(false)
        }
    }

    const handleSubmit = async () => {
        if (!challenge || !userAnswer.trim()) return

        setSubmitting(true)
        try {
            const response = await fetch('/api/daily-challenge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ answer: userAnswer })
            })

            if (!response.ok) {
                const error = await response.json()
                if (error.requiresAuth) {
                    // Guest participation disabled - redirect to sign in
                    router.push('/sign-in')
                    return
                }
                throw new Error(error.error || 'Failed to submit answer')
            }

            const data = await response.json()
            setIsCorrect(data.correct)
            setShowAnswer(true)
            // Auto-reveal answer if correct, otherwise require button click
            if (data.correct) {
                setRevealAnswer(true)
            }
            
            // If guest submission, store session ID for claim
            if (!user && data.guestSessionId) {
                localStorage.setItem('trivrdy_pendingGuestSessionId', data.guestSessionId)
                localStorage.setItem('trivrdy_pendingGuestSessionType', 'DAILY_CHALLENGE')
            }
            
            // Only refresh leaderboard for authenticated users
            if (user) {
                loadLeaderboard()
            }
        } catch (error) {
            console.error('Error submitting answer:', error)
            alert('Failed to submit answer. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center px-4">
                <div className="text-center max-w-md">
                    <div className="inline-block h-16 w-16 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent mb-6"></div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Loading Daily Challenge</h2>
                    <p className="text-gray-600 text-lg">Preparing today's Final Jeopardy question...</p>
                </div>
            </div>
        )
    }

    if (!challenge) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="card p-8 max-w-md text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">No Challenge Available</h1>
                    <p className="text-gray-600 mb-6">Today's daily challenge is not available yet.</p>
                    <Link href="/" className="btn-primary">
                        Back to Home
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-8 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">Daily Challenge</h1>
                    <p className="text-gray-600">
                        A Final Jeopardy question from historical games
                    </p>
                </div>

                {/* Challenge Card */}
                <div className="card p-8 mb-8">
                    <div className="mb-6">
                        <span className="inline-block px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mb-4">
                            {challenge.question.category}
                        </span>
                        {challenge.question.airDate && (
                            <p className="text-sm text-gray-500">
                                Originally aired: {new Date(challenge.question.airDate).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </p>
                        )}
                    </div>

                    <h2 className="text-2xl font-bold text-gray-900 mb-6 leading-relaxed">
                        {challenge.question.question}
                    </h2>

                    {!showAnswer ? (
                        <div className="space-y-4">
                            {!user ? (
                                <div className="space-y-4">
                                    <input
                                        type="text"
                                        value={userAnswer}
                                        onChange={(e) => setUserAnswer(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && userAnswer.trim() && !submitting) {
                                                handleSubmit()
                                            }
                                        }}
                                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="What is..."
                                        autoFocus
                                    />
                                    <button
                                        onClick={handleSubmit}
                                        disabled={!userAnswer.trim() || submitting}
                                        className={`w-full py-3 rounded-lg font-bold text-lg transition-all ${
                                            !userAnswer.trim() || submitting
                                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                : 'bg-blue-600 text-white hover:bg-blue-700'
                                        }`}
                                    >
                                        {submitting ? 'Submitting...' : 'Submit Answer'}
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <input
                                        type="text"
                                        value={userAnswer}
                                        onChange={(e) => setUserAnswer(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && userAnswer.trim() && !submitting) {
                                                handleSubmit()
                                            }
                                        }}
                                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="What is..."
                                        autoFocus
                                    />
                                    <button
                                        onClick={handleSubmit}
                                        disabled={!userAnswer.trim() || submitting}
                                        className={`w-full py-3 rounded-lg font-bold text-lg transition-all ${
                                            !userAnswer.trim() || submitting
                                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                : 'bg-blue-600 text-white hover:bg-blue-700'
                                        }`}
                                    >
                                        {submitting ? 'Submitting...' : 'Submit Answer'}
                                    </button>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className={`p-6 rounded-xl ${
                                isCorrect ? 'bg-green-50 border-2 border-green-200' : 'bg-red-50 border-2 border-red-200'
                            }`}>
                                <div className="flex items-center justify-center gap-3 mb-4">
                                    {isCorrect ? (
                                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    ) : (
                                        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    )}
                                    <span className={`text-2xl font-bold ${
                                        isCorrect ? 'text-green-700' : 'text-red-700'
                                    }`}>
                                        {isCorrect ? 'Correct!' : 'Incorrect'}
                                    </span>
                                </div>
                                
                                {revealAnswer ? (
                                    <div className="mt-4 p-4 bg-white rounded-lg border-2 border-gray-200">
                                        <p className="text-xl font-medium text-center text-gray-800">
                                            {challenge.question.answer}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <button
                                            onClick={() => setRevealAnswer(true)}
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                            Reveal Answer
                                        </button>
                                    </div>
                                )}
                            </div>
                            
                            {/* Guest leaderboard message */}
                            {!user && showAnswer && (
                                <div className="mt-6 bg-amber-50 border-2 border-amber-200 rounded-lg p-6">
                                    <div className="flex items-start gap-3">
                                        <svg className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <div className="flex-1">
                                            <h3 className="text-lg font-bold text-amber-900 mb-2">Sign In to Appear on Leaderboard</h3>
                                            <p className="text-amber-800 mb-4">
                                                Your answer has been graded, but you won't appear on the leaderboard until you sign in. Sign in now to save your result and see how you rank!
                                            </p>
                                            <div className="flex gap-3">
                                                <Link href="/sign-up" className="btn-primary flex-1">
                                                    Sign Up
                                                </Link>
                                                <Link href="/sign-in" className="btn-secondary flex-1">
                                                    Sign In
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Leaderboard */}
                <div className="card p-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Today's Leaderboard</h2>
                    {leaderboardLoading ? (
                        <div className="text-center py-8">
                            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                        </div>
                    ) : leaderboard.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">No one has completed today's challenge yet. Be the first!</p>
                    ) : (
                        <div className="space-y-2">
                            {leaderboard.map((entry) => (
                                <div
                                    key={entry.userId}
                                    className={`flex items-center justify-between p-4 rounded-lg ${
                                        entry.correct ? 'bg-green-50' : 'bg-gray-50'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-lg font-bold text-gray-600 w-8">
                                            #{entry.rank}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <UserAvatar
                                                email=""
                                                displayName={entry.displayName}
                                                selectedIcon={entry.selectedIcon}
                                                avatarBackground={entry.avatarBackground}
                                                size="sm"
                                            />
                                            <span className="font-medium text-gray-900">
                                                {entry.displayName}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {entry.correct ? (
                                            <span className="px-3 py-1 bg-green-200 text-green-800 rounded-full text-sm font-medium">
                                                ✓ Correct
                                            </span>
                                        ) : (
                                            <span className="px-3 py-1 bg-red-200 text-red-800 rounded-full text-sm font-medium">
                                                ✗ Incorrect
                                            </span>
                                        )}
                                        <span className="text-sm text-gray-500">
                                            {new Date(entry.completedAt).toLocaleTimeString('en-US', {
                                                hour: 'numeric',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Back Button */}
                <div className="mt-8 text-center">
                    <Link href="/" className="btn-secondary">
                        Back to Home
                    </Link>
                </div>
            </div>
        </div>
    )
}

