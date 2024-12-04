'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth'
import { createNewGame, getCurrentGame, saveGameHistory } from '../actions/game'
import { checkAnswer } from '../lib/answer-checker'
import toast from 'react-hot-toast'

type GameCategory = {
    id: string
    name: string
    questions: {
        id: string
        question: string
        answer: string
        value: number
        category: string
        difficulty: 'EASY' | 'MEDIUM' | 'HARD'
    }[]
}

export default function GamePage() {
    const { user, loading: authLoading } = useAuth()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [categories, setCategories] = useState<GameCategory[]>([])
    const [gameId, setGameId] = useState<string | null>(null)
    const [selectedQuestion, setSelectedQuestion] = useState<any>(null)
    const [userAnswer, setUserAnswer] = useState('')
    const [showAnswer, setShowAnswer] = useState(false)
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
    const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(new Set())
    const [score, setScore] = useState(0)

    useEffect(() => {
        if (!authLoading) {
            loadGame()
        }
    }, [user, authLoading])

    const loadGame = async () => {
        if (authLoading) return

        if (!user) {
            setError('Please sign in to play')
            setLoading(false)
            return
        }

        try {
            const currentGame = await getCurrentGame(user.id)
            if (currentGame) {
                setGameId(currentGame.gameId)
                setCategories(currentGame.categories)
                // Set answered questions from the loaded game
                const answered = new Set(
                    currentGame.categories
                        .flatMap(cat => cat.questions)
                        .filter(q => answeredQuestions.has(q.id))
                        .map(q => q.id)
                )
                setAnsweredQuestions(answered)
            }
            setError(null)
            setLoading(false)
        } catch (error) {
            console.error('Error loading game:', error)
            setError('Failed to load game')
            setLoading(false)
        }
    }

    const startNewGame = async () => {
        if (!user) {
            setError('Please sign in to play')
            return
        }

        setLoading(true)
        try {
            const { gameId, categories } = await createNewGame(user.id)
            setGameId(gameId)
            setCategories(categories)
            setAnsweredQuestions(new Set())
            setScore(0)
            setError(null)
        } catch (error) {
            console.error('Error starting new game:', error)
            setError('Failed to start new game')
        } finally {
            setLoading(false)
        }
    }

    const handleQuestionSelect = (question: any) => {
        if (answeredQuestions.has(question.id)) return
        setSelectedQuestion(question)
        setUserAnswer('')
        setShowAnswer(false)
        setIsCorrect(null)
    }

    const handleSubmitAnswer = async () => {
        if (!selectedQuestion || !user?.id || !gameId) return

        try {
            const result = checkAnswer(userAnswer, selectedQuestion.answer)
            setIsCorrect(result)
            setShowAnswer(true)

            // Update score if correct
            if (result) {
                setScore(prev => prev + selectedQuestion.value)
            }

            // Save the result
            await saveGameHistory(
                user.id,
                selectedQuestion.id,
                result,
                result ? selectedQuestion.value : 0,
                gameId
            )

            setAnsweredQuestions(prev => new Set([...prev, selectedQuestion.id]))
        } catch (error) {
            console.error('Error processing answer:', error)
            toast.error('Failed to save your answer')
        }
    }

    if (authLoading || loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="text-xl text-black">Loading...</div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="text-center p-4">
                <p className="text-lg text-red-600 mb-4">{error}</p>
                {user && (
                    <button
                        onClick={startNewGame}
                        className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
                    >
                        Try Again
                    </button>
                )}
            </div>
        )
    }

    if (!gameId || categories.length === 0) {
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
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold text-black">Game Board</h1>
                    <button
                        onClick={startNewGame}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold transition-colors"
                    >
                        New Game
                    </button>
                </div>
                <div className="text-xl font-bold text-black">Score: ${score}</div>
            </div>

            <div className="grid grid-cols-5 gap-4 mb-8">
                {categories.map((category) => (
                    <div key={category.id} className="space-y-4">
                        <h2 className="text-center font-bold text-lg text-black h-16 flex items-center justify-center">
                            {category.name}
                        </h2>
                        <div className="space-y-2">
                            {category.questions.map((question) => {
                                const isAnswered = answeredQuestions.has(question.id)
                                return (
                                    <button
                                        key={question.id}
                                        onClick={() => handleQuestionSelect(question)}
                                        disabled={isAnswered}
                                        className={`w-full p-4 ${isAnswered
                                            ? 'bg-gray-500 cursor-not-allowed'
                                                : 'bg-blue-600 hover:bg-blue-700'
                                            } text-white rounded-lg text-xl font-bold transition-colors`}
                                    >
                                        ${question.value}
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
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <h3 className="text-xl font-bold mb-4 text-black">
                            {selectedQuestion.category} - ${selectedQuestion.value}
                        </h3>
                        <p className="text-lg mb-6 text-black">{selectedQuestion.question}</p>

                        {!showAnswer ? (
                            <div className="space-y-4">
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={userAnswer}
                                        onChange={(e) => setUserAnswer(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleSubmitAnswer()
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
                                            {isCorrect !== null && (
                                                <span className={`text-xl ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                                                    {isCorrect ? '✓' : '✗'}
                                                </span>
                                        )}
                                            <p className="font-bold text-black">
                                            Correct answer: {selectedQuestion.answer}
                                        </p>
                                    </div>
                                </div>
                                <button
                                        onClick={() => setSelectedQuestion(null)}
                                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold"
                                >
                                    Continue
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {answeredQuestions.size === categories.reduce((sum, cat) => sum + cat.questions.length, 0) && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg p-8 max-w-md w-full text-center">
                        <h2 className="text-2xl font-bold mb-4 text-black">Game Complete!</h2>
                        <p className="text-lg mb-6 text-black">Final Score: ${score}</p>
                        <button
                            onClick={startNewGame}
                            className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
                        >
                            Start New Game
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
} 