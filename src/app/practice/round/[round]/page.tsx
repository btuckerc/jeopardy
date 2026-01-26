// @ts-nocheck
'use client'

import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../../lib/auth'
import { getRoundCategories, getRandomQuestion, getCategoryQuestions } from '../../../actions/practice'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import type { RawCategory, RawQuestion } from '@/types/practice'

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
    questions: Array<{
        id: string;
        airDate: Date | null;
        gameHistory: Array<{
            timestamp: Date;
            correct: boolean;
        }>;
        incorrectAttempts: Date[];
        correct: boolean;
        isLocked: boolean;
        hasIncorrectAttempts: boolean;
    }>;
};

type QuestionState = {
    incorrectAttempts: Date[]
    correct: boolean
    lastAttemptDate?: Date
}

function LoadingSpinner() {
    return (
        <div className="flex justify-center items-center p-4">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent align-[-0.125em]" />
        </div>
    )
}

function UrlErrorDisplay({ 
    error, 
    onGoBack, 
    onGoHome 
}: { 
    error: { type: string; message: string; invalidValue: string };
    onGoBack: () => void;
    onGoHome: () => void;
}) {
    return (
        <div className="max-w-lg mx-auto mt-12">
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                    {error.type === 'knowledgeCategory' && 'Knowledge Category Not Found'}
                    {error.type === 'category' && 'Category Not Found'}
                    {error.type === 'question' && 'Question Not Found'}
                </h2>
                <p className="text-gray-600 mb-4">
                    {error.message}
                </p>
                <div className="bg-gray-100 rounded-md p-3 mb-6">
                    <code className="text-sm text-gray-700 break-all">
                        {error.invalidValue}
                    </code>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                        onClick={onGoBack}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                    >
                        {error.type === 'knowledgeCategory' && 'Browse All Categories'}
                        {error.type === 'category' && 'Back to Knowledge Category'}
                        {error.type === 'question' && 'Back to Category'}
                    </button>
                    <button
                        onClick={onGoHome}
                        className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition-colors"
                    >
                        Start Fresh
                    </button>
                </div>
            </div>
        </div>
    )
}

function CategoryCard({ category, onSelect, isKnowledgeCategory = false }: {
    category: Category
    onSelect: (id: string) => void
    isKnowledgeCategory?: boolean
}) {
    const totalQuestions = Number(category.totalQuestions);
    const correctQuestions = Number(category.correctQuestions);
    const progressPercentage = Math.round((correctQuestions / totalQuestions) * 100) || 0;
    const isComplete = progressPercentage === 100;
    const bgColor = isKnowledgeCategory || !isComplete ? 'bg-blue-600' : 'bg-green-600';
    const hoverColor = isKnowledgeCategory || !isComplete ? 'hover:bg-blue-700' : 'hover:bg-green-700';

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
                        {correctQuestions.toLocaleString()} / {totalQuestions.toLocaleString()} questions
                    </p>
                    <p className="text-sm font-medium">
                        {progressPercentage}%
                    </p>
                </div>
            </div>
        </button>
    )
}

