'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../lib/auth'
import { checkAnswer } from '../../lib/answer-checker'

interface Question {
    id: string
    question: string
    answer: string
    value: number
    categoryId: string
    isDoubleJeopardy: boolean
    wasTripleStumper?: boolean
}

interface Category {
    id: string
    name: string
    questions: (Question | null)[]
}

// Helper functions defined before the component
const normalizeQuestionValue = (value: number, isDoubleJeopardy: boolean): number => {
    const singleJeopardyMap = new Map([
        [100, 200],
        [200, 200],
        [400, 400],
        [600, 600],
        [1200, 600],
        [1600, 800],
        [2000, 1000]
    ])

    const doubleJeopardyMap = new Map([
        [100, 400],
        [200, 400],
        [400, 800],
        [600, 1200],
        [1200, 1200],
        [1600, 1600],
        [2000, 2000]
    ])

    const map = isDoubleJeopardy ? doubleJeopardyMap : singleJeopardyMap
    return map.get(value) || value
}

const organizeQuestionsByValue = (questions: Question[], isDoubleJeopardy: boolean): (Question | null)[] => {
    const valueSlots = isDoubleJeopardy
        ? [400, 800, 1200, 1600, 2000]
        : [200, 400, 600, 800, 1000]

    const organized: (Question | null)[] = new Array(5).fill(null)
    const remainingQuestions: (Question | null)[] = [...questions]
    const usedSlots = new Set<number>()

    // First pass: place questions that match their normalized values exactly
    remainingQuestions.forEach((q, index) => {
        if (!q) return
        const normalizedValue = normalizeQuestionValue(q.value, isDoubleJeopardy)
        const slotIndex = valueSlots.indexOf(normalizedValue)
        if (slotIndex !== -1 && !organized[slotIndex] && !usedSlots.has(normalizedValue)) {
            organized[slotIndex] = q
            remainingQuestions[index] = null
            usedSlots.add(normalizedValue)
        }
    })

    // Second pass: place remaining questions in empty slots
    const emptySlots = organized.map((q, i) => q === null ? i : -1).filter(i => i !== -1)
    const validQuestions = remainingQuestions.filter((q): q is Question => q !== null)

    emptySlots.forEach((slot, i) => {
        if (validQuestions[i]) {
            organized[slot] = validQuestions[i]
        }
    })

    return organized
}

