'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth'
import { getGameCategories, saveGameHistory } from '../actions/game'
import { checkAnswer } from '../lib/answer-checker'
import { GameCategory } from '../types/game'

// Type for the stored game state
type StoredGameState = {
    categories: GameCategory[]
    answeredQuestions: string[]
    totalScore: number
    questionResults: Record<string, { correct: boolean, revealed: boolean }>
    timestamp: number
}

export default function GamePage() {
    const { user } = useAuth()
    const [categories, setCategories] = useState<GameCategory[]>([])
    const [selectedQuestion, setSelectedQuestion] = useState<{
        id: string
        question: string
        answer: string
        value: number
        category: string
    } | null>(null)
    const [userAnswer, setUserAnswer] = useState('')
    const [isAnswerRevealed, setIsAnswerRevealed] = useState(false)
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
    const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(new Set())
    const [error, setError] = useState<string | null>(null)
    const [showingAnswer, setShowingAnswer] = useState(false)
    const [totalScore, setTotalScore] = useState(0)
    const [loading, setLoading] = useState(true)
    const [hasActiveGame, setHasActiveGame] = useState(false)
    const [questionResults, setQuestionResults] = useState<Record<string, { correct: boolean, revealed: boolean }>>({})

    // Load game state from local storage
    const loadGameState = () => {
        const storedState = localStorage.getItem('gameState')
        if (storedState) {
            try {
                const state: StoredGameState = JSON.parse(storedState)
                // Check if the stored game is less than 24 hours old
                if (Date.now() - state.timestamp < 24 * 60 * 60 * 1000) {
                    setCategories(state.categories)
                    setAnsweredQuestions(new Set(state.answeredQuestions))
                    setTotalScore(state.totalScore)
                    setQuestionResults(state.questionResults || {})
                    setHasActiveGame(true)
                    return true
                } else {
                    localStorage.removeItem('gameState')
                }
            } catch (error) {
                console.error('Error loading game state:', error)
                localStorage.removeItem('gameState')
            }
        }
        return false
    }

    // Save game state to local storage
    const saveGameState = () => {
        const state: StoredGameState = {
            categories,
            answeredQuestions: Array.from(answeredQuestions),
            totalScore,
            questionResults,
            timestamp: Date.now()
        }
        localStorage.setItem('gameState', JSON.stringify(state))
    }

    const clearGameState = () => {
        setCategories([])
        setAnsweredQuestions(new Set())
        setTotalScore(0)
        setError(null)
        setHasActiveGame(false)
        localStorage.removeItem('gameState')
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const startNewGame = async () => {
        setLoading(true)
        try {
            const data = await getGameCategories()
            const sortedCategories = data.categories.map(category => ({
                ...category,
                questions: [...category.questions].sort((a, b) => a.value - b.value)
            }))
            setCategories(sortedCategories)
            setAnsweredQuestions(new Set())
            setTotalScore(0)
            setError(null)
            setHasActiveGame(true)
            window.scrollTo({ top: 0, behavior: 'smooth' })
        } catch (error) {
            console.error('Error fetching categories:', error)
            setError('Failed to load categories')
        } finally {
            setLoading(false)
        }
    }

    // Initial load
    useEffect(() => {
        const hasExistingGame = loadGameState()
        if (!hasExistingGame) {
            setHasActiveGame(false)
        }
        setLoading(false)
    }, [])

    // Save game state whenever it changes
    useEffect(() => {
        if (hasActiveGame) {
            saveGameState()
        }
    }, [categories, answeredQuestions, totalScore, hasActiveGame])

    const handleQuestionClick = (question: any) => {
        setSelectedQuestion(question)
        setUserAnswer('')
        setIsAnswerRevealed(false)
        setIsCorrect(null)
        setError(null)
        setShowingAnswer(false)
    }

    const handleShowAnswer = () => {
        if (!selectedQuestion || !user?.id) return
        setShowingAnswer(true)
        setIsAnswerRevealed(true)
        setIsCorrect(null)

        // Update question results
        setQuestionResults(prev => ({
            ...prev,
            [selectedQuestion.id]: { correct: false, revealed: true }
        }))

        // Save to game history
        if (user?.id) {
            saveGameHistory(user.id, selectedQuestion.id, false, 0).catch(console.error)
        }
    }

    const handleSubmitAnswer = async () => {
        if (!selectedQuestion || !user?.id) {
            setError('You must be signed in to submit answers')
            return
        }

        try {
            const result = checkAnswer(userAnswer, selectedQuestion.answer)

            // Show the result immediately
            setIsCorrect(result)
            setIsAnswerRevealed(true)

            // Update score if correct
            if (result) {
                setTotalScore(prev => prev + selectedQuestion.value)
            }

            // Update question results
            setQuestionResults(prev => ({
                ...prev,
                [selectedQuestion.id]: { correct: result, revealed: true }
            }))

            // Save the result
            const saveResult = await saveGameHistory(
                user.id,
                selectedQuestion.id,
                result,
                result ? selectedQuestion.value : 0
            )

            if (saveResult.success) {
                setAnsweredQuestions(prev => new Set([...prev, selectedQuestion.id]))
            } else {
                console.error('Failed to save game history')
            }
        } catch (error) {
            console.error('Error processing answer:', error)
            setError('Failed to save your answer. Please try again.')
        }
    }

    const handleContinue = () => {
        setSelectedQuestion(null)
        // Check if all questions are answered
        const totalQuestions = categories.reduce((sum, cat) => sum + cat.questions.length, 0)
        if (answeredQuestions.size === totalQuestions) {
            // Show game completion message or automatically start new game
            startNewGame()
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="text-xl">Loading...</div>
            </div>
        )
    }

    if (!hasActiveGame) {
        return (
            <div className="container mx-auto p-4">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-black mb-8">Welcome to Jeopardy!</h1>
                    <button
                        onClick={startNewGame}
                        className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
                    >
                        Start New Game
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="container mx-auto p-4">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold text-black">Jeopardy Game</h1>
                <div className="flex items-center gap-4">
                    <div className="text-xl font-semibold text-black">Score: ${totalScore}</div>
                    <button
                        onClick={clearGameState}
                        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors"
                    >
                        New Game
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
                {categories.map((category) => (
                    <div key={category.id} className="text-center">
                        <h2 className="font-bold mb-2 text-black">{category.name}</h2>
                        <div className="space-y-2">
                            {category.questions.map((question) => {
                                const result = questionResults[question.id]
                                const isAnswered = result?.revealed
                                const isCorrect = result?.correct

                                return (
                                    <button
                                        key={question.id}
                                        onClick={() => handleQuestionClick(question)}
                                        className={`w-full p-2 ${isAnswered
                                                ? isCorrect
                                                    ? 'bg-green-600 hover:bg-green-700'
                                                    : 'bg-red-600 hover:bg-red-700'
                                                : 'bg-blue-600 hover:bg-blue-700'
                                            } text-white rounded relative`}
                                    >
                                        ${question.value}
                                        {isAnswered && (
                                            <span className="absolute top-1 right-1 text-xs">
                                                {isCorrect ? '✓' : '✗'}
                                            </span>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {selectedQuestion && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg p-8 max-w-2xl w-full relative">
                        <button
                            onClick={() => setSelectedQuestion(null)}
                            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
                            aria-label="Close"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <h3 className="text-xl font-bold mb-4 text-black">
                            {selectedQuestion.category} - ${selectedQuestion.value}
                        </h3>
                        <p className="text-lg mb-4 text-black">{selectedQuestion.question}</p>

                        {!isAnswerRevealed ? (
                            <div className="space-y-4">
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-gray-600">What is...</span>
                                    <input
                                        type="text"
                                        value={userAnswer}
                                        onChange={(e) => setUserAnswer(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleSubmitAnswer();
                                            }
                                        }}
                                        className="w-full p-2 pl-24 border rounded text-black"
                                        placeholder="your answer..."
                                    />
                                </div>
                                <div className="flex justify-between">
                                    <button
                                        onClick={handleSubmitAnswer}
                                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                                    >
                                        Submit
                                    </button>
                                    <button
                                        onClick={handleShowAnswer}
                                        className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                                    >
                                        Show Answer
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                    <div className={`p-4 rounded-lg ${showingAnswer ? 'bg-gray-100' :
                                    isCorrect ? 'bg-green-100' : 'bg-red-100'
                                        }`}>
                                    <div className="flex items-center gap-2">
                                        {!showingAnswer && isCorrect === true && (
                                            <span className="text-green-600 text-xl">✓</span>
                                        )}
                                        {!showingAnswer && isCorrect === false && (
                                            <span className="text-red-600 text-xl">✗</span>
                                        )}
                                        <p className="font-medium text-black">
                                            Correct answer: {selectedQuestion.answer}
                                        </p>
                                    </div>
                                </div>
                                <button
                                        onClick={handleContinue}
                                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                                >
                                    Continue
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
} 