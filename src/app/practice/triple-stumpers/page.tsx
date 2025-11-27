'use client'

import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../lib/auth'
import { getTripleStumperCategories, getTripleStumperCategoryQuestions, getRandomTripleStumper, saveAnswer } from '../../actions/practice'
import { checkAnswer } from '../../lib/answer-checker'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

type Question = {
    id: string;
    question: string;
    answer: string;
    value: number;
    categoryId: string;
    categoryName: string;
    originalCategory: string;
    airDate: Date | null;
    gameHistory: Array<{
        timestamp: Date;
        correct: boolean;
    }>;
    incorrectAttempts: Date[];
    answered: boolean;
    correct: boolean;
    isLocked: boolean;
    hasIncorrectAttempts: boolean;
};

type Category = {
    id: string;
    name: string;
    totalQuestions: number;
    correctQuestions: number;
    mostRecentAirDate: Date | null;
};

function LoadingSpinner() {
    return (
        <div className="flex justify-center items-center p-4">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-yellow-600 border-r-transparent align-[-0.125em]" />
        </div>
    )
}

function CategoryCard({ category, onSelect }: {
    category: Category
    onSelect: (id: string) => void
}) {
    const totalQuestions = Number(category.totalQuestions);
    const correctQuestions = Number(category.correctQuestions);
    const progressPercentage = Math.round((correctQuestions / totalQuestions) * 100) || 0;
    const isComplete = progressPercentage === 100;
    const bgColor = !isComplete ? 'bg-yellow-500' : 'bg-green-600';
    const hoverColor = !isComplete ? 'hover:bg-yellow-600' : 'hover:bg-green-700';

    return (
        <button
            onClick={() => onSelect(category.id)}
            className={`w-full h-40 p-5 ${bgColor} ${hoverColor} rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1 text-white flex flex-col`}
        >
            <h3 className="text-lg font-bold mb-auto line-clamp-2 text-center leading-tight">{category.name}</h3>
            <div className="mt-3 w-full">
                <div className="w-full bg-white/30 rounded-full h-2">
                    <div
                        className="bg-white h-2 rounded-full transition-all duration-500"
                        style={{ width: `${progressPercentage}%` }}
                    />
                </div>
                <div className="mt-2 flex justify-between items-center text-white/90">
                    <p className="text-sm">
                        {correctQuestions} / {totalQuestions} conquered
                    </p>
                    <p className="text-sm font-medium">
                        {progressPercentage}%
                    </p>
                </div>
            </div>
        </button>
    )
}

