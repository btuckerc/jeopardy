'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../lib/auth'
import { checkAnswer } from '../../lib/answer-checker'
import Scoreboard, { Player } from '@/components/Scoreboard'
import dynamic from 'next/dynamic'

// Dynamically import heavy components
const FinalJeopardyView = dynamic(
    () => import('./components/FinalJeopardyView').catch(() => ({ default: () => null })),
    { ssr: false }
)

const DisputeModal = dynamic(
    () => import('./components/DisputeModal').catch(() => ({ default: () => null })),
    { ssr: false }
)

const CelebrationModal = dynamic(
    () => import('./components/CelebrationModal').catch(() => ({ default: () => null })),
    { ssr: false }
)

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

interface GameConfig {
    mode: 'random' | 'knowledge' | 'custom' | 'date'
    categories?: string[]
    categoryIds?: string[]
    date?: string
    rounds: {
        single: boolean
        double: boolean
        final: boolean
    }
    finalCategoryMode?: string
    finalCategoryId?: string
    finalJeopardyQuestionId?: string // Stored when FJ is loaded, used for resume
    finalJeopardyStage?: 'category' | 'question' | 'result' // Current stage of FJ
    finalJeopardyWager?: number // The wager that was placed
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

interface GameBoardByIdProps {
    initialGameData?: {
        id: string
        seed: string | null
        config: GameConfig
        status: string
        currentRound: 'SINGLE' | 'DOUBLE' | 'FINAL'
        currentScore: number
        questions: Record<string, {
            id: string
            answered: boolean
            correct: boolean | null
            questionId: string
            categoryId: string
            categoryName: string
        }>
    }
}

export default function GameBoardById({ initialGameData }: GameBoardByIdProps = {}) {
    const router = useRouter()
    const params = useParams()
    const gameId = params?.gameId as string
    const { user } = useAuth()
    
    const [loading, setLoading] = useState(!initialGameData)
    const [error, setError] = useState<string | null>(null)
    const [categories, setCategories] = useState<Category[]>([])
    const [gameConfig, setGameConfig] = useState<GameConfig | null>(initialGameData?.config || null)
    const [gameSeed, setGameSeed] = useState<string | null>(initialGameData?.seed || null)
    const [currentRound, setCurrentRound] = useState<'SINGLE' | 'DOUBLE'>(
        initialGameData?.currentRound === 'FINAL' ? 'DOUBLE' : (initialGameData?.currentRound || 'SINGLE')
    )
    const [isDoubleJeopardy, setIsDoubleJeopardy] = useState(
        initialGameData?.currentRound === 'DOUBLE' || initialGameData?.currentRound === 'FINAL'
    )
    const [showRoundComplete, setShowRoundComplete] = useState(false)
    const hasInitialized = useRef(!!initialGameData)
    const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
    const [userAnswer, setUserAnswer] = useState('')
    const [showAnswer, setShowAnswer] = useState(false)
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
    const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(() => {
        // Initialize from server data if available
        const answered = new Set<string>()
        if (initialGameData?.questions) {
            Object.values(initialGameData.questions).forEach((q) => {
                if (q.answered) {
                    answered.add(q.questionId)
                }
            })
        }
        return answered
    })
    const [score, setScore] = useState(initialGameData?.currentScore || 0)
    const [gameStats, setGameStats] = useState({ correct: 0, incorrect: 0 })
    const [showCelebrationModal, setShowCelebrationModal] = useState(false)
    const [disputeContext, setDisputeContext] = useState<{
        questionId: string
        gameId: string | null
        round: string
        userAnswer: string
        mode: string
    } | null>(null)
    const [disputeSubmitted, setDisputeSubmitted] = useState(false)
    const [finalJeopardyDisputeContext, setFinalJeopardyDisputeContext] = useState<{
        questionId: string
        gameId: string | null
        round: string
        userAnswer: string
        mode: string
    } | null>(null)
    const [finalJeopardyDisputeSubmitted, setFinalJeopardyDisputeSubmitted] = useState(false)
    
    // Final Jeopardy state
    // Stage: 'category' (show category + wager), 'question' (show question + answer input), 'result' (show result)
    const [showFinalJeopardy, setShowFinalJeopardy] = useState(false)
    const [finalJeopardyStage, setFinalJeopardyStage] = useState<'category' | 'question' | 'result'>('category')
    const [finalJeopardyQuestion, setFinalJeopardyQuestion] = useState<{
        id: string
        question: string
        answer: string
        category: { id: string; name: string }
    } | null>(null)
    const [finalJeopardyWager, setFinalJeopardyWager] = useState<number>(0)
    const [finalJeopardyActualWager, setFinalJeopardyActualWager] = useState<number>(0) // The wager that was actually placed
    const [finalJeopardyAnswer, setFinalJeopardyAnswer] = useState('')
    const [finalJeopardyIsCorrect, setFinalJeopardyIsCorrect] = useState<boolean | null>(null)

    // Build players array for scoreboard
    const players: Player[] = [
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

    // Save game state to server
    const saveGameState = useCallback(async (action: string, data: any) => {
        if (!gameId) return
        try {
            await fetch(`/api/games/${gameId}/state`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...data })
            })
        } catch (error) {
            console.error('Error saving game state:', error)
        }
    }, [gameId])

    // Load categories - stable function that doesn't change
    const loadCategories = useCallback(async (round: 'SINGLE' | 'DOUBLE', config: GameConfig, seed?: string | null) => {
        if (!config) return

        try {
            const params = new URLSearchParams()
            params.append('round', round)
            params.append('isDouble', (round === 'DOUBLE').toString())
            params.append('mode', config.mode || 'random')

            // Pass gameId so the API uses the game's stored spoiler policy
            if (gameId) {
                params.append('gameId', gameId)
            }

            if (config.categories) {
                params.append('categories', config.categories.join(','))
            }
            if (config.categoryIds) {
                params.append('categoryIds', config.categoryIds.join(','))
            }
            if (config.date) {
                params.append('date', config.date)
            }
            // Pass seed for consistent category ordering
            if (seed) {
                params.append('seed', seed)
            }

            const response = await fetch(`/api/categories/game?${params.toString()}`)
            
            if (!response.ok) {
                let errorMessage = 'Failed to load categories'
                try {
                    const errorData = await response.json()
                    if (errorData.error) {
                        errorMessage = errorData.error
                    }
                } catch {
                    // Use default message
                }
                throw new Error(errorMessage)
            }

            const data = await response.json()
            
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
    }, [gameId])

    // Load Final Jeopardy question
    const loadFinalJeopardy = useCallback(async (config: GameConfig) => {
        if (!config) return

        try {
            setLoading(true)
            const params = new URLSearchParams()
            params.append('mode', config.mode || 'random')
            
            // Pass gameId so the API uses the game's stored spoiler policy
            if (gameId) {
                params.append('gameId', gameId)
            }

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
            setFinalJeopardyStage('category') // Start at category reveal stage
            setFinalJeopardyWager(Math.max(0, score))
            setFinalJeopardyAnswer('')
            setFinalJeopardyIsCorrect(null)
            
            // Update game state with the Final Jeopardy question ID
            await saveGameState('advance_round', { newRound: 'FINAL', finalJeopardyQuestionId: data.id })
        } catch (error) {
            console.error('Error loading Final Jeopardy:', error)
            setError(error instanceof Error ? error.message : 'Failed to load Final Jeopardy')
        } finally {
            setLoading(false)
        }
    }, [score, saveGameState, gameId])

    // Check for round completion
    useEffect(() => {
        if (!loading && categories.length > 0 && !showFinalJeopardy && gameConfig) {
            const allAnswered = categories.every(category =>
                category.questions.every(q => !q || answeredQuestions.has(q.id))
            )
            if (allAnswered) {
                const rounds = gameConfig.rounds || { single: true, double: true, final: false }
                if (currentRound === 'SINGLE' && rounds.double) {
                    setShowRoundComplete(true)
                } else if (rounds.final) {
                    loadFinalJeopardy(gameConfig)
                } else {
                    setShowRoundComplete(true)
                }
            }
        }
    }, [categories, answeredQuestions, currentRound, loading, showFinalJeopardy, gameConfig, loadFinalJeopardy])

    // Initialize game from server - runs only once, or use initial data if provided
    useEffect(() => {
        if (hasInitialized.current || !gameId) return
        
        // If we have initial data from server, use it and load categories
        if (initialGameData) {
            hasInitialized.current = true
            const config = initialGameData.config
            const round = initialGameData.currentRound
            
            if (round === 'FINAL') {
                // Handle Final Jeopardy restoration
                const fjQuestionId = config.finalJeopardyQuestionId
                const fjAnswered = fjQuestionId && initialGameData.questions?.[fjQuestionId]?.answered
                const fjStage = config.finalJeopardyStage || 'category'
                const fjWager = config.finalJeopardyWager || 0
                
                if (fjAnswered && fjQuestionId) {
                    // Load Final Jeopardy result
                    const params = new URLSearchParams()
                    params.append('questionId', fjQuestionId)
                    params.append('mode', config.mode || 'random')
                    params.append('gameId', gameId)
                    if (config.date) params.append('date', config.date)
                    
                    fetch(`/api/game/final?${params.toString()}`)
                        .then(res => res.json())
                        .then(data => {
                            setFinalJeopardyQuestion(data)
                            setShowFinalJeopardy(true)
                            setFinalJeopardyStage('result')
                            setFinalJeopardyIsCorrect(initialGameData.questions[fjQuestionId].correct)
                            setFinalJeopardyActualWager(fjWager)
                            setLoading(false)
                        })
                        .catch(err => {
                            console.error('Error loading Final Jeopardy:', err)
                            setError('Failed to load Final Jeopardy')
                            setLoading(false)
                        })
                } else if (fjQuestionId) {
                    // Load Final Jeopardy in progress
                    const params = new URLSearchParams()
                    params.append('questionId', fjQuestionId)
                    params.append('mode', config.mode || 'random')
                    params.append('gameId', gameId)
                    if (config.date) params.append('date', config.date)
                    
                    fetch(`/api/game/final?${params.toString()}`)
                        .then(res => res.json())
                        .then(data => {
                            setFinalJeopardyQuestion(data)
                            setShowFinalJeopardy(true)
                            setFinalJeopardyStage(fjStage)
                            setFinalJeopardyWager(fjWager || Math.max(0, initialGameData.currentScore || 0))
                            setFinalJeopardyAnswer('')
                            setFinalJeopardyIsCorrect(null)
                            setLoading(false)
                        })
                        .catch(err => {
                            console.error('Error loading Final Jeopardy:', err)
                            setError('Failed to load Final Jeopardy')
                            setLoading(false)
                        })
                } else {
                    setLoading(false)
                    loadFinalJeopardy(config)
                }
            } else {
                // Load categories for current round
                loadCategories(round, config, initialGameData.seed).then(() => setLoading(false))
            }
            return
        }
        
        // Fallback: fetch from API if no initial data (shouldn't happen in production)
        hasInitialized.current = true
        const initGame = async () => {
            setLoading(true)
            try {
                const response = await fetch(`/api/games/${gameId}`)
                if (!response.ok) {
                    if (response.status === 404) {
                        throw new Error('Game not found')
                    }
                    if (response.status === 403) {
                        throw new Error('You do not have access to this game')
                    }
                    throw new Error('Failed to load game')
                }

                const gameData = await response.json()
                const config = gameData.config as GameConfig
                
                if (!config) {
                    throw new Error('Invalid game configuration')
                }

                setGameConfig(config)
                setGameSeed(gameData.seed || null)
                setScore(gameData.currentScore || 0)

                const answered = new Set<string>()
                if (gameData.questions) {
                    Object.values(gameData.questions).forEach((q: any) => {
                        if (q.answered) {
                            answered.add(q.questionId)
                        }
                    })
                }
                setAnsweredQuestions(answered)

                const round = gameData.currentRound as 'SINGLE' | 'DOUBLE' | 'FINAL'
                if (round === 'FINAL') {
                    setCurrentRound('DOUBLE')
                    setIsDoubleJeopardy(true)
                    const fjQuestionId = config.finalJeopardyQuestionId
                    const fjAnswered = fjQuestionId && gameData.questions?.[fjQuestionId]?.answered
                    const fjStage = config.finalJeopardyStage || 'category'
                    const fjWager = config.finalJeopardyWager || 0
                    
                    if (fjAnswered && fjQuestionId) {
                        const fjResult = gameData.questions[fjQuestionId]
                        const params = new URLSearchParams()
                        params.append('questionId', fjQuestionId)
                        params.append('mode', config.mode || 'random')
                        params.append('gameId', gameId)
                        if (config.date) params.append('date', config.date)
                        
                        const response = await fetch(`/api/game/final?${params.toString()}`)
                        if (response.ok) {
                            const data = await response.json()
                            setFinalJeopardyQuestion(data)
                            setShowFinalJeopardy(true)
                            setFinalJeopardyStage('result')
                            setFinalJeopardyIsCorrect(fjResult.correct)
                            setFinalJeopardyActualWager(fjWager)
                        }
                        setLoading(false)
                    } else if (fjQuestionId) {
                        const params = new URLSearchParams()
                        params.append('questionId', fjQuestionId)
                        params.append('mode', config.mode || 'random')
                        params.append('gameId', gameId)
                        if (config.date) params.append('date', config.date)
                        
                        const response = await fetch(`/api/game/final?${params.toString()}`)
                        if (response.ok) {
                            const data = await response.json()
                            setFinalJeopardyQuestion(data)
                            setShowFinalJeopardy(true)
                            setFinalJeopardyStage(fjStage)
                            setFinalJeopardyWager(fjWager || Math.max(0, gameData.currentScore || 0))
                            setFinalJeopardyAnswer('')
                            setFinalJeopardyIsCorrect(null)
                        }
                        setLoading(false)
                    } else {
                        setLoading(false)
                        await loadFinalJeopardy(config)
                    }
                } else {
                    await loadCategories(round, config, gameData.seed)
                    setLoading(false)
                }
            } catch (error) {
                console.error('Error initializing game:', error)
                setError(error instanceof Error ? error.message : 'Failed to load game')
                setLoading(false)
            }
        }

        initGame()
    }, [gameId, initialGameData, loadCategories, loadFinalJeopardy])

    // Handle round completion
    const handleRoundComplete = useCallback(async () => {
        if (!gameConfig) {
            router.push('/game')
            return
        }

        const rounds = gameConfig.rounds || { single: true, double: true, final: false }
        const nextRound = currentRound === 'SINGLE' && rounds.double ? 'DOUBLE' : null

        if (nextRound) {
            setLoading(true)
            try {
                setCategories([])
                setAnsweredQuestions(new Set())
                await loadCategories(nextRound, gameConfig, gameSeed)
                await saveGameState('advance_round', { newRound: nextRound })
                setShowRoundComplete(false)
            } catch (error) {
                console.error(`Error loading ${nextRound} Jeopardy:`, error)
                setError(`Failed to load ${nextRound} Jeopardy categories.`)
            } finally {
                setLoading(false)
            }
        } else if (rounds.final) {
            setShowRoundComplete(false)
            await loadFinalJeopardy(gameConfig)
        } else {
            // Game complete - show celebration modal
            await saveGameState('complete', { finalScore: score })
            setShowCelebrationModal(true)
        }
    }, [currentRound, gameConfig, gameSeed, loadCategories, router, loadFinalJeopardy, saveGameState, score])

    if (loading) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent align-[-0.125em] mb-4"></div>
                    <div className="text-gray-600 font-medium">Loading game...</div>
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

    const handleQuestionSelect = (question: Question) => {
        if (!question || answeredQuestions.has(question.id)) {
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
        if (!selectedQuestion || !userAnswer || !gameId) return

        try {
            const categoryIndex = categories.findIndex(c => c.questions.some(q => q?.id === selectedQuestion.id))
            const questionIndex = categories[categoryIndex]?.questions.findIndex(q => q?.id === selectedQuestion.id) ?? -1

            const pointsEarned = categoryIndex !== -1 && questionIndex !== -1
                ? getDisplayValue(selectedQuestion, questionIndex)
                : 0

            // Use the centralized grading API
            const response = await fetch('/api/answers/grade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    questionId: selectedQuestion.id,
                    mode: 'GAME',
                    round: currentRound,
                    userAnswer: userAnswer.trim(),
                    gameId: gameId,
                    pointsEarned
                })
            })

            if (!response.ok) {
                throw new Error('Failed to grade answer')
            }

            const data = await response.json()
            const result = data.correct
            setIsCorrect(result)
            setShowAnswer(true)
            setDisputeContext(data.disputeContext)
            setDisputeSubmitted(false)

            setAnsweredQuestions(prev => new Set([...prev, selectedQuestion.id]))

            if (result) {
                setScore(prev => prev + pointsEarned)
                setGameStats(prev => ({ ...prev, correct: prev.correct + 1 }))
            } else {
                setGameStats(prev => ({ ...prev, incorrect: prev.incorrect + 1 }))
            }

            // Save to game state (API already persisted, but we update local state)
            await saveGameState('answer', {
                questionId: selectedQuestion.id,
                correct: result,
                pointsEarned
            })
        } catch (error) {
            console.error('Error submitting answer:', error)
            // Fallback to local checking if API fails
            const result = checkAnswer(userAnswer, selectedQuestion.answer)
            setIsCorrect(result)
            setShowAnswer(true)
            setAnsweredQuestions(prev => new Set([...prev, selectedQuestion.id]))

            const categoryIndex = categories.findIndex(c => c.questions.some(q => q?.id === selectedQuestion.id))
            const questionIndex = categories[categoryIndex]?.questions.findIndex(q => q?.id === selectedQuestion.id) ?? -1

            const pointsEarned = result && categoryIndex !== -1 && questionIndex !== -1
                ? getDisplayValue(selectedQuestion, questionIndex)
                : 0

            if (result) {
                setScore(prev => prev + pointsEarned)
            }

            await saveGameState('answer', {
                questionId: selectedQuestion.id,
                correct: result,
                pointsEarned
            })
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

    const handleDontKnow = async () => {
        if (!selectedQuestion) return

        setShowAnswer(true)
        setAnsweredQuestions(prev => new Set([...prev, selectedQuestion.id]))

        await saveGameState('answer', {
            questionId: selectedQuestion.id,
            correct: false,
            pointsEarned: 0
        })
    }

    // Final Jeopardy handlers
    const handleFinalJeopardyWagerSubmit = async () => {
        if (!finalJeopardyQuestion) return
        
        const canWager = score >= 0
        const maxWager = Math.max(0, score)
        const effectiveWager = canWager ? Math.max(0, Math.min(finalJeopardyWager, maxWager)) : 0
        
        // Store the wager and advance to question stage
        setFinalJeopardyActualWager(effectiveWager)
        setFinalJeopardyStage('question')
        
        // Save state to server
        await saveGameState('update_final_jeopardy', { 
            stage: 'question', 
            wager: effectiveWager 
        })
    }

    const handleFinalJeopardySubmit = async () => {
        if (!finalJeopardyQuestion || !finalJeopardyAnswer || !gameId) return

        try {
            // Use the centralized grading API
            const response = await fetch('/api/answers/grade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    questionId: finalJeopardyQuestion.id,
                    mode: 'GAME',
                    round: 'FINAL',
                    userAnswer: finalJeopardyAnswer.trim(),
                    gameId: gameId,
                    pointsEarned: 0 // Final Jeopardy uses wager, not question value
                })
            })

            if (!response.ok) {
                throw new Error('Failed to grade answer')
            }

            const data = await response.json()
            const result = data.correct
            setFinalJeopardyIsCorrect(result)
            setFinalJeopardyStage('result')
            setFinalJeopardyDisputeContext(data.disputeContext)
            setFinalJeopardyDisputeSubmitted(false)

            const effectiveWager = finalJeopardyActualWager
            
            const newScore = result ? score + effectiveWager : score - effectiveWager
            setScore(newScore)

            await saveGameState('answer', {
                questionId: finalJeopardyQuestion.id,
                correct: result,
                pointsEarned: 0
            })
        } catch (error) {
            console.error('Error submitting Final Jeopardy answer:', error)
            // Fallback to local checking
            const result = checkAnswer(finalJeopardyAnswer, finalJeopardyQuestion.answer)
            setFinalJeopardyIsCorrect(result)
            setFinalJeopardyStage('result')

            const effectiveWager = finalJeopardyActualWager
            
            const newScore = result ? score + effectiveWager : score - effectiveWager
            setScore(newScore)

            await saveGameState('answer', {
                questionId: finalJeopardyQuestion.id,
                correct: result,
                pointsEarned: 0
            })
        }
    }

    const handleFinalJeopardyDispute = async () => {
        if (!finalJeopardyDisputeContext || finalJeopardyDisputeSubmitted || !user?.id) return

        try {
            const response = await fetch('/api/answers/disputes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...finalJeopardyDisputeContext,
                    systemWasCorrect: false
                })
            })

            if (!response.ok) {
                const error = await response.json()
                console.error('Failed to submit dispute:', error.error)
                return
            }

            setFinalJeopardyDisputeSubmitted(true)
        } catch (error) {
            console.error('Error submitting dispute:', error)
        }
    }

    const handleFinalJeopardyDontKnow = async () => {
        if (!finalJeopardyQuestion) return

        setFinalJeopardyStage('result')
        setFinalJeopardyIsCorrect(false)

        const effectiveWager = finalJeopardyActualWager
        
        setScore(prev => prev - effectiveWager)
        setGameStats(prev => ({ ...prev, incorrect: prev.incorrect + 1 }))

        await saveGameState('answer', {
            questionId: finalJeopardyQuestion.id,
            correct: false,
            pointsEarned: 0
        })
    }

    const handleGameComplete = async () => {
        await saveGameState('complete', { finalScore: score })
        setShowCelebrationModal(true)
    }

    const handleCelebrationClose = () => {
        setShowCelebrationModal(false)
        router.push('/game')
    }

    const handlePlayAgain = async () => {
        setShowCelebrationModal(false)
        // Create a new quick play game
        try {
            const response = await fetch('/api/games/quick-play', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })
            if (response.ok) {
                const game = await response.json()
                router.push(`/game/${game.id}`)
            } else {
                router.push('/game')
            }
        } catch (error) {
            router.push('/game')
        }
    }

    // Show Final Jeopardy screen if active
    if (showFinalJeopardy && finalJeopardyQuestion) {
        const canWager = score >= 0
        const maxWager = Math.max(0, score)

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

                {/* Stage 1: Category Reveal + Wager */}
                {finalJeopardyStage === 'category' && (
                    <div className="max-w-4xl mx-auto">
                        <div className="bg-blue-800 rounded-2xl shadow-2xl overflow-hidden">
                            {/* Big Category Display */}
                            <div className="bg-gradient-to-b from-blue-700 to-blue-800 py-16 px-8 text-center">
                                <p className="text-blue-300 text-lg mb-4 uppercase tracking-widest">The Category Is</p>
                                <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white uppercase tracking-wide">
                                    {finalJeopardyQuestion.category.name}
                                </h1>
                            </div>

                            {/* Score & Wager Section */}
                            <div className="p-6 sm:p-8 space-y-6">
                                {/* Current Score Display */}
                                <div className="text-center py-4 bg-blue-900/50 rounded-xl">
                                    <p className="text-blue-300 text-sm uppercase tracking-wide mb-1">Your Current Score</p>
                                    <p className={`text-4xl font-bold ${score >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                                        {score < 0 ? '-' : ''}${Math.abs(score).toLocaleString()}
                                    </p>
                                </div>

                                {/* Wager Input */}
                                <div className="space-y-4">
                                    <label className="block text-lg font-medium text-white text-center">
                                        Enter Your Wager
                                    </label>
                                    {canWager ? (
                                        <div className="space-y-3">
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-gray-400">$</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={maxWager}
                                                    value={finalJeopardyWager}
                                                    onChange={(e) => {
                                                        const value = parseInt(e.target.value) || 0
                                                        setFinalJeopardyWager(Math.max(0, Math.min(value, maxWager)))
                                                    }}
                                                    className="w-full bg-white/10 border-2 border-blue-500 rounded-xl py-4 pl-10 pr-4 text-center text-3xl font-bold text-white placeholder-blue-300/50 focus:outline-none focus:border-amber-400 transition-colors"
                                                    placeholder="0"
                                                    autoFocus
                                                />
                                            </div>
                                            <p className="text-sm text-blue-300 text-center">
                                                Maximum wager: ${maxWager.toLocaleString()}
                                            </p>
                                            {/* Quick wager buttons */}
                                            <div className="flex justify-center gap-2 flex-wrap">
                                                {[0.25, 0.5, 0.75, 1].map((fraction) => (
                                                    <button
                                                        key={fraction}
                                                        onClick={() => setFinalJeopardyWager(Math.floor(maxWager * fraction))}
                                                        className="px-3 py-1 text-sm bg-blue-700 hover:bg-blue-600 text-white rounded-full transition-colors"
                                                    >
                                                        {fraction === 1 ? 'All In' : `${fraction * 100}%`}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-4 bg-amber-500/20 border border-amber-500/50 rounded-xl">
                                            <p className="text-amber-200 font-medium text-center">
                                                Your score is negative. You cannot wager points, but you can still answer.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Continue Button */}
                                <button
                                    onClick={handleFinalJeopardyWagerSubmit}
                                    className="w-full btn-gold py-4 text-xl font-bold"
                                >
                                    Lock In Wager & See Question
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Stage 2: Question + Answer */}
                {finalJeopardyStage === 'question' && (
                    <div className="max-w-4xl mx-auto">
                        <div className="question-card">
                            <div className="question-category">
                                {finalJeopardyQuestion.category.name}
                            </div>
                            <p className="question-text mb-8">
                                {finalJeopardyQuestion.question}
                            </p>

                            {/* Wager Display */}
                            <div className="bg-blue-900/50 rounded-xl p-4 mb-6 text-center">
                                <p className="text-blue-300 text-sm">Your Wager</p>
                                <p className="text-2xl font-bold text-amber-400">
                                    ${finalJeopardyActualWager.toLocaleString()}
                                </p>
                            </div>

                            {/* Answer Section */}
                            <div className="space-y-4">
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
                            <div className="flex flex-col sm:flex-row gap-3 pt-6">
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
                    </div>
                )}

                {/* Stage 3: Result */}
                {finalJeopardyStage === 'result' && (
                    <div className="max-w-4xl mx-auto">
                        <div className="question-card">
                            <div className="question-category">
                                {finalJeopardyQuestion.category.name}
                            </div>
                            <p className="question-text mb-8">
                                {finalJeopardyQuestion.question}
                            </p>

                            <div className="space-y-6">
                                <div className={`p-6 rounded-xl ${finalJeopardyIsCorrect ? 'feedback-correct' : 'feedback-incorrect'}`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        {finalJeopardyIsCorrect ? (
                                            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        ) : (
                                            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        )}
                                        <span className={`text-lg font-bold ${finalJeopardyIsCorrect ? 'text-green-700' : 'text-red-700'}`}>
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
                                    {!finalJeopardyIsCorrect && finalJeopardyDisputeContext && user?.id && (
                                        <div className="mt-3 flex justify-end">
                                            {finalJeopardyDisputeSubmitted ? (
                                                <span className="text-sm text-blue-200 flex items-center gap-1">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    Dispute submitted
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1">
                                                    <button
                                                        onClick={handleFinalJeopardyDispute}
                                                        className="text-sm text-blue-200 hover:text-white underline"
                                                    >
                                                        Dispute this answer
                                                    </button>
                                                    <span className="relative group">
                                                        <span className="w-4 h-4 inline-flex items-center justify-center text-xs text-blue-100 hover:text-white cursor-help border border-blue-200 rounded-full">i</span>
                                                        <span className="absolute bottom-full right-0 mb-2 px-3 py-2 text-xs text-white bg-gray-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                                            An admin will review your answer.<br/>If approved, you&apos;ll be retroactively credited.
                                                        </span>
                                                    </span>
                                                </span>
                                            )}
                                        </div>
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
                                    onClick={handleGameComplete}
                                    className="w-full btn-gold py-4 text-lg"
                                >
                                    Return to Game Hub
                                </button>
                            </div>
                        </div>
                    </div>
                )}
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
                    
                    <div className="flex items-center gap-2 sm:gap-3">
                        {/* Seed copy button */}
                        {gameSeed && (
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(gameSeed)
                                    // Visual feedback
                                    const btn = document.activeElement as HTMLButtonElement
                                    const originalTitle = btn?.title
                                    if (btn) {
                                        btn.title = 'Copied!'
                                        setTimeout(() => { btn.title = originalTitle }, 1500)
                                    }
                                }}
                                className="hidden sm:flex items-center gap-1.5 px-2 py-1 text-xs text-blue-200 hover:text-white hover:bg-white/10 rounded transition-colors"
                                title={`Copy seed: ${gameSeed}`}
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                </svg>
                                <span className="font-mono">{gameSeed}</span>
                            </button>
                        )}
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
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="question-card animate-fade-in-slide-down max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => setSelectedQuestion(null)}
                            className="absolute top-4 right-4 text-white/60 hover:text-white text-3xl transition-colors"
                            aria-label="Close"
                        >
                            ×
                        </button>

                        {/* Category name for context */}
                        <div className="question-category">
                            {categories.find(c => c.id === selectedQuestion.categoryId)?.name}
                        </div>

                        <div className="question-value">
                            ${normalizeQuestionValue(selectedQuestion.value, isDoubleJeopardy)}
                        </div>

                        <p className="question-text mb-8">{selectedQuestion.question}</p>

                        {!showAnswer && !answeredQuestions.has(selectedQuestion.id) ? (
                            <div className="space-y-4">
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault()
                                        handleSubmitAnswer()
                                    }}
                                    className="space-y-4"
                                >
                                    <input
                                        type="text"
                                        value={userAnswer}
                                        onChange={(e) => setUserAnswer(e.target.value)}
                                        className="answer-input"
                                        placeholder="What is..."
                                        autoComplete="off"
                                        autoCapitalize="off"
                                        autoFocus
                                    />
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <button
                                            type="submit"
                                            className="flex-1 btn-gold py-3 text-lg"
                                        >
                                            Submit
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleDontKnow}
                                            className="flex-1 btn-secondary py-3"
                                        >
                                            I don&apos;t know
                                        </button>
                                    </div>
                                </form>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className={`p-6 rounded-xl ${isCorrect ? 'feedback-correct' : 'feedback-incorrect'}`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        {isCorrect ? (
                                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        ) : (
                                            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        )}
                                        <span className={`text-sm font-bold ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                                            {isCorrect ? 'Correct!' : 'Incorrect'}
                                        </span>
                                    </div>
                                    <p className="font-medium text-center">
                                        {selectedQuestion.answer}
                                    </p>
                                    {!isCorrect && disputeContext && user?.id && (
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
                                <button
                                    onClick={() => setSelectedQuestion(null)}
                                    className="w-full btn-secondary py-3"
                                >
                                    Continue
                                </button>
                            </div>
                        )}
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
                                    setShowRoundComplete(false)
                                    setLoading(true)
                                    try {
                                        await handleRoundComplete()
                                    } catch (error) {
                                        console.error('Error starting next round:', error)
                                        setError('Failed to load next round.')
                                    }
                                    setLoading(false)
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

            {/* Post-Game Celebration Modal */}
            {showCelebrationModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="card p-8 max-w-2xl w-full text-center animate-fade-in-slide-down">
                        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center shadow-lg">
                            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 className="text-3xl font-bold mb-2 text-gray-900">Game Complete!</h2>
                        
                        {/* Final Score */}
                        <div className="my-6">
                            <p className="text-gray-600 mb-2">Final Score</p>
                            <p className={`text-5xl font-bold ${score >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                {score < 0 ? '-' : ''}${Math.abs(score).toLocaleString()}
                            </p>
                        </div>

                        {/* Performance Breakdown */}
                        <div className="bg-gray-50 rounded-xl p-6 mb-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <p className="text-2xl font-bold text-green-600">{gameStats.correct}</p>
                                    <p className="text-sm text-gray-600">Correct</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-red-600">{gameStats.incorrect}</p>
                                    <p className="text-sm text-gray-600">Incorrect</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-blue-600">
                                        {gameStats.correct + gameStats.incorrect > 0
                                            ? Math.round((gameStats.correct / (gameStats.correct + gameStats.incorrect)) * 100)
                                            : 0}%
                                    </p>
                                    <p className="text-sm text-gray-600">Accuracy</p>
                                </div>
                            </div>
                        </div>

                        {/* Share Seed */}
                        {gameSeed && (
                            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                                <p className="text-sm text-gray-600 mb-2">Share this game:</p>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(gameSeed)
                                        const btn = document.activeElement as HTMLButtonElement
                                        const originalText = btn?.textContent
                                        if (btn) {
                                            btn.textContent = 'Copied!'
                                            setTimeout(() => { btn.textContent = originalText }, 1500)
                                        }
                                    }}
                                    className="font-mono text-blue-600 hover:text-blue-800 text-sm"
                                >
                                    {gameSeed}
                                </button>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button
                                onClick={handlePlayAgain}
                                className="btn-primary px-6 py-3"
                            >
                                Play Again
                            </button>
                            <Link
                                href="/stats"
                                className="btn-secondary px-6 py-3"
                            >
                                View Stats
                            </Link>
                            <button
                                onClick={handleCelebrationClose}
                                className="btn-secondary px-6 py-3"
                            >
                                Back to Game Hub
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
