'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../lib/auth'
import { prisma } from '../lib/prisma'

type UserStats = {
    totalPoints: number
    totalQuestions: number
    correctAnswers: number
    categoryStats: {
        categoryName: string
        correct: number
        total: number
        points: number
    }[]
}

export default function StatsPage() {
    const { user } = useAuth()
    const [stats, setStats] = useState<UserStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function fetchStats() {
            if (!user?.id) return

            try {
                const response = await fetch(`/api/stats?userId=${user.id}`)
                if (!response.ok) throw new Error('Failed to fetch stats')

                const data = await response.json()
                setStats(data)
            } catch (error) {
                console.error('Error fetching stats:', error)
                setError('Failed to load statistics')
            } finally {
                setLoading(false)
            }
        }

        fetchStats()
    }, [user?.id])

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-xl">Loading statistics...</div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="container mx-auto p-4">
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    {error}
                </div>
            </div>
        )
    }

    if (!stats) {
        return (
            <div className="container mx-auto p-4">
                <div className="text-center">No statistics available.</div>
            </div>
        )
    }

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-6">Your Statistics</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-blue-100 p-6 rounded-lg">
                    <h2 className="text-lg font-semibold mb-2">Total Points</h2>
                    <p className="text-3xl font-bold">${stats.totalPoints}</p>
                </div>
                <div className="bg-green-100 p-6 rounded-lg">
                    <h2 className="text-lg font-semibold mb-2">Success Rate</h2>
                    <p className="text-3xl font-bold">
                        {Math.round((stats.correctAnswers / stats.totalQuestions) * 100) || 0}%
                    </p>
                </div>
                <div className="bg-purple-100 p-6 rounded-lg">
                    <h2 className="text-lg font-semibold mb-2">Questions Answered</h2>
                    <p className="text-3xl font-bold">{stats.totalQuestions}</p>
                </div>
            </div>

            <h2 className="text-xl font-bold mb-4">Category Breakdown</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stats.categoryStats.map((cat) => (
                    <div key={cat.categoryName} className="bg-white p-6 rounded-lg shadow">
                        <h3 className="text-lg font-semibold mb-2">{cat.categoryName}</h3>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span>Success Rate:</span>
                                <span className="font-medium">
                                    {Math.round((cat.correct / cat.total) * 100) || 0}%
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>Questions:</span>
                                <span className="font-medium">{cat.correct}/{cat.total}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Points:</span>
                                <span className="font-medium">${cat.points}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                                <div
                                    className="bg-blue-600 h-2.5 rounded-full"
                                    style={{ width: `${(cat.correct / cat.total) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
} 