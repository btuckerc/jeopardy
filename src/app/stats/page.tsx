'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/app/lib/auth'

type Question = {
    id: string
    question: string | null
    answer: string | null
    value: number
    airDate: string | null
    correct: boolean
}

type HistoryQuestion = {
    id: string
    question: string
    answer: string
    value: number
    points: number
    airDate: string | null
    correct: boolean
    wasTripleStumper: boolean
    round: string
    categoryName: string
    timestamp: string
    lastIncorrectUserAnswer?: string | null
}

type StatModalType = 'points' | 'attempted' | 'correct' | 'tripleStumpers' | null

type RoundHistoryQuestion = {
    id: string
    question: string
    answer: string
    value: number
    points: number
    airDate: string | null
    correct: boolean
    wasTripleStumper: boolean
    categoryId: string
    categoryName: string
    timestamp: string
    lastIncorrectUserAnswer?: string | null
    round: 'SINGLE' | 'DOUBLE' | 'FINAL'
}

type RoundHistoryCategory = {
    categoryId: string
    categoryName: string
    questions: RoundHistoryQuestion[]
    correct: number
    incorrect: number
}

type SelectedRound = 'SINGLE' | 'DOUBLE' | 'FINAL' | null

type CategoryFilter = 'ALL' | 'SINGLE' | 'DOUBLE' | 'FINAL' | 'TRIPLE_STUMPER'

type CategoryStats = {
    categoryName: string
    correct: number
    total: number
    points: number
    mostRecentAirDate?: string | null
    questions?: Question[]
    roundBreakdown?: {
        SINGLE: number
        DOUBLE: number
        FINAL: number
    }
    roundBreakdownTotal?: {
        SINGLE: number
        DOUBLE: number
        FINAL: number
    }
    tripleStumpersCorrect?: number
    tripleStumpersTotal?: number
}

type RoundStats = {
    round: string
    roundName: string
    totalQuestions: number
    totalAnswered: number
    correctAnswers: number
    totalPoints: number
    accuracy: number
}

type Stats = {
    totalPoints: number
    totalQuestions: number
    totalAnswered: number
    correctAnswers: number
    tripleStumpersAnswered: number
    categoryStats: CategoryStats[]
    roundStats?: RoundStats[]
}

type DailyChallengeStats = {
    totalCompleted: number
    totalCorrect: number
    totalIncorrect: number
    accuracy: number
    participationStreak: {
        current: number
        longest: number
    }
    correctnessStreak: {
        current: number
        longest: number
    }
    history: Array<{
        challengeDate: string
        completedAt: string
        correct: boolean
        questionId: string
        categoryName: string
        question: string
        answer: string
        airDate: string | null
        userAnswer?: string | null
    }>
}

