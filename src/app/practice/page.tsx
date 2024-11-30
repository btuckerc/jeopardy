'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth'
import { getCategories, getQuestion, saveAnswer } from '../actions/practice'
import { checkAnswer } from '../lib/answer-checker'
import { AutocompleteInput } from '../components/AutocompleteInput'

export default function PracticePage() {
    const { user } = useAuth()
    const [categories, setCategories] = useState([])
    const [selectedCategory, setSelectedCategory] = useState('')
    const [selectedDifficulty, setSelectedDifficulty] = useState('ALL')
    const [currentQuestion, setCurrentQuestion] = useState(null)
    const [userAnswer, setUserAnswer] = useState('')
    const [isCorrect, setIsCorrect] = useState(null)
    const [showAnswer, setShowAnswer] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadCategories = async () => {
            try {
                const data = await getCategories(user?.id)
                setCategories(data)
            } catch (error) {
                console.error('Error loading categories:', error)
            } finally {
                setLoading(false)
            }
        }
        loadCategories()
    }, [user?.id])

    const handleCategorySelect = async (categoryId: string) => {
        setSelectedCategory(categoryId)
        await fetchNewQuestion(categoryId)
    }

    const fetchNewQuestion = async (categoryId: string = selectedCategory) => {
        if (!categoryId) return
        try {
            setLoading(true)
            const question = await getQuestion(categoryId, selectedDifficulty, user?.id)
            setCurrentQuestion(question)
            setUserAnswer('')
            setIsCorrect(null)
            setShowAnswer(false)
        } catch (error) {
            console.error('Error fetching question:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmitAnswer = async () => {
        if (!currentQuestion || !userAnswer.trim()) return

        const result = checkAnswer(userAnswer, currentQuestion.answer)
        setIsCorrect(result)
        setShowAnswer(true)

        if (user?.id) {
            await saveAnswer(user.id, currentQuestion.id, selectedCategory, result)
        }
    }

    if (loading) {
        return <div className="text-center p-4">Loading...</div>
    }

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold text-black mb-8">Practice Mode</h1>

            {!currentQuestion ? (
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-black">Select a Category</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {categories.map((category: any) => (
                            <button
                                key={category.id}
                                onClick={() => handleCategorySelect(category.id)}
                                className="p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                {category.name}
                                {category.progress && (
                                    <div className="text-sm mt-2">
                                        Progress: {category.progress[0]?.correct || 0}/{category.progress[0]?.total || 0}
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                    <div className="max-w-2xl mx-auto space-y-6">
                        <div className="bg-white shadow-lg rounded-lg p-6">
                            <h2 className="text-xl font-semibold text-black mb-4">{currentQuestion.category.name}</h2>
                            <p className="text-lg text-black mb-6">{currentQuestion.question}</p>

                            <div className="space-y-4">
                                <AutocompleteInput
                                    value={userAnswer}
                                    onChange={setUserAnswer}
                                    onSubmit={handleSubmitAnswer}
                                    question={currentQuestion.question}
                                    answer={currentQuestion.answer}
                                    disabled={showAnswer}
                                    placeholder="Type your answer..."
                                />

                                {!showAnswer ? (
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
                                ) : (
                                    <div className="space-y-4">
                                            <div className={`p-4 rounded-lg ${isCorrect === null ? 'bg-gray-100' :
                                                    isCorrect ? 'bg-green-100' : 'bg-red-100'
                                                }`}>
                                                <p className="font-medium text-black">
                                                    Correct answer: {currentQuestion.answer}
                                                </p>
                                            </div>
                                            <button
                                            onClick={() => fetchNewQuestion()}
                                            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                                        >
                                            Next Question
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
            )}
        </div>
    )
} 