export default function GameBoard() {
    const router = useRouter()
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [categories, setCategories] = useState<Category[]>([])
    const [gameConfig, setGameConfig] = useState<any>(null)
    const [isDoubleJeopardy, setIsDoubleJeopardy] = useState(false)
    const [showRoundComplete, setShowRoundComplete] = useState(false)
    const hasInitialized = useRef(false)
    const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
    const [userAnswer, setUserAnswer] = useState('')
    const [showAnswer, setShowAnswer] = useState(false)
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
    const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(new Set())
    const [score, setScore] = useState(0)

    // Check for round completion
    useEffect(() => {
        if (!loading && categories.length > 0) {
            const allAnswered = categories.every(category =>
                category.questions.every(q => !q || answeredQuestions.has(q.id))
            );
            if (allAnswered && !isDoubleJeopardy) {
                setShowRoundComplete(true);
            }
        }
    }, [categories, answeredQuestions, isDoubleJeopardy, loading]);

    // Load categories
    const loadCategories = useCallback(async (isDouble: boolean, config: any) => {
        if (!config) return

        try {
            const params = new URLSearchParams()
            params.append('isDouble', isDouble.toString())
            params.append('mode', config.mode || 'random')

            if (config.categories) {
                params.append('categories', config.categories.join(','))
            }
            if (config.categoryIds) {
                params.append('categoryIds', config.categoryIds.join(','))
            }
            if (config.date) {
                params.append('date', config.date)
            }

            const response = await fetch(`/api/categories/game?${params.toString()}`)
            if (!response.ok) {
                throw new Error('Failed to load categories')
            }

            const data = await response.json()
            if (!Array.isArray(data) || data.length < 5) {
                throw new Error('Not enough categories available')
            }

            const organizedCategories = data.map(category => ({
                ...category,
                questions: organizeQuestionsByValue(category.questions, isDouble)
            }))

            setCategories(organizedCategories)
            setIsDoubleJeopardy(isDouble)
            setError(null)
        } catch (error) {
            console.error('Error loading categories:', error)
            setError(error instanceof Error ? error.message : 'Failed to load categories')
            setCategories([])
        }
    }, [])

    // Initialize game
    useEffect(() => {
        if (hasInitialized.current) return

        const storedConfig = localStorage.getItem('gameConfig')
        if (!storedConfig) {
            router.push('/game')
            return
        }

        const initGame = async () => {
            setLoading(true)
            try {
                const config = JSON.parse(storedConfig)
                setGameConfig(config)
                await loadCategories(false, config)
                hasInitialized.current = true
            } catch (error) {
                console.error('Error initializing game:', error)
                setError('Invalid game configuration')
            } finally {
                setLoading(false)
            }
        }

        initGame()

        return () => {
            hasInitialized.current = false
        }
    }, [router, loadCategories])

    // Handle round completion
    const handleRoundComplete = useCallback(async () => {
        if (!isDoubleJeopardy && gameConfig) {
            setLoading(true);
            let retryCount = 0;
            const maxRetries = 3;

            while (retryCount < maxRetries) {
                try {
                    setCategories([]);
                    setAnsweredQuestions(new Set());
                    // Use the same config but set isDouble to true
                    const doubleConfig = {
                        ...gameConfig,
                        mode: gameConfig.mode || 'random' // Ensure mode is set
                    };
                    await loadCategories(true, doubleConfig);
                    setLoading(false);
                    return;
                } catch (error) {
                    console.error(`Error loading Double Jeopardy (attempt ${retryCount + 1}):`, error);
                    retryCount++;

                    if (retryCount === maxRetries) {
                        setError('Failed to load Double Jeopardy categories. Please try refreshing the page.');
                        setLoading(false);
                        return;
                    }

                    // Wait before retrying
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        } else {
            router.push('/game');
        }
    }, [isDoubleJeopardy, gameConfig, loadCategories, router]);

    if (loading) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent align-[-0.125em] mb-4"></div>
                    <div className="text-gray-600 font-medium">Loading game board...</div>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center">
                <div className="text-center">
                    <div className="text-red-600 mb-4">{error}</div>
                    <button
                        onClick={() => router.push('/game')}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                    >
                        Back to Game Setup
                    </button>
                </div>
            </div>
        )
    }

    // Function to get the display value for a question
    const getDisplayValue = (question: Question, slotIndex: number) => {
        const valueSlots = isDoubleJeopardy
            ? [400, 800, 1200, 1600, 2000]
            : [200, 400, 600, 800, 1000]

        // If it's a daily double or has a non-standard value, use the slot's value
        const normalValue = normalizeQuestionValue(question.value, isDoubleJeopardy)
        const questionsInCategory = categories
            .find(c => c.id === question.categoryId)
            ?.questions || []

        const hasValueConflict = questionsInCategory.some((q, i) =>
            q && q.id !== question.id && normalizeQuestionValue(q.value, isDoubleJeopardy) === normalValue
        )

        if (hasValueConflict || normalValue !== valueSlots[slotIndex]) {
            return valueSlots[slotIndex]
        }

        return normalValue
    }

    // Function to get the actual score value for a question
    const getScoreValue = (question: Question) => {
        return question.value
    }

    const handleQuestionSelect = (question: Question) => {
        if (!question || answeredQuestions.has(question.id)) {
            // If question has been answered, just show the answer
            setSelectedQuestion(question)
            setShowAnswer(true)
            return
        }
        setSelectedQuestion(question)
        setUserAnswer('')
        setShowAnswer(false)
        setIsCorrect(null)
    }

    const handleSubmitAnswer = async () => {
        if (!selectedQuestion || !userAnswer) return

        const result = checkAnswer(userAnswer, selectedQuestion.answer)
        setIsCorrect(result)
        setShowAnswer(true)

        // Add to answered questions
        setAnsweredQuestions(prev => new Set([...prev, selectedQuestion.id]))

        // Find the correct category and question index for scoring
        const categoryIndex = categories.findIndex(c => c.questions.some(q => q?.id === selectedQuestion.id));
        const questionIndex = categories[categoryIndex]?.questions.findIndex(q => q?.id === selectedQuestion.id) ?? -1;

        // Calculate points earned
        const pointsEarned = result && categoryIndex !== -1 && questionIndex !== -1
            ? getDisplayValue(selectedQuestion, questionIndex)
            : 0;

        // Update score if correct
        if (result) {
            setScore(prev => prev + pointsEarned);
        }

        // Save to game history
        if (user) {
            try {
                const response = await fetch('/api/game/history', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        questionId: selectedQuestion.id,
                        isCorrect: result,
                        pointsEarned
                    })
                });

                if (!response.ok) {
                    throw new Error('Failed to save game history');
                }
            } catch (error) {
                console.error('Error saving game history:', error);
            }
        }
    }

    const handleDontKnow = async () => {
        if (!selectedQuestion) return

        setShowAnswer(true)
        setAnsweredQuestions(prev => new Set([...prev, selectedQuestion.id]))

        // Save to game history as incorrect
        if (user) {
            try {
                const response = await fetch('/api/game/history', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        questionId: selectedQuestion.id,
                        isCorrect: false,
                        pointsEarned: 0
                    })
                });

                if (!response.ok) {
                    throw new Error('Failed to save game history');
                }
            } catch (error) {
                console.error('Error saving game history:', error);
            }
        }
    }

    return (
        <div className="container mx-auto p-4">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold text-gray-900">
                        {isDoubleJeopardy ? 'Double Jeopardy' : 'Jeopardy'}
                    </h1>
                    <button
                        onClick={() => router.push('/game')}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold"
                    >
                        Quit Game
                    </button>
                </div>
                <div className="text-xl font-bold text-gray-900">Score: ${score}</div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
                {categories.map((category) => (
                    <div key={category.id} className="space-y-4">
                        <h2 className="text-center font-bold text-lg h-16 flex items-center justify-center text-gray-900 px-2 bg-gray-100 rounded-lg">
                            {category.name}
                        </h2>
                        <div className="space-y-2">
                            {category.questions.map((question, index) => {
                                if (!question) {
                                    return (
                                        <div
                                            key={`empty-${index}`}
                                            className="w-full p-4 bg-gray-300 text-gray-500 rounded-lg text-xl font-bold text-center"
                                        >
                                            --
                                        </div>
                                    )
                                }

                                const isAnswered = answeredQuestions.has(question.id)
                                const displayValue = getDisplayValue(question, index)

                                return (
                                    <button
                                        key={question.id}
                                        onClick={() => handleQuestionSelect(question)}
                                        className={`w-full p-4 rounded-lg text-xl font-bold transition-all duration-200
                                    ${isAnswered
                                                ? 'bg-gray-300 text-gray-600 hover:bg-gray-400'
                                                : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                                    >
                                        ${displayValue}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {selectedQuestion && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-4 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto relative">
                        <button
                            onClick={() => setSelectedQuestion(null)}
                            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl"
                            aria-label="Close"
                        >
                            ×
                        </button>

                        <div className="mb-6">
                            <h3 className="text-xl font-bold mb-2 text-gray-900">
                                ${normalizeQuestionValue(selectedQuestion.value, isDoubleJeopardy)}
                            </h3>
                            <p className="text-lg text-gray-900">{selectedQuestion.question}</p>
                        </div>

                        {!showAnswer && !answeredQuestions.has(selectedQuestion.id) ? (
                            <div className="space-y-4">
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        handleSubmitAnswer();
                                    }}
                                    className="space-y-4"
                                >
                                    <input
                                        type="text"
                                        value={userAnswer}
                                        onChange={(e) => setUserAnswer(e.target.value)}
                                        className="w-full p-3 border rounded-lg text-gray-900"
                                        placeholder="What is..."
                                        autoComplete="off"
                                        autoCapitalize="off"
                                    />
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        <button
                                            type="submit"
                                            className="flex-1 bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700"
                                        >
                                            Submit Answer
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleDontKnow}
                                            className="flex-1 bg-gray-200 text-gray-900 p-3 rounded-lg hover:bg-gray-300"
                                        >
                                            I don't know
                                        </button>
                                    </div>
                                </form>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className={`p-4 rounded-lg ${isCorrect ? 'bg-green-100' : 'bg-red-100'}`}>
                                        <p className="font-bold text-gray-900">
                                            Answer: {selectedQuestion.answer}
                                    </p>
                                        {isCorrect !== null && (
                                            <p className={`font-bold mt-2 ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                                                {isCorrect ? 'Correct!' : 'Incorrect'}
                                            </p>
                                        )}
                                </div>
                                <button
                                    onClick={() => setSelectedQuestion(null)}
                                        className="w-full bg-gray-200 text-gray-900 p-3 rounded-lg hover:bg-gray-300"
                                >
                                        Close
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showRoundComplete && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full text-center">
                        <h2 className="text-2xl font-bold mb-4 text-gray-900">Round Complete!</h2>
                        <p className="text-lg mb-6 text-gray-700">
                            Ready for Double Jeopardy?
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button
                                onClick={async () => {
                                    setShowRoundComplete(false);
                                    setLoading(true);
                                    try {
                                        await handleRoundComplete();
                                    } catch (error) {
                                        console.error('Error starting Double Jeopardy:', error);
                                        setError('Failed to load Double Jeopardy categories. Please try again.');
                                    }
                                    setLoading(false);
                                }}
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-bold"
                            >
                                Yes, Let's Go!
                            </button>
                            <button
                                onClick={() => setShowRoundComplete(false)}
                                className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-300 font-bold"
                            >
                                Not Now
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {error && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full text-center">
                        <h2 className="text-xl font-bold mb-4 text-red-600">Error</h2>
                        <p className="text-gray-700 mb-6">{error}</p>
                        <button
                            onClick={() => setError(null)}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-bold"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
} 