// Stats Detail Modal Component
function StatsDetailModal({ 
    type, 
    onClose 
}: { 
    type: StatModalType
    onClose: () => void 
}) {
    const { user } = useAuth()
    const [questions, setQuestions] = useState<HistoryQuestion[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'correct' | 'incorrect'>('incorrect')
    const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({})
    const [revealedMyAnswers, setRevealedMyAnswers] = useState<Record<string, boolean>>({})
    const [disputeSubmitted, setDisputeSubmitted] = useState<Record<string, boolean>>({})
    const [summary, setSummary] = useState({ totalCorrect: 0, totalIncorrect: 0, totalTripleStumpers: 0, totalAttempted: 0 })

    // Prevent background scrolling when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = 'unset'
        }
    }, [])

    const fetchQuestions = useCallback(async (tab: 'correct' | 'incorrect' | undefined) => {
        setLoading(true)
        try {
            const tabParam = (type === 'attempted' || type === 'correct') && tab ? `&tab=${tab}` : ''
            const response = await fetch(`/api/stats/history?type=${type}${tabParam}`)
            if (!response.ok) throw new Error('Failed to fetch')
            const data = await response.json()
            setQuestions(data.questions)
            setSummary(data.summary)
        } catch (error) {
            console.error('Error fetching questions:', error)
        } finally {
            setLoading(false)
        }
    }, [type])

    useEffect(() => {
        if (type) {
            // Set default tab based on type
            const defaultTab = type === 'attempted' ? 'incorrect' : type === 'correct' ? 'correct' : undefined
            setActiveTab(defaultTab || 'incorrect')
            fetchQuestions(defaultTab)
        }
    }, [type, fetchQuestions])

    const handleTabChange = (tab: 'correct' | 'incorrect') => {
        setActiveTab(tab)
        setRevealedAnswers({})
        setRevealedMyAnswers({})
        setDisputeSubmitted({})
        fetchQuestions(tab)
    }

    const toggleAnswer = (questionId: string) => {
        setRevealedAnswers(prev => ({
            ...prev,
            [questionId]: !prev[questionId]
        }))
    }

    const toggleMyAnswer = (questionId: string) => {
        setRevealedMyAnswers(prev => ({
            ...prev,
            [questionId]: !prev[questionId]
        }))
    }

    const handleDispute = async (question: HistoryQuestion) => {
        if (!user?.id || !question.lastIncorrectUserAnswer || disputeSubmitted[question.id]) return

        try {
            const response = await fetch('/api/answers/disputes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    questionId: question.id,
                    gameId: null,
                    mode: 'PRACTICE',
                    round: question.round as 'SINGLE' | 'DOUBLE' | 'FINAL',
                    userAnswer: question.lastIncorrectUserAnswer,
                    systemWasCorrect: false
                })
            })

            if (!response.ok) {
                const error = await response.json()
                console.error('Failed to submit dispute:', error.error)
                return
            }

            setDisputeSubmitted(prev => ({
                ...prev,
                [question.id]: true
            }))
        } catch (error) {
            console.error('Error submitting dispute:', error)
        }
    }

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'No air date'
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        })
    }

    const getTitle = () => {
        switch (type) {
            case 'points': return 'Points Earned'
            case 'attempted': return 'Questions Attempted'
            case 'correct': return 'Answer History'
            case 'tripleStumpers': return 'Triple Stumpers Conquered'
            default: return ''
        }
    }

    const getDescription = () => {
        switch (type) {
            case 'points': return 'Questions you answered correctly, sorted by points earned'
            case 'attempted': return 'All questions you\'ve attempted'
            case 'correct': return 'Your answer history'
            case 'tripleStumpers': return 'Questions that stumped all original contestants - but not you!'
            default: return ''
        }
    }

    const showTabs = type === 'attempted' || type === 'correct'

    if (!type) return null

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 md:p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-fade-in-slide-down">
                {/* Header */}
                <div className="p-4 md:p-6 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                    <div className="flex justify-between items-start gap-4">
                        <div className="min-w-0">
                            <h2 className="text-xl md:text-2xl font-bold truncate">{getTitle()}</h2>
                            <p className="text-blue-100 mt-1 text-xs md:text-sm">{getDescription()}</p>
                        </div>
                        <button 
                            onClick={onClose} 
                            className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10 flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-white/50"
                            aria-label="Close modal"
                        >
                            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    
                    {/* Summary stats */}
                    <div className="flex flex-wrap gap-3 md:gap-6 mt-4 text-xs md:text-sm">
                        <div>
                            <span className="text-blue-200">Attempted:</span>
                            <span className="ml-1.5 font-semibold">{summary.totalAttempted}</span>
                        </div>
                        <div>
                            <span className="text-blue-200">Correct:</span>
                            <span className="ml-1.5 font-semibold text-green-300">{summary.totalCorrect}</span>
                        </div>
                        <div>
                            <span className="text-blue-200">Incorrect:</span>
                            <span className="ml-1.5 font-semibold text-red-300">{summary.totalIncorrect}</span>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                {showTabs && (
                    <div className="flex border-b bg-gray-50">
                        <button
                            onClick={() => handleTabChange('incorrect')}
                            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                                activeTab === 'incorrect'
                                    ? 'text-red-600 border-b-2 border-red-600 bg-white'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <span className="flex items-center justify-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Incorrect ({summary.totalIncorrect})
                            </span>
                        </button>
                        <button
                            onClick={() => handleTabChange('correct')}
                            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                                activeTab === 'correct'
                                    ? 'text-green-600 border-b-2 border-green-600 bg-white'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <span className="flex items-center justify-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Correct ({summary.totalCorrect})
                            </span>
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="overflow-y-auto flex-1 p-4">
                    {loading ? (
                        <div className="flex justify-center items-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : questions.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p>No questions found</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {questions.map(question => (
                                <div
                                    key={question.id}
                                    className={`border rounded-lg p-4 transition-all ${
                                        question.correct 
                                            ? 'bg-green-50 border-green-200' 
                                            : 'bg-red-50 border-red-200'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <span className={`text-lg ${question.correct ? 'text-green-600' : 'text-red-500'}`}>
                                                {question.correct ? '✓' : '✗'}
                                            </span>
                                            <span className="font-bold text-blue-800">${question.value}</span>
                                            {question.wasTripleStumper && (
                                                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">
                                                    Triple Stumper
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-right text-sm text-gray-500">
                                            <div>{question.categoryName}</div>
                                            <div className="text-xs">{formatDate(question.airDate)}</div>
                                        </div>
                                    </div>
                                    
                                    <p className="text-gray-900 mb-3">{question.question}</p>
                                    
                                    <div className="flex flex-wrap gap-3">
                                        <button
                                            onClick={() => toggleAnswer(question.id)}
                                            className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
                                        >
                                            {revealedAnswers[question.id] ? (
                                                <>
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                    </svg>
                                                    Hide Answer
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                    </svg>
                                                    Show Answer
                                                </>
                                            )}
                                        </button>
                                        
                                        {!question.correct && question.lastIncorrectUserAnswer && (
                                            <button
                                                onClick={() => toggleMyAnswer(question.id)}
                                                className="text-orange-600 hover:text-orange-800 text-sm font-medium flex items-center gap-1"
                                            >
                                                {revealedMyAnswers[question.id] ? (
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
                                        )}
                                    </div>
                                    
                                    {revealedAnswers[question.id] && (
                                        <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                                            <p className="text-gray-700 font-medium italic">{question.answer}</p>
                                            {!question.correct && question.lastIncorrectUserAnswer && user?.id && (
                                                <div className="mt-2 pt-2 border-t border-gray-100 flex justify-end">
                                                    {disputeSubmitted[question.id] ? (
                                                        <span className="text-sm text-gray-500 flex items-center gap-1">
                                                            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                            Dispute submitted
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1">
                                                            <button
                                                                onClick={() => handleDispute(question)}
                                                                className="text-sm text-gray-500 hover:text-gray-700 underline"
                                                            >
                                                                Dispute this answer
                                                            </button>
                                                            <span className="relative group">
                                                                <span className="w-4 h-4 inline-flex items-center justify-center text-xs text-gray-500 hover:text-gray-700 cursor-help border border-gray-400 rounded-full">i</span>
                                                                <span className="absolute bottom-full right-0 mb-2 px-3 py-2 text-xs text-white bg-gray-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                                                    An admin will review your answer.<br/>If approved, you&apos;ll be retroactively credited.
                                                                </span>
                                                            </span>
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    
                                    {revealedMyAnswers[question.id] && question.lastIncorrectUserAnswer && (
                                        <div className="mt-3 p-3 bg-orange-50 rounded border border-orange-200">
                                            <p className="text-xs text-orange-700 font-semibold mb-1">Your last answer:</p>
                                            <p className="text-gray-800 italic">{question.lastIncorrectUserAnswer}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 md:p-4 border-t bg-gray-50">
                    <button
                        onClick={onClose}
                        className="btn-secondary w-full"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}

function CategoryModal({ category, onClose, onPractice }: {
    category: CategoryStats
    onClose: () => void
    onPractice: () => void
}) {
    const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({})
    const isComplete = category.correct === category.total

    // Prevent background scrolling when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = 'unset'
        }
    }, [])

    const toggleAnswer = (questionId: string) => {
        setRevealedAnswers(prev => ({
            ...prev,
            [questionId]: !prev[questionId]
        }))
    }

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'No air date'
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
    }

    if (!category.questions) return null

    // Get the air date from the first question
    const categoryAirDate = category.questions[0]?.airDate

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 md:p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-fade-in-slide-down">
                <div className="p-4 md:p-6 border-b bg-gray-50">
                    <div className="flex justify-between items-start gap-4">
                        <div className="min-w-0">
                            <h2 className="text-lg md:text-xl font-bold text-gray-900 line-clamp-2">{category.categoryName}</h2>
                            <p className="text-xs md:text-sm text-gray-500 mt-1">{formatDate(categoryAirDate)}</p>
                        </div>
                        <button 
                            onClick={onClose} 
                            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-200 flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            aria-label="Close modal"
                        >
                            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                        <div className="flex-1">
                            <div className="progress-bar h-2">
                                <div 
                                    className={`progress-fill ${isComplete ? 'bg-green-500' : 'bg-blue-500'}`}
                                    style={{ width: `${Math.round((category.correct / category.total) * 100)}%` }}
                                />
                            </div>
                        </div>
                        <span className={`text-sm font-semibold ${isComplete ? 'text-green-600' : 'text-blue-600'}`}>
                            {category.correct}/{category.total} ({Math.round((category.correct / category.total) * 100)}%)
                        </span>
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 p-4 md:p-6">
                    <div className="space-y-3">
                        {category.questions.map(question => (
                            <div
                                key={question.id}
                                className={`border rounded-xl p-3 md:p-4 transition-colors ${
                                    question.correct 
                                        ? 'bg-green-50 border-green-200' 
                                        : 'bg-gray-50 border-gray-200'
                                }`}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-base md:text-lg ${question.correct ? 'text-green-600' : 'text-gray-400'}`}>
                                        {question.correct ? '✓' : '○'}
                                    </span>
                                    <span className="font-semibold text-gray-900">${question.value}</span>
                                </div>
                                {question.correct ? (
                                    <>
                                        <p className="text-gray-800 text-sm md:text-base mb-2">{question.question}</p>
                                        <button
                                            onClick={() => toggleAnswer(question.id)}
                                            className="text-blue-600 hover:text-blue-800 text-xs md:text-sm font-medium inline-flex items-center gap-1 focus:outline-none focus:underline"
                                        >
                                            {revealedAnswers[question.id] ? (
                                                <>
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                    </svg>
                                                    Hide Answer
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                    </svg>
                                                    Show Answer
                                                </>
                                            )}
                                        </button>
                                        {revealedAnswers[question.id] && (
                                            <div className="mt-2 p-2 md:p-3 bg-white rounded-lg border border-gray-200">
                                                <p className="text-gray-700 text-sm italic">{question.answer}</p>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-gray-500 italic text-sm">Question not yet answered correctly</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-4 md:p-6 border-t bg-gray-50">
                    <button
                        onClick={onPractice}
                        className={`w-full py-2.5 px-4 rounded-lg transition-colors font-bold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                            isComplete 
                                ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' 
                                : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                        }`}
                    >
                        {isComplete ? 'More Like This' : 'Practice Remaining Questions'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// Round History Modal Component
function RoundHistoryModal({ 
    round, 
    roundStats,
    onClose 
}: { 
    round: SelectedRound
    roundStats: RoundStats | undefined
    onClose: () => void 
}) {
    const { user } = useAuth()
    const router = useRouter()
    const [questions, setQuestions] = useState<RoundHistoryQuestion[]>([])
    const [categories, setCategories] = useState<RoundHistoryCategory[]>([])
    const [loading, setLoading] = useState(true)
    const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({})
    const [revealedMyAnswers, setRevealedMyAnswers] = useState<Record<string, boolean>>({})
    const [disputeSubmitted, setDisputeSubmitted] = useState<Record<string, boolean>>({})
    const [summary, setSummary] = useState({ totalCorrect: 0, totalIncorrect: 0, totalAttempted: 0, totalPoints: 0 })
    const [viewMode, setViewMode] = useState<'questions' | 'categories'>('questions')

    // Prevent background scrolling when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = 'unset'
        }
    }, [])

    useEffect(() => {
        if (round) {
            const fetchRoundHistory = async () => {
                setLoading(true)
                try {
                    const response = await fetch(`/api/stats/round-history?round=${round}`)
                    if (!response.ok) throw new Error('Failed to fetch')
                    const data = await response.json()
                    setQuestions(data.questions)
                    setCategories(data.categories)
                    setSummary(data.summary)
                } catch (error) {
                    console.error('Error fetching round history:', error)
                } finally {
                    setLoading(false)
                }
            }
            fetchRoundHistory()
        }
    }, [round])

    const toggleAnswer = (questionId: string) => {
        setRevealedAnswers(prev => ({
            ...prev,
            [questionId]: !prev[questionId]
        }))
    }

    const toggleMyAnswer = (questionId: string) => {
        setRevealedMyAnswers(prev => ({
            ...prev,
            [questionId]: !prev[questionId]
        }))
    }

    const handleDispute = async (question: RoundHistoryQuestion) => {
        if (!user?.id || !question.lastIncorrectUserAnswer || disputeSubmitted[question.id]) return

        try {
            const response = await fetch('/api/answers/disputes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    questionId: question.id,
                    gameId: null,
                    mode: 'PRACTICE',
                    round: question.round as 'SINGLE' | 'DOUBLE' | 'FINAL',
                    userAnswer: question.lastIncorrectUserAnswer,
                    systemWasCorrect: false
                })
            })

            if (!response.ok) {
                const error = await response.json()
                console.error('Failed to submit dispute:', error.error)
                return
            }

            setDisputeSubmitted(prev => ({
                ...prev,
                [question.id]: true
            }))
        } catch (error) {
            console.error('Error submitting dispute:', error)
        }
    }

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'No air date'
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        })
    }

    const formatTimestamp = (timestamp: string) => {
        return new Date(timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        })
    }

    const getRoundName = () => {
        switch (round) {
            case 'SINGLE': return 'Single Jeopardy'
            case 'DOUBLE': return 'Double Jeopardy'
            case 'FINAL': return 'Final Jeopardy'
            default: return ''
        }
    }

    const getPracticeUrl = () => {
        switch (round) {
            case 'SINGLE': return '/practice/round/single'
            case 'DOUBLE': return '/practice/round/double'
            case 'FINAL': return '/practice/round/final'
            default: return '/practice'
        }
    }

    const getHeaderColor = () => {
        switch (round) {
            case 'SINGLE': return 'from-blue-600 to-blue-700'
            case 'DOUBLE': return 'from-purple-600 to-purple-700'
            case 'FINAL': return 'from-amber-500 to-amber-600'
            default: return 'from-blue-600 to-blue-700'
        }
    }

    const handlePracticeCategory = (categoryId: string) => {
        const practiceUrl = round === 'FINAL' 
            ? `/practice/round/final`
            : `/practice/round/${round?.toLowerCase()}?category=${categoryId}`
        router.push(practiceUrl)
    }

    if (!round) return null

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 md:p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-fade-in-slide-down">
                {/* Header */}
                <div className={`p-4 md:p-6 border-b bg-gradient-to-r ${getHeaderColor()} text-white`}>
                    <div className="flex justify-between items-start gap-4 mb-4">
                        <div className="min-w-0">
                            <h2 className="text-xl md:text-2xl font-bold">{getRoundName()} History</h2>
                            <p className="text-white/80 mt-1 text-xs md:text-sm">Questions you&apos;ve answered in this round</p>
                        </div>
                        <button 
                            onClick={onClose} 
                            className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10 flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-white/50"
                            aria-label="Close modal"
                        >
                            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    
                    {/* Practice Button */}
                    <Link
                        href={getPracticeUrl()}
                        className={`inline-flex items-center gap-2 px-4 md:px-6 py-2.5 md:py-3 bg-white rounded-lg font-bold text-sm md:text-base transition-colors shadow-lg focus:outline-none focus:ring-2 focus:ring-white/50 ${
                            round === 'SINGLE' ? 'text-blue-700 hover:bg-blue-50' :
                            round === 'DOUBLE' ? 'text-purple-700 hover:bg-purple-50' :
                            'text-amber-700 hover:bg-amber-50'
                        }`}
                    >
                        <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="hidden sm:inline">Practice {getRoundName()} Questions</span>
                        <span className="sm:hidden">Practice</span>
                    </Link>
                    
                    {/* Summary stats */}
                    <div className="flex flex-wrap gap-3 md:gap-6 mt-4 text-xs md:text-sm">
                        <div>
                            <span className="text-white/70">Attempted:</span>
                            <span className="ml-1.5 font-semibold">{summary.totalAttempted}/{roundStats?.totalQuestions || 0}</span>
                        </div>
                        <div>
                            <span className="text-white/70">Correct:</span>
                            <span className="ml-1.5 font-semibold text-green-300">{summary.totalCorrect}</span>
                        </div>
                        <div>
                            <span className="text-white/70">Incorrect:</span>
                            <span className="ml-1.5 font-semibold text-red-300">{summary.totalIncorrect}</span>
                        </div>
                        <div>
                            <span className="text-white/70">Points:</span>
                            <span className="ml-1.5 font-semibold">${summary.totalPoints.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* View Toggle */}
                <div className="flex border-b bg-gray-50">
                    <button
                        onClick={() => setViewMode('questions')}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                            viewMode === 'questions'
                                ? round === 'SINGLE' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' :
                                  round === 'DOUBLE' ? 'text-purple-600 border-b-2 border-purple-600 bg-white' :
                                  'text-amber-600 border-b-2 border-amber-600 bg-white'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <span className="flex items-center justify-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            Questions ({questions.length})
                        </span>
                    </button>
                    <button
                        onClick={() => setViewMode('categories')}
                        className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                            viewMode === 'categories'
                                ? round === 'SINGLE' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' :
                                  round === 'DOUBLE' ? 'text-purple-600 border-b-2 border-purple-600 bg-white' :
                                  'text-amber-600 border-b-2 border-amber-600 bg-white'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <span className="flex items-center justify-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            Categories ({categories.length})
                        </span>
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1 p-4">
                    {loading ? (
                        <div className="flex justify-center items-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : viewMode === 'questions' ? (
                        questions.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p>No questions answered yet in {getRoundName()}</p>
                                <Link 
                                    href={getPracticeUrl()}
                                    className={`mt-4 inline-block px-4 py-2 text-white rounded-lg transition-colors ${
                                        round === 'SINGLE' ? 'bg-blue-600 hover:bg-blue-700' :
                                        round === 'DOUBLE' ? 'bg-purple-600 hover:bg-purple-700' :
                                        'bg-amber-600 hover:bg-amber-700'
                                    }`}
                                >
                                    Start Practicing
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {questions.map(question => (
                                    <div
                                        key={question.id}
                                        className={`border rounded-lg p-4 transition-all ${
                                            question.correct 
                                                ? 'bg-green-50 border-green-200' 
                                                : 'bg-red-50 border-red-200'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-3">
                                                <span className={`text-lg ${question.correct ? 'text-green-600' : 'text-red-500'}`}>
                                                    {question.correct ? '✓' : '✗'}
                                                </span>
                                                <span className="font-bold text-blue-800">${question.value}</span>
                                                {question.wasTripleStumper && (
                                                    <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">
                                                        Triple Stumper
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-right text-sm text-gray-500">
                                                <button
                                                    onClick={() => handlePracticeCategory(question.categoryId)}
                                                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                                >
                                                    {question.categoryName}
                                                </button>
                                                <div className="text-xs">{formatTimestamp(question.timestamp)}</div>
                                            </div>
                                        </div>
                                        
                                        <p className="text-gray-900 mb-3">{question.question}</p>
                                        
                                        <div className="flex flex-wrap gap-3">
                                            <button
                                                onClick={() => toggleAnswer(question.id)}
                                                className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
                                            >
                                                {revealedAnswers[question.id] ? (
                                                    <>
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                        </svg>
                                                        Hide Answer
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                        Show Answer
                                                    </>
                                                )}
                                            </button>
                                            
                                            {!question.correct && question.lastIncorrectUserAnswer && (
                                                <button
                                                    onClick={() => toggleMyAnswer(question.id)}
                                                    className="text-orange-600 hover:text-orange-800 text-sm font-medium flex items-center gap-1"
                                                >
                                                    {revealedMyAnswers[question.id] ? (
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
                                            )}
                                        </div>
                                        
                                        {revealedAnswers[question.id] && (
                                            <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                                                <p className="text-gray-700 font-medium italic">{question.answer}</p>
                                                {!question.correct && question.lastIncorrectUserAnswer && user?.id && (
                                                    <div className="mt-2 pt-2 border-t border-gray-100 flex justify-end">
                                                        {disputeSubmitted[question.id] ? (
                                                            <span className="text-sm text-gray-500 flex items-center gap-1">
                                                                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                                Dispute submitted
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1">
                                                                <button
                                                                    onClick={() => handleDispute(question)}
                                                                    className="text-sm text-gray-500 hover:text-gray-700 underline"
                                                                >
                                                                    Dispute this answer
                                                                </button>
                                                                <span className="relative group">
                                                                    <span className="w-4 h-4 inline-flex items-center justify-center text-xs text-gray-500 hover:text-gray-700 cursor-help border border-gray-400 rounded-full">i</span>
                                                                    <span className="absolute bottom-full right-0 mb-2 px-3 py-2 text-xs text-white bg-gray-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                                                        An admin will review your answer.<br/>If approved, you&apos;ll be retroactively credited.
                                                                    </span>
                                                                </span>
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        
                                        {revealedMyAnswers[question.id] && question.lastIncorrectUserAnswer && (
                                            <div className="mt-3 p-3 bg-orange-50 rounded border border-orange-200">
                                                <p className="text-xs text-orange-700 font-semibold mb-1">Your last answer:</p>
                                                <p className="text-gray-800 italic">{question.lastIncorrectUserAnswer}</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        /* Categories View */
                        categories.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                <p>No categories practiced yet in {getRoundName()}</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {categories.map(category => (
                                    <button
                                        key={category.categoryId}
                                        onClick={() => handlePracticeCategory(category.categoryId)}
                                        className="bg-white border rounded-lg p-4 text-left hover:shadow-lg hover:border-blue-300 transition-all group"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                                {category.categoryName}
                                            </h3>
                                            <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm">
                                            <span className="text-green-600">
                                                ✓ {category.correct} correct
                                            </span>
                                            {category.incorrect > 0 && (
                                                <span className="text-red-500">
                                                    ✗ {category.incorrect} incorrect
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2">
                                            {category.questions.length} question{category.questions.length !== 1 ? 's' : ''} answered
                                        </p>
                                    </button>
                                ))}
                            </div>
                        )
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 md:p-4 border-t bg-gray-50">
                    <button
                        onClick={onClose}
                        className="btn-secondary w-full"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}

function InfoTooltip({ content }: { content: string }) {
    const [isVisible, setIsVisible] = useState(false)

    return (
        <div className="relative inline-block">
            <button
                className="ml-2 text-gray-500 hover:text-gray-700 focus:outline-none"
                onClick={() => setIsVisible(!isVisible)}
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
            >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
            </button>
            {isVisible && (
                <div className="absolute z-10 w-64 px-4 py-2 text-sm text-gray-500 bg-white border rounded-lg shadow-lg bottom-full left-1/2 transform -translate-x-1/2 -translate-y-2">
                    {content}
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-white border-r border-b"></div>
                </div>
            )}
        </div>
    )
}

type SectionTab = 'overview' | 'rounds' | 'categories'

// Daily Challenge History Modal Component
function DailyChallengeHistoryModal({ 
    stats, 
    onClose 
}: { 
    stats: DailyChallengeStats | null
    onClose: () => void 
}) {
    const { user } = useAuth()
    const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({})
    const [revealedMyAnswers, setRevealedMyAnswers] = useState<Record<string, boolean>>({})
    const [disputeSubmitted, setDisputeSubmitted] = useState<Record<string, boolean>>({})

    // Prevent background scrolling when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = 'unset'
        }
    }, [])

    const toggleAnswer = (questionId: string) => {
        setRevealedAnswers(prev => ({
            ...prev,
            [questionId]: !prev[questionId]
        }))
    }

    const toggleMyAnswer = (questionId: string) => {
        setRevealedMyAnswers(prev => ({
            ...prev,
            [questionId]: !prev[questionId]
        }))
    }

    const handleDispute = async (entry: DailyChallengeStats['history'][0]) => {
        if (!user?.id || !entry.userAnswer || disputeSubmitted[entry.questionId]) return

        try {
            const response = await fetch('/api/answers/disputes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    questionId: entry.questionId,
                    gameId: null,
                    mode: 'DAILY_CHALLENGE',
                    round: 'FINAL' as const,
                    userAnswer: entry.userAnswer,
                    systemWasCorrect: false
                })
            })

            if (!response.ok) {
                const error = await response.json()
                console.error('Failed to submit dispute:', error.error)
                return
            }

            setDisputeSubmitted(prev => ({
                ...prev,
                [entry.questionId]: true
            }))
        } catch (error) {
            console.error('Error submitting dispute:', error)
        }
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        })
    }

    if (!stats || stats.history.length === 0) {
        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 md:p-4 z-50 animate-fade-in">
                <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-fade-in-slide-down">
                    <div className="p-4 md:p-6 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                        <div className="flex justify-between items-start gap-4">
                            <div className="min-w-0">
                                <h2 className="text-xl md:text-2xl font-bold truncate">Daily Challenge History</h2>
                                <p className="text-blue-100 mt-1 text-xs md:text-sm">Your daily challenge attempts</p>
                            </div>
                            <button 
                                onClick={onClose} 
                                className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10 flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-white/50"
                                aria-label="Close modal"
                            >
                                <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
                        <div className="text-center">
                            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p className="text-gray-500 text-lg mb-2">No daily challenge history yet</p>
                            <p className="text-gray-400 text-sm mb-4">Start playing daily challenges to see your progress here!</p>
                            <Link href="/daily-challenge" className="btn-primary inline-block">
                                Play Daily Challenge
                            </Link>
                        </div>
                    </div>
                    <div className="p-3 md:p-4 border-t bg-gray-50">
                        <button
                            onClick={onClose}
                            className="btn-secondary w-full"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 md:p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-fade-in-slide-down">
                {/* Header */}
                <div className="p-4 md:p-6 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                    <div className="flex justify-between items-start gap-4">
                        <div className="min-w-0">
                            <h2 className="text-xl md:text-2xl font-bold truncate">Daily Challenge History</h2>
                            <p className="text-blue-100 mt-1 text-xs md:text-sm">Your daily challenge attempts</p>
                        </div>
                        <button 
                            onClick={onClose} 
                            className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10 flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-white/50"
                            aria-label="Close modal"
                        >
                            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    
                    {/* Summary stats */}
                    <div className="flex flex-wrap gap-3 md:gap-6 mt-4 text-xs md:text-sm">
                        <div>
                            <span className="text-blue-200">Completed:</span>
                            <span className="ml-1.5 font-semibold">{stats.totalCompleted}</span>
                        </div>
                        <div>
                            <span className="text-blue-200">Correct:</span>
                            <span className="ml-1.5 font-semibold text-green-300">{stats.totalCorrect}</span>
                        </div>
                        <div>
                            <span className="text-blue-200">Accuracy:</span>
                            <span className="ml-1.5 font-semibold">{stats.accuracy}%</span>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1 p-4">
                    <div className="space-y-3">
                        {stats.history.map((entry) => (
                            <div
                                key={entry.questionId}
                                className={`border rounded-lg p-4 transition-all ${
                                    entry.correct 
                                        ? 'bg-green-50 border-green-200' 
                                        : 'bg-red-50 border-red-200'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <span className={`text-lg ${entry.correct ? 'text-green-600' : 'text-red-500'}`}>
                                            {entry.correct ? '✓' : '✗'}
                                        </span>
                                        <div>
                                            <div className="font-semibold text-gray-900">{formatDate(entry.challengeDate)}</div>
                                            <div className="text-sm text-gray-600">{entry.categoryName}</div>
                                        </div>
                                    </div>
                                    {entry.airDate && (
                                        <div className="text-right text-xs text-gray-500">
                                            <div>Originally aired:</div>
                                            <div>{formatDate(entry.airDate)}</div>
                                        </div>
                                    )}
                                </div>
                                
                                <p className="text-gray-900 mb-3">{entry.question}</p>
                                
                                <div className="flex flex-wrap gap-3">
                                    <button
                                        onClick={() => toggleAnswer(entry.questionId)}
                                        className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
                                    >
                                        {revealedAnswers[entry.questionId] ? (
                                            <>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                </svg>
                                                Hide Answer
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                                Show Answer
                                            </>
                                        )}
                                    </button>
                                    
                                    {!entry.correct && entry.userAnswer && (
                                        <button
                                            onClick={() => toggleMyAnswer(entry.questionId)}
                                            className="text-orange-600 hover:text-orange-800 text-sm font-medium flex items-center gap-1"
                                        >
                                            {revealedMyAnswers[entry.questionId] ? (
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
                                    )}
                                </div>
                                
                                {revealedAnswers[entry.questionId] && (
                                    <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200">
                                        <p className="text-gray-700 font-medium italic">{entry.answer}</p>
                                        {!entry.correct && entry.userAnswer && user?.id && (
                                            <div className="mt-2 pt-2 border-t border-gray-100 flex justify-end">
                                                {disputeSubmitted[entry.questionId] ? (
                                                    <span className="text-sm text-gray-500 flex items-center gap-1">
                                                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                        Dispute submitted
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1">
                                                        <button
                                                            onClick={() => handleDispute(entry)}
                                                            className="text-sm text-gray-500 hover:text-gray-700 underline"
                                                        >
                                                            Dispute this answer
                                                        </button>
                                                        <span className="relative group">
                                                            <span className="w-4 h-4 inline-flex items-center justify-center text-xs text-gray-500 hover:text-gray-700 cursor-help border border-gray-400 rounded-full">i</span>
                                                            <span className="absolute bottom-full right-0 mb-2 px-3 py-2 text-xs text-white bg-gray-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                                                An admin will review your answer.<br/>If approved, you&apos;ll be retroactively credited.
                                                            </span>
                                                        </span>
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                {revealedMyAnswers[entry.questionId] && entry.userAnswer && (
                                    <div className="mt-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                                        <p className="text-xs text-orange-700 font-semibold mb-1">Your last answer:</p>
                                        <p className="text-gray-800 italic">{entry.userAnswer}</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-3 md:p-4 border-t bg-gray-50">
                    <button
                        onClick={onClose}
                        className="btn-secondary w-full"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function StatsPage() {
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(true)
    const [selectedStatModal, setSelectedStatModal] = useState<StatModalType>(null)
    const [error, setError] = useState<string | null>(null)
    const [selectedCategory, setSelectedCategory] = useState<CategoryStats | null>(null)
    const [selectedRound, setSelectedRound] = useState<SelectedRound>(null)
    const [showUnstarted, setShowUnstarted] = useState(false)
    const [showBackToTop, setShowBackToTop] = useState(false)
    const [activeCategoryFilter, setActiveCategoryFilter] = useState<CategoryFilter>('ALL')
    const [dailyChallengeStats, setDailyChallengeStats] = useState<DailyChallengeStats | null>(null)
    const [dailyChallengeLoading, setDailyChallengeLoading] = useState(true)
    const [showDailyChallengeHistory, setShowDailyChallengeHistory] = useState(false)
    const [todayChallengeCompleted, setTodayChallengeCompleted] = useState<boolean | null>(null)
    const { user, loading: authLoading } = useAuth()
    const router = useRouter()

    // Section navigation state
    const [activeSection, setActiveSection] = useState<SectionTab>('overview')
    const overviewRef = useRef<HTMLDivElement | null>(null)
    const roundsRef = useRef<HTMLDivElement | null>(null)
    const categoriesRef = useRef<HTMLDivElement | null>(null)

    // Lazy loading state for unstarted categories
    const UNSTARTED_PAGE_SIZE = 50
    const [unstartedVisibleCount, setUnstartedVisibleCount] = useState(UNSTARTED_PAGE_SIZE)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const sentinelRef = useRef<HTMLDivElement | null>(null)

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

    // Handle section navigation - on mobile, switch tabs; on desktop, scroll to section
    const handleSectionNav = (section: SectionTab) => {
        const isMobile = window.innerWidth < 768 // md breakpoint
        
        if (isMobile) {
            // On mobile, just switch the active section (tab behavior)
            setActiveSection(section)
            // Scroll to top of content area
            window.scrollTo({ top: 0, behavior: 'smooth' })
        } else {
            // On desktop, scroll to the section
            const refMap = {
                overview: overviewRef,
                rounds: roundsRef,
                categories: categoriesRef
            }
            const targetRef = refMap[section]
            if (targetRef.current) {
                const navHeight = 120 // Account for sticky nav
                const elementPosition = targetRef.current.getBoundingClientRect().top + window.scrollY
                window.scrollTo({ top: elementPosition - navHeight, behavior: 'smooth' })
            }
            setActiveSection(section)
        }
    }

    // Reset unstarted visible count when toggle or filter changes
    useEffect(() => {
        setUnstartedVisibleCount(UNSTARTED_PAGE_SIZE)
    }, [showUnstarted, activeCategoryFilter])

    // Infinite scroll for unstarted categories
    useEffect(() => {
        // Only set up observer if unstarted categories are shown and sentinel exists
        if (!showUnstarted) return
        
        const sentinel = sentinelRef.current
        if (!sentinel) return

        const observer = new IntersectionObserver(
            (entries) => {
                const [entry] = entries
                if (entry.isIntersecting && !isLoadingMore) {
                    setIsLoadingMore(true)
                    // Use setTimeout to debounce and allow React to batch updates
                    setTimeout(() => {
                        setUnstartedVisibleCount((prev) => {
                            // Increment by page size, will be capped by slice operation
                            return prev + UNSTARTED_PAGE_SIZE
                        })
                        setIsLoadingMore(false)
                    }, 100)
                }
            },
            {
                rootMargin: '100px', // Start loading before reaching the bottom
                threshold: 0.1
            }
        )

        observer.observe(sentinel)

        return () => {
            observer.disconnect()
        }
    }, [showUnstarted, isLoadingMore])

    useEffect(() => {
        let mounted = true

        const fetchStats = async () => {
            if (authLoading) return
            
            if (!user) {
                router.push('/sign-in?redirect_url=/stats')
                return
            }

            try {
                const response = await fetch(`/api/stats?userId=${user.id}`)
                if (!response.ok) {
                    throw new Error(await response.text())
                }

                const data = await response.json()
                if (mounted) {
                    setStats(data)
                    setError(null)
                }
            } catch (err) {
                console.error('Error fetching stats:', err)
                if (mounted) {
                    setError(err instanceof Error ? err.message : 'An error occurred')
                }
            } finally {
                if (mounted) {
                    setLoading(false)
                }
            }
        }

        fetchStats()

        return () => {
            mounted = false
        }
    }, [user, authLoading, router])

    // Fetch daily challenge stats and today's challenge status
    useEffect(() => {
        let mounted = true

        const fetchDailyChallengeData = async () => {
            if (authLoading || !user) {
                return
            }

            setDailyChallengeLoading(true)
            try {
                // Fetch stats
                const statsResponse = await fetch('/api/daily-challenge/stats')
                if (statsResponse.ok) {
                    const statsData = await statsResponse.json()
                    if (mounted) {
                        setDailyChallengeStats(statsData)
                    }
                } else if (statsResponse.status === 401) {
                    // Not authenticated, skip silently
                    if (mounted) {
                        setDailyChallengeStats(null)
                    }
                } else {
                    // Other error, log but don't show error to user
                    console.error('Error fetching daily challenge stats:', await statsResponse.text())
                    if (mounted) {
                        setDailyChallengeStats(null)
                    }
                }

                // Check if today's challenge is completed
                const todayResponse = await fetch('/api/daily-challenge')
                if (todayResponse.ok) {
                    const todayData = await todayResponse.json()
                    if (mounted) {
                        setTodayChallengeCompleted(todayData.userAnswer !== null)
                    }
                } else {
                    if (mounted) {
                        setTodayChallengeCompleted(false)
                    }
                }
            } catch (err) {
                console.error('Error fetching daily challenge data:', err)
                if (mounted) {
                    setDailyChallengeStats(null)
                    setTodayChallengeCompleted(false)
                }
            } finally {
                if (mounted) {
                    setDailyChallengeLoading(false)
                }
            }
        }

        fetchDailyChallengeData()

        return () => {
            mounted = false
        }
    }, [user, authLoading])

    const handleCategoryClick = async (category: CategoryStats) => {
        try {
            const response = await fetch(`/api/stats/category?name=${encodeURIComponent(category.categoryName)}`)
            if (!response.ok) throw new Error('Failed to fetch category details')

            const data = await response.json()
            setSelectedCategory({
                ...category,
                questions: data.questions,
                total: data.totalQuestions,
                correct: data.correctQuestions
            })
        } catch (error) {
            console.error('Error fetching category details:', error)
        }
    }

    const handlePracticeCategory = async (categoryName: string, isComplete: boolean) => {
        try {
            // First, get the knowledge category for this category
            const response = await fetch(`/api/stats/category/knowledge?name=${encodeURIComponent(categoryName)}`)
            if (!response.ok) throw new Error('Failed to fetch category knowledge details')

            const { knowledgeCategory, categoryId } = await response.json()

            // If category is complete, go to the categories list within that knowledge category
            if (isComplete) {
                router.push(`/practice/category?knowledgeCategory=${encodeURIComponent(knowledgeCategory)}`)
            } else {
                // If incomplete, go to the questions list for this specific category
                router.push(`/practice/category?knowledgeCategory=${encodeURIComponent(knowledgeCategory)}&category=${encodeURIComponent(categoryId)}`)
            }
        } catch (error) {
            console.error('Error navigating to practice category:', error)
            // Fallback to simple navigation if there's an error
            router.push('/practice/category')
        }
    }

    // Split and sort categories
    const categorizeAndSortStats = (categoryStats: CategoryStats[]) => {
        const inProgress = []
        const notStarted = []

        for (const category of categoryStats) {
            if (category.correct > 0) {
                inProgress.push(category)
            } else {
                notStarted.push(category)
            }
        }

        // Sort in progress categories by completion percentage ascending (least complete first)
        // then by most recent air date
        inProgress.sort((a, b) => {
            const aCompletion = a.correct / a.total
            const bCompletion = b.correct / b.total
            if (aCompletion !== bCompletion) {
                return aCompletion - bCompletion // Ascending by completion
            }
            // If completion % is the same, sort by air date descending
            const aDate = a.mostRecentAirDate ? new Date(a.mostRecentAirDate) : new Date(0)
            const bDate = b.mostRecentAirDate ? new Date(b.mostRecentAirDate) : new Date(0)
            return bDate.getTime() - aDate.getTime()
        })

        // Sort not started categories by air date
        notStarted.sort((a, b) => {
            const aDate = a.mostRecentAirDate ? new Date(a.mostRecentAirDate) : new Date(0)
            const bDate = b.mostRecentAirDate ? new Date(b.mostRecentAirDate) : new Date(0)
            return bDate.getTime() - aDate.getTime()
        })

        return { inProgress, notStarted }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex justify-center items-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="spinner text-blue-600"></div>
                    <p className="text-gray-600">Loading your statistics...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-100 flex justify-center items-center px-4">
                <div className="card p-8 text-center max-w-md">
                    <div className="w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <p className="text-lg text-gray-900 font-medium mb-2">Something went wrong</p>
                    <p className="text-gray-600">{error}</p>
                </div>
            </div>
        )
    }

    if (!stats) {
        return (
            <div className="min-h-screen bg-gray-100 flex justify-center items-center px-4">
                <div className="card p-8 text-center max-w-md">
                    <div className="w-14 h-14 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                        <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <p className="text-lg text-gray-900 font-medium mb-2">No statistics yet</p>
                    <p className="text-gray-600 mb-4">Start playing to see your progress!</p>
                    <Link href="/game" className="btn-primary">
                        Play Game
                    </Link>
                </div>
            </div>
        )
    }

    const { inProgress, notStarted } = categorizeAndSortStats(stats.categoryStats)

    // Filter categories based on active filter
    const filterCategories = (categories: CategoryStats[], filter: CategoryFilter, isNotStarted: boolean = false): CategoryStats[] => {
        if (filter === 'ALL') return categories
        
        return categories.filter(category => {
            if (filter === 'TRIPLE_STUMPER') {
                // For in-progress categories: check tripleStumpersCorrect (correctly answered)
                // For not-started categories: check tripleStumpersTotal (all triple stumper questions)
                if (isNotStarted) {
                    return (category.tripleStumpersTotal || 0) > 0
                } else {
                    return (category.tripleStumpersCorrect || 0) > 0
                }
            }
            
            // For round filters:
            // - For in-progress categories: check roundBreakdown (correct answers)
            // - For not-started categories: check roundBreakdownTotal (all questions)
            if (isNotStarted) {
                const roundBreakdownTotal = category.roundBreakdownTotal || { SINGLE: 0, DOUBLE: 0, FINAL: 0 }
                return roundBreakdownTotal[filter as 'SINGLE' | 'DOUBLE' | 'FINAL'] > 0
            } else {
                const roundBreakdown = category.roundBreakdown || { SINGLE: 0, DOUBLE: 0, FINAL: 0 }
                return roundBreakdown[filter as 'SINGLE' | 'DOUBLE' | 'FINAL'] > 0
            }
        })
    }

    const visibleInProgress = filterCategories(inProgress, activeCategoryFilter, false)
    const visibleNotStarted = filterCategories(notStarted, activeCategoryFilter, true)
    
    // Create paginated slice for unstarted categories
    const visibleNotStartedPage = visibleNotStarted.slice(0, unstartedVisibleCount)
    const hasMoreUnstarted = visibleNotStartedPage.length < visibleNotStarted.length

    return (
        <div className="min-h-screen bg-gray-100 py-6 md:py-8">
            <div className="container mx-auto px-4 sm:px-6">
                {/* Page Header */}
                <div className="page-header mb-4 md:mb-6">
                    <span className="text-[10px] md:text-xs font-semibold text-gray-500 uppercase tracking-wider">Progress</span>
                    <h1 className="page-title text-2xl sm:text-3xl md:text-4xl flex items-center gap-2 md:gap-3 mt-1 mb-1 md:mb-2">
                        <svg className="w-6 h-6 sm:w-7 sm:h-7 md:w-9 md:h-9 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <span>Your Statistics</span>
                    </h1>
                    <p className="page-subtitle text-sm md:text-base text-gray-600">
                        Track your performance and progress across all categories.
                    </p>
                </div>

                {/* Sticky Section Navigation Pills */}
                <div className="sticky top-0 z-40 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-gray-100/95 backdrop-blur-sm border-b border-gray-200 mb-4 md:mb-6">
                    <nav className="flex gap-2" role="tablist" aria-label="Statistics sections">
                        {([
                            { id: 'overview' as SectionTab, label: 'Overview', icon: (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            )},
                            { id: 'rounds' as SectionTab, label: 'Rounds', icon: (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                </svg>
                            )},
                            { id: 'categories' as SectionTab, label: 'Categories', icon: (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                            )}
                        ]).map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => handleSectionNav(tab.id)}
                                role="tab"
                                aria-selected={activeSection === tab.id}
                                aria-controls={`section-${tab.id}`}
                                className={`
                                    flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-all
                                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                                    ${activeSection === tab.id 
                                        ? 'bg-blue-600 text-white shadow-md' 
                                        : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 hover:border-gray-300'
                                    }
                                `}
                            >
                                {tab.icon}
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Section: Overview (Top-Level Stats Summary) */}
                <div 
                    ref={overviewRef}
                    id="section-overview"
                    role="tabpanel"
                    aria-labelledby="tab-overview"
                    className={`${activeSection !== 'overview' ? 'hidden md:block' : ''} mb-6 md:mb-8`}
                >
                    {/* Section Header - visible on mobile when this tab is active */}
                    <div className="flex items-start gap-3 mb-4 md:hidden">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Overview</h2>
                            <p className="text-sm text-gray-500">Your key performance metrics</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    <button 
                        onClick={() => setSelectedStatModal('points')}
                        className="stat-card group cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        aria-label="View total points details"
                    >
                        <div className="stat-label flex items-center gap-1.5">
                            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Total Points
                        </div>
                        <div className="stat-value">${stats.totalPoints.toLocaleString()}</div>
                        <p className="text-xs text-gray-500 mt-2">Cumulative score from correct answers</p>
                        <div className="flex items-center gap-1 mt-3 text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span>View breakdown</span>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </button>

                    <button 
                        onClick={() => setSelectedStatModal('attempted')}
                        className="stat-card group cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        aria-label="View questions attempted details"
                    >
                        <div className="stat-label flex items-center gap-1.5">
                            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Questions Attempted
                        </div>
                        <div className="stat-value">
                            {stats.totalAnswered.toLocaleString()}
                            <span className="text-lg text-gray-400 font-normal"> / {stats.totalQuestions.toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Questions you&apos;ve answered</p>
                        <div className="flex items-center gap-1 mt-3 text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span>View history</span>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </button>

                    <button 
                        onClick={() => setSelectedStatModal('correct')}
                        className="stat-card group cursor-pointer hover:shadow-lg hover:border-green-300 transition-all text-left focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                        aria-label="View correct answers details"
                    >
                        <div className="stat-label flex items-center gap-1.5">
                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Accuracy
                        </div>
                        <div className="stat-value text-green-600">
                            {stats.totalAnswered > 0
                                ? Math.round((stats.correctAnswers / stats.totalAnswered) * 100)
                                : 0}%
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            {stats.correctAnswers.toLocaleString()} correct of {stats.totalAnswered.toLocaleString()} attempted
                        </p>
                        <div className="flex items-center gap-1 mt-3 text-xs text-green-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span>View answers</span>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </button>

                    <button 
                        onClick={() => setSelectedStatModal('tripleStumpers')}
                        className="stat-card group cursor-pointer hover:shadow-lg hover:border-amber-300 transition-all text-left focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 bg-gradient-to-br from-amber-50 to-white"
                        aria-label="View triple stumpers details"
                    >
                        <div className="stat-label flex items-center gap-1.5">
                            <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                            Triple Stumpers
                            <InfoTooltip content="Triple Stumpers are questions that none of the original Jeopardy! contestants answered correctly. Getting these right is extra impressive!" />
                        </div>
                        <div className="stat-value text-amber-600">{stats.tripleStumpersAnswered.toLocaleString()}</div>
                        <p className="text-xs text-gray-500 mt-2">Questions all contestants missed</p>
                        <div className="flex items-center gap-1 mt-3 text-xs text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span>View conquered</span>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </button>
                    </div>

                    {/* Daily Challenge Section */}
                    <div className="mt-8 md:mt-10">
                        {dailyChallengeLoading ? (
                            <div className="card p-6 animate-pulse">
                                <div className="h-6 bg-gray-300 rounded w-48 mb-4"></div>
                                <div className="h-20 bg-gray-200 rounded"></div>
                            </div>
                        ) : (
                            <div className="card p-6 md:p-8 bg-gradient-to-br from-purple-50 via-blue-50 to-white border-2 border-purple-200">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-purple-100 rounded-xl">
                                            <svg className="w-6 h-6 md:w-7 md:h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h2 className="text-xl md:text-2xl font-bold text-gray-900">Daily Challenge</h2>
                                            <p className="text-sm text-gray-600">Test your knowledge with a Final Jeopardy question each day</p>
                                        </div>
                                    </div>
                                    {todayChallengeCompleted === false && (
                                        <Link 
                                            href="/daily-challenge"
                                            className="btn-primary whitespace-nowrap flex items-center gap-2 justify-center"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                            </svg>
                                            Play Today&apos;s Challenge
                                        </Link>
                                    )}
                                </div>

                                {dailyChallengeStats && dailyChallengeStats.totalCompleted > 0 ? (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                        <div className="text-center">
                                            <div className="text-2xl md:text-3xl font-bold text-purple-600 mb-1">
                                                {dailyChallengeStats.correctnessStreak.current}
                                            </div>
                                            <div className="text-xs md:text-sm text-gray-600">Correct Streak</div>
                                            <div className="text-xs text-gray-500 mt-1">Best: {dailyChallengeStats.correctnessStreak.longest}</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl md:text-3xl font-bold text-blue-600 mb-1">
                                                {dailyChallengeStats.participationStreak.current}
                                            </div>
                                            <div className="text-xs md:text-sm text-gray-600">Participation Streak</div>
                                            <div className="text-xs text-gray-500 mt-1">Best: {dailyChallengeStats.participationStreak.longest}</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl md:text-3xl font-bold text-green-600 mb-1">
                                                {dailyChallengeStats.totalCorrect}
                                            </div>
                                            <div className="text-xs md:text-sm text-gray-600">Total Correct</div>
                                            <div className="text-xs text-gray-500 mt-1">of {dailyChallengeStats.totalCompleted} completed</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-2xl md:text-3xl font-bold text-amber-600 mb-1">
                                                {dailyChallengeStats.accuracy}%
                                            </div>
                                            <div className="text-xs md:text-sm text-gray-600">Accuracy</div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                {dailyChallengeStats.totalIncorrect} incorrect
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-8 mb-6">
                                        <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <p className="text-gray-600 mb-2">No daily challenges completed yet</p>
                                        <p className="text-sm text-gray-500 mb-4">Start your streak today!</p>
                                        {todayChallengeCompleted === false && (
                                            <Link href="/daily-challenge" className="btn-primary inline-flex items-center gap-2">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                </svg>
                                                Play Today&apos;s Challenge
                                            </Link>
                                        )}
                                    </div>
                                )}

                                {dailyChallengeStats && dailyChallengeStats.totalCompleted > 0 && (
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <button
                                            onClick={() => setShowDailyChallengeHistory(true)}
                                            className="btn-secondary flex-1 flex items-center justify-center gap-2"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            View History
                                        </button>
                                        {todayChallengeCompleted === false && (
                                            <Link 
                                                href="/daily-challenge"
                                                className="btn-primary flex-1 flex items-center justify-center gap-2"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                </svg>
                                                Play Today&apos;s Challenge
                                            </Link>
                                        )}
                                        {todayChallengeCompleted === true && (
                                            <Link 
                                                href="/daily-challenge"
                                                className="btn-secondary flex-1 flex items-center justify-center gap-2"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                                View Today&apos;s Result
                                            </Link>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Section: Rounds (Performance by Round) */}
                <div 
                    ref={roundsRef}
                    id="section-rounds"
                    role="tabpanel"
                    aria-labelledby="tab-rounds"
                    className={`${activeSection !== 'rounds' ? 'hidden md:block' : ''}`}
                >
                    {stats.roundStats && stats.roundStats.length > 0 && (
                        <div className="mb-6 md:mb-8">
                            <div className="flex items-start gap-3 mb-4">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 className="text-lg md:text-xl font-semibold text-gray-900">Performance by Round</h2>
                                    <p className="text-sm text-gray-500">How you&apos;re doing in each Jeopardy! round</p>
                                </div>
                            </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                            {stats.roundStats.map((round) => {
                                const progressPercent = round.totalQuestions > 0 
                                    ? Math.round((round.correctAnswers / round.totalQuestions) * 100) 
                                    : 0
                                
                                const colorConfig = {
                                    SINGLE: { 
                                        border: 'border-l-blue-500', 
                                        bar: 'bg-blue-500', 
                                        accent: 'text-blue-600',
                                        hover: 'hover:border-blue-400',
                                        ring: 'focus:ring-blue-500'
                                    },
                                    DOUBLE: { 
                                        border: 'border-l-purple-500', 
                                        bar: 'bg-purple-500', 
                                        accent: 'text-purple-600',
                                        hover: 'hover:border-purple-400',
                                        ring: 'focus:ring-purple-500'
                                    },
                                    FINAL: { 
                                        border: 'border-l-amber-500', 
                                        bar: 'bg-amber-500', 
                                        accent: 'text-amber-600',
                                        hover: 'hover:border-amber-400',
                                        ring: 'focus:ring-amber-500'
                                    }
                                }
                                const colors = colorConfig[round.round as keyof typeof colorConfig] || colorConfig.SINGLE
                                
                                return (
                                    <button
                                        key={round.round}
                                        onClick={() => setSelectedRound(round.round as SelectedRound)}
                                        className={`card border-l-4 ${colors.border} ${colors.hover} p-4 md:p-5 transition-all cursor-pointer text-left hover:shadow-lg group focus:outline-none focus:ring-2 ${colors.ring} focus:ring-offset-2`}
                                        aria-label={`View ${round.roundName} history`}
                                    >
                                        <div className="flex justify-between items-center mb-3">
                                            <h3 className={`text-base md:text-lg font-semibold ${colors.accent}`}>{round.roundName}</h3>
                                            <svg className="w-4 h-4 md:w-5 md:h-5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                        
                                        <div className="space-y-1.5 text-sm">
                                            <div className="flex justify-between text-gray-600">
                                                <span>Answered</span>
                                                <span className="font-medium text-gray-900">{round.totalAnswered} / {round.totalQuestions}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-600">
                                                <span>Correct</span>
                                                <span className="font-medium text-gray-900">{round.correctAnswers} ({round.accuracy}%)</span>
                                            </div>
                                            <div className="flex justify-between text-gray-600">
                                                <span>Points</span>
                                                <span className="font-semibold text-gray-900">${round.totalPoints.toLocaleString()}</span>
                                            </div>
                                        </div>
                                        
                                        <div className="mt-4">
                                            <div className="progress-bar">
                                                <div 
                                                    className={`progress-fill ${colors.bar}`}
                                                    style={{ width: `${progressPercent}%` }}
                                                />
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1.5 text-center">{progressPercent}% complete</p>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                    )}
                </div>

                {/* Section: Categories (Category Breakdown) */}
                <div 
                    ref={categoriesRef}
                    id="section-categories"
                    role="tabpanel"
                    aria-labelledby="tab-categories"
                    className={`${activeSection !== 'categories' ? 'hidden md:block' : ''}`}
                >
                    {(inProgress.length > 0 || notStarted.length > 0) && (
                        <div className="mb-6 md:mb-8">
                            {/* Section Header */}
                            <div className="flex items-start gap-3 mb-4">
                                <div className="p-2 bg-purple-100 rounded-lg">
                                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 className="text-lg md:text-xl font-semibold text-gray-900">Category Breakdown</h2>
                                    <p className="text-sm text-gray-500">Your progress across all Jeopardy! categories</p>
                                </div>
                            </div>
                            
                            <div className="card p-4 md:p-6">
                            {/* Filter chips and Toggle */}
                            <div className="flex flex-col md:flex-row md:flex-wrap md:items-center md:justify-between gap-3 md:gap-2 mb-5">
                                <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Filter:</span>
                                {(['ALL', 'SINGLE', 'DOUBLE', 'FINAL', 'TRIPLE_STUMPER'] as CategoryFilter[]).map((filter) => {
                                    const isActive = activeCategoryFilter === filter
                                    const getFilterStyles = () => {
                                        if (!isActive) {
                                            return 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                                        }
                                        switch (filter) {
                                            case 'SINGLE':
                                                return 'bg-blue-100 border-blue-300 text-blue-700 shadow-sm'
                                            case 'DOUBLE':
                                                return 'bg-purple-100 border-purple-300 text-purple-700 shadow-sm'
                                            case 'FINAL':
                                                return 'bg-amber-100 border-amber-300 text-amber-700 shadow-sm'
                                            case 'TRIPLE_STUMPER':
                                                return 'bg-orange-100 border-orange-300 text-orange-700 shadow-sm'
                                            default:
                                                return 'bg-gray-100 border-gray-400 text-gray-800 shadow-sm'
                                        }
                                    }
                                    const getFilterLabel = () => {
                                        switch (filter) {
                                            case 'ALL': return 'All'
                                            case 'SINGLE': return 'Single'
                                            case 'DOUBLE': return 'Double'
                                            case 'FINAL': return 'Final'
                                            case 'TRIPLE_STUMPER': return 'Triple Stumpers'
                                            default: return filter
                                        }
                                    }
                                    return (
                                        <button
                                            key={filter}
                                            onClick={() => setActiveCategoryFilter(filter)}
                                            className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-full border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${getFilterStyles()}`}
                                            aria-pressed={isActive}
                                        >
                                            {getFilterLabel()}
                                        </button>
                                    )
                                })}
                                </div>
                                
                                {/* Toggle for unstarted categories */}
                                <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 md:ml-auto">
                                    <label className="text-xs md:text-sm text-gray-600 whitespace-nowrap cursor-pointer" htmlFor="show-unstarted-toggle">
                                        Show Unstarted
                                    </label>
                                    <button
                                        id="show-unstarted-toggle"
                                        onClick={() => setShowUnstarted(!showUnstarted)}
                                        className={`relative inline-flex h-5 w-9 md:h-6 md:w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${showUnstarted ? 'bg-blue-600' : 'bg-gray-300'}`}
                                        role="switch"
                                        aria-checked={showUnstarted}
                                        aria-label="Show unstarted categories"
                                    >
                                        <span
                                            className={`inline-block h-3.5 w-3.5 md:h-4 md:w-4 transform rounded-full bg-white shadow transition-transform ${showUnstarted ? 'translate-x-4 md:translate-x-6' : 'translate-x-0.5 md:translate-x-1'}`}
                                        />
                                    </button>
                                </div>
                            </div>
                            
                            {/* Legend - collapsible on mobile */}
                            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 pt-2 border-t border-gray-100 mb-6">
                                <span className="font-medium text-gray-600">Legend:</span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
                                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                                    Single
                                </span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded">
                                    <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                                    Double
                                </span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded">
                                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                                    Final
                                </span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 rounded">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                    Triple Stumper
                                </span>
                            </div>

                        {/* In Progress Categories */}
                        {visibleInProgress.length > 0 && (
                            <div className="mb-6">
                                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                    In Progress
                                    <span className="text-xs font-normal text-gray-500 lowercase">({visibleInProgress.length})</span>
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {visibleInProgress.map((category) => {
                                        const roundBreakdown = category.roundBreakdown || { SINGLE: 0, DOUBLE: 0, FINAL: 0 }
                                        const tripleStumpers = category.tripleStumpersCorrect || 0
                                        const hasSingle = roundBreakdown.SINGLE > 0
                                        const hasDouble = roundBreakdown.DOUBLE > 0
                                        const hasFinal = roundBreakdown.FINAL > 0
                                        const hasTriple = tripleStumpers > 0
                                        const completionPercent = Math.round((category.correct / category.total) * 100)
                                        
                                        // Determine round indicator text and color
                                        const roundIndicators = []
                                        if (hasSingle) roundIndicators.push({ text: 'Single', color: 'blue' })
                                        if (hasDouble) roundIndicators.push({ text: 'Double', color: 'purple' })
                                        if (hasFinal) roundIndicators.push({ text: 'Final', color: 'amber' })
                                        
                                        const roundText = roundIndicators.map(r => r.text).join(' · ')
                                        const primaryRoundColor = roundIndicators.length > 0 ? roundIndicators[0].color : 'gray'
                                        
                                        return (
                                            <button
                                                key={category.categoryName}
                                                onClick={() => handleCategoryClick(category)}
                                                className="category-card group text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                                aria-label={`View ${category.categoryName} details`}
                                            >
                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                    <h4 className="font-semibold text-gray-900 text-sm md:text-base leading-tight group-hover:text-blue-600 transition-colors line-clamp-2">
                                                        {category.categoryName}
                                                    </h4>
                                                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </div>
                                                
                                                {/* Progress bar */}
                                                <div className="mb-2">
                                                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                                                        <span>{category.correct}/{category.total} correct</span>
                                                        <span className="font-medium text-gray-700">{completionPercent}%</span>
                                                    </div>
                                                    <div className="progress-bar h-1.5">
                                                        <div 
                                                            className={`progress-fill ${
                                                                primaryRoundColor === 'blue' ? 'bg-blue-500' :
                                                                primaryRoundColor === 'purple' ? 'bg-purple-500' :
                                                                primaryRoundColor === 'amber' ? 'bg-amber-500' :
                                                                'bg-gray-400'
                                                            }`}
                                                            style={{ width: `${completionPercent}%` }}
                                                        />
                                                    </div>
                                                </div>
                                                
                                                <p className="text-xs text-gray-500 mb-2">
                                                    <span className="font-medium text-gray-700">${category.points.toLocaleString()}</span> points earned
                                                </p>
                                                
                                                {/* Round/Triple indicators */}
                                                <div className="flex items-center flex-wrap gap-1.5">
                                                    {roundIndicators.length > 0 && (
                                                        <span 
                                                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] md:text-xs font-medium rounded ${
                                                                primaryRoundColor === 'blue' ? 'bg-blue-50 text-blue-700' :
                                                                primaryRoundColor === 'purple' ? 'bg-purple-50 text-purple-700' :
                                                                'bg-amber-50 text-amber-700'
                                                            }`}
                                                            title={`Rounds: ${roundText}`}
                                                        >
                                                            {roundText}
                                                        </span>
                                                    )}
                                                    {hasTriple && (
                                                        <span 
                                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-orange-50 text-orange-700 text-[10px] md:text-xs rounded font-medium"
                                                            title="Contains triple stumper questions"
                                                        >
                                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                            </svg>
                                                            Stumper
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Not Started Categories */}
                        {showUnstarted && visibleNotStarted.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                                    Not Started
                                    <span className="text-xs font-normal text-gray-500 lowercase">({visibleNotStarted.length})</span>
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {visibleNotStartedPage.map((category) => (
                                        <button
                                            key={category.categoryName}
                                            onClick={() => handleCategoryClick(category)}
                                            className="bg-gray-50 border border-gray-200 p-3 md:p-4 rounded-lg hover:bg-white hover:shadow-md hover:border-gray-300 transition-all text-left group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                            aria-label={`View ${category.categoryName} details`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <h4 className="font-medium text-gray-700 text-sm leading-tight group-hover:text-gray-900 transition-colors line-clamp-2">
                                                    {category.categoryName}
                                                </h4>
                                                <svg className="w-4 h-4 text-gray-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1.5">
                                                {category.total.toLocaleString()} question{category.total !== 1 ? 's' : ''} available
                                            </p>
                                        </button>
                                    ))}
                                </div>
                                
                                {/* Loading indicator and sentinel for infinite scroll */}
                                {hasMoreUnstarted && (
                                    <>
                                        {isLoadingMore && (
                                            <div className="flex justify-center items-center py-4 text-gray-500 text-sm">
                                                <div className="spinner mr-2"></div>
                                                Loading more categories...
                                            </div>
                                        )}
                                        {/* Sentinel element for IntersectionObserver */}
                                        <div 
                                            ref={sentinelRef}
                                            className="h-1 w-full"
                                            aria-hidden="true"
                                        />
                                        {/* Fallback "Load more" button */}
                                        <div className="flex justify-center mt-4">
                                            <button
                                                onClick={() => {
                                                    setIsLoadingMore(true)
                                                    setTimeout(() => {
                                                        setUnstartedVisibleCount((prev) => 
                                                            Math.min(prev + UNSTARTED_PAGE_SIZE, visibleNotStarted.length)
                                                        )
                                                        setIsLoadingMore(false)
                                                    }, 100)
                                                }}
                                                className="btn-secondary btn-sm"
                                            >
                                                Load More Categories
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Empty state when filter returns no results */}
                        {visibleInProgress.length === 0 && visibleNotStarted.length === 0 && (
                            <div className="text-center py-12">
                                <div className="w-12 h-12 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <p className="text-gray-700 font-medium mb-1">No categories match the selected filter</p>
                                <p className="text-sm text-gray-500">Try selecting a different filter or click &quot;All&quot; to see all categories.</p>
                            </div>
                        )}
                    </div>
                    </div>
                    )}
                </div>

                {selectedCategory && (
                    <CategoryModal
                        category={selectedCategory}
                        onClose={() => setSelectedCategory(null)}
                        onPractice={() => handlePracticeCategory(selectedCategory.categoryName, selectedCategory.correct === selectedCategory.total)}
                    />
                )}

                {selectedStatModal && (
                    <StatsDetailModal
                        type={selectedStatModal}
                        onClose={() => setSelectedStatModal(null)}
                    />
                )}

                {selectedRound && (
                    <RoundHistoryModal
                        round={selectedRound}
                        roundStats={stats.roundStats?.find(r => r.round === selectedRound)}
                        onClose={() => setSelectedRound(null)}
                    />
                )}

                {showDailyChallengeHistory && (
                    <DailyChallengeHistoryModal
                        stats={dailyChallengeStats}
                        onClose={() => setShowDailyChallengeHistory(false)}
                    />
                )}

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