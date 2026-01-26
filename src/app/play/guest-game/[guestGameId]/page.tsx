'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/app/lib/auth'
import Link from 'next/link'

interface GuestGameState {
    id: string
    guestSessionId: string
    seed: string | null
    status: string
    currentRound: string
    currentScore: number
    config: Record<string, unknown>
    answeredCount: number
    limitReached: boolean
    requiresAuth: boolean
    expiresAt: string
}

export default function GuestGamePage() {
    const router = useRouter()
    const params = useParams()
    const guestGameId = params?.guestGameId as string
    const { user, signIn, loading: authLoading } = useAuth()
    const [gameState, setGameState] = useState<GuestGameState | null>(null)
    const [loading, setLoading] = useState(true)
    const [question, setQuestion] = useState<{ id: string; question: string; answer: string; value: number; categoryId: string; category: { id: string; name: string } } | null>(null)
    const [userAnswer, setUserAnswer] = useState('')
    const [showResult, setShowResult] = useState(false)
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [checkingAuth, setCheckingAuth] = useState(true)

    // Check if user is authenticated and has pending session - show loading until redirect
    useEffect(() => {
        if (authLoading) return
        
        if (user) {
            // User is authenticated - check for pending session
            const pendingSessionId = localStorage.getItem('trivrdy_pendingGuestSessionId')
            if (pendingSessionId) {
                // Session will be claimed by GuestSessionClaimer and redirect will happen
                // Keep showing loading state to prevent flash of guest page
                setCheckingAuth(true)
                return
            }
            // No pending session but user is authenticated - redirect to games
            router.replace('/')
            return
        }
        
        setCheckingAuth(false)
    }, [user, authLoading, router])

    const loadGameState = async () => {
        try {
            const response = await fetch(`/api/games/guest/${guestGameId}/state`)
            if (!response.ok) {
                const error = await response.json()
                if (error.requiresAuth) {
                    setError('Guest session expired. Please sign in to continue.')
                } else {
                    setError(error.error || 'Failed to load game')
                }
                return
            }
            const data = await response.json()
            setGameState(data)
            
            // If limit not reached, load a question
            if (!data.limitReached) {
                loadQuestion()
            }
        } catch (error) {
            console.error('Error loading game state:', error)
            setError('Failed to load game')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (checkingAuth || authLoading || !guestGameId) return
        loadGameState()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [checkingAuth, authLoading, guestGameId])

    const loadQuestion = async () => {
        try {
            // Get a random question for the guest
            const response = await fetch('/api/practice/guest-question')
            if (response.ok) {
                const data = await response.json()
                setQuestion(data)
            }
        } catch (error) {
            console.error('Error loading question:', error)
        }
    }

    const handleSubmit = async () => {
        if (!question || !userAnswer.trim() || !gameState) return

        setSubmitting(true)
        try {
            const response = await fetch(`/api/games/guest/${guestGameId}/answer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    questionId: question.id,
                    answer: userAnswer
                })
            })

            if (!response.ok) {
                const error = await response.json()
                if (error.requiresAuth) {
                    setGameState({ ...gameState, limitReached: true, requiresAuth: true })
                } else {
                    throw new Error(error.error || 'Failed to submit answer')
                }
                return
            }

            const data = await response.json()
            setIsCorrect(data.correct)
            setShowResult(true)
            
            // Update game state
            setGameState({
                ...gameState,
                currentScore: data.currentScore,
                limitReached: data.limitReached || false,
                requiresAuth: data.requiresAuth || false
            })

            // Store session ID for claim (store after first answer so it's available if user navigates away)
            if (gameState.guestSessionId) {
                localStorage.setItem('trivrdy_pendingGuestSessionId', gameState.guestSessionId)
                localStorage.setItem('trivrdy_pendingGuestSessionType', 'RANDOM_GAME')
            }
        } catch (error) {
            console.error('Error submitting answer:', error)
            alert('Failed to submit answer. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    const handleSignUp = () => {
        if (gameState?.guestSessionId) {
            localStorage.setItem('trivrdy_pendingGuestSessionId', gameState.guestSessionId)
            localStorage.setItem('trivrdy_pendingGuestSessionType', 'RANDOM_GAME')
        }
        router.push('/sign-up')
    }

    const handleSignIn = () => {
        if (gameState?.guestSessionId) {
            localStorage.setItem('trivrdy_pendingGuestSessionId', gameState.guestSessionId)
            localStorage.setItem('trivrdy_pendingGuestSessionType', 'RANDOM_GAME')
        }
        signIn()
    }

    if (checkingAuth || authLoading || loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex items-center justify-center px-4">
                <div className="text-center max-w-md">
                    <div className="inline-block h-16 w-16 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent mb-6"></div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        {checkingAuth || authLoading ? 'Signing you in...' : 'Loading Game'}
                    </h2>
                    <p className="text-gray-600 text-lg">
                        {checkingAuth || authLoading ? 'Saving your progress...' : 'Preparing your game...'}
                    </p>
                </div>
            </div>
        )
    }

    if (error || !gameState) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="card p-8 max-w-md text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">Game Not Available</h1>
                    <p className="text-gray-600 mb-6">{error || 'Unable to load game'}</p>
                    <Link href="/" className="btn-primary">
                        Back to Home
                    </Link>
                </div>
            </div>
        )
    }

    if (gameState.limitReached && !showResult) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white py-8 px-4">
                <div className="max-w-4xl mx-auto">
                    <div className="card p-8 text-center">
                        <h1 className="text-3xl font-bold text-gray-900 mb-4">Guest Limit Reached</h1>
                        <p className="text-gray-600 mb-6 text-lg">
                            You&apos;ve reached the guest limit. Sign in to continue playing and save your progress!
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button onClick={handleSignUp} className="btn-primary">
                                Sign Up
                            </button>
                            <button onClick={handleSignIn} className="btn-secondary">
                                Sign In
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white py-8 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">Random Jeopardy Game</h1>
                    <p className="text-gray-600">
                        Score: <span className={`font-bold ${gameState.currentScore >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${gameState.currentScore.toLocaleString()}
                        </span>
                    </p>
                </div>

                {/* Question Card */}
                {question && (
                    <div className="card p-8 mb-8">
                        <div className="mb-6">
                            <span className="inline-block px-4 py-2 bg-purple-100 text-purple-800 rounded-full text-sm font-medium mb-4">
                                {question.category.name}
                            </span>
                            <p className="text-sm text-gray-500">
                                Value: ${question.value.toLocaleString()}
                            </p>
                        </div>

                        <h2 className="text-2xl font-bold text-gray-900 mb-6 leading-relaxed">
                            {question.question}
                        </h2>

                        {!showResult ? (
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
                                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-lg text-gray-900 bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                    placeholder="What is..."
                                    autoFocus
                                />
                                <button
                                    onClick={handleSubmit}
                                    disabled={!userAnswer.trim() || submitting}
                                    className={`w-full py-3 rounded-lg font-bold text-lg transition-all ${
                                        !userAnswer.trim() || submitting
                                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                            : 'bg-purple-600 text-white hover:bg-purple-700'
                                    }`}
                                >
                                    {submitting ? 'Submitting...' : 'Submit Answer'}
                                </button>
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
                                    
                                    <div className="mt-4 p-4 bg-white rounded-lg border-2 border-gray-200">
                                        <p className="text-xl font-medium text-center text-gray-800">
                                            {question.answer}
                                        </p>
                                    </div>
                                </div>

                                {/* Sign up CTA */}
                                {gameState.limitReached && (
                                    <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
                                        <h3 className="text-xl font-bold text-gray-900 mb-2">Save Your Game</h3>
                                        <p className="text-gray-700 mb-4">
                                            Sign in to save this game to your stats and continue playing with unlimited questions!
                                        </p>
                                        <div className="flex gap-3">
                                            <button onClick={handleSignUp} className="btn-primary flex-1">
                                                Sign Up to Save
                                            </button>
                                            <button onClick={handleSignIn} className="btn-secondary flex-1">
                                                Sign In
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

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

