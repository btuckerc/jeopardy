export type ReviewPriority = 'HIGH' | 'MEDIUM' | 'LOW'

export interface CategoryStudySnapshot {
    categoryId: string
    categoryName: string
    totalQuestions: number
    correctAnswers: number
    lastAttemptedAt: Date | null
}

export interface CategoryStudyRecommendation extends CategoryStudySnapshot {
    accuracy: number
    reviewIntervalDays: number
    dueInDays: number
    isDue: boolean
    priority: ReviewPriority
    reason: string
}

export interface StudyRecommendationProfile {
    recommendations: CategoryStudyRecommendation[]
    quickSession: {
        categories: string[]
        summary: string
    }
    focusNow: CategoryStudyRecommendation | null
    totalAttemptedCategories: number
}

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_RECOMMENDATION_COUNT = 5

function clampAccuracy(accuracy: number): number {
    if (Number.isNaN(accuracy) || !Number.isFinite(accuracy)) return 0
    return Math.max(0, Math.min(100, accuracy))
}

function priorityScore(priority: ReviewPriority): number {
    return priority === 'HIGH' ? 3 : priority === 'MEDIUM' ? 2 : 1
}

export function getReviewIntervalDays(accuracy: number): number {
    const rounded = clampAccuracy(accuracy)

    if (rounded >= 85) return 14
    if (rounded >= 70) return 7
    if (rounded >= 50) return 4
    if (rounded >= 30) return 2

    return 1
}

export function getRecommendationPriority(accuracy: number, dueInDays: number): ReviewPriority {
    const rounded = clampAccuracy(accuracy)

    if (rounded < 35) {
        return 'HIGH'
    }

    if (dueInDays <= 0 && rounded < 65) {
        return 'HIGH'
    }

    if (rounded < 65) {
        return 'MEDIUM'
    }

    if (dueInDays <= 0) {
        return 'MEDIUM'
    }

    return 'LOW'
}

export function buildStudyRecommendations(
    categories: CategoryStudySnapshot[],
    options: {
        now?: Date
        maxRecommendations?: number
        maxSessionSize?: number
    } = {}
): StudyRecommendationProfile {
    const now = options.now ?? new Date()
    const maxRecommendations = Math.max(
        1,
        Math.min(options.maxRecommendations ?? MAX_RECOMMENDATION_COUNT, MAX_RECOMMENDATION_COUNT)
    )

    const maxSessionSize = Math.max(1, options.maxSessionSize ?? 3)

    const recommendations: CategoryStudyRecommendation[] = categories
        .map(category => {
            const accuracy = category.totalQuestions > 0
                ? (category.correctAnswers / category.totalQuestions) * 100
                : 0

            const reviewIntervalDays = getReviewIntervalDays(accuracy)
            const elapsedDays = category.lastAttemptedAt
                ? (now.getTime() - category.lastAttemptedAt.getTime()) / DAY_MS
                : Number.POSITIVE_INFINITY
            const dueInDays = category.lastAttemptedAt
                ? Math.floor(elapsedDays - reviewIntervalDays)
                : 0

            const clampedDueInDays = Math.max(0, dueInDays)
            const isDue = clampedDueInDays === 0
            const priority = getRecommendationPriority(accuracy, clampedDueInDays)

            const reason = isDue
                ? accuracy >= 70
                    ? `Keep your streak strong with quick review.`
                    : `Review now to improve retention in this category.`
                : `Review again in ${clampedDueInDays} day${clampedDueInDays === 1 ? '' : 's'}.`

            return {
                ...category,
                accuracy: clampAccuracy(accuracy),
                reviewIntervalDays,
                dueInDays: clampedDueInDays,
                isDue,
                priority,
                reason,
            }
        })
        .sort((a, b) => {
            if (a.isDue !== b.isDue) {
                return a.isDue ? -1 : 1
            }

            const priorityDiff = priorityScore(b.priority) - priorityScore(a.priority)
            if (priorityDiff !== 0) {
                return priorityDiff
            }

            if (a.accuracy !== b.accuracy) {
                return a.accuracy - b.accuracy
            }

            return a.dueInDays - b.dueInDays
        })
        .slice(0, maxRecommendations)

    const focusNow = recommendations.find(rec => rec.isDue) || recommendations[0] || null

    return {
        recommendations,
        quickSession: {
            categories: recommendations.slice(0, maxSessionSize).map(item => item.categoryId),
            summary: `${Math.min(maxSessionSize, recommendations.length)} focused categories for best retention boost`
        },
        focusNow,
        totalAttemptedCategories: categories.length,
    }
}