function QuestionCard({ question, onClick, spoilerDate }: {
    question: Question;
    onClick: () => void;
    spoilerDate: Date | null;
}) {
    const isSpoiler = spoilerDate && question.airDate && new Date(question.airDate) >= spoilerDate;

    const buttonClass = question.correct
        ? 'bg-green-600 hover:bg-green-700'
        : question.hasIncorrectAttempts
            ? 'bg-red-600 hover:bg-red-700'
            : 'bg-yellow-500 hover:bg-yellow-600';

    const lockoutTimeRemaining = question.isLocked && question.incorrectAttempts[0]
        ? Math.ceil((10 * 60 * 1000 - (new Date().getTime() - new Date(question.incorrectAttempts[0]).getTime())) / 60000)
        : 0;

    return (
        <div className="space-y-2">
            {isSpoiler && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-2 text-xs">
                    <span className="text-yellow-700">Spoiler warning</span>
                </div>
            )}
            <div className="relative group">
                <button
                    onClick={onClick}
                    disabled={question.isLocked}
                    className={`p-6 rounded-lg transition-all ${buttonClass} text-white text-center text-xl font-bold relative w-full h-32 shadow-lg hover:shadow-xl transform hover:-translate-y-1 duration-200 ${question.isLocked ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
                >
                    <div className="flex items-center justify-center space-x-2">
                        <span>${question.value}</span>
                        {question.isLocked && (
                            <svg className="w-5 h-5 text-white/75" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                    </div>
                </button>
                {question.isLocked && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-black/75 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                            <span>Try again in {lockoutTimeRemaining} min</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Helper to transform questions
const transformQuestions = (questions: any[]): Question[] => {
    return questions.map(q => ({
        id: q.id,
        question: q.question,
        answer: q.answer,
        value: q.value || 200,
        categoryId: q.categoryId,
        categoryName: q.categoryName,
        originalCategory: q.originalCategory || q.categoryName,
        airDate: q.airDate ? new Date(q.airDate) : null,
        gameHistory: (q.gameHistory || []).map((h: any) => ({
            timestamp: new Date(h.timestamp),
            correct: h.correct
        })),
        incorrectAttempts: (q.incorrectAttempts || []).map((t: any) => new Date(t)),
        answered: q.answered || false,
        correct: q.correct || false,
        isLocked: q.isLocked || false,
        hasIncorrectAttempts: q.hasIncorrectAttempts || false
    }));
};

function TripleStumpersContent() {
    const { user } = useAuth()
    const searchParams = useSearchParams()
    const router = useRouter()
    
    const [categories, setCategories] = useState<Category[]>([])
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
    const [questions, setQuestions] = useState<Question[]>([])
    const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
    
    // URL state management
    const isRestoringFromUrl = useRef(false)
    const lastUrlState = useRef<{ c: string | null; q: string | null }>({ c: null, q: null })
    const [isTransitioning, setIsTransitioning] = useState(false)
    
    const updateUrlParams = useCallback((params: { 
        category?: string | null; 
        question?: string | null 
    }) => {
        if (isRestoringFromUrl.current) return
        
        const url = new URL(window.location.href)
        
        if (params.category !== undefined) {
            if (params.category) {
                url.searchParams.set('category', params.category)
            } else {
                url.searchParams.delete('category')
            }
        }
        
        if (params.question !== undefined) {
            if (params.question) {
                url.searchParams.set('question', params.question)
            } else {
                url.searchParams.delete('question')
            }
        }
        
        router.replace(url.pathname + url.search, { scroll: false })
    }, [router])

    const [userAnswer, setUserAnswer] = useState('')
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
    const [showAnswer, setShowAnswer] = useState(false)
    const [loading, setLoading] = useState(true)
    const [loadingQuestions, setLoadingQuestions] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const [hasMore, setHasMore] = useState(false)
    const loadMoreRef = useRef<HTMLDivElement>(null)
    const [spoilerDate, setSpoilerDate] = useState<Date | null>(null)
    const [showBackToTop, setShowBackToTop] = useState(false)
    const [sortBy, setSortBy] = useState<'airDate' | 'completion'>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('triple_stumper_sort_preference')
            if (saved === 'airDate' || saved === 'completion') {
                return saved
            }
        }
        return 'airDate'
    })
    const [isSortTransitioning, setIsSortTransitioning] = useState(false)
    const sortByRef = useRef(sortBy)
    const isInitialMount = useRef(true)
    const [totalStats, setTotalStats] = useState({ total: 0, conquered: 0 })

    useEffect(() => {
        sortByRef.current = sortBy
    }, [sortBy])

    const handleSortChange = useCallback((newSort: 'airDate' | 'completion') => {
        setSortBy(newSort)
        localStorage.setItem('triple_stumper_sort_preference', newSort)
    }, [])

    // Handle scroll
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

    // Load initial categories
    useEffect(() => {
        const loadCategories = async () => {
            try {
                const result = await getTripleStumperCategories(user?.id, 1, 20, sortByRef.current)
                setCategories(result.categories)
                setHasMore(result.hasMore)
                
                // Calculate total stats
                const total = result.categories.reduce((sum, c) => sum + c.totalQuestions, 0)
                const conquered = result.categories.reduce((sum, c) => sum + c.correctQuestions, 0)
                setTotalStats({ total, conquered })
            } catch (error) {
                console.error('Error loading categories:', error)
            } finally {
                setLoading(false)
                isInitialMount.current = false
            }
        }
        loadCategories()
    }, [user?.id])

    // Refetch when sort changes
    useEffect(() => {
        if (isInitialMount.current || selectedCategory) return
        
        const refetchWithNewSort = async () => {
            setIsSortTransitioning(true)
            setCurrentPage(1)
            
            try {
                const result = await getTripleStumperCategories(user?.id, 1, 20, sortBy)
                await new Promise(resolve => setTimeout(resolve, 150))
                setCategories(result.categories)
                setHasMore(result.hasMore)
            } catch (error) {
                console.error('Error refetching categories:', error)
            } finally {
                setIsSortTransitioning(false)
            }
        }
        
        refetchWithNewSort()
    }, [sortBy, user?.id, selectedCategory])

    // URL state restoration
    useEffect(() => {
        const restoreStateFromUrl = async () => {
            const categoryParam = searchParams.get('category')
            const questionParam = searchParams.get('question')
            
            const currentUrlState = { c: categoryParam, q: questionParam }
            const lastState = lastUrlState.current
            
            const urlChanged = lastState.c !== currentUrlState.c || lastState.q !== currentUrlState.q
            
            if (!urlChanged && !loading) return
            
            lastUrlState.current = currentUrlState
            isRestoringFromUrl.current = true
            
            try {
                if (!categoryParam) {
                    setSelectedCategory(null)
                    setSelectedQuestion(null)
                    setQuestions([])
                    isRestoringFromUrl.current = false
                    return
                }
                
                const categoryChanged = selectedCategory !== categoryParam
                if (categoryChanged || questions.length === 0) {
                    setIsTransitioning(true)
                    
                    const questionsData = await getTripleStumperCategoryQuestions(categoryParam, user?.id)
                    const transformedQuestions = transformQuestions(questionsData)
                    
                    if (transformedQuestions.length === 0) {
                        setSelectedCategory(null)
                        setIsTransitioning(false)
                        isRestoringFromUrl.current = false
                        return
                    }
                    
                    setSelectedCategory(categoryParam)
                    setQuestions(transformedQuestions)
                    
                    if (questionParam) {
                        const question = transformedQuestions.find(q => q.id === questionParam)
                        if (question) {
                            setSelectedQuestion(question)
                            setUserAnswer('')
                            setIsCorrect(null)
                            setShowAnswer(false)
                        }
                    } else {
                        setSelectedQuestion(null)
                    }
                    setIsTransitioning(false)
                } else if (questionParam !== selectedQuestion?.id) {
                    if (questionParam) {
                        const question = questions.find(q => q.id === questionParam)
                        if (question) {
                            setSelectedQuestion(question)
                            setUserAnswer('')
                            setIsCorrect(null)
                            setShowAnswer(false)
                        }
                    } else {
                        setSelectedQuestion(null)
                    }
                }
            } catch (error) {
                console.error('Error restoring state from URL:', error)
                setIsTransitioning(false)
            } finally {
                isRestoringFromUrl.current = false
            }
        }
        
        if (!loading) {
            restoreStateFromUrl()
        }
    }, [searchParams, loading, user?.id, selectedCategory, selectedQuestion?.id, questions])

    // Infinite scroll
    useEffect(() => {
        if (!loadMoreRef.current || !hasMore || loadingMore || selectedCategory) return

        const observer = new IntersectionObserver(
            async (entries) => {
                if (entries[0].isIntersecting && hasMore && !loadingMore) {
                    await loadMoreCategories()
                }
            },
            { threshold: 0.1 }
        )

        observer.observe(loadMoreRef.current)
        return () => observer.disconnect()
    }, [hasMore, loadingMore, selectedCategory])

    const loadMoreCategories = async () => {
        if (loadingMore) return

        setLoadingMore(true)
        try {
            const nextPage = currentPage + 1
            const result = await getTripleStumperCategories(user?.id, nextPage, 20, sortBy)
            setCategories(prev => [...prev, ...result.categories])
            setCurrentPage(nextPage)
            setHasMore(result.hasMore)
        } catch (error) {
            console.error('Error loading more categories:', error)
        } finally {
            setLoadingMore(false)
        }
    }

    const handleCategorySelect = useCallback(async (categoryId: string) => {
        if (categoryId === selectedCategory) return
        
        setIsTransitioning(true)
        setLoadingQuestions(true)
        updateUrlParams({ category: categoryId, question: null })

        try {
            const questionsData = await getTripleStumperCategoryQuestions(categoryId, user?.id)
            const transformedQuestions = transformQuestions(questionsData)
            
            setSelectedCategory(categoryId)
            setSelectedQuestion(null)
            setQuestions(transformedQuestions)
        } catch (error) {
            console.error('Error loading questions:', error)
        } finally {
            setLoadingQuestions(false)
            setIsTransitioning(false)
        }
    }, [selectedCategory, user?.id, updateUrlParams])

    const handleQuestionSelect = useCallback((question: Question) => {
        if (!question) return
        setSelectedQuestion(question)
        setUserAnswer('')
        setIsCorrect(null)
        setShowAnswer(false)
        updateUrlParams({ question: question.id })
    }, [updateUrlParams])

    const handleBackToQuestions = useCallback(() => {
        setSelectedQuestion(null)
        setUserAnswer('')
        setShowAnswer(false)
        setIsCorrect(null)
        updateUrlParams({ question: null })
    }, [updateUrlParams])

    const handleBackToCategories = useCallback(() => {
        setSelectedCategory(null)
        setSelectedQuestion(null)
        setQuestions([])
        updateUrlParams({ category: null, question: null })
    }, [updateUrlParams])

    const handleAnswerSubmit = async () => {
        if (!selectedQuestion?.answer || !userAnswer) return

        const isAnswerCorrect = checkAnswer(userAnswer, selectedQuestion.answer)
        setIsCorrect(isAnswerCorrect)
        setShowAnswer(true)

        if (user?.id && selectedQuestion.id) {
            await saveAnswer(
                user.id,
                selectedQuestion.id,
                selectedQuestion.categoryId,
                isAnswerCorrect
            )

            const newIncorrectAttempts = !isAnswerCorrect
                ? [new Date(), ...(selectedQuestion.incorrectAttempts || [])]
                : selectedQuestion.incorrectAttempts

            setSelectedQuestion(prev => {
                if (!prev) return null
                return {
                    ...prev,
                    correct: isAnswerCorrect || prev.correct,
                    gameHistory: [{ timestamp: new Date(), correct: isAnswerCorrect }, ...prev.gameHistory],
                    incorrectAttempts: newIncorrectAttempts,
                    isLocked: !isAnswerCorrect,
                    hasIncorrectAttempts: !isAnswerCorrect || prev.hasIncorrectAttempts
                }
            })

            setQuestions(prevQuestions =>
                prevQuestions.map(q =>
                    q.id === selectedQuestion.id
                        ? {
                            ...q,
                            correct: isAnswerCorrect || q.correct,
                            answered: true,
                            gameHistory: [{ timestamp: new Date(), correct: isAnswerCorrect }, ...q.gameHistory],
                            incorrectAttempts: newIncorrectAttempts,
                            isLocked: !isAnswerCorrect,
                            hasIncorrectAttempts: !isAnswerCorrect || q.hasIncorrectAttempts
                        }
                        : q
                )
            )

            // Update category stats
            if (isAnswerCorrect && !selectedQuestion.correct) {
                setCategories(prev => prev.map(c => 
                    c.id === selectedQuestion.categoryId
                        ? { ...c, correctQuestions: c.correctQuestions + 1 }
                        : c
                ))
                setTotalStats(prev => ({ ...prev, conquered: prev.conquered + 1 }))
            }
        }
    }

    const handleShowAnswer = () => {
        if (!selectedQuestion) return

        const newIncorrectAttempts = [new Date(), ...(selectedQuestion.incorrectAttempts || [])]

        setSelectedQuestion(prev => {
            if (!prev) return null
            return {
                ...prev,
                gameHistory: [{ timestamp: new Date(), correct: false }, ...prev.gameHistory],
                incorrectAttempts: newIncorrectAttempts,
                isLocked: true,
                hasIncorrectAttempts: true
            }
        })

        setQuestions(prevQuestions =>
            prevQuestions.map(q =>
                q.id === selectedQuestion.id
                    ? {
                        ...q,
                        gameHistory: [{ timestamp: new Date(), correct: false }, ...q.gameHistory],
                        incorrectAttempts: newIncorrectAttempts,
                        isLocked: true,
                        hasIncorrectAttempts: true
                    }
                    : q
            )
        )

        setShowAnswer(true)
    }

    const handleShuffle = useCallback(async () => {
        try {
            const randomQuestion = await getRandomTripleStumper(
                user?.id,
                selectedQuestion?.id
            )

            if (!randomQuestion) {
                toast.error('No more triple stumper questions available')
                return
            }

            // Load the category's questions
            const questionsData = await getTripleStumperCategoryQuestions(randomQuestion.categoryId, user?.id)
            const transformedQuestions = transformQuestions(questionsData)
            
            setSelectedCategory(randomQuestion.categoryId)
            setQuestions(transformedQuestions)
            
            const fullQuestion = transformedQuestions.find(q => q.id === randomQuestion.id)
            if (fullQuestion) {
                setSelectedQuestion(fullQuestion)
            } else {
                setSelectedQuestion({
                    ...randomQuestion,
                    gameHistory: [],
                    isLocked: false,
                    hasIncorrectAttempts: false,
                    answered: false
                } as Question)
            }
            
            setUserAnswer('')
            setShowAnswer(false)
            setIsCorrect(null)
            
            updateUrlParams({ category: randomQuestion.categoryId, question: randomQuestion.id })
        } catch (error) {
            console.error('Error shuffling question:', error)
            toast.error('Failed to load random question')
        }
    }, [selectedQuestion?.id, user?.id, updateUrlParams])

    // Load spoiler settings
    useEffect(() => {
        if (user?.id) {
            fetch('/api/user/spoiler-settings')
                .then(res => res.json())
                .then(data => {
                    if (data.spoilerBlockEnabled && data.spoilerBlockDate) {
                        setSpoilerDate(new Date(data.spoilerBlockDate))
                    }
                })
                .catch(console.error)
        }
    }, [user?.id])

    const sortedQuestions = useMemo(() => {
        return [...questions].sort((a, b) => (a.value || 200) - (b.value || 200))
    }, [questions])

    const getShuffleButtonText = () => {
        if (selectedCategory) {
            const category = categories.find(c => c.id === selectedCategory)
            return `Shuffle in ${category?.name || selectedQuestion?.originalCategory || 'Category'}`
        }
        return 'Random Triple Stumper'
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-yellow-600 border-r-transparent align-[-0.125em] mb-4"></div>
                    <div className="text-gray-600 font-medium">Loading triple stumpers...</div>
                </div>
            </div>
        )
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="relative">
                {isTransitioning && (
                    <div className="absolute inset-0 bg-gray-100/50 z-10 flex items-start justify-center pt-32 pointer-events-none">
                        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-yellow-600 border-r-transparent" />
                    </div>
                )}
                
                <div className="mb-6">
                    <Link
                        href="/practice"
                        className="text-blue-600 hover:text-blue-800 flex items-center font-bold mb-4"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Practice Modes
                    </Link>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Triple Stumpers</h1>
                        <p className="text-gray-600 mt-1">Questions that stumped all original Jeopardy! contestants</p>
                    </div>
                    <button
                        onClick={handleShuffle}
                        disabled={loadingQuestions || isTransitioning}
                        className="px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 transition-colors font-bold text-lg shadow-lg hover:shadow-xl flex items-center gap-2"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {getShuffleButtonText()}
                    </button>
                </div>

                {/* Stats Banner */}
                <div className="bg-yellow-100 rounded-lg p-4 mb-6 flex flex-wrap gap-6">
                    <div>
                        <span className="text-yellow-800 font-medium">Categories:</span>
                        <span className="ml-2 font-bold text-yellow-900">{categories.length}</span>
                    </div>
                    <div>
                        <span className="text-yellow-800 font-medium">Total Questions:</span>
                        <span className="ml-2 font-bold text-yellow-900">{totalStats.total}</span>
                    </div>
                    <div>
                        <span className="text-yellow-800 font-medium">Conquered:</span>
                        <span className="ml-2 font-bold text-green-700">{totalStats.conquered}</span>
                    </div>
                </div>

                {/* Categories View */}
                {!selectedCategory && categories.length > 0 && (
                    <div className={`transition-opacity duration-200 ${isSortTransitioning ? 'opacity-50' : 'opacity-100'}`}>
                        {/* Sort Controls */}
                        <div className="mb-6 flex justify-end">
                            <div className="relative grid grid-cols-2 bg-yellow-600 rounded-lg p-1 shadow-md min-w-[200px]">
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
                                        sortBy === 'airDate' ? 'text-yellow-900' : 'text-white/70 hover:text-white'
                                    }`}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <span className="hidden sm:inline">Newest</span>
                                </button>
                                <button
                                    onClick={() => handleSortChange('completion')}
                                    className={`relative z-10 flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium transition-colors duration-200 ${
                                        sortBy === 'completion' ? 'text-yellow-900' : 'text-white/70 hover:text-white'
                                    }`}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                    <span className="hidden sm:inline">Progress</span>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {categories.map(category => (
                                <CategoryCard
                                    key={category.id}
                                    category={category}
                                    onSelect={handleCategorySelect}
                                />
                            ))}
                        </div>

                        {hasMore && (
                            <div className="mt-8 flex justify-center" ref={loadMoreRef}>
                                {loadingMore ? (
                                    <LoadingSpinner />
                                ) : (
                                    <button
                                        onClick={loadMoreCategories}
                                        className="px-6 py-3 bg-yellow-400 text-white rounded-lg hover:bg-yellow-500 transition-colors font-bold"
                                    >
                                        Load More Categories
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Questions View */}
                {selectedCategory && !selectedQuestion && questions.length > 0 && (
                    <div className={`transition-opacity duration-200 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}>
                        <div className="mb-6 flex items-center">
                            <button
                                onClick={handleBackToCategories}
                                className="text-blue-600 hover:text-blue-800 flex items-center font-bold"
                                disabled={isTransitioning}
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Back to Categories
                            </button>
                        </div>

                        <h2 className="text-xl font-bold text-gray-900 mb-4">
                            {categories.find(c => c.id === selectedCategory)?.name || 'Category'}
                        </h2>

                        {loadingQuestions ? (
                            <div className="flex justify-center py-12">
                                <LoadingSpinner />
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {sortedQuestions.map(question => (
                                    <QuestionCard
                                        key={question.id}
                                        question={question}
                                        onClick={() => handleQuestionSelect(question)}
                                        spoilerDate={spoilerDate}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Question View */}
                {selectedQuestion && (
                    <div className="max-w-3xl mx-auto">
                        <div className="bg-white shadow-lg rounded-lg p-6 relative border-4 border-yellow-400">
                            <div className="absolute -top-3 left-4 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-sm font-bold">
                                Triple Stumper
                            </div>
                            <div className="flex justify-between items-center mb-4 mt-2">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">
                                        {selectedQuestion.originalCategory}
                                    </h2>
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <span>${selectedQuestion.value}</span>
                                        <span>•</span>
                                        <span>
                                            {selectedQuestion.airDate
                                                ? format(new Date(selectedQuestion.airDate), 'MMMM d, yyyy')
                                                : 'No air date'
                                            }
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={handleBackToQuestions}
                                    className="text-blue-600 hover:text-blue-800 font-bold"
                                >
                                    Back to Questions
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
                                            <input
                                                type="text"
                                                value={userAnswer}
                                                onChange={(e) => setUserAnswer(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleAnswerSubmit()
                                                }}
                                                className="w-full p-3 border rounded-lg text-black"
                                                placeholder="What is..."
                                            />
                                            <div className="flex justify-between items-center">
                                                <div className="flex space-x-4">
                                                    <button
                                                        onClick={handleAnswerSubmit}
                                                        className="px-6 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-bold"
                                                    >
                                                        Submit
                                                    </button>
                                                </div>
                                                <button
                                                    onClick={handleShowAnswer}
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
                                        <div className="flex items-center gap-2">
                                            {isCorrect || selectedQuestion.correct ? (
                                                <span className="text-green-600 text-xl">✓</span>
                                            ) : (
                                                <span className="text-red-600 text-xl">✗</span>
                                            )}
                                            <p className="font-bold text-gray-900">
                                                Correct answer: {selectedQuestion.answer}
                                            </p>
                                        </div>
                                        {(isCorrect || selectedQuestion.correct) && (
                                            <p className="mt-2 text-green-700 font-medium">
                                                🎉 You conquered this Triple Stumper!
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex space-x-4">
                                        <button
                                            onClick={handleBackToQuestions}
                                            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-bold"
                                        >
                                            Back to Questions
                                        </button>
                                        <button
                                            onClick={handleShuffle}
                                            className="px-6 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-bold flex items-center gap-2"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            Next Random Triple Stumper
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {!loading && categories.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p>No triple stumper questions available yet.</p>
                        <p className="text-sm mt-2">Run the update script to fetch triple stumper data.</p>
                    </div>
                )}

                {/* Back to Top Button */}
                {showBackToTop && (
                    <button
                        onClick={scrollToTop}
                        className="fixed bottom-8 right-8 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 p-4 rounded-full shadow-2xl ring-4 ring-white/50 transition-all duration-300 z-50 flex items-center justify-center hover:scale-110"
                        aria-label="Back to top"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    )
}

function PracticeLoadingFallback() {
    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
            <div className="text-center">
                <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-yellow-600 border-r-transparent align-[-0.125em] mb-4"></div>
                <div className="text-gray-600 font-medium">Loading triple stumpers...</div>
            </div>
        </div>
    )
}

export default function TripleStumpersPractice() {
    return (
        <Suspense fallback={<PracticeLoadingFallback />}>
            <TripleStumpersContent />
        </Suspense>
    )
}
