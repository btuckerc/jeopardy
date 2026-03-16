'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import type { CategoryStudyRecommendation } from '@/lib/study-scheduler'

interface StudyRecommendationsResponse {
    recommendations: CategoryStudyRecommendation[]
    quickSession: {
        categories: string[]
        summary: string
    }
    focusNow: CategoryStudyRecommendation | null
}

function PriorityBadge({ priority }: { priority: 'HIGH' | 'MEDIUM' | 'LOW' }) {
    const styles = {
        HIGH: 'bg-red-100 text-red-800',
        MEDIUM: 'bg-amber-100 text-amber-800',
        LOW: 'bg-blue-100 text-blue-800',
    }

    return (
        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${styles[priority]}`}>
            {priority} Priority
        </span>
    )
}

export default function PracticeRecommendationsPanel() {
    const { user, loading: authLoading } = useAuth()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [recommendations, setRecommendations] = useState<StudyRecommendationsResponse | null>(null)

    useEffect(() => {
        if (!user?.id || authLoading) return

        let cancelled = false

        const loadRecommendations = async () => {
            setLoading(true)
            setError(null)

            try {
                const response = await fetch('/api/stats/recommendations?maxRecommendations=5&maxSessionSize=3', {
                    headers: {
                        'Cache-Control': 'no-store',
                    },
                })

                if (!response.ok) {
                    throw new Error('Failed to load recommendations')
                }

                const data = await response.json() as StudyRecommendationsResponse
                if (!cancelled) {
                    setRecommendations(data)
                }
            } catch (err) {
                if (!cancelled) {
                    setError('Unable to load recommendations right now.')
                    console.error('Error fetching recommendations:', err)
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        loadRecommendations()

        return () => {
            cancelled = true
        }
    }, [user?.id, authLoading])

    if (authLoading || loading) {
        return (
            <div className="w-full rounded-2xl border border-blue-200 bg-gradient-to-r from-white to-blue-50 p-6">
                <div className="animate-pulse h-4 bg-blue-100 rounded w-44 mb-4" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="h-20 rounded-xl bg-blue-100/70" />
                    <div className="h-20 rounded-xl bg-blue-100/70" />
                    <div className="h-20 rounded-xl bg-blue-100/70" />
                </div>
            </div>
        )
    }

    if (error || !recommendations || recommendations.recommendations.length === 0) {
        return null
    }

    const focusedCategory = recommendations.focusNow
    const quickLinks = recommendations.quickSession.categories.slice(0, 3)

    return (
        <section className="rounded-2xl border border-blue-200 bg-gradient-to-r from-white to-blue-50 p-6 shadow-sm">
            <div className="mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Adaptive study plan</h2>
                <p className="mt-1 text-sm text-gray-600">
                    {recommendations.quickSession.summary}
                </p>
            </div>

            {focusedCategory ? (
                <div className="mb-4 rounded-xl border border-blue-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-xs uppercase tracking-wide text-blue-700 font-semibold">
                                Focus now
                            </p>
                            <p className="text-lg font-semibold text-gray-900">
                                {focusedCategory.categoryName}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                                {focusedCategory.reason} ({focusedCategory.accuracy.toFixed(0)}% accuracy)
                            </p>
                        </div>
                        <PriorityBadge priority={focusedCategory.priority} />
                    </div>
                    <div className="mt-4">
                        <Link
                            href={`/practice/category?category=${encodeURIComponent(focusedCategory.categoryId)}&skipSpoilerCheck=1`}
                            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                        >
                            Start focus round
                        </Link>
                    </div>
                </div>
            ) : null}

            {quickLinks.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-3">
                    {recommendations.recommendations
                        .filter(rec => quickLinks.includes(rec.categoryId))
                        .map(rec => (
                            <Link
                                key={rec.categoryId}
                                href={`/practice/category?category=${encodeURIComponent(rec.categoryId)}&skipSpoilerCheck=1`}
                                className="rounded-xl border border-blue-100 bg-white p-4 hover:border-blue-200 hover:shadow-sm transition-all"
                                aria-label={`Open ${rec.categoryName} practice session`}
                            >
                                <div className="text-sm text-blue-700 font-semibold mb-2 line-clamp-2">
                                    {rec.categoryName}
                                </div>
                                <div className="text-xs text-gray-500 mb-3">
                                    {rec.correctAnswers}/{rec.totalQuestions} correct
                                </div>
                                <div className="text-xs text-gray-600">
                                    {rec.accuracy.toFixed(0)}% accuracy
                                </div>
                            </Link>
                        ))}
                </div>
            )}
        </section>
    )
}
