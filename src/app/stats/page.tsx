'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'

type CategoryStats = {
    categoryName: string
    correct: number
    total: number
    points: number
}

type Stats = {
    totalPoints: number
    totalQuestions: number
    correctAnswers: number
    categoryStats: CategoryStats[]
}

export default function StatsPage() {
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
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

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-8 text-black">Your Statistics</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-blue-200 p-6 rounded-lg shadow-md">
                    <h2 className="text-lg font-semibold mb-2 text-black">Total Points</h2>
                    <p className="text-3xl font-bold text-black">{stats.totalPoints}</p>
                </div>
                <div className="bg-blue-200 p-6 rounded-lg shadow-md">
                    <h2 className="text-lg font-semibold mb-2 text-black">Questions Answered</h2>
                    <p className="text-3xl font-bold text-black">{stats.totalQuestions}</p>
                </div>
                <div className="bg-blue-200 p-6 rounded-lg shadow-md">
                    <h2 className="text-lg font-semibold mb-2 text-black">Correct Answers</h2>
                    <p className="text-3xl font-bold text-black">
                        {stats.correctAnswers} ({stats.totalQuestions > 0
                            ? Math.round((stats.correctAnswers / stats.totalQuestions) * 100)
                            : 0}%)
                    </p>
                </div>
            </div>

            {stats.categoryStats.length > 0 && (
                <div>
                    <h2 className="text-xl font-semibold mb-4 text-black">Category Breakdown</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {stats.categoryStats.map((category) => (
                            <div key={category.categoryName} className="bg-white p-4 rounded-lg shadow">
                                <h3 className="font-semibold text-black">{category.categoryName}</h3>
                                <p className="text-gray-600">
                                    {category.correct} / {category.total} correct ({category.total > 0
                                        ? Math.round((category.correct / category.total) * 100)
                                        : 0}%)
                                </p>
                                <p className="text-gray-600">Points: {category.points}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
} 