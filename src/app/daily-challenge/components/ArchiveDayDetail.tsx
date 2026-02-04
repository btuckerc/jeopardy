'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/app/lib/auth'
import { scrollInputIntoView } from '@/app/hooks/useMobileKeyboard'
import toast from 'react-hot-toast'
import type { UnlockedAchievement } from '@/types/admin'
import { showAchievementUnlock } from '@/app/components/AchievementUnlockToast'
import ShareResults from '@/app/daily-challenge/components/ShareResults'

interface ArchiveDay {
    id: string
    date: string
    question: {
        id: string
        question: string
        answer: string
        category: string
        airDate: string | null
    }
    participation: {
        correct: boolean
        completedAt: string
        userAnswerText: string | null
    } | null
}

interface ArchiveDayDetailProps {
    day: ArchiveDay
    onBack: () => void
    onParticipationUpdate: (challengeId: string, participation: {
        correct: boolean
        completedAt: string
        userAnswerText: string | null
    }) => void
}

// Helper to format date
function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })
}

// Helper to format air date
function formatAirDate(dateStr: string | null): string {
    if (!dateStr) return ''
    const datePart = dateStr.split('T')[0]
    const [year, month, day] = datePart.split('-')
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December']
    return `${months[parseInt(month, 10) - 1]} ${parseInt(day, 10)}, ${year}`
}

