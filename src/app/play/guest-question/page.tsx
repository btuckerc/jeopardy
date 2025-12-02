'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/lib/auth'
import { checkAnswer } from '@/app/lib/answer-checker'
import Link from 'next/link'

interface Question {
    id: string
    question: string
    answer: string
    value: number
    category: string
    originalCategory: string
    knowledgeCategory: string
}

export default function GuestQuestionPage() {
    const router = useRouter()
    const { user, signIn, loading: authLoading } = useAuth()
    const [question, setQuestion] = useState<Question | null>(null)
    const [loading, setLoading] = useState(true)
    const [userAnswer, setUserAnswer] = useState('')
    const [showResult, setShowResult] = useState(false)
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [guestSessionId, setGuestSessionId] = useState<string | null>(null)
    const [limitReached, setLimitReached] = useState(false)
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
            // No pending session but user is authenticated - redirect to practice
            router.replace('/')
            return
        }
        
        setCheckingAuth(false)
    }, [user, authLoading, router])

    useEffect(() => {
        if (checkingAuth || authLoading) return
        loadQuestion()
    }, [checkingAuth, authLoading])

    const loadQuestion = async () => {
        try {
            const response = await fetch('/api/practice/guest-question')
            if (response.ok) {
                const data = await response.json()
                setQuestion(data)
            } else {
                alert('Failed to load question. Please try again.')
            }
        } catch (error) {
            console.error('Error loading question:', error)
            alert('Failed to load question. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async () => {
        if (!question || !userAnswer.trim()) return

        setSubmitting(true)
        try {
            // Check answer locally
            const correct = checkAnswer(userAnswer, question.answer)
            const points = correct ? question.value : -question.value

            // Submit to backend
            const response = await fetch('/api/practice/guest-question/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...(guestSessionId && { guestSessionId }),
                    questionId: question.id,
                    correct,
                    points,
                    rawAnswer: userAnswer
                })
            })

            if (!response.ok) {
                let error
                try {
                    error = await response.json()
                } catch {
                    throw new Error('Failed to submit answer')
                }
                
                if (error.requiresAuth) {
                    setLimitReached(true)
                    // Still show the result even if limit is reached
                    setIsCorrect(correct)
                    setShowResult(true)
                    return
                } else {
                    throw new Error(error.error || 'Failed to submit answer')
                }
            }
            
            const data = await response.json()
            setIsCorrect(correct)
            setShowResult(true)
            setLimitReached(data.limitReached || false)
            if (data.guestSessionId) {
                setGuestSessionId(data.guestSessionId)
                // Store in localStorage for claim after sign-in
                localStorage.setItem('trivrdy_pendingGuestSessionId', data.guestSessionId)
                localStorage.setItem('trivrdy_pendingGuestSessionType', 'RANDOM_QUESTION')
            }
        } catch (error) {
            console.error('Error submitting answer:', error)
            alert('Failed to submit answer. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    const handleSignUp = () => {
        if (guestSessionId) {
            // Store session ID before redirecting
            localStorage.setItem('trivrdy_pendingGuestSessionId', guestSessionId)
            localStorage.setItem('trivrdy_pendingGuestSessionType', 'RANDOM_QUESTION')
        }
        router.push('/sign-up')
    }

    const handleSignIn = () => {
        if (guestSessionId) {
            localStorage.setItem('trivrdy_pendingGuestSessionId', guestSessionId)
            localStorage.setItem('trivrdy_pendingGuestSessionType', 'RANDOM_QUESTION')
        }
        signIn()
    }

    if (checkingAuth || authLoading || loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center px-4">
                <div className="text-center max-w-md">
                    <div className="inline-block h-16 w-16 animate-spin rounded-full border-4 border-solid border-emerald-600 border-r-transparent mb-6"></div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        {checkingAuth || authLoading ? 'Signing you in...' : 'Loading Question'}
                    </h2>
                    <p className="text-gray-600 text-lg">
                        {checkingAuth || authLoading ? 'Saving your progress...' : 'Preparing your practice question...'}
                    </p>
                </div>
            </div>
        )
    }

    if (!question) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="card p-8 max-w-md text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">No Question Available</h1>
                    <p className="text-gray-600 mb-6">Unable to load a question at this time.</p>
                    <Link href="/" className="btn-primary">
                        Back to Home
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white py-8 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">Practice Question</h1>
                    <p className="text-gray-600">
                        Try a random Jeopardy question
                    </p>
                </div>

                {/* Question Card */}
                <div className="card p-8 mb-8">
                    <div className="mb-6">
                        <span className="inline-block px-4 py-2 bg-emerald-100 text-emerald-800 rounded-full text-sm font-medium mb-4">
                            {question.originalCategory}
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
                            {limitReached ? (
                                <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4 mb-4">
                                    <p className="text-amber-800 mb-3 font-medium">
                                        You&apos;ve reached the guest limit. Sign in to continue practicing!
                                    </p>
                                    <div className="flex gap-3">
                                        <button onClick={handleSignUp} className="btn-primary flex-1">
                                            Sign Up
                                        </button>
                                        <button onClick={handleSignIn} className="btn-secondary flex-1">
                                            Sign In
                                        </button>
                                    </div>
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
                                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-lg text-gray-900 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                        placeholder="What is..."
                                        autoFocus
                                    />
                                    <button
                                        onClick={handleSubmit}
                                        disabled={!userAnswer.trim() || submitting}
                                        className={`w-full py-3 rounded-lg font-bold text-lg transition-all ${
                                            !userAnswer.trim() || submitting
                                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                : 'bg-emerald-600 text-white hover:bg-emerald-700'
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
                                
                                <div className="mt-4 p-4 bg-white rounded-lg border-2 border-gray-200">
                                    <p className="text-xl font-medium text-center text-gray-800">
                                        {question.answer}
                                    </p>
                                </div>
                            </div>

                            {/* Sign up CTA */}
                            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Save Your Progress</h3>
                                <p className="text-gray-700 mb-4">
                                    Sign in to save this question to your stats and continue practicing with unlimited questions!
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

