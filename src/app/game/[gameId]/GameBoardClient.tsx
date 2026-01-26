'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useAuth } from '../../lib/auth'
import { checkAnswer } from '../../lib/answer-checker'
import { useMobileKeyboard } from '@/app/hooks/useMobileKeyboard'
import type { Player } from '@/components/Scoreboard'
import { showAchievementUnlock } from '@/app/components/AchievementUnlockToast'
import ProfileCustomizationPrompt from '@/app/components/ProfileCustomizationPrompt'
import type { UnlockedAchievement } from '@/types/admin'

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

import type { GameData } from '@/lib/game-data'

interface GameBoardByIdProps {
    initialGameData?: GameData
}

export default function GameBoardById({ initialGameData }: GameBoardByIdProps = {}) {
    const router = useRouter()
    const params = useParams()
    const gameId = params?.gameId as string
    const { user } = useAuth()
    
    // Start loading: if no initial data, or if we have initial data (we still need to load categories/Final Jeopardy)
    const [loading, setLoading] = useState(true)
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
    const hasInitialized = useRef(false)
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
    const [showProfilePrompt, setShowProfilePrompt] = useState(false)
    const [isFirstGame, setIsFirstGame] = useState(false)
    const [gameCompletionAchievements, setGameCompletionAchievements] = useState<UnlockedAchievement[]>([])
    const [roundScores, setRoundScores] = useState<{ SINGLE: number; DOUBLE: number; FINAL: number }>({ SINGLE: 0, DOUBLE: 0, FINAL: 0 })
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
    
    // Question details state for answered questions (userAnswer, correct status, dispute status)
    const [questionDetails, setQuestionDetails] = useState<Record<string, {
        userAnswer: string | null
        correct: boolean | null
        disputeStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' | null
    }>>({})

    // Mobile keyboard handling
    const answerInputRef = useRef<HTMLInputElement>(null)
    const { scrollIntoView, focusInput } = useMobileKeyboard()
    const [revealMyAnswer, setRevealMyAnswer] = useState(false)
    
    // Completed game state - for review mode
    const isCompletedGame = initialGameData?.status === 'COMPLETED'
    
    // Focus input on desktop when question modal opens (skip on mobile to let user read question first)
    useEffect(() => {
        if (selectedQuestion && !showAnswer && !answeredQuestions.has(selectedQuestion.id) && !isCompletedGame) {
            focusInput(answerInputRef)
        }
    }, [selectedQuestion, showAnswer, answeredQuestions, isCompletedGame, focusInput])
    // Track which answers have been revealed in review mode (collapsed by default)
    const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({})
    const toggleRevealAnswer = (questionId: string) => {
        setRevealedAnswers(prev => ({ ...prev, [questionId]: !prev[questionId] }))
    }
    // Track correct/incorrect status for all questions (for coloring the board)
    const [questionCorrectness, setQuestionCorrectness] = useState<Record<string, boolean | null>>(() => {
        const correctness: Record<string, boolean | null> = {}
        if (initialGameData?.questions) {
            Object.values(initialGameData.questions).forEach((q) => {
                if (q.answered) {
                    correctness[q.questionId] = q.correct
                }
            })
        }
        return correctness
    })
    
    // Cache for round categories in review mode - prevents reload flash when switching rounds
    const [roundCategoriesCache, setRoundCategoriesCache] = useState<Record<string, Category[]>>({})
    const [cachedFinalJeopardy, setCachedFinalJeopardy] = useState<{
        id: string
        question: string
        answer: string
        category: { id: string; name: string }
    } | null>(null)
    
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

    // Save game state to server
    const saveGameState = useCallback(async (action: string, data: Record<string, unknown>) => {
        if (!gameId) return null
        try {
            const response = await fetch(`/api/games/${gameId}/state`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...data })
            })
            if (response.ok) {
                return await response.json()
            }
            return null
        } catch (error) {
            console.error('Error saving game state:', error)
            return null
        }
    }, [gameId])

    // Load categories - stable function that doesn't change
    const loadCategories = useCallback(async (round: 'SINGLE' | 'DOUBLE', config: GameConfig, seed?: string | null): Promise<void> => {
        if (!config) {
            throw new Error('No game configuration provided')
        }

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

    // Round type - represents any round in the game
    type RoundType = 'SINGLE' | 'DOUBLE' | 'FINAL'
    
    // Check if a round is a board-based round (Single/Double) vs Final Jeopardy
    const isBoardRound = (round: RoundType): round is 'SINGLE' | 'DOUBLE' => {
        return round === 'SINGLE' || round === 'DOUBLE'
    }
    
    // Get human-readable label for a round
    const getRoundLabel = (round: RoundType): string => {
        const labels: Record<RoundType, string> = {
            'SINGLE': 'Single',
            'DOUBLE': 'Double', 
            'FINAL': 'Final'
        }
        return labels[round] || round
    }

    // Get available rounds based on game config - returns rounds in order
    const getAvailableRounds = useCallback((): RoundType[] => {
        if (!gameConfig?.rounds) return ['SINGLE']
        const rounds: RoundType[] = []
        if (gameConfig.rounds.single) rounds.push('SINGLE')
        if (gameConfig.rounds.double) rounds.push('DOUBLE')
        if (gameConfig.rounds.final) rounds.push('FINAL')
        return rounds.length > 0 ? rounds : ['SINGLE']
    }, [gameConfig])

    // Determine the currently active round for display purposes
    const getCurrentActiveRound = useCallback((): RoundType => {
        if (showFinalJeopardy) return 'FINAL'
        return currentRound
    }, [showFinalJeopardy, currentRound])

    // Navigate to a specific round in review mode (completed games only)
    const navigateToRound = useCallback(async (round: RoundType) => {
        if (!isCompletedGame || !gameConfig) return
        
        // Reset reveal state when navigating rounds (answers start hidden in review mode)
        setRevealedAnswers({})
        
        if (round === 'FINAL') {
            // Check cache first for Final Jeopardy
            if (cachedFinalJeopardy) {
                setFinalJeopardyQuestion(cachedFinalJeopardy)
                setShowFinalJeopardy(true)
                setFinalJeopardyStage('result')
                
                const fjCorrectness = questionCorrectness[cachedFinalJeopardy.id]
                setFinalJeopardyIsCorrect(fjCorrectness ?? null)
                
                if (gameConfig.finalJeopardyWager !== undefined) {
                    setFinalJeopardyActualWager(gameConfig.finalJeopardyWager)
                }
                return
            }
            
            // Load Final Jeopardy for review (first time)
            if (gameConfig.finalJeopardyQuestionId) {
                try {
                    setLoading(true)
                    const response = await fetch(`/api/questions/${gameConfig.finalJeopardyQuestionId}`)
                    if (response.ok) {
                        const data = await response.json()
                        // Cache the Final Jeopardy data
                        setCachedFinalJeopardy(data)
                        setFinalJeopardyQuestion(data)
                        setShowFinalJeopardy(true)
                        setFinalJeopardyStage('result')
                        
                        const fjCorrectness = questionCorrectness[gameConfig.finalJeopardyQuestionId]
                        setFinalJeopardyIsCorrect(fjCorrectness ?? null)
                        
                        if (gameConfig.finalJeopardyWager !== undefined) {
                            setFinalJeopardyActualWager(gameConfig.finalJeopardyWager)
                        }
                    }
                } catch (error) {
                    console.error('Error loading Final Jeopardy for review:', error)
                } finally {
                    setLoading(false)
                }
            }
        } else if (isBoardRound(round)) {
            // Check cache first for board rounds
            if (roundCategoriesCache[round]) {
                setCategories(roundCategoriesCache[round])
                setCurrentRound(round)
                setIsDoubleJeopardy(round === 'DOUBLE')
                setShowFinalJeopardy(false)
                return
            }
            
            // Load board-based round categories (first time)
            setShowFinalJeopardy(false)
            setLoading(true)
            try {
                await loadCategories(round, gameConfig, gameSeed)
                // Cache will be updated via effect when categories change
            } catch (error) {
                console.error('Error loading categories for review:', error)
            } finally {
                setLoading(false)
            }
        }
    }, [isCompletedGame, gameConfig, gameSeed, loadCategories, questionCorrectness, cachedFinalJeopardy, roundCategoriesCache])

    // Cache categories when loaded in review mode
    useEffect(() => {
        if (isCompletedGame && categories.length > 0 && !roundCategoriesCache[currentRound]) {
            setRoundCategoriesCache(prev => ({
                ...prev,
                [currentRound]: categories
            }))
        }
    }, [isCompletedGame, categories, currentRound, roundCategoriesCache])

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
        if (hasInitialized.current || !gameId) {
            return
        }
        
        hasInitialized.current = true
        
        // If we have initial data from server, use it and load categories
        if (initialGameData) {
            const config = initialGameData.config
            const round = initialGameData.currentRound
            
            if (!config) {
                console.error('No config in initialGameData')
                setError('Invalid game configuration')
                setLoading(false)
                return
            }
            
            // Set loading to true while we fetch categories/Final Jeopardy
            setLoading(true)
            
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
                        .then(res => {
                            if (!res.ok) {
                                throw new Error(`Failed to load Final Jeopardy: ${res.status}`)
                            }
                            return res.json()
                        })
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
                            setError(err instanceof Error ? err.message : 'Failed to load Final Jeopardy')
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
                        .then(res => {
                            if (!res.ok) {
                                throw new Error(`Failed to load Final Jeopardy: ${res.status}`)
                            }
                            return res.json()
                        })
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
                            setError(err instanceof Error ? err.message : 'Failed to load Final Jeopardy')
                            setLoading(false)
                        })
                } else {
                    loadFinalJeopardy(config)
                }
            } else {
                // Load categories for current round
                // Safety timeout to prevent infinite loading
                const timeoutId = setTimeout(() => {
                    console.error('loadCategories timed out after 30 seconds')
                    setError('Loading categories timed out. Please refresh the page.')
                    setLoading(false)
                }, 30000)
                
                loadCategories(round, config, initialGameData.seed)
                    .then(() => {
                        clearTimeout(timeoutId)
                        setLoading(false)
                    })
                    .catch((err) => {
                        console.error('Error loading categories:', err)
                        clearTimeout(timeoutId)
                        setError(err instanceof Error ? err.message : 'Failed to load categories')
                        setLoading(false)
                    })
                    .finally(() => {
                        clearTimeout(timeoutId)
                    })
            }
            return
        }
        
        // Fallback: fetch from API if no initial data (shouldn't happen in production)
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
                    const questions = gameData.questions as Record<string, { questionId?: string; answered?: boolean }>
                    Object.values(questions).forEach((q) => {
                        if (q.answered) {
                            answered.add(q.questionId || '')
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

    // Poll for approved disputes to sync score mid-game
    // Use localStorage to persist seen disputes across page refreshes
    const getSeenDisputesKey = () => `seen-disputes-${gameId}`
    
    const loadSeenDisputes = useCallback((): Set<string> => {
        if (!gameId || typeof window === 'undefined') {
            return new Set()
        }
        try {
            const stored = localStorage.getItem(getSeenDisputesKey())
            if (stored) {
                return new Set(JSON.parse(stored))
            }
        } catch (error) {
            console.debug('Error loading seen disputes from localStorage:', error)
        }
        return new Set()
    }, [gameId])

    const saveSeenDispute = useCallback((disputeKey: string) => {
        if (!gameId || typeof window === 'undefined') {
            return
        }
        try {
            const seen = loadSeenDisputes()
            seen.add(disputeKey)
            localStorage.setItem(getSeenDisputesKey(), JSON.stringify(Array.from(seen)))
        } catch (error) {
            console.debug('Error saving seen dispute to localStorage:', error)
        }
    }, [gameId, loadSeenDisputes])
    
    useEffect(() => {
        if (!gameId || loading || showFinalJeopardy) {
            return // Don't poll if game isn't loaded or we're in Final Jeopardy
        }

        const checkApprovedDisputes = async () => {
            try {
                const response = await fetch(`/api/games/${gameId}/approved-disputes`)
                if (!response.ok) {
                    return // Silently fail - don't spam errors
                }

                const data = await response.json()
                const approvedDisputes = data.approvedDisputes || []
                const seenDisputes = loadSeenDisputes()

                // Process new disputes that haven't been seen yet
                for (const dispute of approvedDisputes) {
                    const disputeKey = `${dispute.questionId}-${dispute.resolvedAt}`
                    
                    if (!seenDisputes.has(disputeKey)) {
                        // Mark as seen in localStorage
                        saveSeenDispute(disputeKey)
                        
                        // Update score
                        setScore(prev => prev + dispute.points)
                        
                        // Mark question as answered correctly
                        setAnsweredQuestions(prev => new Set([...prev, dispute.questionId]))
                        
                        // Update game stats
                        setGameStats(prev => ({ ...prev, correct: prev.correct + 1 }))
                        
                        // Update question details to reflect approved dispute
                        setQuestionDetails(prev => {
                            const existing = prev[dispute.questionId]
                            return {
                                ...prev,
                                [dispute.questionId]: {
                                    userAnswer: existing?.userAnswer ?? null,
                                    correct: true,
                                    disputeStatus: 'APPROVED' as const
                                }
                            }
                        })
                        
                        // If this question is currently selected, update its display
                        if (selectedQuestion?.id === dispute.questionId) {
                            setIsCorrect(true)
                        }
                        
                        // Show toast notification only if user hasn't moved on to next question
                        // We check if the question is still in answeredQuestions (meaning they haven't navigated away)
                        toast.success(
                            (t) => (
                                <div className="flex items-center gap-2">
                                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>Dispute approved! +${dispute.points.toLocaleString()} points</span>
                                </div>
                            ),
                            {
                                duration: 5000,
                                position: 'bottom-right',
                                icon: null,
                            }
                        )
                    }
                }
            } catch (error) {
                // Silently fail - don't spam console with errors
                console.debug('Error checking approved disputes:', error)
            }
        }

        // Check immediately, then every 30 seconds
        checkApprovedDisputes()
        const interval = setInterval(checkApprovedDisputes, 30000)

        return () => clearInterval(interval)
    }, [gameId, loading, showFinalJeopardy, loadSeenDisputes, saveSeenDispute])

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

        const hasValueConflict = questionsInCategory.some((q, _i) =>
            q && q.id !== question.id && normalizeQuestionValue(q.value, isDoubleJeopardy) === normalValue
        )

        if (hasValueConflict || normalValue !== valueSlots[slotIndex]) {
            return valueSlots[slotIndex]
        }

        return normalValue
    }

    const handleQuestionSelect = async (question: Question) => {
        if (!question) return
        
        if (answeredQuestions.has(question.id)) {
            // Question already answered - fetch details
            setSelectedQuestion(question)
            setShowAnswer(true)
            setRevealMyAnswer(false)
            setUserAnswer('') // Reset to prevent showing stale answer from previous question
            
            // Check if we have cached details first
            const cachedDetails = questionDetails[question.id]
            if (cachedDetails) {
                // Use cached details immediately
                setIsCorrect(cachedDetails.correct)
            } else {
                // Reset isCorrect to null to prevent stale state from previous question
                // This ensures the UI shows the correct state while loading
                setIsCorrect(null)
            }
            
            // Fetch question details if not already loaded
            if (!cachedDetails && gameId) {
                try {
                    const response = await fetch(`/api/games/${gameId}/questions/${question.id}/details`)
                    if (response.ok) {
                        const details = await response.json()
                        setQuestionDetails(prev => ({
                            ...prev,
                            [question.id]: {
                                userAnswer: details.userAnswer,
                                correct: details.correct,
                                disputeStatus: details.disputeStatus
                            }
                        }))
                        // Update isCorrect based on fetched data (including dispute resolution)
                        setIsCorrect(details.correct)
                    }
                } catch (error) {
                    console.debug('Error fetching question details:', error)
                }
            }
            return
        }
        
        // New question - reset state
        setSelectedQuestion(question)
        setUserAnswer('')
        setShowAnswer(false)
        setIsCorrect(null)
        setRevealMyAnswer(false)
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

            // Save question details for later viewing
            setQuestionDetails(prev => ({
                ...prev,
                [selectedQuestion.id]: {
                    userAnswer: userAnswer.trim(),
                    correct: result,
                    disputeStatus: 'NONE' as const
                }
            }))

            // Show achievement unlock notifications
            if (data.unlockedAchievements && Array.isArray(data.unlockedAchievements)) {
                data.unlockedAchievements.forEach((achievement: UnlockedAchievement) => {
                    showAchievementUnlock(achievement)
                })
            }

            setAnsweredQuestions(prev => new Set([...prev, selectedQuestion.id]))

            if (result) {
                setScore(prev => prev + pointsEarned)
                setGameStats(prev => ({ ...prev, correct: prev.correct + 1 }))
                // Track round scores
                setRoundScores(prev => ({
                    ...prev,
                    [currentRound]: prev[currentRound as keyof typeof prev] + pointsEarned
                }))
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
            
            // Save question details for later viewing
            setQuestionDetails(prev => ({
                ...prev,
                [selectedQuestion.id]: {
                    userAnswer: userAnswer.trim(),
                    correct: result,
                    disputeStatus: 'NONE' as const
                }
            }))
            
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

        setIsCorrect(false)
        setShowAnswer(true)
        
        // Save question details for later viewing
        setQuestionDetails(prev => ({
            ...prev,
            [selectedQuestion.id]: {
                userAnswer: null,
                correct: false,
                disputeStatus: 'NONE' as const
            }
        }))
        
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
            
            // Track Final Jeopardy score
            setRoundScores(prev => ({
                ...prev,
                FINAL: prev.FINAL - effectiveWager
            }))

            await saveGameState('answer', {
                questionId: finalJeopardyQuestion.id,
                correct: false,
                pointsEarned: 0
            })
    }

    const _handleGameComplete = async () => {
        const result = await saveGameState('complete', { finalScore: score })
        // Show achievement unlock notifications and store for celebration modal
        if (result?.unlockedAchievements && Array.isArray(result.unlockedAchievements)) {
            setGameCompletionAchievements(result.unlockedAchievements)
            result.unlockedAchievements.forEach((achievement: UnlockedAchievement) => {
                showAchievementUnlock(achievement)
                // Check if this is FIRST_GAME achievement
                if (achievement.code === 'FIRST_GAME') {
                    setIsFirstGame(true)
                }
            })
        }
        setShowCelebrationModal(true)
    }

    const handleCelebrationClose = () => {
        setShowCelebrationModal(false)
        // Show profile customization prompt if this was first game
        if (isFirstGame) {
            setShowProfilePrompt(true)
        } else {
            router.push('/game')
        }
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
        } catch {
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
                    
                    {/* Review Mode Round Navigation */}
                    {isCompletedGame && (
                        <div className="mt-4 flex items-center justify-center gap-2">
                            <span className="text-sm text-blue-300">Reviewing:</span>
                            <div className="flex items-center gap-1 bg-blue-800/50 rounded-lg p-1">
                                {getAvailableRounds().map((round) => {
                                    const isActive = getCurrentActiveRound() === round
                                    return (
                                        <button
                                            key={round}
                                            onClick={() => navigateToRound(round)}
                                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                                                isActive
                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                    : 'text-blue-200 hover:text-white hover:bg-blue-700/50'
                                            }`}
                                        >
                                            {getRoundLabel(round)}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}
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
                                {/* In review mode (completed game), show reveal button first */}
                                {isCompletedGame && !revealedAnswers['final-jeopardy'] ? (
                                    <div className="text-center py-6">
                                        <button
                                            onClick={() => toggleRevealAnswer('final-jeopardy')}
                                            className="btn-gold px-8 py-3 text-lg flex items-center gap-2 mx-auto"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                            Reveal Answer
                                        </button>
                                    </div>
                                ) : (
                                <div className={`p-6 rounded-xl ${finalJeopardyIsCorrect ? 'feedback-correct' : 'feedback-incorrect'}`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
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
                                        {/* Hide answer button in review mode */}
                                        {isCompletedGame && (
                                            <button
                                                onClick={() => toggleRevealAnswer('final-jeopardy')}
                                                className={`text-xs font-medium flex items-center gap-1 ${finalJeopardyIsCorrect ? 'text-green-700 hover:text-green-900' : 'text-red-700 hover:text-red-900'}`}
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                </svg>
                                                Hide
                                            </button>
                                        )}
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
                                )}
                                
                                {/* Final Score Display */}
                                <div className="text-center py-4">
                                    <p className="text-blue-200 text-lg">Final Score</p>
                                    <p className={`text-5xl font-bold ${score >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                                        {score < 0 ? '-' : ''}${Math.abs(score).toLocaleString()}
                                    </p>
                                </div>

                                <button
                                    onClick={async () => {
                                        await saveGameState('complete', { finalScore: score })
                                        router.push('/game')
                                    }}
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
                    {/* Review Mode Header - Show current round indicator for completed games */}
                    {isCompletedGame && (
                        <div className="mb-4 flex items-center justify-center gap-2">
                            <span className="text-sm text-gray-500">Reviewing:</span>
                            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                                {getAvailableRounds().map((round) => {
                                    const isActive = getCurrentActiveRound() === round
                                    return (
                                        <button
                                            key={round}
                                            onClick={() => navigateToRound(round)}
                                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                                                isActive
                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                                            }`}
                                        >
                                            {getRoundLabel(round)}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                    
                    {categories.length === 0 && !showFinalJeopardy ? (
                        <div className="text-center py-12">
                            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent mb-4"></div>
                            <p className="text-gray-600">Loading game board...</p>
                        </div>
                    ) : !showFinalJeopardy ? (
                        /* Board wrapper with navigation buttons */
                        <div className="relative">
                            {/* Left Navigation Button - Previous Round */}
                            {isCompletedGame && (() => {
                                const rounds = getAvailableRounds()
                                const activeRound = getCurrentActiveRound()
                                const currentIndex = rounds.indexOf(activeRound)
                                const hasPrevRound = currentIndex > 0
                                if (!hasPrevRound) return null
                                const prevRound = rounds[currentIndex - 1]
                                return (
                                    <button
                                        onClick={() => navigateToRound(prevRound)}
                                        className="hidden xl:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full mr-4 items-center justify-center w-12 h-24 bg-blue-600 hover:bg-blue-700 text-white rounded-l-xl shadow-lg transition-all group"
                                        title={`Go to ${getRoundLabel(prevRound)} Jeopardy`}
                                    >
                                        <div className="flex flex-col items-center">
                                            <svg className="w-6 h-6 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                            </svg>
                                            <span className="text-xs mt-1 font-medium">{getRoundLabel(prevRound)}</span>
                                        </div>
                                    </button>
                                )
                            })()}
                            
                            {/* Right Navigation Button - Next Round */}
                            {isCompletedGame && (() => {
                                const rounds = getAvailableRounds()
                                const activeRound = getCurrentActiveRound()
                                const currentIndex = rounds.indexOf(activeRound)
                                const hasNextRound = currentIndex >= 0 && currentIndex < rounds.length - 1
                                if (!hasNextRound) return null
                                const nextRound = rounds[currentIndex + 1]
                                return (
                                    <button
                                        onClick={() => navigateToRound(nextRound)}
                                        className="hidden xl:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-full ml-4 items-center justify-center w-12 h-24 bg-blue-600 hover:bg-blue-700 text-white rounded-r-xl shadow-lg transition-all group"
                                        title={`Go to ${getRoundLabel(nextRound)} Jeopardy`}
                                    >
                                        <div className="flex flex-col items-center">
                                            <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                            <span className="text-xs mt-1 font-medium">{getRoundLabel(nextRound)}</span>
                                        </div>
                                    </button>
                                )
                            })()}
                            
                            {/* Game Board */}
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
                                                const isCorrect = questionCorrectness[question.id]

                                                // Determine button styling based on game state
                                                let buttonClass = 'bg-blue-600 text-amber-400 hover:bg-blue-500 active:scale-95'
                                                if (isAnswered) {
                                                    if (isCompletedGame && isCorrect !== null) {
                                                        // Completed game: color based on correctness
                                                        buttonClass = isCorrect
                                                            ? 'bg-green-600/70 text-green-100 hover:bg-green-600/80'
                                                            : 'bg-red-600/70 text-red-100 hover:bg-red-600/80'
                                                    } else {
                                                        // In-progress game: standard grey
                                                        buttonClass = 'bg-blue-900/50 text-blue-700'
                                                    }
                                                }

                                                return (
                                                    <button
                                                        key={question.id}
                                                        onClick={() => handleQuestionSelect(question)}
                                                        className={`aspect-square flex items-center justify-center rounded font-bold text-xs sm:text-sm transition-all ${buttonClass}`}
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
                                        const isCorrect = questionCorrectness[question.id]

                                        // Determine button styling based on game state
                                        let cellClass = 'clue-cell min-h-[60px] text-lg lg:text-2xl'
                                        if (isAnswered) {
                                            if (isCompletedGame && isCorrect !== null) {
                                                // Completed game: color based on correctness
                                                cellClass = isCorrect
                                                    ? 'clue-cell min-h-[60px] text-lg lg:text-2xl bg-green-600/70 text-green-100 hover:bg-green-600/80'
                                                    : 'clue-cell min-h-[60px] text-lg lg:text-2xl bg-red-600/70 text-red-100 hover:bg-red-600/80'
                                            } else {
                                                // In-progress game: standard answered style
                                                cellClass = 'clue-cell min-h-[60px] text-lg lg:text-2xl answered'
                                            }
                                        }

                                        return (
                                            <button
                                                key={question.id}
                                                onClick={() => handleQuestionSelect(question)}
                                                className={cellClass}
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
                    ) : null}
                </div>
            </div>

            {/* Question Modal */}
            {selectedQuestion && (
                <div className="question-modal-overlay">
                    <div className="question-modal-card relative">
                        {/* Close Button */}
                        <button
                            onClick={() => {
                                setSelectedQuestion(null)
                                setRevealMyAnswer(false)
                            }}
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
                            <div className="space-y-4">
                                {(() => {
                                    const details = questionDetails[selectedQuestion.id]
                                    const effectiveCorrect = details?.correct ?? isCorrect
                                    const effectiveDisputeStatus = details?.disputeStatus ?? (disputeSubmitted ? 'PENDING' : 'NONE')
                                    const storedUserAnswer = details?.userAnswer
                                    const hasUserAnswer = storedUserAnswer || userAnswer.trim()
                                    const isAnswerRevealed = !isCompletedGame || revealedAnswers[selectedQuestion.id]
                                    
                                    return (
                                        <>
                                            {/* In review mode (completed game), show reveal button first */}
                                            {isCompletedGame && !isAnswerRevealed ? (
                                                <div className="text-center py-6">
                                                    <button
                                                        onClick={() => toggleRevealAnswer(selectedQuestion.id)}
                                                        className="btn-primary px-8 py-3 text-lg flex items-center gap-2 mx-auto"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                        Reveal Answer
                                                    </button>
                                                </div>
                                            ) : (
                                            <div className={`p-6 rounded-xl ${effectiveCorrect ? 'feedback-correct' : 'feedback-incorrect'}`}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        {effectiveCorrect ? (
                                                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                            </svg>
                                                        ) : (
                                                            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                            </svg>
                                                        )}
                                                        <span className={`text-sm font-bold ${effectiveCorrect ? 'text-green-700' : 'text-red-700'}`}>
                                                            {effectiveCorrect ? 'Correct!' : 'Incorrect'}
                                                        </span>
                                                    </div>
                                                    {/* Hide answer button in review mode */}
                                                    {isCompletedGame && (
                                                        <button
                                                            onClick={() => toggleRevealAnswer(selectedQuestion.id)}
                                                            className={`text-xs font-medium flex items-center gap-1 ${effectiveCorrect ? 'text-green-700 hover:text-green-900' : 'text-red-700 hover:text-red-900'}`}
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                            </svg>
                                                            Hide
                                                        </button>
                                                    )}
                                                </div>
                                                <p className="font-medium text-center">
                                                    {selectedQuestion.answer}
                                                </p>
                                                
                                                {/* Action row: Show My Answer + Dispute (on same line) */}
                                                {!effectiveCorrect && (
                                                    <div className="mt-4 flex items-center justify-between gap-2">
                                                        {/* Show My Answer toggle */}
                                                        {hasUserAnswer ? (
                                                            <button
                                                                onClick={() => setRevealMyAnswer(!revealMyAnswer)}
                                                                className="text-red-700 hover:text-red-900 text-sm font-medium flex items-center gap-1"
                                                            >
                                                                {revealMyAnswer ? (
                                                                    <>
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                                        </svg>
                                                                        Hide My Answer
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                        </svg>
                                                                        Show My Answer
                                                                    </>
                                                                )}
                                                            </button>
                                                        ) : (
                                                            <span /> // Empty spacer when no answer to show
                                                        )}
                                                        
                                                        {/* Dispute button or status */}
                                                        {effectiveDisputeStatus === 'PENDING' ? (
                                                            <span className="text-sm text-blue-600 flex items-center gap-1">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                </svg>
                                                                Dispute pending
                                                            </span>
                                                        ) : effectiveDisputeStatus === 'APPROVED' ? (
                                                            <span className="text-sm text-green-600 flex items-center gap-1">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                                Dispute approved
                                                            </span>
                                                        ) : user?.id && hasUserAnswer ? (
                                                            <span className="inline-flex items-center gap-1">
                                                                <button
                                                                    onClick={async () => {
                                                                        if (!selectedQuestion || !gameId) return
                                                                        
                                                                        const disputeCtx = {
                                                                            questionId: selectedQuestion.id,
                                                                            gameId: gameId,
                                                                            round: currentRound,
                                                                            userAnswer: storedUserAnswer || userAnswer.trim() || '',
                                                                            mode: 'GAME' as const
                                                                        }
                                                                        
                                                                        try {
                                                                            const response = await fetch('/api/answers/disputes', {
                                                                                method: 'POST',
                                                                                headers: { 'Content-Type': 'application/json' },
                                                                                body: JSON.stringify({
                                                                                    ...disputeCtx,
                                                                                    systemWasCorrect: false
                                                                                })
                                                                            })
                                                                            
                                                                            if (!response.ok) {
                                                                                const error = await response.json()
                                                                                console.error('Failed to submit dispute:', error.error)
                                                                                return
                                                                            }
                                                                            
                                                                            setQuestionDetails(prev => ({
                                                                                ...prev,
                                                                                [selectedQuestion.id]: {
                                                                                    ...prev[selectedQuestion.id],
                                                                                    disputeStatus: 'PENDING' as const
                                                                                }
                                                                            }))
                                                                        } catch (error) {
                                                                            console.error('Error submitting dispute:', error)
                                                                        }
                                                                    }}
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
                                                        ) : null}
                                                    </div>
                                                )}
                                                
                                                {/* Revealed answer box */}
                                                {!effectiveCorrect && revealMyAnswer && hasUserAnswer && (
                                                    <div className="mt-2 p-3 bg-red-200/50 rounded-lg border border-red-300">
                                                        <p className="text-xs text-red-600 font-semibold mb-1">Your answer:</p>
                                                        <p className="text-red-800 italic">{storedUserAnswer || userAnswer.trim()}</p>
                                                    </div>
                                                )}
                                            </div>
                                            )}
                                        </>
                                    )
                                })()}
                                <button
                                    onClick={() => {
                                        setSelectedQuestion(null)
                                        setRevealMyAnswer(false)
                                        // Note: Don't reset revealedAnswers - let user's revealed state persist for easier navigation
                                    }}
                                    className="w-full btn-secondary py-3 text-base sm:text-lg"
                                >
                                    {isCompletedGame ? 'Close' : 'Continue'}
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
                            <div className="grid grid-cols-3 gap-4 mb-4">
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
                            
                            {/* Round Score Breakdown */}
                            {(roundScores.SINGLE > 0 || roundScores.DOUBLE > 0 || roundScores.FINAL !== 0) && (
                                <div className="border-t border-gray-200 pt-4 mt-4">
                                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Score by Round</h4>
                                    <div className="grid grid-cols-3 gap-3">
                                        {roundScores.SINGLE > 0 && (
                                            <div>
                                                <p className="text-lg font-bold text-gray-900">${roundScores.SINGLE.toLocaleString()}</p>
                                                <p className="text-xs text-gray-600">Single</p>
                                            </div>
                                        )}
                                        {roundScores.DOUBLE > 0 && (
                                            <div>
                                                <p className="text-lg font-bold text-gray-900">${roundScores.DOUBLE.toLocaleString()}</p>
                                                <p className="text-xs text-gray-600">Double</p>
                                            </div>
                                        )}
                                        {roundScores.FINAL !== 0 && (
                                            <div>
                                                <p className={`text-lg font-bold ${roundScores.FINAL >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                                                    {roundScores.FINAL < 0 ? '-' : ''}${Math.abs(roundScores.FINAL).toLocaleString()}
                                                </p>
                                                <p className="text-xs text-gray-600">Final</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Achievement Highlights */}
                        {gameCompletionAchievements.length > 0 && (
                            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-xl p-6 mb-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <span>🏆</span>
                                    <span>Achievements Unlocked!</span>
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {gameCompletionAchievements.map((achievement: UnlockedAchievement) => (
                                        <div key={achievement.code} className="flex items-center gap-3 bg-white rounded-lg p-3 border border-amber-200">
                                            <span className="text-2xl">{achievement.icon || '🏆'}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-gray-900 text-sm">{achievement.name}</p>
                                                <p className="text-xs text-gray-600 truncate">{achievement.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

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

            {/* Profile Customization Prompt - Shows after first game */}
            {showProfilePrompt && (
                <ProfileCustomizationPrompt
                    trigger="first_game"
                    onComplete={() => {
                        setShowProfilePrompt(false)
                        router.push('/game')
                    }}
                />
            )}
        </div>
    )
}
