'use client'

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../../lib/auth'
import { getRoundCategories, getRandomQuestion, saveAnswer, getCategoryQuestions } from '../../../actions/practice'
import { checkAnswer } from '../../../lib/answer-checker'
import { scrollInputIntoView } from '@/app/hooks/useMobileKeyboard'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

type Question = {
    id: string
    question: string
    answer: string
    value: number
    categoryId: string
    categoryName: string
    originalCategory: string
    airDate: Date | string | null
    gameHistory: Array<{
        timestamp: Date | string
        correct: boolean
    }>
    incorrectAttempts: (Date | string)[]
    answered: boolean
    correct: boolean
    isLocked: boolean
    hasIncorrectAttempts: boolean
}

type Category = {
    id: string
    name: string
    totalQuestions: number
    correctQuestions: number
    mostRecentAirDate: Date | null
}


function CategoryCard({ category, onClick }: { category: Category; onClick: () => void }) {
    const progressPercentage = Math.round((category.correctQuestions / category.totalQuestions) * 100) || 0
    const isComplete = progressPercentage === 100
    const bgColor = isComplete ? 'bg-green-600' : 'bg-amber-600'
    const hoverColor = isComplete ? 'hover:bg-green-700' : 'hover:bg-amber-700'

    return (
        <button
            onClick={onClick}
            className={`p-6 ${bgColor} ${hoverColor} rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1 text-white`}
        >
            <h3 className="text-xl font-bold mb-3">{category.name}</h3>
            <div className="mt-2">
                <div className="w-full bg-white/30 rounded-full h-2">
                    <div
                        className="bg-white h-2 rounded-full transition-all duration-500"
                        style={{ width: `${progressPercentage}%` }}
                    />
                </div>
                <div className="mt-2 flex justify-between items-center text-white/90">
                    <p className="text-sm">
                        {category.correctQuestions} / {category.totalQuestions} correct
                    </p>
                    <p className="text-sm font-medium">{progressPercentage}%</p>
                </div>
            </div>
        </button>
    )
}