export default function ArchiveDayDetail({ day, onBack, onParticipationUpdate }: ArchiveDayDetailProps) {
    const { user } = useAuth()
    const [userAnswer, setUserAnswer] = useState('')
    const [showQuestion, setShowQuestion] = useState(false)
    const [showAnswer, setShowAnswer] = useState(false)
    const [revealAnswer, setRevealAnswer] = useState(false)
    const [revealMyAnswer, setRevealMyAnswer] = useState(false)
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [disputeSubmitted, setDisputeSubmitted] = useState(false)
    const [disputeSubmitting, setDisputeSubmitting] = useState(false)
    const answerInputRef = useRef<HTMLInputElement>(null)
    
    // Initialize state based on participation
    useEffect(() => {
        if (day.participation) {
            setShowQuestion(true)
            setShowAnswer(true)
            setIsCorrect(day.participation.correct)
            if (day.participation.correct) {
                setRevealAnswer(true)
            }
        }
    }, [day])
    
    const handleRevealQuestion = () => {
        setShowQuestion(true)
    }
    
    const handleSubmit = async () => {
        if (!userAnswer.trim()) return
        
        setSubmitting(true)
        try {
            const response = await fetch('/api/daily-challenge/archive/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    challengeId: day.id,
                    answer: userAnswer
                })
            })
            
            if (!response.ok) {
                const error = await response.json()
                if (error.requiresAuth) {
                    toast.error('Please sign in to participate')
                    return
                }
                throw new Error(error.error || 'Failed to submit')
            }
            
            const data = await response.json()
            setIsCorrect(data.correct)
            setShowAnswer(true)
            
            if (data.correct) {
                setRevealAnswer(true)
            }
            
            // Show achievement notifications
            if (data.unlockedAchievements?.length) {
                data.unlockedAchievements.forEach((achievement: UnlockedAchievement) => {
                    showAchievementUnlock(achievement)
                })
            }
            
            // Update parent state
            onParticipationUpdate(day.id, {
                correct: data.correct,
                completedAt: new Date().toISOString(),
                userAnswerText: userAnswer
            })
            
            toast.success(data.correct ? 'Correct!' : 'Incorrect')
        } catch (error) {
            console.error('Error submitting answer:', error)
            toast.error('Failed to submit answer')
        } finally {
            setSubmitting(false)
        }
    }
    
    const handleDispute = async () => {
        if (!user?.id || !userAnswer || disputeSubmitted) return
        
        setDisputeSubmitting(true)
        try {
            const response = await fetch('/api/answers/disputes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    questionId: day.question.id,
                    gameId: null,
                    mode: 'DAILY_CHALLENGE',
                    round: 'FINAL',
                    userAnswer: userAnswer,
                    systemWasCorrect: false
                })
            })
            
            if (!response.ok) {
                throw new Error('Failed to submit dispute')
            }
            
            setDisputeSubmitted(true)
            toast.success('Dispute submitted for review')
        } catch (error) {
            console.error('Error submitting dispute:', error)
            toast.error('Failed to submit dispute')
        } finally {
            setDisputeSubmitting(false)
        }
    }
    
    const hasParticipated = !!day.participation
    
    return (
        <div className="space-y-6">
            {/* Back button */}
            <button
                onClick={onBack}
                className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 transition-colors"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to archive
            </button>
            
            {/* Date and Category Header */}
            <div className="text-center">
                <p className="text-amber-400 text-sm font-medium mb-2">
                    {formatDate(day.date)}
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold text-white uppercase tracking-wide">
                    {day.question.category}
                </h2>
                {day.question.airDate && (
                    <p className="text-blue-300 text-sm mt-2">
                        Originally aired: {formatAirDate(day.question.airDate)}
                    </p>
                )}
            </div>
            
            {/* Main content card */}
            <div className="bg-blue-800 rounded-2xl shadow-2xl overflow-hidden relative">
                <div className="absolute inset-0 opacity-10 bg-[url('/grid.svg')] pointer-events-none" />
                
                <div className="relative p-6 sm:p-8 md:p-10">
                    {!showQuestion ? (
                        /* Case A: Not yet attempted - Show reveal button */
                        <div className="text-center py-12">
                            <button
                                onClick={handleRevealQuestion}
                                className="inline-flex items-center gap-3 px-8 sm:px-10 py-4 sm:py-5 bg-amber-400 text-blue-900 rounded-xl sm:rounded-2xl hover:bg-amber-500 transition-all duration-300 font-bold shadow-lg hover:shadow-xl text-lg sm:text-xl group transform hover:scale-105"
                            >
                                <svg className="w-6 h-6 sm:w-7 sm:h-7 transition-transform duration-300 group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                Click to Reveal Question
                            </button>
                        </div>
                    ) : !showAnswer ? (
                        /* Question revealed, waiting for answer */
                        <div className="space-y-6 sm:space-y-8">
                            <h3 className="text-white text-lg sm:text-2xl md:text-3xl font-bold leading-relaxed text-center">
                                {day.question.question}
                            </h3>
                            
                            <div className="space-y-4 max-w-2xl mx-auto">
                                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                                    <input
                                        ref={answerInputRef}
                                        type="text"
                                        value={userAnswer}
                                        onChange={(e) => setUserAnswer(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && userAnswer.trim() && !submitting) {
                                                handleSubmit()
                                            }
                                        }}
                                        onFocus={() => scrollInputIntoView(answerInputRef.current)}
                                        className="w-full px-4 py-3 bg-white rounded-lg text-base sm:text-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-amber-400 focus:border-amber-400 border-2 border-transparent"
                                        style={{ fontSize: '16px' }}
                                        placeholder="What is..."
                                        autoComplete="off"
                                        autoCapitalize="off"
                                        autoCorrect="off"
                                        spellCheck="false"
                                        autoFocus
                                    />
                                </div>
                                <button
                                    onClick={handleSubmit}
                                    disabled={!userAnswer.trim() || submitting}
                                    className={`w-full py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg transition-all ${
                                        !userAnswer.trim() || submitting
                                            ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                                            : 'bg-amber-400 text-blue-900 hover:bg-amber-500 shadow-lg hover:shadow-xl'
                                    }`}
                                >
                                    {submitting ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-solid border-blue-900 border-r-transparent" />
                                            Submitting...
                                        </span>
                                    ) : (
                                        'Submit Answer'
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Results view - for both correct and incorrect */
                        <div className="space-y-6 max-w-3xl mx-auto">
                            {/* Question */}
                            <h3 className="text-white text-lg sm:text-2xl md:text-3xl font-bold leading-relaxed text-center">
                                {day.question.question}
                            </h3>
                            
                            {/* Result badge */}
                            <div className={`p-6 rounded-xl text-center ${
                                isCorrect 
                                    ? 'bg-green-500/20 border border-green-400/30' 
                                    : 'bg-red-500/20 border border-red-400/30'
                            }`}>
                                <div className="flex items-center justify-center gap-3 mb-4">
                                    {isCorrect ? (
                                        <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    ) : (
                                        <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    )}
                                    <span className={`text-2xl font-bold ${
                                        isCorrect ? 'text-green-300' : 'text-red-300'
                                    }`}>
                                        {isCorrect ? 'Correct!' : 'Incorrect'}
                                    </span>
                                </div>
                                
                                {/* Reveal Answer button */}
                                {revealAnswer ? (
                                    <div className="mt-6 p-6 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                                        <p className="text-white text-xl sm:text-2xl font-medium text-center leading-relaxed">
                                            {day.question.answer}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="text-center mt-4">
                                        <button
                                            onClick={() => setRevealAnswer(true)}
                                            className="inline-flex items-center gap-2 px-6 py-3 bg-amber-400 text-blue-900 rounded-xl hover:bg-amber-500 transition-colors font-bold shadow-lg"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                            Reveal Answer
                                        </button>
                                    </div>
                                )}
                                
                                {/* Show My Answer toggle */}
                                {(userAnswer || day.participation?.userAnswerText) && (
                                    <div className="mt-4">
                                        <button
                                            onClick={() => setRevealMyAnswer(!revealMyAnswer)}
                                            className="text-amber-300 hover:text-amber-200 text-sm font-medium flex items-center gap-1 mx-auto"
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
                                            <div className="mt-3 p-4 bg-amber-500/20 rounded-xl border border-amber-400/30 max-w-md mx-auto">
                                                <p className="text-xs text-amber-200 font-semibold mb-1">Your answer:</p>
                                                <p className="text-white italic">
                                                    {userAnswer || day.participation?.userAnswerText}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                {/* Dispute button */}
                                {!isCorrect && revealAnswer && user?.id && (userAnswer || day.participation?.userAnswerText) && (
                                    <div className="mt-4 flex justify-end">
                                        {disputeSubmitted ? (
                                            <span className="text-sm text-blue-300 flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                Dispute submitted
                                            </span>
                                        ) : (
                                            <button
                                                onClick={handleDispute}
                                                disabled={disputeSubmitting}
                                                className="text-sm text-blue-300 hover:text-blue-100 underline disabled:opacity-50"
                                            >
                                                {disputeSubmitting ? 'Submitting...' : 'Dispute this answer'}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                            
                            {/* Share Results */}
                            {hasParticipated && (
                                <ShareResults 
                                    date={day.date}
                                    category={day.question.category}
                                    isCorrect={isCorrect || false}
                                    streak={0} // Will be fetched from stats
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>
            
            {/* Practice more link */}
            <div className="text-center">
                <a
                    href="/practice/round?round=FINAL"
                    className="inline-flex items-center gap-2 text-blue-300 hover:text-blue-200 transition-colors text-sm"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Practice more Final Jeopardy questions
                </a>
            </div>
        </div>
    )
}