function SpoilerWarning({ airDate }: { airDate: Date }) {
    return (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex">
                <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                </div>
                <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                        This question aired on {new Date(airDate).toLocaleDateString()}. Viewing it may spoil a recent episode.
                    </p>
                </div>
            </div>
        </div>
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
            : 'bg-blue-600 hover:bg-blue-700';

    const lockoutTimeRemaining = question.isLocked && question.incorrectAttempts[0]
        ? Math.ceil((10 * 60 * 1000 - (new Date().getTime() - new Date(question.incorrectAttempts[0]).getTime())) / 60000)
        : 0;

    return (
        <div className="space-y-2">
            {isSpoiler && <SpoilerWarning airDate={question.airDate!} />}
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

// Helper function to ensure timestamps are Date objects
const ensureDate = (timestamp: string | Date | null): Date | null => {
    if (!timestamp) return null;
    return timestamp instanceof Date ? timestamp : new Date(timestamp);
};

// Helper function to transform API response to match our types
const transformApiResponse = (categories: RawCategory[]): Category[] => {
    return categories.map(category => ({
        ...category,
        questions: category.questions?.map((q: RawQuestion) => ({
            id: q.id,
            question: q.question || '',
            answer: q.answer || '',
            value: q.value || 0,
            categoryId: q.categoryId || category.id,
            categoryName: q.categoryName || category.name,
            originalCategory: q.originalCategory || category.name,
            airDate: ensureDate(q.airDate),
            gameHistory: (q.gameHistory || []).map((h: { timestamp: string; correct: boolean }) => ({
                timestamp: ensureDate(h.timestamp)!,
                correct: h.correct
            })),
            incorrectAttempts: (q.incorrectAttempts || []).map((t: string | Date) => ensureDate(t)!),
            answered: q.answered || false,
            correct: q.correct || false,
            isLocked: q.isLocked || false,
            hasIncorrectAttempts: q.hasIncorrectAttempts || false
        }))
    }));
};

// Helper function to transform questions
const transformQuestions = (questions: RawQuestion[]): Question[] => {
    return questions.map(q => ({
        id: q.id,
        question: q.question,
        answer: q.answer,
        value: q.value || 0,
        categoryId: q.categoryId,
        categoryName: q.categoryName,
        originalCategory: q.originalCategory || q.category?.name,
        airDate: ensureDate(q.airDate),
            gameHistory: (q.gameHistory || []).map((h: { timestamp: string; correct: boolean }) => ({
            timestamp: ensureDate(h.timestamp)!,
            correct: h.correct
        })),
        incorrectAttempts: (q.incorrectAttempts || []).map((t: string | Date) => ensureDate(t)!),
        answered: q.answered || false,
        correct: q.correct || false,
        isLocked: q.isLocked || false,
        hasIncorrectAttempts: q.hasIncorrectAttempts || false
    }));
};

function FreePracticeContent() {
    const { user } = useAuth()
    const searchParams = useSearchParams()
    const router = useRouter()
    const params = useParams()
    const roundParam = params?.round as 'single' | 'double' | 'SINGLE' | 'DOUBLE'
    const round = roundParam?.toUpperCase() === 'SINGLE' ? 'SINGLE' : roundParam?.toUpperCase() === 'DOUBLE' ? 'DOUBLE' : 'SINGLE'
    
    const [categories, setCategories] = useState<Category[]>([])
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
    const [questions, setQuestions] = useState<Question[]>([])
    const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
    
    // Track if we're currently restoring state from URL (to prevent URL update loops)
    const isRestoringFromUrl = useRef(false)
    // Track the last URL we set (to detect browser navigation)
    const lastUrlState = useRef<{ c: string | null; q: string | null }>({ c: null, q: null })
    // Track if we're transitioning between states (for smooth UX)
    const [isTransitioning, setIsTransitioning] = useState(false)
    // Track URL validation errors
    const [urlError, setUrlError] = useState<{
        type: 'category' | 'question';
        message: string;
        invalidValue: string;
    } | null>(null)
    
    // Helper function to update URL parameters without full page reload
    const updateUrlParams = useCallback((params: { 
        category?: string | null; 
        question?: string | null 
    }) => {
        // Don't update URL if we're restoring from URL
        if (isRestoringFromUrl.current) return
        
        const url = new URL(window.location.href)
        
        // Handle category
        if (params.category !== undefined) {
            if (params.category) {
                url.searchParams.set('category', params.category)
            } else {
                url.searchParams.delete('category')
            }
        }
        
        // Handle question
        if (params.question !== undefined) {
            if (params.question) {
                url.searchParams.set('question', params.question)
            } else {
                url.searchParams.delete('question')
            }
        }
        
        // Don't update lastUrlState here - let the URL restoration effect handle it
        // This ensures the effect can detect URL changes properly
        
        // Use router.replace to update URL without adding to history stack for minor navigation
        // This preserves the browser back button for meaningful navigation
        router.replace(url.pathname + url.search, { scroll: false })
    }, [router])
    const [userAnswer, setUserAnswer] = useState('')
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
    const [loadingQuestions, setLoadingQuestions] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)
    const [questionStates, setQuestionStates] = useState<Record<string, QuestionState>>({})
    const [currentPage, setCurrentPage] = useState(1)
    const [hasMore, setHasMore] = useState(false)
    const loadMoreRef = useRef<HTMLDivElement>(null)
    const [spoilerDate, setSpoilerDate] = useState<Date | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [serverResults, setServerResults] = useState<Category[]>([])
    const [_isSearchingServer, _setIsSearchingServer] = useState(false)
    const _searchTimeoutRef = useRef<NodeJS.Timeout>()
    // Initialize sortBy from localStorage synchronously to avoid flash
    const [sortBy, setSortBy] = useState<'airDate' | 'completion'>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('practice_sort_preference')
            if (saved === 'airDate' || saved === 'completion') {
                return saved
            }
        }
        return 'airDate'
    })
    // Initialize sortDirection from localStorage synchronously to avoid flash
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('practice_sort_direction')
            if (saved === 'asc' || saved === 'desc') {
                return saved
            }
        }
        return 'desc'
    })
    const [isSortTransitioning, setIsSortTransitioning] = useState(false)
    const sortByRef = useRef(sortBy) // Track sortBy for initial load
    const sortDirectionRef = useRef(sortDirection) // Track sortDirection for initial load
    const isInitialMount = useRef(true)
    
    // Keep sortByRef and sortDirectionRef in sync
    useEffect(() => {
        sortByRef.current = sortBy
    }, [sortBy])
    
    useEffect(() => {
        sortDirectionRef.current = sortDirection
    }, [sortDirection])
    
    const [showBackToTop, setShowBackToTop] = useState(false)

    // Persist sort preference to localStorage when user changes it
    const handleSortChange = useCallback((newSort: 'airDate' | 'completion') => {
        setSortBy(newSort)
        localStorage.setItem('practice_sort_preference', newSort)
    }, [])
    
    // Persist sort direction to localStorage when user changes it
    const handleSortDirectionChange = useCallback((newDirection: 'asc' | 'desc') => {
        setSortDirection(newDirection)
        localStorage.setItem('practice_sort_direction', newDirection)
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

    // Client-side filtered categories
    const clientFilteredCategories = useMemo(() => {
        if (!searchQuery || searchQuery.length < 2) return []
        const query = searchQuery.toLowerCase()
        return categories.filter(category =>
            category.name.toLowerCase().includes(query)
        )
    }, [searchQuery, categories])

    // Combined unique results
    const combinedResults = useMemo(() => {
        if (!searchQuery || searchQuery.length < 2) return categories

        // Create a map of existing client results
        const clientResultsMap = new Map(clientFilteredCategories.map(cat => [cat.id, cat]))

        // Add server results that aren't in client results
        const uniqueServerResults = serverResults.filter(cat => !clientResultsMap.has(cat.id))

        return [...clientFilteredCategories, ...uniqueServerResults]
    }, [searchQuery, categories, clientFilteredCategories, serverResults])

    // Reset search and reload categories when clearing search
    useEffect(() => {
        if (!searchQuery) {
            const reloadCategories = async () => {
                setCurrentPage(1)
                setServerResults([])
                try {
                    const result = await getRoundCategories(round, user?.id, 1, 20, sortBy, sortDirection)
                    const transformedCategories = transformApiResponse(result.categories)
                    setCategories(transformedCategories)
                    setHasMore(result.hasMore)
                } catch (error) {
                    console.error('Error reloading categories:', error)
                }
            }
            reloadCategories()
        }
    }, [searchQuery, round, user?.id, sortBy, sortDirection])

    // Server-side search effect - disabled for round practice (no search needed)
    useEffect(() => {
        setServerResults([])
    }, [])

    // Load initial categories for the round (runs once on mount or when user/round changes)
    useEffect(() => {
        const loadRoundCategories = async () => {
            try {
                const result = await getRoundCategories(round, user?.id, 1, 20, sortByRef.current, sortDirectionRef.current)
                const transformedCategories = transformApiResponse(result.categories)
                setCategories(transformedCategories)
                setHasMore(result.hasMore)
            } catch (error) {
                console.error('Error loading round categories:', error)
            } finally {
                setLoading(false)
                isInitialMount.current = false
            }
        }
        loadRoundCategories()
    }, [user?.id, round])
    
    // Refetch categories when sort order or direction changes (not on initial mount)
    useEffect(() => {
        if (isInitialMount.current) return
        
        const refetchWithNewSort = async () => {
            setIsSortTransitioning(true)
            setCurrentPage(1)
            
            try {
                const result = await getRoundCategories(round, user?.id, 1, 20, sortBy, sortDirection)
                const transformedCategories = transformApiResponse(result.categories)
                
                // Small delay to allow fade-out animation
                await new Promise(resolve => setTimeout(resolve, 150))
                
                setCategories(transformedCategories)
                setHasMore(result.hasMore)
            } catch (error) {
                console.error('Error refetching categories:', error)
            } finally {
                setIsSortTransitioning(false)
            }
        }
        
        refetchWithNewSort()
    }, [sortBy, sortDirection, round, user?.id])
    
    // Handle URL state restoration and browser navigation
    // This effect runs when searchParams change (including browser back/forward)
    useEffect(() => {
        const restoreStateFromUrl = async () => {
            const categoryParam = searchParams.get('category')
            const questionParam = searchParams.get('question')
            
            // Check if the URL actually changed (not just a re-render)
            const currentUrlState = { c: categoryParam, q: questionParam }
            const lastState = lastUrlState.current
            
            const urlChanged = lastState.c !== currentUrlState.c || 
                               lastState.q !== currentUrlState.q
            
            // If URL hasn't changed, no need to do anything
            if (!urlChanged && !loading) return
            
            // Update our tracking ref
            lastUrlState.current = currentUrlState
            
            // Set flag to prevent URL update loops during restoration
            isRestoringFromUrl.current = true
            
            // Clear any previous URL errors when navigating
            setUrlError(null)
            
            try {
                // Case 1: No category - just clear category and question selection
                if (!categoryParam) {
                    setSelectedCategory(null)
                    setSelectedQuestion(null)
                    isRestoringFromUrl.current = false
                    return
                }
                
                // Validate category UUID format (basic check)
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
                if (!uuidRegex.test(categoryParam)) {
                    setUrlError({
                        type: 'category',
                        message: `The category ID "${categoryParam}" is not a valid format. Please check the URL.`,
                        invalidValue: categoryParam
                    })
                    setSelectedCategory(null)
                    setSelectedQuestion(null)
                    setIsTransitioning(false)
                    isRestoringFromUrl.current = false
                    return
                }
                
                // Case 2: Category changed or being restored
                const categoryChanged = selectedCategory !== categoryParam
                if (categoryChanged || questions.length === 0) {
                    // Show transition overlay but DON'T change view state yet
                    setIsTransitioning(true)
                    
                    // Load questions FIRST before updating view state (filter by round)
                    const questionsData = await getCategoryQuestions(categoryParam, '', user?.id, undefined, round)
                    const transformedQuestions = transformQuestions(questionsData)
                    
                    // Check if category exists (has questions)
                    if (transformedQuestions.length === 0) {
                        setUrlError({
                            type: 'category',
                            message: `The category with ID "${categoryParam}" was not found or has no questions. It may have been removed or the URL is incorrect.`,
                            invalidValue: categoryParam
                        })
                        setIsTransitioning(false)
                        isRestoringFromUrl.current = false
                        return
                    }
                    
                    // Atomically update ALL state together - prevents flash
                    setSelectedCategory(categoryParam)
                    setQuestions(transformedQuestions)
                    
                    // Case 3: Restore question selection if present
                    if (questionParam) {
                        // Validate question UUID format
                        if (!uuidRegex.test(questionParam)) {
                            setUrlError({
                                type: 'question',
                                message: `The question ID "${questionParam}" is not a valid format. Please check the URL.`,
                                invalidValue: questionParam
                            })
                            setSelectedQuestion(null)
                            setIsTransitioning(false)
                            isRestoringFromUrl.current = false
                            return
                        }
                        
                        const question = transformedQuestions.find(q => q.id === questionParam)
                        if (question) {
                            setSelectedQuestion(question)
                            setUserAnswer('')
                            setIsCorrect(null)
                            setShowAnswer(false)
                        } else {
                            // Question not found in this category
                            setUrlError({
                                type: 'question',
                                message: `The question with ID "${questionParam}" was not found in this category. It may have been removed or the URL is incorrect.`,
                                invalidValue: questionParam
                            })
                            setSelectedQuestion(null)
                        }
                    } else {
                        setSelectedQuestion(null)
                    }
                    setIsTransitioning(false)
                } else if (questionParam !== selectedQuestion?.id) {
                    // Case 4: Only question changed - no loading needed
                    if (questionParam) {
                        // Validate question UUID format
                        if (!uuidRegex.test(questionParam)) {
                            setUrlError({
                                type: 'question',
                                message: `The question ID "${questionParam}" is not a valid format. Please check the URL.`,
                                invalidValue: questionParam
                            })
                            setSelectedQuestion(null)
                            isRestoringFromUrl.current = false
                            return
                        }
                        
                        const question = questions.find(q => q.id === questionParam)
                        if (question) {
                            setSelectedQuestion(question)
                            setUserAnswer('')
                            setIsCorrect(null)
                            setShowAnswer(false)
                        } else {
                            // Question not found
                            setUrlError({
                                type: 'question',
                                message: `The question with ID "${questionParam}" was not found in this category. It may have been removed or the URL is incorrect.`,
                                invalidValue: questionParam
                            })
                            setSelectedQuestion(null)
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
        
        // Don't try to restore while still loading categories
        if (!loading) {
            restoreStateFromUrl()
        }
    }, [searchParams, loading, user?.id, selectedCategory, selectedQuestion?.id, questions, round])

    // Intersection Observer for infinite scrolling
     
    useEffect(() => {
        if (!loadMoreRef.current || !hasMore || loadingMore) return

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasMore, loadingMore, round])

    const loadMoreCategories = async () => {
        if (loadingMore) return

        setLoadingMore(true)
        try {
            const nextPage = currentPage + 1
            const result = await getRoundCategories(round, user?.id, nextPage, 20, sortBy, sortDirection)
            const transformedCategories = transformApiResponse(result.categories)
            setCategories(prev => [...prev, ...transformedCategories])
            setCurrentPage(nextPage)
            setHasMore(result.hasMore)
        } catch (error) {
            console.error('Error loading more categories:', error)
        } finally {
            setLoadingMore(false)
        }
    }

    const handleCategorySelect = useCallback(async (categoryId: string) => {
        if (categoryId === selectedCategory) return;
        
        // Show transition overlay but DON'T change view state yet
        setIsTransitioning(true);
        setLoadingQuestions(true);
        
        // Update URL immediately for browser history
        updateUrlParams({ category: categoryId, question: null });

        try {
            // Load data FIRST before updating view state - keeps current view visible (filter by round)
            const questionsData = await getCategoryQuestions(categoryId, '', user?.id, undefined, round);
            const transformedQuestions = transformQuestions(questionsData);
            
            // Atomically update ALL state together in one batch - React batches these
            // This prevents the flash because the view switches only when data is ready
            setSelectedCategory(categoryId);
            setSelectedQuestion(null);
            setQuestions(transformedQuestions);
        } catch (error) {
            console.error('Error loading questions:', error);
        } finally {
            setLoadingQuestions(false);
            setIsTransitioning(false);
        }
    }, [selectedCategory, user?.id, updateUrlParams, round]);


    // Load question states from local storage
    useEffect(() => {
        const loadQuestionStates = () => {
            if (!user?.id) return

            // Load from local storage
            const storedStates = localStorage.getItem(`questionStates_${user.id}`)
            const localStates = storedStates ? JSON.parse(storedStates) : {}
            setQuestionStates(localStates)
        }

        loadQuestionStates()
    }, [user?.id])

    // Save states to local storage whenever they change
    useEffect(() => {
        if (user?.id) {
            localStorage.setItem(`questionStates_${user.id}`, JSON.stringify(questionStates))
        }
    }, [questionStates, user?.id])

    const handleBackToQuestions = useCallback(async () => {
        setSelectedQuestion(null)
        setUserAnswer('')
        setShowAnswer(false)
        setIsCorrect(null)
        
        // Clear question from URL
        updateUrlParams({ question: null })

        if (user?.id) {
            try {
                const result = await getRoundCategories(round, user.id, currentPage, 20, sortBy, sortDirection)
                const transformedCategories = transformApiResponse(result.categories)
                setCategories(transformedCategories)
                setHasMore(result.hasMore)
            } catch (error) {
                console.error('Error refreshing categories:', error)
            }
        }
    }, [user?.id, currentPage, updateUrlParams, round, sortBy, sortDirection])

    const handleQuestionSelect = useCallback((question: Question) => {
        if (!question) return;
        setSelectedQuestion(question);
        setUserAnswer('');
        setIsCorrect(null);
        setShowAnswer(false);
        
        // Update URL with the selected question ID
        updateUrlParams({ question: question.id });
    }, [updateUrlParams]);

    const handleAnswerSubmit = async () => {
        if (!selectedQuestion?.answer || !userAnswer || !user?.id) return;

        try {
            // Use the centralized grading API
            const response = await fetch('/api/answers/grade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    questionId: selectedQuestion.id,
                    mode: 'PRACTICE',
                    round: round,
                    userAnswer: userAnswer.trim()
                })
            })

            if (!response.ok) {
                throw new Error('Failed to grade answer')
            }

            const data = await response.json()
            setIsCorrect(data.correct)
            setShowAnswer(true)
            setDisputeContext(data.disputeContext)
            setDisputeSubmitted(false)

            // Update local state
            const isAnswerCorrect = data.correct
            const newIncorrectAttempts = !isAnswerCorrect
                ? [new Date(), ...(selectedQuestion.incorrectAttempts || [])]
                : selectedQuestion.incorrectAttempts;

            // Update the selected question state
            setSelectedQuestion(prev => {
                if (!prev) return null;
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
                    incorrectAttempts: newIncorrectAttempts,
                    isLocked: !isAnswerCorrect,
                    hasIncorrectAttempts: !isAnswerCorrect || prev.hasIncorrectAttempts
                };
            });

            // Update questions state with new game history
            setQuestions(prevQuestions =>
                transformQuestions(prevQuestions.map(q =>
                    q.id === selectedQuestion.id
                        ? {
                            ...q,
                            correct: isAnswerCorrect || q.correct,
                            gameHistory: [
                                {
                                    timestamp: new Date(),
                                    correct: isAnswerCorrect
                                },
                                ...q.gameHistory
                            ],
                            incorrectAttempts: newIncorrectAttempts,
                            isLocked: !isAnswerCorrect,
                            hasIncorrectAttempts: !isAnswerCorrect || q.hasIncorrectAttempts
                        }
                        : q
                ))
            );
        } catch (error) {
            console.error('Error submitting answer:', error)
            alert('Failed to submit answer. Please try again.')
        }
    };

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

    const handleShowAnswer = () => {
        if (!selectedQuestion) return;

        const newIncorrectAttempts = [new Date(), ...(selectedQuestion.incorrectAttempts || [])];

        // Update the selected question state
        setSelectedQuestion(prev => {
            if (!prev) return null;
            return {
                ...prev,
                gameHistory: [
                    {
                        timestamp: new Date(),
                        correct: false
                    },
                    ...prev.gameHistory
                ],
                incorrectAttempts: newIncorrectAttempts,
                isLocked: true,
                hasIncorrectAttempts: true
            };
        });

        // Update questions state
        setQuestions(prevQuestions =>
            transformQuestions(prevQuestions.map(q =>
                q.id === selectedQuestion.id
                    ? {
                        ...q,
                        gameHistory: [
                            {
                                timestamp: new Date(),
                                correct: false
                            },
                            ...q.gameHistory
                        ],
                        incorrectAttempts: newIncorrectAttempts,
                        isLocked: true,
                        hasIncorrectAttempts: true
                    }
                    : q
            ))
        );

        setShowAnswer(true);
    };

    const handleShuffle = useCallback(async () => {
        try {
            // Determine what level we're shuffling at
            // - No knowledge category selected: shuffle ALL questions
            // - Knowledge category selected but no category: shuffle within knowledge category
            // - Category selected: shuffle within that specific category
            
            const randomQuestion = await getRandomQuestion(
                undefined,
                selectedCategory || undefined,
                user?.id,
                selectedQuestion?.id,
                round // Filter by round
            );

            if (!randomQuestion) {
                toast.error('No more questions available');
                return;
            }

            // Case 1: Shuffling within a specific category
            if (selectedCategory) {
                const questions = await getCategoryQuestions(
                    randomQuestion.categoryId, 
                    '', 
                    user?.id,
                    undefined,
                    round
                );
                setQuestions(transformQuestions(questions));
                
                // Update URL with the question (category stays the same)
                updateUrlParams({ question: randomQuestion.id });
            }
            // Case 2: Shuffling ALL questions in the round (no category selected)
            else {
                // Update the category to match the random question's category
                setSelectedCategory(randomQuestion.categoryId);
                
                const questions = await getCategoryQuestions(
                    randomQuestion.categoryId, 
                    '', 
                    user?.id,
                    undefined,
                    round
                );
                setQuestions(transformQuestions(questions));
                
                // Update URL with category and question
                updateUrlParams({ category: randomQuestion.categoryId, question: randomQuestion.id });
            }

            // Set the selected question and reset answer state
            setSelectedQuestion({
                ...randomQuestion,
                gameHistory: [],
                isLocked: false,
                hasIncorrectAttempts: false
            });
            setUserAnswer('');
            setShowAnswer(false);
            setIsCorrect(null);
        } catch (error) {
            console.error('Error shuffling question:', error);
            toast.error('Failed to load random question');
        }
    }, [selectedCategory, selectedQuestion?.id, user?.id, updateUrlParams, round]);

    const getShuffleButtonText = () => {
        // If we're at the category or question level
        const category = categories.find(c => c.id === selectedCategory)
        if (category) {
            return `Shuffle in ${category.name}`
        }

        // If we don't have the category in state (e.g., after a random shuffle),
        // use the selected question's category name
        if (selectedQuestion) {
            return `Shuffle in ${selectedQuestion.originalCategory}`
        }

        return `Shuffle ${round === 'SINGLE' ? 'Single' : 'Double'} Jeopardy Questions`
    }

    const _isQuestionDisabled = (questionId: string) => {
        const state = questionStates[questionId]
        if (!state?.incorrectAttempts?.length) return false

        const lastAttempt = new Date(state.incorrectAttempts[state.incorrectAttempts.length - 1])
        return new Date().getTime() - lastAttempt.getTime() < 30 * 60 * 1000
    }

    // Sort questions by value when displaying
    const sortedQuestions = [...questions].sort((a, b) => (a.value || 200) - (b.value || 200))

    useEffect(() => {
        if (user?.id) {
            // Fetch user's spoiler settings
            fetch('/api/user/spoiler-settings')
                .then(res => res.json())
                .then(data => {
                    if (data.spoilerBlockEnabled && data.spoilerBlockDate) {
                        setSpoilerDate(new Date(data.spoilerBlockDate))
                    } else {
                        setSpoilerDate(null)
                    }
                })
                .catch(console.error)
        }
    }, [user?.id])

    // Categories are sorted server-side via the sortBy and sortDirection parameters.
    // For lazy-loaded pages, we trust the server's ordering.
    // When sorting by completion, we split into in-progress and not-started groups for display.
    const { inProgressCategories: _inProgressCategories, notStartedCategories: _notStartedCategories, sortedCategories } = useMemo(() => {
        const categoriesToSort = searchQuery && searchQuery.length >= 2 ? combinedResults : categories;
        
        if (sortBy === 'completion') {
            // Split into in-progress and not-started (server already sorted each group)
            const inProgress = categoriesToSort.filter(c => Number(c.correctQuestions) > 0);
            const notStarted = categoriesToSort.filter(c => Number(c.correctQuestions) === 0);
            
            return {
                inProgressCategories: inProgress,
                notStartedCategories: notStarted,
                sortedCategories: [...inProgress, ...notStarted]
            };
        }
        
        // For date sorting, server handles the order - just pass through
        return {
            inProgressCategories: [],
            notStartedCategories: [],
            sortedCategories: categoriesToSort
        };
    }, [categories, combinedResults, sortBy, searchQuery]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent align-[-0.125em] mb-4"></div>
                    <div className="text-gray-600 font-medium">Loading study mode...</div>
                </div>
            </div>
        )
    }

    return (
        <div className="container mx-auto px-4 py-8">
            {loading ? (
                <LoadingSpinner />
            ) : (
                <div className="relative">
                        {/* Transition overlay - shows subtle loading state during navigation */}
                        {isTransitioning && (
                            <div className="absolute inset-0 bg-gray-100/50 z-10 flex items-start justify-center pt-32 pointer-events-none">
                                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent" />
                            </div>
                        )}
                        
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
                            <h1 className="text-2xl font-bold text-gray-900">
                                {round === 'SINGLE' ? 'Single Jeopardy' : 'Double Jeopardy'} Practice
                            </h1>
                            <button
                                onClick={handleShuffle}
                                disabled={loadingQuestions || isTransitioning || !!urlError}
                                className="px-6 py-3 bg-purple-400 text-white rounded-lg hover:bg-purple-500 disabled:opacity-50 transition-colors font-bold text-lg shadow-lg hover:shadow-xl flex items-center gap-2"
                            >
                                {loadingQuestions ? <LoadingSpinner /> : (
                                    <>
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        {getShuffleButtonText()}
                                    </>
                                )}
                            </button>
                        </div>

                        {/* URL Error Display */}
                        {urlError && (
                            <UrlErrorDisplay
                                error={urlError}
                                onGoBack={() => {
                                    setUrlError(null)
                                    if (urlError.type === 'category') {
                                        // Go back to knowledge category
                                        setSelectedCategory(null)
                                        updateUrlParams({ category: null, question: null })
                                    } else if (urlError.type === 'question') {
                                        // Go back to category
                                        setSelectedQuestion(null)
                                        updateUrlParams({ question: null })
                                    }
                                }}
                                onGoHome={() => {
                                    setUrlError(null)
                                    setSelectedCategory(null)
                                    setSelectedQuestion(null)
                                    setCategories([])
                                    setQuestions([])
                                    updateUrlParams({ category: null, question: null })
                                }}
                            />
                        )}

                        {/* Categories with Search and Infinite Scroll */}
                        {/* Show when: (no category selected OR category selected but questions not loaded), AND categories are loaded */}
                        {/* Keep visible during transition to Questions to prevent flash */}
                        {!urlError && (!selectedCategory || (selectedCategory && questions.length === 0)) && categories.length > 0 && (
                            <div className={`transition-opacity duration-200 ${(isTransitioning || (selectedCategory && questions.length === 0)) ? 'opacity-50' : 'opacity-100'}`}>
                                <div className="mb-6 space-y-4">
                                    <div className="flex items-center">
                                    </div>

                                    {/* Search and Sort Controls */}
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        {/* Search input */}
                                        <div className="relative flex items-center flex-1">
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder="Search categories..."
                                                className="w-full p-3 pr-16 border rounded-lg text-black"
                                            />
                                            {searchQuery && (
                                                <button
                                                    onClick={() => setSearchQuery('')}
                                                    className="absolute right-3 p-1 hover:bg-gray-100 rounded-full"
                                                    aria-label="Clear search"
                                                >
                                                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                        
                                        {/* Sort Controls Container */}
                                        <div className="flex items-center gap-2">
                                            {/* Asc/Desc Toggle */}
                                            <div className="relative grid grid-cols-2 bg-blue-600 rounded-lg p-1 shadow-md min-w-[80px]">
                                                <div 
                                                    style={{
                                                        transition: 'transform 350ms cubic-bezier(0.4, 0.0, 0.2, 1)',
                                                        transform: sortDirection === 'desc' ? 'translateX(100%)' : 'translateX(0)',
                                                    }}
                                                    className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] bg-amber-400 rounded-md shadow-sm will-change-transform"
                                                />
                                                <button
                                                    onClick={() => handleSortDirectionChange('asc')}
                                                    className={`relative z-10 flex items-center justify-center p-2 rounded-md transition-colors duration-200 ${
                                                        sortDirection === 'asc'
                                                            ? 'text-blue-900'
                                                            : 'text-white/70 hover:text-white'
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
                                                        sortDirection === 'desc'
                                                            ? 'text-blue-900'
                                                            : 'text-white/70 hover:text-white'
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
                                            <div className="relative grid grid-cols-2 bg-blue-600 rounded-lg p-1 shadow-md min-w-[200px]">
                                                {/* Sliding pill indicator - GPU-accelerated with spring-like easing */}
                                                <div 
                                                    style={{
                                                        transition: 'transform 350ms cubic-bezier(0.4, 0.0, 0.2, 1)',
                                                        transform: sortBy === 'completion' ? 'translateX(100%)' : 'translateX(0)',
                                                    }}
                                                    className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] bg-amber-400 rounded-md shadow-sm will-change-transform"
                                                />
                                                <button
                                                    onClick={() => handleSortChange('airDate')}
                                                    className={`relative z-10 flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium transition-colors duration-200 ${
                                                        sortBy === 'airDate'
                                                            ? 'text-blue-900'
                                                            : 'text-white/70 hover:text-white'
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
                                                        sortBy === 'completion'
                                                            ? 'text-blue-900'
                                                            : 'text-white/70 hover:text-white'
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
                                </div>

                                {/* Show loading state when categories are being loaded */}
                                {categories.length === 0 && isTransitioning ? (
                                    <div className="flex justify-center py-12">
                                        <LoadingSpinner />
                                    </div>
                                ) : (
                                    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 transition-opacity duration-200 ${isSortTransitioning ? 'opacity-40' : 'opacity-100'}`}>
                                        {isSortTransitioning && (
                                            <div className="col-span-full absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                                                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent" />
                                            </div>
                                        )}
                                        {searchQuery.length >= 2 ? (
                                            combinedResults.length > 0 ? (
                                                sortedCategories.map((category, index) => (
                                                    <div 
                                                        key={category.id}
                                                        className="transition-all duration-300"
                                                        style={{ 
                                                            transitionDelay: isSortTransitioning ? '0ms' : `${Math.min(index * 30, 300)}ms`,
                                                        }}
                                                    >
                                                        <CategoryCard
                                                            category={category}
                                                            onSelect={handleCategorySelect}
                                                        />
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="col-span-full text-center text-gray-500 py-8">
                                                    {isSearchingServer ? (
                                                        <div className="flex items-center justify-center gap-3">
                                                            <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent" />
                                                            <span>Searching more categories...</span>
                                                        </div>
                                                    ) : (
                                                        `No categories found matching "${searchQuery}"`
                                                    )}
                                                </div>
                                            )
                                        ) : (
                                            sortedCategories.map((category, index) => (
                                                <div 
                                                    key={category.id}
                                                    className="transition-all duration-300"
                                                    style={{ 
                                                        transitionDelay: isSortTransitioning ? '0ms' : `${Math.min(index * 30, 300)}ms`,
                                                    }}
                                                >
                                                    <CategoryCard
                                                        category={category}
                                                        onSelect={handleCategorySelect}
                                                    />
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}

                                {/* Load More section */}
                                {hasMore && !searchQuery && (
                                    <div className="mt-8 flex justify-center" ref={loadMoreRef}>
                                        {loadingMore ? (
                                            <LoadingSpinner />
                                        ) : (
                                            <button
                                                onClick={loadMoreCategories}
                                                className="px-6 py-3 bg-blue-400 text-white rounded-lg hover:bg-blue-500 transition-colors"
                                            >
                                                Load More Categories
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Questions Grid */}
                        {/* Show when: category selected, no question selected, AND questions are loaded */}
                        {/* Keep Categories view visible during transition to prevent flash */}
                        {!urlError && selectedCategory && !selectedQuestion && questions.length > 0 && (
                            <div className={`transition-opacity duration-200 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}>
                                <div className="mb-6 flex items-center">
                                    <button
                                        onClick={() => {
                                            // Atomically clear category and question state
                                            setSelectedCategory(null)
                                            setSelectedQuestion(null)
                                            setQuestions([])
                                            // Clear category and question from URL
                                            updateUrlParams({ category: null, question: null })
                                        }}
                                        className="text-blue-600 hover:text-blue-800 flex items-center font-bold"
                                        disabled={isTransitioning}
                                    >
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                        Back to Categories
                                    </button>
                                </div>

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

                        {/* Selected Question */}
                        {!urlError && selectedQuestion && (
                            <div className="max-w-3xl mx-auto">
                                <div className="bg-white shadow-lg rounded-lg p-6 relative">
                                    <div className="flex justify-between items-center mb-4">
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
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value={userAnswer}
                                                                onChange={(e) => setUserAnswer(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        handleAnswerSubmit()
                                                                    }
                                                                }}
                                                                className="w-full p-3 border rounded-lg text-black"
                                                                placeholder="What is..."
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
                                                                <button
                                                                    onClick={() => window.alert('Tips for answering:\n\n• You don\'t need to type "What is" - it\'s optional\n• Articles like "a", "an", "the" are ignored\n• Punctuation is ignored\n• Capitalization doesn\'t matter\n• Close answers may be accepted')}
                                                                    className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-bold"
                                                                    aria-label="Show answer tips"
                                                                >
                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                    </svg>
                                                                    Help
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
                                                        onClick={handleBackToQuestions}
                                                        className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-bold"
                                                    >
                                                        Back to Questions
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
            )}
        </div>
    )
}

// Loading fallback for Suspense boundary
function PracticeLoadingFallback() {
    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
            <div className="text-center">
                <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent align-[-0.125em] mb-4"></div>
                <div className="text-gray-600 font-medium">Loading study mode...</div>
            </div>
        </div>
    )
}

// Wrap the main component in Suspense to support useSearchParams
export default function FreePractice() {
    return (
        <Suspense fallback={<PracticeLoadingFallback />}>
            <FreePracticeContent />
        </Suspense>
    )
}