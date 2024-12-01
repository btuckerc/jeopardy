'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth'
import { getCategories, getKnowledgeCategoryDetails, getRandomQuestion, saveAnswer, getCategoryQuestions } from '../actions/practice'
import { checkAnswer } from '../lib/answer-checker'
import { format } from 'date-fns'

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
    const [shuffleLevel, setShuffleLevel] = useState<ShuffleLevel>(null)

    useEffect(() => {
        const loadKnowledgeCategories = async () => {
            try {
                const data = await getCategories()
                setKnowledgeCategories(data)
            } catch (error) {
                console.error('Error loading knowledge categories:', error)
            } finally {
                setLoading(false)
            }
        }
        loadKnowledgeCategories()
    }, [])

    const handleKnowledgeCategorySelect = async (categoryId: string) => {
        setSelectedKnowledgeCategory(categoryId)
        setSelectedCategory(null)
        setSelectedQuestion(null)
        setLoadingQuestions(true)

        try {
            const categories = await getKnowledgeCategoryDetails(categoryId, user?.id)
            setCategories(categories)
        } catch (error) {
            console.error('Error loading categories:', error)
        } finally {
            setLoadingQuestions(false)
        }
    }

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
        if (selectedKnowledgeCategory && selectedCategory) {
            setLoadingQuestions(true)
            try {
                // Refresh the categories when going back
                const categories = await getKnowledgeCategoryDetails(selectedKnowledgeCategory, user?.id)
                setCategories(categories)
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
            // Set shuffle level based on current view
            const level = !selectedKnowledgeCategory ? 'all' :
                !selectedCategory ? 'knowledge' : 'category'
            setShuffleLevel(level)

            const randomQuestion = await getRandomQuestion(
                selectedKnowledgeCategory || undefined,
                selectedCategory || undefined,
                user?.id
            )

            if (!randomQuestion) {
                console.error('No questions available')
                return
            }

            if (level === 'all') {
                // Get categories for the knowledge category of the random question
                const categories = await getKnowledgeCategoryDetails(randomQuestion.categoryName, user?.id)
                setSelectedKnowledgeCategory(randomQuestion.categoryName)
                setCategories(categories)
                setSelectedCategory(randomQuestion.categoryId)
                // Get all questions for this category
                const questions = await getCategoryQuestions(randomQuestion.categoryId, randomQuestion.categoryName, user?.id)
                setQuestions(questions)
            } else if (level === 'knowledge' && !selectedCategory) {
                // Get categories if we don't have them
                const categories = await getKnowledgeCategoryDetails(selectedKnowledgeCategory!, user?.id)
                setCategories(categories)
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
        if (!selectedCategory) {
            const category = knowledgeCategories.find(c => c.id === selectedKnowledgeCategory)
            return `Shuffle in ${category?.name || ''}`
        }
        const category = categories.find(c => c.id === selectedCategory)
        return `Shuffle in ${category?.name || ''}`
    }

    const handleSubmitAnswer = async () => {
        if (!selectedQuestion || !userAnswer.trim() || !selectedCategory) return

        const result = checkAnswer(userAnswer, selectedQuestion.answer)
        setIsCorrect(result)
        setShowAnswer(true)

        if (user?.id) {
            await saveAnswer(user.id, selectedQuestion.id, selectedCategory, result)

            // Update questions state with new attempt
            setQuestions(prev => prev.map(q =>
                q.id === selectedQuestion.id
                    ? {
                        ...q,
                        answered: true,
                        correct: result || q.correct, // Keep correct if it was correct before
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
                correct: result || prev.correct, // Keep correct if it was correct before
                incorrectAttempts: !result
                    ? [...(prev.incorrectAttempts || []), new Date()].slice(-5)
                    : prev.incorrectAttempts
            } : null)
        }
    }

    if (loading) {
        return <div className="text-center p-4">Loading...</div>
    }

    return (
        <div className="container mx-auto p-4">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold text-black">Free Play Mode</h1>
                <button
                    onClick={handleShuffle}
                    disabled={loadingQuestions}
                    className="p-2 text-purple-600 hover:text-purple-800 transition-colors flex items-center gap-2 disabled:opacity-50"
                    title="Shuffle Random Question"
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
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                        />
                    </svg>
                    <span className="text-sm font-medium">
                        {getShuffleButtonText()}
                    </span>
                </button>
            </div>

            {!selectedKnowledgeCategory ? (
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-black">Select a Knowledge Category</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {knowledgeCategories.map((category) => (
                            <button
                                key={category.id}
                                onClick={() => handleKnowledgeCategorySelect(category.id)}
                                className="p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <div className="text-lg mb-2">{category.name}</div>
                                <div className="text-sm opacity-80">
                                    {category.correctQuestions}/{category.totalQuestions} questions correct
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            ) : !selectedCategory ? (
                <div className="space-y-4">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold text-black">
                                {knowledgeCategories.find(c => c.id === selectedKnowledgeCategory)?.name}
                            </h2>
                            <button
                                onClick={() => {
                                    setSelectedKnowledgeCategory(null)
                                    setCategories([])
                                }}
                                className="text-blue-600 hover:text-blue-800"
                            >
                                ← Back to Knowledge Categories
                            </button>
                        </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {categories.map((category) => (
                            <button
                                key={category.id}
                                onClick={() => handleCategorySelect(category.id)}
                                className="p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <div className="text-lg mb-2">{category.name}</div>
                                <div className="text-sm opacity-80">
                                    {category.correctQuestions}/{category.totalQuestions} questions correct
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            ) : !selectedQuestion ? (
                <div className="space-y-4">
                    <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-black">
                                        {categories.find(c => c.id === selectedCategory)?.name}
                                    </h2>
                                    <p className="text-sm text-gray-600">
                                        {knowledgeCategories.find(c => c.id === selectedKnowledgeCategory)?.name}
                                    </p>
                                </div>
                        <button
                                    onClick={() => {
                                        setSelectedCategory(null)
                                        setQuestions([])
                                    }}
                            className="text-blue-600 hover:text-blue-800"
                        >
                            ← Back to Categories
                        </button>
                    </div>

                            {loadingQuestions ? (
                                <div className="text-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                                    <p className="mt-2 text-gray-600">Loading questions...</p>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    {Object.entries(
                                        questions.reduce((acc, q) => {
                                            const date = q.airDate
                                                ? format(new Date(q.airDate), 'MMMM d, yyyy')
                                                : 'No air date'
                                            if (!acc[date]) acc[date] = []
                                            acc[date].push(q)
                                            return acc
                                        }, {} as Record<string, Question[]>)
                                    )
                                        .sort(([dateA], [dateB]) => {
                                            if (dateA === 'No air date') return 1
                                            if (dateB === 'No air date') return -1
                                            return new Date(dateB).getTime() - new Date(dateA).getTime()
                                        })
                                        .map(([date, dateQuestions]) => (
                                            <div key={date} className="space-y-4">
                                                <h3 className="text-xl font-semibold text-black">{date}</h3>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                                    {dateQuestions
                                                        .sort((a, b) => a.value - b.value)
                                                        .map((question) => {
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

                                                            const buttonClass = isLockedOut
                                                                ? 'bg-gray-400 cursor-not-allowed opacity-50'
                                                                : question.correct
                                                                    ? 'bg-green-600 hover:bg-green-700'
                                                                    : question.incorrectAttempts && question.incorrectAttempts.length > 0
                                                                        ? 'bg-red-600 hover:bg-red-700'
                                                                        : 'bg-blue-600 hover:bg-blue-700'

                                                            return (
                                                                <button
                                                                    key={question.id}
                                                                    onClick={() => handleQuestionSelect(question)}
                                                                    className={`p-4 rounded-lg transition-colors ${buttonClass} text-white text-center text-lg font-semibold relative`}
                                                                    disabled={!!isLockedOut}
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
                                                                        <div className="absolute top-0 right-0 p-1">
                                                                            <span className="text-xs">
                                                                                {question.incorrectAttempts?.length ?? 0}/5
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </button>
                                                            )
                                                        })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                            )}
                </div>
            ) : (
                            <div className="max-w-2xl mx-auto space-y-6">
                                <div className="bg-white shadow-lg rounded-lg p-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <div>
                                            <h2 className="text-xl font-semibold text-black">
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
                                            className="text-blue-600 hover:text-blue-800"
                                        >
                                            ← Back to Questions
                                        </button>
                                    </div>
                                    <p className="text-lg text-black mb-6">{selectedQuestion.question}</p>

                                    <div className="space-y-4">
                                        {!showAnswer ? (
                                            <div className="space-y-4">
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
                                                    placeholder="Your answer..."
                                                    disabled={selectedQuestion?.incorrectAttempts?.length &&
                                                        (new Date().getTime() - new Date(selectedQuestion.incorrectAttempts[selectedQuestion.incorrectAttempts.length - 1]).getTime() < 30 * 60 * 1000)}
                                                />
                                    <div className="flex space-x-4">
                                        <button
                                            onClick={handleSubmitAnswer}
                                            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                                        >
                                            Submit
                                        </button>
                                        <button
                                            onClick={() => setShowAnswer(true)}
                                            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                                        >
                                            Show Answer
                                        </button>
                                    </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                    <div className={`p-4 rounded-lg ${isCorrect ? 'bg-green-100' : 'bg-red-100'
                                                }`}>
                                                        <div className="flex items-center gap-2">
                                                            {isCorrect ? (
                                                                <span className="text-green-600 text-xl">✓</span>
                                                            ) : (
                                                                <span className="text-red-600 text-xl">✗</span>
                                                            )}
                                                            <p className="font-medium text-black">
                                                                Correct answer: {selectedQuestion.answer}
                                                            </p>
                                                        </div>
                                                </div>
                                                <div className="flex space-x-4">
                                                    <button
                                                            onClick={handleBackToQuestions}
                                                            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                                                    >
                                                            Back to Questions
                                                    </button>
                                                    <button
                                                            onClick={handleShuffle}
                                                            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
                                                        >
                                                            Next Random Question
                                                        </button>
                                                    </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
            )}
        </div>
    )
} 