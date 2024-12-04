'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'

type Question = {
    id: string
    question: string | null
    answer: string | null
    value: number
    airDate: string | null
    correct: boolean
}

type CategoryStats = {
    categoryName: string
    correct: number
    total: number
    points: number
    mostRecentAirDate?: string | null
    questions?: Question[]
}

type Stats = {
    totalPoints: number
    totalQuestions: number
    totalAnswered: number
    correctAnswers: number
    tripleStumpersAnswered: number
    categoryStats: CategoryStats[]
}

function CategoryModal({ category, onClose, onPractice }: {
    category: CategoryStats
    onClose: () => void
    onPractice: () => void
}) {
    const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({})
    const isComplete = category.correct === category.total

    const toggleAnswer = (questionId: string) => {
        setRevealedAnswers(prev => ({
            ...prev,
            [questionId]: !prev[questionId]
        }))
    }

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'No air date'
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
    }

    if (!category.questions) return null

    // Get the air date from the first question
    const categoryAirDate = category.questions[0]?.airDate

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                <div className="p-6 border-b">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-bold text-black">{category.categoryName}</h2>
                            <p className="text-sm text-gray-500 mt-1">{formatDate(categoryAirDate)}</p>
                        </div>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <p className="text-gray-600 mt-2">
                        {category.correct} / {category.total} correct ({Math.round((category.correct / category.total) * 100)}%)
                    </p>
                </div>

                <div className="overflow-y-auto flex-1 p-6">
                    <div className="space-y-4">
                        {category.questions.map(question => (
                            <div
                                key={question.id}
                                className={`border rounded-lg p-4 ${question.correct ? 'bg-green-50' : 'bg-gray-50'
                                    }`}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-lg ${question.correct ? 'text-green-600' : 'text-gray-400'}`}>
                                        {question.correct ? '✓' : '○'}
                                    </span>
                                    <span className="font-medium">${question.value}</span>
                                </div>
                                {question.correct ? (
                                    <>
                                        <p className="text-gray-900 mb-2">{question.question}</p>
                                        <button
                                            onClick={() => toggleAnswer(question.id)}
                                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                        >
                                            {revealedAnswers[question.id] ? 'Hide Answer' : 'Show Answer'}
                                        </button>
                                        {revealedAnswers[question.id] && (
                                            <p className="mt-2 text-gray-700 italic">{question.answer}</p>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-gray-500 italic">Question not yet answered correctly</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-6 border-t">
                    <button
                        onClick={onPractice}
                        className={`w-full py-2 px-4 rounded-lg transition-colors font-bold text-white ${isComplete ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                    >
                        {isComplete ? 'More Like This' : 'Practice Remaining Questions'}
                    </button>
                </div>
            </div>
        </div>
    )
}

function InfoTooltip({ content }: { content: string }) {
    const [isVisible, setIsVisible] = useState(false)

    return (
        <div className="relative inline-block">
            <button
                className="ml-2 text-gray-500 hover:text-gray-700 focus:outline-none"
                onClick={() => setIsVisible(!isVisible)}
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
            >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
            </button>
            {isVisible && (
                <div className="absolute z-10 w-64 px-4 py-2 text-sm text-gray-500 bg-white border rounded-lg shadow-lg bottom-full left-1/2 transform -translate-x-1/2 -translate-y-2">
                    {content}
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-white border-r border-b"></div>
                </div>
            )}
        </div>
    )
}

export default function StatsPage() {
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedCategory, setSelectedCategory] = useState<CategoryStats | null>(null)
    const [showUnstarted, setShowUnstarted] = useState(false)
    const supabase = createClientComponentClient()
    const router = useRouter()

    useEffect(() => {
        let mounted = true

        const fetchStats = async () => {
            try {
                const { data: { session }, error: authError } = await supabase.auth.getSession()

                if (authError) throw authError

                if (!session?.user) {
                    if (mounted) {
                        setLoading(false)
                        setError('Please sign in to view your statistics.')
                    }
                    return
                }

                const response = await fetch(`/api/stats?userId=${session.user.id}`)
                if (!response.ok) {
                    throw new Error(await response.text())
                }

                const data = await response.json()
                if (mounted) {
                    setStats(data)
                    setError(null)
                }
            } catch (err) {
                console.error('Error fetching stats:', err)
                if (mounted) {
                    setError(err instanceof Error ? err.message : 'An error occurred')
                }
            } finally {
                if (mounted) {
                    setLoading(false)
                }
            }
        }

        fetchStats()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
            fetchStats()
        })

        return () => {
            mounted = false
            subscription.unsubscribe()
        }
    }, [supabase, router])

    const handleCategoryClick = async (category: CategoryStats) => {
        try {
            const response = await fetch(`/api/stats/category?name=${encodeURIComponent(category.categoryName)}`)
            if (!response.ok) throw new Error('Failed to fetch category details')

            const data = await response.json()
            setSelectedCategory({
                ...category,
                questions: data.questions,
                total: data.totalQuestions,
                correct: data.correctQuestions
            })
        } catch (error) {
            console.error('Error fetching category details:', error)
        }
    }

    const handlePracticeCategory = async (categoryName: string, isComplete: boolean) => {
        try {
            // First, get the knowledge category for this category
            const response = await fetch(`/api/stats/category/knowledge?name=${encodeURIComponent(categoryName)}`)
            if (!response.ok) throw new Error('Failed to fetch category knowledge details')

            const { knowledgeCategory, categoryId } = await response.json()

            // If category is complete, go to the categories list within that knowledge category
            if (isComplete) {
                router.push(`/practice?knowledgeCategory=${encodeURIComponent(knowledgeCategory)}`)
            } else {
                // If incomplete, go to the questions list for this specific category
                router.push(`/practice?knowledgeCategory=${encodeURIComponent(knowledgeCategory)}&category=${encodeURIComponent(categoryId)}`)
            }
        } catch (error) {
            console.error('Error navigating to practice category:', error)
            // Fallback to simple navigation if there's an error
            router.push('/practice')
        }
    }

    // Split and sort categories
    const categorizeAndSortStats = (categoryStats: CategoryStats[]) => {
        const inProgress = []
        const notStarted = []

        for (const category of categoryStats) {
            if (category.correct > 0) {
                inProgress.push(category)
            } else {
                notStarted.push(category)
            }
        }

        // Sort in progress categories by completion percentage ascending (least complete first)
        // then by most recent air date
        inProgress.sort((a, b) => {
            const aCompletion = a.correct / a.total
            const bCompletion = b.correct / b.total
            if (aCompletion !== bCompletion) {
                return aCompletion - bCompletion // Ascending by completion
            }
            // If completion % is the same, sort by air date descending
            const aDate = a.mostRecentAirDate ? new Date(a.mostRecentAirDate) : new Date(0)
            const bDate = b.mostRecentAirDate ? new Date(b.mostRecentAirDate) : new Date(0)
            return bDate.getTime() - aDate.getTime()
        })

        // Sort not started categories by air date
        notStarted.sort((a, b) => {
            const aDate = a.mostRecentAirDate ? new Date(a.mostRecentAirDate) : new Date(0)
            const bDate = b.mostRecentAirDate ? new Date(b.mostRecentAirDate) : new Date(0)
            return bDate.getTime() - aDate.getTime()
        })

        return { inProgress, notStarted }
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[60vh]">
                <div className="text-xl text-black">Loading statistics...</div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="text-center p-4">
                <p className="text-lg text-black">{error}</p>
            </div>
        )
    }

    if (!stats) {
        return (
            <div className="text-center p-4">
                <p className="text-lg text-black">No statistics available yet. Start playing to see your progress!</p>
            </div>
        )
    }

    const { inProgress, notStarted } = categorizeAndSortStats(stats.categoryStats)

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-8 text-black">Your Statistics</h1>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                <div className="bg-blue-200 p-6 rounded-lg shadow-md">
                    <h2 className="text-lg font-semibold mb-2 text-black">Total Points</h2>
                    <p className="text-3xl font-bold text-black">${stats.totalPoints.toLocaleString()}</p>
                </div>
                <div className="bg-blue-200 p-6 rounded-lg shadow-md">
                    <h2 className="text-lg font-semibold mb-2 text-black">Questions Attempted</h2>
                    <p className="text-3xl font-bold text-black">
                        {stats.totalAnswered.toLocaleString()} / {stats.totalQuestions.toLocaleString()}
                    </p>
                </div>
                <div className="bg-blue-200 p-6 rounded-lg shadow-md">
                    <h2 className="text-lg font-semibold mb-2 text-black">Correct Answers</h2>
                    <p className="text-3xl font-bold text-black">
                        {stats.correctAnswers.toLocaleString()} ({stats.totalAnswered > 0
                            ? Math.round((stats.correctAnswers / stats.totalAnswered) * 100)
                            : 0}%)
                    </p>
                </div>
                <div className="bg-yellow-200 p-6 rounded-lg shadow-md lg:col-start-2 lg:col-end-3 xl:col-auto">
                    <div className="flex items-center">
                        <h2 className="text-lg font-semibold mb-2 text-black">Triple Stumpers Answered</h2>
                        <InfoTooltip content="Triple Stumpers are questions that none of the original Jeopardy! contestants answered correctly. Getting these right is extra impressive!" />
                    </div>
                    <p className="text-3xl font-bold text-black">{stats.tripleStumpersAnswered.toLocaleString()}</p>
                </div>
            </div>

            {(inProgress.length > 0 || (showUnstarted && notStarted.length > 0)) && (
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-black">Category Breakdown</h2>
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-600">Show Unstarted Categories</label>
                            <button
                                onClick={() => setShowUnstarted(!showUnstarted)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${showUnstarted ? 'bg-blue-600' : 'bg-gray-200'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showUnstarted ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                            </button>
                        </div>
                    </div>

                    {inProgress.length > 0 && (
                        <>
                            <h3 className="text-lg font-medium text-gray-700 mb-3">In Progress</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                                {inProgress.map((category) => (
                                    <button
                                        key={category.categoryName}
                                        onClick={() => handleCategoryClick(category)}
                                        className="bg-white p-4 rounded-lg shadow hover:shadow-lg transition-shadow text-left"
                                    >
                                        <h3 className="font-semibold text-black">{category.categoryName}</h3>
                                        <p className="text-gray-600">
                                            {category.correct.toLocaleString()} / {category.total.toLocaleString()} correct ({
                                                Math.round((category.correct / category.total) * 100)
                                            }%)
                                        </p>
                                        <p className="text-gray-600">Points: ${category.points.toLocaleString()}</p>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {showUnstarted && notStarted.length > 0 && (
                        <>
                            <h3 className="text-lg font-medium text-gray-700 mb-3">Not Started</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {notStarted.map((category) => (
                                    <button
                                        key={category.categoryName}
                                        onClick={() => handleCategoryClick(category)}
                                        className="bg-gray-50 p-4 rounded-lg shadow hover:shadow-lg transition-shadow text-left"
                                    >
                                        <h3 className="font-semibold text-black">{category.categoryName}</h3>
                                        <p className="text-gray-600">
                                            0 / {category.total.toLocaleString()} questions
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {selectedCategory && (
                <CategoryModal
                    category={selectedCategory}
                    onClose={() => setSelectedCategory(null)}
                    onPractice={() => handlePracticeCategory(selectedCategory.categoryName, selectedCategory.correct === selectedCategory.total)}
                />
            )}
        </div>
    )
} 