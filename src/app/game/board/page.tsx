'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../lib/auth'
import { checkAnswer } from '../../lib/answer-checker'
import { useMobileKeyboard } from '@/app/hooks/useMobileKeyboard'
import type { Player } from '@/components/Scoreboard'
import type { GameConfig } from '@/types/game'

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
    const [gameConfig, setGameConfig] = useState<GameConfig | null>(null)
    const [currentRound, setCurrentRound] = useState<'SINGLE' | 'DOUBLE'>('SINGLE')
    const [isDoubleJeopardy, setIsDoubleJeopardy] = useState(false) // Legacy support for display
    const [showRoundComplete, setShowRoundComplete] = useState(false)
    const hasInitialized = useRef(false)
    const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
    const [userAnswer, setUserAnswer] = useState('')
    const [showAnswer, setShowAnswer] = useState(false)
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
    const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(new Set())
    const [score, setScore] = useState(0)
    // Final Jeopardy state
    const [showFinalJeopardy, setShowFinalJeopardy] = useState(false)
    const [finalJeopardyQuestion, setFinalJeopardyQuestion] = useState<{
        id: string
        question: string
        answer: string
        category: { id: string; name: string }
    } | null>(null)
    const [finalJeopardyWager, setFinalJeopardyWager] = useState<number>(0)
    const [finalJeopardyActualWager, setFinalJeopardyActualWager] = useState<number>(0) // The wager that was actually placed
    const [finalJeopardyAnswer, setFinalJeopardyAnswer] = useState('')
    const [finalJeopardyShowAnswer, setFinalJeopardyShowAnswer] = useState(false)
    const [finalJeopardyIsCorrect, setFinalJeopardyIsCorrect] = useState<boolean | null>(null)

    // Mobile keyboard handling
    const answerInputRef = useRef<HTMLInputElement>(null)
    const { scrollIntoView } = useMobileKeyboard()

    // Build players array for scoreboard (reserved for future use)
    const _players: Player[] = [
        {
            id: user?.id || 'guest',
            displayName: user?.displayName || 'Player',
            selectedIcon: user?.selectedIcon,
            avatarBackground: user?.avatarBackground,
            score: score,
            isCurrentUser: true,
            isActive: true
        }
    ]

    // Load categories - stable function
    const loadCategories = useCallback(async (round: 'SINGLE' | 'DOUBLE', config: GameConfig) => {
        if (!config) return

        try {
            const params = new URLSearchParams()
            params.append('round', round)
            params.append('isDouble', (round === 'DOUBLE').toString()) // Legacy support
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
                // Try to extract error message from response
                let errorMessage = 'Failed to load categories'
                try {
                    const errorData = await response.json()
                    if (errorData.error) {
                        errorMessage = errorData.error
                    }
                } catch {
                    // If response isn't JSON, use default message
                }
                throw new Error(errorMessage)
            }

            const data = await response.json()
            
            // Accept any non-empty array (allow partial boards)
            if (!Array.isArray(data) || data.length === 0) {
                throw new Error('No categories available')
            }

            const isDouble = round === 'DOUBLE'
            const organizedCategories = data.map(category => ({
                ...category,
                questions: organizeQuestionsByValue(category.questions, isDouble)
            }))

            setCategories(organizedCategories)
            setCurrentRound(round)
            setIsDoubleJeopardy(isDouble)
            setError(null)
        } catch (error) {
            console.error('Error loading categories:', error)
            setError(error instanceof Error ? error.message : 'Failed to load categories')
            setCategories([])
        }
    }, [])

    // Load Final Jeopardy question
    const loadFinalJeopardy = useCallback(async (config: GameConfig) => {
        if (!config) return

        try {
            setLoading(true)
            const params = new URLSearchParams()
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
            if (config.finalCategoryMode) {
                params.append('finalCategoryMode', config.finalCategoryMode)
            }
            if (config.finalCategoryId) {
                params.append('finalCategoryId', config.finalCategoryId)
            }

            const response = await fetch(`/api/game/final?${params.toString()}`)
            if (!response.ok) {
                throw new Error('Failed to load Final Jeopardy')
            }

            const data = await response.json()
            setFinalJeopardyQuestion(data)
            setShowFinalJeopardy(true)
            setFinalJeopardyWager(Math.max(0, Math.min(score, score))) // Default to current score, maxed at score
            setFinalJeopardyAnswer('')
            setFinalJeopardyShowAnswer(false)
            setFinalJeopardyIsCorrect(null)
        } catch (error) {
            console.error('Error loading Final Jeopardy:', error)
            setError(error instanceof Error ? error.message : 'Failed to load Final Jeopardy')
        } finally {
            setLoading(false)
        }
    }, [score])

    // Check for round completion
    useEffect(() => {
        if (!loading && categories.length > 0 && !showFinalJeopardy && gameConfig) {
            const allAnswered = categories.every(category =>
                category.questions.every(q => !q || answeredQuestions.has(q.id))
            );
            if (allAnswered) {
                // Check if we should show Final Jeopardy or next round
                const rounds = gameConfig?.rounds || { single: true, double: true, final: false }
                if (currentRound === 'SINGLE' && rounds.double) {
                    setShowRoundComplete(true)
                } else if (rounds.final) {
                    // Transition to Final Jeopardy
                    loadFinalJeopardy(gameConfig)
                } else {
                    // Game complete
                    setShowRoundComplete(true)
                }
            }
        }
    }, [categories, answeredQuestions, currentRound, loading, showFinalJeopardy, gameConfig, loadFinalJeopardy])

    // Initialize game - runs only once
    useEffect(() => {
        if (hasInitialized.current) return
        hasInitialized.current = true

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
                // Start with SINGLE round (or DOUBLE if rounds config specifies)
                const initialRound = config.rounds?.single !== false ? 'SINGLE' : 'DOUBLE'
                await loadCategories(initialRound, config)
            } catch (error) {
                console.error('Error initializing game:', error)
                setError('Invalid game configuration')
            } finally {
                setLoading(false)
            }
        }

        initGame()
        // No cleanup - we only want to run once
    }, [router, loadCategories])

    // Handle round completion
    const handleRoundComplete = useCallback(async () => {
        if (!gameConfig) {
            router.push('/game')
            return
        }

        // Determine next round based on gameConfig.rounds
        const rounds = gameConfig.rounds || { single: true, double: true, final: false }
        const nextRound = currentRound === 'SINGLE' && rounds.double ? 'DOUBLE' : null

        if (nextRound) {
            setLoading(true)
            let retryCount = 0
            const maxRetries = 3

            while (retryCount < maxRetries) {
                try {
                    setCategories([])
                    setAnsweredQuestions(new Set())
                    await loadCategories(nextRound, gameConfig)
                    setShowRoundComplete(false)
                    setLoading(false)
                    return
                } catch (error) {
                    console.error(`Error loading ${nextRound} Jeopardy (attempt ${retryCount + 1}):`, error)
                    retryCount++

                    if (retryCount === maxRetries) {
                        setError(`Failed to load ${nextRound} Jeopardy categories. Please try refreshing the page.`)
                        setLoading(false)
                        return
                    }

                    // Wait before retrying
                    await new Promise(resolve => setTimeout(resolve, 1000))
                }
            }
        } else if (rounds.final) {
            // Transition to Final Jeopardy
            setShowRoundComplete(false)
            await loadFinalJeopardy(gameConfig)
        } else {
            // No more rounds, go back to game setup
            router.push('/game')
        }
    }, [currentRound, gameConfig, loadCategories, router, loadFinalJeopardy])

    if (loading) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent align-[-0.125em] mb-4"></div>
                    <div className="text-gray-600 font-medium">Loading game board...</div>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center bg-gray-50">
                <div className="card p-8 max-w-md text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Unable to Load Game</h2>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <button
                        onClick={() => router.push('/game')}
                        className="btn-primary"
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

        const hasValueConflict = questionsInCategory.some((q, _i) =>
            q && q.id !== question.id && normalizeQuestionValue(q.value, isDoubleJeopardy) === normalValue
        )

        if (hasValueConflict || normalValue !== valueSlots[slotIndex]) {
            return valueSlots[slotIndex]
        }

        return normalValue
    }

    // Function to get the actual score value for a question (reserved for future use)
    const _getScoreValue = (question: Question) => {
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

    // Final Jeopardy handlers
    const handleFinalJeopardySubmit = async () => {
        if (!finalJeopardyQuestion || !finalJeopardyAnswer) return

        const result = checkAnswer(finalJeopardyAnswer, finalJeopardyQuestion.answer)
        setFinalJeopardyIsCorrect(result)
        setFinalJeopardyShowAnswer(true)

        // Calculate wager - if score is negative, wager is 0
        const currentScore = score
        const effectiveWager = currentScore < 0 ? 0 : Math.max(0, Math.min(finalJeopardyWager, currentScore))
        
        // Store the actual wager for display purposes
        setFinalJeopardyActualWager(effectiveWager)
        
        // Update score based on wager (simple wagering)
        if (result) {
            setScore(prev => prev + effectiveWager)
        } else {
            setScore(prev => prev - effectiveWager)
        }

        // Save to game history with 0 points (don't track wager-derived points)
        if (user) {
            try {
                const response = await fetch('/api/game/history', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        questionId: finalJeopardyQuestion.id,
                        isCorrect: result,
                        pointsEarned: 0 // Don't track Final Jeopardy wager points
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

    const handleFinalJeopardyDontKnow = async () => {
        if (!finalJeopardyQuestion) return

        setFinalJeopardyShowAnswer(true)
        setFinalJeopardyIsCorrect(false)

        // Calculate wager - if score is negative, wager is 0
        const currentScore = score
        const effectiveWager = currentScore < 0 ? 0 : Math.max(0, Math.min(finalJeopardyWager, currentScore))
        
        // Store the actual wager for display purposes
        setFinalJeopardyActualWager(effectiveWager)
        
        // Update score (lose the wager)
        setScore(prev => prev - effectiveWager)

        // Save to game history with 0 points
        if (user) {
            try {
                const response = await fetch('/api/game/history', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        questionId: finalJeopardyQuestion.id,
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

    // Show Final Jeopardy screen if active
    if (showFinalJeopardy && finalJeopardyQuestion) {
        const canWager = score >= 0
        const maxWager = Math.max(0, score)
        const _effectiveWager = canWager ? Math.max(0, Math.min(finalJeopardyWager, maxWager)) : 0

        return (
            <div className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-950 py-4 sm:py-8 px-4">
                {/* Header */}
                <div className="max-w-4xl mx-auto mb-6 sm:mb-8">
                    <div className="flex justify-between items-center">
                        <button
                            onClick={() => router.push('/game')}
                            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            title="Exit game"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <div className="flex items-center gap-3">
                            <span className="text-blue-200 text-sm font-medium">Final Jeopardy</span>
                            <div className={`px-4 py-2 rounded-lg font-bold text-lg ${score >= 0 ? 'bg-amber-400 text-blue-900' : 'bg-red-500 text-white'}`}>
                                {score < 0 ? '-' : ''}${Math.abs(score).toLocaleString()}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Final Jeopardy Card */}
                <div className="max-w-4xl mx-auto">
                    <div className="question-card">
                        <div className="question-category">
                            {finalJeopardyQuestion.category.name}
                        </div>
                        <p className="question-text mb-8">
                            {finalJeopardyQuestion.question}
                        </p>

                        {!finalJeopardyShowAnswer ? (
                            <div className="space-y-6">
                                {/* Wager Section */}
                                <div className="bg-blue-900/50 rounded-xl p-4 sm:p-6">
                                    <label className="block text-lg font-medium text-white mb-3">
                                        Your Wager
                                    </label>
                                    {canWager ? (
                                        <div className="space-y-3">
                                            <input
                                                type="number"
                                                min="0"
                                                max={maxWager}
                                                value={finalJeopardyWager}
                                                onChange={(e) => {
                                                    const value = parseInt(e.target.value) || 0
                                                    setFinalJeopardyWager(Math.max(0, Math.min(value, maxWager)))
                                                }}
                                                className="answer-input text-center text-2xl font-bold"
                                                placeholder="Enter your wager"
                                            />
                                            <p className="text-sm text-blue-200 text-center">
                                                Maximum wager: ${maxWager.toLocaleString()}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="p-4 bg-amber-500/20 border border-amber-500/50 rounded-lg">
                                            <p className="text-amber-200 font-medium text-center">
                                                Your score is negative. You cannot wager points, but you can still answer.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Answer Section */}
                                <div className="space-y-3">
                                    <label className="block text-lg font-medium text-white">
                                        Your Answer
                                    </label>
                                    <input
                                        type="text"
                                        value={finalJeopardyAnswer}
                                        onChange={(e) => setFinalJeopardyAnswer(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && finalJeopardyAnswer) {
                                                handleFinalJeopardySubmit()
                                            }
                                        }}
                                        className="answer-input"
                                        placeholder="What is..."
                                        autoComplete="off"
                                        autoCapitalize="off"
                                        autoFocus
                                    />
                                </div>

                                {/* Actions */}
                                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                                    <button
                                        onClick={handleFinalJeopardySubmit}
                                        disabled={!finalJeopardyAnswer}
                                        className={`flex-1 py-4 rounded-xl font-bold text-lg transition-all ${
                                            !finalJeopardyAnswer
                                                ? 'bg-gray-500 cursor-not-allowed text-gray-300'
                                                : 'btn-gold'
                                        }`}
                                    >
                                        Submit Answer
                                    </button>
                                    <button
                                        onClick={handleFinalJeopardyDontKnow}
                                        className="flex-1 btn-secondary py-4 text-lg"
                                    >
                                        I don&apos;t know
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className={`p-6 rounded-xl ${finalJeopardyIsCorrect ? 'feedback-correct' : 'feedback-incorrect'}`}>
                                    <div className="flex items-center justify-center gap-3 mb-2">
                                        {finalJeopardyIsCorrect ? (
                                            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        ) : (
                                            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        )}
                                        <span className={`text-2xl font-bold ${finalJeopardyIsCorrect ? 'text-green-700' : 'text-red-700'}`}>
                                            {finalJeopardyIsCorrect ? 'Correct!' : 'Incorrect'}
                                        </span>
                                    </div>
                                    <p className="text-xl font-medium text-center">
                                        Answer: {finalJeopardyQuestion.answer}
                                    </p>
                                    {finalJeopardyActualWager > 0 && (
                                        <p className="text-lg text-center mt-2 opacity-80">
                                            {finalJeopardyIsCorrect 
                                                ? `Wager: +$${finalJeopardyActualWager.toLocaleString()}`
                                                : `Wager: -$${finalJeopardyActualWager.toLocaleString()}`
                                            }
                                        </p>
                                    )}
                                </div>
                                
                                {/* Final Score Display */}
                                <div className="text-center py-4">
                                    <p className="text-blue-200 text-lg">Final Score</p>
                                    <p className={`text-5xl font-bold ${score >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                                        {score < 0 ? '-' : ''}${Math.abs(score).toLocaleString()}
                                    </p>
                                </div>

                                <button
                                    onClick={() => router.push('/game')}
                                    className="w-full btn-gold py-4 text-lg"
                                >
                                    Return to Game Setup
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    // Main game board
    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header - Redesigned */}
            <div className="bg-gradient-to-r from-blue-800 to-blue-900 text-white py-3 px-4 shadow-lg">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/game')}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            title="Exit game"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </button>
                        <div className="hidden sm:flex items-center gap-2">
                            <span className="text-blue-200 text-sm">Round</span>
                            <span className="px-3 py-1 bg-blue-700 rounded-full text-sm font-bold">
                                {isDoubleJeopardy ? 'Double' : 'Single'}
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <div className="sm:hidden text-xs text-blue-200">
                            {isDoubleJeopardy ? 'Double' : 'Single'}
                        </div>
                        <div className={`px-4 py-2 rounded-lg font-bold ${score >= 0 ? 'bg-amber-400 text-blue-900' : 'bg-red-500 text-white'}`}>
                            {score < 0 ? '-' : ''}${Math.abs(score).toLocaleString()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Game Board Container */}
            <div className="py-4 sm:py-6 px-2 sm:px-4">
                <div className="max-w-7xl mx-auto">
                    {/* Board wrapper with overflow visible for hover effects */}
                    <div className="game-board overflow-visible">
                        {/* Mobile: Vertical scroll layout */}
                        <div className="block lg:hidden">
                            <div className="space-y-4">
                                {categories.map((category) => (
                                    <div key={category.id} className="bg-blue-800/50 rounded-lg p-3">
                                        <h3 className="text-white text-center font-bold text-sm uppercase tracking-wide mb-3 px-2">
                                            {category.name}
                                        </h3>
                                        <div className="grid grid-cols-5 gap-2">
                                            {category.questions.map((question, index) => {
                                                if (!question) {
                                                    return (
                                                        <div
                                                            key={`empty-${index}`}
                                                            className="aspect-square flex items-center justify-center bg-blue-900/50 rounded text-blue-700 text-xs font-bold"
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
                                                        className={`aspect-square flex items-center justify-center rounded font-bold text-xs sm:text-sm transition-all ${
                                                            isAnswered
                                                                ? 'bg-blue-900/50 text-blue-700'
                                                                : 'bg-blue-600 text-amber-400 hover:bg-blue-500 active:scale-95'
                                                        }`}
                                                    >
                                                        ${displayValue}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Desktop: Traditional grid layout */}
                        <div className="hidden lg:block overflow-visible">
                            <div className="overflow-x-auto scrollbar-hide -mx-2 px-2">
                                <div 
                                    className="grid gap-2 overflow-visible"
                                    style={{ gridTemplateColumns: `repeat(${categories.length}, minmax(120px, 1fr))` }}
                                >
                                {/* Category Headers */}
                                {categories.map((category) => (
                                    <div key={`header-${category.id}`} className="category-header min-h-[70px] flex items-center justify-center p-2">
                                        <span className="line-clamp-2 text-center text-xs lg:text-sm">
                                            {category.name}
                                        </span>
                                    </div>
                                ))}

                                {/* Question Cells - Row by row */}
                                {[0, 1, 2, 3, 4].map((rowIndex) => (
                                    categories.map((category) => {
                                        const question = category.questions[rowIndex]
                                        if (!question) {
                                            return (
                                                <div
                                                    key={`empty-${category.id}-${rowIndex}`}
                                                    className="clue-cell answered opacity-50 min-h-[60px]"
                                                >
                                                    --
                                                </div>
                                            )
                                        }

                                        const isAnswered = answeredQuestions.has(question.id)
                                        const displayValue = getDisplayValue(question, rowIndex)

                                        return (
                                            <button
                                                key={question.id}
                                                onClick={() => handleQuestionSelect(question)}
                                                className={`clue-cell min-h-[60px] text-lg lg:text-2xl ${isAnswered ? 'answered' : ''}`}
                                            >
                                                ${displayValue}
                                            </button>
                                        )
                                    })
                                ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Question Modal */}
            {selectedQuestion && (
                <div className="question-modal-overlay">
                    <div className="question-modal-card relative">
                        {/* Close Button */}
                        <button
                            onClick={() => setSelectedQuestion(null)}
                            className="question-modal-close"
                            aria-label="Close"
                        >
                            ×
                        </button>

                        {/* Scrollable Content Area - Question Display */}
                        <div className="question-modal-scroll-area">
                            {/* Category name */}
                            <div className="question-category">
                                {categories.find(c => c.id === selectedQuestion.categoryId)?.name}
                            </div>

                            {/* Point value */}
                            <div className="question-value">
                                ${normalizeQuestionValue(selectedQuestion.value, isDoubleJeopardy)}
                            </div>

                            {/* Question text */}
                            <p className="question-text">
                                {selectedQuestion.question}
                            </p>
                        </div>

                        {/* Fixed Input Area - Always Visible */}
                        <div className="question-modal-input-area">
                            {!showAnswer && !answeredQuestions.has(selectedQuestion.id) ? (
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault()
                                        handleSubmitAnswer()
                                    }}
                                    className="space-y-3"
                                >
                                    <input
                                        ref={answerInputRef}
                                        type="text"
                                        value={userAnswer}
                                        onChange={(e) => setUserAnswer(e.target.value)}
                                        onFocus={() => scrollIntoView(answerInputRef)}
                                        className="mobile-answer-input"
                                        placeholder="What is..."
                                        autoComplete="off"
                                        autoCapitalize="off"
                                        autoCorrect="off"
                                        spellCheck="false"
                                        enterKeyHint="send"
                                        autoFocus
                                    />
                                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                                        <button
                                            type="submit"
                                            disabled={!userAnswer.trim()}
                                            className="flex-1 btn-gold py-3 text-base sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Submit
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleDontKnow}
                                            className="flex-1 btn-secondary py-3 text-base sm:text-lg"
                                        >
                                            I don&apos;t know
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div className="space-y-3">
                                    <div className={`p-4 sm:p-6 rounded-xl ${isCorrect ? 'feedback-correct' : 'feedback-incorrect'}`}>
                                        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-2">
                                            {isCorrect ? (
                                                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            ) : (
                                                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            )}
                                            <span className={`text-base sm:text-lg font-bold ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                                                {isCorrect ? 'Correct!' : 'Incorrect'}
                                            </span>
                                        </div>
                                        <p className="font-medium text-center text-sm sm:text-base">
                                            {selectedQuestion.answer}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setSelectedQuestion(null)}
                                        className="w-full btn-secondary py-3 text-base sm:text-lg"
                                    >
                                        Continue
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Round Complete Modal */}
            {showRoundComplete && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="card p-8 max-w-md w-full text-center animate-fade-in-slide-down">
                        <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold mb-2 text-gray-900">Round Complete!</h2>
                        <p className="text-gray-600 mb-2">Current Score</p>
                        <p className={`text-4xl font-bold mb-6 ${score >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                            {score < 0 ? '-' : ''}${Math.abs(score).toLocaleString()}
                        </p>
                        <p className="text-lg mb-6 text-gray-700">
                            {gameConfig?.rounds?.double && currentRound === 'SINGLE'
                                ? 'Ready for Double Jeopardy?'
                                : gameConfig?.rounds?.final
                                    ? 'Ready for Final Jeopardy?'
                                    : 'Game Complete!'
                            }
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button
                                onClick={async () => {
                                    setShowRoundComplete(false);
                                    setLoading(true);
                                    try {
                                        await handleRoundComplete();
                                    } catch (error) {
                                        console.error('Error starting next round:', error);
                                        setError('Failed to load next round. Please try again.');
                                    }
                                    setLoading(false);
                                }}
                                className="btn-primary py-3 px-6"
                            >
                                {gameConfig?.rounds?.double && currentRound === 'SINGLE'
                                    ? "Let's Go!"
                                    : gameConfig?.rounds?.final
                                        ? 'Final Jeopardy!'
                                        : 'New Game'
                                }
                            </button>
                            <button
                                onClick={() => router.push('/game')}
                                className="btn-secondary py-3 px-6"
                            >
                                Exit Game
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Error Modal */}
            {error && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                    <div className="card p-6 max-w-md w-full text-center">
                        <div className="w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold mb-2 text-red-600">Error</h2>
                        <p className="text-gray-700 mb-6">{error}</p>
                        <button
                            onClick={() => setError(null)}
                            className="btn-primary"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
