'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

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
    const { user, loading: authLoading } = useAuth()
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(true)
    const supabase = createClientComponentClient()

    useEffect(() => {
        let mounted = true

        const fetchStats = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()

                if (!mounted) return

                if (!session?.user) {
                    setLoading(false)
                    return
                }

                const response = await fetch(`/api/stats?userId=${session.user.id}`)
                if (!response.ok) {
                    console.error('Stats API error:', await response.text())
                    return
                }

                if (!mounted) return

                const data = await response.json()
                setStats(data)
            } catch (error) {
                console.error('Error fetching stats:', error)
            } finally {
                if (mounted) {
                    setLoading(false)
                }
            }
        }

        fetchStats()
        return () => { mounted = false }
    }, [supabase.auth])

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[60vh]">
                <div className="text-xl text-black">Loading statistics...</div>
            </div>
        )
    }

    if (!user) {
        return (
            <div className="text-center p-4">
                <p className="text-lg text-black">Please sign in to view your statistics.</p>
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
                    <p className="text-3xl font-bold text-black">${stats.totalPoints}</p>
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

            <h2 className="text-xl font-semibold mb-4 text-black">Category Breakdown</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.categoryStats.map((category) => (
                    <div key={category.categoryName} className="bg-blue-200 p-4 rounded-lg shadow-md">
                        <h3 className="font-semibold mb-2 text-black">{category.categoryName}</h3>
                        <div className="space-y-2 text-black">
                            <p>Correct: {category.correct}/{category.total}</p>
                            <p>Success Rate: {category.total > 0
                                ? Math.round((category.correct / category.total) * 100)
                                : 0}%</p>
                            <p>Points: ${category.points}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
} 