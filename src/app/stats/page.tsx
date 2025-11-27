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

// Stats Detail Modal Component
function StatsDetailModal({ 
    type, 
    onClose 
}: { 
    type: StatModalType
    onClose: () => void 
}) {
    const [questions, setQuestions] = useState<HistoryQuestion[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'correct' | 'incorrect'>('incorrect')
    const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({})
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
        fetchQuestions(tab)
    }

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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold">{getTitle()}</h2>
                            <p className="text-blue-100 mt-1 text-sm">{getDescription()}</p>
                        </div>
                        <button 
                            onClick={onClose} 
                            className="text-white/80 hover:text-white transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    
                    {/* Summary stats */}
                    <div className="flex gap-6 mt-4 text-sm">
                        <div>
                            <span className="text-blue-200">Total Attempted:</span>
                            <span className="ml-2 font-semibold">{summary.totalAttempted}</span>
                        </div>
                        <div>
                            <span className="text-blue-200">Correct:</span>
                            <span className="ml-2 font-semibold text-green-300">{summary.totalCorrect}</span>
                        </div>
                        <div>
                            <span className="text-blue-200">Incorrect:</span>
                            <span className="ml-2 font-semibold text-red-300">{summary.totalIncorrect}</span>
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
                                    
                                    {revealedAnswers[question.id] && (
                                        <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                                            <p className="text-gray-700 font-medium italic">{question.answer}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50">
                    <button
                        onClick={onClose}
                        className="w-full py-2 px-4 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors font-medium text-gray-700"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                <div className="p-6 border-b">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-bold text-black">{category.categoryName}</h2>
                            <p className="text-sm text-gray-500 mt-1">{formatDate(categoryAirDate)}</p>
                        </div>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <p className="text-gray-600 mt-2">
                        {category.correct} / {category.total} correct ({Math.round((category.correct / category.total) * 100)}%)
                    </p>
                </div>

                <div className="overflow-y-auto flex-1 p-6">
                    <div className="space-y-4">
                        {category.questions.map(question => (
                            <div
                                key={question.id}
                                className={`border rounded-lg p-4 ${question.correct ? 'bg-green-50' : 'bg-gray-50'
                                    }`}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-lg ${question.correct ? 'text-green-600' : 'text-gray-400'}`}>
                                        {question.correct ? '✓' : '○'}
                                    </span>
                                    <span className="font-medium text-black">${question.value}</span>
                                </div>
                                {question.correct ? (
                                    <>
                                        <p className="text-gray-900 mb-2">{question.question}</p>
                                        <button
                                            onClick={() => toggleAnswer(question.id)}
                                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                        >
                                            {revealedAnswers[question.id] ? 'Hide Answer' : 'Show Answer'}
                                        </button>
                                        {revealedAnswers[question.id] && (
                                            <p className="mt-2 text-gray-700 italic">{question.answer}</p>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-gray-500 italic">Question not yet answered correctly</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-6 border-t">
                    <button
                        onClick={onPractice}
                        className={`w-full py-2 px-4 rounded-lg transition-colors font-bold text-white ${isComplete ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
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
    const router = useRouter()
    const [questions, setQuestions] = useState<RoundHistoryQuestion[]>([])
    const [categories, setCategories] = useState<RoundHistoryCategory[]>([])
    const [loading, setLoading] = useState(true)
    const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({})
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className={`p-6 border-b bg-gradient-to-r ${getHeaderColor()} text-white`}>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-2xl font-bold">{getRoundName()} History</h2>
                            <p className="text-white/80 mt-1 text-sm">Questions you&apos;ve answered in this round</p>
                        </div>
                        <button 
                            onClick={onClose} 
                            className="text-white/80 hover:text-white transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    
                    {/* Practice Button */}
                    <Link
                        href={getPracticeUrl()}
                        className={`inline-flex items-center gap-2 px-6 py-3 bg-white rounded-lg font-bold transition-colors shadow-lg ${
                            round === 'SINGLE' ? 'text-blue-700 hover:bg-blue-50' :
                            round === 'DOUBLE' ? 'text-purple-700 hover:bg-purple-50' :
                            'text-amber-700 hover:bg-amber-50'
                        }`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Practice {getRoundName()} Questions
                    </Link>
                    
                    {/* Summary stats */}
                    <div className="flex gap-6 mt-4 text-sm">
                        <div>
                            <span className="text-white/70">Attempted:</span>
                            <span className="ml-2 font-semibold">{summary.totalAttempted} / {roundStats?.totalQuestions || 0}</span>
                        </div>
                        <div>
                            <span className="text-white/70">Correct:</span>
                            <span className="ml-2 font-semibold text-green-300">{summary.totalCorrect}</span>
                        </div>
                        <div>
                            <span className="text-white/70">Incorrect:</span>
                            <span className="ml-2 font-semibold text-red-300">{summary.totalIncorrect}</span>
                        </div>
                        <div>
                            <span className="text-white/70">Points:</span>
                            <span className="ml-2 font-semibold">${summary.totalPoints.toLocaleString()}</span>
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
                                        
                                        {revealedAnswers[question.id] && (
                                            <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                                                <p className="text-gray-700 font-medium italic">{question.answer}</p>
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
                <div className="p-4 border-t bg-gray-50">
                    <button
                        onClick={onClose}
                        className="w-full py-2 px-4 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors font-medium text-gray-700"
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
    const { user, loading: authLoading } = useAuth()
    const router = useRouter()

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
                router.push('/auth/signin')
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
            <div className="flex justify-center items-center min-h-[60vh]">
                <div className="text-xl text-black">Loading statistics...</div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="text-center p-4">
                <p className="text-lg text-black">{error}</p>
            </div>
        )
    }

    if (!stats) {
        return (
            <div className="text-center p-4">
                <p className="text-lg text-black">No statistics available yet. Start playing to see your progress!</p>
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
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-8 text-black">Your Statistics</h1>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                <button 
                    onClick={() => setSelectedStatModal('points')}
                    className="bg-blue-200 p-6 rounded-lg shadow-md hover:bg-blue-300 hover:shadow-lg transition-all text-left group"
                >
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-lg font-semibold text-black">Total Points</h2>
                        <svg className="w-5 h-5 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                    <p className="text-3xl font-bold text-black">${stats.totalPoints.toLocaleString()}</p>
                    <p className="text-sm text-blue-700 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">Click to view details →</p>
                </button>
                <button 
                    onClick={() => setSelectedStatModal('attempted')}
                    className="bg-blue-200 p-6 rounded-lg shadow-md hover:bg-blue-300 hover:shadow-lg transition-all text-left group"
                >
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-lg font-semibold text-black">Questions Attempted</h2>
                        <svg className="w-5 h-5 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                    <p className="text-3xl font-bold text-black">
                        {stats.totalAnswered.toLocaleString()} / {stats.totalQuestions.toLocaleString()}
                    </p>
                    <p className="text-sm text-blue-700 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">Click to view details →</p>
                </button>
                <button 
                    onClick={() => setSelectedStatModal('correct')}
                    className="bg-blue-200 p-6 rounded-lg shadow-md hover:bg-blue-300 hover:shadow-lg transition-all text-left group"
                >
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-lg font-semibold text-black">Correct Answers</h2>
                        <svg className="w-5 h-5 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                    <p className="text-3xl font-bold text-black">
                        {stats.correctAnswers.toLocaleString()} ({stats.totalAnswered > 0
                            ? Math.round((stats.correctAnswers / stats.totalAnswered) * 100)
                            : 0}%)
                    </p>
                    <p className="text-sm text-blue-700 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">Click to view details →</p>
                </button>
                <button 
                    onClick={() => setSelectedStatModal('tripleStumpers')}
                    className="bg-yellow-200 p-6 rounded-lg shadow-md hover:bg-yellow-300 hover:shadow-lg transition-all text-left group lg:col-start-2 lg:col-end-3 xl:col-auto"
                >
                    <div className="flex items-center mb-2">
                        <h2 className="text-lg font-semibold text-black">Triple Stumpers</h2>
                        <InfoTooltip content="Triple Stumpers are questions that none of the original Jeopardy! contestants answered correctly. Getting these right is extra impressive!" />
                        <svg className="w-5 h-5 text-yellow-700 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                    <p className="text-3xl font-bold text-black">{stats.tripleStumpersAnswered.toLocaleString()}</p>
                    <p className="text-sm text-yellow-700 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">Click to view details →</p>
                </button>
            </div>

            {/* Round Breakdown Section */}
            {stats.roundStats && stats.roundStats.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-xl font-semibold text-black mb-4">Performance by Round</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {stats.roundStats.map((round) => {
                            const progressPercent = round.totalQuestions > 0 
                                ? Math.round((round.correctAnswers / round.totalQuestions) * 100) 
                                : 0
                            const bgColor = round.round === 'SINGLE' ? 'bg-blue-100' : 
                                           round.round === 'DOUBLE' ? 'bg-purple-100' : 'bg-amber-100'
                            const barColor = round.round === 'SINGLE' ? 'bg-blue-500' : 
                                            round.round === 'DOUBLE' ? 'bg-purple-500' : 'bg-amber-500'
                            const hoverColor = round.round === 'SINGLE' ? 'hover:bg-blue-200' : 
                                             round.round === 'DOUBLE' ? 'hover:bg-purple-200' : 'hover:bg-amber-200'
                            
                            return (
                                <button
                                    key={round.round}
                                    onClick={() => setSelectedRound(round.round as SelectedRound)}
                                    className={`${bgColor} ${hoverColor} p-5 rounded-lg shadow-md transition-all cursor-pointer text-left hover:shadow-lg group`}
                                >
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="text-lg font-semibold text-black">{round.roundName}</h3>
                                        <svg className="w-5 h-5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm text-gray-700">
                                            <span>Answered:</span>
                                            <span className="font-medium">{round.totalAnswered} / {round.totalQuestions}</span>
                                        </div>
                                        <div className="flex justify-between text-sm text-gray-700">
                                            <span>Correct:</span>
                                            <span className="font-medium">{round.correctAnswers} ({round.accuracy}%)</span>
                                        </div>
                                        <div className="flex justify-between text-sm text-gray-700">
                                            <span>Points:</span>
                                            <span className="font-medium">${round.totalPoints.toLocaleString()}</span>
                                        </div>
                                        <div className="mt-3">
                                            <div className="w-full bg-white/50 rounded-full h-2">
                                                <div 
                                                    className={`${barColor} h-2 rounded-full transition-all duration-500`}
                                                    style={{ width: `${progressPercent}%` }}
                                                />
                                            </div>
                                            <p className="text-xs text-gray-600 mt-1 text-center">{progressPercent}% complete</p>
                                        </div>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}

            {(inProgress.length > 0 || notStarted.length > 0) && (
                <div>
                    <div className="mb-4">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
                            <h2 className="text-xl font-semibold text-black">Category Breakdown</h2>
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-gray-600 whitespace-nowrap">Show Unstarted Categories</label>
                                <button
                                    onClick={() => setShowUnstarted(!showUnstarted)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${showUnstarted ? 'bg-blue-600' : 'bg-gray-200'
                                        }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showUnstarted ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                    />
                                </button>
                            </div>
                        </div>
                        
                        {/* Filter chips */}
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className="text-sm text-gray-600 mr-1">Filter by:</span>
                            {(['ALL', 'SINGLE', 'DOUBLE', 'FINAL', 'TRIPLE_STUMPER'] as CategoryFilter[]).map((filter) => {
                                const isActive = activeCategoryFilter === filter
                                const getFilterStyles = () => {
                                    if (!isActive) {
                                        return 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                    }
                                    switch (filter) {
                                        case 'SINGLE':
                                            return 'bg-blue-50 border-blue-500 text-blue-700'
                                        case 'DOUBLE':
                                            return 'bg-purple-50 border-purple-500 text-purple-700'
                                        case 'FINAL':
                                            return 'bg-amber-50 border-amber-500 text-amber-700'
                                        case 'TRIPLE_STUMPER':
                                            return 'bg-orange-50 border-orange-500 text-orange-700'
                                        default:
                                            return 'bg-gray-100 border-gray-500 text-gray-700'
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
                                        className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${getFilterStyles()}`}
                                    >
                                        {getFilterLabel()}
                                    </button>
                                )
                            })}
                        </div>
                        
                        {/* Legend */}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mb-2">
                            <span className="font-medium">Legend:</span>
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">Single</span>
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">Double</span>
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">Final</span>
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded font-medium">Triple Stumper</span>
                        </div>
                    </div>

                    {visibleInProgress.length > 0 && (
                        <>
                            <h3 className="text-lg font-medium text-gray-700 mb-3">In Progress</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                                {visibleInProgress.map((category) => {
                                    const roundBreakdown = category.roundBreakdown || { SINGLE: 0, DOUBLE: 0, FINAL: 0 }
                                    const tripleStumpers = category.tripleStumpersCorrect || 0
                                    const hasSingle = roundBreakdown.SINGLE > 0
                                    const hasDouble = roundBreakdown.DOUBLE > 0
                                    const hasFinal = roundBreakdown.FINAL > 0
                                    const hasTriple = tripleStumpers > 0
                                    
                                    // Determine round indicator text and color
                                    const roundIndicators = []
                                    if (hasSingle) roundIndicators.push({ text: 'Single', color: 'blue' })
                                    if (hasDouble) roundIndicators.push({ text: 'Double', color: 'purple' })
                                    if (hasFinal) roundIndicators.push({ text: 'Final', color: 'amber' })
                                    
                                    const roundText = roundIndicators.map(r => r.text).join(' / ')
                                    const primaryRoundColor = roundIndicators.length > 0 ? roundIndicators[0].color : 'gray'
                                    
                                    return (
                                        <button
                                            key={category.categoryName}
                                            onClick={() => handleCategoryClick(category)}
                                            className="bg-white p-4 rounded-lg shadow hover:shadow-lg transition-shadow text-left"
                                        >
                                            <h3 className="font-semibold text-black">{category.categoryName}</h3>
                                            <p className="text-gray-600">
                                                {category.correct.toLocaleString()} / {category.total.toLocaleString()} correct ({
                                                    Math.round((category.correct / category.total) * 100)
                                                }%)
                                            </p>
                                            <p className="text-gray-600 mb-2">Points: ${category.points.toLocaleString()}</p>
                                            
                                            {/* Round/Triple indicators */}
                                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                                                {roundIndicators.length > 0 && (
                                                    <span 
                                                        className={`px-2 py-0.5 text-xs font-medium rounded ${
                                                            primaryRoundColor === 'blue' ? 'bg-blue-100 text-blue-700' :
                                                            primaryRoundColor === 'purple' ? 'bg-purple-100 text-purple-700' :
                                                            'bg-amber-100 text-amber-700'
                                                        }`}
                                                        title={`Rounds: ${roundText}`}
                                                    >
                                                        {roundText}
                                                    </span>
                                                )}
                                                {hasTriple && (
                                                    <span 
                                                        className="px-2 py-0.5 bg-orange-100 text-orange-800 text-xs rounded font-medium"
                                                        title="Contains triple stumper questions"
                                                    >
                                                        Triple Stumper
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </>
                    )}

                    {showUnstarted && visibleNotStarted.length > 0 && (
                        <>
                            <h3 className="text-lg font-medium text-gray-700 mb-3">Not Started</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {visibleNotStartedPage.map((category) => (
                                    <button
                                        key={category.categoryName}
                                        onClick={() => handleCategoryClick(category)}
                                        className="bg-gray-50 p-4 rounded-lg shadow hover:shadow-lg transition-shadow text-left"
                                    >
                                        <h3 className="font-semibold text-black">{category.categoryName}</h3>
                                        <p className="text-gray-600">
                                            0 / {category.total.toLocaleString()} questions
                                        </p>
                                    </button>
                                ))}
                            </div>
                            
                            {/* Loading indicator and sentinel for infinite scroll */}
                            {hasMoreUnstarted && (
                                <>
                                    {isLoadingMore && (
                                        <div className="flex justify-center items-center py-4 text-gray-500 text-sm">
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400 mr-2"></div>
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
                                            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors text-sm font-medium text-gray-700"
                                        >
                                            Load More Categories
                                        </button>
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    {/* Empty state when filter returns no results */}
                    {visibleInProgress.length === 0 && visibleNotStarted.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                            <p className="text-lg mb-2">No categories match the selected filter.</p>
                            <p className="text-sm">Try selecting a different filter or click &quot;All&quot; to see all categories.</p>
                        </div>
                    )}
                </div>
            )}

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

            {/* Back to Top Button */}
            {showBackToTop && (
                <button
                    onClick={scrollToTop}
                    className="fixed bottom-8 right-8 bg-amber-400 hover:bg-amber-500 text-blue-900 p-4 rounded-full shadow-2xl ring-4 ring-white/50 transition-all duration-300 z-50 flex items-center justify-center hover:scale-110"
                    aria-label="Back to top"
                >
                    <svg 
                        className="w-6 h-6" 
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
    )
} 