'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth'
import { checkAnswer } from '../lib/answer-checker'
import { toast } from 'react-hot-toast'
import { getCategories, getQuestion, saveAnswer } from '../actions/practice'
import { AutocompleteInput } from '../components/AutocompleteInput'

type PracticeQuestion = {
    id: string
    question: string
    answer: string
    category: string
    difficulty: 'EASY' | 'MEDIUM' | 'HARD'
}

type Category = {
    id: string
    name: string
    questionCount: number
    userProgress?: {
        correct: number
        total: number
    }
}

export default function PracticePage() {
    const { user } = useAuth()
    const [categories, setCategories] = useState<Category[]>([])
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
    const [currentQuestion, setCurrentQuestion] = useState<PracticeQuestion | null>(null)
    const [userAnswer, setUserAnswer] = useState('')
    const [showAnswer, setShowAnswer] = useState(false)
    const [loading, setLoading] = useState(true)
    const [difficulty, setDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD' | 'ALL'>('ALL')

    useEffect(() => {
        loadCategories()
    }, [user])

    const loadCategories = async () => {
        try {
            const categoriesData = await getCategories(user?.id)
            setCategories(categoriesData.map(cat => ({
                id: cat.id,
                name: cat.name,
                questionCount: cat._count.questions,
                userProgress: cat.progress?.[0]
            })))
            setLoading(false)
        } catch (error) {
            console.error('Error loading categories:', error)
            toast.error('Failed to load categories')
        }
    }

    const loadQuestion = async () => {
        if (!selectedCategory) return

        try {
            const question = await getQuestion(selectedCategory, difficulty, user?.id)

            if (question) {
                setCurrentQuestion({
                    id: question.id,
                    question: question.question,
                    answer: question.answer,
                    category: question.category.name,
                    difficulty: question.difficulty
                })
                setUserAnswer('')
                setShowAnswer(false)
            } else {
                toast.success('You\'ve completed all questions in this category!')
                setCurrentQuestion(null)
            }
        } catch (error) {
            console.error('Error loading question:', error)
            toast.error('Failed to load question')
        }
    }

    const handleAnswerSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!currentQuestion || !user || !selectedCategory) return

        const isCorrect = checkAnswer(userAnswer, currentQuestion.answer)

        try {
            await saveAnswer(user.id, currentQuestion.id, selectedCategory, isCorrect)
            setShowAnswer(true)

            if (isCorrect) {
                toast.success('Correct answer!')
            } else {
                toast.error('Incorrect answer')
            }

            // Refresh categories to update progress
            loadCategories()
        } catch (error) {
            console.error('Error saving answer:', error)
            toast.error('Failed to save answer')
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-xl">Loading categories...</div>
            </div>
        )
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">Practice Mode</h1>

            {/* Category Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {categories.map((category) => (
                    <button
                        key={category.id}
                        onClick={() => {
                            setSelectedCategory(category.id)
                            loadQuestion()
                        }}
                        className={`p-4 rounded-lg shadow transition-colors ${selectedCategory === category.id
                                ? 'bg-blue-600 text-white'
                                : 'bg-white hover:bg-blue-50 text-gray-900'
                            }`}
                    >
                        <h3 className="font-bold text-lg mb-2">{category.name}</h3>
                        <p className="text-sm">
                            {category.questionCount} questions available
                        </p>
                        {category.userProgress && (
                            <div className="mt-2 text-sm">
                                Progress: {category.userProgress.correct}/{category.userProgress.total}
                                ({Math.round((category.userProgress.correct / category.userProgress.total) * 100) || 0}%)
                            </div>
                        )}
                    </button>
                ))}
            </div>

            {/* Difficulty Selection */}
            {selectedCategory && (
                <div className="mb-8">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Select Difficulty</h2>
                    <div className="flex gap-4">
                        {(['ALL', 'EASY', 'MEDIUM', 'HARD'] as const).map((level) => (
                            <button
                                key={level}
                                onClick={() => {
                                    setDifficulty(level)
                                    loadQuestion()
                                }}
                                className={`px-4 py-2 rounded ${difficulty === level
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white hover:bg-blue-50 text-gray-900'
                                    }`}
                            >
                                {level}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Question Display */}
            {currentQuestion && (
                <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl mx-auto">
                    <div className="mb-4">
                        <span className="text-sm font-medium text-gray-500">
                            {currentQuestion.category} - {currentQuestion.difficulty}
                        </span>
                    </div>
                    <div className="text-2xl mb-6 text-gray-900">{currentQuestion.question}</div>

                    <form onSubmit={handleAnswerSubmit} className="space-y-4">
                        <input
                            type="text"
                            value={userAnswer}
                            onChange={(e) => setUserAnswer(e.target.value)}
                            className="w-full p-2 border rounded text-gray-900"
                            placeholder="Your answer..."
                            disabled={showAnswer}
                            autoFocus
                        />
                        <div className="flex justify-end gap-4">
                            <button
                                type="button"
                                onClick={() => setShowAnswer(true)}
                                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                            >
                                Show Answer
                            </button>
                            {!showAnswer && (
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                    Submit
                                </button>
                            )}
                        </div>
                    </form>

                    {showAnswer && (
                        <div className="mt-6">
                            <div className="text-xl mb-4 text-gray-900">
                                Correct Answer: {currentQuestion.answer}
                            </div>
                            <button
                                onClick={loadQuestion}
                                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                                Next Question
                            </button>
                        </div>
                    )}
                </div>
            )}

            {!currentQuestion && selectedCategory && (
                <div className="text-center py-8">
                    <p className="text-xl mb-4 text-gray-900">No more questions available in this category and difficulty level.</p>
                    <button
                        onClick={() => {
                            setSelectedCategory(null)
                            setCurrentQuestion(null)
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Choose Another Category
                    </button>
                </div>
            )}
        </div>
    )
} 