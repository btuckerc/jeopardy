'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/auth'
import { getCategories, getKnowledgeCategoryDetails, getRandomQuestion, saveAnswer, getCategoryQuestions } from '../actions/practice'
import { checkAnswer } from '../lib/answer-checker'
import { format } from 'date-fns'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

type Question = {
    id: string
    question: string
    answer: string
    value: number
    categoryId: string
    categoryName: string
    originalCategory: string
    airDate: Date | null
    answered: boolean
    correct: boolean
    incorrectAttempts?: Date[]
}

type Category = {
    id: string
    name: string
    totalQuestions: number
    correctQuestions: number
}

type KnowledgeCategory = {
    id: string
    name: string
    totalQuestions: number
    correctQuestions: number
}

type ShuffleLevel = 'all' | 'knowledge' | 'category' | null

type QuestionState = {
    incorrectAttempts: Date[];
    correct: boolean;
    lastAttemptDate?: Date;
};

type CategoryResponse = {
    categories: Category[];
    totalPages: number;
    currentPage: number;
    hasMore: boolean;
}

function LoadingSpinner() {
    return (
        <div className="flex justify-center items-center p-4">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent align-[-0.125em]" />
        </div>
    )
}

function CategoryCard({ category, onSelect, isKnowledgeCategory = false }: {
    category: Category;
    onSelect: (id: string) => void;
    isKnowledgeCategory?: boolean;
}) {
    const progressPercentage = Math.round((category.correctQuestions / category.totalQuestions) * 100) || 0
    const isComplete = progressPercentage === 100
    const bgColor = isKnowledgeCategory || !isComplete ? 'bg-blue-600' : 'bg-green-600'
    const hoverColor = isKnowledgeCategory || !isComplete ? 'hover:bg-blue-700' : 'hover:bg-green-700'

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
                        {category.correctQuestions.toLocaleString()} / {category.totalQuestions.toLocaleString()} questions
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
    const hasReachedMaxAttempts = (question.incorrectAttempts?.length ?? 0) >= 5
    const mostRecentAttempt = question.incorrectAttempts?.length
        ? new Date(Math.max(...question.incorrectAttempts.map(d => new Date(d).getTime())))
        : null
    const timeSinceLastAttempt = mostRecentAttempt
        ? new Date().getTime() - mostRecentAttempt.getTime()
        : Infinity
    const isLockedOut = !hasReachedMaxAttempts &&
        mostRecentAttempt &&
        timeSinceLastAttempt < 30 * 60 * 1000

    const isSpoiler = spoilerDate && question.airDate && new Date(question.airDate) >= spoilerDate

    const buttonClass = isLockedOut
        ? 'bg-gray-400 cursor-not-allowed opacity-50'
        : isSpoiler
            ? 'bg-yellow-600 hover:bg-yellow-700'
            : question.correct
                ? 'bg-green-600 hover:bg-green-700'
                : question.incorrectAttempts && question.incorrectAttempts.length > 0
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'

    return (
        <div className="space-y-2">
            {isSpoiler && <SpoilerWarning airDate={question.airDate!} />}
            <button
                onClick={onClick}
                disabled={!!isLockedOut}
                className={`p-6 rounded-lg transition-colors ${buttonClass} text-white text-center text-xl font-bold relative w-full h-32 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200`}
            >
                ${question.value}
                {isLockedOut && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
                        <span className="text-sm">
                            {hasReachedMaxAttempts
                                ? 'Max attempts'
                                : `Locked (${Math.ceil((30 * 60 * 1000 - timeSinceLastAttempt) / 60000)}m)`}
                        </span>
                    </div>
                )}
                {!isLockedOut && (question.incorrectAttempts?.length ?? 0) > 0 && (
                    <div className="absolute top-2 right-2 bg-black/50 rounded-full px-2 py-1">
                        <span className="text-xs">
                            {question.incorrectAttempts?.length ?? 0}/5
                        </span>
                    </div>
                )}
            </button>
        </div>
    )
}

