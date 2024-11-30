'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth'
import { getCategories, getQuestion, saveAnswer } from '../actions/practice'
import { checkAnswer } from '../lib/answer-checker'
import { AutocompleteInput } from '../components/AutocompleteInput'

type Question = {
    id: string
    question: string
    answer: string
    value: number
    categoryName: string
    originalCategory: string
}

type CategoryQuestions = {
    id: string
    name: string
    questions: Question[]
}

export default function FreePractice() {
    const { user } = useAuth()
    const [categories, setCategories] = useState<CategoryQuestions[]>([])
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
    const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
    const [userAnswer, setUserAnswer] = useState('')
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
    const [showAnswer, setShowAnswer] = useState(false)
    const [loading, setLoading] = useState(true)
    const [answeredQuestions, setAnsweredQuestions] = useState<Record<string, boolean>>({})

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

    useEffect(() => {
        // Load answered questions from localStorage
        const savedAnswers = localStorage.getItem('answeredQuestions')
        if (savedAnswers) {
            setAnsweredQuestions(JSON.parse(savedAnswers))
        }
    }, [])

    const handleCategorySelect = (categoryId: string) => {
        setSelectedCategory(categoryId)
        setSelectedQuestion(null)
        setShowAnswer(false)
        setIsCorrect(null)
    }

    const handleQuestionSelect = (question: Question) => {
        setSelectedQuestion(question)
        setUserAnswer('')
        setShowAnswer(false)
        setIsCorrect(null)
    }

    const handleGlobalShuffle = () => {
        if (!categories.length) return

        // Flatten all questions from all categories
        const allQuestions = categories.flatMap(category => category.questions)

        // Filter for unanswered questions first
        const unansweredQuestions = allQuestions.filter(q => !answeredQuestions[q.id])

        // Choose from unanswered questions if available, otherwise from all questions
        const questionPool = unansweredQuestions.length > 0 ? unansweredQuestions : allQuestions
        const randomIndex = Math.floor(Math.random() * questionPool.length)
        const selectedQuestion = questionPool[randomIndex]

        // Find the category this question belongs to
        const category = categories.find(c =>
            c.questions.some(q => q.id === selectedQuestion.id)
        )

        if (category) {
            setSelectedCategory(category.id)
            setSelectedQuestion(selectedQuestion)
            setUserAnswer('')
            setShowAnswer(false)
            setIsCorrect(null)
        }
    }

    const handleSubmitAnswer = async () => {
        if (!selectedQuestion || !userAnswer.trim()) return

        const result = checkAnswer(userAnswer, selectedQuestion.answer)
        setIsCorrect(result)
        setShowAnswer(true)

        if (result) {
            // Update answered questions in state and localStorage
            const newAnsweredQuestions = { ...answeredQuestions, [selectedQuestion.id]: true }
            setAnsweredQuestions(newAnsweredQuestions)
            localStorage.setItem('answeredQuestions', JSON.stringify(newAnsweredQuestions))
        }

        if (user?.id) {
            await saveAnswer(user.id, selectedQuestion.id, selectedCategory!, result)
        }
    }

    if (loading) {
        return <div className="text-center p-4">Loading...</div>
    }

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold text-black mb-8">Free Play Mode</h1>

            {!selectedCategory ? (
                <div className="space-y-8">
                    <div className="text-center">
                        <button
                            onClick={handleGlobalShuffle}
                            className="bg-purple-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-purple-700 transition-colors mb-8"
                        >
                            Shuffle Random Question from Any Category
                        </button>
                    </div>

                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold text-black">Or Select a Category</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {categories.map((category) => (
                                <button
                                    key={category.id}
                                    onClick={() => handleCategorySelect(category.id)}
                                    className="p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    {category.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            ) : !selectedQuestion ? (
                <div className="space-y-4">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold text-black">
                            {categories.find(c => c.id === selectedCategory)?.name}
                        </h2>
                        <button
                            onClick={() => setSelectedCategory(null)}
                            className="text-blue-600 hover:text-blue-800"
                        >
                            ← Back to Categories
                        </button>
                    </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {categories
                                .find(c => c.id === selectedCategory)
                                ?.questions.map((question) => (
                                    <button
                                        key={question.id}
                                        onClick={() => handleQuestionSelect(question)}
                                        className={`p-4 rounded-lg transition-colors ${answeredQuestions[question.id]
                                            ? 'bg-green-600 hover:bg-green-700'
                                            : 'bg-blue-600 hover:bg-blue-700'
                                            } text-white`}
                                    >
                                        {question.originalCategory} for ${question.value}
                                    </button>
                                ))}
                    </div>
                        <div className="mt-6 text-center">
                            <button
                                onClick={handleGlobalShuffle}
                                className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors"
                            >
                                Shuffle Random Question
                            </button>
                        </div>
                </div>
            ) : (
                        <div className="max-w-2xl mx-auto space-y-6">
                            <div className="bg-white shadow-lg rounded-lg p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-xl font-semibold text-black">
                                        {selectedQuestion.originalCategory} - ${selectedQuestion.value}
                                    </h2>
                                    <button
                                        onClick={() => setSelectedQuestion(null)}
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
                                            <div className={`p-4 rounded-lg ${isCorrect === null ? 'bg-gray-100' :
                                                isCorrect ? 'bg-green-100' : 'bg-red-100'
                                                }`}>
                                                <p className="font-medium text-black">
                                                        Correct answer: {selectedQuestion.answer}
                                                    </p>
                                                </div>
                                                <div className="flex space-x-4">
                                                    <button
                                                        onClick={handleGlobalShuffle}
                                                        className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
                                                    >
                                                        Next Random Question
                                                    </button>
                                                    <button
                                                        onClick={() => setSelectedQuestion(null)}
                                            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                                        >
                                                        Back to Questions
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