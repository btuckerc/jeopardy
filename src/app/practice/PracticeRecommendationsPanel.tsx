'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import type {
    CategoryStudyRecommendation,
    MixedReviewSuggestion,
    QuickSessionItem,
} from '@/lib/study-scheduler'

interface StudyRecommendationsResponse {
    recommendations: CategoryStudyRecommendation[]
    quickSession: {
        categories: string[]
        items: QuickSessionItem[]
        summary: string
        totalTargetQuestions: number
        mixedReview: MixedReviewSuggestion | null
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
            {priority} priority
        </span>
    )
}

function buildRecommendationHref(categoryId: string, knowledgeCategoryId: string | null, options?: { mix?: boolean }) {
    const params = new URLSearchParams({
        category: categoryId,
        skipSpoilerCheck: '1',
    })

    if (knowledgeCategoryId) {
        params.set('knowledgeCategory', knowledgeCategoryId)
    }

    if (options?.mix && knowledgeCategoryId) {
        params.delete('category')
        params.set('mix', '1')
    }

    return `/practice/category?${params.toString()}`
}

function formatReviewTiming(recommendation: CategoryStudyRecommendation) {
    if (recommendation.isDue) {
        if (recommendation.daysSinceReview === null) {
            return 'New category for your study plan'
        }

        return recommendation.daysSinceReview === 0
            ? 'Reviewed today but still needs reinforcement'
            : `Last studied ${recommendation.daysSinceReview} day${recommendation.daysSinceReview === 1 ? '' : 's'} ago`
    }

    return `Due again in ${recommendation.dueInDays} day${recommendation.dueInDays === 1 ? '' : 's'}`
}

function FocusMetric({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">{label}</div>
            <div className="mt-1 text-sm font-semibold text-gray-900">{value}</div>
        </div>
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
            <div className="w-full rounded-3xl border border-blue-200 bg-gradient-to-r from-white via-blue-50 to-white p-6 shadow-sm">
                <div className="animate-pulse h-4 w-44 rounded bg-blue-100 mb-4" />
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
                    <div className="h-40 rounded-2xl bg-blue-100/70" />
                    <div className="h-40 rounded-2xl bg-blue-100/70" />
                </div>
            </div>
        )
    }

    if (error || !recommendations || recommendations.recommendations.length === 0) {
        return null
    }

    const focusedCategory = recommendations.focusNow
    const quickSessionItems = recommendations.quickSession.items
    const mixedReview = recommendations.quickSession.mixedReview

    return (
        <section className="rounded-3xl border border-blue-200 bg-gradient-to-r from-white via-blue-50 to-white p-6 shadow-sm sm:p-7">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Adaptive study plan</h2>
                    <p className="mt-1 max-w-3xl text-sm text-gray-600">
                        This plan favors weak or overdue categories first, then gives you a short follow-up sequence so you can review without losing momentum.
                    </p>
                </div>
                <div className="inline-flex rounded-full border border-blue-200 bg-white/90 px-4 py-2 text-sm font-semibold text-blue-800 shadow-sm">
                    {recommendations.quickSession.summary}
                </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.55fr_1fr]">
                {focusedCategory ? (
                    <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                                        Focus now
                                    </p>
                                    <h3 className="mt-2 text-2xl font-bold text-gray-900">
                                        {focusedCategory.categoryName}
                                    </h3>
                                    <p className="mt-2 max-w-2xl text-sm text-gray-600">
                                        {focusedCategory.reason}
                                    </p>
                                </div>
                                <PriorityBadge priority={focusedCategory.priority} />
                            </div>

                            <div className="grid gap-3 sm:grid-cols-3">
                                <FocusMetric label="Action" value={`${focusedCategory.actionLabel} review`} />
                                <FocusMetric label="Accuracy" value={`${focusedCategory.accuracy.toFixed(0)}%`} />
                                <FocusMetric label="Target" value={`${focusedCategory.recommendedQuestionCount} clues`} />
                            </div>

                            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-900">
                                {formatReviewTiming(focusedCategory)}
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                                <Link
                                    href={buildRecommendationHref(focusedCategory.categoryId, focusedCategory.knowledgeCategoryId)}
                                    className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
                                >
                                    Start focused review
                                </Link>
                                {mixedReview ? (
                                    <Link
                                        href={buildRecommendationHref(mixedReview.categoryIds[0], mixedReview.knowledgeCategoryId, { mix: true })}
                                        className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-700 shadow-sm transition-colors hover:bg-blue-50"
                                    >
                                        Start mixed review
                                    </Link>
                                ) : null}
                            </div>
                        </div>
                    </div>
                ) : null}

                <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Quick session</h3>
                            <p className="mt-1 text-sm text-gray-600">
                                Follow these in order for a short retention pass.
                            </p>
                        </div>
                        <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                            {recommendations.quickSession.totalTargetQuestions} clues
                        </div>
                    </div>

                    <div className="mt-4 space-y-3">
                        {quickSessionItems.map((item, index) => (
                            <Link
                                key={item.categoryId}
                                href={buildRecommendationHref(item.categoryId, item.knowledgeCategoryId)}
                                className="group flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/40 p-4 transition-all hover:border-blue-200 hover:bg-white hover:shadow-sm"
                                aria-label={`Open ${item.categoryName} practice session`}
                            >
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-blue-700 shadow-sm">
                                    {index + 1}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="text-sm font-semibold text-gray-900">
                                            {item.categoryName}
                                        </div>
                                        <PriorityBadge priority={item.priority} />
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                                        <span className="rounded-full bg-white px-2 py-1">{item.actionLabel}</span>
                                        <span className="rounded-full bg-white px-2 py-1">{item.recommendedQuestionCount} clues</span>
                                    </div>
                                </div>
                                <svg className="mt-1 h-5 w-5 shrink-0 text-blue-400 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {mixedReview ? (
                <div className="mt-4 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm font-semibold text-gray-900">Mixed review opportunity</p>
                            <p className="mt-1 text-sm text-gray-600">
                                {mixedReview.categoryCount} of your top recommendations sit inside the same knowledge category. Start there with mix mode on to rotate between weak spots without leaving the track.
                            </p>
                        </div>
                        <Link
                            href={buildRecommendationHref(mixedReview.categoryIds[0], mixedReview.knowledgeCategoryId, { mix: true })}
                            className="inline-flex min-h-[46px] items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100"
                        >
                            Open mixed session
                        </Link>
                    </div>
                </div>
            ) : null}
        </section>
    )
}
