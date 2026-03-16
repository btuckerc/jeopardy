'use client'

import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth } from '../../lib/auth'
import { getKnowledgeCategoryDetails, getRandomQuestion, saveAnswer, getCategoryQuestions, getCategoryStudyContext } from '../../actions/practice'
import { checkAnswer } from '../../lib/answer-checker'
import { scrollInputIntoView } from '@/app/hooks/useMobileKeyboard'
import { AnswerExplanationPanel } from '../components/PracticeAnswerExplanation'
import { StudyActionButton, StudyBackButton, StudyBackLink, StudyToggle, showPracticeAnswerTipsToast } from '../components/PracticeControls'
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

type InterleaveCategoryStats = {
    attempts: number
    correct: number
    consecutiveIncorrect: number
    lastSeenAt: number
}

type InterleaveState = {
    currentCategoryId: string | null
    remainingInBlock: number
    retentionByCategory: Record<string, InterleaveCategoryStats>
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
const ensureDate = (timestamp: string | Date | null | undefined): Date | null => {
    if (!timestamp) return null;
    return timestamp instanceof Date ? timestamp : new Date(timestamp);
};

const INTERLEAVE_BLOCK_SIZE = 3

// Helper function to transform API response to match our types
const transformApiResponse = (categories: RawCategory[]): Category[] => {
    return categories.map(category => {
        const questions = category.questions?.map((q: RawQuestion) => ({
            id: q.id,
            airDate: ensureDate(q.airDate),
            gameHistory: (q.gameHistory || []).map((h: { timestamp: string; correct: boolean }) => ({
                timestamp: ensureDate(h.timestamp)!,
                correct: h.correct
            })),
            incorrectAttempts: (q.incorrectAttempts || []).map((t: string | Date) => ensureDate(t)!),
            correct: q.correct || false,
            isLocked: q.isLocked || false,
            hasIncorrectAttempts: q.hasIncorrectAttempts || false
        })) || [];

        return {
            id: category.id,
            name: category.name,
            totalQuestions: questions.length,
            correctQuestions: questions.filter(q => q.correct).length,
            mostRecentAirDate: questions.reduce((latest, q) => {
                if (!q.airDate) return latest;
                if (!latest) return q.airDate;
                return q.airDate > latest ? q.airDate : latest;
            }, null as Date | null),
            questions
        };
    });
};

// Helper function to transform questions
const transformQuestions = (questions: RawQuestion[]): Question[] => {
    return questions.map(q => ({
        id: q.id,
        question: q.question,
        answer: q.answer,
        value: q.value || 0,
        categoryId: q.categoryId || '',
        categoryName: q.categoryName || '',
        originalCategory: q.originalCategory || (q as RawQuestion & { category?: { name: string } }).category?.name || '',
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

const sortQuestionsByValue = (questionList: Question[]): Question[] => {
    return [...questionList].sort((a, b) => (a.value || 200) - (b.value || 200))
}

const getNextQuestionInSequence = (questionList: Question[], currentQuestionId: string): Question | null => {
    const orderedQuestions = sortQuestionsByValue(questionList)
    const currentIndex = orderedQuestions.findIndex(question => question.id === currentQuestionId)

    if (currentIndex === -1) {
        return orderedQuestions[0] || null
    }

    return orderedQuestions[currentIndex + 1] || null
}

const getRandomQuestionFromList = (questionList: Question[], excludeQuestionId?: string | null): Question | null => {
    if (!questionList.length) return null

    const eligibleQuestions = excludeQuestionId
        ? questionList.filter(question => question.id !== excludeQuestionId)
        : questionList

    const pool = eligibleQuestions.length > 0 ? eligibleQuestions : questionList
    const randomIndex = Math.floor(Math.random() * pool.length)
    return pool[randomIndex] || null
}

const getNextCategoryInSequence = (categoryList: Category[], currentCategoryId?: string | null): string | null => {
    const categoriesWithQuestions = categoryList.filter(category => category.totalQuestions > 0)
    if (!categoriesWithQuestions.length) return null

    const currentIndex = categoriesWithQuestions.findIndex(category => category.id === currentCategoryId)
    if (currentIndex === -1) {
        return categoriesWithQuestions[0]?.id || null
    }

    if (categoriesWithQuestions.length === 1) {
        return null
    }

    return categoriesWithQuestions[(currentIndex + 1) % categoriesWithQuestions.length]?.id || null
}

const calculateCategoryInterleaveWeight = (category: Category, retention?: InterleaveCategoryStats): number => {
    const totalAttempts = Math.max(category.totalQuestions, 1)
    const retentionAttempts = Math.max(retention?.attempts ?? 0, 0)
    const retentionCorrect = Math.max(retention?.correct ?? 0, 0)
    const combinedAttempts = totalAttempts + retentionAttempts
    const combinedAccuracy = Math.min(
        Math.max((category.correctQuestions + retentionCorrect) / Math.max(combinedAttempts, 1), 0),
        1
    )

    const accuracyWeight = 1 + (1 - combinedAccuracy) * 2
    const effortWeight = Math.log10(totalAttempts + 1) + 1
    const streakWeight = 1 + (Math.min(retention?.consecutiveIncorrect ?? 0, 4) * 0.25)
    const recencyMs = retention?.lastSeenAt ? Date.now() - retention.lastSeenAt : 0
    const recencyDays = Math.max(0, recencyMs / (24 * 60 * 60 * 1000))
    const recencyWeight = 1 + Math.min(recencyDays, 14) / 14 * 0.4

    return Math.max(0.5, accuracyWeight * effortWeight * streakWeight * recencyWeight)
}

const pickInterleaveCategory = (categories: Category[], categoryStats: Record<string, InterleaveCategoryStats>, excludeCategoryId?: string | null): string | null => {
    if (!categories.length) return null

    const weightedCategories = (excludeCategoryId && categories.length > 1
        ? categories.filter(category => category.id !== excludeCategoryId)
        : categories
    ).map(category => ({
        id: category.id,
        weight: calculateCategoryInterleaveWeight(category, categoryStats[category.id])
    }))

    if (!weightedCategories.length) return null

    const totalWeight = weightedCategories.reduce((sum, item) => sum + item.weight, 0)
    let cursor = Math.random() * totalWeight

    for (const item of weightedCategories) {
        cursor -= item.weight
        if (cursor <= 0) {
            return item.id
        }
    }

    return weightedCategories[weightedCategories.length - 1].id
}

const getInterleaveStorageKey = (userId?: string) => `practice_interleave_state_${userId || 'guest'}`

const getDefaultInterleaveState = (): InterleaveState => ({
    currentCategoryId: null,
    remainingInBlock: 0,
    retentionByCategory: {}
})

const loadInterleaveState = (userId?: string): InterleaveState => {
    if (typeof window === 'undefined') return getDefaultInterleaveState()

    try {
        const saved = localStorage.getItem(getInterleaveStorageKey(userId))
        if (!saved) {
            return getDefaultInterleaveState()
        }

        const parsed = JSON.parse(saved)
        if (!parsed || typeof parsed !== 'object') return getDefaultInterleaveState()

        return {
            currentCategoryId: typeof parsed.currentCategoryId === 'string' ? parsed.currentCategoryId : null,
            remainingInBlock: Number.isFinite(parsed.remainingInBlock) ? Number(parsed.remainingInBlock) : 0,
            retentionByCategory: typeof parsed.retentionByCategory === 'object' && parsed.retentionByCategory !== null
                ? parsed.retentionByCategory
                : {}
        }
    } catch (error) {
        console.error('Error reading interleave state', error)
        return getDefaultInterleaveState()
    }
}


function FreePracticeContent() {
    const { user, loading: authLoading } = useAuth()
    const searchParams = useSearchParams()
    const router = useRouter()

    // Read URL params synchronously to determine initial view state
    // This prevents flash of wrong view during hydration
    const initialKnowledgeCategory = searchParams.get('knowledgeCategory')
    const initialCategory = searchParams.get('category')
    const initialQuestion = searchParams.get('question')
    const initialMixMode = searchParams.get('mix') === '1' || searchParams.get('mix') === 'true'

    const [knowledgeCategories, setKnowledgeCategories] = useState<Category[]>([])
    // Initialize selected states from URL params to prevent flash
    const [selectedKnowledgeCategory, setSelectedKnowledgeCategory] = useState<string | null>(initialKnowledgeCategory)
    const [categories, setCategories] = useState<Category[]>([])
    const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategory)
    const [questions, setQuestions] = useState<Question[]>([])
    const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)

    // Track if we're currently restoring state from URL (to prevent URL update loops)
    const isRestoringFromUrl = useRef(false)
    // Track the last URL we set (to detect browser navigation)
    // Initialize to null so the first restoration always runs
    const lastUrlState = useRef<{ kc: string | null; c: string | null; q: string | null; m: string | null }>({
        kc: null,
        c: null,
        q: null,
        m: null
    })
    // Track if this is the initial URL restoration (needs to fetch data)
    const isInitialUrlRestore = useRef(true)
    // Track if we're transitioning between states (for smooth UX)
    const [isTransitioning, setIsTransitioning] = useState(false)
    // Track if URL state restoration is complete (prevents flash of wrong view)
    const [urlRestored, setUrlRestored] = useState(false)
    // Track URL validation errors
    const [urlError, setUrlError] = useState<{
        type: 'knowledgeCategory' | 'category' | 'question';
        message: string;
        invalidValue: string;
    } | null>(null)

    // Helper function to update URL parameters without full page reload
    const updateUrlParams = useCallback((params: {
        knowledgeCategory?: string | null;
        category?: string | null;
        question?: string | null
    }) => {
        // Don't update URL if we're restoring from URL
        if (isRestoringFromUrl.current) return

        const url = new URL(window.location.href)

        // Handle knowledgeCategory
        if (params.knowledgeCategory !== undefined) {
            if (params.knowledgeCategory) {
                url.searchParams.set('knowledgeCategory', params.knowledgeCategory)
            } else {
                url.searchParams.delete('knowledgeCategory')
            }
        }

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
    const answerInputRef = useRef<HTMLInputElement>(null)
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
    const [showAnswer, setShowAnswer] = useState(false)
    const [explanationMode, setExplanationMode] = useState<boolean>(() => {
        if (typeof window === 'undefined') {
            return false
        }
        return localStorage.getItem('practice_explanation_mode') === 'true'
    })
    const [interleaveMode, setInterleaveMode] = useState<boolean>(() => {
        if (initialMixMode) {
            return true
        }
        if (typeof window === 'undefined') {
            return false
        }
        return localStorage.getItem('practice_interleave_mode') === 'true'
    })
    const [interleaveState, setInterleaveState] = useState<InterleaveState>(() => loadInterleaveState())
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
    const [activeQuestionNavigation, setActiveQuestionNavigation] = useState<'next' | 'random' | null>(null)
    const [questionStates, setQuestionStates] = useState<Record<string, QuestionState>>({})
    const [currentPage, setCurrentPage] = useState(1)
    const [hasMore, setHasMore] = useState(false)
    const loadMoreRef = useRef<HTMLDivElement>(null)
    const [spoilerDate, setSpoilerDate] = useState<Date | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [serverResults, setServerResults] = useState<Category[]>([])
    const [isSearchingServer, setIsSearchingServer] = useState(false)
    const searchTimeoutRef = useRef<NodeJS.Timeout>()
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
    const isInitialCategoryMount = useRef(true)
    const interleaveStateRef = useRef<InterleaveState>(interleaveState)

    // Keep sortByRef and sortDirectionRef in sync
    useEffect(() => {
        sortByRef.current = sortBy
    }, [sortBy])

    useEffect(() => {
        sortDirectionRef.current = sortDirection
    }, [sortDirection])

    useEffect(() => {
        interleaveStateRef.current = interleaveState
    }, [interleaveState])

    const [showBackToTop, setShowBackToTop] = useState(false)

    useEffect(() => {
        localStorage.setItem('practice_explanation_mode', String(explanationMode))
    }, [explanationMode])

    useEffect(() => {
        localStorage.setItem('practice_interleave_mode', String(interleaveMode))
    }, [interleaveMode])

    useEffect(() => {
        if (typeof window === 'undefined') return

        const currentInterleaveState = loadInterleaveState(user?.id)
        setInterleaveState(currentInterleaveState)
    }, [user?.id])

    useEffect(() => {
        if (typeof window === 'undefined') return

        localStorage.setItem(getInterleaveStorageKey(user?.id), JSON.stringify(interleaveState))
    }, [interleaveState, user?.id])

    const updateInterleaveStateFromAnswer = useCallback((categoryId: string, isCorrect: boolean) => {
        setInterleaveState(prev => {
            const current = prev.retentionByCategory[categoryId] ?? {
                attempts: 0,
                correct: 0,
                consecutiveIncorrect: 0,
                lastSeenAt: Date.now()
            }

            const nextAttempts = current.attempts + 1
            const nextCorrect = current.correct + (isCorrect ? 1 : 0)
            const nextConsecutiveIncorrect = isCorrect
                ? 0
                : current.consecutiveIncorrect + 1

            return {
                ...prev,
                currentCategoryId: prev.currentCategoryId,
                remainingInBlock: prev.currentCategoryId === categoryId ? prev.remainingInBlock : prev.remainingInBlock,
                retentionByCategory: {
                    ...prev.retentionByCategory,
                    [categoryId]: {
                        attempts: nextAttempts,
                        correct: nextCorrect,
                        consecutiveIncorrect: nextConsecutiveIncorrect,
                        lastSeenAt: Date.now()
                    }
                }
            }
        })
    }, [])

    const resetInterleaveBlock = useCallback(() => {
        setInterleaveState(prev => ({
            ...prev,
            currentCategoryId: null,
            remainingInBlock: 0
        }))
    }, [])

    const consumeInterleaveBlock = useCallback((categoryId: string, blockSize = INTERLEAVE_BLOCK_SIZE) => {
        setInterleaveState(prev => {
            if (prev.currentCategoryId === categoryId) {
                const nextRemaining = Math.max(prev.remainingInBlock - 1, 0)
                return {
                    ...prev,
                    remainingInBlock: nextRemaining
                }
            }

            return {
                ...prev,
                currentCategoryId: categoryId,
                remainingInBlock: Math.max(blockSize - 1, 0)
            }
        })
    }, [])

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

    // Refetch categories when sort order or direction changes (not on initial mount)
    useEffect(() => {
        if (isInitialCategoryMount.current || !selectedKnowledgeCategory) return

        const refetchWithNewSort = async () => {
            setIsSortTransitioning(true)
            setCurrentPage(1)

            try {
                const result = await getKnowledgeCategoryDetails(
                    selectedKnowledgeCategory,
                    user?.id,
                    1,
                    20,
                    undefined,
                    'FINAL',
                    sortBy,
                    sortDirection
                )
                const transformedCategories = transformApiResponse(result.categories as unknown as RawCategory[])

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
    }, [sortBy, sortDirection, selectedKnowledgeCategory, user?.id])

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
                if (!selectedKnowledgeCategory) return
                setCurrentPage(1)
                setServerResults([])
                try {
                    const result = await getKnowledgeCategoryDetails(selectedKnowledgeCategory, user?.id, 1, 20, undefined, 'FINAL', sortBy, sortDirection)
                    const transformedCategories = transformApiResponse(result.categories as unknown as RawCategory[])
                    setCategories(transformedCategories)
                    setHasMore(result.hasMore)
                    // Mark initial mount as complete so sort changes can trigger refetch
                    isInitialCategoryMount.current = false
                } catch (error) {
                    console.error('Error reloading categories:', error)
                }
            }
            reloadCategories()
        }
    }, [searchQuery, selectedKnowledgeCategory, user?.id, sortBy, sortDirection])

    // Server-side search effect
    useEffect(() => {
        if (!selectedKnowledgeCategory || !searchQuery || searchQuery.length < 2) {
            setServerResults([])
            return
        }

        // Clear previous timeout
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current)
        }

        // Set a timeout for server search
        searchTimeoutRef.current = setTimeout(async () => {
            setIsSearchingServer(true)
            try {
                const result = await getKnowledgeCategoryDetails(
                    selectedKnowledgeCategory,
                    user?.id,
                    1,
                    50,
                    searchQuery,
                    'FINAL',
                    sortBy,
                    sortDirection
                )
                const transformedCategories = transformApiResponse(result.categories as unknown as RawCategory[])
                setServerResults(transformedCategories)
            } catch (error) {
                console.error('Error searching categories:', error)
            } finally {
                setIsSearchingServer(false)
            }
        }, 300)

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedKnowledgeCategory, searchQuery, user?.id, sortBy])

    // Load initial knowledge categories (runs once on mount or when user changes)
    useEffect(() => {
        const loadKnowledgeCategories = async () => {
            try {
                // Get stats which now includes knowledge category stats
                const response = await fetch('/api/stats' + (user?.id ? `?userId=${user.id}` : ''))
                const data = await response.json()

                // Map the knowledge category stats to the expected format
                const knowledgeCategoriesData = data.knowledgeCategoryStats.map((stat: { categoryName: string; total: number; correct: number }) => ({
                    id: stat.categoryName.replace(/ /g, '_'),
                    name: stat.categoryName,
                    totalQuestions: stat.total,
                    correctQuestions: stat.correct,
                    mostRecentAirDate: null
                }))

                setKnowledgeCategories(knowledgeCategoriesData)
            } catch (error) {
                console.error('Error loading knowledge categories:', error)
            } finally {
                setLoading(false)
            }
        }
        loadKnowledgeCategories()
    }, [user?.id])

    // Handle URL state restoration and browser navigation
    // This effect runs when searchParams change (including browser back/forward)
    useEffect(() => {
        const restoreStateFromUrl = async () => {
            const knowledgeCategoryParam = searchParams.get('knowledgeCategory')
            const categoryParam = searchParams.get('category')
            const questionParam = searchParams.get('question')
            const mixParam = searchParams.get('mix')
            let resolvedKnowledgeCategoryParam = knowledgeCategoryParam

            // Check if the URL actually changed (not just a re-render)
            const currentUrlState = { kc: knowledgeCategoryParam, c: categoryParam, q: questionParam, m: mixParam }
            const lastState = lastUrlState.current

            const urlChanged = lastState.kc !== currentUrlState.kc ||
                               lastState.c !== currentUrlState.c ||
                               lastState.q !== currentUrlState.q ||
                               lastState.m !== currentUrlState.m

            // On initial load, we need to fetch data even if URL params are set
            // After that, only run if URL actually changed
            const needsRestore = isInitialUrlRestore.current || urlChanged

            // If URL hasn't changed and not initial load, no need to do anything
            if (!needsRestore && !loading) {
                setUrlRestored(true)
                return
            }

            // Update our tracking ref
            lastUrlState.current = currentUrlState
            isInitialUrlRestore.current = false

            // Set flag to prevent URL update loops during restoration
            isRestoringFromUrl.current = true

            // Clear any previous URL errors when navigating
            setUrlError(null)

            try {
                if (mixParam === '1' || mixParam === 'true') {
                    setInterleaveMode(true)
                }

                // Case 1: Going back to root (no knowledge category or category deep-link)
                if (!knowledgeCategoryParam && !categoryParam) {
                    // Batch state updates to minimize re-renders
                    setSelectedKnowledgeCategory(null)
                    setSelectedCategory(null)
                    setSelectedQuestion(null)
                    setSearchQuery('')
                    resetInterleaveBlock()
                    isRestoringFromUrl.current = false
                    setUrlRestored(true)
                    return
                }

                if (!resolvedKnowledgeCategoryParam && categoryParam) {
                    const categoryContext = await getCategoryStudyContext(categoryParam)

                    if (!categoryContext?.knowledgeCategory) {
                        setUrlError({
                            type: 'category',
                            message: `The category with ID "${categoryParam}" could not be opened because its study context is missing.`,
                            invalidValue: categoryParam
                        })
                        setSelectedCategory(null)
                        setSelectedQuestion(null)
                        resetInterleaveBlock()
                        setIsTransitioning(false)
                        isRestoringFromUrl.current = false
                        setUrlRestored(true)
                        return
                    }

                    resolvedKnowledgeCategoryParam = categoryContext.knowledgeCategory

                    const normalizedUrl = new URL(window.location.href)
                    normalizedUrl.searchParams.set('knowledgeCategory', resolvedKnowledgeCategoryParam)
                    router.replace(normalizedUrl.pathname + normalizedUrl.search, { scroll: false })
                }

                // Validate knowledge category exists
                // Wait for knowledgeCategories to be loaded
                if (knowledgeCategories.length > 0) {
                    const validKnowledgeCategory = knowledgeCategories.find(
                        kc => kc.id === resolvedKnowledgeCategoryParam || kc.name.replace(/ /g, '_').toUpperCase() === resolvedKnowledgeCategoryParam
                    )

                    if (!validKnowledgeCategory) {
                        setUrlError({
                            type: 'knowledgeCategory',
                            message: `The knowledge category "${resolvedKnowledgeCategoryParam}" doesn't exist. It may have been removed or the URL is incorrect.`,
                            invalidValue: resolvedKnowledgeCategoryParam || ''
                        })
                        setSelectedKnowledgeCategory(null)
                        setSelectedCategory(null)
                        setSelectedQuestion(null)
                        resetInterleaveBlock()
                        setIsTransitioning(false)
                        isRestoringFromUrl.current = false
                        setUrlRestored(true)
                        return
                    }
                }

                // Case 2: Knowledge category changed or being restored
                const knowledgeCategoryChanged = selectedKnowledgeCategory !== resolvedKnowledgeCategoryParam
                if (knowledgeCategoryChanged) {
                    // Show transition overlay but DON'T change view state yet
                    setIsTransitioning(true)
                    isInitialCategoryMount.current = false

                    // Load categories FIRST before updating view state (exclude FINAL round)
                    const result = await getKnowledgeCategoryDetails(resolvedKnowledgeCategoryParam!, user?.id, 1, 20, undefined, 'FINAL', sortByRef.current, sortDirectionRef.current)
                    const transformedCategories = transformApiResponse(result.categories as unknown as RawCategory[])

                    // Check if knowledge category returned any results
                    if (transformedCategories.length === 0 && knowledgeCategories.length > 0) {
                        // Double-check if this knowledge category exists
                        const validKnowledgeCategory = knowledgeCategories.find(
                            kc => kc.id === resolvedKnowledgeCategoryParam || kc.name.replace(/ /g, '_').toUpperCase() === resolvedKnowledgeCategoryParam
                        )

                        if (!validKnowledgeCategory) {
                            setUrlError({
                                type: 'knowledgeCategory',
                                message: `The knowledge category "${resolvedKnowledgeCategoryParam}" doesn't exist. It may have been removed or the URL is incorrect.`,
                                invalidValue: resolvedKnowledgeCategoryParam || ''
                            })
                            resetInterleaveBlock()
                            setIsTransitioning(false)
                            isRestoringFromUrl.current = false
                            setUrlRestored(true)
                            return
                        }
                    }

                    // Atomically update ALL state together - prevents flash
                    setSelectedKnowledgeCategory(resolvedKnowledgeCategoryParam)
                    setSelectedCategory(null)
                    setSelectedQuestion(null)
                    setCurrentPage(1)
                    setServerResults([])
                    setSearchQuery('')
                    setCategories(transformedCategories)
                    setHasMore(result.hasMore)
                    setQuestions([])
                    setIsTransitioning(false)
                    resetInterleaveBlock()
                }

                // Case 3: No category - just clear category and question selection
                if (!categoryParam) {
                    setSelectedCategory(null)
                    setSelectedQuestion(null)
                    resetInterleaveBlock()
                    isRestoringFromUrl.current = false
                    setUrlRestored(true)
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
                    resetInterleaveBlock()
                    setIsTransitioning(false)
                    isRestoringFromUrl.current = false
                    setUrlRestored(true)
                    return
                }

                // Case 4: Category changed or being restored
                const categoryChanged = selectedCategory !== categoryParam
                if (categoryChanged || questions.length === 0) {
                    // Show transition overlay but DON'T change view state yet
                    setIsTransitioning(true)

                    // Load questions FIRST before updating view state (exclude FINAL round)
                    const questionsData = await getCategoryQuestions(categoryParam, resolvedKnowledgeCategoryParam || '', user?.id, 'FINAL')
                    const transformedQuestions = transformQuestions(questionsData as unknown as RawQuestion[])

                    // Check if category exists (has questions)
                    if (transformedQuestions.length === 0) {
                        setUrlError({
                            type: 'category',
                            message: `The category with ID "${categoryParam}" was not found or has no questions. It may have been removed or the URL is incorrect.`,
                            invalidValue: categoryParam
                        })
                        setIsTransitioning(false)
                        isRestoringFromUrl.current = false
                        setUrlRestored(true)
                        return
                    }

                    // Atomically update ALL state together - prevents flash
                    setSelectedCategory(categoryParam)
                    setQuestions(transformedQuestions)
                    resetInterleaveBlock()

                    // Case 5: Restore question selection if present
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
                            setUrlRestored(true)
                            return
                        }

                        const question = transformedQuestions.find(q => q.id === questionParam)
                        if (question) {
                            setSelectedQuestion(question)
                            // If question was already answered, restore that state
                            if (question.answered) {
                                if (question.correct) {
                                    // Answered correctly - show the answer
                                    setShowAnswer(true)
                                    setIsCorrect(true)
                                } else {
                                    // Answered incorrectly - show input field but don't show answer yet
                                    setShowAnswer(false)
                                    setIsCorrect(false)
                                }
                                setUserAnswer('') // Clear user answer since we're restoring state
                            } else {
                                // Not answered yet - show input field
                                setUserAnswer('')
                                setIsCorrect(null)
                                setShowAnswer(false)
                            }
                        } else {
                            // Question not found in this category
                            setUrlError({
                                type: 'question',
                                message: `The question with ID "${questionParam}" was not found in this category. It may have been removed or the URL is incorrect.`,
                                invalidValue: questionParam
                            })
                            setSelectedQuestion(null)
                            resetInterleaveBlock()
                        }
                    } else {
                        setSelectedQuestion(null)
                    }
                    setIsTransitioning(false)
                } else if (questionParam !== selectedQuestion?.id) {
                    // Case 6: Only question changed - no loading needed
                    if (questionParam) {
                        // Validate question UUID format
                        if (!uuidRegex.test(questionParam)) {
                            setUrlError({
                                type: 'question',
                                message: `The question ID "${questionParam}" is not a valid format. Please check the URL.`,
                                invalidValue: questionParam
                            })
                            setSelectedQuestion(null)
                            resetInterleaveBlock()
                            isRestoringFromUrl.current = false
                            setUrlRestored(true)
                            return
                        }

                        const question = questions.find(q => q.id === questionParam)
                        if (question) {
                            setSelectedQuestion(question)
                            // If question was already answered, restore that state
                            if (question.answered) {
                                if (question.correct) {
                                    // Answered correctly - show the answer
                                    setShowAnswer(true)
                                    setIsCorrect(true)
                                } else {
                                    // Answered incorrectly - show input field but don't show answer yet
                                    setShowAnswer(false)
                                    setIsCorrect(false)
                                }
                                setUserAnswer('') // Clear user answer since we're restoring state
                            } else {
                                // Not answered yet - show input field
                                setUserAnswer('')
                                setIsCorrect(null)
                                setShowAnswer(false)
                            }
                        } else {
                            // Question not found
                            setUrlError({
                                type: 'question',
                                message: `The question with ID "${questionParam}" was not found in this category. It may have been removed or the URL is incorrect.`,
                                invalidValue: questionParam
                            })
                            setSelectedQuestion(null)
                            resetInterleaveBlock()
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
                // Mark URL restoration as complete
                setUrlRestored(true)
            }
        }

        // Don't try to restore while still loading knowledge categories or auth
        // We need auth to be loaded so we can fetch questions with the correct userId
        if (!loading && !authLoading) {
            restoreStateFromUrl()
        }
    }, [
        searchParams,
        loading,
        authLoading,
        user?.id,
        selectedKnowledgeCategory,
        selectedCategory,
        selectedQuestion?.id,
        questions,
        knowledgeCategories,
        resetInterleaveBlock,
        router
    ])

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
    }, [hasMore, loadingMore, selectedKnowledgeCategory])

    const loadMoreCategories = async () => {
        if (!selectedKnowledgeCategory || loadingMore) return

        setLoadingMore(true)
        try {
            const nextPage = currentPage + 1
            const result = await getKnowledgeCategoryDetails(selectedKnowledgeCategory, user?.id, nextPage, 20, undefined, 'FINAL', sortBy, sortDirection)
            const transformedCategories = transformApiResponse(result.categories as unknown as RawCategory[])
            setCategories(prev => [...prev, ...transformedCategories])
            setCurrentPage(nextPage)
            setHasMore(result.hasMore)
        } catch (error) {
            console.error('Error loading more categories:', error)
        } finally {
            setLoadingMore(false)
        }
    }

    const handleCategorySelect = useCallback(async (categoryId: string, knowledgeCategoryOverride?: string) => {
        if (categoryId === selectedCategory && !knowledgeCategoryOverride) return;
        const knowledgeCat = knowledgeCategoryOverride || selectedKnowledgeCategory;

        // Show transition overlay but DON'T change view state yet
        setIsTransitioning(true);
        setLoadingQuestions(true);
        resetInterleaveBlock()

        // Update URL immediately for browser history
        updateUrlParams({ category: categoryId, question: null });

        try {
            // Load data FIRST before updating view state - keeps current view visible (exclude FINAL round)
            const questionsData = await getCategoryQuestions(categoryId, knowledgeCat!, user?.id, 'FINAL');
            const transformedQuestions = transformQuestions(questionsData as unknown as RawQuestion[]);

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
    }, [selectedCategory, selectedKnowledgeCategory, user?.id, updateUrlParams, resetInterleaveBlock]);

    const handleKnowledgeCategorySelect = useCallback(async (categoryId: string) => {
        if (!categoryId) return;

        // Show transition overlay but DON'T change view state yet
        setIsTransitioning(true);

        // Update URL immediately for browser history
        updateUrlParams({ knowledgeCategory: categoryId, category: null, question: null });
        isInitialCategoryMount.current = false
        resetInterleaveBlock()

        try {
            // Load data FIRST before updating view state - this keeps current view visible (exclude FINAL round)
            const result = await getKnowledgeCategoryDetails(categoryId, user?.id, 1, 20, undefined, 'FINAL', sortBy, sortDirection);
            const transformedCategories = transformApiResponse(result.categories as unknown as RawCategory[]);

            // Atomically update ALL state together in one batch - React batches these
            // This prevents the flash because the view switches only when data is ready
            setSelectedKnowledgeCategory(categoryId);
            setSelectedCategory(null);
            setSelectedQuestion(null);
            setCurrentPage(1);
            setServerResults([]);
            setCategories(transformedCategories);
            setQuestions([]);
            setHasMore(result.hasMore);
        } catch (error) {
            console.error('Error fetching knowledge category details:', error);
        } finally {
            setIsTransitioning(false);
        }
    }, [user?.id, updateUrlParams, sortBy, sortDirection, resetInterleaveBlock]);

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
        resetInterleaveBlock()

        // Clear question from URL
        updateUrlParams({ question: null })

        if (selectedKnowledgeCategory && user?.id) {
            try {
                const result = await getKnowledgeCategoryDetails(selectedKnowledgeCategory, user.id, currentPage, 20, undefined, 'FINAL', sortBy, sortDirection)
                const transformedCategories = transformApiResponse(result.categories as unknown as RawCategory[])
                setCategories(transformedCategories)
                setHasMore(result.hasMore)
            } catch (error) {
                console.error('Error refreshing categories:', error)
            }
        }
    }, [selectedKnowledgeCategory, user?.id, currentPage, updateUrlParams, sortBy, sortDirection, resetInterleaveBlock])

    const resetQuestionInteractionState = useCallback(() => {
        setUserAnswer('')
        setIsCorrect(null)
        setShowAnswer(false)
        setDisputeContext(null)
        setDisputeSubmitted(false)
    }, [])

    const openQuestionView = useCallback((question: Question, options?: {
        categoryId?: string | null
        questions?: Question[]
        knowledgeCategory?: string | null
    }) => {
        const categoryId = options?.categoryId ?? question.categoryId

        if (categoryId) {
            setSelectedCategory(categoryId)
        }
        if (options?.questions) {
            setQuestions(options.questions)
        }

        setSelectedQuestion(question)
        resetQuestionInteractionState()
        updateUrlParams({
            knowledgeCategory: options?.knowledgeCategory,
            category: categoryId,
            question: question.id
        })
    }, [resetQuestionInteractionState, updateUrlParams])

    const loadKnowledgeCategoryPool = useCallback(async () => {
        if (!selectedKnowledgeCategory) return []

        if (categories.length >= 20 && !hasMore) {
            return categories
        }

        const result = await getKnowledgeCategoryDetails(
            selectedKnowledgeCategory,
            user?.id,
            1,
            1000,
            undefined,
            'FINAL',
            sortByRef.current,
            sortDirectionRef.current
        )

        return transformApiResponse(result.categories as unknown as RawCategory[])
    }, [categories, hasMore, selectedKnowledgeCategory, user?.id])

    const loadCategoryQuestionSet = useCallback(async (categoryId: string, knowledgeCategoryId?: string | null) => {
        const questionsData = await getCategoryQuestions(
            categoryId,
            knowledgeCategoryId || selectedKnowledgeCategory || '',
            user?.id,
            'FINAL'
        )

        return transformQuestions(questionsData as unknown as RawQuestion[])
    }, [selectedKnowledgeCategory, user?.id])

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
        const trimmedUserAnswer = userAnswer.trim()

        if (!selectedQuestion?.answer || !trimmedUserAnswer) return
        setUserAnswer(trimmedUserAnswer)

        // Reset dispute state for new answer
        setDisputeContext(null);
        setDisputeSubmitted(false);

        let isAnswerCorrect = false;

        // Use grading API if user is logged in
        if (user?.id && selectedQuestion.id) {
            try {
                const response = await fetch('/api/answers/grade', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        questionId: selectedQuestion.id,
                        userAnswer: trimmedUserAnswer,
                        mode: 'PRACTICE',
                        round: 'SINGLE',
                        categoryId: selectedQuestion.categoryId
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    isAnswerCorrect = data.correct;
                    setDisputeContext(data.disputeContext);
                    // Show achievement unlock notifications
                    if (data.unlockedAchievements && Array.isArray(data.unlockedAchievements)) {
                        const { showAchievementUnlock } = await import('@/app/components/AchievementUnlockToast')
                        data.unlockedAchievements.forEach((achievement: { code: string; name: string; icon: string | null; description: string }) => {
                            showAchievementUnlock(achievement)
                        })
                    }
                } else {
                    // Fallback to local check if API fails
                    isAnswerCorrect = checkAnswer(trimmedUserAnswer, selectedQuestion.answer)
                }
            } catch (error) {
                console.error('Error grading answer:', error);
                // Fallback to local check
                isAnswerCorrect = checkAnswer(trimmedUserAnswer, selectedQuestion.answer)
            }
        } else {
            // Guest user - use local check
            isAnswerCorrect = checkAnswer(trimmedUserAnswer, selectedQuestion.answer)
        }

        setIsCorrect(isAnswerCorrect);
        setShowAnswer(true);
        updateInterleaveStateFromAnswer(selectedQuestion.categoryId, isAnswerCorrect)

        if (user?.id && selectedQuestion.id) {
            await saveAnswer(
                user.id,
                selectedQuestion.id,
                selectedQuestion.categoryId,
                isAnswerCorrect
            );

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
                transformQuestions((prevQuestions.map(q =>
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
                )) as unknown as RawQuestion[])
            );
        }
    };

    const handleShowAnswer = () => {
        if (!selectedQuestion) return;

        if (selectedQuestion.hasIncorrectAttempts || selectedQuestion.correct) {
            setShowAnswer(true)
            return
        }

        updateInterleaveStateFromAnswer(selectedQuestion.categoryId, false)

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
            transformQuestions((prevQuestions.map(q =>
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
            )) as unknown as RawQuestion[])
        );

        setShowAnswer(true);
    };

    const handleDispute = async () => {
        if (!disputeContext || disputeSubmitted || !user?.id) return;

        try {
            const response = await fetch('/api/answers/disputes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...disputeContext,
                    systemWasCorrect: false
                })
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('Failed to submit dispute:', error.error);
                return;
            }

            setDisputeSubmitted(true);
        } catch (error) {
            console.error('Error submitting dispute:', error);
        }
    };

    const handleShuffle = useCallback(async () => {
        setActiveQuestionNavigation('random')

        try {
            const interleaveEnabled = interleaveMode && !!selectedKnowledgeCategory
            let interleaveCategoryId: string | null = null

            if (interleaveEnabled) {
                const currentInterleaveState = interleaveStateRef.current
                const shuffledQuestionPool = await loadKnowledgeCategoryPool()
                const validPool = shuffledQuestionPool.filter(category => category.totalQuestions > 0)

                if (currentInterleaveState.currentCategoryId && currentInterleaveState.remainingInBlock > 0) {
                    interleaveCategoryId = currentInterleaveState.currentCategoryId
                } else {
                    interleaveCategoryId = pickInterleaveCategory(
                        validPool,
                        currentInterleaveState.retentionByCategory,
                        currentInterleaveState.currentCategoryId
                    )
                }

                if (shuffledQuestionPool !== categories) {
                    setCategories(shuffledQuestionPool)
                }

                if (!interleaveCategoryId) {
                    toast.error('No more questions available')
                    return
                }

                const categoryQuestions = await loadCategoryQuestionSet(interleaveCategoryId, selectedKnowledgeCategory)
                const categoryQuestion = getRandomQuestionFromList(categoryQuestions, selectedQuestion?.id)

                if (!categoryQuestion) {
                    toast.error('No more questions available in selected category')
                    return
                }

                consumeInterleaveBlock(interleaveCategoryId)
                openQuestionView(categoryQuestion, {
                    categoryId: interleaveCategoryId,
                    questions: categoryQuestions
                })
                return
            }

            // Determine what level we're shuffling at
            // - No knowledge category selected: shuffle ALL questions
            // - Knowledge category selected but no category: shuffle within knowledge category
            // - Category selected: shuffle within that specific category

            const randomQuestion = await getRandomQuestion(
                selectedKnowledgeCategory || undefined,
                selectedCategory || undefined,
                user?.id,
                selectedQuestion?.id,
                undefined // No round filter - but exclude FINAL via getCategoryQuestions
            );

            if (!randomQuestion) {
                toast.error('No more questions available');
                return;
            }

            // Case 1: Shuffling within a specific category
            if (selectedCategory) {
                const nextQuestions = await loadCategoryQuestionSet(randomQuestion.categoryId, randomQuestion.categoryName);
                const matchingQuestion = nextQuestions.find(question => question.id === randomQuestion.id)

                if (!matchingQuestion) {
                    toast.error('Failed to load random question')
                    return
                }

                openQuestionView(matchingQuestion, {
                    categoryId: randomQuestion.categoryId,
                    questions: nextQuestions
                })
            }
            // Case 3: Shuffling ALL questions (no filters)
            else {
                // Set the knowledge category based on the random question
                const knowledgeCategoryId = randomQuestion.categoryName; // This is actually knowledgeCategory from the API
                setSelectedKnowledgeCategory(knowledgeCategoryId);
                setSelectedCategory(randomQuestion.categoryId);

                // Load the categories for this knowledge category
                const result = await getKnowledgeCategoryDetails(knowledgeCategoryId, user?.id, 1, 20, undefined, 'FINAL', sortBy, sortDirection);
                const transformedCategories = transformApiResponse(result.categories as unknown as RawCategory[]);
                setCategories(transformedCategories);

                // Load questions for the specific category (exclude FINAL round)
                const nextQuestions = await loadCategoryQuestionSet(
                    randomQuestion.categoryId,
                    knowledgeCategoryId
                );
                const matchingQuestion = nextQuestions.find(question => question.id === randomQuestion.id)

                if (!matchingQuestion) {
                    toast.error('Failed to load random question')
                    return
                }

                openQuestionView(matchingQuestion, {
                    knowledgeCategory: knowledgeCategoryId,
                    categoryId: randomQuestion.categoryId,
                    questions: nextQuestions
                });
            }
        } catch (error) {
            console.error('Error shuffling question:', error);
            toast.error('Failed to load random question');
        } finally {
            setActiveQuestionNavigation(null)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        selectedKnowledgeCategory,
        selectedCategory,
        selectedQuestion?.id,
        user?.id,
        updateUrlParams,
        interleaveMode,
        consumeInterleaveBlock,
        categories,
        loadKnowledgeCategoryPool,
        loadCategoryQuestionSet,
        openQuestionView
    ]);

    const handleNextQuestion = useCallback(async () => {
        if (!selectedQuestion) return

        setActiveQuestionNavigation('next')

        try {
            const nextQuestionInCategory = getNextQuestionInSequence(questions, selectedQuestion.id)
            const interleaveEnabled = interleaveMode && !!selectedKnowledgeCategory

            if (nextQuestionInCategory) {
                if (interleaveEnabled) {
                    consumeInterleaveBlock(selectedQuestion.categoryId)
                }

                openQuestionView(nextQuestionInCategory, {
                    categoryId: selectedQuestion.categoryId
                })
                return
            }

            if (!interleaveEnabled || !selectedKnowledgeCategory) {
                toast('You reached the end of this category')
                return
            }

            const categoryPool = await loadKnowledgeCategoryPool()
            const nextCategoryId = getNextCategoryInSequence(categoryPool, selectedQuestion.categoryId)

            if (!nextCategoryId) {
                toast('No next question available')
                return
            }

            const nextCategoryQuestions = await loadCategoryQuestionSet(nextCategoryId, selectedKnowledgeCategory)
            const firstQuestionInNextCategory = sortQuestionsByValue(nextCategoryQuestions)[0]

            if (!firstQuestionInNextCategory) {
                toast.error('No more questions available')
                return
            }

            if (categoryPool !== categories) {
                setCategories(categoryPool)
            }

            consumeInterleaveBlock(nextCategoryId)
            openQuestionView(firstQuestionInNextCategory, {
                categoryId: nextCategoryId,
                questions: nextCategoryQuestions
            })
        } catch (error) {
            console.error('Error loading next question:', error)
            toast.error('Failed to load the next question')
        } finally {
            setActiveQuestionNavigation(null)
        }
    }, [
        categories,
        consumeInterleaveBlock,
        interleaveMode,
        loadCategoryQuestionSet,
        loadKnowledgeCategoryPool,
        openQuestionView,
        questions,
        selectedKnowledgeCategory,
        selectedQuestion
    ])

    const getShuffleButtonText = () => {
        if (!selectedKnowledgeCategory) return 'Shuffle All Questions'

        // If we're at the knowledge category level
        if (!selectedCategory) {
            const category = knowledgeCategories.find(c => c.id === selectedKnowledgeCategory)
            return `Shuffle in ${category?.name || ''}`
        }

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

        return 'Shuffle Questions'
    }

    const interleaveStatus = useMemo(() => {
        if (!interleaveMode || !selectedKnowledgeCategory || selectedCategory) {
            return null
        }

        const activeCategoryName = categories.find(category => category.id === interleaveState.currentCategoryId)?.name
            || knowledgeCategories.find(category => category.id === interleaveState.currentCategoryId)?.name

        if (!interleaveState.currentCategoryId) {
            return 'Mixed picks rotate categories based on what you have seen and missed most recently.'
        }

        if (interleaveState.remainingInBlock > 0) {
            return `${activeCategoryName || 'Current category'} stays in the mix for ${interleaveState.remainingInBlock} more question${interleaveState.remainingInBlock === 1 ? '' : 's'}.`
        }

        return `${activeCategoryName || 'This category'} is finished for now. The next mixed pick will switch categories.`
    }, [categories, interleaveMode, interleaveState.currentCategoryId, interleaveState.remainingInBlock, selectedCategory, selectedKnowledgeCategory, knowledgeCategories])

    const _isQuestionDisabled = (questionId: string) => {
        const state = questionStates[questionId]
        if (!state?.incorrectAttempts?.length) return false

        const lastAttempt = new Date(state.incorrectAttempts[state.incorrectAttempts.length - 1])
        return new Date().getTime() - lastAttempt.getTime() < 30 * 60 * 1000
    }

    // Sort questions by value when displaying
    const sortedQuestions = sortQuestionsByValue(questions)
    const canAdvanceToNextQuestion = Boolean(
        selectedQuestion && (
            getNextQuestionInSequence(questions, selectedQuestion.id) ||
            (interleaveMode && selectedKnowledgeCategory && (hasMore || categories.some(category => category.id !== selectedQuestion.categoryId)))
        )
    )

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
        if (sortBy === 'completion') {
            // Split into in-progress and not-started (server already sorted each group)
            const inProgress = combinedResults.filter(c => Number(c.correctQuestions) > 0);
            const notStarted = combinedResults.filter(c => Number(c.correctQuestions) === 0);

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
            sortedCategories: combinedResults
        };
    }, [combinedResults, sortBy]);

    // Show loading state while:
    // 1. Initial data is loading, OR
    // 2. Auth is loading (needed to fetch user-specific question history), OR
    // 3. URL has params but restoration hasn't completed yet
    const hasUrlParams = initialKnowledgeCategory || initialCategory || initialQuestion
    const isInitializing = loading || authLoading || (hasUrlParams && !urlRestored)

    if (isInitializing) {
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
                            <StudyBackLink href="/practice">
                                Back to Study Modes
                            </StudyBackLink>
                        </div>
                        <div className="mb-6 space-y-3">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                <div className="space-y-1">
                                    <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Study by Category</h1>
                                    <p className="text-sm text-gray-600">
                                        Move in order or jump around without leaving your current study track.
                                    </p>
                                </div>
                                <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center xl:w-auto xl:justify-end">
                                    <StudyActionButton
                                        onClick={handleShuffle}
                                        disabled={loadingQuestions || isTransitioning || !!urlError || activeQuestionNavigation !== null}
                                        className="w-full bg-purple-400 text-white hover:bg-purple-500 sm:w-auto"
                                        icon={(loadingQuestions || activeQuestionNavigation === 'random') ? (
                                            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-solid border-white border-r-transparent" />
                                        ) : (
                                            <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                        )}
                                    >
                                        {getShuffleButtonText()}
                                    </StudyActionButton>
                                    <StudyToggle
                                        label="Mix categories"
                                        checked={interleaveMode}
                                        onChange={(event) => {
                                            const enabled = event.target.checked
                                            setInterleaveMode(enabled)
                                            if (!enabled) {
                                                resetInterleaveBlock()
                                            }
                                        }}
                                        className="w-full justify-between sm:w-auto"
                                    />
                                </div>
                            </div>
                            {interleaveStatus && (
                                <p className="max-w-2xl rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900/80">
                                    {interleaveStatus}
                                </p>
                            )}
                        </div>

                        {/* URL Error Display */}
                        {urlError && (
                            <UrlErrorDisplay
                                error={urlError}
                                onGoBack={() => {
                                    setUrlError(null)
                                    if (urlError.type === 'knowledgeCategory') {
                                        // Go back to root
                                        updateUrlParams({ knowledgeCategory: null, category: null, question: null })
                                    } else if (urlError.type === 'category') {
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
                                    setSelectedKnowledgeCategory(null)
                                    setSelectedCategory(null)
                                    setSelectedQuestion(null)
                                    setCategories([])
                                    setQuestions([])
                                    updateUrlParams({ knowledgeCategory: null, category: null, question: null })
                                }}
                            />
                        )}

                        {/* Knowledge Categories */}
                        {/* Show when: no selected knowledge category OR selected but categories not loaded yet (prevents flash) */}
                        {!urlError && (!selectedKnowledgeCategory || categories.length === 0) && (
                            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 transition-opacity duration-200 ${selectedKnowledgeCategory && categories.length === 0 ? 'opacity-50' : 'opacity-100'}`}>
                                {knowledgeCategories.map(category => (
                                    <CategoryCard
                                        key={category.id}
                                        category={category}
                                        onSelect={handleKnowledgeCategorySelect}
                                        isKnowledgeCategory={true}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Categories with Search and Infinite Scroll */}
                        {/* Show when: knowledge category selected, (no category selected OR category selected but questions not loaded), AND categories are loaded */}
                        {/* Keep visible during transition to Questions to prevent flash */}
                        {!urlError && selectedKnowledgeCategory && (!selectedCategory || (selectedCategory && questions.length === 0)) && categories.length > 0 && (
                            <div className={`transition-opacity duration-200 ${(isTransitioning || (selectedCategory && questions.length === 0)) ? 'opacity-50' : 'opacity-100'}`}>
                                <div className="mb-6 space-y-4">
                                    <div className="flex items-center">
                                        <StudyBackButton
                                            onClick={() => {
                                                // Immediately clear all state - React will batch these updates
                                                setSelectedKnowledgeCategory(null)
                                                setSelectedCategory(null)
                                                setSelectedQuestion(null)
                                                setCategories([])
                                                setQuestions([])
                                                setSearchQuery('')
                                                setServerResults([])
                                                setCurrentPage(1)
                                                // Update URL - this will trigger URL restoration effect which will see null and clear state again (idempotent)
                                                updateUrlParams({ knowledgeCategory: null, category: null, question: null })
                                            }}
                                            disabled={isTransitioning}
                                        >
                                            Back to Knowledge Categories
                                        </StudyBackButton>
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
                                    <StudyBackButton
                                        onClick={() => {
                                            // Atomically clear category and question state
                                            setSelectedCategory(null)
                                            setSelectedQuestion(null)
                                            setQuestions([])
                                            // Clear category and question from URL
                                            updateUrlParams({ category: null, question: null })
                                        }}
                                        disabled={isTransitioning}
                                    >
                                        Back to Categories
                                    </StudyBackButton>
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
                            <div className="mx-auto max-w-4xl practice-question-area">
                                <div className="relative rounded-2xl bg-white p-5 shadow-lg sm:p-6 lg:p-8">
                                    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="space-y-2">
                                            <h2 className="text-xl font-bold text-gray-900">
                                                {selectedQuestion.originalCategory}
                                            </h2>
                                            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
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
                                        <StudyBackButton
                                            onClick={handleBackToQuestions}
                                        >
                                            Back to Questions
                                        </StudyBackButton>
                                    </div>

                                    <div className="mb-8 flex min-h-[180px] items-center justify-center sm:min-h-[220px]">
                                        <p className="text-center text-2xl leading-relaxed text-gray-900 sm:text-3xl">
                                            {selectedQuestion.question}
                                        </p>
                                    </div>

                                    {!showAnswer ? (
                                        <div className="space-y-4">
                                            {selectedQuestion.correct ? (
                                                <div className="flex justify-start">
                                                    <StudyActionButton
                                                        onClick={() => setShowAnswer(true)}
                                                        className="bg-gray-600 text-white hover:bg-gray-700"
                                                        icon={(
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                            </svg>
                                                        )}
                                                    >
                                                        View Answer
                                                    </StudyActionButton>
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
                                                            className="w-full rounded-xl border border-gray-200 px-4 py-4 text-base text-black shadow-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                                                            placeholder="What is..."
                                                            autoComplete="off"
                                                            autoCapitalize="off"
                                                            autoCorrect="off"
                                                            spellCheck="false"
                                                            enterKeyHint="send"
                                                        />
                                                    </div>
                                                    <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4">
                                                        <div className="flex flex-col gap-4">
                                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                                <div className="flex flex-wrap items-center gap-3">
                                                                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={explanationMode}
                                                                            onChange={(event) => setExplanationMode(event.target.checked)}
                                                                        />
                                                                        Explanation mode
                                                                    </label>
                                                                    <button
                                                                        onClick={showPracticeAnswerTipsToast}
                                                                        className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
                                                                        aria-label="Show answer tips"
                                                                    >
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                        </svg>
                                                                        Answer tips
                                                                    </button>
                                                                </div>
                                                                <StudyActionButton
                                                                    onClick={handleShowAnswer}
                                                                    className="w-full bg-gray-600 text-white hover:bg-gray-700 sm:w-auto"
                                                                    icon={(
                                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                        </svg>
                                                                    )}
                                                                >
                                                                    Show Answer
                                                                </StudyActionButton>
                                                            </div>
                                                            <StudyActionButton
                                                                onClick={handleAnswerSubmit}
                                                                className="w-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto"
                                                            >
                                                                Submit
                                                            </StudyActionButton>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className={`rounded-xl p-4 ${isCorrect || selectedQuestion.correct ? 'bg-green-100' : 'bg-red-100'}`}>
                                                <div className="mb-1 flex items-center gap-2">
                                                    {isCorrect || selectedQuestion.correct ? (
                                                        <span className="text-lg text-green-600">✓</span>
                                                    ) : (
                                                        <span className="text-lg text-red-600">✗</span>
                                                    )}
                                                    <span className={`text-sm font-bold ${isCorrect || selectedQuestion.correct ? 'text-green-700' : 'text-red-700'}`}>
                                                        {isCorrect || selectedQuestion.correct ? 'Correct!' : 'Incorrect'}
                                                    </span>
                                                </div>
                                                <p className="text-center font-medium text-gray-900">
                                                    {selectedQuestion.answer}
                                                </p>
                                                {isCorrect === false && disputeContext && user?.id && (
                                                    <div className="mt-3 flex justify-end">
                                                        {disputeSubmitted ? (
                                                            <span className="flex items-center gap-1 text-sm text-gray-500">
                                                                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                                Dispute submitted
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1">
                                                                <button
                                                                    onClick={handleDispute}
                                                                    className="text-sm text-gray-500 underline hover:text-gray-700"
                                                                >
                                                                    Dispute this answer
                                                                </button>
                                                                <span className="group relative">
                                                                    <span className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-gray-400 text-xs text-gray-500 hover:text-gray-700">i</span>
                                                                    <span className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 whitespace-nowrap rounded-lg bg-gray-800 px-3 py-2 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                                                                        An admin will review your answer.<br />If approved, you&apos;ll be retroactively credited.
                                                                    </span>
                                                                </span>
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <AnswerExplanationPanel
                                                userAnswer={userAnswer}
                                                correctAnswer={selectedQuestion.answer}
                                                explanationMode={explanationMode}
                                                visible={isCorrect === false}
                                            />
                                            <div className="grid gap-3 sm:grid-cols-3">
                                                <StudyActionButton
                                                    onClick={handleBackToQuestions}
                                                    className="bg-gray-600 text-white hover:bg-gray-700"
                                                >
                                                    Back to Questions
                                                </StudyActionButton>
                                                <StudyActionButton
                                                    onClick={handleNextQuestion}
                                                    disabled={!canAdvanceToNextQuestion || activeQuestionNavigation !== null}
                                                    className="bg-blue-600 text-white hover:bg-blue-700"
                                                    icon={activeQuestionNavigation === 'next' ? (
                                                        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-solid border-white border-r-transparent" />
                                                    ) : (
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                        </svg>
                                                    )}
                                                >
                                                    Next Question
                                                </StudyActionButton>
                                                <StudyActionButton
                                                    onClick={handleShuffle}
                                                    disabled={activeQuestionNavigation !== null}
                                                    className="bg-purple-400 text-white hover:bg-purple-500"
                                                    icon={activeQuestionNavigation === 'random' ? (
                                                        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-solid border-white border-r-transparent" />
                                                    ) : (
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                        </svg>
                                                    )}
                                                >
                                                    Random Next
                                                </StudyActionButton>
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
