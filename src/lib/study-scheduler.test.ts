import { describe, expect, it } from 'vitest'
import {
    buildStudyRecommendations,
    getRecommendationPriority,
    getReviewIntervalDays
} from './study-scheduler'

function toDate(date: string): Date {
    return new Date(date)
}

describe('study scheduler', () => {
    it('maps accuracy to review intervals', () => {
        expect(getReviewIntervalDays(100)).toBe(14)
        expect(getReviewIntervalDays(79)).toBe(7)
        expect(getReviewIntervalDays(54)).toBe(4)
        expect(getReviewIntervalDays(33)).toBe(2)
        expect(getReviewIntervalDays(10)).toBe(1)
    })

    it('classifies recommendation priority with and without due status', () => {
        expect(getRecommendationPriority(20, 5)).toBe('HIGH')
        expect(getRecommendationPriority(50, 0)).toBe('HIGH')
        expect(getRecommendationPriority(50, 3)).toBe('MEDIUM')
        expect(getRecommendationPriority(74, 0)).toBe('MEDIUM')
        expect(getRecommendationPriority(74, 5)).toBe('LOW')
    })

    it('builds ranked recommendations with actionable session plan', () => {
        const now = toDate('2026-01-01T00:00:00.000Z')

        const recommendations = buildStudyRecommendations([
            {
                categoryId: 'cat-a',
                categoryName: 'History',
                totalQuestions: 20,
                correctAnswers: 10,
                lastAttemptedAt: toDate('2025-12-27T00:00:00.000Z'), // 5 days ago
            },
            {
                categoryId: 'cat-b',
                categoryName: 'Science',
                totalQuestions: 12,
                correctAnswers: 1,
                lastAttemptedAt: toDate('2025-12-31T00:00:00.000Z'), // 1 day ago
            },
            {
                categoryId: 'cat-c',
                categoryName: 'Movies',
                totalQuestions: 4,
                correctAnswers: 4,
                lastAttemptedAt: null,
            },
            {
                categoryId: 'cat-d',
                categoryName: 'Art',
                totalQuestions: 30,
                correctAnswers: 29,
                lastAttemptedAt: toDate('2025-12-10T00:00:00.000Z'), // not yet due (high accuracy, older)
            },
        ], {
            now,
            maxRecommendations: 3,
            maxSessionSize: 2,
        })

        expect(recommendations.totalAttemptedCategories).toBe(4)
        expect(recommendations.quickSession.categories).toEqual(['cat-b', 'cat-c'])
        expect(recommendations.recommendations).toHaveLength(3)
        expect(recommendations.recommendations[0].categoryId).toBe('cat-b')
        expect(recommendations.recommendations[0].priority).toBe('HIGH')
        expect(recommendations.recommendations[1].priority).toBe('MEDIUM')
        expect(['LOW', 'MEDIUM']).toContain(recommendations.recommendations[2].priority)
        expect(recommendations.focusNow?.categoryId).toBe('cat-b')
        expect(recommendations.quickSession.summary).toContain('2 focused')
    })

    it('clamps summary size and minimum recommendation count safely', () => {
        const result = buildStudyRecommendations([], {
            now: toDate('2026-01-01T00:00:00.000Z'),
            maxRecommendations: 0,
            maxSessionSize: 0,
        })

        expect(result.recommendations).toHaveLength(0)
        expect(result.quickSession.categories).toEqual([])
        expect(result.focusNow).toBeNull()
    })
})
