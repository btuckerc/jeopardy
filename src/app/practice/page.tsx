'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '../lib/auth'
import { getCategories, getKnowledgeCategoryDetails, getRandomQuestion, saveAnswer, getCategoryQuestions } from '../actions/practice'
import { checkAnswer } from '../lib/answer-checker'
import { format } from 'date-fns'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
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

type KnowledgeCategory = string;

type ShuffleLevel = 'all' | 'knowledge' | 'category' | null

type QuestionState = {
    incorrectAttempts: Date[]
    correct: boolean
    lastAttemptDate?: Date
}

type CategoryResponse = {
    categories: Category[]
    totalPages: number
    currentPage: number
    hasMore: boolean
}

function LoadingSpinner() {
    return (
        <div className="flex justify-center items-center p-4">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent align-[-0.125em]" />
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
                        {(question.hasIncorrectAttempts || question.isLocked) && (
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

// Add noflash script to prevent FOUC
const noflash = `
    (function() {
        // Maintain the user's color scheme preference
        let isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.add(isDark ? 'dark' : 'light');
        document.documentElement.style.backgroundColor = isDark ? '#1a1a1a' : '#f3f4f6';
    })()
`

// Helper function to ensure timestamps are Date objects
const ensureDate = (timestamp: string | Date | null): Date | null => {
    if (!timestamp) return null;
    return timestamp instanceof Date ? timestamp : new Date(timestamp);
};

// Helper function to transform API response to match our types
const transformApiResponse = (categories: any[]): Category[] => {
    return categories.map(category => ({
        ...category,
        questions: category.questions?.map((q: any) => ({
            id: q.id,
            question: q.question || '',
            answer: q.answer || '',
            value: q.value || 0,
            categoryId: q.categoryId || category.id,
            categoryName: q.categoryName || category.name,
            originalCategory: q.originalCategory || category.name,
            airDate: ensureDate(q.airDate),
            gameHistory: (q.gameHistory || []).map((h: any) => ({
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
const transformQuestions = (questions: any[]): Question[] => {
    return questions.map(q => ({
        id: q.id,
        question: q.question,
        answer: q.answer,
        value: q.value || 0,
        categoryId: q.categoryId,
        categoryName: q.categoryName,
        originalCategory: q.originalCategory || q.category?.name,
        airDate: ensureDate(q.airDate),
        gameHistory: (q.gameHistory || []).map((h: any) => ({
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

export default function FreePractice() {
    const { user } = useAuth()
    const [knowledgeCategories, setKnowledgeCategories] = useState<Category[]>([])
    const [selectedKnowledgeCategory, setSelectedKnowledgeCategory] = useState<string | null>(null)
    const [categories, setCategories] = useState<Category[]>([])
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
    const [questions, setQuestions] = useState<Question[]>([])
    const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
    const [userAnswer, setUserAnswer] = useState('')
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
    const [showAnswer, setShowAnswer] = useState(false)
    const [loading, setLoading] = useState(true)
    const [loadingQuestions, setLoadingQuestions] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)
    const [shuffleLevel, setShuffleLevel] = useState<ShuffleLevel>(null)
    const [questionStates, setQuestionStates] = useState<Record<string, QuestionState>>({})
    const [currentPage, setCurrentPage] = useState(1)
    const [hasMore, setHasMore] = useState(false)
    const loadMoreRef = useRef<HTMLDivElement>(null)
    const supabase = createClientComponentClient()
    const [spoilerDate, setSpoilerDate] = useState<Date | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [serverResults, setServerResults] = useState<Category[]>([])
    const [isSearchingServer, setIsSearchingServer] = useState(false)
    const searchTimeoutRef = useRef<NodeJS.Timeout>()

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
                    const result = await getKnowledgeCategoryDetails(selectedKnowledgeCategory, user?.id, 1)
                    setCategories(result.categories)
                    setHasMore(result.hasMore)
                } catch (error) {
                    console.error('Error reloading categories:', error)
                }
            }
            reloadCategories()
        }
    }, [searchQuery, selectedKnowledgeCategory, user?.id])

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
                    searchQuery
                )
                const transformedCategories = transformApiResponse(result.categories)
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
    }, [selectedKnowledgeCategory, searchQuery, user?.id])

    useEffect(() => {
        const loadKnowledgeCategories = async () => {
            try {
                // Get stats which now includes knowledge category stats
                const response = await fetch('/api/stats' + (user?.id ? `?userId=${user.id}` : ''))
                const data = await response.json()

                // Map the knowledge category stats to the expected format
                const knowledgeCategories = data.knowledgeCategoryStats.map((stat: any) => ({
                    id: stat.categoryName.replace(/ /g, '_'),
                    name: stat.categoryName,
                    totalQuestions: stat.total,
                    correctQuestions: stat.correct,
                    mostRecentAirDate: null
                }))

                setKnowledgeCategories(knowledgeCategories)

                // Get URL parameters
                const params = new URLSearchParams(window.location.search)
                const knowledgeCategoryParam = params.get('knowledgeCategory')
                const categoryParam = params.get('category')

                // If we have a knowledge category, select it
                if (knowledgeCategoryParam) {
                    await handleKnowledgeCategorySelect(knowledgeCategoryParam)

                    // If we also have a category, select it to show questions
                    if (categoryParam) {
                        await handleCategorySelect(categoryParam)
                    }
                }
            } catch (error) {
                console.error('Error loading knowledge categories:', error)
            } finally {
                setLoading(false)
            }
        }
        loadKnowledgeCategories()
    }, [user?.id])

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
    }, [hasMore, loadingMore, selectedKnowledgeCategory])

    const loadMoreCategories = async () => {
        if (!selectedKnowledgeCategory || loadingMore) return

        setLoadingMore(true)
        try {
            const nextPage = currentPage + 1
            const result = await getKnowledgeCategoryDetails(selectedKnowledgeCategory, user?.id, nextPage)
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

    const handleCategorySelect = async (categoryId: string) => {
        if (categoryId === selectedCategory) return;
        setSelectedCategory(categoryId);
        setLoadingQuestions(true);
        setQuestions([]);
        setSelectedQuestion(null);

        try {
            const questions = await getCategoryQuestions(categoryId, selectedKnowledgeCategory!, user?.id);
            setQuestions(transformQuestions(questions));
        } catch (error) {
            console.error('Error loading questions:', error);
        } finally {
            setLoadingQuestions(false);
        }
    };

    const handleKnowledgeCategorySelect = async (categoryId: string) => {
        if (!categoryId) return;
        setSelectedKnowledgeCategory(categoryId);
        setCurrentPage(1);
        setCategories([]);
        setServerResults([]);

        try {
            const result = await getKnowledgeCategoryDetails(categoryId, user?.id, 1);
            const transformedCategories = transformApiResponse(result.categories);
            setCategories(transformedCategories);
            setHasMore(result.hasMore);
        } catch (error) {
            console.error('Error fetching knowledge category details:', error);
        }
    };

    // Load question states from local storage and merge with database state
    useEffect(() => {
        const loadQuestionStates = async () => {
            if (!user) return

            // Load from local storage first
            const storedStates = localStorage.getItem(`questionStates_${user.id}`)
            const localStates = storedStates ? JSON.parse(storedStates) : {}

            // Load from database
            const { data: gameHistory } = await supabase
                .from('game_history')
                .select('*')
                .eq('user_id', user.id)

            // Merge states, preferring database state for correctness
            const mergedStates: Record<string, QuestionState> = {}

            if (gameHistory) {
                gameHistory.forEach((history: any) => {
                    const existingState = localStates[history.question_id] || {}
                    mergedStates[history.question_id] = {
                        incorrectAttempts: existingState.incorrectAttempts || [],
                        correct: history.correct,
                        lastAttemptDate: history.created_at
                    }
                })
            }

            setQuestionStates(mergedStates)
        }

        loadQuestionStates()
    }, [user, supabase])

    // Save states to local storage whenever they change
    useEffect(() => {
        if (user) {
            localStorage.setItem(`questionStates_${user.id}`, JSON.stringify(questionStates))
        }
    }, [questionStates, user])

    const handleBackToQuestions = async () => {
        setSelectedQuestion(null)
        setUserAnswer('')
        setShowAnswer(false)
        setIsCorrect(null)

        if (selectedKnowledgeCategory && user?.id) {
            try {
                const result = await getKnowledgeCategoryDetails(selectedKnowledgeCategory, user.id, currentPage)
                const transformedCategories = transformApiResponse(result.categories)
                setCategories(transformedCategories)
                setHasMore(result.hasMore)
            } catch (error) {
                console.error('Error refreshing categories:', error)
            }
        }
    }

    const handleQuestionSelect = async (question: Question) => {
        if (!question) return;
        setSelectedQuestion(question);
        setUserAnswer('');
        setIsCorrect(null);
        setShowAnswer(false);
    };

    const handleAnswerSubmit = async () => {
        if (!selectedQuestion?.answer || !userAnswer) return;

        const isAnswerCorrect = checkAnswer(userAnswer, selectedQuestion.answer);
        setIsCorrect(isAnswerCorrect);

        if (user?.id && selectedQuestion.id) {
            await saveAnswer(
                user.id,
                selectedQuestion.id,
                selectedQuestion.categoryId,
                isAnswerCorrect
            );

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
                            incorrectAttempts: !isAnswerCorrect
                                ? [new Date(), ...q.incorrectAttempts]
                                : q.incorrectAttempts,
                            isLocked: !isAnswerCorrect && new Date().getTime() - new Date(q.incorrectAttempts[0] || 0).getTime() < 30 * 60 * 1000,
                            hasIncorrectAttempts: !isAnswerCorrect || q.hasIncorrectAttempts
                        }
                        : q
                ))
            );
        }
    };

    const handleShowAnswer = () => {
        if (!selectedQuestion) return;
        setShowAnswer(true);

        // Update questions state to mark the question as locked
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
                        incorrectAttempts: [new Date(), ...q.incorrectAttempts],
                        isLocked: true,
                        hasIncorrectAttempts: true
                    }
                    : q
            ))
        );
    };

    const handleShuffle = async () => {
        if (!selectedKnowledgeCategory && !selectedCategory) {
            setShuffleLevel('all');
            return;
        }

        try {
            const randomQuestion = await getRandomQuestion(
                selectedKnowledgeCategory || undefined,
                selectedCategory || undefined,
                user?.id,
                selectedQuestion?.id
            );

            if (!randomQuestion) {
                toast.error('No more questions available');
                return;
            }

            if (selectedCategory) {
                const questions = await getCategoryQuestions(randomQuestion.categoryId, randomQuestion.categoryName, user?.id);
                setQuestions(transformQuestions(questions));
            } else if (shuffleLevel === 'knowledge' && !selectedCategory) {
                const result = await getKnowledgeCategoryDetails(selectedKnowledgeCategory!, user?.id);
                const transformedCategories = transformApiResponse(result.categories);
                setCategories(transformedCategories);

                const questions = await getCategoryQuestions(randomQuestion.categoryId, selectedKnowledgeCategory!, user?.id);
                setQuestions(transformQuestions(questions));
            }

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
        }
    };

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

    const isQuestionDisabled = (questionId: string) => {
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
    }, [user])

    // Sort categories by most recent air date
    const sortedCategories = useMemo(() => {
        return [...combinedResults].sort((a, b) => {
            const dateA = a.mostRecentAirDate ? new Date(a.mostRecentAirDate) : new Date(0);
            const dateB = b.mostRecentAirDate ? new Date(b.mostRecentAirDate) : new Date(0);
            return dateB.getTime() - dateA.getTime();
        });
    }, [combinedResults]);

    if (loading) {
        return (
            <>
                {/* Prevent FOUC */}
                <script dangerouslySetInnerHTML={{ __html: noflash }} />
                <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                    <div className="text-center">
                        <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent align-[-0.125em] mb-4"></div>
                        <div className="text-gray-600 font-medium">Loading practice mode...</div>
                    </div>
                </div>
            </>
        )
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <script dangerouslySetInnerHTML={{ __html: noflash }} />
            {loading ? (
                <LoadingSpinner />
            ) : (
                <div>
                        <div className="flex justify-between items-center mb-8">
                            <h1 className="text-2xl font-bold text-gray-900">Practice Mode</h1>
                            <button
                                onClick={handleShuffle}
                                disabled={loadingQuestions}
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

                        {/* Knowledge Categories */}
                        {!selectedKnowledgeCategory && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
                        {selectedKnowledgeCategory && !selectedCategory && (
                            <>
                                <div className="mb-6 space-y-4">
                                    <div className="flex items-center">
                                        <button
                                            onClick={() => {
                                                setSelectedKnowledgeCategory(null)
                                                setCategories([])
                                                setSearchQuery('')
                                            }}
                                            className="text-blue-600 hover:text-blue-800 flex items-center font-bold"
                                        >
                                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                            </svg>
                                            Back to Knowledge Categories
                                        </button>
                                    </div>

                                    {/* Search input */}
                                    <div className="relative flex items-center">
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
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {searchQuery.length >= 2 ? (
                                        combinedResults.length > 0 ? (
                                            sortedCategories.map(category => (
                                                <CategoryCard
                                                    key={category.id}
                                                    category={category}
                                                    onSelect={handleCategorySelect}
                                                />
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
                                        sortedCategories.map(category => (
                                            <CategoryCard
                                                key={category.id}
                                                category={category}
                                                onSelect={handleCategorySelect}
                                            />
                                        ))
                                    )}
                                </div>

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
                            </>
                        )}

                        {/* Questions Grid */}
                        {selectedCategory && !selectedQuestion && (
                            <>
                                <div className="mb-6 flex items-center">
                                    <button
                                        onClick={() => {
                                            setSelectedCategory(null)
                                            setQuestions([])
                                        }}
                                        className="text-blue-600 hover:text-blue-800 flex items-center font-bold"
                                    >
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                        Back to Categories
                                    </button>
                                </div>

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
                            </>
                        )}

                        {/* Selected Question */}
                        {selectedQuestion && (
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
                    </div>
            )}
        </div>
    )
} 