function FinalPracticeContent() {
    const { user } = useAuth()
    const _searchParams = useSearchParams()
    const _router = useRouter()
    
    const [categories, setCategories] = useState<Category[]>([])
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
    const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
    const [userAnswer, setUserAnswer] = useState('')
    const answerInputRef = useRef<HTMLInputElement>(null)
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
    const [showAnswer, setShowAnswer] = useState(false)
    const [disputeContext, setDisputeContext] = useState<{
        questionId: string
        gameId: string | null
        round: string
        userAnswer: string
        mode: string
    } | null>(null)
    const [disputeSubmitted, setDisputeSubmitted] = useState(false)
    const [loading, setLoading] = useState(true)
    const [loadingQuestion, setLoadingQuestion] = useState(false)
    const [_spoilerDate, _setSpoilerDate] = useState<Date | null>(null)
    
    // Initialize sortBy from localStorage synchronously to avoid flash
    const [sortBy, setSortBy] = useState<'airDate' | 'completion'>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('final_practice_sort_preference')
            if (saved === 'airDate' || saved === 'completion') {
                return saved
            }
        }
        return 'airDate'
    })
    // Initialize sortDirection from localStorage synchronously to avoid flash
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('final_practice_sort_direction')
            if (saved === 'asc' || saved === 'desc') {
                return saved
            }
        }
        return 'desc'
    })
    const [_isSortTransitioning, _setIsSortTransitioning] = useState(false)
    
    // Persist sort preference to localStorage when user changes it
    const handleSortChange = useCallback((newSort: 'airDate' | 'completion') => {
        setSortBy(newSort)
        localStorage.setItem('final_practice_sort_preference', newSort)
    }, [])
    
    // Persist sort direction to localStorage when user changes it
    const handleSortDirectionChange = useCallback((newDirection: 'asc' | 'desc') => {
        setSortDirection(newDirection)
        localStorage.setItem('final_practice_sort_direction', newDirection)
    }, [])

    // Load categories for Final Jeopardy (only on user change, sorting is done client-side)
    useEffect(() => {
        const loadCategories = async () => {
            try {
                const result = await getRoundCategories('FINAL', user?.id, 1, 100)
                setCategories(result.categories)
            } catch (error) {
                console.error('Error loading Final Jeopardy categories:', error)
            } finally {
                setLoading(false)
            }
        }
        loadCategories()
    }, [user?.id])
    
    // Sort categories client-side (Final Jeopardy loads all categories at once)
    // When sorting by completion, separate categories with progress from those without
    const { inProgressCategories: _inProgressCategories, notStartedCategories: _notStartedCategories, sortedCategories } = useMemo(() => {
        if (sortBy === 'completion') {
            // Split into in-progress and not-started
            const inProgress = categories.filter(c => Number(c.correctQuestions) > 0);
            const notStarted = categories.filter(c => Number(c.correctQuestions) === 0);
            
            // Sort in-progress by completion percentage (asc/desc based on sortDirection)
            const sortedInProgress = [...inProgress].sort((a, b) => {
                const completionA = (Number(a.correctQuestions) / Number(a.totalQuestions)) || 0;
                const completionB = (Number(b.correctQuestions) / Number(b.totalQuestions)) || 0;
                return sortDirection === 'asc' 
                    ? completionA - completionB 
                    : completionB - completionA;
            });
            
            // Sort not-started by air date (always newest first for stability)
            const sortedNotStarted = [...notStarted].sort((a, b) => {
                const dateA = a.mostRecentAirDate ? new Date(a.mostRecentAirDate) : new Date(0);
                const dateB = b.mostRecentAirDate ? new Date(b.mostRecentAirDate) : new Date(0);
                return dateB.getTime() - dateA.getTime();
            });
            
            return {
                inProgressCategories: sortedInProgress,
                notStartedCategories: sortedNotStarted,
                sortedCategories: [...sortedInProgress, ...sortedNotStarted]
            };
        }
        
        // Sort by air date (asc/desc based on sortDirection)
        const sorted = [...categories].sort((a, b) => {
            const dateA = a.mostRecentAirDate ? new Date(a.mostRecentAirDate) : new Date(0);
            const dateB = b.mostRecentAirDate ? new Date(b.mostRecentAirDate) : new Date(0);
            return sortDirection === 'asc'
                ? dateA.getTime() - dateB.getTime()
                : dateB.getTime() - dateA.getTime();
        });
        
        return {
            inProgressCategories: [],
            notStartedCategories: [],
            sortedCategories: sorted
        };
    }, [categories, sortBy, sortDirection])

    // Load question when category is selected
    const handleCategorySelect = useCallback(async (categoryId: string) => {
        if (categoryId === selectedCategory) return
        
        setLoadingQuestion(true)
        setSelectedCategory(categoryId)
        setSelectedQuestion(null)
        setUserAnswer('')
        setShowAnswer(false)
        setIsCorrect(null)

        try {
            // Final Jeopardy categories have only one question
            const questions = await getCategoryQuestions(categoryId, '', user?.id, undefined, 'FINAL')
            if (questions.length > 0) {
                const q = questions[0]
                setSelectedQuestion({
                    id: q.id,
                    question: q.question,
                    answer: q.answer,
                    value: q.value || 0,
                    categoryId: q.categoryId,
                    categoryName: q.categoryName,
                    originalCategory: q.originalCategory,
                    airDate: q.airDate,
                    gameHistory: q.gameHistory || [],
                    incorrectAttempts: q.incorrectAttempts || [],
                    answered: q.answered || false,
                    correct: q.correct || false,
                    isLocked: q.isLocked || false,
                    hasIncorrectAttempts: q.hasIncorrectAttempts || false
                })
            }
        } catch (error) {
            console.error('Error loading Final Jeopardy question:', error)
            toast.error('Failed to load question')
        } finally {
            setLoadingQuestion(false)
        }
    }, [selectedCategory, user?.id])

    const handleAnswerSubmit = async () => {
        if (!selectedQuestion?.answer || !userAnswer) return

        // Reset dispute state for new answer
        setDisputeContext(null)
        setDisputeSubmitted(false)

        let isAnswerCorrect = false

        // Use grading API if user is logged in
        if (user?.id && selectedQuestion.id) {
            try {
                const response = await fetch('/api/answers/grade', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        questionId: selectedQuestion.id,
                        userAnswer: userAnswer,
                        mode: 'PRACTICE',
                        round: 'FINAL',
                        categoryId: selectedQuestion.categoryId
                    })
                })

                if (response.ok) {
                    const data = await response.json()
                    isAnswerCorrect = data.correct
                    setDisputeContext(data.disputeContext)
                } else {
                    // Fallback to local check if API fails
                    isAnswerCorrect = checkAnswer(userAnswer, selectedQuestion.answer)
                }
            } catch (error) {
                console.error('Error grading answer:', error)
                // Fallback to local check
                isAnswerCorrect = checkAnswer(userAnswer, selectedQuestion.answer)
            }
        } else {
            // Guest user - use local check
            isAnswerCorrect = checkAnswer(userAnswer, selectedQuestion.answer)
        }

        setIsCorrect(isAnswerCorrect)
        setShowAnswer(true)

        if (user?.id && selectedQuestion.id) {
            await saveAnswer(
                user.id,
                selectedQuestion.id,
                selectedQuestion.categoryId,
                isAnswerCorrect
            )

            // Update question state
            setSelectedQuestion(prev => {
                if (!prev) return null
                return {
                    ...prev,
                    correct: isAnswerCorrect || prev.correct,
                    gameHistory: [
                        {
                            timestamp: new Date(),
                            correct: isAnswerCorrect
                        },
                        ...prev.gameHistory
                    ],
                    incorrectAttempts: !isAnswerCorrect
                        ? [new Date(), ...prev.incorrectAttempts]
                        : prev.incorrectAttempts,
                    isLocked: !isAnswerCorrect,
                    hasIncorrectAttempts: !isAnswerCorrect || prev.hasIncorrectAttempts
                }
            })

            // Refresh categories to update progress
            const result = await getRoundCategories('FINAL', user.id, 1, 100)
            setCategories(result.categories)
        }
    }

    const handleDispute = async () => {
        if (!disputeContext || disputeSubmitted || !user?.id) return

        try {
            const response = await fetch('/api/answers/disputes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...disputeContext,
                    systemWasCorrect: false
                })
            })

            if (!response.ok) {
                const error = await response.json()
                console.error('Failed to submit dispute:', error.error)
                return
            }

            setDisputeSubmitted(true)
        } catch (error) {
            console.error('Error submitting dispute:', error)
        }
    }

    const handleShuffle = useCallback(async () => {
        try {
            const randomQuestion = await getRandomQuestion(
                undefined,
                undefined,
                user?.id,
                selectedQuestion?.id,
                'FINAL'
            )

            if (!randomQuestion) {
                toast.error('No more Final Jeopardy questions available')
                return
            }

            // Load the category for this question
            const questions = await getCategoryQuestions(
                randomQuestion.categoryId,
                '',
                user?.id,
                undefined,
                'FINAL'
            )
            
            if (questions.length > 0) {
                const q = questions[0]
                setSelectedCategory(randomQuestion.categoryId)
                setSelectedQuestion({
                    id: q.id,
                    question: q.question,
                    answer: q.answer,
                    value: q.value || 0,
                    categoryId: q.categoryId,
                    categoryName: q.categoryName,
                    originalCategory: q.originalCategory,
                    airDate: q.airDate,
                    gameHistory: q.gameHistory || [],
                    incorrectAttempts: q.incorrectAttempts || [],
                    answered: q.answered || false,
                    correct: q.correct || false,
                    isLocked: q.isLocked || false,
                    hasIncorrectAttempts: q.hasIncorrectAttempts || false
                })
                setUserAnswer('')
                setShowAnswer(false)
                setIsCorrect(null)
            }
        } catch (error) {
            console.error('Error shuffling Final Jeopardy question:', error)
            toast.error('Failed to load random question')
        }
    }, [selectedQuestion?.id, user?.id])

    useEffect(() => {
        if (user?.id) {
            fetch('/api/user/spoiler-settings')
                .then(res => res.json())
                .then(data => {
                    if (data.spoilerBlockEnabled && data.spoilerBlockDate) {
                        _setSpoilerDate(new Date(data.spoilerBlockDate))
                    } else {
                        _setSpoilerDate(null)
                    }
                })
                .catch(console.error)
        }
    }, [user?.id])

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent align-[-0.125em] mb-4"></div>
                    <div className="text-gray-600 font-medium">Loading Final Jeopardy study...</div>
                </div>
            </div>
        )
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-6">
                <Link
                    href="/practice/round"
                    className="text-blue-600 hover:text-blue-800 flex items-center font-bold mb-4"
                >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Round Selection
                </Link>
            </div>

            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Final Jeopardy Study</h1>
                <button
                    onClick={handleShuffle}
                    disabled={loadingQuestion}
                    className="px-6 py-3 bg-purple-400 text-white rounded-lg hover:bg-purple-500 disabled:opacity-50 transition-colors font-bold text-lg shadow-lg hover:shadow-xl flex items-center gap-2"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Shuffle Question
                </button>
            </div>

            {!selectedQuestion ? (
                <div>
                    {/* Sort Controls */}
                    <div className="mb-6 flex justify-end">
                        <div className="flex items-center gap-2">
                            {/* Asc/Desc Toggle */}
                            <div className="relative grid grid-cols-2 bg-amber-600 rounded-lg p-1 shadow-md min-w-[80px]">
                                <div 
                                    style={{
                                        transition: 'transform 350ms cubic-bezier(0.4, 0.0, 0.2, 1)',
                                        transform: sortDirection === 'desc' ? 'translateX(100%)' : 'translateX(0)',
                                    }}
                                    className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] bg-white rounded-md shadow-sm will-change-transform"
                                />
                                <button
                                    onClick={() => handleSortDirectionChange('asc')}
                                    className={`relative z-10 flex items-center justify-center p-2 rounded-md transition-colors duration-200 ${
                                        sortDirection === 'asc' ? 'text-amber-900' : 'text-white/70 hover:text-white'
                                    }`}
                                    aria-label="Sort ascending"
                                    title="Sort ascending"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => handleSortDirectionChange('desc')}
                                    className={`relative z-10 flex items-center justify-center p-2 rounded-md transition-colors duration-200 ${
                                        sortDirection === 'desc' ? 'text-amber-900' : 'text-white/70 hover:text-white'
                                    }`}
                                    aria-label="Sort descending"
                                    title="Sort descending"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                            </div>
                            
                            {/* Date/Progress Toggle */}
                            <div className="relative grid grid-cols-2 bg-amber-600 rounded-lg p-1 shadow-md min-w-[200px]">
                                <div 
                                    style={{
                                        transition: 'transform 350ms cubic-bezier(0.4, 0.0, 0.2, 1)',
                                        transform: sortBy === 'completion' ? 'translateX(100%)' : 'translateX(0)',
                                    }}
                                    className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] bg-white rounded-md shadow-sm will-change-transform"
                                />
                                <button
                                    onClick={() => handleSortChange('airDate')}
                                    className={`relative z-10 flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium transition-colors duration-200 ${
                                        sortBy === 'airDate' ? 'text-amber-900' : 'text-white/70 hover:text-white'
                                    }`}
                                    aria-label="Sort by date"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <span className="hidden sm:inline">Date</span>
                                </button>
                                <button
                                    onClick={() => handleSortChange('completion')}
                                    className={`relative z-10 flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium transition-colors duration-200 ${
                                        sortBy === 'completion' ? 'text-amber-900' : 'text-white/70 hover:text-white'
                                    }`}
                                    aria-label="Sort by progress"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                    <span className="hidden sm:inline">Progress</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Categories Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {sortedCategories.map(category => (
                            <CategoryCard
                                key={category.id}
                                category={category}
                                onClick={() => handleCategorySelect(category.id)}
                            />
                        ))}
                    </div>
                </div>
            ) : (
                <div className="max-w-3xl mx-auto practice-question-area">
                    <div className="bg-white shadow-lg rounded-lg p-6 relative">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">
                                    {selectedQuestion.originalCategory}
                                </h2>
                                {selectedQuestion.airDate && (
                                    <p className="text-sm text-gray-600 mt-1">
                                        {format(new Date(selectedQuestion.airDate), 'MMMM d, yyyy')}
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => {
                                    setSelectedQuestion(null)
                                    setSelectedCategory(null)
                                    setUserAnswer('')
                                    setShowAnswer(false)
                                    setIsCorrect(null)
                                }}
                                className="text-blue-600 hover:text-blue-800 font-bold"
                            >
                                Back to Categories
                            </button>
                        </div>

                        <div className="flex justify-center items-center min-h-[200px] mb-6">
                            <p className="text-2xl text-gray-900 text-center leading-relaxed">
                                {selectedQuestion.question}
                            </p>
                        </div>

                        {!showAnswer ? (
                            <div className="space-y-4">
                                {selectedQuestion.correct ? (
                                    <div className="flex justify-start">
                                        <button
                                            onClick={() => setShowAnswer(true)}
                                            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-bold flex items-center gap-2"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                            View Answer
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="relative">
                                            <input
                                                ref={answerInputRef}
                                                type="text"
                                                value={userAnswer}
                                                onChange={(e) => setUserAnswer(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        handleAnswerSubmit()
                                                    }
                                                }}
                                                onFocus={() => scrollInputIntoView(answerInputRef.current)}
                                                className="w-full p-3 border rounded-lg text-black text-base"
                                                placeholder="What is..."
                                                autoComplete="off"
                                                autoCapitalize="off"
                                                autoCorrect="off"
                                                spellCheck="false"
                                                enterKeyHint="send"
                                            />
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <div className="flex space-x-4">
                                                <button
                                                    onClick={handleAnswerSubmit}
                                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold"
                                                >
                                                    Submit
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setShowAnswer(true)
                                                    if (user?.id && selectedQuestion.id) {
                                                        saveAnswer(user.id, selectedQuestion.id, selectedQuestion.categoryId, false)
                                                    }
                                                }}
                                                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-bold flex items-center gap-2"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                                Show Answer
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className={`p-4 rounded-lg ${isCorrect || selectedQuestion.correct ? 'bg-green-100' : 'bg-red-100'}`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        {isCorrect || selectedQuestion.correct ? (
                                            <span className="text-green-600 text-lg">✓</span>
                                        ) : (
                                            <span className="text-red-600 text-lg">✗</span>
                                        )}
                                        <span className={`text-sm font-bold ${isCorrect || selectedQuestion.correct ? 'text-green-700' : 'text-red-700'}`}>
                                            {isCorrect || selectedQuestion.correct ? 'Correct!' : 'Incorrect'}
                                        </span>
                                    </div>
                                    <p className="font-medium text-gray-900 text-center">
                                        {selectedQuestion.answer}
                                    </p>
                                    {isCorrect === false && disputeContext && user?.id && (
                                        <div className="mt-3 flex justify-end">
                                            {disputeSubmitted ? (
                                                <span className="text-sm text-gray-500 flex items-center gap-1">
                                                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    Dispute submitted
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1">
                                                    <button
                                                        onClick={handleDispute}
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
                                <div className="flex space-x-4">
                                    <button
                                        onClick={() => {
                                            setSelectedQuestion(null)
                                            setSelectedCategory(null)
                                            setUserAnswer('')
                                            setShowAnswer(false)
                                            setIsCorrect(null)
                                        }}
                                        className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-bold"
                                    >
                                        Back to Categories
                                    </button>
                                    <button
                                        onClick={handleShuffle}
                                        className="px-6 py-2 bg-purple-400 text-white rounded-lg hover:bg-purple-500 font-bold flex items-center gap-2"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Next Random Question
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

function FinalPracticeLoadingFallback() {
    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
            <div className="text-center">
                <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent align-[-0.125em] mb-4"></div>
                <div className="text-gray-600 font-medium">Loading Final Jeopardy practice...</div>
            </div>
        </div>
    )
}

export default function FinalPractice() {
    return (
        <Suspense fallback={<FinalPracticeLoadingFallback />}>
            <FinalPracticeContent />
        </Suspense>
    )
}