export default function FreePractice() {
    const { user } = useAuth()
    const [knowledgeCategories, setKnowledgeCategories] = useState<KnowledgeCategory[]>([])
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
                    correctQuestions: stat.correct
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
        if (!loadMoreRef.current || !hasMore || loadingMore) return;

        const observer = new IntersectionObserver(
            async (entries) => {
                if (entries[0].isIntersecting && hasMore && !loadingMore) {
                    await loadMoreCategories();
                }
            },
            { threshold: 0.1 }
        );

        observer.observe(loadMoreRef.current);
        return () => observer.disconnect();
    }, [hasMore, loadingMore, selectedKnowledgeCategory]);

    const loadMoreCategories = async () => {
        if (!selectedKnowledgeCategory || loadingMore) return;

        setLoadingMore(true);
        try {
            const nextPage = currentPage + 1;
            const result = await getKnowledgeCategoryDetails(selectedKnowledgeCategory, user?.id, nextPage);

            setCategories(prev => [...prev, ...result.categories]);
            setCurrentPage(nextPage);
            setHasMore(result.hasMore);
        } catch (error) {
            console.error('Error loading more categories:', error);
        } finally {
            setLoadingMore(false);
        }
    };

    const handleKnowledgeCategorySelect = async (categoryId: string) => {
        setSelectedKnowledgeCategory(categoryId)
        setSelectedCategory(null)
        setSelectedQuestion(null)
        setLoadingQuestions(true)
        setCurrentPage(1)
        setCategories([])

        try {
            const result = await getKnowledgeCategoryDetails(categoryId, user?.id, 1)
            setCategories(result.categories)
            setHasMore(result.hasMore)
        } catch (error) {
            console.error('Error loading categories:', error)
        } finally {
            setLoadingQuestions(false)
        }
    }

    // Load question states from local storage and merge with database state
    useEffect(() => {
        const loadQuestionStates = async () => {
            if (!user) return;

            // Load from local storage first
            const storedStates = localStorage.getItem(`questionStates_${user.id}`);
            const localStates = storedStates ? JSON.parse(storedStates) : {};

            // Load from database
            const { data: gameHistory } = await supabase
                .from('game_history')
                .select('*')
                .eq('user_id', user.id);

            // Merge states, preferring database state for correctness
            const mergedStates: Record<string, QuestionState> = {};

            if (gameHistory) {
                gameHistory.forEach((history: any) => {
                    const existingState = localStates[history.question_id] || {};
                    mergedStates[history.question_id] = {
                        incorrectAttempts: existingState.incorrectAttempts || [],
                        correct: history.correct,
                        lastAttemptDate: history.created_at
                    };
                });
            }

            setQuestionStates(mergedStates);
        };

        loadQuestionStates();
    }, [user, supabase]);

    // Save states to local storage whenever they change
    useEffect(() => {
        if (user) {
            localStorage.setItem(`questionStates_${user.id}`, JSON.stringify(questionStates));
        }
    }, [questionStates, user]);

    const handleCategorySelect = async (categoryId: string) => {
        if (!selectedKnowledgeCategory) return

        setSelectedCategory(categoryId)
        setSelectedQuestion(null)
        setLoadingQuestions(true)

        try {
            const questions = await getCategoryQuestions(categoryId, selectedKnowledgeCategory, user?.id)
            setQuestions(questions)
        } catch (error) {
            console.error('Error loading questions:', error)
        } finally {
            setLoadingQuestions(false)
        }
    }

    const handleBackToQuestions = async () => {
        setSelectedQuestion(null)
        if (selectedKnowledgeCategory && selectedCategory && user?.id) {
            setLoadingQuestions(true)
            try {
                // Refresh the categories when going back
                const result = await getKnowledgeCategoryDetails(selectedKnowledgeCategory, user.id)
                setCategories(result.categories)

                // Refresh the questions
                const questions = await getCategoryQuestions(selectedCategory, selectedKnowledgeCategory, user.id)
                setQuestions(questions)
            } catch (error) {
                console.error('Error refreshing categories:', error)
            } finally {
                setLoadingQuestions(false)
            }
        }
    }

    const handleQuestionSelect = (question: Question) => {
        // Check if question is locked out
        if (question.incorrectAttempts?.length) {
            const mostRecentAttempt = new Date(Math.max(...question.incorrectAttempts.map(d => new Date(d).getTime())))
            const timeSinceLastAttempt = new Date().getTime() - mostRecentAttempt.getTime()
            const hasReachedMaxAttempts = (question.incorrectAttempts?.length ?? 0) >= 5

            // Allow if either 30 minutes have passed OR they've reached 5 attempts
            if (!hasReachedMaxAttempts && timeSinceLastAttempt < 30 * 60 * 1000) {
                return
            }
        }

        // If the question has been answered correctly before, show the answer immediately
        if (question.correct) {
            setSelectedQuestion(question)
            setUserAnswer('')
            setShowAnswer(true)
            setIsCorrect(true)
            return
        }

        setSelectedQuestion(question)
        setUserAnswer('')
        setShowAnswer(false)
        setIsCorrect(null)
    }

    const handleShuffle = async () => {
        setLoadingQuestions(true)
        try {
            // Set shuffle level based on current view if not already set
            const level = shuffleLevel || (!selectedKnowledgeCategory ? 'all' :
                !selectedCategory ? 'knowledge' : 'category')
            setShuffleLevel(level)

            const randomQuestion = await getRandomQuestion(
                selectedKnowledgeCategory || undefined,
                selectedCategory || undefined,
                user?.id,
                selectedQuestion?.id // Exclude current question
            )

            if (!randomQuestion) {
                console.error('No questions available')
                return
            }

            if (level === 'all') {
                // Get categories for the knowledge category of the random question
                const result = await getKnowledgeCategoryDetails(randomQuestion.categoryName, user?.id)
                setSelectedKnowledgeCategory(randomQuestion.categoryName)
                setCategories(result.categories)
                setSelectedCategory(randomQuestion.categoryId)
                // Get all questions for this category
                const questions = await getCategoryQuestions(randomQuestion.categoryId, randomQuestion.categoryName, user?.id)
                setQuestions(questions)
            } else if (level === 'knowledge' && !selectedCategory) {
                // Get categories if we don't have them
                const result = await getKnowledgeCategoryDetails(selectedKnowledgeCategory!, user?.id)
                setCategories(result.categories)
                setSelectedCategory(randomQuestion.categoryId)
                // Get all questions for this category
                const questions = await getCategoryQuestions(randomQuestion.categoryId, selectedKnowledgeCategory!, user?.id)
                setQuestions(questions)
            }

            setSelectedQuestion(randomQuestion)
            setUserAnswer('')
            setShowAnswer(false)
            setIsCorrect(null)
        } catch (error) {
            console.error('Error during shuffle:', error)
        } finally {
            setLoadingQuestions(false)
        }
    }

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

    const handleSubmitAnswer = async () => {
        if (!selectedQuestion || !userAnswer.trim() || !selectedCategory) return

        const result = checkAnswer(userAnswer, selectedQuestion.answer)
        setIsCorrect(result)
        setShowAnswer(true)

        if (user?.id) {
            try {
                await saveAnswer(user.id, selectedQuestion.id, selectedCategory, result)

                // Update questions state with new attempt
                setQuestions(prev => prev.map(q =>
                    q.id === selectedQuestion.id
                        ? {
                            ...q,
                            answered: true,
                            correct: result || q.correct,
                            incorrectAttempts: !result
                                ? [...(q.incorrectAttempts || []), new Date()].slice(-5)
                                : q.incorrectAttempts
                        }
                        : q
                ))

                // Update selected question state
                setSelectedQuestion(prev => prev ? {
                    ...prev,
                    answered: true,
                    correct: result || prev.correct,
                    incorrectAttempts: !result
                        ? [...(prev.incorrectAttempts || []), new Date()].slice(-5)
                        : prev.incorrectAttempts
                } : null)

                // Update question states
                setQuestionStates(prev => ({
                    ...prev,
                    [selectedQuestion.id]: {
                        incorrectAttempts: !result
                            ? [...(prev[selectedQuestion.id]?.incorrectAttempts || []), new Date()].slice(-5)
                            : prev[selectedQuestion.id]?.incorrectAttempts || [],
                        correct: result || prev[selectedQuestion.id]?.correct || false,
                        lastAttemptDate: new Date()
                    }
                }));

                // Refresh categories to update statistics
                if (selectedKnowledgeCategory) {
                    const result = await getKnowledgeCategoryDetails(selectedKnowledgeCategory, user.id)
                    setCategories(result.categories)
                }

                // Refresh questions to update their state
                if (selectedCategory && selectedKnowledgeCategory) {
                    const updatedQuestions = await getCategoryQuestions(selectedCategory, selectedKnowledgeCategory, user.id)
                    setQuestions(updatedQuestions)
                }
            } catch (error) {
                console.error('Error saving answer:', error);
            }
        }
    }

    const isQuestionDisabled = (questionId: string) => {
        const state = questionStates[questionId];
        if (!state?.incorrectAttempts?.length) return false;

        const lastAttempt = new Date(state.incorrectAttempts[state.incorrectAttempts.length - 1]);
        return new Date().getTime() - lastAttempt.getTime() < 30 * 60 * 1000;
    };

    // Sort questions by value when displaying
    const sortedQuestions = [...questions].sort((a, b) => a.value - b.value)

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

    if (loading) {
        return <div className="text-center p-4">Loading...</div>
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Practice Mode</h1>
                <button
                    onClick={handleShuffle}
                    disabled={loadingQuestions}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-bold text-lg shadow-lg hover:shadow-xl"
                >
                    {loadingQuestions ? <LoadingSpinner /> : getShuffleButtonText()}
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

            {/* Categories with Infinite Scroll */}
            {selectedKnowledgeCategory && !selectedCategory && (
                <>
                    <div className="mb-6 flex items-center">
                        <button
                            onClick={() => {
                                setSelectedKnowledgeCategory(null)
                                setCategories([])
                            }}
                            className="text-blue-600 hover:text-blue-800 flex items-center font-bold"
                        >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to Knowledge Categories
                        </button>
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

                    {loadingMore && <LoadingSpinner />}

                    {/* Intersection observer target */}
                    <div ref={loadMoreRef} className="h-20" />
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
                <div className="max-w-2xl mx-auto">
                    <div className="bg-white shadow-lg rounded-lg p-6">
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

                        <p className="text-lg text-gray-900 mb-6">{selectedQuestion.question}</p>

                        {!showAnswer ? (
                            <div className="space-y-4">
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={userAnswer}
                                        onChange={(e) => setUserAnswer(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleSubmitAnswer();
                                            }
                                        }}
                                        className="w-full p-3 border rounded-lg text-black"
                                        placeholder="What is..."
                                        defaultValue="What is..."
                                    />
                                </div>
                                <div className="flex space-x-4">
                                    <button
                                        onClick={handleSubmitAnswer}
                                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold"
                                    >
                                        Submit
                                    </button>
                                    <button
                                        onClick={() => setShowAnswer(true)}
                                        className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-bold"
                                    >
                                        Show Answer
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                    <div className={`p-4 rounded-lg ${isCorrect ? 'bg-green-100' : 'bg-red-100'}`}>
                                        <div className="flex items-center gap-2">
                                            {isCorrect ? (
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
                                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold"
                                    >
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