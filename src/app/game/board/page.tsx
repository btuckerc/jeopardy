'use client'

import { useState, useEffect } from 'react'
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
    questions: Question[]
}

export default function GameBoard() {
    const router = useRouter()
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [categories, setCategories] = useState<Category[]>([])
    const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
    const [userAnswer, setUserAnswer] = useState('')
    const [showAnswer, setShowAnswer] = useState(false)
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
    const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(new Set())
    const [score, setScore] = useState(0)
    const [isDoubleJeopardy, setIsDoubleJeopardy] = useState(false)
    const [gameConfig, setGameConfig] = useState<any>(null)

    useEffect(() => {
        const storedConfig = localStorage.getItem('gameConfig')
        if (!storedConfig) {
            router.push('/game')
            return
        }

        try {
            const config = JSON.parse(storedConfig)
            setGameConfig(config)
            loadCategories(false, config) // Start with regular jeopardy
        } catch (error) {
            console.error('Error parsing game config:', error)
            setError('Invalid game configuration')
        }
    }, [])

    const loadCategories = async (isDouble: boolean, config: any) => {
        if (!config) return

        setLoading(true)
        try {
            const params = new URLSearchParams()
            params.append('isDouble', isDouble.toString())
            params.append('mode', config.mode)

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

            setCategories(data)
            setIsDoubleJeopardy(isDouble)
            setError(null)
        } catch (error) {
            console.error('Error loading categories:', error)
            setError(error instanceof Error ? error.message : 'Failed to load categories')
        } finally {
            setLoading(false)
        }
    }

    const handleQuestionSelect = (question: Question) => {
        if (answeredQuestions.has(question.id)) return
        setSelectedQuestion(question)
        setUserAnswer('')
        setShowAnswer(false)
        setIsCorrect(null)
    }

    const handleSubmitAnswer = async () => {
        if (!selectedQuestion) return

        const result = checkAnswer(userAnswer, selectedQuestion.answer)
        setIsCorrect(result)
        setShowAnswer(true)

        // Update score
        const points = selectedQuestion.value * (isDoubleJeopardy ? 2 : 1)
        if (result) {
            setScore(prev => prev + points)
        }

        setAnsweredQuestions(prev => new Set([...prev, selectedQuestion.id]))

        // Save game history if user is logged in
        if (user) {
            try {
                await fetch('/api/game/history', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: user.id,
                        questionId: selectedQuestion.id,
                        isCorrect: result,
                        pointsEarned: result ? points : 0
                    })
                })
            } catch (error) {
                console.error('Error saving game history:', error)
            }
        }
    }

    const handleRoundComplete = () => {
        if (!isDoubleJeopardy) {
            // Move to Double Jeopardy round
            loadCategories(true, gameConfig)
            setAnsweredQuestions(new Set())
        } else {
            // Game complete
            router.push('/game')
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="text-xl">Loading...</div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="text-center p-4">
                <p className="text-lg text-red-600 mb-4">{error}</p>
                <button
                    onClick={() => router.push('/game')}
                    className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700"
                >
                    Back to Game Selection
                </button>
            </div>
        )
    }

    const isRoundComplete = categories.every(category =>
        category.questions.every(question => answeredQuestions.has(question.id))
    )

    return (
        <div className="container mx-auto p-4">
            <div className="flex justify-between items-center mb-6">
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

            <div className="grid grid-cols-5 gap-4 mb-8">
                {categories.map((category) => (
                    <div key={category.id} className="space-y-4">
                        <h2 className="text-center font-bold text-lg h-16 flex items-center justify-center text-gray-900 px-2">
                            {category.name}
                        </h2>
                        <div className="space-y-2">
                            {category.questions.map((question) => {
                                const isAnswered = answeredQuestions.has(question.id)
                                const displayValue = question.value * (isDoubleJeopardy ? 2 : 1)
                                return (
                                    <button
                                        key={question.id}
                                        onClick={() => handleQuestionSelect(question)}
                                        disabled={isAnswered}
                                        className={`w-full p-4 ${isAnswered ? 'bg-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                                            } text-white rounded-lg text-xl font-bold`}
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
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg p-8 max-w-2xl w-full relative">
                        <button
                            onClick={() => setSelectedQuestion(null)}
                            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
                        >
                            ×
                        </button>

                        <h3 className="text-xl font-bold mb-4">
                            ${selectedQuestion.value * (isDoubleJeopardy ? 2 : 1)}
                        </h3>
                        <p className="text-lg mb-6">{selectedQuestion.question}</p>

                        {!showAnswer ? (
                            <div className="space-y-4">
                                <input
                                    type="text"
                                    value={userAnswer}
                                    onChange={(e) => setUserAnswer(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleSubmitAnswer()
                                        }
                                    }}
                                    className="w-full p-3 border rounded-lg"
                                    placeholder="What is..."
                                />
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
                                    <p className="font-bold">
                                        {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
                                    </p>
                                    <p>Correct answer: {selectedQuestion.answer}</p>
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

            {isRoundComplete && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg p-8 max-w-md w-full text-center">
                        <h2 className="text-2xl font-bold mb-4">
                            {isDoubleJeopardy ? 'Game Complete!' : 'Round Complete!'}
                        </h2>
                        <p className="text-lg mb-6">Current Score: ${score}</p>
                        <button
                            onClick={handleRoundComplete}
                            className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700"
                        >
                            {isDoubleJeopardy ? 'End Game' : 'Start Double Jeopardy'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
} 