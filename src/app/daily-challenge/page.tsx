'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/lib/auth'
import Link from 'next/link'
import UserAvatar from '@/components/UserAvatar'
import NextChallengeCallout from '@/app/components/NextChallengeCallout'

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
        userAnswerText?: string | null
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

// Calculate next challenge time (midnight UTC tomorrow)
function getNextChallengeTime(): string {
    const now = new Date()
    const tomorrow = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0, 0, 0, 0
    ))
    return tomorrow.toISOString()
}

export default function DailyChallengePage() {
    const router = useRouter()
    const { user, loading: authLoading } = useAuth()
    const [challenge, setChallenge] = useState<DailyChallenge | null>(null)
    const [loading, setLoading] = useState(true)
    const [userAnswer, setUserAnswer] = useState('')
    const [showAnswer, setShowAnswer] = useState(false)
    const [revealAnswer, setRevealAnswer] = useState(false)
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
    const [leaderboardLoading, setLeaderboardLoading] = useState(false)
    const [nextChallengeTime] = useState(() => getNextChallengeTime())
    const [disputeSubmitted, setDisputeSubmitted] = useState(false)
    const [disputeSubmitting, setDisputeSubmitting] = useState(false)
    const [revealMyAnswer, setRevealMyAnswer] = useState(false)
    const [storedUserAnswer, setStoredUserAnswer] = useState<string | null>(null)
    const [showBackToTop, setShowBackToTop] = useState(false)

    useEffect(() => {
        loadChallenge()
        loadLeaderboard()
    }, [])

    // Handle scroll to show/hide back to top button
    useEffect(() => {
        const handleScroll = () => {
            setShowBackToTop(window.scrollY > 400)
        }
        
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const loadChallenge = async () => {
        try {
            const response = await fetch('/api/daily-challenge')
            if (response.ok) {
                const data = await response.json()
                setChallenge(data)
                if (data.userAnswer) {
                    setShowAnswer(true)
                    setIsCorrect(data.userAnswer.correct)
                    // Store the user's previous answer text if available
                    if (data.userAnswer.userAnswerText) {
                        setStoredUserAnswer(data.userAnswer.userAnswerText)
                    }
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

    const handleDispute = async () => {
        const answerToDispute = userAnswer.trim() || storedUserAnswer
        if (!challenge || !answerToDispute || !user?.id || disputeSubmitted || disputeSubmitting) return

        setDisputeSubmitting(true)
        try {
            const response = await fetch('/api/answers/disputes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    questionId: challenge.question.id,
                    gameId: null,
                    mode: 'DAILY_CHALLENGE',
                    round: 'FINAL',
                    userAnswer: answerToDispute,
                    systemWasCorrect: false
                })
            })

            if (!response.ok) {
                const error = await response.json()
                console.error('Failed to submit dispute:', error.error)
                alert('Failed to submit dispute. Please try again.')
                return
            }

            setDisputeSubmitted(true)
        } catch (error) {
            console.error('Error submitting dispute:', error)
            alert('Failed to submit dispute. Please try again.')
        } finally {
            setDisputeSubmitting(false)
        }
    }

    // Skeleton loading state - maintains page structure
    if (loading) {
        return (
            <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen -mt-6 min-h-screen bg-gradient-to-b from-blue-900 to-blue-950 py-6 sm:py-10 px-4 sm:px-6 lg:px-8">
                {/* Shadow under navbar */}
                <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-black/20 to-transparent pointer-events-none"></div>
                <div className="max-w-7xl mx-auto">
                    {/* Hero Section Skeleton */}
                    <div className="text-center mb-6 sm:mb-10">
                        <div className="flex items-center justify-center mb-4 sm:mb-6">
                            <div className="px-4 sm:px-6 py-2 bg-amber-400/50 rounded-full h-8 w-32 animate-pulse"></div>
                        </div>
                        <div className="mb-4 sm:mb-6">
                            <div className="h-4 w-32 bg-blue-300/20 rounded mx-auto mb-2 sm:mb-4 animate-pulse"></div>
                            <div className="inline-block px-4 sm:px-8 md:px-10 py-3 sm:py-4 md:py-5 bg-white/10 rounded-xl border-2 border-white/20">
                                <div className="h-8 sm:h-10 md:h-12 w-48 sm:w-64 md:w-80 bg-white/20 rounded animate-pulse"></div>
                            </div>
                        </div>
                        <div className="h-4 w-40 bg-blue-200/20 rounded mx-auto animate-pulse"></div>
                    </div>

                    {/* Main Content Skeleton */}
                    <div className="flex flex-col items-center gap-5 sm:gap-8 lg:gap-10">
                        <div className="w-full max-w-4xl">
                            <div className="bg-blue-800 rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden relative">
                                <div className="absolute inset-0 opacity-10 bg-[url('/grid.svg')] pointer-events-none"></div>
                                <div className="relative p-5 sm:p-8 md:p-10 lg:p-12">
                                    {/* Question skeleton */}
                                    <div className="space-y-3 mb-6 sm:mb-8 md:mb-10">
                                        <div className="h-6 sm:h-8 bg-white/20 rounded w-full animate-pulse"></div>
                                        <div className="h-6 sm:h-8 bg-white/20 rounded w-5/6 mx-auto animate-pulse"></div>
                                        <div className="h-6 sm:h-8 bg-white/20 rounded w-4/6 mx-auto animate-pulse"></div>
                                    </div>
                                    
                                    {/* Input skeleton */}
                                    <div className="space-y-4 sm:space-y-5 max-w-2xl mx-auto">
                                        <div className="bg-white/10 rounded-lg sm:rounded-xl p-3 sm:p-5 border border-white/20">
                                            <div className="h-12 sm:h-14 bg-white/30 rounded-lg animate-pulse"></div>
                                        </div>
                                        <div className="h-12 sm:h-14 bg-amber-400/50 rounded-lg sm:rounded-xl animate-pulse"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Leaderboard Skeleton */}
                        <div className="w-full max-w-4xl">
                            <div className="bg-blue-800 rounded-xl sm:rounded-2xl shadow-2xl p-4 sm:p-6 md:p-8 relative overflow-hidden">
                                <div className="absolute inset-0 opacity-5 bg-[url('/grid.svg')] pointer-events-none"></div>
                                <div className="relative">
                                    <div className="flex items-center justify-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-400/20 rounded-full animate-pulse"></div>
                                        <div className="h-6 sm:h-8 w-48 bg-white/20 rounded animate-pulse"></div>
                                    </div>
                                    <div className="space-y-2 sm:space-y-3">
                                        {[1, 2, 3].map((i) => (
                                            <div key={i} className="h-14 sm:h-16 bg-white/10 rounded-lg sm:rounded-xl animate-pulse"></div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (!challenge) {
        return (
            <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen -mt-6 min-h-screen bg-gradient-to-b from-blue-900 to-blue-950 flex items-center justify-center px-4 sm:px-6 lg:px-8">
                {/* Shadow under navbar */}
                <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-black/20 to-transparent pointer-events-none"></div>
                <div className="bg-blue-800 rounded-2xl shadow-2xl p-8 max-w-md text-center">
                    <h1 className="text-2xl font-bold text-white mb-4">No Challenge Available</h1>
                    <p className="text-blue-200 mb-6">Today&apos;s daily challenge is not available yet.</p>
                    <Link href="/" className="btn-primary">
                        Back to Home
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen -mt-6 min-h-screen bg-gradient-to-b from-blue-900 to-blue-950 py-6 sm:py-10 px-4 sm:px-6 lg:px-8">
            {/* Shadow under navbar */}
            <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-black/20 to-transparent pointer-events-none"></div>
            <div className="max-w-7xl mx-auto">
                {/* Hero Section with Category */}
                <div className="text-center mb-6 sm:mb-10">
                    {/* Daily Challenge Badge */}
                    <div className="flex items-center justify-center mb-4 sm:mb-6">
                        <div className="px-4 sm:px-6 py-2 bg-amber-400 rounded-full shadow-lg">
                            <span className="text-blue-900 font-bold text-xs sm:text-sm md:text-base tracking-wider uppercase">
                                Daily Challenge
                            </span>
                        </div>
                    </div>
                    
                    {/* Final Jeopardy Style Category */}
                    <div className="mb-4 sm:mb-6">
                        <p className="text-blue-300 text-xs sm:text-sm uppercase tracking-widest mb-2 sm:mb-4">Today&apos;s Category Is</p>
                        <div className="inline-block px-4 sm:px-8 md:px-10 py-3 sm:py-4 md:py-5 bg-white/10 backdrop-blur-sm rounded-xl border-2 border-white/20 shadow-lg max-w-[calc(100%-2rem)] sm:max-w-none">
                            <h1 className="text-white text-xl sm:text-3xl md:text-4xl lg:text-5xl font-bold uppercase tracking-wide leading-tight break-words">
                                {challenge.question.category}
                            </h1>
                        </div>
                    </div>
                    
                    {challenge.question.airDate && (
                        <p className="text-blue-200 text-xs sm:text-sm mt-3 sm:mt-5">
                            Originally aired: {new Date(challenge.question.airDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </p>
                    )}
                </div>

                {/* Main Content - Stacked Centered Layout */}
                <div className="flex flex-col items-center gap-5 sm:gap-8 lg:gap-10">
                    {/* Question Card - Centered */}
                    <div className="w-full max-w-4xl">
                        <div className="bg-blue-800 rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden relative">
                            {/* Subtle pattern overlay */}
                            <div className="absolute inset-0 opacity-10 bg-[url('/grid.svg')] pointer-events-none"></div>
                            
                            <div className="relative p-5 sm:p-8 md:p-10 lg:p-12">
                                <h2 className="text-white text-lg sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-6 sm:mb-8 md:mb-10 leading-relaxed text-center">
                                    {challenge.question.question}
                                </h2>

                                {!showAnswer ? (
                                    <div className="space-y-4 sm:space-y-5 max-w-2xl mx-auto">
                                        <div className="bg-white/10 backdrop-blur-sm rounded-lg sm:rounded-xl p-3 sm:p-5 border border-white/20">
                                            <input
                                                type="text"
                                                value={userAnswer}
                                                onChange={(e) => setUserAnswer(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && userAnswer.trim() && !submitting) {
                                                        handleSubmit()
                                                    }
                                                }}
                                                className="w-full px-4 sm:px-5 py-3 sm:py-4 bg-white rounded-lg text-base sm:text-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 border-2 border-transparent"
                                                placeholder="What is..."
                                                autoFocus
                                            />
                                        </div>
                                        <button
                                            onClick={handleSubmit}
                                            disabled={!userAnswer.trim() || submitting}
                                            className={`w-full py-3 sm:py-4 rounded-lg sm:rounded-xl font-bold text-base sm:text-lg transition-all ${
                                                !userAnswer.trim() || submitting
                                                    ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                                                    : 'bg-amber-400 text-blue-900 hover:bg-amber-500 shadow-lg hover:shadow-xl'
                                            }`}
                                        >
                                            {submitting ? (
                                                <span className="flex items-center justify-center gap-2">
                                                    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-solid border-blue-900 border-r-transparent"></span>
                                                    Submitting...
                                                </span>
                                            ) : (
                                                'Submit Answer'
                                            )}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-4 sm:space-y-6 max-w-3xl mx-auto">
                                        {/* Result Feedback */}
                                        <div className={`p-4 sm:p-6 md:p-8 rounded-lg sm:rounded-xl text-center ${
                                            isCorrect 
                                                ? 'bg-green-500/20 border border-green-400/30' 
                                                : 'bg-red-500/20 border border-red-400/30'
                                        }`}>
                                            <div className="flex items-center justify-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                                                {isCorrect ? (
                                                    <svg className="w-6 h-6 sm:w-8 sm:h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                ) : (
                                                    <svg className="w-6 h-6 sm:w-8 sm:h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                )}
                                                <span className={`text-xl sm:text-2xl font-bold ${
                                                    isCorrect ? 'text-green-300' : 'text-red-300'
                                                }`}>
                                                    {isCorrect ? 'Correct!' : 'Incorrect'}
                                                </span>
                                            </div>
                                            
                                            {revealAnswer ? (
                                                <div className="mt-4 sm:mt-6 md:mt-8 p-4 sm:p-6 bg-white/10 backdrop-blur-sm rounded-lg sm:rounded-xl border border-white/20">
                                                    <p className="text-white text-lg sm:text-xl md:text-2xl font-medium text-center leading-relaxed">
                                                        {challenge.question.answer}
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="text-center mt-4 sm:mt-6">
                                                    <button
                                                        onClick={() => setRevealAnswer(true)}
                                                        className="inline-flex items-center gap-2 px-5 sm:px-8 py-3 sm:py-4 bg-amber-400 text-blue-900 rounded-lg sm:rounded-xl hover:bg-amber-500 transition-colors font-bold shadow-lg text-base sm:text-lg"
                                                    >
                                                        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                        Reveal Answer
                                                    </button>
                                                </div>
                                            )}
                                            
                                            {/* Dispute and Show My Answer - Secondary Actions */}
                                            <div className="mt-4 sm:mt-6 space-y-3">
                                                {!isCorrect && revealAnswer && user?.id && (userAnswer.trim() || storedUserAnswer) && (
                                                    <div className="flex justify-end">
                                                        {disputeSubmitted ? (
                                                            <span className="text-sm text-blue-300 flex items-center gap-1">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                                Dispute submitted
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1">
                                                                <button
                                                                    onClick={handleDispute}
                                                                    disabled={disputeSubmitting}
                                                                    className="text-sm text-blue-300 hover:text-blue-100 underline disabled:opacity-50"
                                                                >
                                                                    {disputeSubmitting ? 'Submitting...' : 'Dispute this answer'}
                                                                </button>
                                                                <span className="relative group">
                                                                    <span className="w-4 h-4 inline-flex items-center justify-center text-xs text-blue-200 hover:text-blue-100 cursor-help border border-blue-300/50 rounded-full">i</span>
                                                                    <span className="absolute bottom-full right-0 mb-2 px-3 py-2 text-xs text-white bg-gray-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                                                        An admin will review your answer.<br/>If approved, you&apos;ll be retroactively credited.
                                                                    </span>
                                                                </span>
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                
                                                {/* Show My Answer toggle for incorrect responses */}
                                                {!isCorrect && (userAnswer.trim() || storedUserAnswer) && (
                                                    <div>
                                                        <button
                                                            onClick={() => setRevealMyAnswer(!revealMyAnswer)}
                                                            className="text-amber-300 hover:text-amber-200 text-sm font-medium flex items-center gap-1"
                                                        >
                                                            {revealMyAnswer ? (
                                                                <>
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                                    </svg>
                                                                    Hide My Answer
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                                    </svg>
                                                                    Show My Answer
                                                                </>
                                                            )}
                                                        </button>
                                                        
                                                        {revealMyAnswer && (
                                                            <div className="mt-2 p-3 bg-amber-500/20 rounded-lg border border-amber-400/30">
                                                                <p className="text-xs text-amber-200 font-semibold mb-1">Your answer:</p>
                                                                <p className="text-white italic">{userAnswer.trim() || storedUserAnswer}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {/* Next Challenge Countdown */}
                                        <div className="pt-4">
                                            <NextChallengeCallout nextChallengeTime={nextChallengeTime} />
                                        </div>
                                        
                                        {/* Guest leaderboard message - only show when auth is done loading and user is not signed in */}
                                        {!authLoading && !user && showAnswer && (
                                            <div className="bg-amber-500/20 border border-amber-400/30 rounded-lg sm:rounded-xl p-4 sm:p-6">
                                                <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                                                    <svg className="w-6 h-6 sm:w-7 sm:h-7 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <div className="flex-1 w-full">
                                                        <h3 className="text-lg sm:text-xl font-bold text-amber-300 mb-2 sm:mb-3">Sign In to Appear on Leaderboard</h3>
                                                        <p className="text-blue-200 mb-4 sm:mb-5 leading-relaxed text-sm sm:text-base">
                                                            Your answer has been graded, but you won&apos;t appear on the leaderboard until you sign in.
                                                        </p>
                                                        <div className="flex gap-2 sm:gap-3">
                                                            <Link href="/sign-up" className="btn-primary flex-1 text-center text-sm sm:text-base py-2 sm:py-2.5">
                                                                Sign Up
                                                            </Link>
                                                            <Link href="/sign-in" className="btn-secondary flex-1 text-center text-sm sm:text-base py-2 sm:py-2.5">
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
                        </div>
                    </div>
                    
                    {/* Leaderboard - Centered Below Question */}
                    <div className="w-full max-w-4xl">
                        <div className="bg-blue-800 rounded-xl sm:rounded-2xl shadow-2xl p-4 sm:p-6 md:p-8 relative overflow-hidden">
                            {/* Subtle pattern overlay */}
                            <div className="absolute inset-0 opacity-5 bg-[url('/grid.svg')] pointer-events-none"></div>
                            
                            <div className="relative">
                                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-4 sm:mb-6 flex items-center justify-center gap-2 sm:gap-3">
                                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-400/20 rounded-full flex items-center justify-center border border-amber-400/30">
                                        <svg className="w-4 h-4 sm:w-6 sm:h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                                        </svg>
                                    </div>
                                    <span>Today&apos;s Leaderboard</span>
                                </h2>
                                {leaderboardLoading ? (
                                    <div className="text-center py-8 sm:py-12">
                                        <div className="inline-block h-8 w-8 sm:h-10 sm:w-10 animate-spin rounded-full border-4 border-solid border-amber-400 border-r-transparent"></div>
                                    </div>
                                ) : leaderboard.length === 0 ? (
                                    <div className="text-center py-8 sm:py-12">
                                        <p className="text-blue-200 text-base sm:text-lg">No one has completed today&apos;s challenge yet.</p>
                                        <p className="text-blue-300 text-sm mt-2">Be the first!</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2 sm:space-y-3">
                                        {leaderboard.map((entry) => (
                                            <div
                                                key={entry.userId}
                                                className={`flex items-center justify-between p-3 sm:p-4 rounded-lg sm:rounded-xl transition-all ${
                                                    entry.correct 
                                                        ? 'bg-green-500/20 border border-green-400/40 sm:border-2 hover:bg-green-500/25' 
                                                        : 'bg-white/10 border border-white/20 sm:border-2 hover:bg-white/15'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                                    <span className={`text-base sm:text-lg md:text-xl font-bold flex-shrink-0 w-8 sm:w-10 text-center ${
                                                        entry.rank === 1 ? 'text-amber-400' : entry.rank === 2 ? 'text-blue-300' : entry.rank === 3 ? 'text-amber-300' : 'text-white/70'
                                                    }`}>
                                                        #{entry.rank}
                                                    </span>
                                                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                                        <div className="hidden xs:block">
                                                            <UserAvatar
                                                                email=""
                                                                displayName={entry.displayName}
                                                                selectedIcon={entry.selectedIcon}
                                                                avatarBackground={entry.avatarBackground}
                                                                size="sm"
                                                            />
                                                        </div>
                                                        <span className="font-semibold text-white text-sm sm:text-base truncate">
                                                            {entry.displayName}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
                                                    {entry.correct ? (
                                                        <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-green-500/40 text-green-200 rounded-full text-xs sm:text-sm font-bold border border-green-400/50">
                                                            <span className="hidden sm:inline">✓ </span>Correct
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 sm:px-3 py-1 sm:py-1.5 bg-red-500/40 text-red-200 rounded-full text-xs sm:text-sm font-bold border border-red-400/50">
                                                            <span className="hidden sm:inline">✗ </span>Wrong
                                                        </span>
                                                    )}
                                                    <span className="text-xs sm:text-sm text-blue-200 whitespace-nowrap font-medium hidden sm:inline">
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
                        </div>
                    </div>
                </div>

                {/* Back to Top Button */}
                {showBackToTop && (
                    <button
                        onClick={scrollToTop}
                        className="fixed bottom-4 right-4 md:bottom-8 md:right-8 bg-amber-400 hover:bg-amber-500 text-blue-900 p-3 md:p-4 rounded-full shadow-2xl ring-2 md:ring-4 ring-white/50 transition-all duration-300 z-50 flex items-center justify-center hover:scale-110"
                        aria-label="Back to top"
                    >
                        <svg 
                            className="w-5 h-5 md:w-6 md:h-6" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                        >
                            <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth={2.5} 
                                d="M5 10l7-7m0 0l7 7m-7-7v18" 
                            />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    )
}

